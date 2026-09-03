"""
TuffyBlud Screen Streamer — High Performance Edition
Target: 60 FPS, optimized JPEG encoding, background capture threads

Install dependencies:
    pip install flask flask-cors mss pillow opencv-python numpy
"""

from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import mss
import threading
import time
import ctypes
import numpy as np

# Try OpenCV for fast JPEG encoding (5-10x faster than PIL)
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    from PIL import Image, ImageDraw
    import io
    print("[WARN] OpenCV not found — falling back to PIL. Install with: pip install opencv-python")

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# Frame Buffer: one per monitor index
# Background threads capture into these buffers.
# HTTP generators read from the buffer — no capture blocking.
# ─────────────────────────────────────────────
class MonitorBuffer:
    def __init__(self):
        self.frame_bytes = None       # Latest encoded JPEG bytes
        self.lock = threading.Lock()  # Thread-safe access
        self.last_update = 0.0        # Timestamp of last capture

    def write(self, data: bytes):
        with self.lock:
            self.frame_bytes = data
            self.last_update = time.monotonic()

    def read(self) -> bytes | None:
        with self.lock:
            return self.frame_bytes

# monitor_index → MonitorBuffer
buffers: dict[int, MonitorBuffer] = {}
capture_threads: dict[int, threading.Thread] = {}

# ─────────────────────────────────────────────
# Mouse Cursor — via Windows ctypes (no extra install)
# ─────────────────────────────────────────────
class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

def get_mouse_pos() -> tuple[int, int]:
    pt = POINT()
    ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
    return pt.x, pt.y

# ─────────────────────────────────────────────
# JPEG Encoding
# ─────────────────────────────────────────────
JPEG_QUALITY = 70  # 60-80 sweet spot: quality vs speed

def encode_jpeg_cv2(bgra_array: np.ndarray) -> bytes:
    """Fast JPEG encoding via OpenCV (operates on numpy arrays directly)."""
    bgr = bgra_array[:, :, :3]  # Drop alpha channel (BGRA → BGR)
    ok, buf = cv2.imencode('.jpg', bgr, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return buf.tobytes() if ok else b''

def encode_jpeg_pil(bgra_array: np.ndarray, monitor: dict) -> bytes:
    """Fallback JPEG encoding via PIL."""
    img = Image.frombytes('RGB', (monitor['width'], monitor['height']),
                          bgra_array, 'raw', 'BGRX')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=JPEG_QUALITY, optimize=False)
    return buf.getvalue()

# ─────────────────────────────────────────────
# Draw cursor onto numpy array
# ─────────────────────────────────────────────
def draw_cursor_cv2(frame_bgr: np.ndarray, rel_x: int, rel_y: int) -> np.ndarray:
    """Draws a visible cursor onto a BGR numpy array in-place."""
    h, w = frame_bgr.shape[:2]
    if not (0 <= rel_x < w and 0 <= rel_y < h):
        return frame_bgr

    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)

    # Crosshair lines
    cv2.line(frame_bgr, (rel_x - 14, rel_y), (rel_x - 6, rel_y), WHITE, 2, cv2.LINE_AA)
    cv2.line(frame_bgr, (rel_x + 6,  rel_y), (rel_x + 14, rel_y), WHITE, 2, cv2.LINE_AA)
    cv2.line(frame_bgr, (rel_x, rel_y - 14), (rel_x, rel_y - 6), WHITE, 2, cv2.LINE_AA)
    cv2.line(frame_bgr, (rel_x, rel_y + 6),  (rel_x, rel_y + 14), WHITE, 2, cv2.LINE_AA)

    # Outer white ring
    cv2.circle(frame_bgr, (rel_x, rel_y), 7, WHITE, 2, cv2.LINE_AA)
    # Inner black dot
    cv2.circle(frame_bgr, (rel_x, rel_y), 3, BLACK, -1, cv2.LINE_AA)
    return frame_bgr

def draw_cursor_pil(img: 'Image.Image', rel_x: int, rel_y: int) -> 'Image.Image':
    """Draws cursor via PIL (fallback)."""
    draw = ImageDraw.Draw(img)
    r = 7
    draw.ellipse((rel_x-r, rel_y-r, rel_x+r, rel_y+r), fill=None, outline='white', width=2)
    draw.ellipse((rel_x-3, rel_y-3, rel_x+3, rel_y+3), fill='black')
    draw.line([(rel_x-14, rel_y), (rel_x-r, rel_y)], fill='white', width=2)
    draw.line([(rel_x+r, rel_y), (rel_x+14, rel_y)], fill='white', width=2)
    draw.line([(rel_x, rel_y-14), (rel_x, rel_y-r)], fill='white', width=2)
    draw.line([(rel_x, rel_y+r), (rel_x, rel_y+14)], fill='white', width=2)
    return img

# ─────────────────────────────────────────────
# Background Capture Thread
# One thread per monitor index, runs until server stops.
# ─────────────────────────────────────────────
TARGET_FPS   = 62  # Slightly above 60 to absorb overhead
FRAME_BUDGET = 1.0 / TARGET_FPS  # ~0.0161s per frame

