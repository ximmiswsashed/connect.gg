/* YouTube search uses the official Data API; playback uses the official embed. */
window.NodeYouTube = (() => {
  const el = id => document.getElementById(id);
  const form = el('youtube-form'), queryInput = el('youtube-query'), searchButton = el('youtube-search');
  const settings = el('youtube-settings'), keyInput = el('youtube-api-key');
  const keyStatus = el('youtube-key-status'), error = el('youtube-error'), status = el('youtube-status');
  const results = el('youtube-results'), more = el('youtube-more');
  const stage = el('youtube-stage'), player = el('youtube-player'), open = el('youtube-open');
  const storageKey = 'node.youtube.apiKey.v1';
  let currentId = '', lastQuery = '', nextPage = '', loading = false, searchVersion = 0;
  const validId = id => /^[A-Za-z0-9_-]{11}$/.test(id || '');
  const embedUrl = id => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1`;
  const savedKey = () => { try { return window.localStorage.getItem(storageKey) || ''; } catch (_) { return ''; } };
  const showError = message => { error.textContent = message; error.hidden = !message; };
  const setStatus = message => { status.textContent = message; };
  const stopVideo = () => { player.src = 'about:blank'; };
  const play = id => {
    if (!validId(id)) return;
    currentId = id;
    stage.hidden = false;
    open.href = `https://www.youtube.com/watch?v=${id}`;
    player.src = embedUrl(id);
    stage.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const addResult = item => {
    const id = item?.id?.videoId;
    if (!validId(id)) return false;
    const title = String(item.snippet?.title || 'Untitled video');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'youtube-result';
    button.setAttribute('aria-label', `Play ${title}`);
    const image = document.createElement('img');
    image.className = 'youtube-thumb';
    image.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    image.alt = '';
    image.loading = 'lazy';
    const heading = document.createElement('span');
    heading.className = 'youtube-result-title';
    heading.textContent = title;
    const channel = document.createElement('span');
    channel.className = 'youtube-channel';
    channel.textContent = String(item.snippet?.channelTitle || 'YouTube');
    button.append(image, heading, channel);
    button.addEventListener('click', () => play(id));
    results.append(button);
    return true;
  };
  async function search(append = false) {
    if (loading) return;
    const key = savedKey();
    if (!key) {
      settings.open = true;
      showError('Add a YouTube Data API key under Search setup before searching.');
      keyInput.focus();
      return;
    }
    const query = lastQuery.trim();
    if (!query) return;
    const version = ++searchVersion;
    loading = true;
    searchButton.disabled = true;
    more.disabled = true;
    showError('');
    setStatus(append ? 'Loading more videos…' : `Searching for “${query}”…`);
    try {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '18', q: query });
      if (append && nextPage) params.set('pageToken', nextPage);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { cache: 'no-store', referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'X-Goog-Api-Key': key } });
      const data = await response.json();
      if (version !== searchVersion) return;
      if (!response.ok) {
        const reason = data?.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new Error('YouTube search has reached its daily limit. Try again tomorrow.');
        if (response.status === 400 || response.status === 403) throw new Error('YouTube rejected this API key. Check that YouTube Data API v3 is enabled and the key allows this website.');
        throw new Error('YouTube search is unavailable right now. Please try again.');
      }
      let added = 0;
      for (const item of data.items || []) if (addResult(item)) added++;
      nextPage = data.nextPageToken || '';
      more.hidden = !nextPage;
      setStatus(results.children.length ? `${results.children.length} videos for “${query}”` : `No playable results for “${query}”. Try a different search.`);
      if (append && !added) more.hidden = true;
    } catch (failure) {
      if (version !== searchVersion) return;
      showError(failure instanceof TypeError ? 'Cannot reach YouTube search from this network. Try again when the connection is available.' : failure.message);
      setStatus('Search did not complete.');
    } finally {
      if (version === searchVersion) { loading = false; searchButton.disabled = false; more.disabled = false; }
    }
  }
  keyInput.value = savedKey();
  if (!keyInput.value) { settings.open = true; setStatus('Add your YouTube Data API key under Search setup to begin.'); }
  el('youtube-save-key').addEventListener('click', () => {
    const value = keyInput.value.trim();
    if (value.length < 20 || value.length > 200 || /\s/.test(value)) { keyStatus.textContent = 'Enter the full API key from Google Cloud.'; return; }
    try { window.localStorage.setItem(storageKey, value); keyStatus.textContent = 'Key saved in this browser. You can search now.'; settings.open = false; setStatus('Search YouTube to see videos here.'); showError(''); }
    catch (_) { keyStatus.textContent = 'This browser could not save the key. Check storage permissions.'; }
  });
  el('youtube-remove-key').addEventListener('click', () => {
    try { window.localStorage.removeItem(storageKey); } catch (_) {}
    keyInput.value = '';
    keyStatus.textContent = 'Key removed from this browser.';
    settings.open = true;
    setStatus('Add your YouTube Data API key under Search setup to begin.');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (loading) return;
    lastQuery = queryInput.value.trim();
    if (!lastQuery) return;
    results.replaceChildren();
    nextPage = '';
    more.hidden = true;
    stage.hidden = true;
    currentId = '';
    stopVideo();
    search();
  });
  more.addEventListener('click', () => { if (nextPage) search(true); });
  return {
    onNavigate(which) {
      if (which === 'youtube') { if (currentId && player.src === 'about:blank') player.src = embedUrl(currentId); }
      else if (player.src !== 'about:blank') stopVideo();
    }
  };
})();

