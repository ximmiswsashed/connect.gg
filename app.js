/* TuffyBlud — latest-frame streaming and absolute pointer control, protocol 2. */
const $ = id => document.getElementById(id);
const accountPage = $('account-page'), accountForm = $('account-form');
const loginPage = $('login-page'), dashPage = $('dashboard-page'), loginForm = $('login-form');
const pairingCodeIn = $('pairing-code'), bridgeUrlIn = $('bridge-url');
const errorMsg = $('error-msg'), loginBtn = $('login-btn'), logoutBtn = $('logout-btn');
const rdpOverlay = $('rdp-overlay'), rdpTitle = $('rdp-title');
const rdpStatusDot = $('rdp-status-dot'), rdpConnStatus = $('rdp-conn-status');
const streamFeed = $('stream-feed'), streamPlaceholder = $('stream-placeholder'), connMessage = $('conn-message');
const obsFeed = $('obs-feed');
const context = streamFeed.getContext('2d', { alpha: false, desynchronized: true });

let pairingCode = '', bridgeUrl = '', remoteSession = null;
let epoch = 0, controlSocket = null, videoSocket = null, controlReady = false, hasFrame = false;
let mediaReader = null, mediaFallbackTimer = null, mediaMode = null, obsFrameCallback = null;
let videoBufferMs = null, lastVideoStats = null, statsPending = false, nativeVideo = false;
let heartbeat = null, watchdog = null, moveTimer = null, pendingMove = null;
let videoReconnectTimer = null, videoRetries = 0, decodeFailures = 0;
let videoAttemptAt = 0;
let pendingInput = [], lastSentMove = 0, lastFrameAt = 0, lastPongAt = 0;
let sourceGeometry = null, activePointer = null, lastPoint = null;
let sourceViewport = null;
let decoding = false, waitingFrame = null;
let statsAt = 0, painted = 0, receivedBytes = 0, rttMs = null;
const pressedCodes = new Set();
const computers = {};
const AUTH_NAME = 'grief';
const AUTH_SALT = 'NxwY3859YbHZ5Dce7iv+Ig==';
const AUTH_VERIFIER = 'hGAyLjESZQiAs50QWGY2fTdZ7/F9fLms/eRPxwXR+F4=';
const SAVED_COMPUTERS = 'tuffyblud.encryptedComputers.v1';
let accountPassword = '', storageKey = null;
let selectedPC = 1;
let capturePaused = false, controlNoticeUntil = 0;
let reconnectControlTimer = null, controlRetries = 0, activeMonitor = 1;
let overlayLink = null;
let overlayHeartbeat = null;
let overlayMonitor = 2, overlayStarting = false, inputSamples = false;
let mouseSpeed = 1;
try { const saved = Number(localStorage.getItem('tuffyblud.mouseSpeed.v1')); if (saved >= .25 && saved <= 3) mouseSpeed = saved; } catch (_) {}
function setMouseSpeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  mouseSpeed = Math.max(.25, Math.min(3, number));
  $('mouse-speed').value = mouseSpeed;
  $('mouse-speed-value').textContent = mouseSpeed.toFixed(2) + '×';
  try { localStorage.setItem('tuffyblud.mouseSpeed.v1', String(mouseSpeed)); } catch (_) {}
}
setMouseSpeed(mouseSpeed);
$('mouse-speed').addEventListener('input', event => setMouseSpeed(event.target.value));
$('mouse-speed-reset').addEventListener('click', () => setMouseSpeed(1));

function fromBase64(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
function toBase64(value) { return btoa(String.fromCharCode(...new Uint8Array(value))); }
async function deriveAccount(password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromBase64(AUTH_SALT),iterations:310000,hash:'SHA-256'},material,512));
  const verifier = toBase64(bits.slice(0,32));
  const key = await crypto.subtle.importKey('raw',bits.slice(32),{name:'AES-GCM'},false,['encrypt','decrypt']);
  bits.fill(0);
  return {verifier,key};
}
async function saveComputers() {
  if(!storageKey)return;
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plaintext=new TextEncoder().encode(JSON.stringify(computers));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},storageKey,plaintext);
  localStorage.setItem(SAVED_COMPUTERS,JSON.stringify({iv:toBase64(iv),data:toBase64(ciphertext)}));
}
async function restoreComputers(key) {
  const saved=localStorage.getItem(SAVED_COMPUTERS);
  if(!saved)return;
  const record=JSON.parse(saved);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(record.iv)},key,fromBase64(record.data));
  const restored=JSON.parse(new TextDecoder().decode(plaintext));
  for(const id of ['1','2'])if(restored[id] && typeof restored[id].url==='string' && typeof restored[id].code==='string')computers[id]=restored[id];
}
accountForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const error=$('account-error');error.textContent='';error.classList.remove('visible');
  const name=$('account-name').value.trim(),password=$('account-password').value;
  try {
    const derived=await deriveAccount(password);
    if(name!==AUTH_NAME || derived.verifier!==AUTH_VERIFIER)throw new Error('Incorrect name or password.');
    await restoreComputers(derived.key);
    storageKey=derived.key;accountPassword=password;
    $('account-password').value='';transitionTo(dashPage);
  } catch(errorValue) {
    error.textContent=errorValue.message==='Incorrect name or password.'?errorValue.message:'Incorrect name or password, or saved desktop data is damaged.';
    error.classList.add('visible');accountPassword='';storageKey=null;
  }
});

