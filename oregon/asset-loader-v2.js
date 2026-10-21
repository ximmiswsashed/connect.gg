/* Immutable Oregon asset transport. Raw game asset URLs remain the public interface. */
(()=>{
 const original=window.fetch.bind(window),base=new URL('./',document.currentScript.src),prefix=new URL('assets/oregon/scratch/',base).pathname;
 const stats={networkBytes:0,cacheHits:0,requests:0,active:0,maxActive:0};window.breachAssetTransport=stats;
 const cacheTask=Promise.resolve().then(()=>caches.open('breach-map-immutable-v2')).catch(()=>null);
 const manifest=original(new URL('asset-packs-v2-3ee91086fd91.json',base)).then(r=>{if(!r.ok)throw Error('Map index unavailable');return r.json();});manifest.catch(()=>{});
 const pending=new Map(),queue=[];let active=0,prefetched=false;
 function drain(){while(active<4&&queue.length){const task=queue.shift();active++;stats.active=active;stats.maxActive=Math.max(stats.maxActive,active);task.run().then(task.resolve,task.reject).finally(()=>{active--;stats.active=active;drain();});}}
 function schedule(run,urgent){return new Promise((resolve,reject)=>{const job={run,resolve,reject};urgent?queue.unshift(job):queue.push(job);drain();});}
 function bytes(name,expected,urgent=true){if(pending.has(name))return pending.get(name);const task=schedule(async()=>{
  const url=new URL(name,base),cache=await cacheTask;let response=null;
  if(cache)try{response=await cache.match(url);}catch{}
  if(response){const buffer=await response.arrayBuffer();if(expected===undefined||buffer.byteLength===expected){stats.cacheHits++;return buffer;}try{await cache.delete(url);}catch{}}
  response=await original(url);if(!response.ok)throw Error('Map data unavailable: '+response.status);const buffer=await response.arrayBuffer();if(expected!==undefined&&buffer.byteLength!==expected)throw Error('Incomplete map download');stats.requests++;stats.networkBytes+=buffer.byteLength;
  if(cache)void cache.put(url,new Response(buffer,{headers:{'Content-Type':'application/octet-stream'}})).catch(()=>{});
  return buffer;
 },urgent).catch(error=>{pending.delete(name);throw error;});pending.set(name,task);return task;}
 let metadataTask;
 function metadata(name){if(!metadataTask)metadataTask=bytes(name).then(async b=>{const value=JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());if(value.version!==1||!value.files)throw Error('Invalid map metadata');return value.files;}).catch(e=>{metadataTask=null;throw e;});return metadataTask;}
 function prefetch(index){if(prefetched)return;prefetched=true;const packs=Object.keys(index.packSizes);for(const name of packs)void bytes(name,index.packSizes[name],false).catch(()=>{});}
 function abortable(task,signal){if(!signal)return task;if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
 window.fetch=async(input,options)=>{
  const url=new URL(input instanceof Request?input.url:input,document.baseURI);
  if(url.origin!==base.origin||!url.pathname.startsWith(prefix)||(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase()!=='GET')return original(input,options);
  const signal=options?.signal||(input instanceof Request?input.signal:null),index=await abortable(manifest,signal),key=decodeURIComponent(url.pathname.slice(base.pathname.length)),entry=index.files[key];
  if(!entry)return original(input,options);prefetch(index);
  let body;if(entry.metadata){const dictionary=await abortable(metadata(entry.metadata),signal);if(typeof dictionary[key]!=='string')throw Error('Missing map metadata');body=dictionary[key];}
  else{const buffer=await abortable(bytes(entry.pack,index.packSizes[entry.pack]),signal);if(!Number.isSafeInteger(entry.offset)||!Number.isSafeInteger(entry.length)||entry.offset<0||entry.length<0||entry.offset+entry.length>buffer.byteLength)throw Error('Invalid map asset bounds');body=new Uint8Array(buffer,entry.offset,entry.length);}
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');return new Response(body,{headers:{'Content-Type':entry.type,'Cache-Control':'public,max-age=31536000,immutable'}});
 };
})();
