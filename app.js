// ─── STATE ────────────────────────────────────────────────────────────────────
let beam = 'cantilever', load = 'point', sect = 'rect';
let combinedLoad = false; // when true, point load + UDL applied simultaneously
let savedSect = 'rect';
let view = '2d';
let rotX = 0.4, rotY = 0.5, drag = false, lmx, lmy;
let sectionMode = 'custom';
let stdSectionOverride = null;
let lastParams = null;
// Multi-span state
let spanCount = 1;
let spanLengths   = [8, 8, 8];
let spanLoads     = [50, 50, 50];
let spanLoadTypes = ['udl', 'udl', 'udl']; // 'udl' or 'point' per span
let spanLoadPos   = [0.5, 0.5, 0.5];       // point load position as fraction of span

// ─── PRO / MONETIZATION (mock — swap for real subscription check once billing is wired up) ────
let isPro = localStorage.getItem('structaviz-pro') === 'true';

// ─── APP MODE (Beam / Slab) ─────────────────────────────────────────────────
let appMode = 'beam';

// ─── THEME ────────────────────────────────────────────────────────────────────
function setTheme(t) {
  const root = document.documentElement;
  if (t === 'device') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  localStorage.setItem('structaviz-theme', t);
  if (lastParams) go();
}
const savedTheme = localStorage.getItem('structaviz-theme') || 'dark';
document.getElementById('themeSelect').value = savedTheme;
setTheme(savedTheme);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sv(id, v, u) { document.getElementById(id).textContent = v + u; }
function getCSSVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function updatePosLabel() {
  const pct = parseFloat(document.getElementById('sPos').value) / 100;
  document.getElementById('vPos').textContent = pct.toFixed(2) + 'L';
}

function getLoadPos() {
  // Returns load position 'a' as fraction of L (0–1), only used for point loads
  return parseFloat(document.getElementById('sPos').value) / 100;
}

// Show/hide load position slider based on load type
function updateLoadPosVisibility() {
  document.getElementById('loadPosWrap').style.display = load === 'point' ? '' : 'none';
}