async function chooseMonitorTwo(monitor = 2) {
  if (!computers[1]) return configurePC(1);
  overlayMonitor = monitor;
  $('overlay-target').textContent = 'Desktop 1 · Monitor ' + monitor;
  $('overlay-choice').showModal();
}

async function acceptMonitorTwo(useOverlay) {
  if (overlayStarting) return;
  const targetMonitor = overlayMonitor;
  $('overlay-choice').close();
  if (!useOverlay) { await stopMonitorOverlay(); return openMonitor(1,targetMonitor); }
  if (!computers[2]) { alert('Set Desktop 2 address and code first, then select the monitor again.'); return configurePC(2); }
  overlayStarting = true;
  try {
    await stopMonitorOverlay();
    const host = await bridgeFetch('/control/pair', {...pairRequest(computers[1].code,targetMonitor),media:false},computers[1].url);
    overlayLink = {host:host.session,hostUrl:computers[1].url,sourceUrl:computers[2].url};
    const source = await bridgeFetch('/control/pair', {...pairRequest(computers[2].code,Number($('overlay-source').value)),media:false},computers[2].url);
    overlayLink.source = source.session;
    await bridgeFetch('/control/overlay',{session:host.session,action:'start',url:computers[2].url,sourceSession:source.session,blackThreshold:Number($('overlay-threshold').value)},computers[1].url);
    $('stop-monitor-overlay').hidden=false;
    overlayHeartbeat=setInterval(async()=>{
      const link=overlayLink;
      if(!link)return;
      try {
        const state=await bridgeFetch('/control/overlay',{session:link.host,action:'status'},link.hostUrl);
        if(state.active===false && overlayLink===link) {
          await stopMonitorOverlay();
          rdpConnStatus.textContent='Overlay stopped. Select the monitor again to restart it.';
        }
      } catch (_) { if(overlayLink===link)rdpConnStatus.textContent='Overlay connection interrupted; checking again…'; }
    },10000);
    await openMonitor(1,targetMonitor);
  } catch(error) { await stopMonitorOverlay(); alert(error.message); }
  finally { overlayStarting=false; }
}

async function stopMonitorOverlay() {
  $('stop-monitor-overlay').hidden=true;
  clearInterval(overlayHeartbeat);overlayHeartbeat=null;
  let link=overlayLink; overlayLink=null;
  if(!link && computers[1]) {
    try {
      const paired=await bridgeFetch('/control/pair',{...pairRequest(computers[1].code,overlayMonitor),media:false},computers[1].url);
      link={host:paired.session,hostUrl:computers[1].url};
    }catch(_){return;}
  }
  if(!link)return;
  await bridgeFetch('/control/overlay',{session:link.host,action:'stop'},link.hostUrl).catch(()=>{});
  await bridgeFetch('/control/release',{session:link.host},link.hostUrl).catch(()=>{});
  if(link.source)await bridgeFetch('/control/release',{session:link.source},link.sourceUrl).catch(()=>{});
}

function configurePC(num) {
  selectedPC = num;
  $('pair-pc-title').textContent = 'Connect Desktop ' + num;
  bridgeUrlIn.value = computers[num]?.url || '';
  pairingCodeIn.value = computers[num]?.code || '';
  transitionTo(loginPage);
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  hideError();
  pairingCode = pairingCodeIn.value.trim();
  if (pairingCode.length < 24) return showError('Enter your home PC pairing code (at least 24 characters).');
  try {
    const url = new URL(bridgeUrlIn.value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    bridgeUrl = url.origin;
  } catch (_) {
    return showError('Paste your HTTPS Tailscale Funnel address (or another HTTPS bridge address).');
  }
  const previous = computers[selectedPC];
  computers[selectedPC] = { url: bridgeUrl, code: pairingCode };
  try {
    await saveComputers();
  } catch (_) {
    if (previous) computers[selectedPC] = previous;
    else delete computers[selectedPC];
    return showError('Your browser blocked saving. Allow site storage and use a regular browser window, then try again. Your code is still in this form.');
  }
  pairingCodeIn.value = '';
  transitionTo(dashPage);
});