def capture_loop(monitor_index: int, buf: MonitorBuffer):
    """Continuously captures frames and writes encoded JPEG bytes to the buffer."""
    print(f"[Thread] Capture thread started for monitor {monitor_index}")
    with mss.mss() as sct:
        # Cache monitor geometry once (it won't change mid-session)
        num = len(sct.monitors)
        if monitor_index == 0:
            monitor = sct.monitors[0]
        elif monitor_index < num:
            monitor = sct.monitors[monitor_index]
        else:
            monitor = sct.monitors[1]  # Fallback

        while True:
            t_start = time.monotonic()

            try:
                # 1. Capture (mss returns BGRA)
                raw = sct.grab(monitor)
                frame_bgra = np.frombuffer(raw.raw, dtype=np.uint8)
                frame_bgra = frame_bgra.reshape((raw.height, raw.width, 4))

                # 2. Draw mouse cursor
                try:
                    mx, my = get_mouse_pos()
                    rel_x = mx - monitor['left']
                    rel_y = my - monitor['top']

                    if HAS_CV2:
                        frame_bgr = frame_bgra[:, :, :3].copy()  # BGRA → BGR (copy for drawing)
                        frame_bgr = draw_cursor_cv2(frame_bgr, rel_x, rel_y)
                        jpeg_bytes = b''
                        ok, buf_enc = cv2.imencode(
                            '.jpg', frame_bgr,
                            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                        )
                        if ok:
                            jpeg_bytes = buf_enc.tobytes()
                    else:
                        # PIL path
                        img = Image.frombytes(
                            'RGB',
                            (raw.width, raw.height),
                            frame_bgra,
                            'raw', 'BGRX'
                        )
                        img = draw_cursor_pil(img, rel_x, rel_y)
                        out = io.BytesIO()
                        img.save(out, format='JPEG', quality=JPEG_QUALITY, optimize=False)
                        jpeg_bytes = out.getvalue()

                except Exception as cursor_err:
                    # If cursor drawing fails, just encode without it
                    if HAS_CV2:
                        frame_bgr = frame_bgra[:, :, :3]
                        ok, buf_enc = cv2.imencode('.jpg', frame_bgr,
                                                   [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                        jpeg_bytes = buf_enc.tobytes() if ok else b''
                    else:
                        img = Image.frombytes('RGB', (raw.width, raw.height),
                                              frame_bgra, 'raw', 'BGRX')
                        out = io.BytesIO()
                        img.save(out, format='JPEG', quality=JPEG_QUALITY)
                        jpeg_bytes = out.getvalue()

                buf.write(jpeg_bytes)

            except Exception as e:
                print(f"[Thread] Capture error on monitor {monitor_index}: {e}")
                time.sleep(0.5)
                continue

            # 3. Adaptive sleep — maintain target FPS
            elapsed = time.monotonic() - t_start
            sleep_time = FRAME_BUDGET - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    print(f"[Thread] Capture thread for monitor {monitor_index} exited.")

def get_or_start_capture(monitor_index: int) -> MonitorBuffer:
    """Returns the buffer for a monitor, starting its capture thread if needed."""
    if monitor_index not in buffers:
        buf = MonitorBuffer()
        buffers[monitor_index] = buf
        t = threading.Thread(
            target=capture_loop,
            args=(monitor_index, buf),
            daemon=True,
            name=f"capture-mon-{monitor_index}"
        )
        capture_threads[monitor_index] = t
        t.start()
        # Give the thread a moment to produce its first frame
        time.sleep(0.1)
    return buffers[monitor_index]

# ─────────────────────────────────────────────
# MJPEG Stream Generator
# Reads from the shared buffer — no capture here.
# ─────────────────────────────────────────────
def stream_generator(monitor_index: int):
    buf = get_or_start_capture(monitor_index)
    # Target slightly faster poll rate than capture rate
    poll_interval = FRAME_BUDGET * 0.5

    while True:
        frame = buf.read()
        if frame:
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' +
                frame +
                b'\r\n'
            )
        time.sleep(poll_interval)

# ─────────────────────────────────────────────
# Flask Routes
# ─────────────────────────────────────────────
@app.route('/')
def index():
    with mss.mss() as sct:
        n = len(sct.monitors) - 1
    return f"TuffyBlud Streamer v2 running. {n} monitor(s) detected. Stream: /video_feed?monitor=1"

@app.route('/monitors')
def get_monitors():
    with mss.mss() as sct:
        monitors = []
        for i, m in enumerate(sct.monitors):
            name = "All Monitors (combined)" if i == 0 else f"Monitor {i}  ({m['width']}x{m['height']})"
            monitors.append({"id": i, "name": name})
    return jsonify(monitors)

@app.route('/video_feed')
def video_feed():
    monitor_index = request.args.get('monitor', default=1, type=int)
    print(f"[Flask] Stream requested: monitor={monitor_index}")
    return Response(
        stream_generator(monitor_index),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

# ─────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────
if __name__ == '__main__':
    with mss.mss() as sct:
        n = len(sct.monitors) - 1

    print("=" * 50)
    print("  TuffyBlud Screen Streamer  —  High Performance")
    print("=" * 50)
    print(f"  OpenCV encoder : {'YES (fast)' if HAS_CV2 else 'NO  (install: pip install opencv-python)'}")
    print(f"  Target FPS     : {TARGET_FPS}")
    print(f"  JPEG Quality   : {JPEG_QUALITY}")
    print(f"  Monitors found : {n}")
    print(f"  Stream URL     : http://localhost:5000/video_feed?monitor=1")
    print(f"  Tunnel cmd     : cloudflared tunnel --url http://localhost:5000")
    print("=" * 50)

    # Pre-start the primary monitor capture thread immediately
    get_or_start_capture(1)

    # Use threaded=True to handle multiple concurrent viewers
    app.run(host='0.0.0.0', port=5000, threaded=True, use_reloader=False)