// ─── SPAN COUNT SELECTOR ──────────────────────────────────────────────────────
function setSpanCount(n) {
  spanCount = n;
  document.querySelectorAll('.span-count-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('spanBtn'+n).classList.add('on');

  // Show/hide single-span beam type buttons
  const singleSpanBeamSec = document.getElementById('singleSpanBeamSec');
  singleSpanBeamSec.style.display = n === 1 ? '' : 'none';

  // Show/hide multi-span controls
  document.getElementById('multiSpanControls').style.display = n > 1 ? '' : 'none';

  // Show/hide single-span load type and position (only for single span)
  document.getElementById('singleSpanLoadSec').style.display = n === 1 ? '' : 'none';

  if (n > 1) buildSpanControls();
  go();
}

function buildSpanControls() {
  const wrap = document.getElementById('spanControlsWrap');
  wrap.innerHTML = '';
  for (let i = 0; i < spanCount; i++) {
    const isPoint = spanLoadTypes[i] === 'point';
    wrap.innerHTML += `
      <div style="margin-bottom:14px;">
        <div class="sec-label">Span ${i+1}</div>
        <div class="ctrl">
          <div class="ctrl-row">
            <span class="ctrl-name">Length (m)</span>
            <span class="ctrl-val" id="vSpanL${i}">${spanLengths[i]}</span>
          </div>
          <input type="range" min="1" max="20" value="${spanLengths[i]}"
            oninput="spanLengths[${i}]=parseFloat(this.value);document.getElementById('vSpanL${i}').textContent=this.value;go()">
        </div>
        <div class="load-grid" style="margin-bottom:8px;">
          <div class="ltype ${!isPoint?'on':''}" onclick="setSpanLoadType(${i},'udl',this)">UDL</div>
          <div class="ltype ${isPoint?'on':''}"  onclick="setSpanLoadType(${i},'point',this)">Point</div>
        </div>
        <div class="ctrl">
          <div class="ctrl-row">
            <span class="ctrl-name" id="spanLoadLabel${i}">${isPoint?'Load (kN)':'UDL (kN/m)'}</span>
            <span class="ctrl-val" id="vSpanW${i}">${spanLoads[i]}</span>
          </div>
          <input type="range" min="1" max="300" value="${spanLoads[i]}"
            oninput="spanLoads[${i}]=parseFloat(this.value);document.getElementById('vSpanW${i}').textContent=this.value;go()">
        </div>
        <div id="spanPosWrap${i}" style="display:${isPoint?'':'none'};">
          <div class="ctrl">
            <div class="ctrl-row">
              <span class="ctrl-name">Load position</span>
              <span class="ctrl-val" id="vSpanPos${i}">${spanLoadPos[i].toFixed(2)}L</span>
            </div>
            <input type="range" min="5" max="95" value="${Math.round(spanLoadPos[i]*100)}"
              oninput="spanLoadPos[${i}]=this.value/100;document.getElementById('vSpanPos${i}').textContent=(this.value/100).toFixed(2)+'L';go()">
          </div>
        </div>
      </div>`;
  }
}

function setSpanLoadType(i, type, el) {
  spanLoadTypes[i] = type;
  // Update toggle UI
  const grid = el.parentElement;
  grid.querySelectorAll('.ltype').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  // Update label and show/hide position
  document.getElementById('spanLoadLabel'+i).textContent = type==='point' ? 'Load (kN)' : 'UDL (kN/m)';
  document.getElementById('spanPosWrap'+i).style.display = type==='point' ? '' : 'none';
  go();
}

// ─── SECTION DEFINITIONS ─────────────────────────────────────────────────────
const SECTIONS = {
  rect:   { label: 'Rectangular' },
  ibeam:  { label: 'I-Beam'      },
  circ:   { label: 'Circular'    },
  hollow: { label: 'Hollow Box'  },
};

// ─── KENYA CODE LIMITS ────────────────────────────────────────────────────────
const KS = { sf_min: 1.67, stress_util_max: 0.90 };

// ─── STANDARD SECTION LIBRARY ────────────────────────────────────────────────
// UB/UC include LTB properties per BS 4 / BS 5950 Table 19:
//   ry  = minor axis radius of gyration (cm)
//   Sx  = plastic modulus major axis (cm³)
//   u   = buckling parameter
//   x   = torsional index
const STD_SECTIONS = {
  UB: [
    {name:'UB 127×76×13',  h:127,  b:76,   I:473,   A:16.5,  tw:4.0, tf:7.6,  kg_m:13,  ry:1.84, Sx:84.2,  u:0.855, x:16.3},
    {name:'UB 152×89×16',  h:152,  b:89,   I:834,   A:20.3,  tw:4.5, tf:7.7,  kg_m:16,  ry:2.09, Sx:123,   u:0.869, x:19.6},
    {name:'UB 178×102×19', h:178,  b:102,  I:1356,  A:24.3,  tw:4.8, tf:7.9,  kg_m:19,  ry:2.37, Sx:171,   u:0.874, x:23.3},
    {name:'UB 203×102×23', h:203,  b:102,  I:2105,  A:29.4,  tw:5.4, tf:9.3,  kg_m:23,  ry:2.36, Sx:234,   u:0.853, x:23.5},
    {name:'UB 203×133×25', h:203,  b:133,  I:2340,  A:32.0,  tw:5.7, tf:7.8,  kg_m:25,  ry:3.10, Sx:259,   u:0.882, x:28.7},
    {name:'UB 254×102×22', h:254,  b:102,  I:2841,  A:28.0,  tw:5.1, tf:6.8,  kg_m:22,  ry:2.22, Sx:258,   u:0.846, x:30.1},
    {name:'UB 254×146×31', h:254,  b:146,  I:4413,  A:39.7,  tw:6.1, tf:8.6,  kg_m:31,  ry:3.36, Sx:393,   u:0.877, x:30.9},
    {name:'UB 305×102×25', h:305,  b:102,  I:4455,  A:31.7,  tw:5.8, tf:7.0,  kg_m:25,  ry:2.23, Sx:336,   u:0.846, x:37.3},
    {name:'UB 305×127×37', h:305,  b:127,  I:7162,  A:47.2,  tw:7.2, tf:10.7, kg_m:37,  ry:2.90, Sx:539,   u:0.872, x:31.3},
    {name:'UB 305×165×40', h:305,  b:165,  I:8503,  A:51.3,  tw:6.1, tf:10.2, kg_m:40,  ry:3.86, Sx:623,   u:0.891, x:33.7},
    {name:'UB 356×127×33', h:356,  b:127,  I:8196,  A:42.1,  tw:6.0, tf:8.5,  kg_m:33,  ry:2.86, Sx:539,   u:0.862, x:42.7},
    {name:'UB 356×171×45', h:356,  b:171,  I:12070, A:57.3,  tw:7.0, tf:9.7,  kg_m:45,  ry:3.84, Sx:775,   u:0.880, x:38.4},
    {name:'UB 406×140×39', h:406,  b:140,  I:12452, A:49.7,  tw:6.4, tf:8.6,  kg_m:39,  ry:2.87, Sx:718,   u:0.859, x:49.5},
    {name:'UB 406×178×54', h:406,  b:178,  I:18720, A:68.8,  tw:7.7, tf:10.9, kg_m:54,  ry:3.85, Sx:1060,  u:0.877, x:41.3},
    {name:'UB 457×152×52', h:457,  b:152,  I:21345, A:66.6,  tw:7.6, tf:10.9, kg_m:52,  ry:3.11, Sx:1100,  u:0.861, x:47.5},
    {name:'UB 457×191×67', h:457,  b:191,  I:29380, A:85.5,  tw:8.5, tf:12.7, kg_m:67,  ry:4.12, Sx:1470,  u:0.872, x:43.9},
    {name:'UB 533×210×82', h:533,  b:209,  I:47540, A:104.4, tw:9.6, tf:13.2, kg_m:82,  ry:4.38, Sx:2060,  u:0.875, x:49.4},
    {name:'UB 610×229×101',h:610,  b:227,  I:75780, A:128.6, tw:10.6,tf:14.8, kg_m:101, ry:4.75, Sx:2880,  u:0.877, x:51.5},
  ],
  UC: [
    {name:'UC 152×152×23', h:152,  b:152,  I:1250,  A:29.8,  tw:6.1, tf:6.8,  kg_m:23,  ry:3.68, Sx:182,   u:0.848, x:20.6},
    {name:'UC 152×152×37', h:161,  b:154,  I:2210,  A:47.1,  tw:8.0, tf:11.5, kg_m:37,  ry:3.87, Sx:309,   u:0.848, x:13.7},
    {name:'UC 203×203×46', h:203,  b:203,  I:4568,  A:58.8,  tw:7.2, tf:11.0, kg_m:46,  ry:5.11, Sx:497,   u:0.848, x:17.7},
    {name:'UC 203×203×60', h:210,  b:206,  I:6125,  A:76.4,  tw:9.4, tf:14.2, kg_m:60,  ry:5.20, Sx:656,   u:0.848, x:14.1},
    {name:'UC 254×254×73', h:254,  b:254,  I:11410, A:93.1,  tw:8.6, tf:14.2, kg_m:73,  ry:6.48, Sx:990,   u:0.848, x:17.3},
    {name:'UC 254×254×89', h:260,  b:256,  I:14270, A:113.8, tw:10.5,tf:17.3, kg_m:89,  ry:6.55, Sx:1220,  u:0.848, x:14.5},
    {name:'UC 305×305×97', h:308,  b:305,  I:22250, A:123.3, tw:9.9, tf:15.4, kg_m:97,  ry:7.69, Sx:1590,  u:0.848, x:18.5},
    {name:'UC 305×305×118',h:314,  b:307,  I:27700, A:150.2, tw:11.9,tf:18.7, kg_m:118, ry:7.77, Sx:1950,  u:0.848, x:15.4},
  ],
  RHS: [
    {name:'RHS 100×50×4',  h:100,  b:50,   I:135,   A:10.9,  kg_m:8.6,  t:4},
    {name:'RHS 120×60×5',  h:120,  b:60,   I:236,   A:16.5,  kg_m:13.0, t:5},
    {name:'RHS 150×100×5', h:150,  b:100,  I:526,   A:23.6,  kg_m:18.5, t:5},
    {name:'RHS 150×100×6', h:150,  b:100,  I:618,   A:27.9,  kg_m:21.9, t:6},
    {name:'RHS 200×100×6', h:200,  b:100,  I:1138,  A:34.6,  kg_m:27.2, t:6},
    {name:'RHS 200×100×8', h:200,  b:100,  I:1461,  A:45.3,  kg_m:35.5, t:8},
    {name:'RHS 250×150×8', h:250,  b:150,  I:3178,  A:60.5,  kg_m:47.5, t:8},
    {name:'RHS 300×200×8', h:300,  b:200,  I:7180,  A:77.5,  kg_m:60.8, t:8},
    {name:'RHS 300×200×10',h:300,  b:200,  I:8760,  A:95.8,  kg_m:75.3, t:10},
  ],
  CHS: [
    {name:'CHS 60.3×4',    h:60.3, b:60.3, I:25.6,  A:7.07,  kg_m:5.55},
    {name:'CHS 76.1×4',    h:76.1, b:76.1, I:53.5,  A:9.07,  kg_m:7.11},
    {name:'CHS 88.9×5',    h:88.9, b:88.9, I:102,   A:13.4,  kg_m:10.5},
    {name:'CHS 114.3×5',   h:114.3,b:114.3,I:222,   A:17.4,  kg_m:13.7},
    {name:'CHS 139.7×5',   h:139.7,b:139.7,I:409,   A:21.4,  kg_m:16.8},
    {name:'CHS 168.3×6',   h:168.3,b:168.3,I:884,   A:30.7,  kg_m:24.0},
    {name:'CHS 219.1×8',   h:219.1,b:219.1,I:2764,  A:53.2,  kg_m:41.7},
    {name:'CHS 273×8',     h:273,  b:273,  I:5401,  A:66.8,  kg_m:52.4},
  ],
};

// ─── SECTION MODE ─────────────────────────────────────────────────────────────
function setSectionMode(mode) {
  sectionMode = mode;
  document.getElementById('modeCustom').classList.toggle('on', mode === 'custom');
  document.getElementById('modeStd').classList.toggle('on', mode === 'std');
  document.getElementById('paramSecWrap').style.display    = mode === 'custom' ? '' : 'none';
  document.getElementById('stdSecWrap').style.display      = mode === 'std'    ? '' : 'none';
  document.getElementById('paramHeightWrap').style.display = mode === 'custom' ? '' : 'none';
  if (mode === 'std') { savedSect = sect; stdSectionOverride = null; populateStdSections(); }
  else { stdSectionOverride = null; sect = savedSect; buildSectionGrid(); go(); }
}

function populateStdSections() {
  const cat = document.getElementById('stdCat').value;
  const sel = document.getElementById('stdSec');
  sel.innerHTML = STD_SECTIONS[cat].map((s,i) => `<option value="${i}">${s.name}</option>`).join('');
  applyStdSection();
}

function applyStdSection() {
  const cat = document.getElementById('stdCat').value;
  const idx = parseInt(document.getElementById('stdSec').value);
  const s = STD_SECTIONS[cat][idx];
  if (!s) return;
  const h = s.h/1000, b = s.b/1000;
  const I = s.I * 1e-8, A = s.A * 1e-4;
  const type = (cat==='UB'||cat==='UC') ? 'ibeam' : cat==='CHS' ? 'circ' : 'hollow';
  stdSectionOverride = { I, A, b, h, type, kg_m: s.kg_m, name: s.name,
    ry: s.ry || null, Sx: s.Sx || null, u: s.u || null, x: s.x || null };
  document.getElementById('stdSecInfo').innerHTML =
    `<span>${s.name}</span><br>I = <span>${s.I} cm⁴</span> &nbsp; A = <span>${s.A} cm²</span><br>` +
    `h = <span>${s.h} mm</span> &nbsp; b = <span>${s.b} mm</span><br>Mass = <span>${s.kg_m} kg/m</span>`;
  go();
}

// ─── SECTION THUMBNAILS ───────────────────────────────────────────────────────
function drawSectionThumb(canvas, type, active) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const col = active ? '#3b82f6' : '#64748b';
  ctx.strokeStyle = col; ctx.fillStyle = col + '22'; ctx.lineWidth = 1.5;
  const cx = W/2, cy = H/2;
  if (type==='rect') { ctx.beginPath(); ctx.rect(cx-14,cy-10,28,20); ctx.fill(); ctx.stroke(); }
  else if (type==='ibeam') {
    ctx.beginPath(); ctx.rect(cx-14,cy-10,28,4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(cx-3,cy-6,6,12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(cx-14,cy+6,28,4); ctx.fill(); ctx.stroke();
  } else if (type==='circ') { ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
  else if (type==='hollow') {
    ctx.beginPath(); ctx.rect(cx-14,cy-10,28,20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = active ? '#1a1e27' : '#13161c';
    ctx.beginPath(); ctx.rect(cx-9,cy-5,18,10); ctx.fill(); ctx.stroke();
  }
}

function buildSectionGrid() {
  const grid = document.getElementById('sec-grid');
  grid.innerHTML = '';
  Object.entries(SECTIONS).forEach(([key, info]) => {
    const d = document.createElement('div');
    d.className = 'stype' + (key===sect ? ' on' : '');
    d.onclick = () => { sect=key; savedSect=key; stdSectionOverride=null; buildSectionGrid(); go(); };
    const c = document.createElement('canvas');
    c.width=60; c.height=40; c.style.width='60px'; c.style.height='40px';
    d.appendChild(c);
    d.appendChild(document.createTextNode(info.label));
    grid.appendChild(d);
    drawSectionThumb(c, key, key===sect);
  });
}

// ─── SELECTORS ────────────────────────────────────────────────────────────────
function setBeam(t, el) {
  beam = t;
  document.querySelectorAll('.btype').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  go();
}

function setLoad(t, el) {
  load = t;
  document.querySelectorAll('.ltype').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const labels = { point:'Load (kN)', dist:'Load rate (kN/m)', tri:'Peak rate (kN/m)' };
  document.getElementById('loadLabel').textContent = labels[t];
  // Combined load only makes sense with point as the primary load
  const combineWrap = document.getElementById('combineWrap');
  if (combineWrap) combineWrap.style.display = t === 'point' ? '' : 'none';
  if (t !== 'point') { combinedLoad = false; document.getElementById('combinedCheck').checked = false; updateCombinedUDLVisibility(); }
  updateLoadPosVisibility();
  go();
}

function toggleCombined() {
  combinedLoad = document.getElementById('combinedCheck').checked;
  updateCombinedUDLVisibility();
  go();
}

function updateCombinedUDLVisibility() {
  const el = document.getElementById('combinedUDLWrap');
  if (el) el.style.display = combinedLoad ? '' : 'none';
}

function setView(v, el) {
  view = v;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const map = {'2d':'view2d','3d':'view3d','section':'viewSec','ai':'viewAI'};
  Object.values(map).forEach(id => { const e=document.getElementById(id); if(e) e.style.display='none'; });
  const target = document.getElementById(map[v]);
  if (target) target.style.display = v==='ai' ? '' : '';
  if (v === 'ai') {
    const panel = document.getElementById('aiPanel');
    const paywall = document.getElementById('aiPaywall');
    if (isPro) {
      panel.style.display = 'flex';
      paywall.style.display = 'none';
    } else {
      panel.style.display = 'none';
      paywall.style.display = 'flex';
    }
  }
  if (v !== 'ai') go();
}

// ─── PRO GATING ────────────────────────────────────────────────────────────────
function updateProUI() {
  const lock = document.getElementById('aiTabLock');
  if (lock) lock.style.display = isPro ? 'none' : '';

  const optLock = document.getElementById('optimizerLock');
  const optUnlocked = document.getElementById('optimizerUnlocked');
  const optLocked = document.getElementById('optimizerLocked');
  if (optLock) optLock.style.display = isPro ? 'none' : '';
  if (optUnlocked) optUnlocked.style.display = isPro ? '' : 'none';
  if (optLocked) optLocked.style.display = isPro ? 'none' : '';

  // If AI tab is currently open, refresh which panel shows
  if (view === 'ai') {
    const panel = document.getElementById('aiPanel');
    const paywall = document.getElementById('aiPaywall');
    if (panel && paywall) {
      panel.style.display = isPro ? 'flex' : 'none';
      paywall.style.display = isPro ? 'none' : 'flex';
    }
  }
}

function upgradeToPro() {
  // Placeholder until NOWPayments (or chosen billing) is wired up.
  alert('Pro billing is coming soon! For now this is a preview of the upgrade flow.');
}

// Dev/testing helper — call setProStatus(true) or setProStatus(false) in the browser console
// to preview both states before real billing/entitlement checks exist.
function setProStatus(val) {
  isPro = !!val;
  localStorage.setItem('structaviz-pro', String(isPro));
  updateProUI();
  console.log('StructaViz Pro status set to:', isPro);
}
window.setProStatus = setProStatus;

updateProUI();

// ─── SECTION PROPERTIES ───────────────────────────────────────────────────────
function getSection(h, ratio) {
  if (stdSectionOverride) return stdSectionOverride;
  const b = h * ratio;
  if (sect==='rect')   return { I:(b*h*h*h)/12, A:b*h, b, h, type:'rect' };
  if (sect==='ibeam') {
    const tf=h*0.12, tw=h*0.06, bf=b;
    const Ifl=2*((bf*tf*tf*tf)/12 + bf*tf*((h-tf)/2)*((h-tf)/2));
    const Iw=(tw*(h-2*tf)*(h-2*tf)*(h-2*tf))/12;
    return { I:Ifl+Iw, A:2*bf*tf+tw*(h-2*tf), b, h, tf, tw, bf, type:'ibeam' };
  }
  if (sect==='circ') {
    const r=h/2;
    return { I:(Math.PI*r*r*r*r)/4, A:Math.PI*r*r, b:h, h, type:'circ' };
  }
  if (sect==='hollow') {
    const t=h*0.12, bo=b, bi=b-2*t, ho=h, hi=h-2*t;
    return { I:(bo*ho*ho*ho-bi*hi*hi*hi)/12, A:bo*ho-bi*hi, b, h, t, type:'hollow' };
  }
}

// ─── WEB SHEAR CAPACITY ───────────────────────────────────────────────────────
// Returns shear capacity Vpl (N) based on KS 02-104 / BS 5950 cl 4.2
// Av = shear area; py = design strength (approx fy for working stress)
function shearCapacity(sec, fy) {
  const curType = stdSectionOverride ? stdSectionOverride.type : sect;
  let Av = 0;
  const h = sec.h, b = sec.b;
  if (curType === 'ibeam') {
    // Shear area = web area = tw × (h - 2tf) for I-sections
    const tw = sec.tw || h * 0.06;
    const tf = sec.tf || h * 0.12;
    Av = tw * (h - 2 * tf);
  } else if (curType === 'circ') {
    // CHS: Av = 0.6 × A (BS 5950 cl 4.2.3)
    Av = 0.6 * sec.A;
  } else if (curType === 'hollow') {
    // RHS: Av = A × h/(h+b) — web contribution
    Av = sec.A * h / (h + b);
  } else {
    // Solid rectangular: Av = 0.9 × A (conservative)
    Av = 0.9 * sec.A;
  }
  // Vpl = 0.6 × fy × Av  (plastic shear capacity, BS 5950 cl 4.2.3)
  return 0.6 * fy * Av;
}

// ─── REACTION FORCES ─────────────────────────────────────────────────────────
// Returns { RL, RR, MA, MB } in N (and N·m for moments at fixed ends).
// MA/MB are fixed-end moments (non-zero only for fixed-fixed beam).
function getReactions(p) {
  const { P, w, L, sw, a } = p;
  const b_ = L - a;
  let RL = 0, RR = 0, MA = 0, MB = 0;

  // Applied load reactions
  if (load === 'point') {
    if (beam === 'cantilever') {
      RL = P; RR = 0; MA = P * a;
    } else if (beam === 'simply') {
      RL = (P * b_) / L; RR = (P * a) / L;
    } else { // fixed-fixed
      MA = (P * a * b_ * b_) / (L * L);
      MB = (P * a * a * b_) / (L * L);
      RL = (P * b_) / L + (MA - MB) / L;
      RR = P - RL;
    }
    // Superimpose combined UDL if active
    if (combinedLoad && w > 0) {
      if (beam === 'cantilever') {
        RL += w * L; MA += (w * L * L) / 2;
      } else if (beam === 'simply') {
        RL += (w * L) / 2; RR += (w * L) / 2;
      } else {
        MA += (w * L * L) / 12; MB += (w * L * L) / 12;
        RL += (w * L) / 2; RR += (w * L) / 2;
      }
    }
  } else if (load === 'dist') {
    if (beam === 'cantilever') {
      RL = w * L; RR = 0; MA = (w * L * L) / 2;
    } else if (beam === 'simply') {
      RL = RR = (w * L) / 2;
    } else {
      MA = MB = (w * L * L) / 12;
      RL = RR = (w * L) / 2;
    }
  } else if (load === 'tri') {
    if (beam === 'cantilever') {
      RL = (w * L) / 2; RR = 0; MA = (w * L * L) / 6;
    } else if (beam === 'simply') {
      RL = (w * L) / 6; RR = (w * L) / 3;
    } else {
      MA =  (w * L * L) / 20;
      MB = -(w * L * L) / 30;
      RL = (w * L) / 6 - (MA - MB) / L;
      RR = (w * L) / 2 - RL;
    }
  }

  // Add self-weight contribution
  if (sw > 0) {
    if (beam === 'cantilever') {
      RL += sw * L; MA += (sw * L * L) / 2;
    } else if (beam === 'simply') {
      RL += (sw * L) / 2; RR += (sw * L) / 2;
    } else {
      RL += (sw * L) / 2; RR += (sw * L) / 2;
      MA += (sw * L * L) / 12; MB += (sw * L * L) / 12;
    }
  }

  return { RL, RR, MA, MB };
}

// ─── PARAMETER COLLECTION ────────────────────────────────────────────────────
function getParams() {
  const matStr  = document.getElementById('sMat').value.split(',');
  const E       = parseFloat(matStr[0]) * 1e9;
  const fy      = parseFloat(matStr[1]) * 1e6;
  const density = parseFloat(matStr[2]);
  const L       = parseFloat(document.getElementById('sLen').value);
  const sliderVal = parseFloat(document.getElementById('sLoad').value) * 1000;
  const P  = load === 'point' ? sliderVal : 0;
  const w  = (load === 'dist' || load === 'tri') ? sliderVal
           : (combinedLoad ? (parseFloat(document.getElementById('sCombinedUDL').value)||0) * 1000 : 0);
  const a  = getLoadPos() * L;   // absolute load position for point loads
  const h  = stdSectionOverride ? stdSectionOverride.h : parseFloat(document.getElementById('sH').value)/1000;
  const ratio = parseFloat(document.getElementById('sR').value)/10;
  const sec = getSection(h, ratio);
  const selfW = document.getElementById('selfWeight').checked;
  const sw  = selfW ? sec.A * density * 9.81 : 0;
  return { P, w, L, h, E, fy, density, sec, sw, a };
}

// ─── DEFLECTION ───────────────────────────────────────────────────────────────
// Point load position is now arbitrary (a = distance from left support).
// Cantilever: load position 'a' counts from the fixed wall;
//   for a cantilever, load can be placed anywhere along the span.
function defAt(x, p) {
  const { P, w, L, E, sec:{I}, sw, a } = p;
  const EI = E * I;
  const b_  = L - a;   // distance from load to right end
  let d = 0;

  if (load === 'point') {
    if (beam === 'cantilever') {
      // Load at position 'a' from fixed end; for x <= a, beam curves fully; x > a, straight
      d = x <= a
        ? (P * x * x * (3 * a - x)) / (6 * EI)
        : (P * a * a * (3 * x - a)) / (6 * EI);
    } else if (beam === 'simply') {
      d = x <= a
        ? (P * b_ * x * (L*L - b_*b_ - x*x)) / (6 * EI * L)
        : (P * a  * (L-x) * (L*L - a*a - (L-x)*(L-x))) / (6 * EI * L);
    } else {
      // Fixed-fixed, general load position
      d = x <= a
        ? (P * b_*b_ * x*x * (3*a*L - (3*a+b_)*x)) / (6 * EI * L*L*L)
        : (P * a*a  * (L-x)*(L-x) * (3*b_*L - (3*b_+a)*(L-x))) / (6 * EI * L*L*L);
    }
  } else if (load === 'dist') {
    if (beam === 'cantilever') {
      d = (w * x*x * (6*L*L - 4*L*x + x*x)) / (24 * EI);
    } else if (beam === 'simply') {
      d = (w * x * (L*L*L - 2*L*x*x + x*x*x)) / (24 * EI);
    } else {
      d = (w * x*x * (L-x)*(L-x)) / (24 * EI);
    }
  } else if (load === 'tri') {
    if (beam === 'cantilever') {
      d = (w * x*x * (10*L*L*L - 10*L*L*x + 5*L*x*x - x*x*x)) / (120 * EI * L);
    } else if (beam === 'simply') {
      d = (w * x * (7*L*L*L*L - 10*L*L*x*x + 3*x*x*x*x)) / (360 * EI * L);
    } else {
      d = (w * x*x * (L-x)*(L-x) * (7*L - 3*x)) / (360 * EI * L*L);
    }
  }

  if (sw > 0) {
    let ds = 0;
    if (beam === 'cantilever') ds = (sw * x*x * (6*L*L - 4*L*x + x*x)) / (24 * EI);
    else if (beam === 'simply') ds = (sw * x * (L*L*L - 2*L*x*x + x*x*x)) / (24 * EI);
    else ds = (sw * x*x * (L-x)*(L-x)) / (24 * EI);
    d += ds;
  }
  return d;
}

// ─── BENDING MOMENT ───────────────────────────────────────────────────────────
function momAt(x, p) {
  const { P, w, L, sw, a } = p;
  const b_ = L - a;
  let m = 0;

  if (load === 'point') {
    if (beam === 'cantilever') {
      m = x <= a ? P * (a - x) : 0;
    } else if (beam === 'simply') {
      m = x <= a ? (P * b_ * x) / L : (P * a * (L - x)) / L;
    } else {
      // Fixed-fixed general load position
      const MA = (P * a * b_*b_) / (L*L);
      const MB = (P * a*a * b_) / (L*L);
      const RL = (P * b_) / L + (MA - MB) / L;
      m = x <= a ? RL * x - MA : RL * x - MA - P * (x - a);
    }
  } else if (load === 'dist') {
    if (beam === 'cantilever') {
      m = (w * (L-x)*(L-x)) / 2;
    } else if (beam === 'simply') {
      m = (w * x * (L-x)) / 2;
    } else {
      m = (w/12) * (6*L*x - 6*x*x - L*L);
    }
  } else if (load === 'tri') {
    if (beam === 'cantilever') {
      m = (w * (L-x)*(L-x)*(L-x)) / (6*L);
    } else if (beam === 'simply') {
      m = (w*L*x)/6 - (w*x*x*x)/(6*L);
    } else {
      const MA =  (w*L*L)/20;
      const MB = -(w*L*L)/30;
      const RL = (w*L)/6 - (MA - MB)/L;
      m = RL*x - MA - (w*x*x*x)/(6*L);
    }
  }

  if (sw > 0) {
    let ms = 0;
    if (beam === 'cantilever') ms = (sw*(L-x)*(L-x))/2;
    else if (beam === 'simply') ms = (sw*x*(L-x))/2;
    else ms = (sw/12)*(6*L*x - 6*x*x - L*L);
    m += ms;
  }
  return m;
}

// ─── SHEAR FORCE ──────────────────────────────────────────────────────────────
function shearAt(x, p) {
  const { P, w, L, sw, a } = p;
  const b_ = L - a;
  let s = 0;

  if (load === 'point') {
    if (beam === 'cantilever') {
      s = x <= a ? P : 0;
    } else if (beam === 'simply') {
      s = x < a ? (P*b_)/L : -(P*a)/L;
    } else {
      const MA = (P*a*b_*b_)/(L*L);
      const MB = (P*a*a*b_)/(L*L);
      const RL = (P*b_)/L + (MA-MB)/L;
      s = x < a ? RL : RL - P;
    }
  } else if (load === 'dist') {
    if (beam === 'cantilever') s = w*(L-x);
    else if (beam === 'simply') s = w*(L/2 - x);
    else s = w*(L/2 - x);
  } else if (load === 'tri') {
    if (beam === 'cantilever') s = (w*(L-x)*(L-x))/(2*L);
    else if (beam === 'simply') s = (w*L)/6 - (w*x*x)/(2*L);
    else {
      const MA =  (w*L*L)/20;
      const MB = -(w*L*L)/30;
      const RL = (w*L)/6 - (MA-MB)/L;
      s = RL - (w*x*x)/(2*L);
    }
  }

  if (sw > 0) {
    let ss = 0;
    if (beam === 'cantilever') ss = sw*(L-x);
    else if (beam === 'simply') ss = sw*(L/2-x);
    else ss = sw*(L/2-x);
    s += ss;
  }
  return s;
}

// ─── KENYA CODE CHECK ─────────────────────────────────────────────────────────
function kenyaCheck(p, maxDef, maxStress, maxMom, maxShr) {
  const { L, fy, sec } = p;
  const deflRatio = beam === 'cantilever' ? 180 : 360;
  const allowDef  = L / deflRatio;
  const utilStress = maxStress / fy;
  const SF = fy / maxStress;
  const sectionUtil = maxMom / (fy * sec.I / (sec.h/2));

  // Shear capacity check (KS 02-104 / BS 5950 cl 4.2.3)
  const Vpl = shearCapacity(sec, fy);
  const shearUtil = maxShr / Vpl;

  const checks = [
    {
      name: `Deflection (L/${deflRatio})`,
      pass: maxDef <= allowDef, warn: maxDef <= allowDef * 1.1,
      val: `${(maxDef*1000).toFixed(2)}mm / ${(allowDef*1000).toFixed(2)}mm`
    },
    {
      name: 'Bending stress',
      pass: utilStress <= KS.stress_util_max, warn: utilStress <= 0.95,
      val: `${(utilStress*100).toFixed(1)}% / 90% max`
    },
    {
      name: 'Shear capacity',
      pass: shearUtil <= 0.60, warn: shearUtil <= 0.70,
      val: `V=${(maxShr/1000).toFixed(1)}kN / Vpl=${(Vpl/1000).toFixed(1)}kN`
    },
    {
      name: 'Safety factor (≥1.67)',
      pass: SF >= KS.sf_min, warn: SF >= 1.5,
      val: `SF = ${SF.toFixed(2)}`
    },
    {
      name: 'Section adequacy',
      pass: sectionUtil < 0.9, warn: sectionUtil < 1.0,
      val: `${(sectionUtil*100).toFixed(1)}% capacity used`
    },
    // LTB check — BS 5950-1:2000 cl 4.3 / KS 02-104
    // Only applies to open sections (UB/UC). RHS/CHS are torsionally stiff — LTB not critical.
    ...(() => {
      const so = stdSectionOverride;
      if (!so || !so.ry || !so.Sx || !so.u || !so.x) return []; // parametric or hollow section
      if (so.type !== 'ibeam') return []; // CHS/RHS — skip

      // Effective length LE: assume full lateral restraint at supports → LE = L (conservative)
      const LE   = L;
      const ry   = so.ry / 100;       // cm → m
      const Sx   = so.Sx * 1e-6;      // cm³ → m³
      const py   = fy;                 // design strength (Pa)
      const lam  = LE / ry;           // slenderness λ = LE/ry

      // Slenderness factor v from BS 5950 Table 19
      // v ≈ 1 / (1 + 0.05(λ/x)²)^0.25  (conservative closed-form approximation)
      const lamOverX = lam / so.x;
      const v    = 1 / Math.pow(1 + 0.05 * lamOverX * lamOverX, 0.25);

      // Equivalent slenderness λLT = u·v·λ·√βw, βw=1.0 for Class 1/2
      const lamLT = so.u * v * lam;

      // Limiting slenderness λ1 = π√(E/py)
      const E    = p.E;
      const lam1 = Math.PI * Math.sqrt(E / py);

      // Perry factor ηLT (Robertson constant αLT = 7.0 for rolled sections, BS 5950 Table 16)
      const lamLT0 = 0.4 * lam1;
      const etaLT  = Math.max(0, 7.0 * (lamLT - lamLT0) / 1000);

      // Bending strength pb (Perry-Robertson formula, BS 5950 cl B.2.2)
      const phiLT  = (py + (etaLT + 1) * py * (lamLT / lam1) ** 2) / 2;
      const pb     = py / (phiLT / py + Math.sqrt((phiLT / py) ** 2 - (lamLT / lam1) ** 2));
      const pbCapped = Math.min(pb, py);

      // Buckling resistance moment Mb = pb × Sx
      const Mb   = pbCapped * Sx;
      const util = maxMom / Mb;

      return [{
        name: 'LTB (BS 5950 cl 4.3)',
        pass: util <= 1.0, warn: util <= 1.1,
        val:  `Mx=${(maxMom/1000).toFixed(1)}kNm / Mb=${(Mb/1000).toFixed(1)}kNm (λLT=${lamLT.toFixed(0)})`
      }];
    })(),
  ];

  const allPass = checks.every(c => c.pass);
  const stamp = document.getElementById('stamp');
  document.getElementById('stampDot').className = 'stamp-dot ' + (allPass?'ok':'fail');
  document.getElementById('stampText').textContent = allPass ? 'KS 02-104 COMPLIANT' : 'NON-COMPLIANT';
  stamp.className = 'stamp ' + (allPass?'ok':'fail');

  // Sync mobile status bar
  const msbDot  = document.getElementById('msbDot');
  const msbText = document.getElementById('msbText');
  if (msbDot && msbText) {
    msbDot.className  = 'msb-dot ' + (allPass ? 'ok' : 'fail');
    msbText.textContent = allPass ? 'KS 02-104 COMPLIANT' : 'NON-COMPLIANT';
    document.getElementById('mobileStatusBar').className = 'mobile-status-bar ' + (allPass ? 'ok' : 'fail');
  }

  const cr = document.getElementById('codeResults');
  cr.innerHTML = '';
  checks.forEach(c => {
    const cls  = c.pass?'pass':c.warn?'warn':'fail';
    const bcls = c.pass?'badge-pass':c.warn?'badge-warn':'badge-fail';
    const lbl  = c.pass?'PASS':c.warn?'WARN':'FAIL';
    cr.innerHTML += `<div class="code-item ${cls}">
      <div><div class="code-name">${c.name}</div><div class="code-val">${c.val}</div></div>
      <span class="code-badge ${bcls}">${lbl}</span></div>`;
  });
  return allowDef;
}

// ─── SECTION OPTIMIZER ───────────────────────────────────────────────────────
// Scans all standard sections and returns the lightest one that passes all
// KS 02-104 checks for the current beam configuration.
function optimizeSection() {
  if (!isPro) { upgradeToPro(); return; }
  const btn = document.getElementById('optimizeBtn');
  const resultEl = document.getElementById('optimizeResult');
  btn.disabled = true;
  btn.textContent = 'Scanning…';
  resultEl.style.display = 'none';

  const p = getParams();
  const N = 100;
  const xs = Array.from({length: N + 1}, (_, i) => p.L * i / N);

  // Helper: run compliance checks against a candidate section override
  function testSection(candidate) {
    // Temporarily swap section properties
    const savedOverride = stdSectionOverride;
    stdSectionOverride = candidate;

    const testP = getParams(); // re-reads with new override
    const defs  = xs.map(x => defAt(x, testP));
    const moms  = xs.map(x => momAt(x, testP));
    const shrs  = xs.map(x => shearAt(x, testP));

    const maxDef    = Math.max(...defs);
    const maxMom    = Math.max(...moms.map(Math.abs));
    const maxShr    = Math.max(...shrs.map(Math.abs));
    const maxStress = (maxMom * (testP.h / 2)) / testP.sec.I;
    const SF        = testP.fy / maxStress;
    const deflRatio = beam === 'cantilever' ? 180 : 360;
    const allowDef  = testP.L / deflRatio;
    const Vpl       = shearCapacity(testP.sec, testP.fy);

    stdSectionOverride = savedOverride; // restore

    const passDefl   = maxDef <= allowDef;
    const passStress = maxStress / testP.fy <= KS.stress_util_max;
    const passShear  = maxShr / Vpl <= 0.60;
    const passSF     = SF >= KS.sf_min;
    const passSection= (maxMom / (testP.fy * testP.sec.I / (testP.h / 2))) < 0.9;

    return passDefl && passStress && passShear && passSF && passSection;
  }

  // Flatten all sections with their kg/m for sorting by mass
  const allSections = [];
  ['UB','UC','RHS','CHS'].forEach(cat => {
    STD_SECTIONS[cat].forEach(s => {
      const h = s.h / 1000, b = s.b / 1000;
      const I = s.I * 1e-8, A = s.A * 1e-4;
      const type = (cat==='UB'||cat==='UC') ? 'ibeam' : cat==='CHS' ? 'circ' : 'hollow';
      allSections.push({ name: s.name, cat, kg_m: s.kg_m, I, A, b, h, type });
    });
  });

  // Sort lightest first, then find the first passing section
  allSections.sort((a, b) => a.kg_m - b.kg_m);
  const winner = allSections.find(s => testSection(s));

  btn.disabled = false;
  btn.textContent = 'Find Lightest Section';

  if (!winner) {
    resultEl.style.display = 'block';
    resultEl.className = 'optimize-result fail';
    resultEl.innerHTML = '<strong>No passing section found</strong><br>Try reducing the load or span.';
    return;
  }

  resultEl.style.display = 'block';
  resultEl.className = 'optimize-result pass';
  resultEl.innerHTML =
    `<div class="optimize-name">${winner.name}</div>` +
    `<div class="optimize-meta">${winner.kg_m} kg/m · ${winner.cat}</div>` +
    `<button class="optimize-apply-btn" onclick="applyOptimizedSection('${winner.cat}','${winner.name}')">Apply this section</button>`;
}

function applyOptimizedSection(cat, name) {
  // Switch UI to std library mode and select the winning section
  setSectionMode('std');
  document.getElementById('stdCat').value = cat;
  populateStdSections();
  const options = document.getElementById('stdSec').options;
  for (let i = 0; i < options.length; i++) {
    if (options[i].text === name) {
      document.getElementById('stdSec').selectedIndex = i;
      applyStdSection();
      break;
    }
  }
}

// ─── COST ESTIMATOR ───────────────────────────────────────────────────────────
function updateCost() {
  if (!lastParams) return;
  const p = lastParams;
  const vol  = p.sec.A * p.L;
  const mass = vol * p.density;
  const raw  = parseFloat(document.getElementById('pricePerKg').value);
  const ppkg = (!isNaN(raw) && raw > 0) ? raw : 120;
  const total = mass * ppkg;
  document.getElementById('cVol').textContent  = vol.toFixed(4) + ' m³';
  document.getElementById('cMass').textContent = mass.toFixed(1) + ' kg';
  document.getElementById('cTotal').textContent = 'KES ' + total.toLocaleString('en-KE',{maximumFractionDigits:0});
}

// ─── MULTI-SPAN: THREE-MOMENT EQUATION SOLVER ────────────────────────────────
// Handles UDL and point load per span.
// Three-moment equation fixed-end term:
//   UDL:        6A/L = w·L³/4
//   Point load: 6A/L = P·a·(L²-a²) / (2L)  where a = distance from left support
// Boundary: M[0]=0 (pin left), M[n]=0 (pin right).
function spanFixedEndTerm(si, L) {
  if (spanLoadTypes[si] === 'point') {
    const P = spanLoads[si] * 1000; // kN → N
    const a = spanLoadPos[si] * L;
    return P * a * (L*L - a*a) / (2*L);
  } else {
    const w = spanLoads[si] * 1000; // kN/m → N/m
    return w * L*L*L / 4;
  }
}

function solveThreeMoment(spans, loads, EI) {
  const n = spans.length;
  if (n === 1) return [0, 0];

  if (n === 2) {
    const L0=spans[0], L1=spans[1];
    const f0=spanFixedEndTerm(0,L0), f1=spanFixedEndTerm(1,L1);
    const rhs = -(f0 + f1);
    const M1  = rhs / (2*(L0+L1));
    return [0, M1, 0];
  }

  if (n === 3) {
    const L0=spans[0], L1=spans[1], L2=spans[2];
    const f0=spanFixedEndTerm(0,L0), f1=spanFixedEndTerm(1,L1), f2=spanFixedEndTerm(2,L2);
    const a11=2*(L0+L1), a12=L1;
    const a21=L1,         a22=2*(L1+L2);
    const b1=-(f0+f1), b2=-(f1+f2);
    const det=a11*a22-a12*a21;
    const M1=(b1*a22-b2*a12)/det;
    const M2=(a11*b2-a21*b1)/det;
    return [0, M1, M2, 0];
  }
}

// Compute BMD, SFD, deflection arrays for a multi-span beam
// Returns { xs, moms, shrs, defs, totalL, supportXs }
function solveMultiSpan(p) {
  const spans  = spanLengths.slice(0, spanCount);
  const loads  = spanLoads.slice(0, spanCount).map(v => v * 1000); // kN/m → N/m
  const EI     = p.E * p.sec.I;
  const Ms     = solveThreeMoment(spans, loads, EI); // support moments
  const totalL = spans.reduce((a,b)=>a+b, 0);
  const N_PER  = 100; // points per span

  const xs=[], moms=[], shrs=[], defs=[];
  let xOffset = 0;
  const supportXs = [0];

  spans.forEach((L, si) => {
    const isPoint = spanLoadTypes[si] === 'point';
    const ML = Ms[si], MR = Ms[si+1];

    let RL;
    if (isPoint) {
      const P = spanLoads[si] * 1000;
      const a = spanLoadPos[si] * L;
      const b = L - a;
      // Reactions from three-moment solution + point load equilibrium
      RL = (P*b/L) + (ML - MR)/L;
    } else {
      const w = loads[si];
      RL = w*L/2 + (ML - MR)/L;
    }

    for (let i = 0; i <= N_PER; i++) {
      const x  = L * i / N_PER;
      const xG = xOffset + x;
      xs.push(xG);

      let m, v, d;
      if (isPoint) {
        const P = spanLoads[si] * 1000;
        const a = spanLoadPos[si] * L;
        // BMD: M(x) = ML + RL*x - P*(x-a) for x>a
        m = ML + RL*x - (x > a ? P*(x-a) : 0);
        // SFD: V(x) = RL for x<a, RL-P for x>a
        v = x < a ? RL : RL - P;
        // Deflection by double integration:
        // For x ≤ a: y = (1/EI)[ML*x²/2 + RL*x³/6 + C1*x]
        // For x > a: y = (1/EI)[ML*x²/2 + RL*x³/6 - P*(x-a)³/6 + C1*x]
        // BC y(L)=0 gives C1:
        const C1 = -(ML*L/2 + RL*L*L/6 - P*(L-a)*(L-a)*(L-a)/6) / L * L
                   / L * 1; // simplify:
        const C1clean = -(ML*L/2 + RL*L*L/6 - P*(L-a)**3/6);
        d = (ML*x*x/2 + RL*x*x*x/6 - (x > a ? P*(x-a)**3/6 : 0) + C1clean*x) / EI;
        m = ML + RL*x - (x > a ? P*(x-a) : 0);
        v = x < a ? RL : RL - P;
      } else {
        const w = loads[si];
        m = ML + RL*x - w*x*x/2;
        v = RL - w*x;
        const C1 = -(ML*L/2 + RL*L*L/6 - w*L*L*L/24);
        d = (ML*x*x/2 + RL*x*x*x/6 - w*x*x*x*x/24 + C1*x) / EI;
      }

      moms.push(m);
      shrs.push(v);
      defs.push(d);
    }
    xOffset += L;
    supportXs.push(xOffset);
  });

  return { xs, moms, shrs, defs, totalL, supportXs, Ms };
}

// Draw the multi-span 2D diagram
function draw2dMultiSpan(result, p) {
  const { xs, moms, shrs, defs, totalL, supportXs } = result;
  const c   = document.getElementById('c2d');
  const dpr = window.devicePixelRatio||1;
  const W   = c.offsetWidth||700, H=340;
  c.width=W*dpr; c.height=H*dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const PL=56, PR=20, PT=40, PB=30;
  const bW = W-PL-PR;
  const beamY=H*0.30, momBase=H*0.62, shrBase=H*0.87;
  const N = xs.length-1;

  const maxDef = Math.max(...defs.map(Math.abs))||1e-9;
  const maxMom = Math.max(...moms.map(Math.abs))||1e-9;
  const maxShr = Math.max(...shrs.map(Math.abs))||1e-9;
  const ds = Math.min(50/maxDef, 8000);
  const ms = 48/maxMom;
  const ss = 18/maxShr;

  function xToCanvas(x) { return PL + (x/totalL)*bW; }

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
  for(let i=0;i<=10;i++){const cx=PL+bW*i/10;ctx.beginPath();ctx.moveTo(cx,PT);ctx.lineTo(cx,H-PB);ctx.stroke();}

  // L/360 limit line
  const allowDef = Math.min(...spanLengths.slice(0,spanCount)) / 360;
  const defLim = allowDef * ds;
  ctx.fillStyle='rgba(0,200,150,0.04)'; ctx.fillRect(PL,beamY,bW,defLim);
  ctx.setLineDash([4,3]); ctx.strokeStyle='rgba(0,200,150,0.3)'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.moveTo(PL,beamY+defLim); ctx.lineTo(PL+bW,beamY+defLim); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font='9px Space Mono,monospace'; ctx.fillStyle='rgba(0,200,150,0.6)';
  ctx.fillText('L/360 limit', PL+4, beamY+defLim-3);

  // Supports — pin at each support
  function pin(x,y){
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+14);ctx.lineTo(x+8,y+14);ctx.closePath();
    ctx.strokeStyle='rgba(0,200,150,0.7)';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-11,y+14);ctx.lineTo(x+11,y+14);ctx.stroke();
  }
  supportXs.forEach(sx => pin(xToCanvas(sx), beamY));

  // Load arrows per span — UDL or point load
  ctx.strokeStyle='#f97316'; ctx.fillStyle='#f97316'; ctx.lineWidth=1.2;
  spanLengths.slice(0,spanCount).forEach((L,si) => {
    const x0 = supportXs[si], x1 = supportXs[si+1];
    if (spanLoadTypes[si] === 'point') {
      const ax = xToCanvas(x0 + spanLoadPos[si]*(x1-x0));
      ctx.beginPath(); ctx.moveTo(ax,beamY-32); ctx.lineTo(ax,beamY-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax-4,beamY-11); ctx.lineTo(ax,beamY); ctx.lineTo(ax+4,beamY-11); ctx.fill();
      ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(spanLoads[si]+'kN', ax, beamY-35);
    } else {
      const steps = 6;
      for(let k=0;k<=steps;k++){
        const ax = xToCanvas(x0 + (x1-x0)*k/steps);
        ctx.beginPath();ctx.moveTo(ax,beamY-20);ctx.lineTo(ax,beamY-4);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ax-3,beamY-9);ctx.lineTo(ax,beamY);ctx.lineTo(ax+3,beamY-9);ctx.fill();
      }
      ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
      ctx.fillText(spanLoads[si]+'kN/m', xToCanvas((x0+x1)/2), beamY-24);
    }
  });
  ctx.textAlign='left';

  // Undeformed beam
  ctx.setLineDash([5,4]); ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,beamY); ctx.lineTo(PL+bW,beamY); ctx.stroke();
  ctx.setLineDash([]);

  // Deflected shape
  ctx.strokeStyle='#00c896'; ctx.lineWidth=2.5;
  ctx.beginPath();
  xs.forEach((x,i)=>{
    const cx=xToCanvas(x), cy=beamY+defs[i]*ds;
    i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);
  });
  ctx.stroke();
  const maxDefIdx = defs.map(Math.abs).indexOf(Math.max(...defs.map(Math.abs)));
  ctx.font='10px Space Mono,monospace'; ctx.fillStyle='#00c896'; ctx.textAlign='center';
  ctx.fillText('δmax='+(maxDef*1000).toFixed(1)+'mm', xToCanvas(xs[maxDefIdx]), beamY+defs[maxDefIdx]*ds+15);

  // BMD — sagging positive (below baseline), hogging negative (above)
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,momBase);
  xs.forEach((x,i)=>ctx.lineTo(xToCanvas(x), momBase-moms[i]*ms));
  ctx.lineTo(PL+bW,momBase); ctx.closePath();
  ctx.fillStyle='rgba(59,130,246,0.12)'; ctx.fill();
  ctx.strokeStyle='#3b82f6'; ctx.stroke();
  // Hogging highlight
  ctx.strokeStyle='rgba(239,68,68,0.6)'; ctx.lineWidth=1;
  ctx.beginPath(); let hogging=false;
  xs.forEach((x,i)=>{
    const cy=momBase-moms[i]*ms;
    if(cy<momBase){if(!hogging){ctx.moveTo(xToCanvas(x),momBase);hogging=true;}ctx.lineTo(xToCanvas(x),cy);}else{hogging=false;}
  });
  ctx.stroke();
  ctx.font='9px Space Mono,monospace'; ctx.fillStyle='#3b82f6'; ctx.textAlign='left';
  ctx.fillText('BMD',PL+4,momBase-6);

  // SFD
  ctx.fillStyle='rgba(249,115,22,0.1)'; ctx.strokeStyle='#f97316'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,shrBase);
  xs.forEach((x,i)=>ctx.lineTo(xToCanvas(x), shrBase-shrs[i]*ss));
  ctx.lineTo(PL+bW,shrBase); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#f97316'; ctx.fillText('SFD',PL+4,shrBase-5);

  // Interior support moment labels
  result.Ms.forEach((M,i)=>{
    if(i===0||i===result.Ms.length-1) return;
    const cx=xToCanvas(supportXs[i]);
    ctx.font='9px Space Mono,monospace'; ctx.fillStyle='rgba(239,68,68,0.8)'; ctx.textAlign='center';
    ctx.fillText('M='+(M/1000).toFixed(1)+'kNm', cx, momBase+10);
  });

  // Reaction forces at each support (from span equilibrium)
  ctx.font='10px Space Mono,monospace'; ctx.fillStyle='rgba(0,200,150,0.9)'; ctx.textAlign='center';
  const spansSlice = spanLengths.slice(0, spanCount);
  const loadsSlice = spanLoads.slice(0, spanCount).map(v => v * 1000);
  const Ms = result.Ms;
  spansSlice.forEach((Ls, si) => {
    const w  = loadsSlice[si];
    const ML = Ms[si], MR = Ms[si + 1];
    const RL = w * Ls / 2 + (ML - MR) / Ls;
    const RR = w * Ls - RL;
    // Left support of span gets RL, right support gets RR (accumulate if interior)
    const xL = xToCanvas(supportXs[si]);
    const xR = xToCanvas(supportXs[si + 1]);
    if (si === 0) ctx.fillText('R=' + (RL / 1000).toFixed(1) + 'kN', xL, beamY + 30);
    // Interior supports: show combined reaction from both adjacent spans
    const combinedR = si === 0 ? RR : RR + (loadsSlice[si - 1] * spansSlice[si - 1] / 2 + (Ms[si - 1] - Ms[si]) / spansSlice[si - 1]);
    ctx.fillText('R=' + (si === spanCount - 1 ? (RR / 1000).toFixed(1) : (combinedR / 1000).toFixed(1)) + 'kN', xR, beamY + 30);
  });

  // X axis labels
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
  supportXs.forEach(sx => ctx.fillText(sx.toFixed(1)+'m', xToCanvas(sx), H-6));
}

