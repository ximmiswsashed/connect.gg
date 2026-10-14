/* Native browser playback: no WebCodecs-to-canvas copy or application ACK queue. */
class NodeRTC {
  constructor({video, iceServers, signal, sendCandidates, trickle=false, session, audio, onInput, onFrame, onAudio, onStats, onFailure}) {
    Object.assign(this,{video,signal,sendCandidates,trickle,session,audio,onInput,onFrame,onAudio,onStats,onFailure});
    this.closed=false;this.failed=false;this.previousStats=null;this.frameHandle=null;
    this.stage='browser-setup';this.failureReason=null;this.errorName=null;
    this.startedAt=performance.now();this.hasVideo=false;this.hasAudio=false;
    this.peer=new RTCPeerConnection({iceServers,bundlePolicy:'max-bundle'});
    this.pendingCandidates=[];this.sentCandidates=new Set();this.candidateBatches=0;this.candidatesSent=0;
    this.peer.onicecandidate=event=>{
      if(this.closed||!this.trickle)return;
      this.pendingCandidates.push(event.candidate?event.candidate.toJSON():null);
      if(this.pendingCandidates.length>128)return this.fail('candidate-overflow');
      this.scheduleCandidates();
    };
    const receiver=this.peer.addTransceiver('video',{direction:'recvonly'});
    const codecs=RTCRtpReceiver.getCapabilities?.('video')?.codecs;
    const high=codecs?.filter(c=>c.mimeType==='video/H264'&&/profile-level-id=6400/i.test(c.sdpFmtpLine||''));
    this.h264Profiles=(codecs||[]).filter(c=>c.mimeType==='video/H264').map(c=>(c.sdpFmtpLine||'').match(/profile-level-id=([0-9a-f]{6})/i)?.[1]||'unspecified');
    if(high?.length)receiver.setCodecPreferences([...high,...codecs.filter(c=>c.mimeType==='video/rtx')]);
    if(audio)this.peer.addTransceiver('audio',{direction:'recvonly'});
    this.channel=this.peer.createDataChannel('input',{ordered:true});
    this.input={get readyState(){return this.channel.readyState==='open'?1:0;},
      get bufferedAmount(){return this.channel.bufferedAmount;},
      channel:this.channel,send:raw=>this.channel.send(raw),close:()=>this.channel.close()};
    this.channel.onmessage=event=>{if(!this.closed){try{onInput(JSON.parse(event.data),this.input);}catch(_){this.fail('input-response');}}};
    this.channel.onclose=()=>this.fail('input-channel-closed');
    this.peer.onconnectionstatechange=()=>{
      if(this.peer.connectionState==='failed'||this.peer.connectionState==='closed')this.fail('peer-'+this.peer.connectionState);
      // Let ICE recover a brief Wi-Fi interruption without destroying the peer.
    };
    this.peer.ontrack=event=>{
      if(this.closed)return;
      try{if('jitterBufferTarget'in event.receiver)event.receiver.jitterBufferTarget=0;}catch(_){}
      if(event.track.kind==='audio'){this.hasAudio=true;onAudio(new MediaStream([event.track]));return;}
      this.hasVideo=true;
      video.srcObject=new MediaStream([event.track]);video.muted=true;
      video.play().catch(()=>this.fail('video-playback'));
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
      this.stage='gathering-candidates';
      await this.peer.setLocalDescription(await this.peer.createOffer());
      if(!this.trickle&&this.peer.iceGatheringState!=='complete')await new Promise(resolve=>{
        const timeout=setTimeout(done,5000),peer=this.peer;
        function done(){clearTimeout(timeout);peer.removeEventListener('icegatheringstatechange',changed);resolve();}
        function changed(){if(peer.iceGatheringState==='complete')done();}
        peer.addEventListener('icegatheringstatechange',changed);
      });
      if(this.closed)return;
      this.stage='signaling';
      const localSDP=this.peer.localDescription.sdp;
      let mid=null;
      for(const line of localSDP.split(/\r?\n/)){
        if(line.startsWith('m='))mid=null;
        if(line.startsWith('a=mid:'))mid=line.slice(6);
        if(line.startsWith('a=candidate:'))this.sentCandidates.add(mid+'|'+line.slice(2));
      }
      const offerSDP=this.trickle?localSDP.replace(/^a=end-of-candidates\r?\n/gm,''):localSDP;
      const answer=await this.signal({session:this.session,sdp:offerSDP,audio:this.audio});
      if(this.closed)return;
      this.info=answer;
      this.stage='connecting';
      await this.peer.setRemoteDescription({type:'answer',sdp:answer.sdp});
      if(this.trickle&&answer.trickleICE&&answer.peerId){
        this.candidateReady=true;
        if(this.peer.iceGatheringState==='complete'&&!this.pendingCandidates.includes(null))this.pendingCandidates.push(null);
        this.scheduleCandidates();
      }
    }catch(error){this.errorName=['Error','TypeError','OperationError','InvalidStateError','NotSupportedError','AbortError'].includes(error?.name)?error.name:'Other';this.fail('setup-failed');}
  }
  scheduleCandidates(){
    if(this.closed||!this.candidateReady||this.candidateTimer||this.candidateBusy)return;
    this.candidateTimer=setTimeout(()=>{this.candidateTimer=null;this.flushCandidates();},20);
  }
  async flushCandidates(){
    if(this.closed||!this.candidateReady||this.candidateBusy||!this.sendCandidates)return;
    this.candidateBusy=true;
    try{
      while(this.pendingCandidates.length&&!this.closed){
        const batch=[];
        while(this.pendingCandidates.length&&batch.length<32){
          const candidate=this.pendingCandidates.shift();
          const key=candidate?candidate.sdpMid+'|'+candidate.candidate:'end';
          if(this.sentCandidates.has(key))continue;
          this.sentCandidates.add(key);batch.push(candidate);
        }
        if(!batch.length)continue;
        await this.sendCandidates({session:this.session,peerId:this.info.peerId,candidates:batch});
        this.candidateBatches++;this.candidatesSent+=batch.filter(Boolean).length;
      }
    }catch(_){this.fail('candidate-exchange-failed');}
    finally{this.candidateBusy=false;}
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
  report(reason=this.failureReason){
    const candidates=sdp=>{
      const counts={host:0,srflx:0,prflx:0,relay:0};
      for(const m of (sdp||'').matchAll(/^a=candidate:[^\r\n]*? typ (host|srflx|prflx|relay)(?: |\r?$)/gm))counts[m[1]]++;
      return counts;
    };
    return {reason,stage:this.stage,errorName:this.errorName,
      elapsedMs:Math.round(performance.now()-this.startedAt),
      iceGathering:this.peer.iceGatheringState,iceConnection:this.peer.iceConnectionState,
      peerConnection:this.peer.connectionState,signaling:this.peer.signalingState,
      input:this.channel.readyState,videoTrack:this.hasVideo,audioTrack:this.hasAudio,
      h264Profiles:this.h264Profiles||[],
      trickleICE:!!this.trickle,candidateBatches:this.candidateBatches||0,candidatesSent:this.candidatesSent||0,
      localCandidates:candidates(this.peer.localDescription?.sdp),
      remoteCandidates:candidates(this.peer.remoteDescription?.sdp)};
  }
  fail(reason='unknown'){if(!this.closed&&!this.failed){this.failed=true;this.failureReason=reason;this.onFailure(reason);}}
  close(){
    if(this.closed)return;this.closed=true;
    clearInterval(this.statsTimer);clearInterval(this.frameTimer);
    clearTimeout(this.candidateTimer);this.pendingCandidates=[];
    if(this.frameHandle!==null)this.video.cancelVideoFrameCallback?.(this.frameHandle);
    this.video.pause();this.video.srcObject=null;
    this.channel.close();this.peer.close();
  }
}
window.NodeRTC=NodeRTC;
