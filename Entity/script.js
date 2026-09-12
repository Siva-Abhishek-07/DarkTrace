
async function requireAuth(){
  try{
    const r=await fetch("/api/auth/me");
    if(!r.ok){window.location.href="/signin";return false}
    const d=await r.json();
    const u=document.getElementById("currentUser");
    if(u) u.textContent=d.username||""; const a=document.getElementById("adminLink"); if(a) a.style.display=d.role==="admin"?"inline-flex":"none";
    return true;
  }catch(e){window.location.href="/signin";return false}
}
async function logout(){
  await fetch("/api/auth/logout",{method:"POST"});
  window.location.href="/signin";
}
document.addEventListener("DOMContentLoaded",()=>{
  requireAuth();
  document.getElementById("logoutBtn")?.addEventListener("click",logout);
});

const MAX_ENTITIES=30;
const state={entities:Array(2).fill(null),result:null,scale:1,pan:{x:0,y:0},graphPaused:false,graphShowAll:false,showScores:true,animation:null,graphNodes:[],graphSelected:null};
const $=id=>document.getElementById(id);
const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;return el};
const setHTML=(id,value)=>{const el=$(id);if(el)el.innerHTML=value;return el};
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const scoreClass=s=>s>=75?"very-strong":s>=50?"strong":s>=25?"moderate":"weak";
const scoreLabel=s=>s>=75?"Very strong":s>=50?"Strong":s>=25?"Moderate":"Weak";
function showError(m=""){$("errorBox").textContent=m;$("errorBox").classList.toggle("show",!!m)}
const NOTIFICATION_THRESHOLD=65;
const NOTIFICATION_STORAGE_KEY="darktrace-notification-history-v1";
const NOTIFICATION_PREFS_KEY="darktrace-notification-prefs-v1";

function getNotificationHistory(){
 try{return JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY)||"[]")}catch{return[]}
}
function saveNotificationHistory(items){localStorage.setItem(NOTIFICATION_STORAGE_KEY,JSON.stringify(items.slice(0,100)))}
function getNotificationPrefs(){
 try{return {...{muted:false,sound:"soft"},...JSON.parse(localStorage.getItem(NOTIFICATION_PREFS_KEY)||"{}")}}catch{return{muted:false,sound:"soft"}}
}
function saveNotificationPrefs(p){localStorage.setItem(NOTIFICATION_PREFS_KEY,JSON.stringify(p))}

function unlockAudioContext(){
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    if(!window.__darktraceAudio) window.__darktraceAudio=new C();
    if(window.__darktraceAudio.state==="suspended") window.__darktraceAudio.resume();
  }catch(e){}
}
document.addEventListener("pointerdown",unlockAudioContext);
document.addEventListener("keydown",unlockAudioContext);

function playNotificationSound(type="default"){
 const prefs=getNotificationPrefs(); if(prefs.muted)return;
 try{
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
   const ctx=window.__darktraceAudio||(window.__darktraceAudio=new C());
   if(ctx.state==="suspended")ctx.resume();
   const now=ctx.currentTime;
   
   if(type==="threat"){
     // High-priority cyber threat pulse (dual-frequency harmonic chime)
     const osc1=ctx.createOscillator(), osc2=ctx.createOscillator(), gain=ctx.createGain();
     osc1.type="sine"; osc2.type="triangle";
     osc1.frequency.setValueAtTime(740, now);
     osc1.frequency.exponentialRampToValueAtTime(980, now + 0.08);
     osc1.frequency.exponentialRampToValueAtTime(880, now + 0.22);
     
     osc2.frequency.setValueAtTime(440, now);
     osc2.frequency.exponentialRampToValueAtTime(587, now + 0.08);
     osc2.frequency.exponentialRampToValueAtTime(520, now + 0.22);

     gain.gain.setValueAtTime(0.0001, now);
     gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
     gain.gain.exponentialRampToValueAtTime(0.14, now + 0.12);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

     osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
     osc1.start(now); osc2.start(now);
     osc1.stop(now + 0.40); osc2.stop(now + 0.40);
   } else {
     const osc=ctx.createOscillator(), gain=ctx.createGain();
     osc.type=prefs.sound==="chime"?"sine":"triangle";
     osc.frequency.setValueAtTime(prefs.sound==="chime"?660:520,now);
     osc.frequency.exponentialRampToValueAtTime(prefs.sound==="chime"?880:620,now+0.12);
     gain.gain.setValueAtTime(0.0001,now);
     gain.gain.exponentialRampToValueAtTime(0.15,now+0.015);
     gain.gain.exponentialRampToValueAtTime(0.0001,now+0.24);
     osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+0.26);
   }
 }catch(e){/* Sound is optional and must never break analysis. */}
}

