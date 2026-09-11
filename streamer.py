"""
TuffyBlud local screen/control bridge for Windows.

The public portal never connects to this service. The broadcaster page at
http://127.0.0.1:5000/broadcast uses it only after a WebRTC peer supplies
the pairing code. Input is accepted from localhost only and is translated to
native Windows SendInput calls.

Start with a high-entropy pairing code (16+ characters):
    $env:TUFFY_PAIR_CODE = 'replace-this-with-a-long-random-code'
    py .\streamer.py
"""

from __future__ import annotations

import ctypes
import hmac
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import mss
import numpy as np
from flask import Flask, Response, abort, jsonify, request, send_from_directory

# Try OpenCV for fast JPEG encoding (5-10x faster than PIL).
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    from PIL import Image, ImageDraw
    import io
    print("[WARN] OpenCV not found — falling back to PIL. Install opencv-python for better performance.")


PAIRING_CODE = os.environ.get("TUFFY_PAIR_CODE", "")
if len(PAIRING_CODE) < 16:
    raise RuntimeError(
        "Set TUFFY_PAIR_CODE to a unique 16+ character pairing code before starting the bridge."
    )

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024


# ─────────────────────────────────────────────
# Windows input primitives (no third-party control package required)
# ─────────────────────────────────────────────
ULONG_PTR = ctypes.c_size_t


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", ctypes.c_long),
        ("dy", ctypes.c_long),
        ("mouseData", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ULONG_PTR),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.c_ushort),
        ("wScan", ctypes.c_ushort),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ULONG_PTR),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [("uMsg", ctypes.c_ulong), ("wParamL", ctypes.c_short), ("wParamH", ctypes.c_ushort)]


class INPUT_UNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _anonymous_ = ("union",)
    _fields_ = [("type", ctypes.c_ulong), ("union", INPUT_UNION)]


INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_HWHEEL = 0x1000
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_ABSOLUTE = 0x8000

SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79

BUTTON_FLAGS = {
    ("down", 0): MOUSEEVENTF_LEFTDOWN,
    ("up", 0): MOUSEEVENTF_LEFTUP,
    ("down", 1): MOUSEEVENTF_MIDDLEDOWN,
    ("up", 1): MOUSEEVENTF_MIDDLEUP,
    ("down", 2): MOUSEEVENTF_RIGHTDOWN,
    ("up", 2): MOUSEEVENTF_RIGHTUP,
}

VK_BY_CODE = {
    "Backspace": 0x08, "Tab": 0x09, "Enter": 0x0D, "ShiftLeft": 0xA0,
    "ShiftRight": 0xA1, "ControlLeft": 0xA2, "ControlRight": 0xA3,
    "AltLeft": 0xA4, "AltRight": 0xA5, "Pause": 0x13, "CapsLock": 0x14,
    "Escape": 0x1B, "Space": 0x20, "PageUp": 0x21, "PageDown": 0x22,
    "End": 0x23, "Home": 0x24, "ArrowLeft": 0x25, "ArrowUp": 0x26,
    "ArrowRight": 0x27, "ArrowDown": 0x28, "Insert": 0x2D,
    "Delete": 0x2E, "MetaLeft": 0x5B, "MetaRight": 0x5C,
    "ContextMenu": 0x5D, "NumLock": 0x90, "ScrollLock": 0x91,
    "Semicolon": 0xBA, "Equal": 0xBB, "Comma": 0xBC, "Minus": 0xBD,
    "Period": 0xBE, "Slash": 0xBF, "Backquote": 0xC0,
    "BracketLeft": 0xDB, "Backslash": 0xDC, "BracketRight": 0xDD,
    "Quote": 0xDE,
}
for _i in range(1, 13):
    VK_BY_CODE[f"F{_i}"] = 0x6F + _i
for _i in range(10):
    VK_BY_CODE[f"Digit{_i}"] = 0x30 + _i
    VK_BY_CODE[f"Numpad{_i}"] = 0x60 + _i
for _i, _letter in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
    VK_BY_CODE[f"Key{_letter}"] = 0x41 + _i
VK_BY_CODE.update({
    "NumpadMultiply": 0x6A, "NumpadAdd": 0x6B, "NumpadSubtract": 0x6D,
    "NumpadDecimal": 0x6E, "NumpadDivide": 0x6F,
})