logoutBtn.addEventListener('click', () => {
  stopMonitorOverlay();
  closeOverlay();
  pairingCode = bridgeUrl = '';
  for (const key of Object.keys(computers)) delete computers[key];
  accountPassword='';storageKey=null;loginForm.reset();accountForm.reset();
  transitionTo(accountPage);
});

function handleDesktopClick(num) {
  const panel = $('monitors-' + num);
  panel.hidden = !panel.hidden;
  $('desktop-' + num + '-btn').setAttribute('aria-expanded', String(!panel.hidden));
}

async function openMonitor(pc, monitor) {
  if (!computers[pc]) return configurePC(pc);
  closeOverlay();
  selectedPC = pc;
  bridgeUrl = computers[pc].url;
  pairingCode = computers[pc].code;
  await openDesktop(monitor);
}

function pairRequest(code,desktop) {
  return {pairingCode:code,desktop,accountName:AUTH_NAME,accountPassword};
}

async function bridgeFetch(path, body, base = bridgeUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal, cache: 'no-store'
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Account or pairing code rejected. Check this desktop’s saved pairing code against its launcher; sign in again if your account changed.');
      if ([502,503,504].includes(response.status)) throw new Error('The tunnel responded, but its home bridge is unavailable. Close the old launcher and run the updated launcher on that PC. Leave its window open.');
      throw new Error('Bridge returned ' + response.status + '. Check the selected monitor and restart the updated bridge.');
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('Cannot reach ' + base + '. Keep that PC’s launcher open and compare this address with its WEBSITE BRIDGE ADDRESS. Open ' + base + '/control/health in a new tab: if it also fails, check the launcher/Tailscale or your network. Your saved pairing code has not been erased.');
    }
    throw error;
  } finally { clearTimeout(timer); }
}

async function openDesktop(num) {
  closeOverlay();
  activeMonitor = num;
  const current = epoch, base = bridgeUrl;
  rdpTitle.textContent = 'Desktop ' + selectedPC + ' · Monitor ' + num;
  rdpOverlay.classList.add('active');
  document.body.classList.add('viewing-desktop');
  connMessage.textContent = 'Connecting to your home PC…';
  rdpConnStatus.textContent = 'Pairing…';
  setOverlayState('connecting');
  try {
    const result = await bridgeFetch('/control/pair', pairRequest(pairingCode,num), base);
    if (current !== epoch) {
      bridgeFetch('/control/release', { session: result.session }, base).catch(() => {});
      return;
    }
    remoteSession = result.session;
    inputSamples = result.inputSamples === true;
    if (result.protocol !== 2) {
      throw new Error('Update the home bridge dependencies and restart streamer.py. This viewer needs the 60 FPS bridge.');
    }
    statsAt = performance.now();
    connectSockets(current, result);
  } catch (error) { if (current === epoch) { if(controlRetries>0) recoverControl(); else failDesktop(error.message); } }
}

function makeSocket(path) {
  return new WebSocket(bridgeUrl.replace(/^https:/, 'wss:') + path);
}

function connectSockets(current, pairingResult) {
  const input = controlSocket = makeSocket('/control/socket');
  input.onopen = () => {
    if (current !== epoch) return input.close();
    input.send(JSON.stringify({ type: 'auth', session: remoteSession }));
  };
  input.onmessage = event => {
    if (current !== epoch) return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'error') return failDesktop(message.message);
      if (message.type === 'input-blocked') {
        clearHeldInput();
        controlNoticeUntil = performance.now()+4000;
        rdpConnStatus.textContent = 'Input blocked by Windows. Run the elevated launcher; approve UAC locally.';
        return;
      }
      if (message.type === 'ready') {
        controlReady = true;
        lastPongAt = performance.now();
        startPreferredVideo(current, pairingResult);
        heartbeat = setInterval(() => {
          if (input.readyState === WebSocket.OPEN) {
            input.send(JSON.stringify({ type: 'ping', t: performance.now() }));
          }
        }, 2000);
        input.send(JSON.stringify({ type: 'ping', t: performance.now() }));
      } else if (message.type === 'pong') {
        lastPongAt = performance.now();
        rttMs = Math.max(0, lastPongAt - message.t);
        if(hasFrame) controlRetries=0;
      }
    } catch (_) { failDesktop('The home bridge sent an invalid response. Restart it and reconnect.'); }
  };
  input.onerror = () => {};
  input.onclose = () => { if (current === epoch) recoverControl(); };
  watchdog = setInterval(() => {
    if (current !== epoch) return;
    const now = performance.now();
    if (!hasFrame && videoAttemptAt && now - videoAttemptAt > 15000) startJpegFallback(current);
    else if (hasFrame && now - lastFrameAt > 8000 && mediaMode === 'obs') startJpegFallback(current);
    else if (hasFrame && now - lastFrameAt > 8000) restartVideo(current);
    else if (controlReady && now - lastPongAt > 8000) recoverControl();
    else updateStats();
  }, 1000);
}