function formatNotificationTime(ts){
 return new Date(ts).toLocaleString([], {dateStyle:"short",timeStyle:"short"});
}
function renderNotificationPanel(){
 const list=$("notificationList"),badge=$("notificationBadge"),history=getNotificationHistory();
 if(!list)return;
 const unread=history.filter(n=>!n.read).length;
 badge.textContent=unread>99?"99+":String(unread);badge.hidden=unread===0;
 list.innerHTML=history.length?history.map(n=>`
   <article class="notification-item ${n.read?"read":"unread"}">
    <div class="notification-item-icon">⚠</div>
    <div class="notification-item-body"><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><time>${esc(formatNotificationTime(n.timestamp))}</time></div>
   </article>`).join(""):`<div class="notification-empty">No notifications yet.</div>`;
 const prefs=getNotificationPrefs();
 const mute=$("notificationMute"),sound=$("notificationSound");
 if(mute)mute.textContent=prefs.muted?"🔇 Unmute sound":"🔔 Mute sound";
 if(sound)sound.value=prefs.sound;
}
function addNotification(title,message){
 const history=getNotificationHistory();
 history.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,message,timestamp:Date.now(),read:false});
 saveNotificationHistory(history);renderNotificationPanel();playNotificationSound();
}
function markNotificationsRead(){
 const history=getNotificationHistory().map(n=>({...n,read:true}));saveNotificationHistory(history);renderNotificationPanel();
}
function showHighScoreNotification(score,pairText){
 let n=$("highScoreNotification");
 if(!n)return;
 playNotificationSound("threat");
 n.innerHTML=`<div class="notif-icon">⚠</div><div><b>High relationship score</b><span>${esc(pairText||"Strong relationship detected")} · ${Math.round(score)}%</span><small>Review the source-backed evidence before drawing conclusions.</small></div><button aria-label="Close">×</button>`;
 n.classList.remove("show");void n.offsetWidth;n.classList.add("show");
 n.querySelector("button").onclick=()=>n.classList.remove("show");
 clearTimeout(window.__scoreNotifTimer);
 window.__scoreNotifTimer=setTimeout(()=>n.classList.remove("show"),7000);
}
function notifyHighRelationships(d){
 const pairs=(d.pairResults||[]).filter(x=>Number(x.relationshipScore)>NOTIFICATION_THRESHOLD)
   .sort((a,b)=>Number(b.relationshipScore)-Number(a.relationshipScore));
 if(!pairs.length)return;
 pairs.forEach(p=>{
   const pair=`${labelFor(d,p.entity1Id)} ↔ ${labelFor(d,p.entity2Id)}`;
   const score=Math.round(Number(p.relationshipScore));
   addNotification("High relationship score",`${pair} · ${score}%`);
 });
 const high=pairs[0];
 showHighScoreNotification(Number(high.relationshipScore),`${labelFor(d,high.entity1Id)} ↔ ${labelFor(d,high.entity2Id)}`);
}

function initNotificationCenter(){
 const bell=$("notificationBell"),panel=$("notificationPanel");
 if(!bell||!panel)return;
 renderNotificationPanel();
 bell.onclick=()=>{
   const open=panel.classList.toggle("open");
   bell.setAttribute("aria-expanded",String(open));
   if(open)markNotificationsRead();
 };
 $("clearNotifications")?.addEventListener("click",e=>{e.stopPropagation();saveNotificationHistory([]);renderNotificationPanel()});
 $("notificationMute")?.addEventListener("click",e=>{
   e.stopPropagation();const p=getNotificationPrefs();p.muted=!p.muted;saveNotificationPrefs(p);renderNotificationPanel();
 });
 $("notificationSound")?.addEventListener("change",e=>{
   const p=getNotificationPrefs();p.sound=e.target.value;saveNotificationPrefs(p);
 });
 document.addEventListener("click",e=>{if(!panel.contains(e.target)&&!bell.contains(e.target))panel.classList.remove("open")});
}
function setStatus(t,ok=true){$("statusText").textContent=t;$("statusDot").classList.toggle("offline",!ok)}
function updateToggleBtn(){
  const btn=$("toggleEntities");
  if(!btn)return;
  const isCollapsed=$("entityGrid")?.classList.contains("collapsed");
  const count=state.entities.length, selected=selectedEntities().length;
  btn.textContent=isCollapsed?`Show Slots (${selected}/${count})`:"Hide Slots";
}

function renderActiveInvestigationBar(d){
  const bar=$("activeInvestigationBar");
  const profilesBtn=$("addEntityFromProfiles");
  const graphBtn=$("addEntityFromGraph");
  if(!d||!d.entities||!d.entities.length){
    if(bar) bar.style.display="none";
    if(profilesBtn) profilesBtn.style.display="none";
    if(graphBtn) graphBtn.style.display="none";
    return;
  }
  if(profilesBtn){profilesBtn.style.display="inline-flex";profilesBtn.onclick=addEntity;}
  if(graphBtn){graphBtn.style.display="inline-flex";graphBtn.onclick=addEntity;}
  if(!bar)return;
  const isCollapsed=$("entityGrid")?.classList.contains("collapsed");
  const all=selectedEntities();
  const newEntities=all.filter(e=>!d.entities.some(ae=>ae.id===e.id));
  bar.innerHTML=`
    <div class="active-investigation-info">
      <span class="active-investigation-title">⚡ Analyzed Investigation (${d.entities.length} entities):</span>
      <div class="active-investigation-entities">
        ${d.entities.map(e=>`<span class="active-entity-pill">${esc(e.label)} <small>${esc(e.id)}</small></span>`).join("")}
        ${newEntities.map(e=>`<span class="active-entity-pill new">＋ ${esc(e.label)} <small>(pending)</small></span>`).join("")}
      </div>
    </div>
    <div class="active-investigation-actions">
      <button type="button" class="add-to-investigation-btn" id="barAddEntity">＋ Add Entity to Analysis</button>
      <button type="button" class="bar-toggle-btn" id="barToggleGrid">${isCollapsed?"Show Slots":"Hide Slots"}</button>
    </div>
  `;
  bar.style.display="flex";
  $("barAddEntity").onclick=addEntity;
  $("barToggleGrid").onclick=()=>{
    $("entityGrid").classList.toggle("collapsed");
    updateToggleBtn();
    renderActiveInvestigationBar(state.result);
  };
}

