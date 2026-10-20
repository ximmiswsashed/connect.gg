export type LobbyChannel=Pick<RTCDataChannel,'readyState'|'bufferedAmount'|'bufferedAmountLowThreshold'|'onbufferedamountlow'|'onopen'|'onclose'|'onmessage'|'close'>&{send(data:string):void};
export class RelayChannel implements LobbyChannel{
 readyState:RTCDataChannelState='connecting';bufferedAmountLowThreshold=32768;
 onbufferedamountlow:RTCDataChannel['onbufferedamountlow']=null;onopen:RTCDataChannel['onopen']=null;onclose:RTCDataChannel['onclose']=null;onmessage:RTCDataChannel['onmessage']=null;
 constructor(private socket:WebSocket,private id:string,private kick:()=>void){}
 get bufferedAmount(){return this.socket.bufferedAmount;}
 send(data:string){if(this.readyState!=='open'||this.socket.readyState!==WebSocket.OPEN)throw Error('Lobby connection closed');this.socket.send(JSON.stringify({type:'relay',to:this.id,data}));}
 open(){this.readyState='open';this.onopen?.call(this as unknown as RTCDataChannel,new Event('open'));}
 receive(data:string){if(this.readyState==='open')this.onmessage?.call(this as unknown as RTCDataChannel,new MessageEvent('message',{data}));}
 close(){if(this.readyState==='closed')return;this.readyState='closed';this.onclose?.call(this as unknown as RTCDataChannel,new Event('close'));this.kick();}
}

export async function lobbySocketURL(){
 let endpoint='';try{const response=await fetch(new URL('lobby-config.json',location.href),{signal:AbortSignal.timeout(3000),cache:'no-cache'});if(response.ok)endpoint=(await response.json()).endpoint??'';}catch{}
 const url=new URL(endpoint||'/lobby',location.href);if(url.protocol==='https:')url.protocol='wss:';if(url.protocol==='http:')url.protocol='ws:';
 if(!['ws:','wss:'].includes(url.protocol))throw Error('The lobby server address is invalid.');
 if(location.protocol==='https:'&&url.protocol!=='wss:')throw Error('This website needs a secure lobby server address. Ask the host to configure its HTTPS hosting address.');
 return url.href;
}
