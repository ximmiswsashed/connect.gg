import assert from 'node:assert/strict';
import http from 'node:http';
import {WebSocket} from 'ws';
import {attachLobbyServer} from '../tools/lobby-server.mjs';
const server=http.createServer(),service=attachLobbyServer(server,{heartbeatMs:1000});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`ws://127.0.0.1:${server.address().port}/lobby`,clients=[];let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function client(){const ws=new WebSocket(url);clients.push(ws);const queue=[];ws.on('message',raw=>queue.push(JSON.parse(raw)));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return {ws,send:p=>ws.send(JSON.stringify(p)),async next(type){const until=Date.now()+3000;while(Date.now()<until){const i=queue.findIndex(p=>p.type===type);if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error('Timed out waiting for '+type);}};}
try{
 const host=await client();host.send({type:'host',map:'test-v7',limit:2});const room=await host.next('created');check(/^[A-Z]{4}$/.test(room.code),'four letters');
 const bad=await client();bad.send({type:'join',map:'test-v7',code:'XYZ'});check((await bad.next('error')).message.includes('four'),'bad input');bad.send({type:'join',map:'other-version',code:room.code});check((await bad.next('error')).message.includes('versions'),'build mismatch');
 const guest=await client();guest.send({type:'join',map:'test-v7',code:room.code.toLowerCase()});const joined=await guest.next('joined'),peer=await host.next('peer');check(joined.id===peer.id,'server assigns trusted sender identity');
 bad.send({type:'join',map:'test-v7',code:room.code});check((await bad.next('error')).message.includes('full'),'capacity reserves pending guests');
 const before=performance.now();for(let i=0;i<100;i++)guest.send({type:'relay',id:'spoofed',to:'any',data:JSON.stringify({kind:'input',serial:i})});
 for(let i=0;i<100;i++){const packet=await host.next('data');check(packet.id===joined.id&&JSON.parse(packet.data).serial===i,'ordered routed input, no spoofed identity');}
 const batchMs=performance.now()-before;host.send({type:'relay',to:joined.id,data:JSON.stringify({kind:'start'})});check(JSON.parse((await guest.next('data')).data).kind==='start','host to guest');
 guest.ws.close();check((await host.next('left')).id===joined.id,'guest departure');
 const replacement=await client();replacement.send({type:'join',map:'test-v7',code:room.code});const rejoined=await replacement.next('joined');check(rejoined.id!==joined.id,'fresh join after departure');await host.next('peer');
 host.send({type:'configure',limit:10,running:true});bad.send({type:'join',map:'test-v7',code:room.code});check((await bad.next('error')).message.includes('started'),'running match locked');
 host.ws.close();check((await replacement.next('ended')).message.includes('host'),'host departure');await new Promise(r=>setTimeout(r,20));check(!service.rooms.has(room.code),'closed rooms expire');
 bad.send({type:'join',map:'test-v7',code:room.code});check((await bad.next('error')).message.includes('not found'),'expired code');
 const parallel=await Promise.all(Array.from({length:24},async()=>{const c=await client();c.send({type:'host',map:'test-v7',limit:10});return c.next('created');}));check(new Set(parallel.map(p=>p.code)).size===24,'simultaneous hosts have distinct codes');
 console.log(JSON.stringify({pass:true,checks,orderedMessages:100,localBatchMs:batchMs,parallelRooms:24}));
}finally{for(const ws of clients)ws.terminate();service.close();await new Promise(r=>server.close(r));}