// ─── MAIN UPDATE ──────────────────────────────────────────────────────────────
function go() {
  // ── Multi-span branch ──
  if (spanCount > 1) {
    const p = getParams();
    lastParams = p;
    const result = solveMultiSpan(p);
    const { xs, moms, shrs, defs, totalL } = result;

    const maxDef    = Math.max(...defs.map(Math.abs));
    const maxMom    = Math.max(...moms.map(Math.abs));
    const maxShr    = Math.max(...shrs.map(Math.abs));
    const maxStress = (maxMom * (p.h/2)) / p.sec.I;
    const SF        = p.fy / maxStress;
    const Vpl       = shearCapacity(p.sec, p.fy);
    const allowDef  = Math.min(...spanLengths.slice(0,spanCount)) / 360;

    // Update metrics
    document.getElementById('mDef').textContent      = (maxDef*1000).toFixed(2) + ' mm';
    document.getElementById('mDef').className        = 'metric-val ' + (maxDef<=allowDef?'ok':maxDef<=allowDef*1.1?'warn':'fail');
    document.getElementById('mAllowDef').textContent = (allowDef*1000).toFixed(2) + ' mm';
    document.getElementById('mMom').textContent      = (maxMom/1000).toFixed(1) + ' kN·m';
    document.getElementById('mStress').textContent   = (maxStress/1e6).toFixed(1) + ' MPa';
    document.getElementById('mStress').className     = 'metric-val ' + (maxStress/p.fy<0.9?'ok':maxStress/p.fy<1?'warn':'fail');
    document.getElementById('mShear').textContent    = (maxShr/1000).toFixed(1) + ' kN';
    document.getElementById('mShear').className      = 'metric-val ' + (maxShr/Vpl<0.6?'ok':maxShr/Vpl<0.7?'warn':'fail');
    document.getElementById('mSF').textContent       = SF.toFixed(2);
    document.getElementById('mSF').className         = 'metric-val ' + (SF>=KS.sf_min?'ok':SF>=1.5?'warn':'fail');

    // KS compliance (reuse existing checker with totalL as representative L)
    kenyaCheck({...p, L:totalL/spanCount}, maxDef, maxStress, maxMom, maxShr);
    updateCost();

    if (view==='2d')      draw2dMultiSpan(result, p);
    if (view==='3d')      draw3d(p, maxDef);
    if (view==='section') drawSection(p);
    return;
  }
  const p = getParams();
  lastParams = p;
  const N  = 200;
  const xs = Array.from({length:N+1}, (_,i) => p.L*i/N);
  const defs = xs.map(x => defAt(x,p));
  const moms = xs.map(x => momAt(x,p));
  const shrs = xs.map(x => shearAt(x,p));

  const maxDef    = Math.max(...defs);
  const maxMom    = Math.max(...moms.map(Math.abs));
  const maxShr    = Math.max(...shrs.map(Math.abs));
  const maxStress = (maxMom * (p.h/2)) / p.sec.I;
  const SF        = p.fy / maxStress;
  const Vpl       = shearCapacity(p.sec, p.fy);
  const allowDef  = kenyaCheck(p, maxDef, maxStress, maxMom, maxShr);

  // Update metrics strip
  document.getElementById('mDef').textContent     = (maxDef*1000).toFixed(2) + ' mm';
  document.getElementById('mDef').className       = 'metric-val ' + (maxDef<=allowDef?'ok':maxDef<=allowDef*1.1?'warn':'fail');
  document.getElementById('mAllowDef').textContent = (allowDef*1000).toFixed(2) + ' mm';
  document.getElementById('mMom').textContent     = (maxMom/1000).toFixed(1) + ' kN·m';
  document.getElementById('mStress').textContent  = (maxStress/1e6).toFixed(1) + ' MPa';
  document.getElementById('mStress').className    = 'metric-val ' + (maxStress/p.fy<0.9?'ok':maxStress/p.fy<1?'warn':'fail');
  document.getElementById('mShear').textContent   = (maxShr/1000).toFixed(1) + ' kN';
  document.getElementById('mShear').className     = 'metric-val ' + (maxShr/Vpl<0.6?'ok':maxShr/Vpl<0.7?'warn':'fail');
  document.getElementById('mSF').textContent      = SF.toFixed(2);
  document.getElementById('mSF').className        = 'metric-val ' + (SF>=KS.sf_min?'ok':SF>=1.5?'warn':'fail');

  updateCost();

  if (view==='2d')      draw2d(xs, defs, moms, shrs, p, allowDef);
  if (view==='3d')      draw3d(p, maxDef);
  if (view==='section') drawSection(p);
}

