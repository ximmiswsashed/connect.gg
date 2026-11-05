/* Audius music in Node. Local libraries are isolated by the signed-in Node user. */
window.NodeAudius=(()=>{
  const el=id=>document.getElementById(id),area=el('soundcloud-area'),api=window.NodeAudiusAPI,audio=el('au-audio');
  const blank=()=>({queue:[],index:-1,position:0,volume:75,saved:[],playlists:[],history:[],profile:null});
  let account=null,state=blank(),epoch=0,serial=0,active=false,loaded=false,view='explore',kind='tracks',query='',offset=0,hasMore=false,rows=[],detail=null;
  let controller=null,timer=null,popup=null,auth=null,popupTimer=null,shuffle=false,repeat=false,playVersion=0,mediaEpoch=-1,pendingSeek=0,lastWrite=0;
  const storageKey=()=>account?'node.audius.library.v1.'+account.id:null;
  const error=message=>{el('sc-error').textContent=message||'';el('sc-error').hidden=!message;};
  const status=message=>{el('sc-status').textContent=message||'';};
  const clock=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return seconds>=3600?Math.floor(seconds/3600)+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'):Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
  function save(){
    if(!account)return;
    try{localStorage.setItem(storageKey(),JSON.stringify(state));}
    catch{error('Device storage is full or unavailable. Your library changes cannot be saved here.');}
  }
  function remember(){
    if(!account||mediaEpoch!==epoch||pendingSeek>0||state.index<0||!state.queue[state.index]||!audio.getAttribute('src'))return;
    const track=state.queue[state.index],position=Number.isFinite(audio.currentTime)?audio.currentTime:state.position;
    state.position=Math.max(0,position||0);
    const old=state.history.find(row=>row.track.id===track.id);
    if(audio.currentSrc||old)state.history=[{track,position:state.position,updated:Date.now()},...state.history.filter(row=>row.track.id!==track.id)].slice(0,200);
  }
  function stop(){remember();mediaEpoch=-1;pendingSeek=0;audio.pause();playVersion++;audio.removeAttribute('src');audio.load();el('sc-player').hidden=true;el('au-player-status').textContent='';save();}
  function button(label,callback,className='sc-button'){
    const node=document.createElement('button');node.type='button';node.className=className;node.textContent=label;node.addEventListener('click',callback);return node;
  }
  function profileUI(){
    el('sc-account-name').textContent=state.profile?'Audius: '+state.profile.name:'';
    el('sc-connect').hidden=!!state.profile;el('sc-disconnect').hidden=!state.profile;el('sc-connect').disabled=!!auth;
  }
  function controls(){
    el('sc-prev').disabled=state.index<=0;el('sc-next').disabled=!state.queue.length||(!repeat&&!shuffle&&state.index>=state.queue.length-1);
    el('sc-toggle').textContent=audio.paused?'Play':'Pause';el('sc-save-queue').disabled=!state.queue.length;el('sc-clear-queue').disabled=!state.queue.length;
    el('sc-shuffle').setAttribute('aria-pressed',String(shuffle));el('sc-repeat').setAttribute('aria-pressed',String(repeat));
  }
  function renderQueue(){
    el('sc-queue-empty').hidden=state.queue.length>0;
    el('sc-queue-list').replaceChildren(...state.queue.map((track,index)=>{
      const row=document.createElement('li');row.className='sc-queue-item';row.setAttribute('aria-current',String(index===state.index));
      const play=button(track.title,()=>playAt(index)),remove=button('Remove',()=>{
        if(index===state.index){stop();state.index=-1;state.position=0;}
        else if(index<state.index)state.index--;
        state.queue.splice(index,1);save();renderQueue();
      },'sc-button sc-remove');remove.setAttribute('aria-label','Remove '+track.title+' from queue');row.append(play,remove);return row;
    }));controls();
  }
  function add(track){
    const existing=state.queue.findIndex(item=>item.id===track.id);
    if(existing>=0)return existing;
    if(state.queue.length>=100){error('Your queue has 100 tracks. Remove one before adding another.');return -1;}
    state.queue.push(track);save();renderQueue();return state.queue.length-1;
  }
  async function playAt(index,position=0){
    const track=state.queue[index];if(!account||!track||!track.streamable)return;
    remember();audio.pause();const version=++playVersion,generation=epoch;
    state.index=index;state.position=Math.max(0,Number(position)||0);pendingSeek=state.position;
    mediaEpoch=epoch;
    el('sc-now-title').textContent=track.title+' — '+track.artist;el('sc-player').hidden=false;el('au-player-status').textContent='Loading track…';
    audio.src=api.stream(track.id);audio.volume=state.volume/100;audio.load();renderQueue();save();
    try{await audio.play();if(version!==playVersion||generation!==epoch)return;el('au-player-status').textContent='';}
    catch(failure){if(version===playVersion&&generation===epoch)el('au-player-status').textContent=failure.name==='NotAllowedError'?'Press Play to start this track.':'This track could not play. Retry Play or open it on Audius.';}
    controls();
  }
  function next(){
    if(!state.queue.length)return;
    let target=state.index+1;
    if(shuffle&&state.queue.length>1){const choices=state.queue.map((_,i)=>i).filter(i=>i!==state.index);target=choices[Math.floor(Math.random()*choices.length)];}
    if(target>=state.queue.length){if(!repeat)return;target=0;}
    playAt(target);
  }
  function row(item){
    const node=document.createElement('article');node.className='sc-row';
    const image=document.createElement('img');image.className='sc-cover';image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
    if(item.image){image.src=item.image;image.addEventListener('error',()=>{image.removeAttribute('src');});}else image.classList.add('au-no-cover');
    const copy=document.createElement('div'),actions=document.createElement('div');actions.className='sc-row-actions';
    if(item.kind==='track'){
      const play=()=>{const index=add(item);if(index>=0)playAt(index);};
      const title=button(item.title,play,'sc-title');title.disabled=!item.streamable;
      const artist=button(item.artist,()=>item.artistId&&openDetail({kind:'user',id:item.artistId,name:item.artist,url:'https://audius.co'}),'sc-artist');artist.disabled=!item.artistId;
      const meta=document.createElement('span');meta.className='sc-meta';
      const history=view==='history'?state.history.find(value=>value.track.id===item.id):null;
      meta.textContent=(history?'Resume '+clock(history.position)+' / ':'')+clock(item.duration)+(item.genre?' · '+item.genre:'')+(!item.streamable?' · Open on Audius':'');
      const queue=button('Queue',()=>{add(item);status('Added to Up next.');});queue.disabled=!item.streamable;
      const saved=state.saved.some(value=>value.id===item.id),saveButton=button(saved?'Saved':'Save',()=>{
        state.saved=saved?state.saved.filter(value=>value.id!==item.id):api.unique([item,...state.saved]).slice(0,300);save();if(view==='saved'&&!detail)localRows();else renderRows();
      });saveButton.setAttribute('aria-pressed',String(saved));saveButton.setAttribute('aria-label',(saved?'Remove ':'Save ')+item.title+(saved?' from':' to')+' your Node library');
      const playButton=button(history?'Resume':'Play',()=>{const index=add(item);if(index>=0)playAt(index,history?.position||0);},'sc-button sc-primary');playButton.disabled=!item.streamable;
      copy.append(title,artist,meta);actions.append(playButton,queue,saveButton);
      if(!item.streamable){const link=document.createElement('a');link.className='sc-external';link.textContent='Open on Audius';link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);}
    }else{
      const title=button(item.name||item.title,()=>openDetail(item),'sc-title'),meta=document.createElement('span');meta.className='sc-meta';
      meta.textContent=item.kind==='user'?(item.handle?'@'+item.handle:'Audius artist'):(item.artist||'Node playlist')+' · '+(item.count??item.tracks?.length??0)+' tracks';copy.append(title,meta);
      actions.append(button('Open',()=>openDetail(item)));
      if(item.kind==='local-playlist')actions.append(button('Delete',()=>{if(!window.confirm('Delete '+item.title+' from your Node library?'))return;state.playlists=state.playlists.filter(value=>value.id!==item.id);save();switchView('playlists');}));
    }
    node.append(image,copy,actions);return node;
  }
  function renderRows(){el('sc-results').replaceChildren(...rows.map(row));}
  function localRows(){
    if(view==='saved')rows=state.saved;
    else if(view==='history')rows=state.history.map(value=>value.track);
    else if(view==='playlists')rows=state.playlists;
    renderRows();status(rows.length?rows.length+' '+(view==='playlists'?'Node playlists':'tracks'):view==='saved'?'Save a track to find it here.':view==='history'?'Tracks you play will appear here.':'Save your queue to create your first playlist.');
  }
  async function list(append=false){
    if(!account)return;
    controller?.abort();clearTimeout(timer);controller=new AbortController();const signal=controller.signal,generation=epoch,request=++serial;
    timer=setTimeout(()=>controller?.abort(),12000);error('');el('sc-results').setAttribute('aria-busy','true');el('sc-more').disabled=true;
    const start=append?offset:0;status('Loading music…');
    try{
      let data,items,more;
      if(detail?.kind==='user')data=await api.read('/users/'+detail.id+'/tracks',{limit:20,offset:start},signal);
      else if(detail?.kind==='playlist')data=await api.read('/playlists/'+detail.id+'/tracks',{limit:20,offset:start},signal);
      else if(view==='library'){
        if(!state.profile){status('Connect Audius to browse your public favorites. Your Node saves are in Saved.');rows=[];renderRows();hasMore=false;return;}
        const result=await api.favorites(state.profile.id,start,signal);items=result.items;more=result.more;
      }else if(view==='following'){
        if(!state.profile){status('Connect Audius to see the artists you follow.');rows=[];renderRows();hasMore=false;return;}
        data=await api.read('/users/'+state.profile.id+'/following',{limit:20,offset:start},signal);
      }else if(view==='playlists'&&state.profile)data=await api.read('/users/'+state.profile.id+'/playlists',{limit:20,offset:start},signal);
      else if(view==='explore'&&query)data=await api.read('/'+kind+'/search',{query,limit:20,offset:start},signal);
      else data=await api.read('/tracks/trending',{limit:20,offset:start,time:'week'},signal);
      if(generation!==epoch||request!==serial)return;
      if(!items){
        const values=Array.isArray(data)?data:[];more=values.length===20;
        const normalize=detail?api.track:view==='following'||(view==='explore'&&query&&kind==='users')?api.artist:view==='playlists'||(view==='explore'&&query&&kind==='playlists')?api.playlist:api.track;
        items=api.unique(values.map(normalize));
      }
      rows=api.unique([...(append?rows:!detail&&view==='playlists'?state.playlists:[]),...items]);offset=start+20;hasMore=!!more;
      renderRows();status(rows.length?rows.length+' '+(detail?'tracks':view==='following'?'artists':view==='playlists'?'playlists':'results')+(view==='library'?' from your public Audius favorites':''):view==='playlists'?'No playlists yet. Save your queue to make one in Node.':'No results found. Try another search.');
    }catch(failure){if(generation===epoch&&request===serial){if(failure.name!=='AbortError')error(failure.message);else status('The request timed out. Try searching again.');}}
    finally{if(generation===epoch&&request===serial){clearTimeout(timer);el('sc-results').setAttribute('aria-busy','false');el('sc-more').disabled=false;el('sc-more').hidden=!hasMore;}}
  }
  function switchView(nextView){
    serial++;controller?.abort();clearTimeout(timer);view=nextView;detail=null;offset=0;hasMore=false;rows=[];
    error('');renderRows();el('sc-detail').hidden=true;el('sc-more').hidden=true;el('sc-results').setAttribute('aria-busy','false');
    for(const node of area.querySelectorAll('[data-au-view]'))node.setAttribute('aria-current',node.dataset.auView===view?'page':'false');
    const titles={explore:query?'Results for “'+query+'”':'Discover your next favorite.',saved:'Saved in Node',playlists:'Your playlists',library:'Your Audius library',following:'Artists you follow',history:'Listening history'};
    el('sc-heading').textContent=titles[view]||'Music';el('sc-filters').hidden=view!=='explore';el('sc-intro').hidden=view!=='explore';
    if(['saved','history'].includes(view)||(view==='playlists'&&!state.profile)){localRows();return;}
    list();
  }
  function openDetail(item){
    if(item.kind==='local-playlist'){
      if(!item.tracks.length)return;stop();state.queue=item.tracks.slice(0,100);state.index=-1;state.position=0;save();renderQueue();playAt(0);return;
    }
    if(!api.validId(item.id))return;detail=item;rows=[];offset=0;hasMore=false;el('sc-detail').hidden=false;
    el('sc-detail-title').textContent=item.name||item.title;el('sc-detail-description').textContent=item.bio||item.description||'';el('sc-detail-link').href=api.url(item.url)||'https://audius.co';el('sc-detail-title').focus();list();
  }
  function closeLogin(){clearInterval(popupTimer);popupTimer=null;popup?.close();popup=null;auth=null;profileUI();}
  async function connect(){
    if(!account||auth)return;error('');const generation=epoch;
    popup=window.open('about:blank','nodeAudiusProfile','popup,width=520,height=720');
    if(!popup){error('Allow pop-ups for Node, then select Connect Audius again.');return;}
    try{
      const request=await api.loginRequest(new URL('audius-callback.html',location.href).href);
      if(generation!==epoch||!popup){closeLogin();return;}
      auth={...request,owner:account.id,generation,expires:Date.now()+300000};profileUI();popup.location.replace(request.url);
      popupTimer=setInterval(()=>{if(!auth)return;if(Date.now()>auth.expires){closeLogin();error('Audius sign-in timed out. Select Connect Audius to retry.');}else if(popup?.closed){closeLogin();status('Audius sign-in closed. You can reconnect at any time.');}},500);
    }catch{closeLogin();error('Audius sign-in could not start. Please retry.');}
  }
  window.addEventListener('message',async event=>{
    if(!auth||event.origin!==location.origin||event.source!==popup||event.data?.type!=='node-audius-oauth')return;
    if(event.data.state!==auth.state||auth.owner!==account?.id||auth.generation!==epoch||Date.now()>auth.expires)return;
    const request=auth,generation=epoch,code=event.data.code;closeLogin();
    if(event.data.error){error('Audius sign-in was not completed. Please retry when ready.');return;}
    if(typeof code!=='string'||!code||code.length>4096){error('Audius returned an invalid sign-in response. Please reconnect.');return;}
    el('sc-connect').disabled=true;
    try{const profile=await api.exchange(code,request);if(generation!==epoch)return;state.profile=profile;save();profileUI();switchView('library');}
    catch(failure){if(generation===epoch)error(failure.message||'Audius sign-in failed. Please reconnect.');}
    finally{if(generation===epoch)profileUI();}
  });
  el('sc-connect').addEventListener('click',connect);
  el('sc-disconnect').addEventListener('click',()=>{closeLogin();state.profile=null;save();profileUI();switchView('explore');});
  for(const node of area.querySelectorAll('[data-au-view]'))node.addEventListener('click',()=>switchView(node.dataset.auView));
  for(const node of area.querySelectorAll('[data-au-kind]'))node.addEventListener('click',()=>{kind=node.dataset.auKind;for(const button of area.querySelectorAll('[data-au-kind]'))button.setAttribute('aria-pressed',String(button===node));if(query)switchView('explore');});
  el('sc-search-form').addEventListener('submit',event=>{event.preventDefault();query=el('sc-query').value.trim().slice(0,120);if(query)switchView('explore');});
  el('sc-more').addEventListener('click',()=>list(true));el('sc-back').addEventListener('click',()=>switchView(view));
  el('sc-prev').addEventListener('click',()=>{if(state.index>0)playAt(state.index-1);});el('sc-next').addEventListener('click',next);
  el('sc-toggle').addEventListener('click',async()=>{if(state.index<0)return;if(!audio.getAttribute('src')||audio.error)return playAt(state.index,state.position);if(audio.paused){try{await audio.play();el('au-player-status').textContent='';}catch{el('au-player-status').textContent='Playback was blocked. Open this track on Audius or retry Play.';}}else audio.pause();controls();});
  el('sc-close-player').addEventListener('click',stop);
  el('sc-volume').addEventListener('input',()=>{state.volume=Math.max(0,Math.min(100,Number(el('sc-volume').value)||0));audio.volume=state.volume/100;save();});
  el('sc-shuffle').addEventListener('click',()=>{shuffle=!shuffle;controls();});el('sc-repeat').addEventListener('click',()=>{repeat=!repeat;controls();});
  el('sc-clear-queue').addEventListener('click',()=>{stop();state.queue=[];state.index=-1;state.position=0;save();renderQueue();});
  el('sc-save-queue').addEventListener('click',()=>{if(!state.queue.length)return;el('sc-playlist-error').textContent='';el('sc-playlist-dialog').showModal();});
  el('sc-playlist-cancel').addEventListener('click',()=>el('sc-playlist-dialog').close());
  el('sc-playlist-form').addEventListener('submit',event=>{event.preventDefault();const title=el('sc-playlist-title').value.trim();if(!title||!state.queue.length)return;
    if(state.playlists.length>=50){el('sc-playlist-error').textContent='Your Node library has 50 playlists. Delete one before saving another.';return;}
    state.playlists.unshift({kind:'local-playlist',id:'local-'+crypto.randomUUID(),title:title.slice(0,100),artist:'Saved in Node',tracks:state.queue.slice(),count:state.queue.length,image:state.queue[0]?.image||''});save();el('sc-playlist-dialog').close();el('sc-playlist-title').value='';switchView('playlists');
  });
  audio.addEventListener('loadedmetadata',()=>{if(mediaEpoch!==epoch)return;if(pendingSeek&&Number.isFinite(audio.duration))audio.currentTime=Math.min(pendingSeek,audio.duration);pendingSeek=0;el('au-duration').textContent=clock(audio.duration);});
  audio.addEventListener('timeupdate',()=>{if(!account||mediaEpoch!==epoch||state.index<0)return;el('au-elapsed').textContent=clock(audio.currentTime);el('au-seek').value=String(Number.isFinite(audio.duration)&&audio.duration>0?audio.currentTime/audio.duration*100:0);if(Date.now()-lastWrite>5000){remember();save();lastWrite=Date.now();}});
  el('au-seek').addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Number(el('au-seek').value)/100*audio.duration;remember();save();}});
  audio.addEventListener('playing',()=>{if(mediaEpoch!==epoch)return;el('au-player-status').textContent='';remember();save();controls();});audio.addEventListener('pause',()=>{remember();save();controls();});
  audio.addEventListener('waiting',()=>{if(mediaEpoch===epoch)el('au-player-status').textContent='Buffering audio…';});audio.addEventListener('error',()=>{if(mediaEpoch===epoch&&audio.getAttribute('src'))el('au-player-status').textContent='This track is unavailable or restricted. Try another track or open it on Audius.';});
  audio.addEventListener('ended',()=>{if(mediaEpoch!==epoch)return;remember();save();if(active)next();});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>area.style.setProperty('--sc-player-height',el('sc-player').hidden?'0px':el('sc-player').getBoundingClientRect().height+'px')).observe(el('sc-player'));
  window.addEventListener('pagehide',()=>{remember();save();});
  return {
    onAccount(nextAccount){
      remember();save();stop();closeLogin();epoch++;serial++;controller?.abort();clearTimeout(timer);account=nextAccount?{...nextAccount,id:nextAccount.id??'name:'+nextAccount.name.normalize('NFKC').toLowerCase()}:null;state=blank();view='explore';kind='tracks';query='';rows=[];detail=null;loaded=false;shuffle=repeat=false;
      if(account)try{
        const stored=JSON.parse(localStorage.getItem(storageKey())||'{}');
        state.queue=api.unique((stored.queue||[]).map(api.track)).slice(0,100);state.saved=api.unique((stored.saved||[]).map(api.track)).slice(0,300);
        state.history=(stored.history||[]).filter(value=>api.track(value.track)&&Number.isFinite(value.updated)&&Number.isFinite(value.position)).map(value=>({track:api.track(value.track),position:Math.max(0,value.position),updated:value.updated})).slice(0,200);
        state.playlists=(stored.playlists||[]).filter(value=>value.kind==='local-playlist'&&typeof value.id==='string'&&typeof value.title==='string'&&Array.isArray(value.tracks)).slice(0,50).map(value=>({...value,title:value.title.slice(0,100),image:api.url(value.image,true),tracks:api.unique(value.tracks.map(api.track)).slice(0,100)}));
        state.index=Number.isInteger(stored.index)&&stored.index>=0&&stored.index<state.queue.length?stored.index:-1;state.position=Number.isFinite(stored.position)?Math.max(0,stored.position):0;
        state.volume=Number.isFinite(stored.volume)?Math.max(0,Math.min(100,stored.volume)):75;
        if(stored.profile&&api.validId(stored.profile.id))state.profile=api.artist({id:stored.profile.id,name:stored.profile.name,handle:stored.profile.handle});
      }catch{}
      el('sc-query').value='';el('sc-now-title').textContent='';el('sc-detail').hidden=true;el('sc-detail-title').textContent='';el('sc-detail-description').textContent='';el('sc-detail-link').href='https://audius.co';el('sc-results').replaceChildren();el('sc-more').hidden=true;el('sc-player').hidden=true;el('sc-playlist-title').value='';el('sc-playlist-error').textContent='';if(el('sc-playlist-dialog').open)el('sc-playlist-dialog').close();
      el('sc-volume').value=String(state.volume);audio.volume=state.volume/100;el('au-seek').value='0';el('au-elapsed').textContent='0:00';el('au-duration').textContent='0:00';error('');status('');profileUI();renderQueue();
      for(const node of area.querySelectorAll('[data-au-kind]'))node.setAttribute('aria-pressed',String(node.dataset.auKind==='tracks'));
      if(active&&account){loaded=true;switchView('explore');}
    },
    onNavigate(which){active=which==='soundcloud';if(active&&account&&!loaded){loaded=true;switchView('explore');}else if(!active){remember();audio.pause();save();}}
  };
})();
// Keep the established navigation hook compatible with already-open Node pages.
window.NodeSoundCloud=window.NodeAudius;
