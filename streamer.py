from flask import Flask, Response, request
from flask_cors import CORS
import mss
from PIL import Image
import io
import time

app = Flask(__name__)
# Enable CORS to allow the frontend to load the image if needed (though <img> tags usually ignore CORS)
CORS(app)

def generate_frames():
    """Captures the screen and yields JPEG frames for the MJPEG stream."""
    with mss.mss() as sct:
        # Use the primary monitor. 
        # sct.monitors[0] is all monitors combined, sct.monitors[1] is the first monitor.
        monitor = sct.monitors[1]
        
        while True:
            # Throttle frame rate slightly to save CPU/Bandwidth (approx 20-30 FPS)
            time.sleep(0.03)
            
            # Capture screen
            sct_img = sct.grab(monitor)
            
            # Convert raw bytes to PIL Image
            img = Image.frombytes('RGB', sct_img.size, sct_img.bgra, 'raw', 'BGRX')
            
            # Compress to JPEG
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=60)
            frame = img_byte_arr.getvalue()
            
            # Yield the frame in the MJPEG multipart format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return "Streamer is running. Feed is available at /video_feed"

@app.route('/video_feed')
def video_feed():
    """Route that serves the MJPEG stream."""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    print("Starting screen streamer on http://localhost:5000...")
    print("To tunnel this, run: cloudflared tunnel --url http://localhost:5000")
    # Run on all interfaces, port 5000
    app.run(host='0.0.0.0', port=5000, threaded=True)
