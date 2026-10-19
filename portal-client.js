/* Node accounts and Imposter. All authorization/roles live on the server. */
window.ConnectPortal = (() => {
  const el=id=>document.getElementById(id);
  let token='',user=null,registering=false,room=null,revealed=false,poll=null,pollBusy=false,generation=0,refreshFailures=0,connectionNotice=false;
  const base=(window.CONNECT_API||'').replace(/\/$/,'');
  async function api(path,body,method='POST',timeout=12000) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const response=await fetch(base+path,{method,cache:'no-store',signal:controller.signal,keepalive:path==='/api/youtube/progress',
        headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        ...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
      let data;
      try {data=await response.json();}catch(_){throw new Error('The server needs an update. Please try again shortly.');}
      if(!response.ok){const error=new Error(data.error||'Please try again.');error.status=response.status;error.retryAfter=data.retryAfter;throw error;}
      return data;
    } catch(error) {
      if(error.name==='AbortError')throw new Error('Connection timed out. Retrying…');
      if(error instanceof TypeError)throw new Error('Cannot reach the home bridge. Check the launcher and Tailscale.');
      throw error;
    }
    finally {clearTimeout(timer);}
  }
  function secretOff(){revealed=false;el('game-secret').textContent='';el('game-secret').hidden=true;el('game-reveal').textContent='Reveal';el('game-reveal').setAttribute('aria-expanded','false');el('game-secret').classList.remove('imposter');el('game-card').classList.remove('is-revealed');}
  function message(text){el('game-message').textContent=text;}
  let chatKey='',lastTyped=0;
  function presence(){
    const log=el('game-chat-log'),visible=!document.hidden&&!el('game-area').hidden&&log.scrollHeight-log.scrollTop-log.clientHeight<24;
    return {read:visible?(room?.messages?.at(-1)?.id||0):0,typing:visible&&!!el('game-chat-input').value.trim()&&Date.now()-lastTyped<2000};
  }
  function renderChat(next){
    el('typing-names').textContent=(next.typing||[]).join(', ')+((next.typing||[]).length>1?' are typing':' is typing');
    el('game-typing').hidden=!(next.typing||[]).length;
    const messages=next.messages||[],key=next.code+':'+messages.map(m=>m.id).join(',')+JSON.stringify(next.readers||[]);
    if(key===chatKey)return;
    const log=el('game-chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60,newRoom=!chatKey.startsWith(next.code+':');
    chatKey=key;
    log.replaceChildren(...messages.map((m,index)=>{
      const row=document.createElement('p'),name=document.createElement('strong'),text=document.createElement('span');
      name.textContent=m.name;name.style.color=m.color;text.textContent=m.text;row.append(name,text);
      const readers=(next.readers||[]).filter(p=>p.read>=m.id&&p.name!==m.name).map(p=>p.name);
      if(index===messages.length-1&&readers.length){const seen=document.createElement('small');seen.textContent='Seen by '+readers.join(', ');row.append(seen);}return row;
    }));
    el('game-chat-empty').hidden=messages.length>0;
    if(atBottom||newRoom)log.scrollTop=log.scrollHeight;
  }
  function render(next) {
    const phaseChanged=!room||room.phase!==next.phase||room.round!==next.round||room.code!==next.code;
    if(!room||room.code!==next.code){el('game-chat-input').value='';el('game-chat-error').textContent='';chatKey='';}
    if(!room||room.round!==next.round||room.phase!==next.phase)secretOff();
    room=next;el('game-entry').hidden=true;el('game-room').hidden=false;
    el('game-room').setAttribute('data-phase',room.phase);
    el('lobby-code').textContent=room.code;el('game-player-name').textContent=user.name;
    const players=el('game-players'),playerKey=JSON.stringify(room.players.map(p=>[p.id,p.name,p.color,p.host]));
    if(players._playerKey!==playerKey){
      players._playerKey=playerKey;
      players.replaceChildren(...room.players.map(player=>{
        const item=document.createElement('li'),avatar=document.createElement('span'),name=document.createElement('span');
        avatar.className='player-avatar';avatar.textContent=player.name.slice(0,1).toUpperCase();avatar.setAttribute('aria-hidden','true');
        avatar.style.color=player.color;name.textContent=player.name;
        item.append(avatar,name);item.style.color=player.color;
        if(player.host){const badge=document.createElement('small');badge.textContent='Host';item.append(badge);}
        return item;
      }));
    }
    el('game-player-name').style.color=room.players.find(p=>p.name===user.name)?.color||'';
    renderChat(room);
    el('game-topic').hidden=!room.host;document.querySelector('label[for="game-topic"]').hidden=!room.host;
    el('game-topic').value=room.host?room.topic:'';el('game-topic').disabled=!room.host||room.phase!=='waiting';
    el('game-start').hidden=!room.host||room.phase!=='waiting';el('game-start').disabled=room.players.length<3;
    el('game-end').hidden=!room.host||room.phase==='waiting';
    const countdown=el('game-countdown'),count=String(room.countdown||'');
    countdown.hidden=room.phase!=='countdown';
    if(countdown.textContent!==count){countdown.textContent=count;animate(countdown,[{opacity:0,transform:'scale(1.35)'},{opacity:1,transform:'scale(1)'}],420);}
    el('game-phase-label').textContent={waiting:'Lobby open',countdown:'Get ready',playing:'Round in play',voting:'Voting',result:'Round complete'}[room.phase]||'';
    el('game-role-idle').hidden=['playing','countdown'].includes(room.phase);
    el('game-stage-title').textContent=room.phase==='voting'?'Make your call.':room.phase==='result'?'The truth is out.':'Your secret awaits.';
    el('game-stage-copy').textContent=room.phase==='voting'?'Trust the clues. Lock in your vote.':room.phase==='result'?'Ready for another round?':'When the round starts, only you can see your card.';
    el('game-card').hidden=room.phase!=='playing';
    el('game-vote-ready').hidden=room.phase!=='playing';el('game-vote-ready').disabled=room.voteReady;
    el('game-vote-ready').textContent=room.voteReady?`${room.voteReadyCount||0}/${room.players.length} players want to vote…`:'Ready to vote';
    el('game-voting').hidden=room.phase!=='voting';
    const select=el('game-vote-choice'),choices=JSON.stringify([room.code,room.round,room.players.map(p=>[p.id,p.name,p.color])]);
    if(select._choices!==choices){select._choices=choices;
      select.value='';
      el('game-ballots').replaceChildren(...room.players.map(p=>{
        const label=document.createElement('label'),input=document.createElement('input'),face=document.createElement('span'),name=document.createElement('span'),check=document.createElement('span');
        label.className='ballot';input.type='radio';input.name='imposter-ballot';input.value=String(p.id);
        face.className='ballot-avatar';face.style.color=p.color;face.textContent=p.name.slice(0,1).toUpperCase();face.setAttribute('aria-hidden','true');
        name.className='ballot-name';name.textContent=p.name;check.className='ballot-check';check.setAttribute('aria-hidden','true');
        input.addEventListener('change',()=>{select.value=input.value;el('game-vote-lock').disabled=false;el('game-vote-lock').textContent='Lock vote for '+p.name;});
        label.append(input,face,name,check);return label;
      }));
    }
    for(const input of el('game-ballots').querySelectorAll?.('input')||[])input.disabled=!!room.voteLocked;
    el('game-voting').classList.toggle('is-locked',!!room.voteLocked);
    el('game-vote-lock').disabled=!!room.voteLocked||!select.value;
    if(room.voteLocked)el('game-vote-lock').textContent='Vote sealed';else if(!select.value)el('game-vote-lock').textContent='Choose a player';
    el('game-vote-count').textContent=`${room.lockedCount||0} / ${room.players.length} locked`;
    el('game-vote-progress').max=room.players.length;el('game-vote-progress').value=room.lockedCount||0;
    const voteStatus=room.voteLocked?'Your vote is sealed. Waiting for the others…':'Your vote stays private until everyone has locked in.';
    if(el('game-vote-status').textContent!==voteStatus)el('game-vote-status').textContent=voteStatus;
    el('game-result').hidden=room.phase!=='result';
    if(room.phase==='result'){
      el('game-result').classList.toggle('imposter-won',room.result.winner!=='players');
      el('game-result-title').textContent=room.result.winner==='players'?'Caught in the act.':'The imposter fooled you.';
      el('game-result-copy').textContent=room.result.imposter+' was the imposter. '+(room.result.winner==='players'?'Players win!':'Imposter wins!')+(room.result.tie?' The vote was tied.':'');
      if(phaseChanged)el('game-result-votes').replaceChildren(...(room.result.votes||[]).map(vote=>{
        const row=document.createElement('div'),name=document.createElement('span'),bar=document.createElement('progress'),count=document.createElement('span');
        name.textContent=vote.name;bar.max=room.players.length;bar.value=vote.count;bar.setAttribute('aria-label',vote.name+' votes');count.textContent=String(vote.count);row.append(name,bar,count);return row;
      }));
    }
    el('game-instructions').textContent=room.phase==='waiting'?'Invite at least 3 players. Share the code to join.':room.phase==='countdown'?'Get ready…':room.phase==='voting'?'Everyone locks in one vote. A majority must identify the imposter.':room.phase==='result'?'Round complete. The host can end this round to play again.':'Take turns giving a clue. Who is the imposter?';
    if(phaseChanged&&['playing','voting','result'].includes(room.phase))animate(
      el(room.phase==='result'?'game-result':room.phase==='voting'?'game-voting':'game-card'),
      [{opacity:.35,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],600);
  }
  function animate(node,frames,duration){
    if(!node.animate||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    node.animate(frames,{duration,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  async function refresh(){
    if(pollBusy||!room||!token)return;
    pollBusy=true;const current=generation;
    try {const next=await api('/api/lobby/state',presence(),'POST',6000);if(current===generation){refreshFailures=0;if(connectionNotice){message('');connectionNotice=false;}if(el('game-area').hidden||document.body.classList.contains('viewing-desktop'))room=next;else render(next);}}
    catch(error){
      if(current!==generation)return;
      if(!error.status){
        refreshFailures++;
        if(refreshFailures<2)return;
        message(error.message);connectionNotice=true;
        return;
      }
      refreshFailures=0;secretOff();message(error.message);
      if(error.status===404){room=null;el('game-entry').hidden=false;el('game-room').hidden=true;}
      if(error.status===401){logout();document.getElementById('logout-btn').click();}
    }
    finally{pollBusy=false;}
  }
  async function action(name,data={}) {
    const current=generation;message('');
    try {const next=await api('/api/lobby/'+name,data);if(current!==generation)return;
      if(name==='leave'){room=null;secretOff();el('game-entry').hidden=false;el('game-room').hidden=true;}
      else render(next);
    }catch(error){message(error.message);}
  }
  function view(which){
    el('desktop-area').hidden=which!=='computers';el('game-area').hidden=which!=='game';el('youtube-area').hidden=which!=='youtube';
    document.body.classList.toggle('playing-imposter',which==='game');
    document.body.classList.toggle('browsing-youtube',which==='youtube');
    document.body.classList.remove('nav-open');secretOff();
    el('nav-computers').setAttribute('aria-current',which==='computers'?'page':'false');
    el('nav-game').setAttribute('aria-current',which==='game'?'page':'false');
    el('nav-youtube').setAttribute('aria-current',which==='youtube'?'page':'false');
    window.NodeYouTube?.onNavigate(which);
  }
  async function login(name,password) {
    if(registering){await api('/api/register',{name,password});}
    const result=await api('/api/login',{name,password});window.NodeYouTube?.onAccount(null);token=result.token;user=result.user;generation++;
    window.NodeYouTube?.onAccount(user);
    el('signed-in-name').textContent=user.name+(user.admin?' · Admin':'');el('nav-computers').hidden=false;
    const topics=await api('/api/topics',null,'GET');
    el('game-topic').replaceChildren(...topics.topics.map(topic=>{const option=document.createElement('option');option.value=option.textContent=topic;return option;}));
    view(user.admin?'computers':'game');clearInterval(poll);poll=setInterval(refresh,750);
    try {render(await api('/api/lobby/state'));} catch(error) {if(error.status!==404)message(error.message);}
    document.body.classList.add('node-signed-in');
    document.body.classList.remove('node-menu-hidden');
    el('node-panel-toggle').setAttribute('aria-expanded','true');
    el('node-panel-toggle').setAttribute('aria-label','Hide Node menu');
    return user;
  }
  function logout(){window.NodeYouTube?.onAccount(null);generation++;clearInterval(poll);poll=null;api('/api/logout').catch(()=>{});token='';user=null;room=null;secretOff();el('game-entry').hidden=false;el('game-room').hidden=true;document.body.classList.remove('node-signed-in','node-menu-hidden','browsing-youtube','playing-imposter');window.NodeYouTube?.onNavigate('');}
  el('account-toggle').addEventListener('click',()=>{
    registering=!registering;el('account-submit').textContent=registering?'Create account':'Sign in';
    el('account-title').textContent=registering?'Make yourself at home.':'Welcome back.';
    el('account-toggle').textContent=registering?'Already a member? Sign in':'New here? Create an account';
    el('account-password').autocomplete=registering?'new-password':'current-password';
    el('account-password').minLength=registering?8:1;el('account-error').classList.remove('visible');
  });
  el('menu-toggle').addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');el('menu-toggle').setAttribute('aria-expanded',String(open));});
  el('node-panel-toggle').addEventListener('click',()=>{
    const hidden=document.body.classList.toggle('node-menu-hidden');
    el('node-panel-toggle').setAttribute('aria-expanded',String(!hidden));
    el('node-panel-toggle').setAttribute('aria-label',hidden?'Show Node menu':'Hide Node menu');
  });
  function navigate(which){view(which);window.transitionTo?.(el('dashboard-page'));window.scrollTo?.(0,0);}
  el('nav-computers').addEventListener('click',()=>navigate('computers'));el('nav-game').addEventListener('click',()=>navigate('game'));el('nav-youtube').addEventListener('click',()=>navigate('youtube'));
  el('game-create').addEventListener('click',()=>action('create'));
  el('game-chat-input').addEventListener('input',()=>{lastTyped=Date.now();});
  el('game-vote-ready').addEventListener('click',()=>action('ready_vote',{round:room?.round}));
  el('game-vote-lock').addEventListener('click',()=>action('vote',{round:room?.round,player:Number(el('game-vote-choice').value)}));
  el('rdp-info-toggle').addEventListener('click',()=>{const open=el('rdp-overlay').classList.toggle('info-open');el('rdp-info-toggle').setAttribute('aria-expanded',String(open));el('rdp-info-toggle').textContent=open?'▴':'▾';el('rdp-info-toggle').setAttribute('aria-label',open?'Hide controls':'Show controls');});
  el('game-chat-form').addEventListener('submit',async event=>{
    event.preventDefault();const input=el('game-chat-input'),button=el('game-chat-send'),text=input.value.trim();
    if(!text||button.disabled)return;
    const current=generation,code=room?.code;button.disabled=true;el('game-chat-error').textContent='';
    try {const next=await api('/api/lobby/chat',{text});if(current!==generation||room?.code!==code)return;
      render(next);if(input.value.trim()===text)input.value='';el('game-chat-log').scrollTop=el('game-chat-log').scrollHeight;
    }catch(error){if(current===generation)el('game-chat-error').textContent=error.message;}
    finally{button.disabled=false;}
  });
  el('game-join-form').addEventListener('submit',event=>{event.preventDefault();action('join',{code:el('game-code').value});});
  el('game-topic').addEventListener('change',()=>action('topic',{topic:el('game-topic').value}));
  el('game-start').addEventListener('click',()=>action('start'));el('game-end').addEventListener('click',()=>action('end'));el('game-leave').addEventListener('click',()=>action('leave'));
  el('game-reveal').addEventListener('click',async()=>{
    if(revealed){secretOff();return;}
    const current=generation,round=room?.round;el('game-reveal').disabled=true;
    try {const role=await api('/api/lobby/reveal');if(current!==generation||room?.round!==round||room.phase!=='playing')return;
      const title=document.createElement('strong');title.textContent=role.imposter?'IMPOSTER':role.word;
      const detail=document.createElement('span');detail.textContent=role.imposter?'Hint word: '+role.hint:'Your word. Play it cool.';
      el('game-secret').replaceChildren(title,detail);
      el('game-secret').classList.toggle('imposter',role.imposter);el('game-secret').hidden=false;revealed=true;el('game-reveal').textContent='Hide';
      el('game-card').classList.add('is-revealed');el('game-reveal').setAttribute('aria-expanded','true');
      animate(el('game-secret'),[{opacity:0,transform:'perspective(700px) rotateX(-28deg) translateY(16px)',clipPath:'inset(0 0 100% 0)'},{opacity:1,transform:'perspective(700px) rotateX(0) translateY(0)',clipPath:'inset(0 0 0 0)'}],600);
    }catch(error){message(error.message);}finally{el('game-reveal').disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)secretOff();});
  // Brief feedback for normal UI clicks; desktop input never enters this path.
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');
    if(!button||button.disabled||button.closest('#rdp-overlay')||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    if(!button.matches('.btn-login,.pc-action,.btn-logout'))return;
    const rect=button.getBoundingClientRect(),wave=document.createElement('span');wave.className='click-wave';wave.setAttribute('aria-hidden','true');
    wave.style.setProperty('--wave-x',(event.detail?event.clientX-rect.left:rect.width/2)+'px');
    wave.style.setProperty('--wave-y',(event.detail?event.clientY-rect.top:rect.height/2)+'px');
    button.append(wave);setTimeout(()=>wave.remove(),650);
  });
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('motion-paused',document.hidden));
  return {login,logout,view,request:(path,data)=>{
    if(!token||!path.startsWith('/api/youtube/'))return Promise.reject(new Error('Please sign in again.'));
    return api(path,data,'POST',16000);
  }};
})();
