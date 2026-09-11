/*
 * TuffyBlud Portal — viewer and paired WebRTC control channel.
 * The pairing code is entered by the owner and kept only in page memory.
 */

const PEER_IDS = { 1: 'tuffyblud-desktop-1', 2: 'tuffyblud-desktop-2' };

const loginPage = document.getElementById('login-page');
const dashPage = document.getElementById('dashboard-page');
const loginForm = document.getElementById('login-form');
const pairingCodeIn = document.getElementById('pairing-code');
const errorMsg = document.getElementById('error-msg');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const rdpOverlay = document.getElementById('rdp-overlay');
const rdpCloseBtn = document.getElementById('rdp-close-btn');
const rdpFullscreenBtn = document.getElementById('rdp-fullscreen-btn');
const rdpTitle = document.getElementById('rdp-title');
const rdpStatusDot = document.getElementById('rdp-status-dot');
const rdpConnStatus = document.getElementById('rdp-conn-status');
const streamFeed = document.getElementById('stream-feed');
const streamPlaceholder = document.getElementById('stream-placeholder');
const connMessage = document.getElementById('conn-message');
const controlHint = document.getElementById('control-hint');

let viewerPeer = null;
let activeCall = null;
let controlConnection = null;
let currentDesktopNum = 1;
let pairingCode = '';
let controlReady = false;
let lastPointerEvent = null;
let pointerFrameQueued = false;
let lastPointerPoint = { x: 0.5, y: 0.5 };

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  pairingCode = pairingCodeIn.value.trim();
  hideError();
  if (pairingCode.length < 16) {
    showError('Enter the 16+ character pairing code configured on your home PC.');
    return;
  }
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  setTimeout(() => transitionTo(dashPage), 350);
});

logoutBtn.addEventListener('click', () => {
  closeOverlay();
  pairingCode = '';
  transitionTo(loginPage);
  setTimeout(() => {
    loginForm.reset();
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    hideError();
  }, 550);
});

function handleDesktopClick(num) {
  const card = document.getElementById(`desktop-${num}-btn`);
  card.style.transform = 'scale(0.97)';
  setTimeout(() => { card.style.transform = ''; }, 180);
  openDesktop(num);
}

function openDesktop(num) {
  currentDesktopNum = num;
  rdpTitle.textContent = `Desktop ${num}`;
  streamFeed.style.display = 'none';
  streamFeed.srcObject = null;
  streamPlaceholder.style.display = 'flex';
  controlHint.textContent = 'Pairing an encrypted control channel…';
  rdpOverlay.classList.add('active');
  setOverlayState('connecting');
  setTimeout(() => connectWebRTC(num), 250);
}

function connectWebRTC(desktopNum) {
  teardownPeer();
  setOverlayState('connecting');
  connMessage.textContent = `Connecting to Desktop ${desktopNum}…`;

  viewerPeer = new Peer({
    config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ] }
  });

  viewerPeer.on('open', () => {
    controlConnection = viewerPeer.connect(PEER_IDS[desktopNum], { reliable: true });
    controlConnection.on('open', () => {
      controlConnection.send({ type: 'authenticate', pairingCode, desktop: desktopNum });
      rdpConnStatus.textContent = 'Authorizing…';
    });
    controlConnection.on('data', (message) => handleControlMessage(message, desktopNum));
    controlConnection.on('close', () => {
      controlReady = false;
      if (rdpOverlay.classList.contains('active')) controlHint.textContent = 'Control channel disconnected.';
    });
    controlConnection.on('error', () => failOrRetry('Control channel error — retrying…'));
  });

  viewerPeer.on('error', (error) => {
    if (error.type === 'peer-unavailable') {
      failOrRetry('Home broadcaster is offline. Make sure it is running.');
    } else {
      failOrRetry(`Connection error: ${error.type || 'unknown'}`);
    }
  });
  viewerPeer.on('disconnected', () => {
    if (!viewerPeer?.destroyed) viewerPeer.reconnect();
  });
}

function handleControlMessage(message, desktopNum) {
  if (!message || typeof message !== 'object') return;
  if (message.type !== 'auth-result') return;
  if (!message.ok) {
    returnToPairing('Pairing was rejected. Check the code and try again.');
    return;
  }
  controlReady = true;
  controlHint.textContent = 'Control active — click the screen to send mouse and keyboard input.';
  rdpConnStatus.textContent = 'Authorized — starting video…';

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  activeCall = viewerPeer.call(PEER_IDS[desktopNum], canvas.captureStream(1));
  activeCall.on('stream', (remoteStream) => {
    streamFeed.srcObject = remoteStream;
    streamFeed.style.display = 'block';
    streamPlaceholder.style.display = 'none';
    streamFeed.focus({ preventScroll: true });
    setOverlayState('live');
    rdpConnStatus.textContent = 'Live — Control active';
  });
  activeCall.on('close', () => failOrRetry('Broadcaster disconnected — retrying…'));
  activeCall.on('error', () => failOrRetry('Video connection error — retrying…'));
}

function failOrRetry(message) {
  controlReady = false;
  if (!rdpOverlay.classList.contains('active')) return;
  setOverlayState('disconnected');
  rdpConnStatus.textContent = message;
  connMessage.textContent = message;
  controlHint.textContent = 'Waiting to reconnect…';
  setTimeout(() => {
    if (rdpOverlay.classList.contains('active')) connectWebRTC(currentDesktopNum);
  }, 3500);
}

function sendControl(message) {
  if (controlReady && controlConnection?.open) controlConnection.send(message);
}

