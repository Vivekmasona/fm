const WS_URL="wss://fmconnector.onrender.com";
const player=document.getElementById("player");
const connText=document.getElementById("connText");
const playBtn=document.getElementById("playPauseBtn");
const playIcon=document.getElementById("playIcon");
const pauseIcon=document.getElementById("pauseIcon");
const songTitle=document.getElementById("songTitle");
const artistName=document.getElementById("artistName");
const coverImg=document.getElementById("coverImg");
const timeCounter=document.getElementById("timeCounter");
let pc=null,playing=false;
let reconnectTimeout=null;

/* Update audio timer */
setInterval(()=>{
  if(player && !isNaN(player.currentTime)){
    const t=Math.floor(player.currentTime);
    const m=Math.floor(t/60).toString().padStart(2,"0");
    const s=(t%60).toString().padStart(2,"0");
    timeCounter.textContent=`${m}:${s}`;
  }
},1000);

function connectWS(){
  const socket=new WebSocket(WS_URL);
  connText.textContent="Connecting";

  socket.onopen=()=>{
    socket.send(JSON.stringify({type:"register",role:"listener"}));
    connText.textContent="Waiting for stream";
  };

  socket.onmessage=async e=>{
    const msg=JSON.parse(e.data);
    if(msg.type==="offer"){
      connText.textContent="Connecting Stream";
      pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
      pc.ontrack=ev=>{
        player.srcObject=ev.streams[0];
        player.play().catch(()=>{});
        connText.textContent="Live";
      };
      pc.onicecandidate=ev=>{
        if(ev.candidate)
          socket.send(JSON.stringify({type:"candidate",target:msg.from,payload:ev.candidate}));
      };
      await pc.setRemoteDescription(msg.payload);
      const ans=await pc.createAnswer();
      await pc.setLocalDescription(ans);
      socket.send(JSON.stringify({type:"answer",target:msg.from,payload:ans}));
    }
    if(msg.type==="candidate"&&pc){
      await pc.addIceCandidate(msg.payload).catch(()=>{});
    }
    if(msg.type==="metadata"){
      if(msg.title)songTitle.textContent=msg.title;
      if(msg.artist)artistName.textContent=msg.artist;
      if(msg.cover)coverImg.src=msg.cover;
    }
  };

  socket.onclose=()=>handleDisconnect();
  socket.onerror=()=>handleDisconnect();
}

function handleDisconnect(){
  connText.textContent="Reconnecting";
  if(pc){pc.close();pc=null;}
  if(reconnectTimeout)clearTimeout(reconnectTimeout);
  reconnectTimeout=setTimeout(connectWS,3000);
}

/* Play / Pause */
playBtn.onclick=async()=>{
  if(playing) player.pause();
  else {
    try{await player.play();}catch(e){}
  }
};
player.addEventListener("pause",()=>{
  playing=false;
  playBtn.classList.remove("playing");
  playIcon.style.display="block";
  pauseIcon.style.display="none";
});
player.addEventListener("play",()=>{
  playing=true;
  playBtn.classList.add("playing");
  playIcon.style.display="none";
  pauseIcon.style.display="block";
});

/* Share + Chat */
document.getElementById("shareBtn").onclick=()=>{if(navigator.share)navigator.share({title:"BiharFM Live",text:" Listen now",url:location.href});};
document.getElementById("chatBtn").onclick=()=>{window.open("https://wa.me/?text=Listen BiharFM Live "+encodeURIComponent(location.href),"_blank");};

/* Initial connect */
connectWS();