function renderEntityInputs(){
  const grid=$("entityGrid");
  if(state.entities.length<2) state.entities=Array(2).fill(null);
  const analyzedIds=new Set((state.result?.entities||[]).map(e=>e.id));
  const totalSelected=selectedEntities().length;

  grid.innerHTML=state.entities.map((entity,i)=>{
    const isAnalyzed=entity&&analyzedIds.has(entity.id);
    const isNew=Boolean(state.result&&!isAnalyzed);
    const slotClass=`entity-box multi-box entity-enter ${isNew?'new-slot':''}`;

    let tagHtml='';
    if(isAnalyzed){
      tagHtml='<span class="status-tag analyzed">✓ Analyzed</span>';
    } else if(isNew && entity){
      tagHtml=`<span class="status-tag new">＋ Adds to analysis</span>`;
    } else if(isNew && !entity){
      tagHtml=`<span class="status-tag new">＋ New Slot</span>`;
    }

    let removeBtnHtml='';
    if(state.entities.length>2){
      removeBtnHtml=`<button class="remove-entity" type="button" data-remove="${i}" aria-label="Remove entity slot ${i+1}" title="Remove this entity slot">×</button>`;
    } else if(entity){
      removeBtnHtml=`<button class="remove-entity clear-only" type="button" data-clear="${i}" aria-label="Clear entity ${i+1}" title="Clear this slot">×</button>`;
    }

    let quickActionHtml='';
    if(state.result && entity && !isAnalyzed){
      quickActionHtml=`
        <div class="slot-analyze-row">
          <button type="button" class="slot-analyze-btn" data-analyze-all="1">⚡ Analyze all ${totalSelected} entities now →</button>
        </div>`;
    }

    return `
      <div class="${slotClass}" data-slot="${i}">
        <div class="entity-box-head">
          <label>ENTITY ${i+1}</label>
          ${tagHtml}
        </div>
        ${removeBtnHtml}
        <div class="search-row">
          <input id="entitySearch${i}" autocomplete="off" placeholder="APT29, Microsoft, Tesla…">
          <button class="search-btn" id="entitySearchBtn${i}">Search</button>
        </div>
        <div class="results" id="entityResults${i}"></div>
        <div class="selected ${entity?'chosen':''}" id="entitySelected${i}">
          ${entity?`<b>${esc(entity.label)}</b><span>${esc(entity.id)}</span>`:"No entity selected"}
        </div>
        ${quickActionHtml}
      </div>
    `;
  }).join("");

  for(let i=0;i<state.entities.length;i++){
    $(`entitySearchBtn${i}`).onclick=()=>searchEntities(i);
    $(`entitySearch${i}`).addEventListener("keydown",e=>{if(e.key==="Enter")searchEntities(i)});
    if(state.entities[i]) $(`entitySearch${i}`).value=state.entities[i].label;
  }
  grid.querySelectorAll("[data-remove]").forEach(btn=>btn.onclick=()=>removeEntity(Number(btn.dataset.remove)));
  grid.querySelectorAll("[data-clear]").forEach(btn=>btn.onclick=()=>clearSlot(Number(btn.dataset.clear)));
  grid.querySelectorAll("[data-analyze-all]").forEach(btn=>btn.onclick=()=>analyze());

  updateEntityCounter();
  updateToggleBtn();
}

function clearSlot(index){
  state.entities[index]=null;
  renderEntityInputs();
  updateEntityCounter();
  if(state.result) renderActiveInvestigationBar(state.result);
}

function updateEntityCounter(){
  const count=state.entities.length, selected=selectedEntities().length;
  setText("entityCountLabel",`${count} ${count===1?"entity":"entities"} (${selected} selected)`);
  const btn=$("analyzeBtn");
  if(btn){
    btn.disabled=selected<2;
    btn.classList.toggle("ready",selected>=2);
    if(selected<2){
      btn.innerHTML="Select 2+ entities <span>→</span>";
    } else if(state.result && state.result.entities?.length && selected > state.result.entities.length){
      btn.innerHTML=`Analyze all ${selected} entities (adds ${selected - state.result.entities.length}) <span>→</span>`;
    } else if(state.result){
      btn.innerHTML=`Re-analyze all ${selected} entities <span>→</span>`;
    } else {
      btn.innerHTML=`Analyze ${selected} entities <span>→</span>`;
    }
  }
}

