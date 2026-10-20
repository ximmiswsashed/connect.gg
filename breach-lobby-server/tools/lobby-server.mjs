import {WebSocketServer,WebSocket} from 'ws';
import {randomInt,randomUUID} from 'node:crypto';

// One process owns its four-letter namespace. The browser host remains authoritative
// for gameplay; this service routes messages and never accepts a caller-supplied ID.
export function attachLobbyServer(server,{maxRooms=2000,heartbeatMs=10000,allowedOrigins=(process.env.LOBBY_ALLOWED_ORIGINS??'').split(',').filter(Boolean)}={}){
 const rooms=new Map(),wss=new WebSocketServer({noServer:true,maxPayload:300000,perMessageDeflate:false});
 const send=(ws,packet)=>{if(ws.readyState!==WebSocket.OPEN)return false;if(ws.bufferedAmount>2*1024*1024){ws.close(1013,'Connection too slow');return false;}ws.send(JSON.stringify(packet));return true;};
 function drop(client){const room=client.room;if(!room)return;client.room=null;if(client.id===room.host.id){rooms.delete(room.code);for(const guest of room.guests.values()){guest.room=null;send(guest.ws,{type:'ended',message:'The host closed this lobby. Ask them for a new code.'});guest.ws.close(1000,'Host left');}room.guests.clear();}else if(room.guests.delete(client.id))send(room.host.ws,{type:'left',id:client.id});}
 const fail=(ws,message)=>send(ws,{type:'error',message});
 const upgrade=(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/lobby')return;
  // Browser requests must come from the same host, including behind an HTTPS proxy.
  const origin=req.headers.origin;let valid=true;
  try{if(origin)valid=new URL(origin).host===req.headers.host||allowedOrigins.includes(origin);}catch{valid=false;}
  if(!valid){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 };
 server.on('upgrade',upgrade);
 wss.on('connection',ws=>{
  const client={ws,id:randomUUID(),room:null,alive:true,window:Date.now(),count:0,bytes:0};
  const authTimeout=setTimeout(()=>{if(!client.room)ws.close(1008,'Join a lobby first');},12000);authTimeout.unref();
  ws.on('error',()=>{});ws.on('pong',()=>{client.alive=true;});
  ws.on('close',()=>{clearTimeout(authTimeout);drop(client);});
  ws.on('message',(raw,binary)=>{
   if(binary){ws.close(1003,'Text messages only');return;}
   const now=Date.now();if(now-client.window>=1000){client.window=now;client.count=0;client.bytes=0;}
   const hosting=client.room?.host===client;client.bytes+=raw.length;if(++client.count>(hosting?1500:300)||client.bytes>(hosting?32:8)*1024*1024){ws.close(1008,'Rate limit');return;}
   let p;try{p=JSON.parse(raw.toString());}catch{return fail(ws,'Invalid lobby request.');}
   if(!p||typeof p!=='object'||Array.isArray(p))return;
   if(p.type==='ping'){send(ws,{type:'pong',time:p.time});return;}
   if(p.type==='host'||p.type==='join'){
    if(client.room)return fail(ws,'Already in a lobby. Leave it before joining another.');
    if(typeof p.map!=='string'||p.map.length>512)return fail(ws,'Update the game and try again.');
    if(p.type==='host'){
     if(rooms.size>=maxRooms)return fail(ws,'Lobby service is full. Try again shortly.');
     let code;for(let i=0;i<100;i++){code=Array.from({length:4},()=>String.fromCharCode(65+randomInt(26))).join('');if(!rooms.has(code))break;code=null;}
     if(!code)return fail(ws,'Could not reserve a code. Try again.');
     const room={code,map:p.map,host:client,guests:new Map(),limit:Math.max(1,Math.min(10,Number(p.limit)||10)),running:false};rooms.set(code,room);client.room=room;clearTimeout(authTimeout);send(ws,{type:'created',code,id:client.id});
    }else{
     const code=String(p.code??'').trim().toUpperCase();if(!/^[A-Z]{4}$/.test(code))return fail(ws,'Enter the four letters shown by the host.');
     const room=rooms.get(code);if(!room)return fail(ws,'Lobby not found. Check the code or ask the host to create a new lobby.');
     if(room.map!==p.map)return fail(ws,'Different game versions. Open the same game page as the host.');
     if(room.running)return fail(ws,'This match has started. Join when the host returns to the lobby.');
     if(room.guests.size+1>=room.limit)return fail(ws,'This lobby is full.');
     client.room=room;room.guests.set(client.id,client);clearTimeout(authTimeout);send(ws,{type:'joined',code,id:client.id});send(room.host.ws,{type:'peer',id:client.id});
    }return;
   }
   const room=client.room;if(!room)return fail(ws,'Join a lobby first.');
   if(p.type==='configure'&&client===room.host){room.limit=Math.max(room.guests.size+1,Math.min(10,Number(p.limit)||10));room.running=p.running===true;return;}
   if(p.type==='kick'&&client===room.host){room.guests.get(p.id)?.ws.close(1000,'Removed by host');return;}
   if(p.type!=='relay'||typeof p.data!=='string'||p.data.length>262144)return;
   if(client===room.host){const guest=room.guests.get(p.to);if(guest)send(guest.ws,{type:'data',id:guest.id,data:p.data});}
   else send(room.host.ws,{type:'data',id:client.id,data:p.data});
  });
 });
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){const client=ws; // ws liveness is transport-level, independent of game focus.
  if(client.lobbyAlive===false){ws.terminate();continue;}client.lobbyAlive=false;ws.once('pong',()=>{client.lobbyAlive=true;});ws.ping();
 }},heartbeatMs);heartbeat.unref();
 return {rooms,wss,close:()=>{clearInterval(heartbeat);server.off('upgrade',upgrade);for(const ws of wss.clients)ws.terminate();wss.close();}};
}

