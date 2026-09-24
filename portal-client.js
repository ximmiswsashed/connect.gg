/* connect.gg accounts and Imposter. All authorization/roles live on the server. */
window.ConnectPortal = (() => {
  const el=id=>document.getElementById(id);
  let token='',user=null,registering=false,room=null,revealed=false,poll=null,pollBusy=false,generation=0;
  const base=(window.CONNECT_API||'').replace(/\/$/,'');
  async function api(path,body,method='POST') {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(base+path,{method,cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        ...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
      let data;
      try {data=await response.json();}catch(_){throw new Error('The server needs an update. Please try again shortly.');}
      if(!response.ok){const error=new Error(data.error||'Please try again.');error.status=response.status;error.retryAfter=data.retryAfter;throw error;}
      return data;
    } catch(error) { if(error.name==='AbortError'||error instanceof TypeError)throw new Error('The server is offline. Try again shortly.');throw error; }
    finally {clearTimeout(timer);}
  }
  function secretOff(){revealed=false;el('game-secret').textContent='';el('game-secret').hidden=true;el('game-reveal').textContent='Reveal';el('game-secret').classList.remove('imposter');}
  function message(text){el('game-message').textContent=text;}
  let chatKey='';
  function renderChat(next){
    const messages=next.messages||[],key=next.code+':'+messages.map(m=>m.id).join(',');
    if(key===chatKey)return;
    const log=el('game-chat-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60,newRoom=!chatKey.startsWith(next.code+':');
    chatKey=key;
    log.replaceChildren(...messages.map(m=>{
      const row=document.createElement('p'),name=document.createElement('strong'),text=document.createElement('span');
      name.textContent=m.name;name.style.color=m.color;text.textContent=m.text;row.append(name,text);return row;
    }));
    el('game-chat-empty').hidden=messages.length>0;
    if(atBottom||newRoom)log.scrollTop=log.scrollHeight;
  }
  function render(next) {
    if(!room||room.code!==next.code){el('game-chat-input').value='';el('game-chat-error').textContent='';chatKey='';}
    if(!room||room.round!==next.round||room.phase!==next.phase)secretOff();
    room=next;el('game-entry').hidden=true;el('game-room').hidden=false;
    el('lobby-code').textContent=room.code;el('game-player-name').textContent=user.name;
    el('game-players').replaceChildren(...room.players.map(player=>{const item=document.createElement('li');item.textContent=player.name+(player.host?' · Host':'');item.style.color=player.color;return item;}));
    el('game-player-name').style.color=room.players.find(p=>p.name===user.name)?.color||'';
    renderChat(room);
    el('game-topic').hidden=!room.host;document.querySelector('label[for="game-topic"]').hidden=!room.host;
    el('game-topic').value=room.host?room.topic:'';el('game-topic').disabled=!room.host||room.phase!=='waiting';
    el('game-start').hidden=!room.host||room.phase!=='waiting';el('game-start').disabled=room.players.length<3;
    el('game-end').hidden=!room.host||room.phase==='waiting';
    el('game-countdown').hidden=room.phase!=='countdown';el('game-countdown').textContent=room.countdown||'';
    el('game-card').hidden=room.phase!=='playing';
    el('game-instructions').textContent=room.phase==='waiting'?'Invite at least 3 players. Share the code to join.':room.phase==='countdown'?'Get ready…':'Take turns giving a clue. Who is the imposter?';
  }
  async function refresh(){
    if(pollBusy||!room||!token)return;
    pollBusy=true;const current=generation;
    try {const next=await api('/api/lobby/state');if(current===generation)render(next);}
    catch(error){if(current!==generation)return;secretOff();message(error.message);if(error.status===404){room=null;el('game-entry').hidden=false;el('game-room').hidden=true;}if(error.status===401){logout();document.getElementById('logout-btn').click();}}
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
    if(which==='computers'&&!user?.admin)return;
    el('desktop-area').hidden=which!=='computers';el('game-area').hidden=which!=='game';
    document.body.classList.remove('nav-open');secretOff();
    el('nav-computers').setAttribute('aria-current',which==='computers'?'page':'false');
    el('nav-game').setAttribute('aria-current',which==='game'?'page':'false');
  }
  async function login(name,password) {
    if(registering){await api('/api/register',{name,password});}
    const result=await api('/api/login',{name,password});token=result.token;user=result.user;generation++;
    el('signed-in-name').textContent=user.name+(user.admin?' · Admin':'');el('nav-computers').hidden=!user.admin;
    const topics=await api('/api/topics',null,'GET');
    el('game-topic').replaceChildren(...topics.topics.map(topic=>{const option=document.createElement('option');option.value=option.textContent=topic;return option;}));
    view(user.admin?'computers':'game');clearInterval(poll);poll=setInterval(refresh,750);
    try {render(await api('/api/lobby/state'));} catch(error) {if(error.status!==404)message(error.message);}
    return user;
  }
  function logout(){generation++;clearInterval(poll);poll=null;api('/api/logout').catch(()=>{});token='';user=null;room=null;secretOff();el('game-entry').hidden=false;el('game-room').hidden=true;}
  el('account-toggle').addEventListener('click',()=>{
    registering=!registering;el('account-submit').textContent=registering?'Create account':'Sign in';
    el('account-toggle').textContent=registering?'Already a member? Sign in':'New here? Create an account';
    el('account-password').autocomplete=registering?'new-password':'current-password';
    el('account-password').minLength=registering?8:1;el('account-error').classList.remove('visible');
  });
  el('menu-toggle').addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');el('menu-toggle').setAttribute('aria-expanded',String(open));});
  el('nav-computers').addEventListener('click',()=>view('computers'));el('nav-game').addEventListener('click',()=>view('game'));
  el('game-create').addEventListener('click',()=>action('create'));
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
      el('game-secret').textContent=role.imposter?'IMPOSTER · Hint word: '+role.hint:role.word;
      el('game-secret').classList.toggle('imposter',role.imposter);el('game-secret').hidden=false;revealed=true;el('game-reveal').textContent='Hide';
    }catch(error){message(error.message);}finally{el('game-reveal').disabled=false;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)secretOff();});
  return {login,logout,view};
})();