function addEntity(){
  if(state.entities.length>=MAX_ENTITIES){showError(`You can add up to ${MAX_ENTITIES} entities per investigation.`);return}
  $("entityGrid").classList.remove("collapsed");

  const lastIdx=state.entities.length-1;
  let targetSlot=state.entities.length;
  if(state.entities.length>=2 && state.entities[lastIdx]===null){
    targetSlot=lastIdx;
  } else {
    state.entities.push(null);
  }

  renderEntityInputs();
  updateToggleBtn();
  if(state.result) renderActiveInvestigationBar(state.result);

  const input=$(`entitySearch${targetSlot}`);
  if(input){
    input.scrollIntoView({behavior:"smooth",block:"center"});
    input.focus();
  }

  const prevCount=state.result?.entities?.length||0;
  if(prevCount>=2){
    showError(`Search and choose entity ${targetSlot+1}. It will be analyzed together with all ${prevCount} previous entities.`);
    clearTimeout(window.__addEntityMsgTimer);
    window.__addEntityMsgTimer=setTimeout(()=>{
      if($("errorBox").textContent.includes("previous entities")) showError("");
    },6000);
  } else {
    showError("");
  }
}

function removeEntity(index){
  if(state.entities.length>2){
    state.entities.splice(index,1);
  } else {
    state.entities[index]=null;
  }
  renderEntityInputs();
  updateEntityCounter();
  if(state.result) renderActiveInvestigationBar(state.result);
  showError("");
}

