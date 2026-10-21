/* Keep the GPU-heavy game out of remote viewing, YouTube and Imposter. */
window.NodeShooter=(()=>{
 const el=id=>document.getElementById(id),frame=el('shooter-frame'),launch=el('shooter-launch'),status=el('shooter-load-status');
 let active=false,version=0,controller=null;
 const url=new URL('./oregon/index.html',window.location.href);
 function exit(){if(document.fullscreenElement===el('shooter-viewport'))void document.exitFullscreen().catch(()=>{});version++;controller?.abort();controller=null;frame.src='about:blank';el('shooter-session').hidden=true;el('shooter-intro').hidden=false;launch.disabled=false;launch.textContent='Play now';status.textContent='';}
 launch.addEventListener('click',async()=>{
  if(!active||launch.disabled)return;
  const current=++version,requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),20000);
  launch.disabled=true;launch.textContent='Loading…';status.textContent='Checking game files…';
  try{
   const response=await fetch(url,{cache:'no-cache',signal:requestController.signal,credentials:'omit'});
   if(!response.ok||!(await response.text()).includes('id="game"'))throw new Error('The game files are not available yet. Try again after the website update finishes.');
   if(current!==version||!active)return;
   el('shooter-intro').hidden=true;el('shooter-session').hidden=false;
   frame.src=url.href;frame.focus();
  }catch(error){if(current===version){status.textContent=error.name==='AbortError'?'The download timed out. Check your connection, then try again.':error instanceof TypeError?'Cannot reach the game files. Check your connection, then try again.':error.message;launch.disabled=false;launch.textContent='Try again';}}
  finally{clearTimeout(timer);}
 });
 el('shooter-exit').addEventListener('click',()=>{exit();launch.focus();});
 async function captureEscape(){if(document.fullscreenElement!==el('shooter-viewport'))return;try{await navigator.keyboard?.lock(['Escape']);}catch(_){/* Browser safety controls remain available when permission is denied. */}}
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===el('shooter-viewport'))void captureEscape();else navigator.keyboard?.unlock();});
 el('shooter-fullscreen').addEventListener('click',async()=>{
  try{await el('shooter-viewport').requestFullscreen();await captureEscape();frame.focus();}
  catch(_){status.textContent='Fullscreen is unavailable in this browser. The game still works in the page.';el('shooter-fullscreen').textContent='Fullscreen unavailable';}
 });
 return {onNavigate(which){active=which==='shooter';if(!active)exit();}};
})();