function mediaEndpoint(pairingResult) {
  const url = new URL(bridgeUrl);
  url.port = String(pairingResult.mediaPort || 8443);
  url.pathname = pairingResult.mediaPath;
  url.search = url.hash = '';
  return url.toString();
}

function setObsViewport(nativeWidth, nativeHeight, frameWidth = 1920, frameHeight = 1080) {
  const scale = Math.min(frameWidth / nativeWidth, frameHeight / nativeHeight);
  sourceViewport = {
    left:(frameWidth-nativeWidth*scale)/2, top:(frameHeight-nativeHeight*scale)/2,
    width:nativeWidth*scale, height:nativeHeight*scale, frameWidth, frameHeight
  };
}

function startPreferredVideo(current, pairingResult) {
  if (!pairingResult?.mediaPath || typeof MediaMTXWebRTCReader === 'undefined') {
    startVideo(current); return;
  }
  videoAttemptAt = performance.now();
  sourceGeometry = [pairingResult.nativeWidth, pairingResult.nativeHeight];
  nativeVideo = pairingResult.mediaContent === 'full-frame';
  setObsViewport(pairingResult.nativeWidth, pairingResult.nativeHeight);
  let receivedTrack = false;
  try {
    mediaReader = new MediaMTXWebRTCReader({
      url: mediaEndpoint(pairingResult), user:'viewer', pass:pairingCode, token:'',
      videoOnly:true,
      // The reader reconnects itself. Give on-demand capture time to open before
      // falling back; one early 404 must not permanently select JPEG.
      onError: () => {},
      onTrack: event => {
        if (current !== epoch || event.track.kind !== 'video') return;
        receivedTrack = true;
        // Remote desktop favors immediacy over a large entertainment-video
        // buffer. The browser clamps this to its safe supported minimum.
        try { event.receiver.jitterBufferTarget = 0; } catch (_) {}
        try { event.receiver.playoutDelayHint = 0; } catch (_) {}
        obsFeed.srcObject = new MediaStream([event.track]);
        obsFeed.play().catch(()=>{});
      }
    });
    obsFeed.onplaying = () => {
      if (current !== epoch) return;
      clearTimeout(mediaFallbackTimer); mediaFallbackTimer=null;
      mediaMode='obs'; hasFrame=true; capturePaused=false; lastFrameAt=performance.now();
      streamFeed.width=obsFeed.videoWidth||1920; streamFeed.height=obsFeed.videoHeight||1080;
      sourceViewport = nativeVideo ? null : sourceViewport;
      if (!nativeVideo) setObsViewport(...sourceGeometry, streamFeed.width, streamFeed.height);
      streamFeed.style.display='block'; obsFeed.style.display='block';
      streamPlaceholder.style.display='none'; document.body.classList.add('obs-video');
      setOverlayState('live'); rdpConnStatus.textContent='Live · Direct GPU capture';
      if (typeof obsFeed.cancelVideoFrameCallback === 'function' && obsFrameCallback !== null) obsFeed.cancelVideoFrameCallback(obsFrameCallback);
      streamFeed.focus({preventScroll:true}); watchObsFrames(current);
    };
    mediaFallbackTimer=setTimeout(()=>{if(current===epoch&&!hasFrame)startJpegFallback(current);},15000);
  } catch (_) { startJpegFallback(current); }
}

function watchObsFrames(current) {
  if (current !== epoch || mediaMode !== 'obs') return;
  if (typeof obsFeed.requestVideoFrameCallback === 'function') {
    obsFrameCallback=obsFeed.requestVideoFrameCallback(()=>{
      if(current!==epoch||mediaMode!=='obs')return;
      painted++;lastFrameAt=performance.now();watchObsFrames(current);
    });
  } else {
    painted++;lastFrameAt=performance.now();
    obsFrameCallback=setTimeout(()=>watchObsFrames(current),1000/60);
  }
}

function startJpegFallback(current) {
  if(current!==epoch||!controlReady||mediaMode==='jpeg')return;
  clearTimeout(mediaFallbackTimer);mediaFallbackTimer=null;
  mediaReader?.close();mediaReader=null;mediaMode='jpeg';
  obsFeed.pause();obsFeed.srcObject=null;obsFeed.style.display='none';
  document.body.classList.remove('obs-video');hasFrame=false;sourceViewport=null;
  streamFeed.style.opacity='';
  rdpConnStatus.textContent='GPU stream unavailable · using JPEG fallback';
  startVideo(current);
}