async function searchEntities(slot){
  const q=$(`entitySearch${slot}`).value.trim();
  if(q.length<2){showError("Enter at least 2 characters to search.");return}
  showError("");
  const box=$(`entityResults${slot}`);
  box.innerHTML='<div class="loading">Resolving entity…</div>';
  try{
    const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`),d=await r.json();
    if(!r.ok)throw Error(d.error||"Search failed");
    box.innerHTML=d.results.length?d.results.map(x=>`<button class="result-item" data-id="${esc(x.id)}"><span><b>${esc(x.label)}</b><small>${esc(x.description||"No description")}</small></span><em>${esc(x.id)}</em></button>`).join(""):'<div class="loading">No matches.</div>';
    box.querySelectorAll(".result-item").forEach(btn=>btn.onclick=()=>chooseEntity(slot,btn.dataset.id,d.results.find(x=>x.id===btn.dataset.id)));
  }catch(e){box.innerHTML="";showError(e.message)}
}

function chooseEntity(slot,id,item){
  if(!item){showError("Unable to select that entity. Please search again.");return}
  const duplicateIndex=state.entities.findIndex((e,idx)=>e&&e.id===id&&idx!==slot);
  if(duplicateIndex!==-1){
    showError(`"${item.label}" (${id}) is already selected as Entity ${duplicateIndex+1}.`);
    return;
  }
  state.entities[slot]={id,label:item.label,description:item.description,url:item.url};
  showError("");
  renderEntityInputs();
  updateEntityCounter();
  if(state.result){
    renderActiveInvestigationBar(state.result);
    const btn=$("analyzeBtn");
    if(btn){
      btn.classList.add("pulse-highlight");
      setTimeout(()=>btn.classList.remove("pulse-highlight"),1600);
    }
  }
}

function selectedEntities(){return state.entities.filter(Boolean)}

async function analyze(){
  const entities=selectedEntities();
  if(entities.length<2){showError("Select at least 2 entities.");return}
  const btn=$("analyzeBtn");
  btn.disabled=true;
  btn.innerHTML=`Analyzing ${entities.length} entities <span class="spinner"></span>`;
  showError("");
  setStatus(`Analyzing ${entities.length} entities across multi-source intelligence…`);
  try{
    const r=await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({entityIds:entities.map(e=>e.id)})
    });
    const d=await r.json();
    if(!r.ok)throw Error(d.error||"Analysis failed");
    state.result=d;
    renderResults(d);
    setStatus(`Analysis complete · ${d.entities.length} entities · ${d.pairCount} relationships`);
    $("entityGrid").classList.add("collapsed");
    renderActiveInvestigationBar(d);
    renderEntityInputs();
  }catch(e){
    showError(e.message);
    setStatus("Analysis failed",false);
  }finally{
    btn.disabled=false;
    updateEntityCounter();
    updateToggleBtn();
  }
}
function renderSidebarAI(d){
 const panel=$("sidebarAIReport");
 if(!panel)return;
 const score=Number(d.relationshipScore||0);
 const confidence=Math.round(Number(d.confidence||0)*100);
 const risk=d.risk?.level||"—";
 const pairs=d.pairResults||[];
 const strongest=d.strongestPair;
 const sourceCount=new Set((d.evidence||[]).map(e=>e.source)).size;
 setText("sidebarScore",`${score}%`);
 setText("sidebarConfidence",`${confidence}%`);
 setText("sidebarRisk",risk);
 const summary=score>=75?"Strong source-backed relationship signal detected.":score>=50?"Moderate-to-strong relationship signals detected.":score>=25?"Limited relationship signals were found.":"Weak relationship evidence was found.";
 setText("sidebarAISummary",`${summary} ${pairs.length} pair${pairs.length===1?"":"s"} analyzed across ${sourceCount} source famil${sourceCount===1?"y":"ies"}.`);
 setText("sidebarAIStrongest",strongest?`${labelFor(d,strongest.entity1Id)} ↔ ${labelFor(d,strongest.entity2Id)} · ${strongest.relationshipScore}%`:"No strongest pair yet");
 setText("sidebarAISources",`${sourceCount} source families`);
 setText("sidebarAIStatus",`Generated from the current investigation · ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`);
 panel.classList.add("generated");
 panel.classList.toggle("danger",risk.toLowerCase().includes("high")||risk.toLowerCase().includes("critical"));
}

function renderResults(d){
 renderSidebarAI(d);

 $("scoreValue").textContent=`${d.relationshipScore}%`;$("scoreValue").className=`value ${scoreClass(Number(d.relationshipScore))}`;$("scoreType").textContent=d.relationshipType;$("confidenceValue").textContent=`${Math.round(d.confidence*100)}%`;$("structuredValue").textContent=d.structuredSignals;$("newsValue").textContent=d.newsSignals;$("riskValue").textContent=d.risk.level;$("riskReason").textContent=d.risk.reason;$("pairCount").textContent=d.pairCount;$('sourceCount').textContent=new Set(d.evidence.map(e=>e.source)).size;
 const pairs=d.pairResults||[];const strongest=d.strongestPair;
 $("profileCaption").textContent=`${d.entities.length} entities · ${d.pairCount} pair comparisons`;
 $("profiles").innerHTML=d.entities.map(e=>`<article class="profile"><span class="profile-id">${esc(e.id)}</span><h3>${esc(e.label)}</h3><p>${esc(e.description||"No description available")}</p>${e.mitre?`<span class="tag">MITRE: ${esc(e.mitre.name)}</span>`:""}<a href="${esc(e.url)}" target="_blank" rel="noopener">Open source ↗</a></article>`).join("");
 $("evidenceCaption").textContent=`${d.evidence.length} evidence items`;
 $("evidenceList").innerHTML=d.evidence.length?d.evidence.slice(0,80).map(e=>`<div class="evidence-item"><span class="source-pill">${esc(e.source)}</span><div><b>${esc(e.kind)}</b><p>${esc(e.detail)}</p></div><a href="${esc(e.url)}" target="_blank" rel="noopener">↗</a></div>`).join(""):'<div class="empty">No strong source-backed signals were found.</div>';
 const total=Math.max(1,pairs.length*100);const agg=d.scoreBreakdown;const rows=[['Direct structured',agg.direct],['Shared context',agg.shared],['MITRE software/tools',agg.software],['MITRE techniques',agg.techniques],['Campaign overlap',agg.campaigns],['Alias overlap',agg.aliases],['News co-mentions',agg.news]];$("breakdown").innerHTML=rows.map(([n,v])=>`<div class="bar-row"><div><span>${n}</span><b>${v}</b></div><div class="bar"><i style="width:${Math.min(100,Math.round(v/Math.max(total,1)*100))}%"></i></div></div>`).join("");
 $("strongestPair").textContent=strongest?`${labelFor(d, strongest.entity1Id)} ↔ ${labelFor(d,strongest.entity2Id)} · ${strongest.relationshipScore}%`:"—";
 renderPairTable(pairs,d); renderGraph(d); renderAnalytics(d); renderBlockchainStatus(d.security); notifyHighRelationships(d);
}
function labelFor(d,id){return d.entities.find(e=>e.id===id)?.label||id}
function renderPairTable(pairs,d){$("pairTable").innerHTML=pairs.map(r=>`<tr><td>${esc(labelFor(d,r.entity1Id))}</td><td>${esc(labelFor(d,r.entity2Id))}</td><td><span class="score-pill ${scoreClass(r.relationshipScore)}">${r.relationshipScore}%</span></td><td>${Math.round(r.confidence*100)}%</td><td>${esc(r.relationshipType)}</td></tr>`).join("")}
function renderAnalytics(d){const p=d.pairResults||[];const buckets=[0,0,0,0];p.forEach(x=>{buckets[x.relationshipScore>=75?3:x.relationshipScore>=50?2:x.relationshipScore>=25?1:0]++});$("analyticsChart").innerHTML=buckets.map((n,i)=>`<div class="chart-col"><span>${n}</span><div class="chart-bar ${['weak','moderate','strong','very-strong'][i]}" style="height:${Math.max(10,n/(Math.max(...buckets,1))*100)}%"></div><small>${['Weak','Moderate','Strong','Very strong'][i]}</small></div>`).join("")}
function renderGraph(data){
 const svg=$("graphSvg");if(state.animation)cancelAnimationFrame(state.animation);svg.innerHTML="";const W=1100,H=520,cx=W/2,cy=H/2,all=data.entities||[],pairs=data.pairResults||[];
 const strength=Object.fromEntries(all.map(e=>[e.id,0]));pairs.forEach(r=>{strength[r.entity1Id]+=r.relationshipScore;strength[r.entity2Id]+=r.relationshipScore});const ranked=[...all].sort((a,b)=>strength[b.id]-strength[a.id]);const visible=state.graphShowAll?all:ranked.slice(0,Math.min(4,all.length));const visibleIds=new Set(visible.map(e=>e.id));
 const nodes=visible.map((e,i)=>{const a=2*Math.PI*i/Math.max(visible.length,1)-Math.PI/2;return {id:e.id,label:e.label,type:e.entityType||"Entity",x:cx+Math.cos(a)*Math.min(330,120+visible.length*35),y:cy+Math.sin(a)*Math.min(205,100+visible.length*22),vx:0,vy:0}});state.graphNodes=nodes;const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
 const edges=pairs.filter(r=>visibleIds.has(r.entity1Id)&&visibleIds.has(r.entity2Id)).map(r=>({a:byId[r.entity1Id],b:byId[r.entity2Id],score:r.relationshipScore,type:r.relationshipType}));
 const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");defs.innerHTML=`<filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;svg.appendChild(defs);const root=document.createElementNS("http://www.w3.org/2000/svg","g");root.setAttribute("transform",`translate(${state.pan.x+(W-W*state.scale)/2} ${state.pan.y+(H-H*state.scale)/2}) scale(${state.scale})`);svg.appendChild(root);
 const edgeEls=edges.map(e=>{const l=document.createElementNS("http://www.w3.org/2000/svg","line");l.setAttribute("class",`edge ${scoreClass(e.score)}`);l.setAttribute("stroke-dasharray",e.score>=75?"8 5":e.score>=50?"6 5":"none");root.appendChild(l);return[e,l]});const scoreEls=state.showScores?edges.map(e=>{const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("class",`graph-score ${scoreClass(e.score)}`);t.textContent=e.score+"%";root.appendChild(t);return[e,t]}):[];
 const nodeEls=nodes.map(n=>{const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.setAttribute("class",`node node-${n.type.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`);const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("r",visible.length>4?35:44);g.appendChild(c);const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("text-anchor","middle");t.textContent=n.id;g.appendChild(t);const k=document.createElementNS("http://www.w3.org/2000/svg","text");k.setAttribute("class","kind");k.setAttribute("text-anchor","middle");k.setAttribute("y","62");k.textContent=n.label.length>20?n.label.slice(0,19)+"…":n.label;g.appendChild(k);const title=document.createElementNS("http://www.w3.org/2000/svg","title");title.textContent=`${n.label} · ${n.type} · ${n.id}`;g.appendChild(title);root.appendChild(g);return[n,g]});
 let dragging=null,panStart=null,dx=0,dy=0;nodeEls.forEach(([n,g])=>g.addEventListener("pointerdown",ev=>{ev.stopPropagation();dragging=n;g.setPointerCapture?.(ev.pointerId);const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const q=pt.matrixTransform(svg.getScreenCTM().inverse());dx=n.x-q.x;dy=n.y-q.y}));svg.onpointermove=ev=>{if(dragging){const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const q=pt.matrixTransform(svg.getScreenCTM().inverse());dragging.x=q.x+dx;dragging.y=q.y+dy;dragging.vx=dragging.vy=0}else if(panStart){state.pan.x=panStart.px+(ev.clientX-panStart.x);state.pan.y=panStart.py+(ev.clientY-panStart.y);renderGraph(data)}};svg.onpointerup=()=>{dragging=null;panStart=null};svg.onpointerdown=ev=>{if(ev.target===svg)panStart={x:ev.clientX,y:ev.clientY,px:state.pan.x,py:state.pan.y}};
 function animate(){if(!state.graphPaused&&!dragging){nodes.forEach(n=>{n.vx*=.91;n.vy*=.91;n.vx+=(cx-n.x)*.0007;n.vy+=(cy-n.y)*.0007});for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],x=b.x-a.x,y=b.y-a.y,d=Math.hypot(x,y)||1,f=(d<145?(145-d):0)*.003; a.vx-=x/d*f;a.vy-=y/d*f;b.vx+=x/d*f;b.vy+=y/d*f}edges.forEach(e=>{const x=e.b.x-e.a.x,y=e.b.y-e.a.y,d=Math.hypot(x,y)||1,target=150+e.score*.65,f=(d-target)*.0001;e.a.vx+=x/d*f;e.a.vy+=y/d*f;e.b.vx-=x/d*f;e.b.vy-=y/d*f});nodes.forEach(n=>{n.x=Math.max(55,Math.min(W-55,n.x+n.vx));n.y=Math.max(55,Math.min(H-55,n.y+n.vy))})}edgeEls.forEach(([e,l])=>{l.setAttribute("x1",e.a.x);l.setAttribute("y1",e.a.y);l.setAttribute("x2",e.b.x);l.setAttribute("y2",e.b.y);l.setAttribute("stroke-width",Math.max(1.5,e.score/22));l.setAttribute("opacity",Math.max(.25,e.score/100))});scoreEls.forEach(([e,t])=>{t.setAttribute("x",(e.a.x+e.b.x)/2);t.setAttribute("y",(e.a.y+e.b.y)/2);t.textContent=e.score+"%"});nodeEls.forEach(([n,g])=>g.setAttribute("transform",`translate(${n.x} ${n.y})`));state.animation=requestAnimationFrame(animate)}
 $("graphEmpty").style.display="none";$("graphMode").textContent=state.graphShowAll?`Showing all ${all.length}`:`Spotlight ${visible.length} of ${all.length} · ${all.length-visible.length} hidden`;$("pauseGraph").textContent=state.graphPaused?"▶ Resume":"⏸ Freeze";$("pauseGraph").classList.toggle("active",state.graphPaused);animate();
}
function renderBlockchainStatus(sec){
 const box=$("chainModel"),blocks=sec?.chain||[];
 const visibleBlocks=blocks.length ? [blocks[blocks.length-1]] : [];
 box.innerHTML=visibleBlocks.map((blk,idx)=>{const bad=sec?.status==="compromised"&&blk.index===sec.invalidBlock;const cls=bad?"invalid":"valid";return `<div class="chain-block ${cls}"><b>BLOCK ${blk.index}</b><small>${esc(blk.timestamp||"—")}</small><code>${esc((blk.hash||"").slice(0,18))}…</code><span>${bad?"TAMPERED / INVALID":"VALID"}</span></div>${idx<visibleBlocks.length-1?'<i class="chain-link">→</i>':''}`}).join("")||'<div class="empty">No audit block yet. Analyze two entities to create one block.</div>';
 const legacy=sec?.status==="legacy"||sec?.legacy;
 const compromised=sec?.status==="compromised";
 $("securityBadge").textContent=legacy?'● LEGACY LEDGER':compromised?'● CHAIN INTEGRITY COMPROMISED':'● CHAIN VERIFIED';
 $("securityBadge").className=`security-badge ${legacy?'legacy':compromised?'danger':'secure'}`;
 $("securityStatus").textContent=sec?.message||"—";$("blockCount").textContent=sec?.blocks??"—";$("latestBlock").textContent=sec?.latestBlock??"—";$("latestHash").textContent=sec?.latestHash?sec.latestHash.slice(0,16)+"…":"—";
 $("integrityChart").innerHTML=`<div class="integrity-ring ${compromised?'bad':'ok'}"><b>${compromised?'FAIL':'100%'}</b><span>${compromised?'Hash mismatch':legacy?'Legacy schema':'Integrity verified'}</span></div><div class="integrity-meta"><b>${legacy?'Review & initialize':compromised?'Affected block: '+(sec.invalidBlock??'unknown'):'All hash links valid'}</b><span>Ledger schema ${esc(sec?.ledgerVersion||'2.1')}</span></div>`;
 $("integrityNote").textContent=legacy?'This ledger uses an older hash schema. Existing data is preserved in an archived file when you initialize a new ledger.':compromised?'A real hash/index/previous-hash mismatch was detected. No random tamper state is generated.':'Every current block matches its stored hash and previous-hash link.';
 $("initializeLedger").style.display=legacy?'inline-flex':'none';
}

