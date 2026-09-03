/* ===================================================
   TuffyBlud Portal — Application Logic (WebRTC Edition)
   =================================================== */

// ── Fixed Peer IDs (must match broadcast.html) ──────
const PEER_IDS = {
  1: 'tuffyblud-desktop-1',
  2: 'tuffyblud-desktop-2'
};

// ── Credentials ─────────────────────────────────────
const VALID_USER = 'tuffyblud';
const VALID_PASS = '07130713';

// ── DOM References ───────────────────────────────────
const loginPage       = document.getElementById('login-page');
const dashPage        = document.getElementById('dashboard-page');
const loginForm       = document.getElementById('login-form');
const usernameIn      = document.getElementById('username');
const passwordIn      = document.getElementById('password');
const errorMsg        = document.getElementById('error-msg');
const loginBtn        = document.getElementById('login-btn');
const logoutBtn       = document.getElementById('logout-btn');

// Overlay DOM
const rdpOverlay      = document.getElementById('rdp-overlay');
const rdpCloseBtn     = document.getElementById('rdp-close-btn');
const rdpFullscreenBtn = document.getElementById('rdp-fullscreen-btn');
const rdpTitle        = document.getElementById('rdp-title');
const rdpStatusDot    = document.getElementById('rdp-status-dot');
const rdpConnStatus   = document.getElementById('rdp-conn-status');
const streamFeed      = document.getElementById('stream-feed');
const streamPlaceholder = document.getElementById('stream-placeholder');
const connMessage     = document.getElementById('conn-message');

// ── WebRTC state ─────────────────────────────────────
let viewerPeer = null;
let activeCall  = null;
let currentDesktopNum = 1;

// ── Login Handler ─────────────────────────────────────
loginForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const user = usernameIn.value.trim().toLowerCase();
  const pass = passwordIn.value.trim();
  hideError();

  if (user !== VALID_USER || pass !== VALID_PASS) {
    showError('Invalid username or password. Please try again.');
    loginBtn.closest('.login-card').classList.add('shake');
    setTimeout(() => loginBtn.closest('.login-card').classList.remove('shake'), 600);
    return;
  }

  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  setTimeout(() => { transitionTo(dashPage); }, 1000);
});

// ── Logout Handler ─────────────────────────────────────
logoutBtn.addEventListener('click', function () {
  closeOverlay();
  transitionTo(loginPage);
  setTimeout(() => {
    loginForm.reset();
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    hideError();
  }, 600);
});

// ── Desktop Click ─────────────────────────────────────
function handleDesktopClick(num) {
  const card = document.getElementById(`desktop-${num}-btn`);
  card.style.transform = 'scale(0.97)';
  setTimeout(() => { card.style.transform = ''; }, 200);
  openDesktop(num);
}

function openDesktop(num) {
  currentDesktopNum = num;
  rdpTitle.textContent = `Desktop ${num}`;

  // Reset overlay state
  setOverlayState('connecting');
  streamFeed.style.display = 'none';
  streamFeed.srcObject = null;
  streamPlaceholder.style.display = 'flex';

  rdpOverlay.classList.add('active');

  // Small delay so animation settles before heavy WebRTC init
  setTimeout(() => connectWebRTC(num), 300);
}

// ── WebRTC Viewer Connection ───────────────────────────
function connectWebRTC(desktopNum) {
  // Tear down any existing peer cleanly
  teardownPeer();

  const targetId = PEER_IDS[desktopNum];
  setOverlayState('connecting');
  connMessage.textContent = `Connecting to Desktop ${desktopNum}...`;

  // Create a viewer peer with a random ID
  viewerPeer = new Peer({
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  });

  viewerPeer.on('open', (id) => {
    rdpConnStatus.textContent = 'Calling broadcaster...';

    // We need to send a minimal blank stream as the "caller" side
    // The broadcaster answers with the real screen stream
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const blankStream = canvas.captureStream(1);

    try {
      activeCall = viewerPeer.call(targetId, blankStream);

      // Receive the broadcaster's screen stream
      activeCall.on('stream', (remoteStream) => {
        streamFeed.srcObject = remoteStream;
        streamFeed.style.display  = 'block';
        streamPlaceholder.style.display = 'none';
        setOverlayState('live');
        rdpConnStatus.textContent = 'Live';
      });

      activeCall.on('close', () => {
        if (rdpOverlay.classList.contains('active')) {
          setOverlayState('disconnected');
          rdpConnStatus.textContent = 'Broadcaster disconnected';
          streamFeed.style.display = 'none';
          streamPlaceholder.style.display = 'flex';
          connMessage.textContent = 'Broadcaster disconnected. Retrying...';
          // Auto-retry after 3s
          setTimeout(() => {
            if (rdpOverlay.classList.contains('active')) {
              connectWebRTC(currentDesktopNum);
            }
          }, 3000);
        }
      });

      activeCall.on('error', (err) => {
        connMessage.textContent = `Call error — retrying...`;
        setTimeout(() => {
          if (rdpOverlay.classList.contains('active')) connectWebRTC(currentDesktopNum);
        }, 3000);
      });

    } catch (err) {
      setOverlayState('error');
      connMessage.textContent = 'Failed to call broadcaster. Is it running?';
    }
  });

  viewerPeer.on('error', (err) => {
    if (err.type === 'peer-unavailable') {
      // Broadcaster isn't online yet — retry
      rdpConnStatus.textContent = 'Broadcaster offline — retrying in 5s...';
      connMessage.textContent = 'Make sure broadcast.html is open at home.';
      setTimeout(() => {
        if (rdpOverlay.classList.contains('active')) connectWebRTC(currentDesktopNum);
      }, 5000);
    } else {
      setOverlayState('error');
      rdpConnStatus.textContent = `Error: ${err.type}`;
    }
  });

  viewerPeer.on('disconnected', () => {
    if (!viewerPeer?.destroyed) viewerPeer.reconnect();
  });
}

// ── Overlay State ─────────────────────────────────────
function setOverlayState(state) {
  rdpStatusDot.className = 'status-dot rdp-status';
  if (state === 'live') {
    rdpStatusDot.style.background = '#22c55e';
  } else if (state === 'error' || state === 'disconnected') {
    rdpStatusDot.style.background = '#ef4444';
  } else {
    rdpStatusDot.style.background = '#eab308'; // yellow = connecting
  }
}

// ── Close / Cleanup ────────────────────────────────────
function closeOverlay() {
  rdpOverlay.classList.remove('active');
  setTimeout(() => {
    teardownPeer();
    streamFeed.srcObject = null;
    streamFeed.style.display = 'none';
    streamPlaceholder.style.display = 'flex';
  }, 500);
}

function teardownPeer() {
  if (activeCall) { try { activeCall.close(); } catch (_) {} activeCall = null; }
  if (viewerPeer && !viewerPeer.destroyed) { try { viewerPeer.destroy(); } catch (_) {} viewerPeer = null; }
}

rdpCloseBtn.addEventListener('click', closeOverlay);

rdpFullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    rdpOverlay.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});

// ── Page Transition ───────────────────────────────────
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

// ── Error Helpers ─────────────────────────────────────
function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('visible'); }
function hideError()    { errorMsg.textContent = ''; errorMsg.classList.remove('visible'); }

// ── Parallax Background ───────────────────────────────
document.addEventListener('mousemove', function (e) {
  const shapes = document.querySelectorAll('.shape');
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  shapes.forEach((shape, i) => {
    const factor = (i + 1) * 8;
    shape.style.transform = `translate(${(x - 0.5) * factor}px, ${(y - 0.5) * factor}px)`;
  });
});
