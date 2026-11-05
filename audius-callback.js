(()=>{
  const params=new URLSearchParams(location.hash.slice(1)),state=params.get('state'),code=params.get('code'),failure=params.get('error');
  history.replaceState(null,'',location.pathname);
  const status=document.getElementById('callback-status');
  if(window.opener&&/^[a-zA-Z0-9_-]{43}$/.test(state||'')&&((code&&code.length<=4096)||failure)){
    window.opener.postMessage({type:'node-audius-oauth',state,code:code||'',error:!!failure},location.origin);status.textContent='You can return to Node. This window will close.';setTimeout(()=>window.close(),300);
  }else status.textContent='This connection expired. Return to Node and select Connect Audius again.';
  document.getElementById('callback-close').addEventListener('click',()=>window.close());
})();