async function refreshSecurity(){try{const r=await fetch('/api/security',{cache:'no-store'}),d=await r.json();renderBlockchainStatus(d)}catch(e){$("securityStatus").textContent="Security service unavailable"}}
async function verifySecurity(){const b=$("verifySecurity");b.disabled=true;b.textContent="Verifying…";try{const r=await fetch('/api/security/verify',{method:'POST'}),d=await r.json();renderBlockchainStatus(d);if(d.status==="compromised")showError(`${d.message} Affected block: ${d.invalidBlock??'unknown'}.`);else showError("")}catch(e){showError(e.message)}finally{b.disabled=false;b.textContent="Verify Blockchain"}}
async function initializeLedger(){if(!confirm("Archive the existing ledger and initialize a clean DarkTrace v2.1 ledger?"))return;const b=$("initializeLedger");b.disabled=true;b.textContent="Initializing…";try{const r=await fetch('/api/security/initialize',{method:'POST'}),d=await r.json();if(!r.ok)throw Error(d.error||"Ledger initialization failed");renderBlockchainStatus(d);showError("");setStatus("New blockchain ledger initialized")}catch(e){showError(e.message)}finally{b.disabled=false;b.textContent="Initialize New Ledger"}}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function requireResult(){if(!state.result){showError('Run an analysis first.');return false}return true}
function reportBase(){const d=state.result;return `DarkTrace Investigation Report
Generated: ${new Date().toISOString()}

Relationship score: ${d.relationshipScore}%
Relationship type: ${d.relationshipType}
Confidence: ${Math.round(d.confidence*100)}%
Risk: ${d.risk?.level||"—"} — ${d.risk?.reason||"—"}
Entities: ${d.entities.map(e=>e.label).join(", ")}
Relationships: ${d.pairCount}

STRONGEST RELATIONSHIP
${d.strongestPair?`${labelFor(d,d.strongestPair.entity1Id)} ↔ ${labelFor(d,d.strongestPair.entity2Id)} — ${d.strongestPair.relationshipScore}% (${d.strongestPair.relationshipType})`:"None"}

RELATIONSHIPS
${(d.pairResults||[]).map(r=>`- ${labelFor(d,r.entity1Id)} ↔ ${labelFor(d,r.entity2Id)}: ${r.relationshipScore}% | ${Math.round(r.confidence*100)}% confidence | ${r.relationshipType}`).join("\n")}

EVIDENCE
${(d.evidence||[]).slice(0,80).map(e=>`- [${e.source}] ${e.kind}: ${e.detail} — ${e.url}`).join("\n")}

NOTE
Relationship scores are project-generated evidence-correlation indicators, not proof of identity, intent, wrongdoing, or attribution.
`}
function exportJSON(){if(!requireResult())return;download('darktrace-investigation.json',JSON.stringify(state.result,null,2),'application/json')}
function exportCSV(){if(!requireResult())return;const d=state.result,rows=[['Entity 1','Entity 2','Score','Confidence','Relationship Type'],...(d.pairResults||[]).map(r=>[labelFor(d,r.entity1Id),labelFor(d,r.entity2Id),r.relationshipScore,Math.round(r.confidence*100)+'%',r.relationshipType])];download('darktrace-relationships.csv',rows.map(r=>r.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv;charset=utf-8')}
function exportTXT(){if(!requireResult())return;download('darktrace-investigation.txt',reportBase(),'text/plain;charset=utf-8')}
function exportMD(){if(!requireResult())return;const d=state.result;const md=`# DarkTrace Investigation Report

**Relationship score:** ${d.relationshipScore}%  
**Relationship type:** ${d.relationshipType}  
**Confidence:** ${Math.round(d.confidence*100)}%  
**Risk:** ${d.risk?.level||"—"} — ${d.risk?.reason||"—"}

## Entities
${d.entities.map(e=>`- **${e.label}** (${e.id})`).join("\n")}

## Relationships
| Entity A | Entity B | Score | Confidence | Type |
|---|---|---:|---:|---|
${(d.pairResults||[]).map(r=>`| ${labelFor(d,r.entity1Id)} | ${labelFor(d,r.entity2Id)} | ${r.relationshipScore}% | ${Math.round(r.confidence*100)}% | ${r.relationshipType} |`).join("\n")}

## Evidence
${(d.evidence||[]).slice(0,80).map(e=>`- **${e.source} — ${e.kind}:** ${e.detail} ([source](${e.url}))`).join("\n")}

> Relationship scores are project-generated evidence-correlation indicators and are not proof of identity, intent, wrongdoing, or attribution.
`;download('darktrace-investigation.md',md,'text/markdown;charset=utf-8')}
function exportHTML(){if(!requireResult())return;fetch('/api/report/html',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis:state.result})}).then(r=>{if(!r.ok)throw Error("HTML report generation failed");return r.blob()}).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='darktrace-investigation.html';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}).catch(e=>showError(e.message))}
function exportServer(format){if(!requireResult())return;fetch(`/api/report/${format}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis:state.result})}).then(async r=>{if(!r.ok){let d={};try{d=await r.json()}catch{}throw Error(d.error||`${format.toUpperCase()} report generation failed`)}return r.blob()}).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`darktrace-investigation.${format==='word'?'docx':format}`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}).catch(e=>showError(e.message))}
function exportPDF(){exportServer('pdf')}
function exportDOCX(){exportServer('word')}
function clearEntities(){
  state.entities=Array(2).fill(null);state.result=null;state.graphPaused=false;state.graphShowAll=false;state.pan={x:0,y:0};
  $("entityGrid").classList.remove('collapsed');
  renderActiveInvestigationBar(null);
  renderEntityInputs();
  updateEntityCounter();
  updateToggleBtn();
  $("profiles").innerHTML='<div class="empty">Your resolved entities will appear here.</div>';
  $("evidenceList").innerHTML='<div class="empty">Run an analysis to see evidence.</div>';
  $("graphSvg").innerHTML='';$("graphEmpty").style.display='grid';
  ["scoreValue","confidenceValue","structuredValue","newsValue","riskValue","pairCount","sourceCount"].forEach(id=>$(id).textContent='—');
  showError("");
}
function applyTheme(theme){document.body.classList.toggle("light",theme==="light");localStorage.setItem("darktrace-theme",theme);const icon=document.querySelector(".theme-island .island-icon");if(icon)icon.textContent=theme==="light"?"☀":"☾";const t=$("themeToggle");if(t)t.title=theme==="light"?"Switch to dark mode":"Switch to light mode"}
function initTheme(){const saved=localStorage.getItem("darktrace-theme")||"dark";applyTheme(saved);const t=$("themeToggle");if(t){t.onclick=()=>{const current=document.body.classList.contains("light")?"light":"dark";applyTheme(current==="light"?"dark":"light")}}}

function bind(){initTheme();renderEntityInputs();updateToggleBtn();$("addEntity").onclick=addEntity;$("toggleEntities").onclick=()=>{ $("entityGrid").classList.toggle('collapsed'); updateToggleBtn(); if(state.result) renderActiveInvestigationBar(state.result); };$("analyzeBtn").onclick=analyze;$("clearEntities").onclick=clearEntities;$("verifySecurity").onclick=verifySecurity;$("initializeLedger").onclick=initializeLedger;$("pauseGraph").onclick=()=>{state.graphPaused=!state.graphPaused;if(state.result)renderGraph(state.result)};$("focusGraph").onclick=()=>{state.graphShowAll=false;if(state.result)renderGraph(state.result)};$("showAllGraph").onclick=()=>{state.graphShowAll=true;if(state.result)renderGraph(state.result)};$("scoreToggle").onclick=()=>{state.showScores=!state.showScores;$("scoreToggle").classList.toggle('active',state.showScores);if(state.result)renderGraph(state.result)};$("zoomIn").onclick=()=>{state.scale=Math.min(2,state.scale+.15);if(state.result)renderGraph(state.result)};$("zoomOut").onclick=()=>{state.scale=Math.max(.6,state.scale-.15);if(state.result)renderGraph(state.result)};$("resetGraph").onclick=()=>{state.scale=1;state.pan={x:0,y:0};state.graphPaused=false;if(state.result)renderGraph(state.result)};$("fullscreenGraph").onclick=()=>{$("graphPanel").requestFullscreen?.()};$("graphSearch").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.node').forEach(n=>n.classList.toggle('dim',q&&!n.textContent.toLowerCase().includes(q)))};$("exportJSON").onclick=exportJSON;$("exportCSV").onclick=exportCSV;$("exportTXT").onclick=exportTXT;$("exportMD").onclick=exportMD;$("exportHTML").onclick=exportHTML;$("exportPDF").onclick=exportPDF;$("exportDOCX").onclick=exportDOCX;
}

document.addEventListener('DOMContentLoaded',()=>{bind();initNotificationCenter();});