// ─── 2D DRAW ─────────────────────────────────────────────────────────────────
function draw2d(xs, defs, moms, shrs, p, allowDef) {
  const c   = document.getElementById('c2d');
  const dpr = window.devicePixelRatio||1;
  const W   = c.offsetWidth||700, H=340;
  c.width=W*dpr; c.height=H*dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const PL=56,PR=20,PT=40,PB=30;
  const bW=W-PL-PR, N=xs.length-1;
  const beamY=H*0.30, momBase=H*0.62, shrBase=H*0.87;
  const maxDef=Math.max(...defs)||1e-9;
  const maxMom=Math.max(...moms.map(Math.abs))||1e-9;
  const maxShr=Math.max(...shrs.map(Math.abs))||1e-9;
  const ds=Math.min(60/maxDef,8000), ms=48/maxMom, ss=18/maxShr;

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
  for(let i=0;i<=10;i++){const x=PL+bW*i/10;ctx.beginPath();ctx.moveTo(x,PT);ctx.lineTo(x,H-PB);ctx.stroke();}

  // Allowable deflection band
  const defLim=allowDef*ds;
  ctx.fillStyle='rgba(0,200,150,0.04)'; ctx.fillRect(PL,beamY,bW,defLim);
  ctx.setLineDash([4,3]); ctx.strokeStyle='rgba(0,200,150,0.3)'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.moveTo(PL,beamY+defLim); ctx.lineTo(PL+bW,beamY+defLim); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font='9px Space Mono,monospace'; ctx.fillStyle='rgba(0,200,150,0.6)';
  ctx.fillText((beam==='cantilever'?'L/180':'L/360')+' limit', PL+4, beamY+defLim-3);

  // Supports
  function wall(x,y,right){
    ctx.fillStyle='rgba(0,200,150,0.15)'; ctx.strokeStyle='rgba(0,200,150,0.5)'; ctx.lineWidth=1;
    if(!right){ctx.fillRect(x-14,y-22,14,44);ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x,y+22);ctx.stroke();}
    else{ctx.fillRect(x,y-22,14,44);ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x,y+22);ctx.stroke();}
    for(let i=0;i<5;i++){ctx.beginPath();if(!right){ctx.moveTo(x-14,y-18+i*9);ctx.lineTo(x-22,y-10+i*9);}else{ctx.moveTo(x+14,y-18+i*9);ctx.lineTo(x+22,y-10+i*9);}ctx.strokeStyle='rgba(0,200,150,0.25)';ctx.stroke();}
    ctx.strokeStyle='rgba(0,200,150,0.5)';
  }
  function pin(x,y){
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+16);ctx.lineTo(x+9,y+16);ctx.closePath();
    ctx.strokeStyle='rgba(0,200,150,0.6)';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-12,y+16);ctx.lineTo(x+12,y+16);ctx.stroke();
  }
  if(beam==='cantilever') wall(PL,beamY,false);
  else if(beam==='simply'){pin(PL,beamY);pin(PL+bW,beamY);}
  else{wall(PL,beamY,false);wall(PL+bW,beamY,true);}

  // Load arrows — point load position is driven by slider
  ctx.strokeStyle='#f97316'; ctx.fillStyle='#f97316'; ctx.lineWidth=1.5;
  if(load==='point'){
    // Point load arrow
    const posFrac = getLoadPos();
    const ax = PL + bW*posFrac;
    const arrowTop = combinedLoad ? beamY-52 : beamY-34;
    ctx.beginPath(); ctx.moveTo(ax,arrowTop); ctx.lineTo(ax,beamY-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax-5,beamY-12); ctx.lineTo(ax,beamY); ctx.lineTo(ax+5,beamY-12); ctx.fill();
    ctx.font='10px Space Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(document.getElementById('sLoad').value+'kN', ax, arrowTop-4);
    // Combined UDL arrows (drawn lighter, above point arrow line)
    if(combinedLoad && p.w > 0){
      ctx.strokeStyle='rgba(249,115,22,0.45)'; ctx.fillStyle='rgba(249,115,22,0.45)'; ctx.lineWidth=1;
      const udlSteps=10;
      for(let i=0;i<=udlSteps;i++){
        const ux=PL+bW*i/udlSteps;
        ctx.beginPath();ctx.moveTo(ux,beamY-70);ctx.lineTo(ux,beamY-56);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ux-3,beamY-62);ctx.lineTo(ux,beamY-52);ctx.lineTo(ux+3,beamY-62);ctx.fill();
      }
      ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
      ctx.fillText('UDL '+(p.w/1000).toFixed(0)+'kN/m', PL+bW/2, beamY-73);
      ctx.strokeStyle='#f97316'; ctx.fillStyle='#f97316'; ctx.lineWidth=1.5;
    }
  } else {
    const steps=10;
    for(let i=0;i<=steps;i++){
      const ax=PL+bW*i/steps;
      const scale=load==='tri'?i/steps:1;
      const arrowH=8+scale*18;
      ctx.beginPath();ctx.moveTo(ax,beamY-arrowH);ctx.lineTo(ax,beamY-5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(ax-4,beamY-11);ctx.lineTo(ax,beamY);ctx.lineTo(ax+4,beamY-11);ctx.fill();
    }
    ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
    ctx.fillText((load==='tri'?'Triangular':'UDL')+' '+document.getElementById('sLoad').value+'kN/m', PL+bW/2, beamY-30);
  }
  ctx.textAlign='left';

  // Undeformed beam
  ctx.setLineDash([5,4]); ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,beamY); ctx.lineTo(PL+bW,beamY); ctx.stroke(); ctx.setLineDash([]);

  // Deflected shape
  ctx.strokeStyle='#00c896'; ctx.lineWidth=2.5;
  ctx.beginPath();
  xs.forEach((x,i)=>{const cx=PL+bW*i/N,cy=beamY+defs[i]*ds;i===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);});
  ctx.stroke();
  const mi=defs.indexOf(Math.max(...defs));
  ctx.font='10px Space Mono,monospace'; ctx.fillStyle='#00c896'; ctx.textAlign='center';
  ctx.fillText('δ='+(Math.max(...defs)*1000).toFixed(1)+'mm', PL+bW*mi/N, beamY+defs[mi]*ds+15);

  // BMD
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,momBase);
  xs.forEach((x,i)=>ctx.lineTo(PL+bW*i/N, momBase-moms[i]*ms));
  ctx.lineTo(PL+bW,momBase); ctx.closePath();
  ctx.fillStyle='rgba(59,130,246,0.12)'; ctx.fill();
  ctx.strokeStyle='#3b82f6'; ctx.stroke();
  // Highlight hogging (negative moment) in red
  ctx.strokeStyle='rgba(239,68,68,0.6)'; ctx.lineWidth=1;
  ctx.beginPath();
  let hogging=false;
  xs.forEach((x,i)=>{
    const cy=momBase-moms[i]*ms;
    if(cy<momBase){if(!hogging){ctx.moveTo(PL+bW*i/N,momBase);hogging=true;}ctx.lineTo(PL+bW*i/N,cy);}else{hogging=false;}
  });
  ctx.stroke();
  ctx.font='9px Space Mono,monospace'; ctx.fillStyle='#3b82f6'; ctx.textAlign='left';
  ctx.fillText('BMD',PL+4,momBase-6);

  // SFD
  ctx.fillStyle='rgba(249,115,22,0.1)'; ctx.strokeStyle='#f97316'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PL,shrBase);
  xs.forEach((x,i)=>ctx.lineTo(PL+bW*i/N, shrBase-shrs[i]*ss));
  ctx.lineTo(PL+bW,shrBase); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#f97316'; ctx.fillText('SFD',PL+4,shrBase-5);

  // Reaction forces
  const rxn = getReactions(p);
  ctx.font='10px Space Mono,monospace'; ctx.fillStyle='rgba(0,200,150,0.9)'; ctx.textAlign='center';
  if (beam === 'cantilever') {
    ctx.fillText('R=' + (rxn.RL/1000).toFixed(1) + 'kN', PL, beamY + 28);
    if (rxn.MA > 0)
      ctx.fillText('M=' + (rxn.MA/1000).toFixed(1) + 'kNm', PL, beamY + 41);
  } else if (beam === 'simply') {
    ctx.fillText('RL=' + (rxn.RL/1000).toFixed(1) + 'kN', PL, beamY + 28);
    ctx.fillText('RR=' + (rxn.RR/1000).toFixed(1) + 'kN', PL+bW, beamY + 28);
  } else {
    ctx.fillText('RL=' + (rxn.RL/1000).toFixed(1) + 'kN', PL, beamY + 28);
    ctx.fillText('RR=' + (rxn.RR/1000).toFixed(1) + 'kN', PL+bW, beamY + 28);
    ctx.fillText('MA=' + (rxn.MA/1000).toFixed(1) + 'kNm', PL, beamY + 41);
    ctx.fillText('MB=' + (rxn.MB/1000).toFixed(1) + 'kNm', PL+bW, beamY + 41);
  }

  // X axis
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
  for(let i=0;i<=5;i++) ctx.fillText((p.L*i/5).toFixed(1)+'m', PL+bW*i/5, H-6);
}

