from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import mss
from PIL import Image, ImageDraw
import io
import time
import pyautogui

app = Flask(__name__)
# Enable CORS to allow the frontend to load the image if needed
CORS(app)

def generate_frames(monitor_index):
    """Captures the screen, draws the mouse, and yields JPEG frames."""
    with mss.mss() as sct:
        # Validate monitor index
        if monitor_index < 0 or monitor_index >= len(sct.monitors):
            monitor_index = 1 # Fallback to primary

        monitor = sct.monitors[monitor_index]
        
        while True:
            time.sleep(0.03) # Approx 30 FPS throttle
            
            # Capture screen
            sct_img = sct.grab(monitor)
            img = Image.frombytes('RGB', sct_img.size, sct_img.bgra, 'raw', 'BGRX')
            
            # Draw mouse cursor
            try:
                # Get global mouse position
                mouse_x, mouse_y = pyautogui.position()
                
                # Calculate relative position on the captured monitor
                rel_x = mouse_x - monitor['left']
                rel_y = mouse_y - monitor['top']
                
                # Only draw if the mouse is currently inside this monitor
                if 0 <= rel_x <= monitor['width'] and 0 <= rel_y <= monitor['height']:
                    draw = ImageDraw.Draw(img)
                    
                    # Draw a simple high-visibility cursor (a black circle with white border)
                    r = 6 # cursor radius
                    draw.ellipse((rel_x - r, rel_y - r, rel_x + r, rel_y + r), fill='black', outline='white', width=2)
            except Exception as e:
                pass # Ignore mouse tracking errors if they occur
            
            # Compress to JPEG
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=60)
            frame = img_byte_arr.getvalue()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return "Streamer is running. Feed is available at /video_feed"

@app.route('/monitors')
def get_monitors():
    """Returns a list of available monitors."""
    with mss.mss() as sct:
        # sct.monitors[0] is all monitors combined. 1..N are individual.
        monitors = []
        for i, m in enumerate(sct.monitors):
            if i == 0:
                name = "All Monitors"
            else:
                name = f"Monitor {i} ({m['width']}x{m['height']})"
            monitors.append({"id": i, "name": name})
        return jsonify(monitors)

@app.route('/video_feed')
def video_feed():
    """Route that serves the MJPEG stream. Pass ?monitor=N to select monitor."""
    # Default to 1 (primary monitor)
    monitor_index = request.args.get('monitor', default=1, type=int)
    return Response(generate_frames(monitor_index), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    print("Starting screen streamer on http://localhost:5000...")
    print("To tunnel this, run: cloudflared tunnel --url http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, threaded=True)
