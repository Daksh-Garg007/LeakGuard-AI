const todayDateEl = document.getElementById('today-date');
function tickClock(){
  const now = new Date();
  const datePart = now.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
  const timePart = now.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
  todayDateEl.textContent = `${datePart} · ${timePart} IST`;
}
tickClock();
setInterval(tickClock, 1000);

/* =====================================================
   SAMPLE CSV — a realistic multi-month bank statement
   ===================================================== */
const sampleCSV = `Date,Description,Amount
2026-02-03,NETFLIX.COM,499
2026-02-05,SPOTIFY INDIA,119
2026-02-07,AMAZON PRIME MEM,1499
2026-02-12,GOOGLE ONE STORAGE,130
2026-02-18,AUDIBLE MEMBERSHIP,199
2026-02-20,SWIGGY ORDER,340
2026-02-24,BIGBASKET GROCERY,1120
2026-03-03,NETFLIX INDIA,499
2026-03-05,SPOTIFY INDIA,119
2026-03-07,AMAZON PRIME MEM,1499
2026-03-12,GOOGLE ONE STORAGE,130
2026-03-18,AUDIBLE MEMBERSHIP,199
2026-03-21,SWIGGY ORDER,410
2026-03-25,BIGBASKET GROCERY,980
2026-04-03,NETFLIX.COM,649
2026-04-05,SPOTIFY INDIA,119
2026-04-07,AMAZON PRIME MEM,1499
2026-04-12,GOOGLE ONE STORAGE,130
2026-04-18,AUDIBLE MEMBERSHIP,199
2026-04-19,SWIGGY ORDER,290
2026-04-23,BIGBASKET GROCERY,1340
2026-05-03,NETFLIX INDIA,649
2026-05-05,SPOTIFY PREMIUM,119
2026-05-07,AMAZON PRIME MEM,1499
2026-05-12,GOOGLE ONE STORAGE,130
2026-05-18,AUDIBLE MEMBERSHIP,199
2026-05-22,SWIGGY ORDER,375
2026-05-27,BIGBASKET GROCERY,1050
`;

/* =====================================================
   SCROLL REVEAL — cards fade/slide in as they enter view
   ===================================================== */
