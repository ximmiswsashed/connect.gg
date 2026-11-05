/* Public Audius REST API and profile-only PKCE. No app secret is required. */
window.NodeAudiusAPI=(()=>{
  const BASE='https://api.audius.co/v1',APP='Node';
  const validId=value=>/^[a-zA-Z0-9]{1,32}$/.test(String(value||''));
  const text=(value,fallback='')=>typeof value==='string'?value.slice(0,2000):fallback;
  function url(value,image=false){
    try{
      const parsed=new URL(value);
      if(parsed.protocol!=='https:'||parsed.username||parsed.password)return '';
      if(image){if(!parsed.hostname.includes('.')||/^[\d.]+$/.test(parsed.hostname)||/[\[\]:]/.test(parsed.hostname)||/\.(local|localhost|internal)$/i.test(parsed.hostname))return '';}
      else if(!['audius.co','www.audius.co'].includes(parsed.hostname))return '';
      return parsed.href;
    }catch{return '';}
  }
  function artwork(value){return url(value?.['480x480']||value?.['150x150']||'',true);}
  function artist(raw){
    if(!raw||!validId(raw.id??raw.userId))return null;
    const handle=text(raw.handle),id=String(raw.id??raw.userId);
    return {kind:'user',id,name:text(raw.name,'Audius artist'),handle,bio:text(raw.bio),image:artwork(raw.profile_picture||raw.profilePicture),url:handle?'https://audius.co/'+encodeURIComponent(handle):'https://audius.co',followers:Number(raw.follower_count)||0};
  }
  function track(raw){
    if(!raw||!validId(raw.id))return null;
    const saved=raw.kind==='track',user=artist(raw.user);
    const duration=Number(raw.duration);
    return {kind:'track',id:String(raw.id),title:text(raw.title,'Untitled track'),artist:saved?text(raw.artist,'Audius artist'):user?.name||'Audius artist',artistId:saved&&validId(raw.artistId)?String(raw.artistId):user?.id||'',
      image:saved?url(raw.image,true):artwork(raw.artwork),url:url(raw.url||('https://audius.co'+(typeof raw.permalink==='string'&&raw.permalink.startsWith('/')?raw.permalink:'')))||'https://audius.co',
      duration:Number.isFinite(duration)?Math.max(0,Math.min(604800,duration)):0,description:text(raw.description),genre:text(raw.genre),plays:Math.max(0,Number(raw.plays??raw.play_count)||0),
      streamable:saved?raw.streamable===true:raw.is_streamable!==false&&raw.is_available!==false&&raw.is_stream_gated!==true&&raw.access?.stream!==false};
  }
  function playlist(raw){
    if(!raw||!validId(raw.id))return null;
    const user=artist(raw.user);
    return {kind:'playlist',id:String(raw.id),title:text(raw.playlist_name,'Audius playlist'),artist:user?.name||'Audius artist',image:artwork(raw.artwork),description:text(raw.description),count:Number(raw.track_count)||0,url:url('https://audius.co'+(typeof raw.permalink==='string'&&raw.permalink.startsWith('/')?raw.permalink:''))||'https://audius.co'};
  }
  function unique(items){return [...new Map(items.filter(Boolean).map(item=>[item.id,item])).values()];}
  async function read(path,params={},signal){
    if(!/^\/(tracks|users|playlists)(\/[a-zA-Z0-9_-]+)*$/.test(path))throw new Error('Invalid Audius request.');
    const query=new URLSearchParams({app_name:APP});
    for(const [key,value] of Object.entries(params))for(const item of Array.isArray(value)?value:[value])query.append(key,String(item));
    let response;
    try{response=await fetch(BASE+path+'?'+query,{signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});}
    catch(failure){if(failure.name==='AbortError')throw failure;throw new Error('Cannot reach Audius. Check your connection and retry.');}
    if(!response.ok){const failure=new Error(response.status===429?'Audius is busy. Wait a minute, then retry.':response.status===404?'This Audius item is no longer available.':'Audius could not load this page. Please retry.');failure.status=response.status;throw failure;}
    const result=await response.json();
    if(!result||typeof result!=='object'||!('data' in result))throw new Error('Audius returned an incomplete response. Please retry.');
    return result.data;
  }
  async function favorites(id,offset=0,signal){
    if(!validId(id))throw new Error('Invalid Audius profile.');
    let rows;
    try{rows=await read('/users/'+id+'/favorites/tracks',{offset,limit:20},signal);}
    catch(failure){
      if(failure.status!==404)throw failure;
      const saved=await read('/users/'+id+'/favorites',{offset,limit:20},signal);
      const ids=(Array.isArray(saved)?saved:[]).filter(row=>String(row.favorite_type).endsWith('track')&&validId(row.favorite_item_id)).map(row=>String(row.favorite_item_id));
      rows=ids.length?await read('/tracks',{id:ids},signal):[];
      return {items:unique((Array.isArray(rows)?rows:[]).map(track)),more:Array.isArray(saved)&&saved.length===20};
    }
    return {items:unique((Array.isArray(rows)?rows:[]).map(track)),more:Array.isArray(rows)&&rows.length===20};
  }
  function stream(id){if(!validId(id))throw new Error('Invalid Audius track.');return BASE+'/tracks/'+id+'/stream?app_name='+APP;}
  const random=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');};
  async function loginRequest(redirect){
    const state=random(),verifier=random();
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const challenge=btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    return {state,verifier,redirect,url:BASE+'/oauth/authorize?'+new URLSearchParams({response_type:'code',scope:'read',app_name:APP,redirect_uri:redirect,state,code_challenge:challenge,code_challenge_method:'S256',response_mode:'fragment',display:'popup'})};
  }
  async function exchange(code,request){
    let tokens;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(BASE+'/oauth/token',{signal:controller.signal,method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',code,code_verifier:request.verifier,client_id:null,redirect_uri:request.redirect})});
      if(!response.ok)throw new Error('Audius sign-in expired or was rejected. Select Connect Audius to retry.');
      tokens=await response.json();if(typeof tokens.access_token!=='string'||!tokens.access_token)throw new Error('Audius did not complete sign-in. Please retry.');
      const profile=await fetch(BASE+'/me',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+tokens.access_token}});
      if(!profile.ok)throw new Error('Audius could not read your profile. Reconnect to retry.');
      const body=await profile.json(),user=artist(body.data||body);
      if(!user)throw new Error('Audius returned an invalid profile. Reconnect to retry.');
      return user;
    }catch(failure){if(failure.name==='AbortError')throw new Error('Audius sign-in timed out. Select Connect Audius to retry.');throw failure;}finally{
      clearTimeout(timeout);
      // Only the verified public profile is retained. Discard provider tokens.
      if(typeof tokens?.refresh_token==='string'){
        const revokeController=new AbortController(),revokeTimeout=setTimeout(()=>revokeController.abort(),4000);
        try{await fetch(BASE+'/oauth/revoke',{signal:revokeController.signal,method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tokens.refresh_token,client_id:null})});}catch{}finally{clearTimeout(revokeTimeout);}
      }
    }
  }
  return {read,track,artist,playlist,unique,url,validId,favorites,stream,loginRequest,exchange};
})();