function startVideo(current) {
  clearTimeout(videoReconnectTimer);
  videoReconnectTimer = null;
  if (current !== epoch || !controlReady) return;
  videoAttemptAt = performance.now();
  const socket = videoSocket = makeSocket('/control/frames');
  socket.binaryType = 'arraybuffer';
  socket.onopen = () => {
    if (current !== epoch) return socket.close();
    socket.send(JSON.stringify({ type: 'auth', session: remoteSession }));
  };
  socket.onmessage = event => {
    if (current !== epoch || videoSocket !== socket) return;
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'error') restartVideo(current, socket);
        else if (message.type === 'paused') {
          capturePaused=true; lastFrameAt=performance.now();
          clearHeldInput(); streamFeed.style.display='none'; streamPlaceholder.style.display='flex';
          connMessage.textContent=message.message || 'Windows desktop unavailable; waiting to resume…';
          rdpConnStatus.textContent='Capture paused';
        } else if (message.type === 'idle') { lastFrameAt = performance.now(); }
      } catch (_) { restartVideo(current, socket); }
      return;
    }
    const data = event.data;
    if (data.byteLength <= 28) return restartVideo(current, socket);
    const header = new DataView(data);
    const frame = {
      sequence: header.getUint32(0, true),
      width: header.getUint32(12, true), height: header.getUint32(16, true),
      nativeWidth: header.getUint32(20, true), nativeHeight: header.getUint32(24, true),
      jpeg: new Blob([new Uint8Array(data, 28)], { type: 'image/jpeg' }), socket, current
    };
    lastFrameAt = performance.now();
    videoRetries = 0;
    receivedBytes += data.byteLength;
    // Decode at most one frame and retain only the newest waiting frame.
    if (waitingFrame) ackFrame(waitingFrame);
    waitingFrame = frame;
    decodeLatest();
  };
  // onclose performs recovery; onerror is followed by onclose in browsers.
  socket.onerror = () => {};
  socket.onclose = () => {
    if (videoSocket !== socket) return;
    videoSocket = null;
    if (current === epoch && controlReady) scheduleVideoReconnect(current);
  };
}

function restartVideo(current, socket = videoSocket) {
  if (current !== epoch || !controlReady) return;
  if (socket && socket === videoSocket) {
    videoSocket = null;
    try { socket.close(); } catch (_) {}
  }
  scheduleVideoReconnect(current);
}

function scheduleVideoReconnect(current) {
  if (current !== epoch || !controlReady || videoReconnectTimer) return;
  const delay = Math.min(2000, 250 * (2 ** Math.min(videoRetries++, 3)));
  lastFrameAt = performance.now();
  rdpConnStatus.textContent = 'Recovering video…';
  setOverlayState('connecting');
  videoReconnectTimer = setTimeout(() => startVideo(current), delay);
}

function ackFrame(frame) {
  if (frame.socket.readyState === WebSocket.OPEN) {
    frame.socket.send(JSON.stringify({ type: 'ack', sequence: frame.sequence }));
  }
}

async function decodeLatest() {
  if (decoding) return;
  decoding = true;
  try {
    while (waitingFrame) {
      const frame = waitingFrame;
      waitingFrame = null;
      let bitmap;
      try {
        bitmap = await createImageBitmap(frame.jpeg);
        if (frame.current !== epoch || frame.socket !== videoSocket) continue;
        if (bitmap.width !== frame.width || bitmap.height !== frame.height) throw new Error('Invalid frame dimensions');
        if (streamFeed.width !== bitmap.width || streamFeed.height !== bitmap.height) {
          streamFeed.width = bitmap.width;
          streamFeed.height = bitmap.height;
        }
        sourceViewport={left:0,top:0,width:bitmap.width,height:bitmap.height,frameWidth:bitmap.width,frameHeight:bitmap.height};
        // Draw immediately; no video playback buffer and no extra animation-frame delay.
        context.drawImage(bitmap, 0, 0);
          if (capturePaused) {
            streamFeed.style.display='block';streamPlaceholder.style.display='none';
            setOverlayState('live');
          }
          capturePaused=false;
          decodeFailures = 0;
          if (!sourceGeometry || sourceGeometry[0] !== frame.nativeWidth || sourceGeometry[1] !== frame.nativeHeight) {
            sourceGeometry = [frame.nativeWidth, frame.nativeHeight];
          }
        painted++;
        if (!hasFrame) {
          hasFrame = true;
          streamFeed.style.display = 'block';
          streamPlaceholder.style.display = 'none';
          setOverlayState('live');
          rdpConnStatus.textContent = 'Live';
          streamFeed.focus({ preventScroll: true });
        }
      } catch (_) {
        decodeFailures++;
        // A damaged frame should not take down the entire remote session.
        if (frame.current === epoch && decodeFailures >= 3 && frame.socket === videoSocket) {
          restartVideo(frame.current, frame.socket);
        }
      } finally {
        bitmap?.close();
        ackFrame(frame);
      }
    }
  } finally { decoding = false; }
}