function normalizedPointer(event, clampToScreen = false) {
  const rect = streamFeed.getBoundingClientRect();
  const videoWidth = streamFeed.videoWidth;
  const videoHeight = streamFeed.videoHeight;
  if (!videoWidth || !videoHeight) return null;
  const scale = Math.min(rect.width / videoWidth, rect.height / videoHeight);
  const shownWidth = videoWidth * scale;
  const shownHeight = videoHeight * scale;
  const left = rect.left + (rect.width - shownWidth) / 2;
  const top = rect.top + (rect.height - shownHeight) / 2;
  if (!clampToScreen && (event.clientX < left || event.clientX > left + shownWidth || event.clientY < top || event.clientY > top + shownHeight)) return null;
  const point = {
    x: Math.max(0, Math.min(1, (event.clientX - left) / shownWidth)),
    y: Math.max(0, Math.min(1, (event.clientY - top) / shownHeight))
  };
  lastPointerPoint = point;
  return point;
}

function queuePointerMove(event) {
  lastPointerEvent = event;
  if (pointerFrameQueued) return;
  pointerFrameQueued = true;
  requestAnimationFrame(() => {
    pointerFrameQueued = false;
    const point = normalizedPointer(lastPointerEvent);
    if (point) sendControl({ type: 'input', kind: 'pointer', action: 'move', ...point });
  });
}

streamFeed.addEventListener('pointermove', queuePointerMove);
streamFeed.addEventListener('pointerdown', (event) => {
  const point = normalizedPointer(event);
  if (!point) return;
  event.preventDefault();
  streamFeed.focus({ preventScroll: true });
  streamFeed.setPointerCapture?.(event.pointerId);
  sendControl({ type: 'input', kind: 'pointer', action: 'down', button: event.button, ...point });
});
streamFeed.addEventListener('pointerup', (event) => {
  const point = normalizedPointer(event, true) || lastPointerPoint;
  event.preventDefault();
  sendControl({ type: 'input', kind: 'pointer', action: 'up', button: event.button, ...point });
});
streamFeed.addEventListener('contextmenu', (event) => event.preventDefault());
streamFeed.addEventListener('wheel', (event) => {
  const point = normalizedPointer(event);
  if (!point) return;
  event.preventDefault();
  sendControl({ type: 'input', kind: 'pointer', action: 'wheel', deltaX: event.deltaX, deltaY: event.deltaY, ...point });
}, { passive: false });

document.addEventListener('keydown', (event) => {
  if (!controlReady || !rdpOverlay.classList.contains('active')) return;
  // Let the browser retain only its unavoidable safety shortcuts.
  if (event.code === 'F11' || (event.ctrlKey && event.shiftKey && event.code === 'KeyI')) return;
  event.preventDefault();
  if (!event.repeat) sendControl({ type: 'input', kind: 'key', action: 'down', code: event.code });
});
document.addEventListener('keyup', (event) => {
  if (!controlReady || !rdpOverlay.classList.contains('active')) return;
  event.preventDefault();
  sendControl({ type: 'input', kind: 'key', action: 'up', code: event.code });
});
window.addEventListener('blur', () => sendControl({ type: 'release-inputs' }));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sendControl({ type: 'release-inputs' });
});

function setOverlayState(state) {
  rdpStatusDot.className = 'status-dot rdp-status';
  rdpStatusDot.style.background = state === 'live' ? '#22c55e' : (state === 'error' || state === 'disconnected' ? '#ef4444' : '#eab308');
}

function closeOverlay() {
  rdpOverlay.classList.remove('active');
  setTimeout(() => {
    teardownPeer();
    streamFeed.srcObject = null;
    streamFeed.style.display = 'none';
    streamPlaceholder.style.display = 'flex';
  }, 350);
}

function returnToPairing(message) {
  rdpOverlay.classList.remove('active');
  teardownPeer();
  pairingCode = '';
  transitionTo(loginPage);
  setTimeout(() => {
    loginForm.reset();
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    showError(message);
  }, 600);
}

function teardownPeer() {
  controlReady = false;
  if (controlConnection) {
    try { controlConnection.send({ type: 'release' }); controlConnection.close(); } catch (_) {}
    controlConnection = null;
  }
  if (activeCall) { try { activeCall.close(); } catch (_) {} activeCall = null; }
  if (viewerPeer && !viewerPeer.destroyed) { try { viewerPeer.destroy(); } catch (_) {} viewerPeer = null; }
}

rdpCloseBtn.addEventListener('click', closeOverlay);
rdpFullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) rdpOverlay.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
});

function transitionTo(targetPage) {
  const activePage = document.querySelector('.page.active');
  if (!activePage || activePage === targetPage) return;
  activePage.classList.add('fade-out');
  setTimeout(() => {
    activePage.classList.remove('active', 'fade-out');
    targetPage.classList.add('active', 'fade-in');
    setTimeout(() => targetPage.classList.remove('fade-in'), 800);
  }, 500);
}

function showError(message) { errorMsg.textContent = message; errorMsg.classList.add('visible'); }
function hideError() { errorMsg.textContent = ''; errorMsg.classList.remove('visible'); }

document.addEventListener('mousemove', (event) => {
  document.querySelectorAll('.shape').forEach((shape, index) => {
    const factor = (index + 1) * 8;
    shape.style.transform = `translate(${(event.clientX / window.innerWidth - 0.5) * factor}px, ${(event.clientY / window.innerHeight - 0.5) * factor}px)`;
  });
});
