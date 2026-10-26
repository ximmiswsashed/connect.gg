/* Official SoundCloud API + player. Provider credentials never enter this file. */
window.NodeSoundCloud=(()=>{
  const el=id=>document.getElementById(id),area=el('soundcloud-area');
  let account=null,epoch=0,version=0,active=false,configured=false,connected=false;
  let view='search',kind='tracks',query='',page={},rows=[],detail=null,queue=[],index=-1;
  let widget=null,widgetPromise=null,playVersion=0,shuffle=false,repeat=false,popup=null,linkTimer=null,linkDeadline=0;
  const likes=new Set(),following=new Set();let position=0,lastSaved=0;
  const api=(action,data={})=>window.ConnectPortal.request('/api/soundcloud/'+action,data);
  const error=message=>{el('sc-error').textContent=message||'';el('sc-error').hidden=!message;};
  const status=message=>{el('sc-status').textContent=message;};
  const clock=ms=>{const s=Math.floor(Math.max(0,Number(ms)||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  const number=n=>Number.isFinite(Number(n))?Number(n).toLocaleString():'0';
  const validId=id=>/^\d{1,24}$/.test(String(id));
  function safeURL(value,image=false){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(image?u.hostname.endsWith('.sndcdn.com'):['soundcloud.com','www.soundcloud.com'].includes(u.hostname))?u.href:'';}catch{return '';}}
  const storageKey=()=>account?'node.soundcloud.queue.v1.'+account.id:null;
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>area.style.setProperty('--sc-player-height',el('sc-player').hidden?'0px':el('sc-player').getBoundingClientRect().height+'px')).observe(el('sc-player'));
  const validTrack=item=>item&&item.kind==='track'&&item.access!=='blocked'&&validId(item.id)&&!!safeURL(item.url);
  function save(){if(!account)return;try{localStorage.setItem(storageKey(),JSON.stringify({queue:queue.slice(0,100),index,position,volume:el('sc-volume').value}));}catch{status('Device storage is unavailable. Your queue will last until this page closes.');}}
  function button(text,fn,cls='sc-button'){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',fn);return b;}
  function link(text,url,cls='sc-artist'){const a=document.createElement('a');a.textContent=text;a.href=safeURL(url)||'https://soundcloud.com';a.className=cls;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function resetDetail(){detail=null;el('sc-detail').hidden=true;el('sc-comments').hidden=true;el('sc-comment-text').value='';}
  function renderQueue(){
    el('sc-queue-list').replaceChildren(...queue.map((item,i)=>{const li=document.createElement('li');li.className='sc-queue-item';li.setAttribute('aria-current',String(i===index));
      li.append(button(item.title,()=>playAt(i),''),button('Remove',()=>{if(i===index)stop();queue.splice(i,1);if(i<index)index--;if(index>=queue.length)index=queue.length-1;save();renderQueue();},'sc-remove'));return li;}));
    el('sc-queue-empty').hidden=queue.length>0;el('sc-clear-queue').disabled=!queue.length;el('sc-save-queue').disabled=!connected||!queue.length;
    el('sc-prev').disabled=index<=0;el('sc-next').disabled=!queue.length||(index>=queue.length-1&&!repeat&&!shuffle);
  }
  function add(item){if(!validTrack(item)){error('This track cannot be played here. Open it on SoundCloud.');return;}
    if(queue.length>=100){error('Your queue is full. Remove a track first.');return;}queue.push({...item});save();renderQueue();status('Added to queue: '+item.title);}
  function loadWidget(){
    if(window.SC?.Widget)return Promise.resolve();if(widgetPromise)return widgetPromise;
    widgetPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';
      const timer=setTimeout(()=>{script.remove();widgetPromise=null;reject(new Error('The SoundCloud player timed out. Select the track again to retry.'));},15000);
      script.onload=()=>{clearTimeout(timer);if(window.SC?.Widget)resolve();else{widgetPromise=null;reject(new Error('SoundCloud player controls did not load.'));}};
      script.onerror=()=>{clearTimeout(timer);script.remove();widgetPromise=null;reject(new Error('Cannot load SoundCloud playback. Check your connection.'));};document.head.append(script);
    });return widgetPromise;
  }
  function stop(){playVersion++;try{widget?.pause();for(const ev of Object.values(window.SC?.Widget?.Events||{}))widget?.unbind(ev);}catch{}widget=null;el('sc-player-frame').src='about:blank';el('sc-player').hidden=true;}
  async function playAt(i,resume=0){
    const item=queue[i];if(!validTrack(item)||!account)return;stop();index=i;position=resume;save();renderQueue();error('');
    const serial=playVersion,generation=epoch;el('sc-now-title').textContent=item.title+' — '+item.artist;el('sc-player').hidden=false;
    el('sc-player-frame').src='https://w.soundcloud.com/player/?'+new URLSearchParams({url:item.url,auto_play:'false',show_artwork:'true',show_user:'true',color:'#ffffff'});
    try{await loadWidget();if(serial!==playVersion||generation!==epoch||!active)return;
      widget=window.SC.Widget(el('sc-player-frame'));const events=window.SC.Widget.Events;
      widget.bind(events.READY,()=>{if(serial!==playVersion||generation!==epoch)return;widget.setVolume(Number(el('sc-volume').value));if(resume)widget.seekTo(resume);widget.play();});
      widget.bind(events.PLAY_PROGRESS,event=>{if(serial!==playVersion||generation!==epoch)return;position=Number(event.currentPosition)||0;if(Date.now()-lastSaved>5000){lastSaved=Date.now();save();}});
      widget.bind(events.PAUSE,()=>{if(serial===playVersion)save();});
      widget.bind(events.FINISH,()=>{if(serial===playVersion)next();});
      widget.bind(events.ERROR,()=>{if(serial===playVersion)error('SoundCloud cannot play this track here. It may be restricted or unavailable. Try another track or open SoundCloud.');});
    }catch(failure){if(serial===playVersion&&generation===epoch)error(failure.message);}
  }
  function next(){if(!queue.length)return;if(shuffle&&queue.length>1){let i;do{i=Math.floor(Math.random()*queue.length);}while(i===index);playAt(i);}else if(index+1<queue.length)playAt(index+1);else if(repeat)playAt(0);}
  async function social(action,item,b){
    if(!connected){error('Connect SoundCloud to use this feature.');return;}
    const generation=epoch,set=action==='like'?likes:following,enabled=!set.has(item.id);b.disabled=true;
    try{await api(action,{id:item.id,enabled});if(generation!==epoch)return;if(enabled)set.add(item.id);else set.delete(item.id);b.textContent=action==='like'?(enabled?'Unlike':'Like'):(enabled?'Unfollow':'Follow');}
    catch(failure){if(generation===epoch)error(failure.message);}finally{b.disabled=false;}
  }
  function row(item){
    const article=document.createElement('article');article.className='sc-row';
    const cover=document.createElement('div');cover.className='sc-cover';const imageURL=safeURL(item.artwork,true);
    if(imageURL){const image=document.createElement('img');image.className='sc-cover';image.src=imageURL;image.alt='';image.loading='lazy';cover.append(image);}
    const text=document.createElement('div'),title=button(item.title,()=>item.kind==='track'?playItem(item):openDetail(item),'sc-title');
    const meta=document.createElement('span');meta.className='sc-meta';meta.textContent=item.kind==='user'?number(item.followers)+' followers':item.kind==='playlist'?number(item.trackCount)+' tracks':clock(item.duration)+' · '+number(item.plays)+' plays'+(item.access==='preview'?' · Preview':'');
    text.append(title,link(item.artist||'View on SoundCloud',item.userUrl||item.url),meta);
    const actions=document.createElement('div');actions.className='sc-row-actions';
    if(item.kind==='track'){
      actions.append(button('Queue',()=>add(item)),button('Details',()=>openDetail(item)));
      const like=button(likes.has(item.id)?'Unlike':'Like',()=>social('like',item,like));like.disabled=!connected;actions.append(like);
    }else if(item.kind==='user'){const follow=button(following.has(item.id)?'Unfollow':'Follow',()=>social('follow',item,follow));follow.disabled=!connected;actions.append(follow);}
    else actions.append(button('Open playlist',()=>openDetail(item)));
    article.append(cover,text,actions);return article;
  }
  function playItem(item){let i=queue.findIndex(t=>t.id===item.id);if(i<0){if(queue.length>=100){error('Your queue is full. Remove a track first.');return;}queue.push({...item});i=queue.length-1;}playAt(i);}
  function renderRows(){el('sc-results').replaceChildren(...rows.map(row));}
  async function list(append=false){
    if(!account||!configured)return;if(view!=='search'&&!connected){error('Connect your SoundCloud account to open your library.');return;}
    if(view==='search'&&!query)return;
    const serial=++version,generation=epoch;error('');status('Loading…');el('sc-more').disabled=true;el('sc-results').setAttribute('aria-busy','true');
    try{const value=await api(view==='search'?'search':view,{q:query,kind,...(append?{page}:{})});if(serial!==version||generation!==epoch)return;
      rows=append?[...rows,...(value.items||[])]:value.items||[];page=value.page||{};
      if(view==='likes')for(const item of rows)likes.add(item.id);if(view==='following')for(const item of rows)following.add(item.id);
      renderRows();el('sc-more').hidden=!Object.keys(page).length;status(rows.length?rows.length+' '+(view==='search'?kind==='users'?'artists':kind:'items')+' loaded':'Nothing here yet. Try another search or add music on SoundCloud.');
    }catch(failure){if(serial===version&&generation===epoch){error(failure.message);status('Could not load this view. Select it again or retry your search.');}}
    finally{if(serial===version&&generation===epoch){el('sc-more').disabled=false;el('sc-results').setAttribute('aria-busy','false');}}
  }
  function switchView(next){version++;view=next;page={};rows=[];resetDetail();error('');renderRows();el('sc-more').hidden=true;
    for(const b of area.querySelectorAll('[data-sc-view]'))b.setAttribute('aria-current',b.dataset.scView===view?'page':'false');
    el('sc-filters').hidden=view!=='search';el('sc-heading').textContent=({search:query?'Results for “'+query+'”':'Find your next favorite.',feed:'Your feed',likes:'Your liked tracks',playlists:'Your playlists',following:'Artists you follow',recent:'Recently played'})[view];
    el('sc-intro').hidden=view!=='search'||!!query;list();
  }
  async function comments(item,generation,serial){
    try{const data=await api('comments',{id:item.id});if(generation!==epoch||serial!==version)return;
      el('sc-comment-list').replaceChildren(...data.items.map(c=>{const node=document.createElement('article'),author=document.createElement('strong'),body=document.createElement('p');node.className='sc-comment';author.textContent=c.author;body.textContent=c.body;node.append(author,body);return node;}));
      if(!data.items.length)el('sc-comment-list').textContent='No comments yet.';
    }catch(failure){if(generation===epoch&&serial===version)el('sc-comment-list').textContent=failure.message;}
  }
  async function openDetail(item){
    const serial=++version,generation=epoch;error('');status('Loading details…');el('sc-more').hidden=true;
    try{const data=await api('detail',{id:item.id,kind:item.kind==='user'?'users':item.kind==='playlist'?'playlists':'tracks'});if(serial!==version||generation!==epoch)return;
      detail=data.item;el('sc-detail').hidden=false;el('sc-detail-title').textContent=detail.title;el('sc-detail-description').textContent=detail.description;
      el('sc-detail-link').href=safeURL(detail.url)||'https://soundcloud.com';const actions=el('sc-detail-actions');actions.replaceChildren();
      if(detail.kind==='track')actions.append(button('Play',()=>playItem(detail),'sc-button sc-primary'),button('Add to queue',()=>add(detail)));
      else if(detail.kind==='playlist')actions.append(button('Play playlist',()=>{const tracks=(data.items||[]).filter(validTrack).slice(0,100);if(!tracks.length)return error('This playlist has no playable tracks.');queue=tracks;playAt(0);},'sc-button sc-primary'));
      rows=data.items||[];renderRows();el('sc-comments').hidden=detail.kind!=='track';el('sc-comment-form').hidden=!connected;
      if(detail.kind==='track'){el('sc-comment-list').textContent='Loading comments…';comments(detail,generation,serial);}
      status('');el('sc-detail-title').focus();
    }catch(failure){if(serial===version&&generation===epoch)error(failure.message);}
  }
  async function config(){const generation=epoch;if(!account)return;
    try{const value=await api('config');if(generation!==epoch)return;configured=!!value.configured;connected=!!value.connected;
      el('sc-setup').hidden=configured;el('sc-browser').hidden=!configured;el('sc-search').disabled=el('sc-query').disabled=!configured;
      el('sc-connect').disabled=!configured;el('sc-connect').hidden=connected;el('sc-disconnect').hidden=!connected;
      el('sc-account-name').textContent=connected?value.profile?.title||'Connected':'';renderQueue();
      if(connected&&linkTimer){clearInterval(linkTimer);linkTimer=null;status('SoundCloud connected. Your library is ready.');}
    }catch(failure){if(generation===epoch){
      if(failure.status===404||/server needs an update/i.test(failure.message)){el('sc-setup').hidden=false;el('sc-browser').hidden=true;error('Run the updated Desktop 1.cmd on the home PC, then select Check setup.');}
      else error(failure.message);
    }}
  }
  async function connect(){
    error('');popup=window.open('about:blank','node-soundcloud-connect','width=540,height=720');if(!popup)return error('Allow pop-ups for Node, then try connecting again.');
    const generation=epoch;el('sc-connect').disabled=true;
    try{const value=await api('connect');if(generation!==epoch){popup.close();return;}
      const base=new URL(window.CONNECT_API||location.origin),url=new URL(value.authorizeUrl);
      if(url.origin!==base.origin||url.pathname!=='/api/soundcloud/authorize'||!/^[A-Za-z0-9_-]{43}$/.test(value.ticket))throw new Error('The account connection address is invalid.');
      const form=document.createElement('form'),ticket=document.createElement('input');form.method='POST';form.action=url.href;form.target='node-soundcloud-connect';ticket.type='hidden';ticket.name='ticket';ticket.value=value.ticket;form.append(ticket);document.body.append(form);form.submit();form.remove();
      clearInterval(linkTimer);linkDeadline=Date.now()+600000;linkTimer=setInterval(()=>{if(!account||Date.now()>linkDeadline||popup?.closed){clearInterval(linkTimer);linkTimer=null;config();return;}config();},3000);
      status('Finish signing in in the SoundCloud window.');
    }catch(failure){popup?.close();if(generation===epoch)error(failure.message);}finally{if(generation===epoch)el('sc-connect').disabled=!configured;}
  }
  el('sc-search-form').addEventListener('submit',e=>{e.preventDefault();query=el('sc-query').value.trim();if(query)switchView('search');});
  for(const b of area.querySelectorAll('[data-sc-view]'))b.addEventListener('click',()=>switchView(b.dataset.scView));
  for(const b of area.querySelectorAll('[data-sc-kind]'))b.addEventListener('click',()=>{kind=b.dataset.scKind;for(const other of area.querySelectorAll('[data-sc-kind]'))other.setAttribute('aria-pressed',String(other===b));if(query)switchView('search');});
  el('sc-check').addEventListener('click',()=>{error('');config();});el('sc-connect').addEventListener('click',connect);
  el('sc-disconnect').addEventListener('click',async()=>{if(!window.confirm('Disconnect your SoundCloud account from Node?'))return;const generation=epoch;el('sc-disconnect').disabled=true;
    try{await api('disconnect');if(generation!==epoch)return;stop();queue=[];index=-1;likes.clear();following.clear();save();switchView('search');await config();status('SoundCloud disconnected.');}catch(failure){if(generation===epoch)error(failure.message);}finally{el('sc-disconnect').disabled=false;}});
  el('sc-more').addEventListener('click',()=>list(true));el('sc-back').addEventListener('click',()=>switchView(view));
  el('sc-prev').addEventListener('click',()=>{if(index>0)playAt(index-1);});el('sc-next').addEventListener('click',next);
  el('sc-toggle').addEventListener('click',()=>{if(widget)widget.toggle();else if(index>=0)playAt(index,position);});
  el('sc-close-player').addEventListener('click',stop);el('sc-volume').addEventListener('input',()=>{widget?.setVolume(Number(el('sc-volume').value));save();});
  el('sc-shuffle').addEventListener('click',()=>{shuffle=!shuffle;el('sc-shuffle').setAttribute('aria-pressed',String(shuffle));renderQueue();});
  el('sc-repeat').addEventListener('click',()=>{repeat=!repeat;el('sc-repeat').setAttribute('aria-pressed',String(repeat));renderQueue();});
  el('sc-clear-queue').addEventListener('click',()=>{stop();queue=[];index=-1;position=0;save();renderQueue();});
  el('sc-save-queue').addEventListener('click',()=>{el('sc-playlist-error').textContent='';el('sc-playlist-dialog').showModal();});
  el('sc-playlist-cancel').addEventListener('click',()=>el('sc-playlist-dialog').close());
  el('sc-playlist-form').addEventListener('submit',async e=>{e.preventDefault();const generation=epoch,b=el('sc-playlist-submit');b.disabled=true;
    try{await api('create-playlist',{title:el('sc-playlist-title').value.trim(),tracks:queue.map(t=>t.id)});if(generation!==epoch)return;el('sc-playlist-dialog').close();el('sc-playlist-title').value='';switchView('playlists');}
    catch(failure){if(generation===epoch)el('sc-playlist-error').textContent=failure.message;}finally{b.disabled=false;}});
  el('sc-comment-form').addEventListener('submit',async e=>{e.preventDefault();if(!detail)return;const generation=epoch,serial=version,item=detail,b=el('sc-comment-send'),text=el('sc-comment-text').value.trim();if(!text)return;b.disabled=true;
    try{await api('comment',{id:item.id,body:text});if(generation!==epoch||serial!==version)return;el('sc-comment-text').value='';comments(item,generation,serial);status('Comment posted.');}
    catch(failure){if(generation===epoch)error(failure.message);}finally{b.disabled=false;}});
  window.addEventListener('pagehide',save);
  return {onAccount(next){save();stop();epoch++;version++;account=next?{...next}:null;queue=[];index=-1;position=0;configured=connected=false;likes.clear();following.clear();clearInterval(linkTimer);linkTimer=null;popup?.close();popup=null;
    el('sc-account-name').textContent='';el('sc-now-title').textContent='';el('sc-detail-title').textContent='';el('sc-detail-description').textContent='';el('sc-detail-link').href='https://soundcloud.com';el('sc-detail-actions').replaceChildren();
    el('sc-connect').hidden=false;el('sc-connect').disabled=true;el('sc-disconnect').hidden=true;el('sc-search').disabled=el('sc-query').disabled=true;
    el('sc-playlist-error').textContent='';el('sc-playlist-title').value='';shuffle=repeat=false;el('sc-shuffle').setAttribute('aria-pressed','false');el('sc-repeat').setAttribute('aria-pressed','false');
    for(const b of area.querySelectorAll('[data-sc-view]'))b.setAttribute('aria-current',b.dataset.scView==='search'?'page':'false');
    kind='tracks';for(const b of area.querySelectorAll('[data-sc-kind]'))b.setAttribute('aria-pressed',String(b.dataset.scKind==='tracks'));
    el('sc-heading').textContent='Find your next favorite.';el('sc-intro').hidden=false;el('sc-filters').hidden=false;el('sc-more').hidden=true;el('sc-more').disabled=false;el('sc-results').setAttribute('aria-busy','false');
    if(el('sc-playlist-dialog').open)el('sc-playlist-dialog').close();el('sc-comment-list').replaceChildren();el('sc-results').replaceChildren();el('sc-query').value='';query='';rows=[];page={};view='search';resetDetail();error('');status('');
    if(account){try{const stored=JSON.parse(localStorage.getItem(storageKey())||'{}');queue=(stored.queue||[]).filter(validTrack).slice(0,100);index=Number.isInteger(stored.index)&&stored.index>=0&&stored.index<queue.length?stored.index:-1;position=Number.isFinite(Number(stored.position))?Math.max(0,Number(stored.position)):0;const volume=Number(stored.volume);el('sc-volume').value=String(Number.isFinite(volume)?Math.max(0,Math.min(100,volume)):75);}catch{}}
    renderQueue();if(active&&account)config();
  },onNavigate(which){active=which==='soundcloud';if(active&&account)config();else{save();try{widget?.pause();}catch{}}}};
})();