def send_inputs(*inputs: INPUT) -> None:
    if not inputs:
        return
    array_type = INPUT * len(inputs)
    sent = ctypes.windll.user32.SendInput(len(inputs), array_type(*inputs), ctypes.sizeof(INPUT))
    if sent != len(inputs):
        raise OSError(ctypes.get_last_error(), "Windows rejected an input event")


def mouse_input(dx: int = 0, dy: int = 0, flags: int = 0, data: int = 0) -> INPUT:
    return INPUT(type=INPUT_MOUSE, mi=MOUSEINPUT(dx, dy, data, flags, 0, 0))


def keyboard_input(vk: int, is_key_up: bool) -> INPUT:
    return INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(vk, 0, KEYEVENTF_KEYUP if is_key_up else 0, 0, 0))


def virtual_desktop() -> tuple[int, int, int, int]:
    user32 = ctypes.windll.user32
    return (
        user32.GetSystemMetrics(SM_XVIRTUALSCREEN),
        user32.GetSystemMetrics(SM_YVIRTUALSCREEN),
        user32.GetSystemMetrics(SM_CXVIRTUALSCREEN),
        user32.GetSystemMetrics(SM_CYVIRTUALSCREEN),
    )


def move_pointer(x: int, y: int) -> None:
    left, top, width, height = virtual_desktop()
    dx = round((x - left) * 65535 / max(1, width - 1))
    dy = round((y - top) * 65535 / max(1, height - 1))
    send_inputs(mouse_input(dx, dy, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK))


# ─────────────────────────────────────────────
# Pairing/session state. Sessions are capabilities held only by the local
# broadcaster tab, never by the public GitHub Pages site.
# ─────────────────────────────────────────────
SESSION_TTL_SECONDS = 30 * 60


@dataclass
class ControlSession:
    desktop: int
    expires_at: float
    pressed_keys: set[int] = field(default_factory=set)
    pressed_buttons: set[int] = field(default_factory=set)


sessions: dict[str, ControlSession] = {}
sessions_lock = threading.Lock()
monitor_cache: list[dict[str, int | str]] = []
monitor_cache_at = 0.0
monitor_cache_lock = threading.Lock()


def monitor_layout() -> list[dict[str, int | str]]:
    global monitor_cache, monitor_cache_at
    now = time.monotonic()
    with monitor_cache_lock:
        # Mouse moves are frequent; enumerate Windows displays at most once per
        # five seconds while still noticing a monitor configuration change.
        if now - monitor_cache_at >= 5 or not monitor_cache:
            with mss.mss() as sct:
                monitor_cache = [
                    {
                        "id": index,
                        "name": f"Monitor {index}",
                        "left": int(monitor["left"]),
                        "top": int(monitor["top"]),
                        "width": int(monitor["width"]),
                        "height": int(monitor["height"]),
                    }
                    for index, monitor in enumerate(sct.monitors[1:], start=1)
                ]
            monitor_cache_at = now
        return [item.copy() for item in monitor_cache]


def monitor_for_desktop(desktop: int) -> dict[str, int | str] | None:
    return next((item for item in monitor_layout() if item["id"] == desktop), None)


def release_session_inputs(session: ControlSession) -> None:
    events: list[INPUT] = []
    for vk in session.pressed_keys:
        events.append(keyboard_input(vk, True))
    for button in session.pressed_buttons:
        flag = BUTTON_FLAGS.get(("up", button))
        if flag:
            events.append(mouse_input(flags=flag))
    session.pressed_keys.clear()
    session.pressed_buttons.clear()
    try:
        send_inputs(*events)
    except OSError as exc:
        print(f"[Control] Could not release input: {exc}")


def expire_sessions() -> None:
    now = time.monotonic()
    expired: list[ControlSession] = []
    with sessions_lock:
        for session_id, session in list(sessions.items()):
            if session.expires_at <= now:
                expired.append(session)
                del sessions[session_id]
    for session in expired:
        release_session_inputs(session)


def session_reaper() -> None:
    while True:
        expire_sessions()
        time.sleep(5)


def localhost_only() -> None:
    if request.remote_addr not in {"127.0.0.1", "::1"}:
        abort(403)


def json_object() -> dict[str, Any]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400, "Expected a JSON object")
    return payload


def require_session(payload: dict[str, Any]) -> ControlSession:
    token = payload.get("session")
    if not isinstance(token, str):
        abort(401)
    expire_sessions()
    with sessions_lock:
        session = sessions.get(token)
        if not session:
            abort(401)
        session.expires_at = time.monotonic() + SESSION_TTL_SECONDS
        return session


