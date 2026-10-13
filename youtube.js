/* Official YouTube embeds only; this page does not proxy or alter access controls. */
window.NodeYouTube = (() => {
  const form = document.getElementById('youtube-form');
  const input = document.getElementById('youtube-link');
  const error = document.getElementById('youtube-error');
  const stage = document.getElementById('youtube-stage');
  const player = document.getElementById('youtube-player');
  const open = document.getElementById('youtube-open');
  let currentId = '';
  const videoId = value => {
    const text = value.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
    catch (_) { return ''; }
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'watch') id = url.searchParams.get('v') || '';
      else if (['shorts', 'live', 'embed'].includes(parts[0])) id = parts[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  };
  const embedUrl = id => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1`;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const id = videoId(input.value);
    if (!id) {
      error.textContent = 'Enter a valid YouTube video link or 11-character video ID.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    currentId = id;
    stage.hidden = false;
    open.href = `https://www.youtube.com/watch?v=${id}`;
    player.src = embedUrl(id);
  });
  return {
    parseVideoId: videoId,
    onNavigate(which) { player.src = which === 'youtube' && currentId ? embedUrl(currentId) : 'about:blank'; }
  };
})();