async function sampleVideoBuffer() {
  if (statsPending || !mediaReader?.getStats) return;
  const reader = mediaReader;
  statsPending = true;
  try {
    const report = await reader.getStats();
    if (reader !== mediaReader) return;
    report.forEach(stat => {
      if (stat.type !== 'inbound-rtp' || stat.kind !== 'video') return;
      if (lastVideoStats?.id === stat.id) {
        const count = stat.jitterBufferEmittedCount-lastVideoStats.jitterBufferEmittedCount;
        if (count > 0) videoBufferMs = Math.max(0, 1000*(stat.jitterBufferDelay-lastVideoStats.jitterBufferDelay)/count);
      }
      lastVideoStats = stat;
    });
  } catch (_) {} finally { statsPending = false; }
}

function updateStats() {
  if (!hasFrame || capturePaused || performance.now()<controlNoticeUntil) return;
  const now = performance.now(), seconds = (now - statsAt) / 1000;
  if (seconds < 1) return;
  const fps = Math.min(60, Math.round(painted / seconds));
  const mbps = (receivedBytes * 8 / seconds / 1000000).toFixed(1);
  const resolution = mediaMode==='obs' ? (obsFeed.videoWidth||1920)+'×'+(obsFeed.videoHeight||1080) : streamFeed.width+'×'+streamFeed.height;
  if (mediaMode === 'obs') sampleVideoBuffer();
  rdpConnStatus.textContent = (mediaMode==='obs'?'GPU · ':'Fallback · ') + resolution + ' · ' + fps +
    '/60 FPS · ' + (rttMs === null ? '…' : Math.round(rttMs)) + ' ms input RTT' +
    (mediaMode==='jpeg'?' · '+mbps+' Mbps':(videoBufferMs===null?'':' · '+Math.round(videoBufferMs)+' ms video buffer'));
  painted = receivedBytes = 0;
  statsAt = now;
}

// The same object-fit:contain geometry is used for drawing and hit testing.
// CSS pixels already include browser zoom: multiplying by devicePixelRatio
// here would introduce a second scaling error.
function imagePoint(event, clamp = false) {
  if (!hasFrame || capturePaused || !sourceGeometry) return null;
  const rect = streamFeed.getBoundingClientRect();
  const scale = Math.min(rect.width / streamFeed.width, rect.height / streamFeed.height);
  if (!(scale > 0)) return null;
  const width = streamFeed.width * scale, height = streamFeed.height * scale;
  const encodedX = (event.clientX - rect.left - (rect.width - width) / 2) / scale;
  const encodedY = (event.clientY - rect.top - (rect.height - height) / 2) / scale;
  const view=sourceViewport||{left:0,top:0,width:streamFeed.width,height:streamFeed.height};
  const x=encodedX-view.left,y=encodedY-view.top;
  if (!clamp && (x < 0 || x > view.width || y < 0 || y > view.height)) return null;
  return { x: Math.max(0, Math.min(1, x / view.width)), y: Math.max(0, Math.min(1, y / view.height)), geometry: sourceGeometry.slice() };
}

function sendControl(message) {
  if (!controlReady || controlSocket?.readyState !== WebSocket.OPEN) return;
  // Coalesce only unsent moves; never reorder movement across a click/key.
  if (message.samples && pendingInput.at(-1)?.samples && pendingInput.at(-1).samples.length + message.samples.length <= 32) {
    pendingInput.at(-1).samples.push(...message.samples);
  } else if (message.kind === 'pointer' && message.action === 'move' && pendingInput.at(-1)?.action === 'move') {
    pendingInput[pendingInput.length - 1] = message;
  } else { pendingInput.push(message); }
  flushInput();
}

function flushInput() {
  clearTimeout(moveTimer);
  moveTimer = null;
  if (!controlReady || controlSocket?.readyState !== WebSocket.OPEN) return;
  if (pendingInput.length > 256 || controlSocket.bufferedAmount > 65536) {
    return failDesktop('Input connection is congested. Reopen the desktop to reconnect.');
  }
  while (pendingInput.length && controlSocket.bufferedAmount < 4096) {
    controlSocket.send(JSON.stringify(pendingInput.shift()));
  }
  if (pendingInput.length) moveTimer = setTimeout(flushInput, 4);
}

function flushPointer() {
  if (pendingMove) {
    const message = pendingMove;
    pendingMove = null;
    lastSentMove = performance.now();
    sendControl(message);
  }
}

function queueRelativeMovement(deltaX, deltaY) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || (!deltaX && !deltaY)) return;
  // Preserve individual raw samples. Windows pointer acceleration is velocity
  // sensitive, so combining eight milliseconds changes fast-movement physics.
  sendControl({kind:'pointer', action:'move-relative', deltaX:deltaX*mouseSpeed, deltaY:deltaY*mouseSpeed});
}