def normalized_coordinate(value: Any) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        abort(400, "Coordinates must be numbers")
    return max(0.0, min(1.0, float(value)))


# ─────────────────────────────────────────────
# Optional MJPEG stream (kept for the existing local streaming workflow)
# ─────────────────────────────────────────────
class MonitorBuffer:
    def __init__(self) -> None:
        self.frame_bytes: bytes | None = None
        self.lock = threading.Lock()

    def write(self, data: bytes) -> None:
        with self.lock:
            self.frame_bytes = data

    def read(self) -> bytes | None:
        with self.lock:
            return self.frame_bytes


buffers: dict[int, MonitorBuffer] = {}
capture_threads: dict[int, threading.Thread] = {}
JPEG_QUALITY = 70
TARGET_FPS = 30
FRAME_BUDGET = 1.0 / TARGET_FPS


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


def get_mouse_pos() -> tuple[int, int]:
    point = POINT()
    ctypes.windll.user32.GetCursorPos(ctypes.byref(point))
    return point.x, point.y


def draw_cursor_cv2(frame_bgr: np.ndarray, rel_x: int, rel_y: int) -> None:
    height, width = frame_bgr.shape[:2]
    if 0 <= rel_x < width and 0 <= rel_y < height:
        cv2.circle(frame_bgr, (rel_x, rel_y), 7, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.circle(frame_bgr, (rel_x, rel_y), 3, (0, 0, 0), -1, cv2.LINE_AA)


def capture_loop(monitor_index: int, buffer: MonitorBuffer) -> None:
    print(f"[Stream] Capture thread started for monitor {monitor_index}")
    with mss.mss() as sct:
        monitors = sct.monitors
        monitor = monitors[monitor_index] if monitor_index < len(monitors) else monitors[1]
        while True:
            started = time.monotonic()
            try:
                raw = sct.grab(monitor)
                frame = np.frombuffer(raw.raw, dtype=np.uint8).reshape((raw.height, raw.width, 4))
                if HAS_CV2:
                    bgr = frame[:, :, :3].copy()
                    mouse_x, mouse_y = get_mouse_pos()
                    draw_cursor_cv2(bgr, mouse_x - monitor["left"], mouse_y - monitor["top"])
                    ok, encoded = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    buffer.write(encoded.tobytes() if ok else b"")
                else:
                    image = Image.frombytes("RGB", (raw.width, raw.height), frame, "raw", "BGRX")
                    mouse_x, mouse_y = get_mouse_pos()
                    draw = ImageDraw.Draw(image)
                    rel_x, rel_y = mouse_x - monitor["left"], mouse_y - monitor["top"]
                    draw.ellipse((rel_x - 7, rel_y - 7, rel_x + 7, rel_y + 7), outline="white", width=2)
                    output = io.BytesIO()
                    image.save(output, format="JPEG", quality=JPEG_QUALITY)
                    buffer.write(output.getvalue())
            except Exception as exc:
                print(f"[Stream] Capture error: {exc}")
                time.sleep(0.5)
            remaining = FRAME_BUDGET - (time.monotonic() - started)
            if remaining > 0:
                time.sleep(remaining)


def get_or_start_capture(monitor_index: int) -> MonitorBuffer:
    if monitor_index not in buffers:
        buffer = MonitorBuffer()
        buffers[monitor_index] = buffer
        thread = threading.Thread(target=capture_loop, args=(monitor_index, buffer), daemon=True)
        capture_threads[monitor_index] = thread
        thread.start()
    return buffers[monitor_index]


def stream_generator(monitor_index: int):
    buffer = get_or_start_capture(monitor_index)
    while True:
        frame = buffer.read()
        if frame:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        time.sleep(FRAME_BUDGET / 2)


# ─────────────────────────────────────────────
# Flask routes
# ─────────────────────────────────────────────
@app.get("/")
def index() -> str:
    return "TuffyBlud local bridge is running. Open http://127.0.0.1:5000/broadcast on this PC."


@app.get("/broadcast")
def broadcast() -> Any:
    return send_from_directory(app.root_path, "broadcast.html")


@app.get("/monitors")
def get_monitors() -> Response:
    return jsonify(monitor_layout())


@app.get("/video_feed")
def video_feed() -> Response:
    monitor_index = request.args.get("monitor", default=1, type=int)
    return Response(stream_generator(monitor_index), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.get("/control/health")
def control_health() -> Response:
    localhost_only()
    return jsonify({"ready": True, "monitors": len(monitor_layout())})


@app.post("/control/pair")
def control_pair() -> Response:
    localhost_only()
    payload = json_object()
    supplied_code = payload.get("pairingCode")
    desktop = payload.get("desktop")
    if not isinstance(supplied_code, str) or not hmac.compare_digest(supplied_code, PAIRING_CODE):
        time.sleep(0.25)  # Deliberately make repeated wrong guesses slower.
        abort(401)
    if not isinstance(desktop, int) or monitor_for_desktop(desktop) is None:
        abort(400, "Select a valid physical monitor in the broadcaster.")

    session_token = secrets.token_urlsafe(32)
    with sessions_lock:
        sessions[session_token] = ControlSession(
            desktop=desktop,
            expires_at=time.monotonic() + SESSION_TTL_SECONDS,
        )
    return jsonify({"session": session_token, "expiresIn": SESSION_TTL_SECONDS})


@app.post("/control/input")
def control_input() -> Response:
    localhost_only()
    payload = json_object()
    session = require_session(payload)
    kind = payload.get("kind")

    if kind == "pointer":
        monitor = monitor_for_desktop(session.desktop)
        if monitor is None:
            abort(409, "The selected monitor is no longer available")
        x = int(monitor["left"]) + round(normalized_coordinate(payload.get("x")) * (int(monitor["width"]) - 1))
        y = int(monitor["top"]) + round(normalized_coordinate(payload.get("y")) * (int(monitor["height"]) - 1))
        move_pointer(x, y)
        action = payload.get("action")
        if action in {"down", "up"}:
            button = payload.get("button")
            if not isinstance(button, int) or button not in {0, 1, 2}:
                abort(400, "Unsupported mouse button")
            if action == "down":
                session.pressed_buttons.add(button)
            else:
                session.pressed_buttons.discard(button)
            send_inputs(mouse_input(flags=BUTTON_FLAGS[(action, button)]))
        elif action == "wheel":
            delta_x = payload.get("deltaX", 0)
            delta_y = payload.get("deltaY", 0)
            if not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in (delta_x, delta_y)):
                abort(400, "Wheel deltas must be numbers")
            # Browser wheel deltas are usually ±100 per notch; Windows expects ±120.
            events: list[INPUT] = []
            if delta_y:
                events.append(mouse_input(flags=MOUSEEVENTF_WHEEL, data=int(max(-1200, min(1200, -delta_y * 1.2)))))
            if delta_x:
                events.append(mouse_input(flags=MOUSEEVENTF_HWHEEL, data=int(max(-1200, min(1200, delta_x * 1.2)))))
            send_inputs(*events)
        elif action != "move":
            abort(400, "Unsupported pointer action")

    elif kind == "key":
        code = payload.get("code")
        action = payload.get("action")
        if not isinstance(code, str) or action not in {"down", "up"}:
            abort(400, "Invalid key event")
        vk = VK_BY_CODE.get(code)
        if vk is None:
            abort(400, "Unsupported key")
        if action == "down":
            session.pressed_keys.add(vk)
        else:
            session.pressed_keys.discard(vk)
        send_inputs(keyboard_input(vk, action == "up"))

    else:
        abort(400, "Unsupported input event")

    return jsonify({"ok": True})


@app.post("/control/release")
def control_release() -> Response:
    localhost_only()
    payload = json_object()
    token = payload.get("session")
    if not isinstance(token, str):
        abort(400)
    with sessions_lock:
        session = sessions.pop(token, None)
    if session:
        release_session_inputs(session)
    return jsonify({"ok": True})


@app.post("/control/clear")
def control_clear() -> Response:
    """Release held keys/buttons but keep the authenticated session alive."""
    localhost_only()
    payload = json_object()
    session = require_session(payload)
    release_session_inputs(session)
    return jsonify({"ok": True})


if __name__ == "__main__":
    threading.Thread(target=session_reaper, daemon=True, name="control-session-reaper").start()
    print("=" * 62)
    print("  TuffyBlud local control bridge — Windows only")
    print("=" * 62)
    print("  Broadcaster: http://127.0.0.1:5000/broadcast")
    print("  Input API:   localhost only; no public control port is opened")
    print(f"  Monitors:    {len(monitor_layout())}")
    print("=" * 62)
    app.run(host="127.0.0.1", port=5000, threaded=True, use_reloader=False)
