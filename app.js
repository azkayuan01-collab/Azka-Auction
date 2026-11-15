const socket=io(),$=id=>document.getElementById(id);
const fmt=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`};
const post=async(url,body={})=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||d.detail||"Request gagal");return d};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(s){$("status").textContent=s.connectionStatus.toUpperCase();$("status").className="status "+(s.connectionStatus==="connected"?"connected":s.connectionStatus==="error"?"error":"");$("connectInfo").textContent=s.connectedUsername?`@${s.connectedUsername}`:"Belum terhubung";$("timer").textContent=fmt(s.remainingMs);$("auctionState").textContent=s.running?"SEDANG BERJALAN":s.remainingMs<=0?"SELESAI":"JEDA / SIAP";const rows=s.leaderboard.slice(0,10);$("leaders").innerHTML=rows.length?rows.map((p,i)=>`<tr><td>${["🥇 #1","🥈 #2","🥉 #3"][i]||"#"+(i+1)}</td><td>@${esc(p.username)}</td><td>${Number(p.totalCoin).toLocaleString("id-ID")}</td></tr>`).join(""):'<tr><td colspan="3" class="empty">Belum ada gift saat timer berjalan.</td></tr>';$("lastGift").textContent=s.lastGift?`🎁 @${s.lastGift.username} mengirim ${s.lastGift.giftName} • +${s.lastGift.coin.toLocaleString("id-ID")} coin`:"Menunggu gift..."}
socket.on("state",render);fetch("/api/state").then(r=>r.json()).then(render);
$("overlayUrl").value=location.origin+"/overlay";$("panelUrl").value=location.origin+"/overlay-panel";
$("connectBtn").onclick=async()=>{try{$("connectBtn").disabled=true;await post("/api/connect",{username:$("username").value})}catch(e){alert(e.message)}finally{$("connectBtn").disabled=false}};
$("disconnectBtn").onclick=async()=>{try{await post("/api/disconnect")}catch(e){alert(e.message)}};
$("saveBtn").onclick=async()=>{try{await post("/api/settings",{title:$("title").value,durationSeconds:Number($("duration").value),extraSeconds:Number($("extra").value),extraOnGift:$("extraOnGift").checked});alert("Pengaturan disimpan.")}catch(e){alert(e.message)}};
$("startBtn").onclick=async()=>{try{await post("/api/start")}catch(e){alert(e.message)}};
$("pauseBtn").onclick=async()=>{try{await post("/api/pause")}catch(e){alert(e.message)}};
$("resetBtn").onclick=async()=>{if(confirm("Reset timer dan hapus leaderboard lelang ini?"))try{await post("/api/reset")}catch(e){alert(e.message)}};
$("testBtn").onclick=async()=>{try{await post("/api/test-gift",{username:$("testName").value||"testuser",coin:Number($("testCoin").value)})}catch(e){alert(e.message)}};
document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{const el=$(b.dataset.copy);try{await navigator.clipboard.writeText(el.value);b.textContent="TERSALIN";setTimeout(()=>b.textContent="SALIN",1200)}catch{el.select();document.execCommand("copy")}});