function forwardLockedMovement(event) {
  if (!mouseLocked() || !controlReady || capturePaused) return;
  const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  const samples=coalesced.length ? coalesced : [event];
  if(inputSamples) {
    const deltas=samples.filter(s=>Number.isFinite(s.movementX)&&Number.isFinite(s.movementY)&&(s.movementX||s.movementY))
      .map(s=>[s.movementX*mouseSpeed,s.movementY*mouseSpeed]);
    for(let i=0;i<deltas.length;i+=32)sendControl({kind:'pointer',action:'move-relative',samples:deltas.slice(i,i+32)});
    return;
  }
  for (const sample of samples) {
    queueRelativeMovement(sample.movementX, sample.movementY);
  }
}

function movePointer(event) {
  if (mouseLocked()) return;
  const point = imagePoint(event, activePointer !== null);
  if (!point) return;
  lastPoint = point;
  pendingMove = { kind: 'pointer', action: 'move', ...point };
  if (performance.now() - lastSentMove >= 8) flushPointer();
  else if (!pointerTimer) pointerTimer = setTimeout(() => { pointerTimer = null; flushPointer(); }, 8);
}
let pointerTimer = null;
function mouseLocked() { return document.pointerLockElement === streamFeed; }
async function lockGameMouse() {
  if (!controlReady || !hasFrame) return;
  if (mouseLocked()) { document.exitPointerLock(); return; }
  flushPointer();
  streamFeed.focus({preventScroll:true});
  try {
    try { await streamFeed.requestPointerLock({unadjustedMovement:true}); }
    catch (error) {
      if (error.name !== 'NotSupportedError') throw error;
      await streamFeed.requestPointerLock();
    }
  } catch (_) { rdpConnStatus.textContent = 'Click once inside the stream to let your browser capture the mouse.'; }
}
function handlePointerLockChange() {
  const locked = mouseLocked();
  if (locked) {
    // Preserve the button that caused pointer lock so click-drag still works.
    pendingMove = null;
    streamFeed.focus({preventScroll:true});
  } else {
    clearHeldInput();
  }
  document.body.classList.toggle('mouse-locked', locked);
}
document.addEventListener('pointerlockchange', handlePointerLockChange);
document.addEventListener('pointerlockerror', () => {
  rdpConnStatus.textContent = 'Click once inside the stream to let your browser capture the mouse.';
});
const rawPointerUpdates = 'onpointerrawupdate' in window;
if (rawPointerUpdates) document.addEventListener('pointerrawupdate', forwardLockedMovement, {passive:true});
document.addEventListener('mousemove', event => {
  if (!rawPointerUpdates) forwardLockedMovement(event);
});
streamFeed.addEventListener('pointermove', movePointer);
streamFeed.addEventListener('pointerenter', event => {
  movePointer(event);
  // A drag into the canvas can carry a valid user activation in Chromium.
  // Plain hover cannot be locked by any website, so pointerdown retries below.
  if (event.buttons && !mouseLocked()) lockGameMouse();
});
streamFeed.addEventListener('pointerdown', event => {
  const point = mouseLocked() ? {} : imagePoint(event);
  if (!point || !controlReady || ![0, 1, 2].includes(event.button)) return;
  event.preventDefault();
  flushPointer();
  streamFeed.focus({ preventScroll: true });
  activePointer = event.pointerId;
  lastPoint = point;
  if (!mouseLocked()) streamFeed.setPointerCapture(event.pointerId);
  sendControl({ kind: 'pointer', action: 'down', button: event.button, ...point });
  if (!mouseLocked()) lockGameMouse();
});
streamFeed.addEventListener('pointerup', event => {
  if (activePointer === null) return;
  event.preventDefault();
  flushPointer();
  const point = mouseLocked() ? {} : imagePoint(event, true) || lastPoint;
  sendControl({ kind: 'pointer', action: 'up', button: event.button, ...point });
  if (!event.buttons) {
    activePointer = null;
    if (streamFeed.hasPointerCapture(event.pointerId)) streamFeed.releasePointerCapture(event.pointerId);
  }
});
streamFeed.addEventListener('pointercancel', clearHeldInput);
streamFeed.addEventListener('lostpointercapture', () => { if (activePointer !== null && !mouseLocked()) clearHeldInput(); });
streamFeed.addEventListener('contextmenu', event => event.preventDefault());
streamFeed.addEventListener('dragstart', event => event.preventDefault());
streamFeed.addEventListener('wheel', event => {
  const point = mouseLocked() ? {} : imagePoint(event);
  if (!point || !controlReady) return;
  event.preventDefault();
  flushPointer();
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? streamFeed.clientHeight : 1;
  sendControl({ kind: 'pointer', action: 'wheel', deltaX: event.deltaX * factor, deltaY: event.deltaY * factor, ...point });
}, { passive: false });

