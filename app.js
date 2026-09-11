/*
 * TuffyBlud Portal — tunnelled viewer and paired control channel.
 * A Cloudflare Tunnel relays the home bridge, avoiding unreliable direct
 * WebRTC connections between separate networks. Credentials stay in memory.
 */

const loginPage = document.getElementById('login-page');
const dashPage = document.getElementById('dashboard-page');
const loginForm = document.getElementById('login-form');
const pairingCodeIn = document.getElementById('pairing-code');
const bridgeUrlIn = document.getElementById('bridge-url');
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

let currentDesktopNum = 1;
let pairingCode = '';
let bridgeUrl = '';
let remoteSession = null;
let controlReady = false;
let inputQueue = Promise.resolve();
let streamRetryTimer = null;
let pointerFrameQueued = false;
let pendingPointerDelta = { x: 0, y: 0 };
let ignoreNextPointerMove = true;

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  pairingCode = pairingCodeIn.value.trim();
  hideError();
  if (pairingCode.length < 16) {
    showError('Enter the 16+ character pairing code configured on your home PC.');
    return;
  }
  try {
    const parsed = new URL(bridgeUrlIn.value.trim());
    if (parsed.protocol !== 'https:') throw new Error();
    bridgeUrl = parsed.origin;
  } catch (_) {
    showError('Paste the https://…trycloudflare.com bridge address shown on your home PC.');
    return;
  }
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  setTimeout(() => transitionTo(dashPage), 350);
});

logoutBtn.addEventListener('click', () => {
  closeOverlay();
  pairingCode = '';
  bridgeUrl = '';
  transitionTo(loginPage);
  setTimeout(resetLogin, 550);
});

function resetLogin() {
  loginForm.reset();
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
  hideError();
}

function handleDesktopClick(num) {
  const card = document.getElementById(`desktop-${num}-btn`);
  card.style.transform = 'scale(0.97)';
  setTimeout(() => { card.style.transform = ''; }, 180);
  openDesktop(num);
}

async function openDesktop(num) {
  currentDesktopNum = num;
  rdpTitle.textContent = `Desktop ${num}`;
  streamFeed.style.display = 'none';
  streamFeed.removeAttribute('src');
  streamPlaceholder.style.display = 'flex';
  controlHint.textContent = 'Pairing with your home bridge…';
  connMessage.textContent = `Connecting to Desktop ${num}…`;
  rdpOverlay.classList.add('active');
  setOverlayState('connecting');

  try {
    const response = await bridgeFetch('/control/pair', {
      pairingCode,
      desktop: num
    });
    remoteSession = response.session;
    controlReady = true;
    controlHint.textContent = 'Control active — move over the screen to control your home PC.';
    rdpConnStatus.textContent = 'Connected — loading video…';
    startStream();
  } catch (error) {
    returnToPairing(error.message || 'Could not reach the home bridge.');
  }
}

