# TuffyBlud paired remote desktop

This site now supports mouse, scroll-wheel, and keyboard input in addition to
the existing WebRTC screen stream. The browser alone cannot control Windows,
so `streamer.py` runs a **local-only** bridge on the computer being controlled.
It listens only on `127.0.0.1`; no control port is exposed to the internet.

## One-time setup on the home PC

1. Install Python 3.10 or newer from [python.org](https://www.python.org/downloads/windows/), checking **Add Python to PATH** during installation.
2. In PowerShell, install the bridge dependencies:

   ```powershell
   cd C:\tuffyblud-site
   python -m pip install -r requirements.txt
   ```

3. Start the bridge and enter a unique pairing code when prompted:

   ```powershell
   .\start-bridge.ps1
   ```

   Use a long, random code (at least 16 characters). Do not commit it, put it in GitHub Pages, or reuse a password from another account.
4. On the home PC, open `http://127.0.0.1:5000/broadcast`. Select **Desktop 1** or **Desktop 2**, click **Start Broadcast**, and choose the matching physical monitor in the browser's screen-share picker. Keep this tab and the bridge running.

## Connect away from home

1. Open the deployed GitHub Pages site.
2. Enter the pairing code configured on the home PC.
3. Choose the same Desktop number as the monitor shared at home.
4. Once the video says **Live — Control active**, click the video to focus it. Mouse movement, clicks, wheel scrolls, and normal keyboard input are sent to the home PC.

Disconnect or switch away from the tab to release any held keyboard or mouse button state automatically.

## Security model

- The old username/password embedded in public JavaScript has been removed.
- Before any video is answered or any input is accepted, the remote viewer must provide the pairing code over the WebRTC data channel.
- The local bridge turns a successful pairing into a short-lived 30-minute capability that remains only on the home computer's broadcaster tab.
- The input API rejects all non-localhost requests. GitHub Pages sends no HTTP request to your computer.
- The bridge releases held input when a viewer disconnects or its control session expires.

Treat the pairing code like a password. Stop the bridge when you do not need remote access, and rotate the code by restarting it with a new value.

## Windows/browser limits

This is a lightweight browser-based remote-control setup, not a replacement for Windows Remote Desktop. Windows deliberately does not allow ordinary apps to control the secure UAC desktop or send Ctrl+Alt+Delete. Browser-reserved shortcuts may also remain local to the computer you are using. The home PC must be awake, signed in, online, and still sharing its screen.
