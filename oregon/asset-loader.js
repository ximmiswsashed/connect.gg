/* Asset transport only: the game simulation and original assets are unchanged. */
(()=>{
 const original=window.fetch.bind(window),base=new URL('./',document.currentScript.src);
 const manifest=original(new URL('asset-packs.json',base),{cache:'no-cache'}).then(response=>{
  if(!response.ok)throw Error('Game asset index could not load. Reload the game.');return response.json();
 });
 // Observed later by fetch callers, not an unhandled rejection while idle.
 manifest.catch(()=>{});
 const packs=new Map();
 async function pack(name){
  if(!packs.has(name)){
   const promise=original(new URL(name,base)).then(response=>{
    if(!response.ok)throw Error('Game asset download failed. Reload the game.');return response.arrayBuffer();
   }).catch(error=>{packs.delete(name);throw error;});packs.set(name,promise);
  }
  return packs.get(name);
 }
 window.fetch=async(input,options)=>{
  const url=new URL(input instanceof Request?input.url:input,document.baseURI);
  const prefix=new URL('assets/oregon/scratch/',base).pathname;
  if(url.origin!==base.origin||!url.pathname.startsWith(prefix)||(options?.method||input?.method||'GET')!=='GET')return original(input,options);
  const signal=options?.signal||(input instanceof Request?input.signal:null);
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const index=await manifest,key=decodeURIComponent(url.pathname.slice(base.pathname.length)),entry=index.files[key];
  if(!entry)return original(input,options);
  const buffer=await pack(entry.pack);
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(entry.offset+entry.length>buffer.byteLength)throw Error('Game asset download is incomplete. Reload the game.');
  return new Response(new Uint8Array(buffer,entry.offset,entry.length),{status:200,headers:{'Content-Type':entry.type,'Content-Length':String(entry.length)}});
 };
})();