// ─── 3D DRAW ──────────────────────────────────────────────────────────────────
function draw3d(p, maxDef) {
  const c   = document.getElementById('c3d');
  const dpr = window.devicePixelRatio||1;
  const W   = c.offsetWidth||700, H=400;
  c.width=W*dpr; c.height=H*dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const scale=Math.min(W,H)*0.27, cx=W/2, cy=H/2, SEGS=24;
  function proj(x,y,z){
    const c1=Math.cos(rotX),s1=Math.sin(rotX),c2=Math.cos(rotY),s2=Math.sin(rotY);
    const y2=y*c1-z*s1, z2=y*s1+z*c1, x2=x*c2+z2*s2, z3=-x*s2+z2*c2;
    const f=5/(5+z3); return[cx+x2*scale*f, cy+y2*scale*f];
  }
  const bL=2.5, hw=p.h*30, hh=p.h*60;
  const ds3=maxDef>0?Math.min(0.5/maxDef,5000):1;
  for(let i=0;i<SEGS;i++){
    const t0=i/SEGS, t1=(i+1)/SEGS;
    const x0=t0*bL-bL/2, x1=t1*bL-bL/2;
    const d0=defAt(t0*p.L,p)*ds3, d1=defAt(t1*p.L,p)*ds3;
    const stress=Math.abs(momAt((t0+t1)/2*p.L,p))*(p.h/2)/p.sec.I;
    const ratio=Math.min(stress/p.fy,1);
    const r=Math.round(59+ratio*(239-59)), g=Math.round(130+ratio*(68-130)), b=Math.round(246+ratio*(68-246));
    const corners=[
      [x0,-hh/scale+d0,-hw/scale],[x0,hh/scale+d0,-hw/scale],[x0,hh/scale+d0,hw/scale],[x0,-hh/scale+d0,hw/scale],
      [x1,-hh/scale+d1,-hw/scale],[x1,hh/scale+d1,-hw/scale],[x1,hh/scale+d1,hw/scale],[x1,-hh/scale+d1,hw/scale],
    ].map(([x,y,z])=>proj(x,y,z));
    [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]].forEach((f,fi)=>{
      const a=[0.4,0.5,0.65,0.55,0.85,0.9][fi];
      ctx.beginPath(); ctx.moveTo(corners[f[0]][0],corners[f[0]][1]);
      for(let j=1;j<f.length;j++) ctx.lineTo(corners[f[j]][0],corners[f[j]][1]);
      ctx.closePath(); ctx.fillStyle=`rgba(${r},${g},${b},${a*0.85})`; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.4; ctx.stroke();
    });
  }
  const gx=W-120,gy=16,gw=100;
  const gr=ctx.createLinearGradient(gx,0,gx+gw,0);
  gr.addColorStop(0,'#3b82f6'); gr.addColorStop(1,'#ef4444');
  ctx.fillStyle=gr; ctx.fillRect(gx,gy,gw,8);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='9px Space Mono,monospace';
  ctx.textAlign='left'; ctx.fillText('Low',gx,gy+20);
  ctx.textAlign='right'; ctx.fillText('High stress',gx+gw,gy+20);
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillText('Drag to rotate',12,H-10);
}

