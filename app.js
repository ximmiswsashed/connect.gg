/* ===================================================
   TuffyBlud Portal — Application Logic
   =================================================== */

// ---------- Credentials ----------
const VALID_USER = 'tuffyblud';
const VALID_PASS = '07130713';

// ---------- DOM References ----------
const loginPage    = document.getElementById('login-page');
const dashPage     = document.getElementById('dashboard-page');
const loginForm    = document.getElementById('login-form');
const usernameIn   = document.getElementById('username');
const passwordIn   = document.getElementById('password');
const errorMsg     = document.getElementById('error-msg');
const loginBtn     = document.getElementById('login-btn');
const logoutBtn    = document.getElementById('logout-btn');

// ---------- RDP Overlay References ----------
const rdpOverlay      = document.getElementById('rdp-overlay');
const rdpFrame        = document.getElementById('rdp-frame');
const rdpCloseBtn     = document.getElementById('rdp-close-btn');
const rdpFullscreenBtn = document.getElementById('rdp-fullscreen-btn');
const rdpTitle        = document.getElementById('rdp-title');

// ---------- Login Handler ----------
loginForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const user = usernameIn.value.trim().toLowerCase();
  const pass = passwordIn.value.trim();

  // Clear previous error
  hideError();

  // Validate
  if (user !== VALID_USER || pass !== VALID_PASS) {
    showError('Invalid username or password. Please try again.');
    loginBtn.closest('.login-card').classList.add('shake');
    setTimeout(() => loginBtn.closest('.login-card').classList.remove('shake'), 600);
    return;
  }

  // Show loading state
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;

  // Simulate brief auth delay for polish
  setTimeout(() => {
    transitionTo(dashPage);
  }, 1000);
});

// ---------- Logout Handler ----------
logoutBtn.addEventListener('click', function () {
  transitionTo(loginPage);

  // Reset form state after transition
  setTimeout(() => {
    loginForm.reset();
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    hideError();
  }, 600);
});

// ---------- Desktop Click Handler ----------
function handleDesktopClick(num) {
  const card = document.getElementById(`desktop-${num}-btn`);
  
  // Visual ripple feedback
  card.style.transform = 'scale(0.97)';
  setTimeout(() => {
    card.style.transform = '';
  }, 200);

  // Open the RDP overlay
  openRDP(num);
}

function openRDP(num) {
  rdpTitle.textContent = `Connecting to Desktop ${num}...`;
  
  // URL to the RustDesk web client. 
  // By default, this points to the official hosted version. 
  // For school bypass, you can change this to a local relative path (e.g., './rustdesk/index.html') 
  // after downloading the web client files to your repo.
  rdpFrame.src = "https://web.rustdesk.com/";

  rdpOverlay.classList.add('active');
}

// ---------- RDP Overlay Handlers ----------
rdpCloseBtn.addEventListener('click', () => {
  rdpOverlay.classList.remove('active');
  // Clear src to close connections when hidden
  setTimeout(() => {
    rdpFrame.src = "about:blank";
  }, 500);
});

rdpFullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    rdpOverlay.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

// ---------- Page Transition ----------
function transitionTo(targetPage) {
  const activePage = document.querySelector('.page.active');
  if (!activePage || activePage === targetPage) return;

  // Fade out current
  activePage.classList.add('fade-out');

  setTimeout(() => {
    activePage.classList.remove('active', 'fade-out');
    targetPage.classList.add('active', 'fade-in');

    // Clean up fade-in class after animation
    setTimeout(() => {
      targetPage.classList.remove('fade-in');
    }, 800);
  }, 500);
}

// ---------- Error Helpers ----------
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}

function hideError() {
  errorMsg.textContent = '';
  errorMsg.classList.remove('visible');
}

// ---------- Interactive Grid Follow (Mouse) ----------
document.addEventListener('mousemove', function (e) {
  const shapes = document.querySelectorAll('.shape');
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;

  shapes.forEach((shape, i) => {
    const factor = (i + 1) * 8;
    const dx = (x - 0.5) * factor;
    const dy = (y - 0.5) * factor;
    shape.style.transform = `translate(${dx}px, ${dy}px)`;
  });
});
