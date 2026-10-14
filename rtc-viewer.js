/* Native browser playback: no WebCodecs-to-canvas copy or application ACK queue. */
class NodeRTC {
  constructor({video, iceServers, signal, session, audio, onInput, onFrame, onAudio, onStats, onFailure}) {
    Object.assign(this,{video,signal,session,audio,onInput,onFrame,onAudio,onStats,onFailure});
    this.closed=false;this.failed=false;this.previousStats=null;this.frameHandle=null;
    this.peer=new RTCPeerConnection({iceServers,bundlePolicy:'max-bundle'});
    const receiver=this.peer.addTransceiver('video',{direction:'recvonly'});
    const codecs=RTCRtpReceiver.getCapabilities?.('video')?.codecs;
    const high=codecs?.filter(c=>c.mimeType==='video/H264'&&/profile-level-id=6400/i.test(c.sdpFmtpLine||''));
    if(high?.length)receiver.setCodecPreferences([...high,...codecs.filter(c=>c.mimeType==='video/rtx')]);
    if(audio)this.peer.addTransceiver('audio',{direction:'recvonly'});
    this.channel=this.peer.createDataChannel('input',{ordered:true});
    this.input={get readyState(){return this.channel.readyState==='open'?1:0;},
      get bufferedAmount(){return this.channel.bufferedAmount;},
      channel:this.channel,send:raw=>this.channel.send(raw),close:()=>this.channel.close()};
    this.channel.onmessage=event=>{if(!this.closed){try{onInput(JSON.parse(event.data),this.input);}catch(_){this.fail();}}};
    this.channel.onclose=()=>this.fail();
    this.peer.onconnectionstatechange=()=>{
      if(this.peer.connectionState==='failed'||this.peer.connectionState==='closed')this.fail();
      // Let ICE recover a brief Wi-Fi interruption without destroying the peer.
    };
    this.peer.ontrack=event=>{
      if(this.closed)return;
      try{if('jitterBufferTarget'in event.receiver)event.receiver.jitterBufferTarget=0;}catch(_){}
      if(event.track.kind==='audio'){onAudio(new MediaStream([event.track]));return;}
      video.srcObject=new MediaStream([event.track]);video.muted=true;
      video.play().catch(()=>this.fail());
      const presented=(now,metadata)=>{
        if(this.closed)return;
        onFrame(video.videoWidth,video.videoHeight,metadata);
        this.frameHandle=video.requestVideoFrameCallback(presented);
      };
      if(video.requestVideoFrameCallback)this.frameHandle=video.requestVideoFrameCallback(presented);
      else this.frameTimer=setInterval(()=>{if(video.readyState>=2)onFrame(video.videoWidth,video.videoHeight,{});},33);
    };
    this.statsTimer=setInterval(()=>this.stats(),1000);
  }
  async start() {
    try{
      await this.peer.setLocalDescription(await this.peer.createOffer());
      if(this.peer.iceGatheringState!=='complete')await new Promise(resolve=>{
        const timeout=setTimeout(done,2500),peer=this.peer;
        function done(){clearTimeout(timeout);peer.removeEventListener('icegatheringstatechange',changed);resolve();}
        function changed(){if(peer.iceGatheringState==='complete')done();}
        peer.addEventListener('icegatheringstatechange',changed);
      });
      if(this.closed)return;
      const answer=await this.signal({session:this.session,sdp:this.peer.localDescription.sdp,audio:this.audio});
      if(this.closed)return;
      this.info=answer;
      await this.peer.setRemoteDescription({type:'answer',sdp:answer.sdp});
    }catch(_){this.fail();}
  }
  async stats() {
    if(this.closed||this.statsBusy)return;
    this.statsBusy=true;
    try{
      const report=await this.peer.getStats();
      if(this.closed)return;
      let video,route='WebRTC';
      report.forEach(item=>{if(item.type==='inbound-rtp'&&item.kind==='video')video=item;});
      report.forEach(item=>{
        if(item.type==='transport'&&item.selectedCandidatePairId){
          const pair=report.get(item.selectedCandidatePairId);
          const local=pair&&report.get(pair.localCandidateId),remote=pair&&report.get(pair.remoteCandidateId);
          route=local?.candidateType==='relay'||remote?.candidateType==='relay'?'Relay':'Direct';
        }
      });
      if(video){
        const previous=this.previousStats;
        const emitted=(video.jitterBufferEmittedCount||0)-(previous?.jitterBufferEmittedCount||0);
        const delay=(video.jitterBufferDelay||0)-(previous?.jitterBufferDelay||0);
        this.onStats({bytes:previous?Math.max(0,video.bytesReceived-previous.bytesReceived):0,
          bufferMs:emitted?delay/emitted*1000:null,route});
        this.previousStats=video;
      }
    }catch(_){}finally{this.statsBusy=false;}
  }
  fail(){if(!this.closed&&!this.failed){this.failed=true;this.onFailure();}}
  close(){
    if(this.closed)return;this.closed=true;
    clearInterval(this.statsTimer);clearInterval(this.frameTimer);
    if(this.frameHandle!==null)this.video.cancelVideoFrameCallback?.(this.frameHandle);
    this.video.pause();this.video.srcObject=null;
    this.channel.close();this.peer.close();
  }
}
window.NodeRTC=NodeRTC;
