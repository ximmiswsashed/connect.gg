/* Official YouTube playback; private per-account progress, shared server search. */
window.NodeYouTube = (() => {
  const el = id => document.getElementById(id);
  const area=el('youtube-area'),stage=el('youtube-stage'),results=el('youtube-results');
  const error=el('youtube-error');
  const searchButton=el('youtube-search'),more=el('youtube-more'),toolbarToggle=el('youtube-toolbar-toggle');
  let account=null,epoch=0,active=false,history=[],current=null,yt=null,playerVersion=0;
  let lastQuery='',nextPage='',loading=false,searchVersion=0,apiPromise=null,ready=false,showingHistory=false;
  let timer=null,lastSync=0,pending=new Map(),syncBusy=false,resumeTarget=null,resumeDeadline=0;
  const validId=id=>/^[A-Za-z0-9_-]{11}$/.test(id||'');
  const validChannel=id=>/^UC[A-Za-z0-9_-]{22}$/.test(id||'');
  const uploadDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value):null;
  function creatorLink(link,item){
    link.textContent=item.channel;link.target='_blank';link.rel='noopener noreferrer';
    link.href=validChannel(item.channelId)?'https://www.youtube.com/channel/'+item.channelId:'https://www.youtube.com/results?search_query='+encodeURIComponent(item.channel||'');
    link.setAttribute('aria-label','Open '+item.channel+' on YouTube (new tab)');
  }
  function publishedLabel(node,value){
    const date=uploadDate(value);node.hidden=!date;
    node.textContent=date?'Uploaded '+date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'';
    node.dateTime=date?date.toISOString():'';
  }
  const api=(action,data={})=>window.ConnectPortal.request('/api/youtube/'+action,data);
  const storageKey=()=>account?'node.youtube.history.v1.'+account.id:null;
  const showError=message=>{error.textContent=message;error.hidden=!message;};
  const status=message=>{el('youtube-status').textContent=message;};
  const time=value=>{const s=Math.max(0,Math.floor(Number(value)||0));return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
  const clean=item=>item&&validId(item.video)&&Number.isFinite(item.position)&&Number.isFinite(item.duration)&&Number.isFinite(item.updated)&&item.position>=0&&item.duration>=0;
  function persist(){
    if(!account)return;
    try{localStorage.setItem(storageKey(),JSON.stringify(history.slice(0,200)));}
    catch(_){el('youtube-history-status').textContent='Browser storage is unavailable. Progress will save to your account while connected.';}
  }
  function remember(item){history=[item,...history.filter(row=>row.video!==item.video)].sort((a,b)=>b.updated-a.updated).slice(0,200);persist();}
  function snapshot(){
    if(!account||!current||!ready||!yt)return;
    try{
      const position=yt.getCurrentTime(),duration=yt.getDuration();
      if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0)return;
      if(resumeTarget!==null){
        if(Math.abs(position-resumeTarget)>2&&Date.now()<resumeDeadline)return;
        resumeTarget=null;
      }
      if(Math.abs(position-current.position)<.01&&duration===current.duration)return;
      current={...current,position:Math.max(0,Math.min(position,duration)),duration,updated:Date.now()/1000};
      remember(current);pending.set(current.video,{...current});
    }catch(_){} // The player may not yet be ready.
  }
  async function sync(){
    if(syncBusy||!account||!pending.size)return;
    const generation=epoch,owner=account.id;syncBusy=true;lastSync=Date.now();
    try{
      for(const [id,item] of [...pending]){
        if(generation!==epoch||account?.id!==owner)break;
        await api('progress',item);
        if(generation!==epoch)break;
        if(pending.get(id)===item)pending.delete(id);
      }
      if(generation===epoch)el('youtube-history-status').textContent='History is private to your account.';
    }catch(_){if(generation===epoch)el('youtube-history-status').textContent='Saved on this device. Account sync will retry when connected.';}
    finally{if(generation===epoch)syncBusy=false;}
  }
  function pause(){snapshot();sync();try{yt?.pauseVideo();}catch(_){}clearInterval(timer);timer=null;}
  function trackProgress(){
    clearInterval(timer);timer=null;
    if(active&&ready&&yt)timer=setInterval(()=>{snapshot();if(Date.now()-lastSync>10000)sync();},1000);
  }
  function showToolbar(show){
    area.classList.toggle('yt-toolbar-collapsed',!show);
    toolbarToggle.setAttribute('aria-expanded',String(show));toolbarToggle.setAttribute('aria-label',show?'Hide YouTube toolbar':'Show YouTube toolbar');
    toolbarToggle.querySelector('path').setAttribute('d',show?'m6 15 6-6 6 6':'m6 9 6 6 6-6');
  }
  toolbarToggle.addEventListener('click',()=>{showToolbar(toolbarToggle.getAttribute('aria-expanded')!=='true');if(!stage.hidden)stage.scrollIntoView({block:'start'});});
  if(typeof ResizeObserver==='function')new ResizeObserver(entries=>{
    const height=entries[0]?.target.getBoundingClientRect().height;
    if(height>0)document.documentElement.style.setProperty('--yt-toolbar-height',`${height}px`);
  }).observe(area.querySelector('.yt-topbar'));
  function loadAPI(){
    if(window.YT?.Player)return Promise.resolve();
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      const timeout=setTimeout(()=>{apiPromise=null;reject(new Error('Player controls did not load. Check your connection and reopen this video to enable saved progress.'));},15000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve();};
      let script=document.querySelector('script[data-node-youtube-api]');
      if(!script){script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.dataset.nodeYoutubeApi='true';document.head.append(script);}
      script.onerror=()=>{clearTimeout(timeout);apiPromise=null;script.remove();reject(new Error('Cannot load YouTube playback controls. Check your connection, then reopen the video.'));};
    });return apiPromise;
  }
  function destroyPlayer(){
    ready=false;resumeTarget=null;playerVersion++;try{yt?.destroy();}catch(_){}yt=null;
    const frame=document.createElement('iframe');frame.id='youtube-player';frame.title='YouTube video player';frame.src='about:blank';
    frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    area.querySelector('.youtube-frame').replaceChildren(frame);return frame;
  }
  function home(){
    pause();destroyPlayer();showToolbar(true);showingHistory=false;el('youtube-history-panel').hidden=true;
    area.classList.remove('yt-watching','yt-menu-collapsed');el('youtube-menu').setAttribute('aria-expanded','true');stage.hidden=true;
    el('youtube-home').setAttribute('aria-current','page');el('youtube-history').setAttribute('aria-current','false');results.hidden=false;more.hidden=!nextPage;showError('');
  }
  async function play(item,userGesture=true){
    if(!account||!clean(item))return;
    pause();current={...item};showingHistory=false;el('youtube-history-panel').hidden=true;showError('');
    stage.hidden=false;area.classList.add('yt-watching','yt-menu-collapsed');el('youtube-menu').setAttribute('aria-expanded','false');
    el('youtube-video-title').textContent=item.title;creatorLink(el('youtube-video-channel'),item);publishedLabel(el('youtube-video-date'),item.publishedAt);el('youtube-open').href='https://www.youtube.com/watch?v='+item.video;
    const frame=destroyPlayer(),version=playerVersion,generation=epoch;
    const params=new URLSearchParams({playsinline:'1',enablejsapi:'1',origin:window.location.origin,start:String(Math.floor(item.position))});
    frame.title=item.title;frame.src=`https://www.youtube-nocookie.com/embed/${item.video}?${params}`;results.hidden=false;
    if(userGesture){current.updated=Date.now()/1000;remember(current);pending.set(item.video,{...current});sync();}
    stage.scrollIntoView({behavior:'auto',block:'start'});
    try{
      await loadAPI();if(version!==playerVersion||generation!==epoch||!active)return;
      yt=new window.YT.Player(frame,{events:{
        onReady:event=>{
          if(version!==playerVersion||generation!==epoch)return;
          resumeTarget=item.position>0?item.position:null;resumeDeadline=Date.now()+5000;
          if(item.position>0)event.target.seekTo(item.position,true);ready=true;
          if(userGesture&&active)event.target.playVideo();else event.target.pauseVideo();
          trackProgress();
        },
        onStateChange:()=>{if(version===playerVersion&&generation===epoch){snapshot();sync();}},
        onError:event=>{if(version!==playerVersion||generation!==epoch)return;
          const messages={100:'This video is no longer available.',101:'This creator does not allow embedded playback. Open it on YouTube.',150:'This creator does not allow embedded playback. Open it on YouTube.',153:'YouTube could not verify this embed. Open the video on YouTube or reload Node.'};
          showError(messages[event.data]||'This video could not play. Try another video or open it on YouTube.');
        }
      }});
    }catch(failure){if(version===playerVersion&&generation===epoch)showError(failure.message);}
  }
  function card(item,historyCard=false){
    const card=document.createElement('article');card.className='youtube-result';
    const button=document.createElement('button');button.type='button';button.className='youtube-play';button.setAttribute('aria-label',`Play ${item.title}${item.position?' from '+time(item.position):''}`);
    const image=document.createElement('img');image.className='youtube-thumb';image.src=`https://i.ytimg.com/vi/${item.video}/hqdefault.jpg`;image.alt='';image.loading='lazy';
    const heading=document.createElement('span');heading.className='youtube-result-title';heading.textContent=item.title;
    const channel=document.createElement('a');channel.className='youtube-channel';creatorLink(channel,item);button.append(image,heading);
    const published=document.createElement('time');published.className='youtube-published';publishedLabel(published,item.publishedAt);card.append(button,channel,published);
    if(historyCard){
      const progress=document.createElement('progress');progress.max=item.duration||1;progress.value=item.position;progress.setAttribute('aria-label','Video progress');
      const detail=document.createElement('span');detail.className='yt-watch-time';detail.textContent=`${time(item.position)}${item.duration?' / '+time(item.duration):''} · ${new Date(item.updated*1000).toLocaleString()}`;card.append(progress,detail);
    }
    button.addEventListener('click',()=>{const saved=history.find(row=>row.video===item.video);play(saved?{...item,...saved,channelId:item.channelId||saved.channelId,publishedAt:item.publishedAt||saved.publishedAt}:item);});return card;
  }
  function showHistory(){
    home();showingHistory=true;more.hidden=true;results.hidden=true;el('youtube-history-panel').hidden=false;
    el('youtube-history-list').replaceChildren(...history.map(item=>card(item,true)));el('youtube-history-empty').hidden=history.length>0;el('youtube-history').setAttribute('aria-current','page');
    el('youtube-home').setAttribute('aria-current','false');status(`${history.length} recent video${history.length===1?'':'s'}`);el('youtube-history-title').focus();
  }
  async function search(append=false){
    if(loading||!account)return;
    const version=++searchVersion,generation=epoch;loading=true;searchButton.disabled=more.disabled=true;showError('');status('Searching YouTube…');
    try{
      const data=await api('search',{q:lastQuery,...(append&&nextPage?{pageToken:nextPage}:{})});if(version!==searchVersion||generation!==epoch)return;
      let added=0;
      for(const item of data.items||[]){if(!validId(item?.id?.videoId))continue;
        results.append(card({video:item.id.videoId,title:String(item.snippet?.title||'YouTube video'),channel:String(item.snippet?.channelTitle||'YouTube'),channelId:validChannel(item.snippet?.channelId)?item.snippet.channelId:'',publishedAt:uploadDate(item.snippet?.publishedAt)?item.snippet.publishedAt:'',position:0,duration:0,updated:Date.now()/1000}));added++;
      }
      nextPage=data.nextPageToken||'';more.hidden=!nextPage||(append&&!added);status(results.children.length?`${results.children.length} videos for “${lastQuery}”`:'No videos found. Try a different search.');
    }catch(failure){if(version===searchVersion&&generation===epoch){showError(failure.message);status('Search did not finish. Submit your search again to retry.');}}
    finally{if(version===searchVersion&&generation===epoch){loading=false;searchButton.disabled=more.disabled=false;}}
  }
  function searchFor(query){if(loading||!query.trim())return;lastQuery=query.trim();el('youtube-query').value=lastQuery;home();results.replaceChildren();nextPage='';more.hidden=true;search();}
  el('youtube-form').addEventListener('submit',event=>{event.preventDefault();searchFor(el('youtube-query').value);});
  for(const id of ['youtube-home','youtube-brand','youtube-all','youtube-back'])el(id).addEventListener('click',home);
  for(const button of document.querySelectorAll('[data-youtube-query]'))button.addEventListener('click',()=>searchFor(button.dataset.youtubeQuery));
  el('youtube-history').addEventListener('click',showHistory);el('youtube-history-top').addEventListener('click',showHistory);
  el('youtube-menu').addEventListener('click',()=>{const collapsed=area.classList.toggle('yt-menu-collapsed');el('youtube-menu').setAttribute('aria-expanded',String(!collapsed));});
  more.addEventListener('click',()=>{if(nextPage)search(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){snapshot();sync();}});window.addEventListener('pagehide',()=>{snapshot();sync();});
  return {
    onAccount(next){
      pause();epoch++;account=next?{...next,id:next.id??'name:'+next.name.normalize('NFKC').toLowerCase()}:null;history=[];current=null;pending=new Map();syncBusy=false;lastSync=0;searchVersion++;loading=false;ready=false;
      destroyPlayer();results.replaceChildren();el('youtube-history-list').replaceChildren();el('youtube-query').value='';nextPage='';lastQuery='';stage.hidden=true;el('youtube-history-panel').hidden=true;showingHistory=false;area.classList.remove('yt-watching');showError('');
      el('youtube-history-status').textContent='History is private to your account.';searchButton.disabled=more.disabled=false;more.hidden=true;
      el('youtube-video-title').textContent='';el('youtube-video-channel').textContent='';el('youtube-video-channel').href='https://www.youtube.com/';publishedLabel(el('youtube-video-date'),'');el('youtube-open').href='https://www.youtube.com/';
      if(!next)return;
      try{history=JSON.parse(localStorage.getItem(storageKey())||'[]').filter(clean).slice(0,200);}catch(_){history=[];}
      const generation=epoch;
      api('history').then(data=>{
        if(generation!==epoch)return;
        const merged=new Map((data.items||[]).filter(clean).map(item=>[item.video,item]));
        for(const item of history){if(!merged.has(item.video)||merged.get(item.video).updated<item.updated){merged.set(item.video,item);pending.set(item.video,item);}}
        history=[...merged.values()].sort((a,b)=>b.updated-a.updated).slice(0,200);persist();sync();
        try{localStorage.removeItem('node.youtube.apiKey.v1');}catch(_){}
        if(generation!==epoch)return;
        if(active&&!current&&!showingHistory&&history.length)play(history[0],false);if(showingHistory)showHistory();
      }).catch(()=>{if(generation===epoch)el('youtube-history-status').textContent='Account history is offline. Videos saved on this device are still available.';});
    },
    onNavigate(which){
      active=which==='youtube';if(!active){pause();return;}
      // Retain the live iframe/API instance across Node tabs. Destroying it on
      // every return races YouTube's iframe lifecycle and can leave a blank view.
      if(!stage.hidden&&current){if(yt)trackProgress();else play(current,false);return;}
      // Preserve History and search results rather than reopening an old video.
      if(!current&&!showingHistory&&history.length)play(history[0],false);
      else if(!current&&!showingHistory)status('Search YouTube to find your next video.');
    }
  };
})();