// ─── SECTION DRAW ─────────────────────────────────────────────────────────────
function drawSection(p) {
  const c   = document.getElementById('cSec');
  const dpr = window.devicePixelRatio||1;
  const W   = c.offsetWidth||700, H=400;
  c.width=W*dpr; c.height=H*dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const {sec,h,fy}=p;
  const cx=W*0.38, cy=H/2;
  const sc=Math.min((H*0.7)/h,400);
  const dh=h*sc, db=sec.b*sc;
  const curSect=stdSectionOverride?stdSectionOverride.type:sect;
  const bgCol=getCSSVar('--s1')||'#13161c';
  ctx.strokeStyle='#3b82f6'; ctx.fillStyle='rgba(59,130,246,0.15)'; ctx.lineWidth=1.5;

  if(curSect==='rect'){ctx.beginPath();ctx.rect(cx-db/2,cy-dh/2,db,dh);ctx.fill();ctx.stroke();}
  else if(curSect==='ibeam'){
    const tf=dh*0.12,tw=db*0.14;
    ctx.beginPath();
    ctx.moveTo(cx-db/2,cy-dh/2);ctx.lineTo(cx+db/2,cy-dh/2);
    ctx.lineTo(cx+db/2,cy-dh/2+tf);ctx.lineTo(cx+tw/2,cy-dh/2+tf);
    ctx.lineTo(cx+tw/2,cy+dh/2-tf);ctx.lineTo(cx+db/2,cy+dh/2-tf);
    ctx.lineTo(cx+db/2,cy+dh/2);ctx.lineTo(cx-db/2,cy+dh/2);
    ctx.lineTo(cx-db/2,cy+dh/2-tf);ctx.lineTo(cx-tw/2,cy+dh/2-tf);
    ctx.lineTo(cx-tw/2,cy-dh/2+tf);ctx.lineTo(cx-db/2,cy-dh/2+tf);
    ctx.closePath();ctx.fill();ctx.stroke();
  } else if(curSect==='circ'){ctx.beginPath();ctx.arc(cx,cy,dh/2,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(curSect==='hollow'){
    const t=dh*0.12;
    ctx.beginPath();ctx.rect(cx-db/2,cy-dh/2,db,dh);ctx.fill();ctx.stroke();
    ctx.fillStyle=bgCol;
    ctx.beginPath();ctx.rect(cx-db/2+t,cy-dh/2+t,db-2*t,dh-2*t);ctx.fill();ctx.stroke();
  }
  ctx.setLineDash([5,3]);ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-db/2-10,cy);ctx.lineTo(cx+db/2+10,cy);ctx.stroke();ctx.setLineDash([]);

  // Stress distribution
  const stressVals=Array.from({length:50},(_,i)=>Math.abs(momAt(p.L*i/50,p)));
  const stressMax=p.sec.I>0?(Math.max(...stressVals)*(h/2))/p.sec.I:0;
  const util=Math.min(stressMax/fy,1);
  const col=util<0.7?'#00c896':util<0.9?'#f97316':'#ef4444';
  const sx=cx+db/2+30;
  ctx.beginPath();ctx.moveTo(sx,cy-dh/2);ctx.lineTo(sx+util*70,cy);ctx.lineTo(sx,cy+dh/2);
  ctx.strokeStyle=col;ctx.fillStyle=col+'33';ctx.lineWidth=1.5;ctx.setLineDash([]);
  ctx.fill();ctx.stroke();
  ctx.fillStyle=col;ctx.font='10px Space Mono,monospace';ctx.textAlign='left';
  ctx.fillText('σ='+(stressMax/1e6).toFixed(1)+'MPa',sx+util*70+6,cy);
  ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='9px Space Mono,monospace';
  ctx.fillText('Stress dist.',sx,cy-dh/2-8);

  // Dimension lines
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.lineWidth=0.7;ctx.font='10px Space Mono,monospace';
  ctx.beginPath();ctx.moveTo(cx-db/2-20,cy-dh/2);ctx.lineTo(cx-db/2-20,cy+dh/2);ctx.stroke();
  ctx.textAlign='right';ctx.fillText((h*1000).toFixed(0)+'mm',cx-db/2-24,cy+4);
  ctx.beginPath();ctx.moveTo(cx-db/2,cy+dh/2+20);ctx.lineTo(cx+db/2,cy+dh/2+20);ctx.stroke();
  ctx.textAlign='center';ctx.fillText((sec.b*1000).toFixed(0)+'mm',cx,cy+dh/2+32);

  // Properties table
  const tx=W*0.72,ty=60;
  ctx.textAlign='left';ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='11px Space Mono,monospace';
  ctx.fillText('Section Properties',tx,ty);
  const rows=[
    ['I (cm⁴)',(sec.I*1e8).toFixed(1)],['A (cm²)',(sec.A*1e4).toFixed(1)],
    ['h (mm)',(h*1000).toFixed(0)],['b (mm)',(sec.b*1000).toFixed(0)],
    ['Z (cm³)',(sec.I/(h/2)*1e6).toFixed(1)],['r (cm)',(Math.sqrt(sec.I/sec.A)*100).toFixed(1)],
  ];
  rows.forEach(([k,v],i)=>{
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.textAlign='left';ctx.fillText(k,tx,ty+24+i*20);
    ctx.fillStyle='#00c896';ctx.textAlign='right';ctx.fillText(v,tx+160,ty+24+i*20);
  });
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='9px Space Mono,monospace';ctx.textAlign='left';
  ctx.fillText('Neutral axis',cx+db/2+8,cy+3);
}

// ─── 3D DRAG (mouse + touch) ──────────────────────────────────────────────────
const c3=document.getElementById('c3d');

function do3dMove(cx,cy){
  rotY+=(cx-lmx)*0.01; rotX+=(cy-lmy)*0.01;
  lmx=cx; lmy=cy;
  if(lastParams){
    const N=50,xs=Array.from({length:N+1},(_,i)=>lastParams.L*i/N);
    const defs=xs.map(x=>defAt(x,lastParams));
    draw3d(lastParams,Math.max(...defs));
  }
}

// Mouse
c3.addEventListener('mousedown',e=>{drag=true;lmx=e.clientX;lmy=e.clientY;});
c3.addEventListener('mousemove',e=>{if(!drag)return;do3dMove(e.clientX,e.clientY);});
c3.addEventListener('mouseup',()=>drag=false);
c3.addEventListener('mouseleave',()=>drag=false);

// Touch
c3.addEventListener('touchstart',e=>{
  e.preventDefault();
  drag=true;
  lmx=e.touches[0].clientX;
  lmy=e.touches[0].clientY;
},{passive:false});
c3.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(!drag)return;
  do3dMove(e.touches[0].clientX,e.touches[0].clientY);
},{passive:false});
c3.addEventListener('touchend',()=>drag=false);

// ─── BOTTOM SHEET TOGGLE ──────────────────────────────────────────────────────
function toggleSheet(){
  const sidebar=document.getElementById('sidebar');
  const label=document.getElementById('sheetLabel');
  const isOpen=sidebar.classList.toggle('open');
  label.textContent='Controls';
}

// Close sheet when a tab is clicked on mobile
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    const sidebar=document.getElementById('sidebar');
    if(sidebar.classList.contains('open')){
      sidebar.classList.remove('open');
      document.getElementById('sheetLabel').textContent='Controls';
    }
  });
});

// ─── AI ASSISTANT ─────────────────────────────────────────────────────────────
let aiHistory=[];

function getDesignContext(){
  if(!lastParams) return '';
  const p=lastParams;
  const matEl=document.getElementById('sMat');
  const matName=matEl.options[matEl.selectedIndex].text;
  const beamNames={cantilever:'Cantilever',simply:'Simply Supported',fixed:'Fixed–Fixed'};
  const loadNames={point:'Point load',dist:'UDL',tri:'Triangular load'};
  const secNames={rect:'Rectangular',ibeam:'I-Beam',circ:'Circular',hollow:'Hollow Box'};
  const secName=stdSectionOverride?(stdSectionOverride.name||'Standard'):secNames[sect];
  const raw=parseFloat(document.getElementById('pricePerKg').value);
  const ppkg=(!isNaN(raw)&&raw>0)?raw:120;
  const mass=(p.sec.A*p.L*p.density).toFixed(1);
  const total=(p.sec.A*p.L*p.density*ppkg).toLocaleString('en-KE',{maximumFractionDigits:0});
  const deflRatio=beam==='cantilever'?180:360;
  const Vpl=shearCapacity(p.sec,p.fy);
  const posFrac=load==='point'?getLoadPos():null;

  return `Current StructaViz design context:
- Beam type: ${beamNames[beam]}
- Cross-section: ${secName}
- Load type: ${loadNames[load]}${load==='point'?' at '+((posFrac*100).toFixed(0))+'% of span':''}
- Applied load: ${document.getElementById('sLoad').value} kN${load!=='point'?'/m':''}
- Span: ${document.getElementById('sLen').value} m
- Section height: ${(p.h*1000).toFixed(0)} mm, width: ${(p.sec.b*1000).toFixed(0)} mm
- Material: ${matName}
- I = ${(p.sec.I*1e8).toFixed(1)} cm⁴, A = ${(p.sec.A*1e4).toFixed(1)} cm²
- Max deflection: ${document.getElementById('mDef').textContent} (limit: ${document.getElementById('mAllowDef').textContent}, L/${deflRatio})
- Max bending stress: ${document.getElementById('mStress').textContent}
- Max shear: ${document.getElementById('mShear').textContent} (capacity: ${(Vpl/1000).toFixed(1)} kN)
- Safety factor: ${document.getElementById('mSF').textContent}
- KS 02-104 status: ${document.getElementById('stampText').textContent}
- Mass: ${mass} kg, Estimated cost: KES ${total} (at KES ${ppkg}/kg)
- Self-weight: ${document.getElementById('selfWeight').checked?'included':'excluded'}`;
}

async function sendAI(){
  const input=document.getElementById('aiInput');
  const msg=input.value.trim();
  if(!msg) return;
  input.value='';
  appendAIMessage('user',msg);
  document.getElementById('aiSendBtn').disabled=true;
  document.getElementById('aiChips').style.display='none';
  const thinkEl=appendAIMessage('assistant thinking','Analysing your design…');

  const context=getDesignContext();
  const system=`You are StructaViz AI, a structural engineering assistant specialising in Kenyan construction practice and the KS 02-104 standard (Kenya Standard for structural steel design, aligned with BS 5950 and Eurocode 3). You are embedded in StructaViz, a beam analysis tool. You have real-time access to the user's current design parameters and results. Be concise, practical, and educational — your audience is engineering students and practicing engineers in Kenya. Use SI units and reference KS 02-104 clause numbers where relevant. Costs are in Kenyan Shillings (KES). When suggesting improvements, be specific about which parameter to change and by how much.`;

  const fullMessage=`${context}\n\nUser question: ${msg}`;
  const messages=[...aiHistory, {role:'user', content: fullMessage}];

  try {
    const res=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ system, messages })
    });

    if(!res.ok){
      const errData=await res.json().catch(()=>({}));
      let errMsg=errData.error||'Something went wrong. Please try again.';
      thinkEl.className='ai-msg error';
      thinkEl.textContent='Error: '+errMsg;
      document.getElementById('aiSendBtn').disabled=false;
      return;
    }

    const data=await res.json();
    const reply=data.content?.find(b=>b.type==='text')?.text||'Sorry, I could not get a response.';
    thinkEl.className='ai-msg assistant';
    thinkEl.innerHTML=parseMarkdown(reply);
    aiHistory.push({role:'user', content: fullMessage});
    aiHistory.push({role:'assistant', content: reply});
    if(aiHistory.length>12) aiHistory=aiHistory.slice(-12);
  } catch(e){
    thinkEl.className='ai-msg error';
    thinkEl.textContent='Error: Network error. Please check your connection and try again.';
  }
  document.getElementById('aiSendBtn').disabled=false;
  scrollAI();
}