function initScrollReveal(){
  const targets = document.querySelectorAll('.card, .roadmap-card, .statement-card');
  targets.forEach((el, i)=>{
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 6) * 55}ms`;
  });
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  targets.forEach(el=>observer.observe(el));
}
document.addEventListener('DOMContentLoaded', initScrollReveal);

/* Hero stat numbers count up on load instead of sitting static */
document.addEventListener('DOMContentLoaded', ()=>{
  animateNumber('statSignals', 6);
  animateNumber('statSavings', 2850, '₹');
});

/* =====================================================
   UI WIRING
   ===================================================== */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filenameEl = document.getElementById('filename');
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const downloadSample = document.getElementById('downloadSample');
const proc = document.getElementById('proc');
const dashboard = document.getElementById('dashboard');
const pasteBox = document.getElementById('pasteBox');
const usePasteBtn = document.getElementById('usePasteBtn');

let loadedCSVText = null;

/* ===== Ingestion tab switcher (Upload / Paste / Sample) ===== */
document.querySelectorAll('.ingest-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.ingest-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.ingest-panel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

usePasteBtn.addEventListener('click', ()=>{
  const text = pasteBox.value.trim();
  if(!text){ pasteBox.focus(); return; }
  loadedCSVText = text;
  filenameEl.textContent = '✓ Using pasted statement text';
  analyzeBtn.disabled = false;
});

dropZone.addEventListener('click', ()=>fileInput.click());
dropZone.addEventListener('dragover', e=>{e.preventDefault(); dropZone.classList.add('drag');});
dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e=>{
  e.preventDefault(); dropZone.classList.remove('drag');
  if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e=>{
  if(e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file){
  const reader = new FileReader();
  reader.onload = e=>{
    loadedCSVText = e.target.result;
    filenameEl.textContent = `✓ Loaded ${file.name}`;
    analyzeBtn.disabled = false;
  };
  reader.readAsText(file);
}

sampleBtn.addEventListener('click', ()=>{
  loadedCSVText = sampleCSV;
  filenameEl.textContent = '✓ Sample statement loaded (5 months, 7 merchants)';
  analyzeBtn.disabled = false;
});

downloadSample.addEventListener('click', ()=>{
  const blob = new Blob([sampleCSV], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sample_statement.csv';
  a.click();
  URL.revokeObjectURL(url);
});

analyzeBtn.addEventListener('click', ()=>{
  if(!loadedCSVText) return;
  analyzeBtn.disabled = true;
  runProcessingSequence();
});

/* =====================================================
   PROCESSING SEQUENCE — animates steps while /api/analyze runs
   ===================================================== */
function runProcessingSequence(){
  proc.classList.add('show');
  const steps = proc.querySelectorAll('.proc-step');
  steps.forEach(s=>s.classList.remove('active','done'));

  // Kick off the real API call immediately; the step animation below is
  // purely visual pacing so the pipeline stages are legible to the user.
  const analysisPromise = fetchAnalysis(loadedCSVText);

  let i = 0;
  function nextStep(){
    if(i>0) steps[i-1].classList.remove('active'), steps[i-1].classList.add('done');
    if(i < steps.length){
      steps[i].classList.add('active');
      i++;
      setTimeout(nextStep, 380);
    } else {
      analysisPromise
        .then(data=>{
          buildDashboard(data);
          dashboard.classList.add('show');
          dashboard.scrollIntoView({behavior:'smooth', block:'start'});
        })
        .catch(err=>{
          console.error(err);
          filenameEl.textContent = '✗ Could not analyze statement — please try again';
        })
        .finally(()=>{ analyzeBtn.disabled = false; });
    }
  }
  nextStep();
}

/* =====================================================
   API CALL — POST /api/analyze { csvText } -> full report
   ===================================================== */
async function fetchAnalysis(csvText){
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ csvText })
  });
  if(!res.ok){
    const err = await res.json().catch(()=>({error:'Unknown error'}));
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

/* =====================================================
   DASHBOARD RENDERING — consumes the /api/analyze response
   ===================================================== */
let pieChartInstance = null;
let trendChartInstance = null;

// Usage confirmations: name -> true (unused) | false (used). Untouched
// subscriptions are absent from this map and fall back to the server's
// rule-based heuristic (e.g. Audible auto-flagged as low-usage).
let usageConfirmations = {};
let lastTransactions = [];
let lastSubscriptions = []; // raw subs as returned by /api/analyze, kept for /api/recompute
let recomputeInFlight = false;

function buildDashboard(data){
  const { transactions, subscriptions, leakScore, monthlySpend, recommendations, totalSavings, aiInsight } = data;

  // Fresh analysis run — reset any usage toggles from a previous statement.
  usageConfirmations = {};
  lastTransactions = transactions;
  lastSubscriptions = subscriptions;

  const subs = subscriptions.map(s=>({ ...s, nextRenewal: new Date(s.nextRenewal) }));

  // Gauge
  const arc = document.getElementById('gaugeArc');
  const circumference = 314;
  const offset = circumference - (leakScore/100)*circumference;
  const color = leakScore >= 60 ? 'var(--red)' : leakScore >= 35 ? 'var(--amber)' : 'var(--lime)';
  arc.style.stroke = color;
  setTimeout(()=>{ arc.style.transition = 'stroke-dashoffset 1s ease'; arc.style.strokeDashoffset = offset; }, 50);
  animateNumber('leakScoreNum', leakScore);
  document.getElementById('leakScoreLabel').textContent =
    leakScore>=60 ? 'High leak risk' : leakScore>=35 ? 'Moderate leak risk' : 'Low leak risk';

  animateNumber('savingsNum', totalSavings, '₹', '/yr');
  animateNumber('monthlySpendNum', Math.round(monthlySpend), '₹', '/mo');
  document.getElementById('subCountNote').textContent = `across ${subs.length} recurring subscriptions`;

  // Subscription list
  renderSubList(subs);

  // Upcoming renewals
  const renewalList = document.getElementById('renewalList');
  const today = new Date();
  const sortedByRenewal = [...subs].sort((a,b)=> a.nextRenewal - b.nextRenewal);
  renewalList.innerHTML = sortedByRenewal.map(s=>{
    const daysUntil = Math.round((s.nextRenewal - today)/(1000*60*60*24));
    const label = daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : `in ${daysUntil}d`;
    const cls = daysUntil <= 7 ? 'soon' : 'ok';
    return `
    <div class="renewal-row">
      <div>
        <div class="renewal-name">${s.name}</div>
        <div class="renewal-date">${s.nextRenewal.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</div>
      </div>
      <div class="renewal-days ${cls}">${label}</div>
    </div>`;
  }).join('');

  // Alerts
  const alertsList = document.getElementById('alertsList');
  const hikes = subs.filter(s=>s.isHike);
  alertsList.innerHTML = hikes.length ? hikes.map(s=>`
    <div class="alert-row">
      <div class="alert-icon">▲</div>
      <div style="flex:1;">
        <div class="alert-title">${s.name} raised its price</div>
        <div class="alert-detail">₹${s.firstAmount} → ₹${s.latestAmount} over ${s.monthsSeen} months.</div>
      </div>
      <div class="alert-tag">+${Math.round(s.hikePct)}%</div>
    </div>
  `).join('') : `<div class="alert-row"><div class="alert-icon" style="color:var(--lime);">✓</div><div><div class="alert-title">No price hikes detected</div><div class="alert-detail">All recurring charges stayed flat.</div></div></div>`;

  // Recommendations
  const recList = document.getElementById('recList');
  recList.innerHTML = recommendations.map((r,i)=>`
    <div class="rec-item ${r.type}">
      <div class="rec-badge">${r.icon}</div>
      <div class="rec-body">
        <div class="t">${r.title}</div>
        <div class="s">${r.detail}</div>
      </div>
      <div class="rec-actions">
        ${r.save>0 ? `<div class="rec-save">Save ₹${r.save}/yr</div>` : ''}
        ${r.type==='warn' ? `<button class="copy-btn" data-rec="${i}">Copy cancellation message</button>` : ''}
      </div>
    </div>
  `).join('');

  // 1-Click Action Center: copy a ready-to-send cancellation/renegotiation message
  recList.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const r = recommendations[Number(btn.dataset.rec)];
      const template = `Hi team,\n\nI'd like to ${r.title.toLowerCase()}. Please process this change effective my next billing cycle and confirm once done.\n\nThanks,\n[Your name]`;
      navigator.clipboard.writeText(template).then(()=>{
        btn.textContent = 'Copied ✓';
        btn.classList.add('copied');
        setTimeout(()=>{ btn.textContent = 'Copy cancellation message'; btn.classList.remove('copied'); }, 1800);
      });
    });
  });

  // AI insight (real Gemini output if GEMINI_API_KEY is set server-side, else omitted)
  const aiNoteEl = document.querySelector('.ai-note');
  if (aiNoteEl) {
    aiNoteEl.textContent = aiInsight
      ? aiInsight
      : '';
  }

  // Charts
  const catTotals = {};
  subs.forEach(s=>{ catTotals[s.category] = (catTotals[s.category]||0) + s.latestAmount; });

  const chartTextColor = '#9198A1';
  const chartGridColor = 'rgba(43,47,53,0.7)';

  if(pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(document.getElementById('pieChart'), {
    type:'doughnut',
    data:{
      labels:Object.keys(catTotals),
      datasets:[{
        data:Object.values(catTotals),
        backgroundColor:['#C6FF3D','#3DD6F0','#FFB13D','#FF5C7A','#5B6169'],
        borderColor:'#16181C', borderWidth:3
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'bottom', labels:{color:chartTextColor, font:{family:'Inter', size:11}, boxWidth:10}}},
      cutout:'62%'
    }
  });

  const monthsSet = [...new Set(transactions.map(t=>t.date.slice(0,7)))].sort();
  const monthlyTotals = monthsSet.map(m=>{
    return transactions.filter(t=>t.date.slice(0,7)===m).reduce((sum,t)=>sum+t.amount,0);
  });
  if(trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(document.getElementById('trendChart'), {
    type:'line',
    data:{
      labels: monthsSet.map(m=>{
        const [y,mo] = m.split('-');
        return new Date(y, mo-1).toLocaleDateString('en-IN',{month:'short'});
      }),
      datasets:[{
        data: monthlyTotals,
        borderColor:'#C6FF3D', backgroundColor:'rgba(198,255,61,0.10)',
        fill:true, tension:0.35, pointBackgroundColor:'#3DD6F0', pointRadius:4
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{ticks:{color:chartTextColor, font:{family:'IBM Plex Mono', size:10}}, grid:{color:chartGridColor}},
        x:{ticks:{color:chartTextColor, font:{family:'IBM Plex Mono', size:10}}, grid:{display:false}}
      }
    }
  });
}

/* =====================================================
   CONFIRM USAGE — per-subscription Used/Unused toggle.
   The Leak Score and recommendations are recomputed instantly in the
   browser (mirrors services/leakScore.js + api/recommend.js) so the UI
   never depends on a round trip to the server. A background call to
   /api/recompute only refreshes the AI note text, and fails silently if
   that endpoint isn't available — the numbers on screen are never blocked
   on it.
   ===================================================== */
function renderSubList(subs){
  const subList = document.getElementById('subList');
  subList.innerHTML = subs.map(s=>{
    const state = usageConfirmations[s.name]; // true=unused, false=used, undefined=unconfirmed
    return `
    <div class="sub-row" data-name="${escapeAttr(s.name)}">
      <div class="sub-left">
        <div class="sub-icon">${s.icon}</div>
        <div>
          <div class="sub-name">${s.name}</div>
          <div class="sub-cat">${s.category}</div>
        </div>
      </div>
      <div class="sub-right">
        <div class="sub-amt-col">
          <div class="sub-amt">₹${s.latestAmount}/mo</div>
          ${s.isHike ? `<div class="hike-badge">↑ ${Math.round(s.hikePct)}%</div>` : ''}
        </div>
        <div class="usage-toggle" role="group" aria-label="Have you used ${escapeAttr(s.name)} in the last 30 days?">
          <button type="button" class="usage-btn used ${state === false ? 'active' : ''}" data-name="${escapeAttr(s.name)}" data-state="used">Yes, I use it</button>
          <button type="button" class="usage-btn unused ${state === true ? 'active' : ''}" data-name="${escapeAttr(s.name)}" data-state="unused">✕ Unused</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function escapeAttr(str){
  return String(str).replace(/"/g, '&quot;');
}

// Event delegation: the sub list is re-rendered on every toggle, so bind
// once on the container rather than re-attaching listeners after each render.
document.getElementById('subList').addEventListener('click', (e)=>{
  const btn = e.target.closest('.usage-btn');
  if(!btn) return;
  const name = btn.dataset.name;
  const clickedState = btn.dataset.state === 'unused'; // true if "Unused" button clicked
  // Clicking the already-active button clears the confirmation (back to
  // "unconfirmed"); otherwise it sets the new state. This makes the toggle
  // feel like a real on/off switch instead of a one-way flag.
  if(usageConfirmations[name] === clickedState){
    delete usageConfirmations[name];
  } else {
    usageConfirmations[name] = clickedState;
  }
  renderSubList(lastSubscriptions.map(s=>({ ...s })));
  applyClientRecompute();
  syncRecomputeInBackground();
});

/* ---- Client-side mirrors of services/leakScore.js + api/recommend.js ----
   Kept intentionally close to the server versions so the two never drift.
   These run instantly on toggle; the server round trip in
   syncRecomputeInBackground() only exists to refresh the Gemini AI note. */

function clamp(n, lo=0, hi=100){ return Math.max(lo, Math.min(hi, n)); }

function computeLeakScoreClient(subs){
  const total = subs.reduce((sum,s)=>sum+(s.latestAmount||0), 0);
  if(total <= 0) return { score:0, breakdown:{wasteRatio:0, hikeSeverity:0, usageConfidence:0, volume:0} };

  const wasted = subs.reduce((sum,s)=>{
    if(s.isUnused === true) return sum + s.latestAmount;
    if(s.isHike) return sum + Math.max(s.latestAmount - s.firstAmount, 0);
    return sum;
  }, 0);
  const wasteRatio = clamp((wasted/total)*100*1.4);

  const hikes = subs.filter(s=>s.isHike);
  let hikeSeverity = 0;
  if(hikes.length){
    const avgHikePct = hikes.reduce((sum,s)=>sum+s.hikePct,0) / hikes.length;
    const coverage = hikes.length / subs.length;
    hikeSeverity = clamp(clamp(avgHikePct*1.8) * (0.65 + 0.35*coverage));
  }

  const confirmedUnusedSpend = subs.filter(s=>s.isUnused===true).reduce((sum,s)=>sum+s.latestAmount,0);
  const usageConfidence = confirmedUnusedSpend > 0 ? clamp(55 + (confirmedUnusedSpend/total)*90) : 0;

  const volume = subs.length ? clamp(Math.log2(subs.length+1)*28) : 0;

  const breakdown = {
    wasteRatio: Math.round(wasteRatio),
    hikeSeverity: Math.round(hikeSeverity),
    usageConfidence: Math.round(usageConfidence),
    volume: Math.round(volume),
  };
  const weighted = breakdown.wasteRatio*0.35 + breakdown.hikeSeverity*0.30 + breakdown.usageConfidence*0.25 + breakdown.volume*0.10;
  return { score: clamp(Math.round(weighted)), breakdown };
}

function buildRecommendationsClient(subs){
  const recs = [];
  let totalSavings = 0;
  const handled = new Set();

  subs.forEach(s=>{
    if(s.isUnused === true){
      const save = Math.round(s.latestAmount*12);
      recs.push({ type:'warn', icon:'✂', title:`Cancel ${s.name}`, detail:`You confirmed you haven't used this in the last 30 days. Canceling saves ₹${save}/yr with zero impact on your routine.`, save });
      totalSavings += save;
      handled.add(s.name);
    } else if(s.isUnused === false){
      handled.add(s.name);
    }
  });

  subs.forEach(s=>{
    if(s.isHike){
      const yearlyDelta = Math.round(s.latestAmount*12 - s.firstAmount*12);
      const save = yearlyDelta > 0 ? yearlyDelta : Math.round(s.latestAmount*12*0.35);
      recs.push({ type:'warn', icon:'↓', title:`Downgrade or renegotiate ${s.name}`, detail:`₹${s.firstAmount} → ₹${s.latestAmount} (+${Math.round(s.hikePct)}%). A lower tier could recover this.`, save });
      totalSavings += save;
    }
  });

  const audible = subs.find(s=>s.name==='Audible');
  if(audible && !handled.has('Audible')){
    const save = Math.round(audible.latestAmount*12);
    recs.push({ type:'warn', icon:'✂', title:'Cancel Audible', detail:'No strong usage signal in the statement — a common low-utilization leak. Confirm above if you actually use it.', save });
    totalSavings += save;
  }

  const prime = subs.find(s=>s.name==='Amazon Prime');
  if(prime && !handled.has('Amazon Prime')){
    recs.push({ type:'keep', icon:'✓', title:'Keep Amazon Prime', detail:'Frequent activity alongside it suggests active, regular use.', save:0 });
  }

  if(recs.length === 0){
    recs.push({ type:'keep', icon:'✓', title:'No major leaks found', detail:'Your subscriptions look stable and reasonably priced.', save:0 });
  }

  return { recs, totalSavings };
}

function applyClientRecompute(){
  const annotated = lastSubscriptions.map(s=>({ ...s, isUnused: usageConfirmations[s.name] }));
  const { score, breakdown } = computeLeakScoreClient(annotated);
  const { recs, totalSavings } = buildRecommendationsClient(annotated);
  renderScoreAndRecs(score, breakdown, recs, totalSavings);
}

// Best-effort background sync purely for the Gemini-generated AI note — the
// numeric UI above never waits on this, so a missing/slow endpoint never
// makes the toggle look broken.
async function syncRecomputeInBackground(){
  if(!lastSubscriptions.length || recomputeInFlight) return;
  recomputeInFlight = true;
  try{
    const unusedNames = Object.keys(usageConfirmations).filter(n=>usageConfirmations[n] === true);
    const usedNames = Object.keys(usageConfirmations).filter(n=>usageConfirmations[n] === false);
    const res = await fetch('/api/recompute', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ subscriptions: lastSubscriptions, unusedNames, usedNames })
    });
    if(!res.ok) return;
    const data = await res.json();
    const aiNoteEl = document.querySelector('.ai-note');
    if(aiNoteEl && data.aiInsight) aiNoteEl.textContent = data.aiInsight;
  }catch(err){
    // Silent by design — this is enrichment only, never a dependency.
  }finally{
    recomputeInFlight = false;
  }
}

