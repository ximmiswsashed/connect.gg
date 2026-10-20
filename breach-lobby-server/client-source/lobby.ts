import {operators} from './data';
import {RelayChannel,lobbySocketURL,type LobbyChannel} from './lobby-relay';
import {validateSkins} from './cosmetics';
import {compatibleOptics} from './optics';
import {validatedWeapon} from './loadouts';import type {LobbyRules} from './game';import type {Optic} from './optics';
export type Member={id:string,name:string,team:number,operator:number,weapon:number,optics:Record<number,Optic>,weaponSkins?:Record<number,string>,attachmentSkins?:Record<number,string>,ready?:boolean};
type Peer={pc:RTCPeerConnection|null,channel:LobbyChannel|null,id:string,reliable:string[],disconnectTimer?:ReturnType<typeof setTimeout>};
type Signal={v:2,room:string,id:string,type:'offer'|'answer',sdp:string,map?:string};
export class Lobby{
 private relaySocket:WebSocket|null=null;private relayTimer:ReturnType<typeof setInterval>|undefined;private relayEpoch=0;
 connecting=false;pingMs:number|null=null;
 async hostCode(name:string,team:number){await this.connectCode('host','',name,team);}
 async joinCode(code:string,name:string){const value=code.trim().toUpperCase();if(!/^[A-Z]{4}$/.test(value))throw Error('Enter the four letters shown by the host.');await this.connectCode('join',value,name,0);}
 private async connectCode(type:'host'|'join',code:string,name:string,team:number){
  if(this.connecting)throw Error('A connection is already in progress.');
  this.leave();const epoch=this.relayEpoch;this.connecting=true;this.profile.name=cleanName(name);this.profile.weapon=validatedWeapon(this.profile.operator,this.profile.weapon);this.status=type==='host'?'Creating lobby…':'Joining lobby…';this.onChange();
  try{
   const socket=new WebSocket(await lobbySocketURL());this.relaySocket=socket;let lastMessage=performance.now();
   await new Promise<void>((resolve,reject)=>{
    let settled=false;const timeout=setTimeout(()=>fail('The lobby server did not respond. Check your connection and try again.'),10000);
    const fail=(message:string)=>{if(settled)return;settled=true;clearTimeout(timeout);reject(Error(message));};
    socket.onopen=()=>{if(epoch!==this.relayEpoch){socket.close();return;}socket.send(JSON.stringify({type,code,map:this.mapId,limit:this.settings.playerLimit}));};
    socket.onerror=()=>fail('Could not reach the lobby server. Check your connection and try again.');
    socket.onclose=()=>{if(!settled)fail('The lobby connection closed. Try again.');else if(epoch===this.relayEpoch)this.relayDisconnected('Connection lost. Create or join the lobby again.');};
    socket.onmessage=event=>{
     if(epoch!==this.relayEpoch)return;lastMessage=performance.now();let p:any;try{p=JSON.parse(String(event.data));}catch{return;}
     if(p.type==='error'){if(!settled)fail(String(p.message));else{this.status=String(p.message);this.onChange();}return;}
     if(p.type==='ended'){this.relayDisconnected(String(p.message));return;}
     if(p.type==='created'||p.type==='joined'){
      if(settled)return;settled=true;clearTimeout(timeout);this.mode=p.type==='created'?'host':'guest';this.selfId=p.id;this.room=p.code;this.connecting=false;
      if(this.mode==='host')this.members=[{id:this.selfId,name:this.profile.name,team,operator:this.profile.operator,weapon:this.profile.weapon,optics:{...this.profile.optics},weaponSkins:validateSkins(this.profile.weaponSkins),attachmentSkins:validateSkins(this.profile.attachmentSkins)}];
      else this.addRelayPeer(this.selfId);
      this.status=this.mode==='host'?'Lobby ready · waiting for a friend':'Joining lobby…';this.onChange();resolve();return;
     }
     if(p.type==='peer'&&this.mode==='host'){this.addRelayPeer(p.id);return;}
     if(p.type==='left'&&this.mode==='host'){this.removeRelayPeer(p.id);return;}
     if(p.type==='data'){const peer=this.peers.get(p.id);if(peer?.channel instanceof RelayChannel)peer.channel.receive(p.data);return;}
     if(p.type==='pong'){this.pingMs=Math.max(0,Math.round(performance.now()-p.time));}
    };
   });
   let lastTick=performance.now();
   this.relayTimer=setInterval(()=>{if(epoch!==this.relayEpoch)return;const now=performance.now();if(now-lastTick>5000)lastMessage=now;lastTick=now;if(now-lastMessage>15000){this.relayDisconnected('Connection timed out. Create or join the lobby again.');return;}if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping',time:now}));this.flushReliable();},1000);
  }catch(error){if(epoch===this.relayEpoch){this.leave();this.status=(error as Error).message;this.onChange();}throw error;}
 }
 private addRelayPeer(id:string){if(!this.relaySocket||this.peers.has(id))return;const channel=new RelayChannel(this.relaySocket,id,()=>{if(this.mode==='host'&&this.relaySocket?.readyState===WebSocket.OPEN)this.relaySocket.send(JSON.stringify({type:'kick',id}));});const peer:Peer={id,pc:null,channel,reliable:[]};this.peers.set(id,peer);this.wire(peer);channel.open();}
 private removeRelayPeer(id:string){const peer=this.peers.get(id);if(!peer)return;this.peers.delete(id);if(peer.channel){peer.channel.onclose=null;peer.channel.close();}this.members=this.members.filter(m=>m.id!==id);this.status='Friend disconnected · waiting for players';this.onDisconnect(id);this.sync();this.checkReady();}
 private relayDisconnected(message:string){const ids=[...this.peers.keys()];this.leave();this.status=message;for(const id of ids)this.onDisconnect(id);this.onChange();}
 private syncRelay(){if(this.mode==='host'&&this.relaySocket?.readyState===WebSocket.OPEN)this.relaySocket.send(JSON.stringify({type:'configure',limit:this.settings.playerLimit,running:this.running}));}
 mapId='oregon-legacy-2025';selection:{active:boolean,deadline:number,site:number,spawn:number}|null=null;onReady=()=>{};
 mode:'none'|'host'|'guest'='none';selfId='';room='';members:Member[]=[];peers=new Map<string,Peer>();settings:LobbyRules={aiEnabled:true,enemyCount:5,allyCount:4,difficulty:'Normal',playerLimit:10,dbno:true,friendlyFire:false,teammateDamage:.5};running=false;status='';
 onChange=()=>{};onPacket=(id:string,packet:Record<string,unknown>)=>{void id;void packet;};onDisconnect=(id:string)=>{void id;};
 profile={name:'OPERATOR',operator:0,weapon:0,optics:{} as Record<number,Optic>,weaponSkins:{} as Record<number,string>,attachmentSkins:{} as Record<number,string>};
 host(name:string,team:number){this.profile.weapon=validatedWeapon(this.profile.operator,this.profile.weapon);this.leave();this.mode='host';this.selfId=crypto.randomUUID();this.room=crypto.randomUUID();this.members=[{id:this.selfId,name:cleanName(name),team,operator:this.profile.operator,weapon:this.profile.weapon,optics:{...this.profile.optics},weaponSkins:validateSkins(this.profile.weaponSkins),attachmentSkins:validateSkins(this.profile.attachmentSkins)}];this.status='Private lobby ready';this.onChange();}
 async invite(){if(this.mode!=='host'||this.running)throw Error('Create a lobby before inviting.');if(this.members.length>=this.settings.playerLimit)throw Error('The lobby is full.');const id=crypto.randomUUID(),peer=this.createPeer(id);peer.channel=peer.pc.createDataChannel('breach-v2',{ordered:true});this.wire(peer);await peer.pc.setLocalDescription(await peer.pc.createOffer());await gather(peer.pc);return encode({v:2,room:this.room,id,type:'offer',map:this.mapId,sdp:peer.pc.localDescription!.sdp!});}
 async join(code:string,name:string){const signal=decode(code,'offer');if((signal.map??'oregon-legacy-2025')!==this.mapId)throw Error('This invite uses a different game build. Open the same game URL as the host.');this.leave();this.mode='guest';this.selfId=signal.id;this.room=signal.room;this.profile.name=cleanName(name);const peer=this.createPeer(signal.id);peer.pc.ondatachannel=e=>{peer.channel=e.channel;this.wire(peer);};await peer.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});await peer.pc.setLocalDescription(await peer.pc.createAnswer());await gather(peer.pc);this.status='Send this response to the host. Waiting for connection…';this.onChange();return encode({v:2,room:signal.room,id:signal.id,type:'answer',map:this.mapId,sdp:peer.pc.localDescription!.sdp!});}
 async accept(code:string){const s=decode(code,'answer');if((s.map??'oregon-legacy-2025')!==this.mapId)throw Error('This response uses a different game build. Both players must open the same game URL.');if(this.mode!=='host'||s.room!==this.room)throw Error('This response belongs to another lobby.');const p=this.peers.get(s.id);if(!p?.pc||p.pc.signalingState!=='have-local-offer')throw Error('This invite is expired or already connected. Generate another invite.');await p.pc.setRemoteDescription({type:'answer',sdp:s.sdp});this.status='Connecting to friend…';this.onChange();}
 configure(settings:LobbyRules){if(this.mode==='guest'||this.running)throw Error('Only the host can edit settings before the match.');this.settings={...settings,playerLimit:Math.max(this.members.length,Math.min(10,settings.playerLimit)),enemyCount:Math.max(0,Math.min(9,settings.enemyCount)),allyCount:Math.max(0,Math.min(9,settings.allyCount))};this.sync();}
 assign(id:string,team:number){if(this.mode!=='host'||this.running)return;const m=this.members.find(m=>m.id===id);if(m){m.team=team===1?1:0;m.ready=false;this.sync();}}
 updateProfile(){this.profile.weapon=validatedWeapon(this.profile.operator,this.profile.weapon);const m=this.members.find(m=>m.id===this.selfId);if(m&&this.mode==='host'){m.ready=false;m.operator=this.profile.operator;m.weapon=this.profile.weapon;m.optics={...this.profile.optics};m.weaponSkins=validateSkins(this.profile.weaponSkins);m.attachmentSkins=validateSkins(this.profile.attachmentSkins);this.sync();}else if(this.mode==='guest')this.send({kind:'profile',...this.profile});}
 start(){if(this.mode!=='host')throw Error('Only the host can start the match.');if(this.selection)this.selection.active=false;this.running=true;this.broadcast({kind:'start',members:this.members,settings:this.settings});this.sync();}
 sync(){this.syncRelay();if(this.mode==='host')this.broadcast({kind:'lobby',members:this.members,settings:this.settings,running:this.running,selection:this.selection});this.onChange();}
 eligible(m:Member){const team=m.team;const roster=operators.map((o,i)=>({o,i})).filter(v=>(v.o.role==='ATTACK'?0:1)===team).map(v=>v.i);const unique=this.members.filter(v=>v.team===team).length<=roster.length;return roster.filter(i=>!unique||!this.members.some(v=>v.id!==m.id&&v.team===team&&v.ready&&v.operator===i));}
 beginSelection(site:number,spawn:number){if(this.mode!=='host')return;this.running=false;this.selection={active:true,deadline:Date.now()+Math.max(10,Math.min(120,this.settings.selectionSeconds??45))*1000,site,spawn};for(const m of this.members)m.ready=false;this.sync();}
 confirm(){if(!this.selection?.active)return;if(this.mode==='guest')this.send({kind:'ready'});else {const m=this.members.find(v=>v.id===this.selfId);if(m)this.validateReady(m);this.sync();this.checkReady();}}
 private validateReady(m:Member){if(!this.eligible(m).includes(m.operator)){m.ready=false;this.status='Choose an eligible operator that your team has not confirmed.';return false;}m.weapon=validatedWeapon(m.operator,m.weapon);m.optics=validateOptics(m.optics);m.weaponSkins=validateSkins(m.weaponSkins);m.attachmentSkins={};m.ready=true;return true;}
 tickSelection(){if(this.mode!=='host'||!this.selection?.active)return;if(Date.now()>=this.selection.deadline){for(const m of this.members)if(!m.ready){const eligible=this.eligible(m);if(!eligible.includes(m.operator))m.operator=eligible[0];m.weapon=validatedWeapon(m.operator,m.weapon);this.validateReady(m);}this.sync();}this.checkReady();}
 checkReady(){if(this.mode==='host'&&this.selection?.active&&this.members.length&&this.members.every(m=>m.ready)){this.selection.active=false;this.onReady();}}
 send(packet:Record<string,unknown>){if(this.mode!=='guest')return false;const channel=this.peers.get(this.selfId)?.channel;if(channel?.readyState!=='open'||channel.bufferedAmount>=131072)return false;const data=JSON.stringify(packet);try{channel.send(data);return true;}catch{return false;}}
 broadcast(packet:Record<string,unknown>){const text=JSON.stringify(packet);for(const p of this.peers.values())if(p.channel?.readyState==='open'&&p.channel.bufferedAmount<131072)p.channel.send(text);}
 reliableBroadcast(packet:Record<string,unknown>){const data=JSON.stringify(packet);for(const peer of this.peers.values())if(peer.channel?.readyState==='open'){peer.reliable.push(data);this.flushPeer(peer);}}
 flushReliable(){for(const peer of this.peers.values())this.flushPeer(peer);}
 private flushPeer(peer:Peer){const c=peer.channel;if(c?.readyState!=='open')return;while(peer.reliable.length&&c.bufferedAmount<65536)c.send(peer.reliable.shift()!);}
 leave(){this.relayEpoch++;this.connecting=false;this.pingMs=null;if(this.relayTimer)clearInterval(this.relayTimer);this.relayTimer=undefined;const socket=this.relaySocket;this.relaySocket=null;if(socket){socket.onopen=socket.onclose=socket.onerror=socket.onmessage=null;socket.close();}for(const p of this.peers.values()){if(p.disconnectTimer)clearTimeout(p.disconnectTimer);if(p.pc)p.pc.onconnectionstatechange=null;if(p.channel)p.channel.onclose=null;p.channel?.close();p.pc?.close();}this.peers.clear();this.members=[];this.mode='none';this.running=false;this.room='';this.selfId='';this.selection=null;}
 private createPeer(id:string){const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});const peer:Peer & {pc:RTCPeerConnection}={id,pc,channel:null,reliable:[]};this.peers.set(id,peer);pc.onconnectionstatechange=()=>{if(peer.disconnectTimer)clearTimeout(peer.disconnectTimer);if(pc.connectionState==='disconnected'){peer.disconnectTimer=setTimeout(()=>{if(pc.connectionState==='disconnected')pc.close();},5000);}if((pc.connectionState==='failed'||pc.connectionState==='closed')&&this.peers.has(id)){this.peers.delete(id);if(this.mode==='host'){this.members=this.members.filter(m=>m.id!==id);this.onDisconnect(id);this.sync();this.checkReady();}else{this.status='Host disconnected. Return to the lobby to reconnect.';this.running=false;this.selection=null;this.onDisconnect(id);this.onChange();}}};return peer;}
 private wire(p:Peer){const ch=p.channel!;ch.bufferedAmountLowThreshold=32768;ch.onbufferedamountlow=()=>this.flushPeer(p);ch.onopen=()=>{if(this.mode==='guest')this.send({kind:'hello',...this.profile});this.status='Connected';this.onChange();};ch.onclose=()=>{if(this.peers.has(p.id)){this.peers.delete(p.id);if(this.mode==='host'){this.members=this.members.filter(m=>m.id!==p.id);this.onDisconnect(p.id);this.sync();this.checkReady();}else{this.status='Host connection closed';this.running=false;this.selection=null;this.onDisconnect(p.id);this.onChange();}}};
  ch.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>262144)return;let packet:Record<string,unknown>;try{packet=JSON.parse(e.data);if(!packet||Array.isArray(packet)||typeof packet.kind!=='string')return;}catch{return;}
   if(this.mode==='host'&&packet.kind==='hello'){if(this.running||this.members.length>=this.settings.playerLimit){ch.close();return;}if(!this.members.some(m=>m.id===p.id)){this.members.push({id:p.id,name:cleanName(String(packet.name??'FRIEND')),team:this.members.filter(m=>m.team===0).length>this.members.filter(m=>m.team===1).length?1:0,operator:validIndex(packet.operator,6),weapon:validatedWeapon(validIndex(packet.operator,6),validIndex(packet.weapon,5)),optics:validateOptics(packet.optics),weaponSkins:validateSkins(packet.weaponSkins),attachmentSkins:validateSkins(packet.attachmentSkins)});this.sync();}return;}
   if(this.mode==='host'&&packet.kind==='ready'&&this.selection?.active){const m=this.members.find(m=>m.id===p.id);if(m)this.validateReady(m);this.sync();this.checkReady();return;}
   if(this.mode==='host'&&packet.kind==='profile'&&!this.running){const m=this.members.find(m=>m.id===p.id);if(m){m.ready=false;m.operator=validIndex(packet.operator,6);m.weapon=validatedWeapon(m.operator,validIndex(packet.weapon,5));m.optics=validateOptics(packet.optics);m.weaponSkins=validateSkins(packet.weaponSkins);m.attachmentSkins=validateSkins(packet.attachmentSkins);this.sync();}return;}
   if(this.mode==='guest'&&packet.kind==='lobby'){if(Array.isArray(packet.members)&&packet.settings){this.members=packet.members as Member[];this.settings=packet.settings as LobbyRules;this.running=packet.running===true;this.selection=(packet.selection??null) as Lobby['selection'];this.status='Connected';this.onChange();}return;}
   this.onPacket(p.id,packet);
  };
 }
}
const cleanName=(name:string)=>name.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,20)||'OPERATOR';
const validIndex=(n:unknown,max:number)=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<max?n:0;
function validateOptics(value:unknown){const output:Record<number,Optic>={};if(value&&typeof value==='object')for(let i=0;i<6;i++){const v=(value as Record<number,unknown>)[i] as Optic;output[i]=compatibleOptics(i).includes(v)?v:'iron';}return output;}
function encode(s:Signal){return 'BP2.'+btoa(JSON.stringify(s));}
function decode(raw:string,type:Signal['type']){try{if(!raw.trim().startsWith('BP2.')||raw.length>100000)throw Error();const s=JSON.parse(atob(raw.trim().slice(4))) as Signal;if(s.v!==2||s.type!==type||typeof s.sdp!=='string'||s.sdp.length>60000||typeof s.id!=='string'||typeof s.room!=='string')throw Error();return s;}catch{throw Error('Invalid connection code. Paste the complete BP2 code.');}}
function gather(pc:RTCPeerConnection){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise<void>(resolve=>{const finish=()=>{pc.removeEventListener('icegatheringstatechange',check);clearTimeout(timeout);resolve();};const check=()=>{if(pc.iceGatheringState==='complete')finish();};const timeout=setTimeout(finish,6000);pc.addEventListener('icegatheringstatechange',check);});}