document.addEventListener('keydown', event => {
  if (!controlReady || !hasFrame || capturePaused || document.activeElement !== streamFeed) return;
  if ((mouseLocked() && event.code === 'Escape') || (event.code === 'Escape' && event.ctrlKey && event.altKey)) {
    if (mouseLocked()) document.exitPointerLock();
    event.preventDefault(); clearHeldInput(); streamFeed.blur(); return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (mouseLocked() && event.repeat && pressedCodes.has(event.code)) return;
  pressedCodes.add(event.code);
  flushPointer();
  sendControl({ kind: 'key', action: 'down', code: event.code });
});
document.addEventListener('keyup', event => {
  if (!pressedCodes.has(event.code)) return;
  event.preventDefault();
  pressedCodes.delete(event.code);
  sendControl({ kind: 'key', action: 'up', code: event.code });
});
window.addEventListener('blur', clearHeldInput);
streamFeed.addEventListener('blur', clearHeldInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });
window.addEventListener('pagehide', closeOverlay);

function clearHeldInput() {
  pendingMove = null;
  activePointer = null;
  pressedCodes.clear();
  pendingInput = [];
  sendControl({ kind: 'clear' });
}

function stopConnections() {
  if (mouseLocked()) document.exitPointerLock();
  epoch++;
  controlReady = hasFrame = false;
  clearInterval(heartbeat); clearInterval(watchdog);
  clearTimeout(moveTimer); clearTimeout(pointerTimer); clearTimeout(videoReconnectTimer);
  clearTimeout(reconnectControlTimer);reconnectControlTimer=null;capturePaused=false;
  clearTimeout(mediaFallbackTimer);mediaFallbackTimer=null;
  heartbeat = watchdog = moveTimer = pointerTimer = videoReconnectTimer = null;
  pendingInput = [];
  pendingMove = waitingFrame = null;
  sourceGeometry = lastPoint = activePointer = null;
  sourceViewport=null;
  pressedCodes.clear();
  controlSocket?.close(); videoSocket?.close();
  mediaReader?.close();mediaReader=null;
  if(typeof obsFeed.cancelVideoFrameCallback==='function'&&obsFrameCallback!==null)obsFeed.cancelVideoFrameCallback(obsFrameCallback);
  else clearTimeout(obsFrameCallback);
  obsFrameCallback=null;mediaMode=null;videoBufferMs=null;lastVideoStats=null;obsFeed.pause();obsFeed.srcObject=null;obsFeed.style.display='none';
  document.body.classList.remove('obs-video');
  controlSocket = videoSocket = null;
  if (remoteSession) bridgeFetch('/control/release', { session: remoteSession }).catch(() => {});
  remoteSession = null;
  painted = receivedBytes = 0;
  rttMs = null;
  videoRetries = decodeFailures = 0;
  videoAttemptAt = 0;
  streamFeed.style.display = 'none';
  streamPlaceholder.style.display = 'flex';
}

function failDesktop(message) {
  stopConnections();
  setOverlayState('error');
  rdpConnStatus.textContent = 'Disconnected';
  connMessage.textContent = message;
}

function recoverControl() {
  if(reconnectControlTimer)return;
  if(controlRetries++>=5)return failDesktop('Unable to reconnect. Check the home launcher and reopen this monitor.');
  const monitor=activeMonitor, delay=Math.min(5000,500*2**Math.min(controlRetries,3));
  stopConnections();
  connMessage.textContent='Connection interrupted; reconnecting…';
  rdpConnStatus.textContent='Reconnecting…';
  reconnectControlTimer=setTimeout(()=>{reconnectControlTimer=null;openDesktop(monitor);},delay);
}

function closeOverlay() {
  stopConnections();
  rdpOverlay.classList.remove('active');
  document.body.classList.remove('viewing-desktop');
}

function setOverlayState(state) {
  rdpStatusDot.style.background = state === 'live' ? '#fff' : '#888';
}

$('rdp-close-btn').addEventListener('click', closeOverlay);
function syncBrowserFullscreen() {
  const fillsScreen = document.fullscreenElement ||
    (Math.abs(window.innerWidth - screen.width) < 3 && Math.abs(window.innerHeight - screen.height) < 3);
  document.body.classList.toggle('browser-fullscreen', Boolean(fillsScreen));
}
document.addEventListener('fullscreenchange', syncBrowserFullscreen);
window.addEventListener('resize', syncBrowserFullscreen);
syncBrowserFullscreen();

function transitionTo(targetPage) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active', 'fade-out', 'fade-in'));
  targetPage.classList.add('active');
}
function showError(message) { errorMsg.textContent = message; errorMsg.classList.add('visible'); }
function hideError() { errorMsg.textContent = ''; errorMsg.classList.remove('visible'); }