function parseMarkdown(md){
  // Escape HTML entities first to prevent XSS
  let html = md
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');

  // Tables: | col | col | with optional header separator
  html = html.replace(/^(\|.+\|\n)((?:\|[-: ]+\|\n))((?:\|.+\|\n?)*)/gm, (_, header, sep, body) => {
    const parseRow = (row, tag) =>
      '<tr>' + row.trim().replace(/^\||\|$/g,'').split('|')
        .map(c=>`<${tag} style="padding:4px 8px;border:1px solid var(--border2)">${c.trim()}</${tag}>`)
        .join('') + '</tr>';
    const hRows = header.trim().split('\n').map(r=>parseRow(r,'th')).join('');
    const bRows = body.trim().split('\n').filter(Boolean).map(r=>parseRow(r,'td')).join('');
    return `<table style="border-collapse:collapse;margin:8px 0;font-size:12px;width:100%"><thead>${hRows}</thead><tbody>${bRows}</tbody></table>`;
  });

  // Headings
  html = html
    .replace(/^### (.+)$/gm,'<h4 style="margin:10px 0 4px;color:var(--accent);font-size:13px">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 style="margin:10px 0 4px;color:var(--accent);font-size:14px">$1</h3>')
    .replace(/^# (.+)$/gm,'<h2 style="margin:10px 0 4px;color:var(--accent);font-size:15px">$1</h2>');

  // Bold & italic
  html = html
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g,'<code style="background:var(--s3);padding:1px 4px;border-radius:3px;font-family:var(--mono);font-size:12px">$1</code>');

  // Horizontal rules
  html = html.replace(/^---+$/gm,'<hr style="border:none;border-top:1px solid var(--border2);margin:8px 0">');

  // Bullet lists (group consecutive lines)
  html = html.replace(/(^- .+(\n|$))+/gm, match => {
    const items = match.trim().split('\n').map(l=>`<li style="margin:2px 0">${l.replace(/^- /,'')}</li>`).join('');
    return `<ul style="padding-left:18px;margin:4px 0">${items}</ul>`;
  });

  // Numbered lists
  html = html.replace(/(^\d+\. .+(\n|$))+/gm, match => {
    const items = match.trim().split('\n').map(l=>`<li style="margin:2px 0">${l.replace(/^\d+\. /,'')}</li>`).join('');
    return `<ol style="padding-left:18px;margin:4px 0">${items}</ol>`;
  });

  // Paragraphs — wrap double-newline separated blocks
  html = html.replace(/\n{2,}/g,'</p><p style="margin:6px 0">');
  html = '<p style="margin:6px 0">' + html + '</p>';

  // Single newlines to <br>
  html = html.replace(/([^>])\n([^<])/g,'$1<br>$2');

  return html;
}

function appendAIMessage(role,text){
  const msgs=document.getElementById('aiMessages');
  const el=document.createElement('div');
  el.className='ai-msg '+role;
  if(role==='assistant'){
    el.innerHTML=parseMarkdown(text);
  } else {
    el.textContent=text;
  }
  msgs.appendChild(el); scrollAI(); return el;
}
function scrollAI(){const msgs=document.getElementById('aiMessages');msgs.scrollTop=msgs.scrollHeight;}
function askChip(q){document.getElementById('aiInput').value=q;sendAI();}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
async function exportReport(){
  const btn=document.getElementById('exportBtn');
  btn.disabled=true; btn.textContent='Building PDF…';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const W = 210, H = 297;
    const ML = 18, MR = 18, MT = 20;
    let y = MT;

    const p = lastParams || getParams();
    const N = 200, xs = Array.from({length:N+1},(_,i)=>p.L*i/N);
    const defs = xs.map(x=>defAt(x,p));
    const moms = xs.map(x=>momAt(x,p));
    const shrs = xs.map(x=>shearAt(x,p));
    const maxShr  = Math.max(...shrs.map(Math.abs));
    const Vpl     = shearCapacity(p.sec, p.fy);
    const deflRatio = beam==='cantilever'?180:360;
    const allowDef  = p.L/deflRatio;

    const matEl   = document.getElementById('sMat');
    const matStr  = matEl.options[matEl.selectedIndex].text;
    const beamNames = {cantilever:'Cantilever',simply:'Simply Supported',fixed:'Fixed–Fixed'};
    const loadNames = {point:'Point load',dist:'UDL',tri:'Triangular load'};
    const sectNames = {rect:'Rectangular',ibeam:'I-Beam',circ:'Circular',hollow:'Hollow Box'};
    const secName   = stdSectionOverride?(stdSectionOverride.name||'Standard'):sectNames[sect];
    const compliant = document.getElementById('stampText').textContent;
    const isCompliant = compliant.includes('COMPLIANT') && !compliant.includes('NON');
    const raw  = parseFloat(document.getElementById('pricePerKg').value);
    const ppkg = (!isNaN(raw)&&raw>0)?raw:120;
    const mass = (p.sec.A*p.L*p.density).toFixed(1);
    const total = (p.sec.A*p.L*p.density*ppkg).toLocaleString('en-KE',{maximumFractionDigits:0});
    const posText = load==='point'?' at '+(getLoadPos()*100).toFixed(0)+'% of span':'';

    const contentW = W - ML - MR;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function checkPage(needed=10) {
      if (y + needed > H - 16) {
        doc.addPage();
        y = MT;
        drawPageFooter();
      }
    }

    function drawPageFooter() {
      doc.setFontSize(7.5);
      doc.setTextColor(148,163,184);
      doc.text('StructaViz v3.1 · Kenya Edition · KS 02-104 · BS 5950 · Eurocode 3  |  For preliminary design only — verify with a registered structural engineer.', ML, H-8);
      doc.setTextColor(30,41,59);
    }

    function sectionTitle(title) {
      checkPage(14);
      y += 6;
      doc.setFillColor(248,250,252);
      doc.rect(ML, y-5, contentW, 8, 'F');
      doc.setDrawColor(226,232,240);
      doc.rect(ML, y-5, contentW, 8, 'S');
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.setTextColor(71,85,105);
      doc.text(title.toUpperCase(), ML+3, y+0.5);
      doc.setFont('helvetica','normal');
      doc.setTextColor(30,41,59);
      y += 8;
    }

    function tableRow(cols, widths, isHeader=false, rowBg=null) {
      checkPage(8);
      const rowH = 7;
      if (rowBg) { doc.setFillColor(...rowBg); doc.rect(ML, y, contentW, rowH, 'F'); }
      doc.setFontSize(isHeader?8:9);
      doc.setFont('helvetica', isHeader?'bold':'normal');
      doc.setTextColor(isHeader?71:51, isHeader?85:65, isHeader?105:79);
      let x = ML + 2;
      cols.forEach((col, i) => {
        doc.text(String(col), x, y+4.8, { maxWidth: widths[i]-3 });
        x += widths[i];
      });
      doc.setDrawColor(241,245,249);
      doc.line(ML, y+rowH, ML+contentW, y+rowH);
      y += rowH;
      doc.setFont('helvetica','normal');
      doc.setTextColor(30,41,59);
    }

    // ── Header ───────────────────────────────────────────────────────────────
    // Green triangle logo
    doc.setFillColor(0,200,150);
    doc.triangle(ML, y+8, ML+5, y, ML+10, y+8, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica','bold');
    doc.setTextColor(15,23,42);
    doc.text('STRUCTAVIZ', ML+14, y+7);
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    doc.setTextColor(100,116,139);
    doc.text('Structural Analysis Report  ·  Kenya Edition v3.1', ML+14, y+13);
    doc.text(`Generated: ${new Date().toLocaleString()}`, ML+14, y+18);
    y += 26;

    // Compliance stamp
    const stampCol = isCompliant ? [209,250,229] : [254,226,226];
    const stampTxt = isCompliant ? [6,95,70]     : [153,27,27];
    doc.setFillColor(...stampCol);
    doc.roundedRect(ML, y, contentW, 9, 2, 2, 'F');
    doc.setFontSize(9.5);
    doc.setFont('helvetica','bold');
    doc.setTextColor(...stampTxt);
    const stampLabel = (isCompliant?'PASS — ':'FAIL — ') + compliant;
    doc.text(stampLabel, ML+4, y+6);
    doc.setFont('helvetica','normal');
    doc.setTextColor(30,41,59);
    y += 14;

    // ── Input Parameters ──────────────────────────────────────────────────────
    sectionTitle('Input Parameters');
    const colW2 = [80, contentW-80];
    tableRow(['Parameter','Value'], colW2, true, [248,250,252]);
    const rows = [
      ['Beam type', beamNames[beam]||beam],
      ['Cross section', secName],
      ['Load type', (loadNames[load]||load)+posText],
      ['Load magnitude', document.getElementById('sLoad').value+(load!=='point'?' kN/m':' kN')],
      ['Span', document.getElementById('sLen').value+' m'],
      ['Material', matStr],
      ['Self-weight', document.getElementById('selfWeight').checked?'Included':'Excluded'],
    ];
    rows.forEach((r,i) => tableRow(r, colW2, false, i%2===0?null:[248,250,252]));
    y += 4;

    // ── Analysis Results ──────────────────────────────────────────────────────
    sectionTitle('Analysis Results');
    const colW3 = [80, 55, contentW-135];
    tableRow(['Result','Value','Limit (KS 02-104)'], colW3, true, [248,250,252]);
    const rxn = getReactions(p);
    const resultRows = [
      ['Max deflection', document.getElementById('mDef').textContent, `${document.getElementById('mAllowDef').textContent} (L/${deflRatio})`],
      ['Max bending moment', document.getElementById('mMom').textContent, '—'],
      ['Max bending stress', document.getElementById('mStress').textContent, `${(p.fy/1e6).toFixed(0)} MPa (fy)`],
      ['Max shear force', document.getElementById('mShear').textContent, `${(Vpl/1000).toFixed(1)} kN (Vpl)`],
      ['Safety factor', document.getElementById('mSF').textContent, '≥ 1.67'],
    ];
    if (beam==='cantilever') {
      resultRows.push(['Support reaction (R)', (rxn.RL/1000).toFixed(2)+' kN', '—']);
      resultRows.push(['Fixed-end moment (MA)', (rxn.MA/1000).toFixed(2)+' kN·m', '—']);
    } else {
      resultRows.push(['Left reaction (RL)', (rxn.RL/1000).toFixed(2)+' kN', '—']);
      resultRows.push(['Right reaction (RR)', (rxn.RR/1000).toFixed(2)+' kN', '—']);
      if (beam==='fixed') {
        resultRows.push(['Fixed-end moment MA', (rxn.MA/1000).toFixed(2)+' kN·m', '—']);
        resultRows.push(['Fixed-end moment MB', (rxn.MB/1000).toFixed(2)+' kN·m', '—']);
      }
    }
    resultRows.forEach((r,i) => tableRow(r, colW3, false, i%2===0?null:[248,250,252]));
    y += 4;

    // ── KS 02-104 Compliance ──────────────────────────────────────────────────
    sectionTitle('KS 02-104 Compliance Checks');
    document.getElementById('codeResults').querySelectorAll('.code-item').forEach((item,i) => {
      checkPage(9);
      const isPass=item.classList.contains('pass'), isWarn=item.classList.contains('warn');
      const bg   = isPass?[209,250,229]:isWarn?[254,243,199]:[254,226,226];
      const tCol = isPass?[6,95,70]:isWarn?[120,53,15]:[153,27,27];
      const name = item.querySelector('.code-name')?.textContent||'';
      const val  = item.querySelector('.code-val')?.textContent||'';
      const badge= item.querySelector('.code-badge')?.textContent||'';
      const rowH = 9;
      doc.setFillColor(...bg);
      doc.rect(ML, y, contentW, rowH, 'F');
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
      doc.text(name, ML+3, y+4);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,116,139);
      doc.text(val, ML+3, y+8);
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...tCol);
      doc.text(badge, ML+contentW-16, y+5.5);
      doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59);
      doc.setDrawColor(226,232,240);
      doc.line(ML, y+rowH, ML+contentW, y+rowH);
      y += rowH+1;
    });
    y += 4;

    // ── Cost Estimate ─────────────────────────────────────────────────────────
    sectionTitle('Cost Estimate (KES)');
    const colW2b = [80, contentW-80];
    tableRow(['Item','Value'], colW2b, true, [248,250,252]);
    [
      ['Volume', (p.sec.A*p.L).toFixed(4)+' m³'],
      ['Mass', mass+' kg'],
      ['Price per kg', 'KES '+ppkg],
      ['Estimated material cost', 'KES '+total],
    ].forEach((r,i) => tableRow(r, colW2b, false, i%2===0?null:[248,250,252]));
    y += 4;

    // ── Analysis Diagram ──────────────────────────────────────────────────────
    sectionTitle('Analysis Diagram');
    checkPage(80);

    // Force render 2D canvas
    const c2d = document.getElementById('c2d');
    const prevDisplay = document.getElementById('view2d').style.display;
    document.getElementById('view2d').style.display='';
    draw2d(xs, defs, moms, shrs, p, allowDef);
    const imgData = c2d.toDataURL('image/png');
    document.getElementById('view2d').style.display = prevDisplay;

    const imgW = contentW;
    const imgH = imgW * (c2d.height / c2d.width);
    checkPage(imgH+4);
    doc.addImage(imgData, 'PNG', ML, y, imgW, Math.min(imgH, 80));
    y += Math.min(imgH, 80) + 4;

    // ── Footer on last page ───────────────────────────────────────────────────
    drawPageFooter();

    // ── Save ─────────────────────────────────────────────────────────────────
    const filename = `StructaViz_Report_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);

  } catch(err) {
    console.error('PDF export error:', err);
    alert('PDF export failed: '+err.message);
  }

  btn.disabled=false;
  btn.textContent='Export PDF Report';
}

// ─── SAVED PROJECTS ───────────────────────────────────────────────────────────
const SAVE_KEY = 'structaviz_saves';
const MAX_SAVES = 5;

function getSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; }
  catch { return []; }
}

function captureState() {
  return {
    name:         '',
    savedAt:      new Date().toISOString(),
    beam,
    load,
    combinedLoad,
    sectionMode,
    sect,
    spanCount,
    spanLengths:  [...spanLengths],
    spanLoads:    [...spanLoads],
    spanLoadTypes:[...spanLoadTypes],
    spanLoadPos:  [...spanLoadPos],
    sLoad:        document.getElementById('sLoad').value,
    sLen:         document.getElementById('sLen').value,
    sH:           document.getElementById('sH').value,
    sR:           document.getElementById('sR').value,
    sMat:         document.getElementById('sMat').value,
    selfWeight:   document.getElementById('selfWeight').checked,
    sPos:         document.getElementById('sPos').value,
    sCombinedUDL: document.getElementById('sCombinedUDL')?.value || '10',
    pricePerKg:   document.getElementById('pricePerKg').value,
    stdCat:       document.getElementById('stdCat').value,
    stdSec:       document.getElementById('stdSec').value,
  };
}

function restoreState(s) {
  // Beam & load type
  beam = s.beam || 'cantilever';
  document.querySelectorAll('.btype').forEach(b => b.classList.remove('on'));
  const beamMap = { cantilever: 0, simply: 1, fixed: 2 };
  document.querySelectorAll('#singleSpanBeamSec .btype')[beamMap[beam]]?.classList.add('on');

  load = s.load || 'point';
  document.querySelectorAll('.ltype').forEach(b => b.classList.remove('on'));
  const loadMap = { point: 0, dist: 1, tri: 2 };
  document.querySelectorAll('.ltype')[loadMap[load]]?.classList.add('on');
  document.getElementById('loadLabel').textContent =
    { point:'Load (kN)', dist:'Load rate (kN/m)', tri:'Peak rate (kN/m)' }[load];

  // Sliders
  document.getElementById('sLoad').value = s.sLoad;
  document.getElementById('sLen').value  = s.sLen;
  document.getElementById('sH').value    = s.sH;
  document.getElementById('sR').value    = s.sR;
  document.getElementById('sPos').value  = s.sPos;
  if (document.getElementById('sCombinedUDL')) document.getElementById('sCombinedUDL').value = s.sCombinedUDL;
  sv('vLoad', s.sLoad, ''); sv('vLen', s.sLen, '');
  sv('vH', s.sH, ''); sv('vR', (s.sR/10).toFixed(1), '');
  document.getElementById('vCombinedUDL') && sv('vCombinedUDL', s.sCombinedUDL, '');

  // Selects
  document.getElementById('sMat').value = s.sMat;
  document.getElementById('selfWeight').checked = s.selfWeight;
  document.getElementById('pricePerKg').value   = s.pricePerKg;

  // Combined load
  combinedLoad = s.combinedLoad || false;
  if (document.getElementById('combinedCheck')) document.getElementById('combinedCheck').checked = combinedLoad;
  updateCombinedUDLVisibility();

  // Multi-span
  spanCount     = s.spanCount || 1;
  spanLengths   = s.spanLengths   || [8,8,8];
  spanLoads     = s.spanLoads     || [50,50,50];
  spanLoadTypes = s.spanLoadTypes || ['udl','udl','udl'];
  spanLoadPos   = s.spanLoadPos   || [0.5,0.5,0.5];
  setSpanCount(spanCount, true);

  // Section mode
  sectionMode = s.sectionMode || 'custom';
  setSectionMode(sectionMode, true);
  if (sectionMode === 'std') {
    document.getElementById('stdCat').value = s.stdCat;
    populateStdSections();
    document.getElementById('stdSec').value = s.stdSec;
    applyStdSection();
  } else {
    sect = s.sect || 'rect';
    buildSectionGrid();
  }

  updateLoadPosVisibility();
  updatePosLabel();
  go();
}

function saveProject() {
  const saves = getSaves();
  if (saves.length >= MAX_SAVES) {
    alert(`You have ${MAX_SAVES} saves already. Delete one first.`);
    return;
  }
  const name = prompt('Name this project:', 'Beam ' + (saves.length + 1));
  if (!name) return;
  const state  = captureState();
  state.name   = name.trim() || 'Untitled';
  state.savedAt = new Date().toISOString();
  saves.push(state);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  renderSaves();
}

function loadProject(idx) {
  const saves = getSaves();
  if (!saves[idx]) return;
  restoreState(saves[idx]);
}

function deleteProject(idx) {
  const saves = getSaves();
  saves.splice(idx, 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  renderSaves();
}

function renderSaves() {
  const saves = getSaves();
  const list  = document.getElementById('savesList');
  if (!list) return;
  if (saves.length === 0) {
    list.innerHTML = '<div class="saves-empty">No saved projects yet.</div>';
    return;
  }
  list.innerHTML = saves.map((s, i) => {
    const date = new Date(s.savedAt).toLocaleDateString('en-KE', { day:'numeric', month:'short' });
    return `<div class="save-item">
      <div class="save-info">
        <div class="save-name">${s.name}</div>
        <div class="save-meta">${date} · ${s.beam} · ${s.sLen}m</div>
      </div>
      <div class="save-actions">
        <button class="save-load-btn" onclick="loadProject(${i})">Load</button>
        <button class="save-del-btn" onclick="deleteProject(${i})">&times;</button>
      </div>
    </div>`;
  }).join('');
}

// ─── SLAB MODULE — Solid slab, BS 8110 Table 3.13 (simply supported, 4 sides) ─
// Scope note: only the plain simply-supported case is implemented (verified
// coefficients). Restrained/continuous-edge cases (BS 8110 Table 3.14) are
// deferred until that fuller table can be verified against a trusted source.

const SLAB_T313 = {
  ratio: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
  asx:   [0.062, 0.074, 0.084, 0.093, 0.099, 0.104, 0.113, 0.118],
  asy:   [0.062, 0.061, 0.059, 0.055, 0.051, 0.046, 0.037, 0.029]
};

function slabCoeffs(ratio) {
  const r = Math.min(Math.max(ratio, 1.0), 2.0);
  const R = SLAB_T313.ratio;
  for (let i = 0; i < R.length - 1; i++) {
    if (r >= R[i] && r <= R[i + 1]) {
      const t = (r - R[i]) / (R[i + 1] - R[i]);
      return {
        asx: SLAB_T313.asx[i] + t * (SLAB_T313.asx[i + 1] - SLAB_T313.asx[i]),
        asy: SLAB_T313.asy[i] + t * (SLAB_T313.asy[i + 1] - SLAB_T313.asy[i])
      };
    }
  }
  const n = R.length - 1;
  return { asx: SLAB_T313.asx[n], asy: SLAB_T313.asy[n] };
}

function setMode(m) {
  appMode = m;
  document.getElementById('modeBeamBtn').classList.toggle('on', m === 'beam');
  document.getElementById('modeSlabBtn').classList.toggle('on', m === 'slab');
  document.getElementById('beamSidebar').style.display = m === 'beam' ? '' : 'none';
  document.getElementById('slabSidebar').style.display  = m === 'slab' ? '' : 'none';
  document.getElementById('beamMain').style.display = m === 'beam' ? '' : 'none';
  document.getElementById('slabMain').style.display = m === 'slab' ? '' : 'none';
  if (m === 'slab') slabGo(); else go();
}

function getSlabParams() {
  const LxIn = parseFloat(document.getElementById('sSlabLx').value);
  const LyIn = parseFloat(document.getElementById('sSlabLy').value);
  const Lx = Math.min(LxIn, LyIn);   // short span, always ≤ Ly
  const Ly = Math.max(LxIn, LyIn);
  const h   = parseFloat(document.getElementById('sSlabH').value); // mm
  const fcu = parseFloat(document.getElementById('sSlabFcu').value);
  const fy  = parseFloat(document.getElementById('sSlabFy').value);
  const qk  = parseFloat(document.getElementById('sSlabQk').value); // kN/m²
  const selfWeight = document.getElementById('slabSelfWeight').checked ? 24 * (h / 1000) : 0;
  const n = qk + selfWeight; // total design load, kN/m² (simplified — no separate load factors, consistent with beam module)
  const ratio = Ly / Lx;
  const oneWay = ratio > 2.0;
  return { Lx, Ly, h, fcu, fy, qk, selfWeight, n, ratio, oneWay };
}

function slabGo() {
  const p = getSlabParams();

  let Msx, Msy;
  if (p.oneWay) {
    // Ly/Lx > 2 — treated as a 1m-wide simply supported strip spanning Lx
    Msx = (p.n * p.Lx * p.Lx) / 8;
    Msy = 0;
  } else {
    const c = slabCoeffs(p.ratio);
    Msx = c.asx * p.n * p.Lx * p.Lx;
    Msy = c.asy * p.n * p.Lx * p.Lx;
  }

  // Effective depth — assumes 12mm main bars, 25mm cover (typical floor slab)
  const cover = 25, barDia = 12;
  const d = p.h - cover - barDia / 2; // mm

  function reqAs(M_kNm) {
    if (M_kNm <= 0) return 0;
    const Mns = M_kNm * 1e6;        // N·mm per metre width
    const z = 0.95 * d;              // mm, simplified lever arm
    return Mns / (0.87 * p.fy * z);  // mm²/m
  }
  const AsX = reqAs(Msx);
  const AsY = p.oneWay ? 0 : reqAs(Msy);
  const AsMinPct = p.fy >= 460 ? 0.0013 : 0.0024; // BS 8110 minimum reinforcement ratio
  const AsMin = AsMinPct * 1000 * p.h;

  // Deflection — BS 8110 basic span/effective-depth ratio (simply supported = 20, unmodified)
  const basicRatio = 20;
  const actualLd = (p.Lx * 1000) / d;
  const defPass = actualLd <= basicRatio;

  // Minimum practical thickness for a solid floor slab
  const minThk = 125;
  const thkPass = p.h >= minThk;

  // ── Classification badge ──
  const badge = document.getElementById('slabTypeBadge');
  badge.textContent = p.oneWay
    ? `ONE-WAY · Ly/Lx = ${p.ratio.toFixed(2)} (>2.0)`
    : `TWO-WAY · Ly/Lx = ${p.ratio.toFixed(2)}`;

  // ── Metrics strip ──
  document.getElementById('mSlabMsx').textContent = Msx.toFixed(2) + ' kN·m/m';
  document.getElementById('mSlabMsy').textContent = p.oneWay ? '—' : Msy.toFixed(2) + ' kN·m/m';
  document.getElementById('mSlabN').textContent   = p.n.toFixed(2) + ' kN/m²';
  document.getElementById('mSlabLd').textContent  = actualLd.toFixed(1);
  document.getElementById('mSlabLd').className    = 'metric-val ' + (defPass ? 'ok' : 'fail');
  document.getElementById('mSlabAllowLd').textContent = basicRatio.toFixed(0);
  document.getElementById('mSlabRatio').textContent = p.ratio.toFixed(2);

  // ── Compliance panel ──
  const checks = [
    {
      name: 'Deflection (span/depth, basic ratio)',
      pass: defPass, warn: actualLd <= basicRatio * 1.1,
      val: `L/d = ${actualLd.toFixed(1)} / ${basicRatio} max`
    },
    {
      name: 'Minimum slab thickness',
      pass: thkPass, warn: p.h >= minThk - 10,
      val: `${p.h} mm / ${minThk} mm min`
    },
    {
      name: 'Reinforcement required — short span',
      pass: true, warn: false,
      val: `As,req ${AsX.toFixed(0)} mm²/m · As,min ${AsMin.toFixed(0)} mm²/m → provide ${Math.max(AsX, AsMin).toFixed(0)} mm²/m`
    }
  ];
  if (!p.oneWay) {
    checks.push({
      name: 'Reinforcement required — long span',
      pass: true, warn: false,
      val: `As,req ${AsY.toFixed(0)} mm²/m · As,min ${AsMin.toFixed(0)} mm²/m → provide ${Math.max(AsY, AsMin).toFixed(0)} mm²/m`
    });
  }

  const allPass = checks.every(c => c.pass);
  document.getElementById('slabStampDot').className = 'stamp-dot ' + (allPass ? 'ok' : 'fail');
  document.getElementById('slabStampText').textContent = allPass ? 'DEFLECTION & THICKNESS OK' : 'CHECK REQUIRED';
  document.getElementById('slabStamp').className = 'stamp ' + (allPass ? 'ok' : 'fail');

  const sr = document.getElementById('slabResults');
  sr.innerHTML = '';
  checks.forEach(c => {
    const cls  = c.pass ? 'pass' : c.warn ? 'warn' : 'fail';
    const bcls = c.pass ? 'badge-pass' : c.warn ? 'badge-warn' : 'badge-fail';
    const lbl  = c.pass ? 'PASS' : c.warn ? 'WARN' : 'FAIL';
    sr.innerHTML += `<div class="code-item ${cls}">
      <div><div class="code-name">${c.name}</div><div class="code-val">${c.val}</div></div>
      <span class="code-badge ${bcls}">${lbl}</span></div>`;
  });

  drawSlabPlan(p, Msx, Msy);
}

function drawSlabPlan(p, Msx, Msy) {
  const c = document.getElementById('cSlab');
  const dpr = window.devicePixelRatio || 1;
  const W = c.offsetWidth || 700, H = 340;
  c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const text2   = getCSSVar('--text2')   || '#94a3b8';
  const accent  = getCSSVar('--accent')  || '#00c896';
  const accent3 = getCSSVar('--accent3') || '#3b82f6';

  // Panel rectangle — Ly drawn horizontally, Lx (short span) drawn vertically
  const pad = 60;
  const availW = W - pad * 2, availH = H - pad * 2;
  const scale = Math.min(availW / p.Ly, availH / p.Lx);
  const rw = p.Ly * scale, rh = p.Lx * scale;
  const rx = (W - rw) / 2, ry = (H - rh) / 2;

  ctx.fillStyle = 'rgba(0,200,150,0.06)';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);

  // Support hatching on all four edges (simply supported)
  ctx.strokeStyle = text2;
  ctx.lineWidth = 1;
  const tick = 6, step = 16;
  for (let x = rx; x <= rx + rw; x += step) {
    ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x - tick, ry - tick); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, ry + rh); ctx.lineTo(x - tick, ry + rh + tick); ctx.stroke();
  }
  for (let y = ry; y <= ry + rh; y += step) {
    ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx - tick, y - tick); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + rw, y); ctx.lineTo(rx + rw + tick, y - tick); ctx.stroke();
  }

  // Dimension labels
  ctx.fillStyle = text2;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Ly = ${p.Ly.toFixed(2)} m`, rx + rw / 2, ry + rh + 30);
  ctx.save();
  ctx.translate(rx - 34, ry + rh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`Lx = ${p.Lx.toFixed(2)} m`, 0, 0);
  ctx.restore();

  // Classification label
  ctx.textAlign = 'left';
  ctx.fillStyle = accent3;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(p.oneWay ? 'ONE-WAY SLAB' : 'TWO-WAY SLAB', rx, ry - 16);

  // Moment annotations
  ctx.textAlign = 'center';
  ctx.font = '11px monospace';
  ctx.strokeStyle = accent;
  ctx.beginPath(); ctx.moveTo(rx + rw * 0.3, ry + 10); ctx.lineTo(rx + rw * 0.3, ry + rh - 10); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillText(`Msx = ${Msx.toFixed(2)} kN·m/m`, rx + rw * 0.3, ry + rh / 2 - 10);

  if (!p.oneWay) {
    ctx.strokeStyle = accent3;
    ctx.beginPath(); ctx.moveTo(rx + 10, ry + rh * 0.72); ctx.lineTo(rx + rw - 10, ry + rh * 0.72); ctx.stroke();
    ctx.fillStyle = accent3;
    ctx.fillText(`Msy = ${Msy.toFixed(2)} kN·m/m`, rx + rw / 2, ry + rh * 0.72 + 20);
  }
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => { if (appMode === 'slab') slabGo(); else go(); });

// ─── INIT ─────────────────────────────────────────────────────────────────────
updateLoadPosVisibility();
updatePosLabel();
updateCombinedUDLVisibility();
buildSectionGrid();
populateStdSections();
renderSaves();
go();