// Updates the gauge, savings figure, and recommendation cards in place —
// without touching the charts or renewal dates, which don't depend on usage.
function renderScoreAndRecs(leakScore, breakdown, recommendations, totalSavings){
  const arc = document.getElementById('gaugeArc');
  const circumference = 314;
  const offset = circumference - (leakScore/100)*circumference;
  const color = leakScore >= 60 ? 'var(--red)' : leakScore >= 35 ? 'var(--amber)' : 'var(--lime)';
  arc.style.transition = 'stroke-dashoffset .6s ease, stroke .3s ease';
  arc.style.stroke = color;
  arc.style.strokeDashoffset = offset;
  animateNumber('leakScoreNum', leakScore);
  document.getElementById('leakScoreLabel').textContent =
    leakScore>=60 ? 'High leak risk' : leakScore>=35 ? 'Moderate leak risk' : 'Low leak risk';

  // Startup-style transparency: surface which factor is driving the score.
  const descEl = document.querySelector('.gauge-info .desc');
  if(descEl && breakdown){
    const top = Object.entries(breakdown).sort((a,b)=>b[1]-a[1])[0];
    const labels = { wasteRatio:'wasted spend', hikeSeverity:'price hikes', usageConfidence:'confirmed-unused subscriptions', volume:'subscription count' };
    descEl.textContent = top && top[1] > 0
      ? `Driven mostly by ${labels[top[0]]}.`
      : 'Higher = more silent leaks found.';
  }

  animateNumber('savingsNum', totalSavings, '₹', '/yr');

  const recList = document.getElementById('recList');
  recList.innerHTML = recommendations.map((r,i)=>`
    <div class="rec-item ${r.type}">
      <div class="rec-badge">${r.icon}</div>
      <div class="rec-body">
        <div class="t">${r.title}</div>
        <div class="s">${r.detail}</div>
      </div>
      <div class="rec-actions">
        ${r.save>0 ? `<div class="rec-save">Save ₹${r.save}/yr</div>` : ''}
        ${r.type==='warn' ? `<button class="copy-btn" data-rec="${i}">Copy cancellation message</button>` : ''}
      </div>
    </div>
  `).join('');
  recList.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const r = recommendations[Number(btn.dataset.rec)];
      const template = `Hi team,\n\nI'd like to ${r.title.toLowerCase()}. Please process this change effective my next billing cycle and confirm once done.\n\nThanks,\n[Your name]`;
      navigator.clipboard.writeText(template).then(()=>{
        btn.textContent = 'Copied ✓';
        btn.classList.add('copied');
        setTimeout(()=>{ btn.textContent = 'Copy cancellation message'; btn.classList.remove('copied'); }, 1800);
      });
    });
  });
}

function animateNumber(id, target, prefix='', suffix=''){
  const el = document.getElementById(id);
  const start = 0;
  const duration = 700;
  const startTime = performance.now();
  function tick(now){
    const p = Math.min((now-startTime)/duration, 1);
    const val = Math.round(start + (target-start)*p);
    el.textContent = `${prefix}${val.toLocaleString('en-IN')}${suffix}`;
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}