async function bridgeFetch(path, body) {
  const response = await fetch(`${bridgeUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Pairing was rejected. Check the pairing code.');
    throw new Error(`Home bridge connection failed (${response.status}).`);
  }
  return response.json();
}

function startStream() {
  if (!remoteSession || !rdpOverlay.classList.contains('active')) return;
  const cacheBuster = Date.now();
  streamFeed.src = `${bridgeUrl}/control/video_feed?session=${encodeURIComponent(remoteSession)}&t=${cacheBuster}`;
}

streamFeed.addEventListener('load', () => {
  if (!controlReady) return;
  streamFeed.style.display = 'block';
  streamPlaceholder.style.display = 'none';
  setOverlayState('live');
  rdpConnStatus.textContent = 'Live — Control active';
  streamFeed.focus({ preventScroll: true });
});

streamFeed.addEventListener('error', () => {
  if (!controlReady || streamRetryTimer) return;
  setOverlayState('disconnected');
  rdpConnStatus.textContent = 'Video connection dropped — retrying…';
  controlHint.textContent = 'The tunnel is reconnecting…';
  streamRetryTimer = setTimeout(() => {
    streamRetryTimer = null;
    startStream();
  }, 3000);
});

function sendControl(message) {
  if (!controlReady || !remoteSession) return;
  inputQueue = inputQueue
    .then(() => bridgeFetch('/control/input', { ...message, session: remoteSession }))
    .catch(() => {
      // Avoid a flood of messages after the bridge goes away; the stream error
      // handler will show the reconnection state to the user.
      controlReady = false;
      rdpConnStatus.textContent = 'Control connection lost.';
      controlHint.textContent = 'Close and reconnect after the home tunnel is running.';
    });
}

function queuePointerMove(event) {
  if (ignoreNextPointerMove) {
    ignoreNextPointerMove = false;
    return;
  }
  pendingPointerDelta.x += event.movementX;
  pendingPointerDelta.y += event.movementY;
  if (pointerFrameQueued) return;
  pointerFrameQueued = true;
  requestAnimationFrame(() => {
    pointerFrameQueued = false;
    const { x, y } = pendingPointerDelta;
    pendingPointerDelta = { x: 0, y: 0 };
    if (x || y) sendControl({ kind: 'pointer', action: 'move-relative', deltaX: x, deltaY: y });
  });
}

streamFeed.addEventListener('pointerenter', () => {
  pendingPointerDelta = { x: 0, y: 0 };
  ignoreNextPointerMove = true;
});
streamFeed.addEventListener('pointermove', queuePointerMove);
streamFeed.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  streamFeed.focus({ preventScroll: true });
  streamFeed.setPointerCapture?.(event.pointerId);
  sendControl({ kind: 'pointer', action: 'down', button: event.button });
});
streamFeed.addEventListener('pointerup', (event) => {
  event.preventDefault();
  sendControl({ kind: 'pointer', action: 'up', button: event.button });
});
streamFeed.addEventListener('contextmenu', (event) => event.preventDefault());
streamFeed.addEventListener('wheel', (event) => {
  event.preventDefault();
  sendControl({ kind: 'pointer', action: 'wheel', deltaX: event.deltaX, deltaY: event.deltaY });
}, { passive: false });

document.addEventListener('keydown', (event) => {
  if (!controlReady || !rdpOverlay.classList.contains('active')) return;
  if (event.code === 'F11' || (event.ctrlKey && event.shiftKey && event.code === 'KeyI')) return;
  event.preventDefault();
  if (!event.repeat) sendControl({ kind: 'key', action: 'down', code: event.code });
});
document.addEventListener('keyup', (event) => {
  if (!controlReady || !rdpOverlay.classList.contains('active')) return;
  event.preventDefault();
  sendControl({ kind: 'key', action: 'up', code: event.code });
});
window.addEventListener('blur', () => clearHeldInput());
document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });
window.addEventListener('pagehide', () => releaseSession());

function clearHeldInput() {
  if (controlReady && remoteSession) bridgeFetch('/control/clear', { session: remoteSession }).catch(() => {});
}

function releaseSession() {
  if (remoteSession) bridgeFetch('/control/release', { session: remoteSession }).catch(() => {});
  remoteSession = null;
  controlReady = false;
}

function setOverlayState(state) {
  rdpStatusDot.className = 'status-dot rdp-status';
  rdpStatusDot.style.background = state === 'live' ? '#22c55e' : (state === 'error' || state === 'disconnected' ? '#ef4444' : '#eab308');
}

function closeOverlay() {
  rdpOverlay.classList.remove('active');
  if (streamRetryTimer) { clearTimeout(streamRetryTimer); streamRetryTimer = null; }
  releaseSession();
  inputQueue = Promise.resolve();
  setTimeout(() => {
    streamFeed.removeAttribute('src');
    streamFeed.style.display = 'none';
    streamPlaceholder.style.display = 'flex';
  }, 300);
}

function returnToPairing(message) {
  closeOverlay();
  pairingCode = '';
  bridgeUrl = '';
  transitionTo(loginPage);
  setTimeout(() => {
    resetLogin();
    showError(message);
  }, 600);
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
