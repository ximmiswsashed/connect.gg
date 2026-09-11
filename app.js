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

let currentDesktopNum = 1;
let pairingCode = '';
let bridgeUrl = '';
let remoteSession = null;
let controlReady = false;
let inputQueue = [];
let inputSending = false;
let streamRetryTimer = null;
let pointerFrameQueued = false;
let pendingPointerDelta = { x: 0, y: 0 };
let ignoreNextPointerMove = true;
let desktopEpoch = 0;
let frameWatch = null;

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
  closeOverlay();
  const epoch = desktopEpoch;
  currentDesktopNum = num;
  rdpTitle.textContent = `Desktop ${num}`;
  streamFeed.style.display = 'none';
  streamFeed.removeAttribute('src');
  streamPlaceholder.style.display = 'flex';
  connMessage.textContent = `Connecting to Desktop ${num}…`;
  rdpOverlay.classList.add('active');
  setOverlayState('connecting');

  try {
    const response = await bridgeFetch('/control/pair', {
      pairingCode,
      desktop: num
    });
    if (epoch !== desktopEpoch) {
      bridgeFetch('/control/release', { session: response.session }).catch(() => {});
      return;
    }
    remoteSession = response.session;
    controlReady = true;
    rdpConnStatus.textContent = 'Connected — loading video…';
    startStream();
  } catch (error) {
    if (epoch !== desktopEpoch) return;
    returnToPairing(error.message || 'Could not reach the home bridge.');
  }
}

async function bridgeFetch(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${bridgeUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
    });
  } catch (_) {
    throw new Error('Cannot reach the bridge. Keep both home PowerShell windows open and use the current tunnel address.');
  } finally {
    clearTimeout(timeout);
  }
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
  // Multipart images can render frames without ever finishing the load event.
  // Keep the image visible and detect decoded dimensions instead of waiting
  // forever for an endless response to finish loading.
  streamFeed.style.display = 'block';
  clearInterval(frameWatch);
  const started = Date.now();
  frameWatch = setInterval(() => {
    if (streamFeed.naturalWidth > 0) {
      showStream();
    } else if (Date.now() - started > 20000) {
      clearInterval(frameWatch);
      rdpConnStatus.textContent = 'No video received';
      connMessage.textContent = 'The bridge paired, but no screen frames arrived. Restart the home bridge and reconnect.';
      streamFeed.style.display = 'none';
      streamPlaceholder.style.display = 'flex';
    }
  }, 200);
}

function showStream() {
  if (!controlReady) return;
  clearInterval(frameWatch);
  streamFeed.style.display = 'block';
  streamPlaceholder.style.display = 'none';
  setOverlayState('live');
  rdpConnStatus.textContent = 'Live — Control active';
  streamFeed.focus({ preventScroll: true });
}
streamFeed.addEventListener('load', showStream);

streamFeed.addEventListener('error', () => {
  if (!controlReady || streamRetryTimer) return;
  setOverlayState('disconnected');
  rdpConnStatus.textContent = 'Video connection dropped — retrying…';
  streamRetryTimer = setTimeout(() => {
    streamRetryTimer = null;
    startStream();
  }, 3000);
});

function sendControl(message) {
  if (!controlReady || !remoteSession) return;
  const last = inputQueue.at(-1);
  // Combine movement while a request is in flight. Preserve every click/key
  // boundary, but never queue hundreds of obsolete individual mouse requests.
  if (message.action === 'move-relative' && last?.action === 'move-relative') {
    last.deltaX += message.deltaX;
    last.deltaY += message.deltaY;
  } else {
    inputQueue.push({ ...message });
  }
  pumpInput();
}

async function pumpInput() {
  if (inputSending) return;
  inputSending = true;
  const session = remoteSession;
  try {
    while (inputQueue.length && controlReady && session === remoteSession) {
      const message = inputQueue.shift();
      await bridgeFetch(message.kind === 'clear' ? '/control/clear' : '/control/input', { ...message, session });
    }
  } catch (_) {
    if (session === remoteSession) {
      inputQueue = [];
      controlReady = false;
      rdpConnStatus.textContent = 'Control connection lost. Close and reconnect.';
    }
  } finally {
    inputSending = false;
    if (inputQueue.length && controlReady) pumpInput();
  }
}

function flushPointer() {
  const { x, y } = pendingPointerDelta;
  pendingPointerDelta = { x: 0, y: 0 };
  if (x || y) sendControl({ kind: 'pointer', action: 'move-relative', deltaX: x, deltaY: y });
}

function queuePointerMove(event) {
  if (!controlReady) return;
  if (ignoreNextPointerMove) {
    ignoreNextPointerMove = false;
    return;
  }
  const rect = streamFeed.getBoundingClientRect();
  const scale = Math.min(rect.width / streamFeed.naturalWidth, rect.height / streamFeed.naturalHeight);
  if (!Number.isFinite(scale) || scale <= 0) return;
  pendingPointerDelta.x += event.movementX / scale;
  pendingPointerDelta.y += event.movementY / scale;
  if (pointerFrameQueued) return;
  pointerFrameQueued = true;
  requestAnimationFrame(() => {
    pointerFrameQueued = false;
    flushPointer();
  });
}

streamFeed.addEventListener('pointerenter', () => {
  pendingPointerDelta = { x: 0, y: 0 };
  ignoreNextPointerMove = true;
});
streamFeed.addEventListener('pointermove', queuePointerMove);
streamFeed.addEventListener('pointerdown', (event) => {
  flushPointer();
  event.preventDefault();
  streamFeed.focus({ preventScroll: true });
  streamFeed.setPointerCapture?.(event.pointerId);
  sendControl({ kind: 'pointer', action: 'down', button: event.button });
});
streamFeed.addEventListener('pointerup', (event) => {
  flushPointer();
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
  pendingPointerDelta = { x: 0, y: 0 };
  inputQueue = [];
  sendControl({ kind: 'clear' });
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
  desktopEpoch += 1;
  clearInterval(frameWatch);
  rdpOverlay.classList.remove('active');
  if (streamRetryTimer) { clearTimeout(streamRetryTimer); streamRetryTimer = null; }
  releaseSession();
  inputQueue = [];
  pendingPointerDelta = { x: 0, y: 0 };
  streamFeed.removeAttribute('src');
  streamFeed.style.display = 'none';
  streamPlaceholder.style.display = 'flex';
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
