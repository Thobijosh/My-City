'use strict';
/* My City — mayor mode. Zone, build, balance the budget, and drive exotic cars. */
(function () {
  const G = GFX, E = G.E, P = G.P, PXf = G.PXf, PYf = G.PYf, hash2 = G.hash2, clamp = G.clamp, lerp = G.lerp;
  const MAP = 48, DAY_SEC = 300, MONTH_SEC = 20, SAVE_KEY = 'mycity-save-v2';
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d');
  let W = 800, H = 600, DPR = 1;
  const cam = { x: 24, y: 24, zoom: 1 };
  let now = 0, nightness = 0, mulCol = 'rgb(255,255,255)';
  const fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.floor(n)).toLocaleString('en-US');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const N = MAP * MAP, idx = (x, y) => y * MAP + x, inb = (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---------- definitions ----------
  const ZT = [null, 'zr', 'zc', 'zi'];
  const ZONES = [{ id: 1, name: 'Residential', icon: '🟩', col: '#4ade80', sub: 'Homes grow here' }, { id: 2, name: 'Commercial', icon: '🟦', col: '#60a5fa', sub: 'Shops & offices' }, { id: 3, name: 'Industrial', icon: '🟨', col: '#fbbf24', sub: 'Factories & jobs' }, { id: 0, name: 'Clear zone', icon: '🧽', col: '#f87171', sub: 'Remove zoning' }];
  const ZPOP = [4, 14, 45], ZJC = [5, 16, 60], ZJI = [8, 22, 55], ZCR = [1, 3, 8], ZCC = [1, 3, 9], ZCI = [2, 5, 12];
  const DEFS = {
    cottage: { name: 'Cottage', icon: '🏠', cat: 'homes', w: 1, d: 1, cost: 2500, inc: 120, pop: 4, cons: 1, kind: 'cottage' },
    family: { name: 'Family Home', icon: '🏡', cat: 'homes', w: 2, d: 2, cost: 9000, inc: 520, pop: 6, cons: 2, kind: 'family' },
    apartment: { name: 'Apartments', icon: '🏢', cat: 'homes', w: 2, d: 2, cost: 45000, inc: 3200, pop: 36, cons: 6, kind: 'apartment' },
    villa: { name: 'Modern Villa', icon: '🏖️', cat: 'homes', w: 3, d: 3, cost: 38000, inc: 2600, pop: 6, cons: 3, kind: 'villa' },
    mansion: { name: 'Mansion', icon: '🏰', cat: 'homes', w: 4, d: 3, cost: 120000, inc: 9500, pop: 8, cons: 5, kind: 'mansion' },
    tower: { name: 'Luxury Tower', icon: '🏙️', cat: 'homes', w: 3, d: 3, cost: 320000, inc: 30000, pop: 120, cons: 16, kind: 'tower', beacon: [1.5, 1.5, 12.3] },
    coal: { name: 'Coal Power Plant', icon: '🏭', cat: 'utils', w: 3, d: 3, cost: 38000, upkeep: 520, ucat: 'power', supply: 'power', cap: 140, poll: 8, kind: 'coal', jobs: 14, sub: '⚡140 · pollutes' },
    solar: { name: 'Solar Farm', icon: '☀️', cat: 'utils', w: 3, d: 2, cost: 22000, upkeep: 140, ucat: 'power', supply: 'power', cap: 45, kind: 'solar', jobs: 3, sub: '⚡45 · clean' },
    water: { name: 'Water Tower', icon: '💧', cat: 'utils', w: 1, d: 1, cost: 9000, upkeep: 160, ucat: 'water', supply: 'water', cap: 110, kind: 'water', jobs: 2, sub: '💧110' },
    police: { name: 'Police Station', icon: '🚓', cat: 'serv', w: 2, d: 2, cost: 14000, upkeep: 650, ucat: 'police', cov: 'police', r: 9, cons: 2, kind: 'police', jobs: 8 },
    fire: { name: 'Fire Station', icon: '🚒', cat: 'serv', w: 2, d: 2, cost: 14000, upkeep: 650, ucat: 'fire', cov: 'fire', r: 9, cons: 2, kind: 'fire', jobs: 8 },
    clinic: { name: 'Clinic', icon: '🏥', cat: 'serv', w: 2, d: 2, cost: 20000, upkeep: 800, ucat: 'health', cov: 'health', r: 10, cons: 2, kind: 'clinic', jobs: 12 },
    school: { name: 'School', icon: '🏫', cat: 'serv', w: 3, d: 2, cost: 24000, upkeep: 700, ucat: 'edu', cov: 'edu', r: 10, cons: 2, kind: 'school', jobs: 14 },
    park: { name: 'Park', icon: '🌳', cat: 'serv', w: 2, d: 2, cost: 4000, upkeep: 60, ucat: 'park', cov: 'park', r: 6, kind: 'park' },
    garage: { name: 'Garage', icon: '🅿️', cat: 'extras', w: 2, d: 2, cost: 6000, kind: 'garage' },
    tree: { name: 'Tree', icon: '🌲', cat: 'extras', w: 1, d: 1, cost: 100, kind: 'tree' },
    fountain: { name: 'Fountain', icon: '⛲', cat: 'extras', w: 1, d: 1, cost: 600, kind: 'fountain' },
    zr: { name: 'Residential', icon: '🏘️', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zr' },
    zc: { name: 'Commercial', icon: '🏬', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zc' },
    zi: { name: 'Industrial', icon: '🏭', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zi' }
  };
  const CARS = {
    hatch: { name: 'City Hatch', price: 0, max: 4.6, acc: 3.2, brake: 6, L: 0.56, W: 0.3, bh: 0.17, ch: 0.13, cab: [-0.27, 0.1, -0.18, -0.02], cwb: 0.44, cwt: 0.34, colors: ['#2f6fed', '#e5e7eb', '#dc2626', '#f59e0b', '#16a34a', '#111827'], tag: 'Starter' },
    zephyr: { name: 'Zephyr S Roadster', price: 35000, max: 7, acc: 4.5, brake: 7, L: 0.62, W: 0.32, bh: 0.15, ch: 0.09, cab: [-0.2, 0.05, -0.12, -0.02], cwb: 0.4, cwt: 0.3, colors: ['#e11d48', '#facc15', '#0ea5e9', '#f8fafc', '#7c3aed', '#111827'], tag: 'Roadster' },
    titan: { name: 'Titan SUV', price: 80000, max: 6.2, acc: 3.6, brake: 6.5, L: 0.68, W: 0.36, bh: 0.24, ch: 0.17, cab: [-0.33, 0.14, -0.28, 0.0], cwb: 0.44, cwt: 0.38, colors: ['#111827', '#e5e7eb', '#166534', '#7f1d1d', '#1e3a8a', '#92400e'], tag: 'SUV' },
    vortex: { name: 'Vortex GT', price: 120000, max: 8.6, acc: 5.5, brake: 8, L: 0.7, W: 0.35, bh: 0.14, ch: 0.09, cab: [-0.18, 0.1, -0.08, 0.0], cwb: 0.4, cwt: 0.3, spoiler: 1, colors: ['#f97316', '#2563eb', '#f8fafc', '#111827', '#dc2626', '#84cc16'], tag: 'Grand tourer' },
    stallion: { name: 'Stallion V12', price: 250000, max: 9.8, acc: 6.5, brake: 9, L: 0.74, W: 0.36, bh: 0.13, ch: 0.08, cab: [-0.14, 0.12, -0.06, 0.02], cwb: 0.38, cwt: 0.28, spoiler: 1, colors: ['#facc15', '#dc2626', '#0f172a', '#e2e8f0', '#059669', '#a855f7'], tag: 'Supercar' },
    phantom: { name: 'Phantom Aero', price: 650000, max: 11.5, acc: 8, brake: 10, L: 0.78, W: 0.38, bh: 0.115, ch: 0.075, cab: [-0.12, 0.1, -0.05, 0.03], cwb: 0.36, cwt: 0.26, spoiler: 2, colors: ['#0f172a', '#f8fafc', '#b91c1c', '#0369a1', '#d4a017', '#7e22ce'], tag: 'Hypercar' }
  };
  const NPC_MODELS = ['hatch', 'hatch', 'zephyr', 'titan', 'vortex'];
  const NPC_COLORS = ['#e5e7eb', '#9ca3af', '#2563eb', '#dc2626', '#fbbf24', '#10b981', '#111827', '#f97316'];
  const RANKS = [{ n: 'Hamlet', p: 0 }, { n: 'Village', p: 60 }, { n: 'Town', p: 250 }, { n: 'City', p: 900 }, { n: 'Metropolis', p: 3000 }, { n: 'Megacity', p: 8000 }];

  // ---------- state ----------
  const TER = G.terrain(MAP);
  const S = {
    money: 60000, t: 8, month: 0, name: 'New Haven', tax: 9, nextId: 1, speed: 1,
    road: new Uint8Array(N), zone: new Uint8Array(N), occ: new Int32Array(N), water: TER.water, scen: new Map(), blds: new Map(),
    cars: [{ m: 'hatch', color: '#2f6fed' }], mode: 'build', tool: 'move', toolType: null, zoneType: 1, cat: 'move', drive: null, rank: 0
  };
  const ST = { pop: 0, jobsC: 0, jobsI: 0, jobs: 0, dem: [0.3, 0.2, 0.2], appr: 50, apprT: 50, rP: 1, rW: 1, supP: 0, demP: 0, supW: 0, demW: 0, inc: { r: 0, c: 0, i: 0, l: 0 }, exp: { police: 0, fire: 0, health: 0, edu: 0, power: 0, water: 0, park: 0, road: 0 }, incT: 0, expT: 0, net: 0, cov: { police: 0, fire: 0, health: 0, edu: 0, park: 0, poll: 0 }, issues: [], unpow: 0, noroad: 0 };
  let roadList = [], zoneList = [], npcs = [], people = [], lamps = [], pwF = new Uint8Array(N), wtF = new Uint8Array(N), covG = null;
  let pending = null, hoverT = null, zStart = null, zEnd = null;
  const isRoad = (x, y) => inb(x, y) && S.road[idx(x, y)] === 1;
  const solid = (x, y) => !inb(x, y) || S.occ[idx(x, y)] > 0 || S.water[idx(x, y)] === 1;
  const dOf = b => DEFS[b.type];

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2400); }
  function info(html, ms) { const t = $('info'); t.innerHTML = html; t.hidden = false; clearTimeout(info.h); info.h = setTimeout(() => { t.hidden = true; }, ms || 5000); }

  // ---------- simulation ----------
  function energize(kind) {
    const fl = new Uint8Array(N), q = [];
    for (const b of S.blds.values()) {
      const d = dOf(b); if (d.supply !== kind) continue;
      for (let y = b.y - 1; y <= b.y + d.d; y++) for (let x = b.x - 1; x <= b.x + d.w; x++) if (isRoad(x, y) && !fl[idx(x, y)]) { fl[idx(x, y)] = 1; q.push(idx(x, y)); }
    }
    while (q.length) { const i = q.pop(), x = i % MAP, y = (i / MAP) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (isRoad(nx, ny) && !fl[idx(nx, ny)]) { fl[idx(nx, ny)] = 1; q.push(idx(nx, ny)); } } }
    return fl;
  }
  function nearXY(fl, x0, y0, w, d, r) {
    for (let y = y0 - r; y < y0 + d + r; y++) for (let x = x0 - r; x < x0 + w + r; x++) if (inb(x, y) && fl[idx(x, y)]) return true;
    return false;
  }
  function stamp(arr, b, d, r, add) {
    const cx = b.x + d.w / 2, cy = b.y + d.d / 2;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MAP - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MAP - 1, Math.ceil(cx + r)); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { if (add) arr[idx(x, y)] = Math.min(255, arr[idx(x, y)] + 1); else arr[idx(x, y)] = 1; }
  }
  function bstats(b) {
    const d = dOf(b);
    if (b.type === 'zr') return { pop: ZPOP[b.lvl - 1], jobs: 0, cons: ZCR[b.lvl - 1], kind: 'r' };
    if (b.type === 'zc') return { pop: 0, jobs: ZJC[b.lvl - 1], cons: ZCC[b.lvl - 1], kind: 'c' };
    if (b.type === 'zi') return { pop: 0, jobs: ZJI[b.lvl - 1], cons: ZCI[b.lvl - 1], kind: 'i' };
    return { pop: d.pop || 0, jobs: d.jobs || 0, cons: d.cons || 0, lux: d.inc || 0, kind: d.inc ? 'l' : '' };
  }
  function recalc() {
    roadList = []; zoneList = [];
    for (let i = 0; i < N; i++) { if (S.road[i]) roadList.push(i); if (S.zone[i]) zoneList.push(i); }
    pwF = energize('power'); wtF = energize('water');
    const cov = { police: new Uint8Array(N), fire: new Uint8Array(N), health: new Uint8Array(N), edu: new Uint8Array(N), park: new Uint8Array(N) }, poll = new Uint8Array(N), green = new Uint8Array(N);
    const exp = { police: 0, fire: 0, health: 0, edu: 0, power: 0, water: 0, park: 0, road: roadList.length * 1.5 };
    let supP = 0, supW = 0, hasPlant = false;
    for (const b of S.blds.values()) {
      const d = dOf(b);
      if (d.supply === 'power') { supP += d.cap; hasPlant = true; } if (d.supply === 'water') supW += d.cap;
      if (d.upkeep) exp[d.ucat] += d.upkeep;
      if (d.cov) stamp(cov[d.cov], b, d, d.r);
      if (d.poll) stamp(poll, b, d, d.poll);
      if (b.type === 'zi') stamp(poll, b, d, 1 + b.lvl);
      if (b.type === 'tree' || b.type === 'fountain') stamp(green, b, d, 3, true);
    }
    let demP = 0, demW = 0, pop = 0, jobsC = 0, jobsI = 0, jobsPub = 0, unpow = 0, noroad = 0;
    for (const b of S.blds.values()) {
      const d = dOf(b), s = bstats(b); b.s = s;
      b.road = nearXY(S.road, b.x, b.y, d.w, d.d, 2); b.pw = nearXY(pwF, b.x, b.y, d.w, d.d, 2); b.wt = nearXY(wtF, b.x, b.y, d.w, d.d, 2);
      if (s.cons && b.road) { if (b.pw) demP += s.cons; if (b.wt) demW += s.cons; }
    }
    const rP = demP > 0 ? Math.min(1, supP / demP) : 1, rW = demW > 0 ? Math.min(1, supW / demW) : 1;
    let wPop = 0, cP = 0, cF = 0, cH = 0, cE = 0, cK = 0, cPoll = 0;
    const inc = { r: 0, c: 0, i: 0, l: 0 }, k = S.tax / 9, ap = 0.6 + 0.4 * ST.appr / 100;
    for (const b of S.blds.values()) {
      const d = dOf(b), s = b.s; b.op = b.road && b.pw && b.wt;
      b.eff = s.cons ? (b.op ? Math.min(rP, rW) : (b.road ? 0.25 : 0.1)) : 1;
      if (s.cons && !b.op) { if (b.road) unpow++; else noroad++; }
      const ci = idx(clamp(b.x + (d.w >> 1), 0, MAP - 1), clamp(b.y + (d.d >> 1), 0, MAP - 1));
      b.lv = clamp(40 + 9 * cov.police[ci] + 9 * cov.fire[ci] + 11 * cov.health[ci] + 11 * cov.edu[ci] + 13 * cov.park[ci] + Math.min(12, green[ci] * 3) - 28 * poll[ci], 0, 100);
      if (s.pop) { const p = Math.round(s.pop * (b.op ? 1 : 0.4)); b.popNow = p; pop += p; wPop += p; cP += p * cov.police[ci]; cF += p * cov.fire[ci]; cH += p * cov.health[ci]; cE += p * cov.edu[ci]; cK += p * cov.park[ci]; cPoll += p * poll[ci]; }
      const jobs = s.jobs * (b.op ? 1 : 0.3); b.jobsNow = jobs;
      if (s.kind === 'c') jobsC += jobs; else if (s.kind === 'i') jobsI += jobs; else if (s.jobs) jobsPub += jobs;
      if (s.kind === 'r') inc.r += s.pop * 28 * k * b.eff * ap; else if (s.kind === 'c') inc.c += jobs * 36 * k * b.eff * ap; else if (s.kind === 'i') inc.i += jobs * 32 * k * b.eff * ap; else if (s.kind === 'l') inc.l += s.lux * k * b.eff;
    }
    const f = v => wPop > 0 ? v / wPop : 0;
    ST.cov = { police: f(cP), fire: f(cF), health: f(cH), edu: f(cE), park: f(cK), poll: f(cPoll) > 0 ? Math.min(1, f(cPoll)) : 0 };
    const jobs = jobsC + jobsI + jobsPub, workers = pop * 0.55, unemp = workers > 0 ? Math.max(0, 1 - jobs / workers) : 0;
    Object.assign(ST, { pop, jobsC, jobsI, jobs, rP, rW, supP, demP, supW, demW, inc, exp, unpow, noroad, unemp });
    ST.incT = inc.r + inc.c + inc.i + inc.l; ST.expT = Object.values(exp).reduce((a, b) => a + b, 0); ST.net = ST.incT - ST.expT;
    const tx = S.tax - 9;
    ST.dem = [
      clamp(0.3 + (jobs - workers) / (jobs + workers + 40) * 1.4 + (ST.appr - 50) / 130 - tx * 0.035, -1, 1),
      clamp(0.15 + (pop * 0.3 - jobsC) / (pop * 0.3 + jobsC + 25) * 1.5 - tx * 0.03, -1, 1),
      clamp(0.2 + (pop * 0.28 - jobsI) / (pop * 0.28 + jobsI + 25) * 1.2 - tx * 0.03, -1, 1)];
    ST.apprT = clamp(50 - tx * 2.6 + 10 * ST.cov.police + 8 * ST.cov.fire + 8 * ST.cov.health + 6 * ST.cov.edu + 6 * ST.cov.park - 22 * ST.cov.poll - 25 * (1 - rP) - 20 * (1 - rW) - 15 * unemp, 0, 100);
    covG = cov;
    // advisor
    const is = [];
    if (!hasPlant) is.push('⚡ No power plant yet. Build one from Utilities, right beside a road.');
    if (supW === 0) is.push('💧 No water supply. Build a Water Tower beside a road.');
    if (hasPlant && rP < 0.95) is.push('⚡ Power shortage (' + Math.round(rP * 100) + '% supplied). Add another plant or a Solar Farm.');
    if (supW > 0 && rW < 0.95) is.push('💧 Water shortage (' + Math.round(rW * 100) + '% supplied). Build another Water Tower.');
    if (unpow > 0) is.push('🔌 ' + unpow + ' building(s) are not connected to power or water. Connect them with roads from your plants.');
    if (noroad > 0) is.push('🛣️ ' + noroad + ' building(s) have no road within 2 tiles.');
    if (pop > 20 && ST.cov.police < 0.5) is.push('🚓 Under half of residents are near a police station.');
    if (pop > 20 && ST.cov.fire < 0.5) is.push('🚒 Under half of residents are near a fire station.');
    if (pop > 60 && ST.cov.health < 0.5) is.push('🏥 Build clinics: under half of residents have healthcare.');
    if (pop > 100 && ST.cov.edu < 0.5) is.push('🏫 Build schools: under half of residents have one nearby.');
    if (ST.cov.poll > 0.15) is.push('🏭 Pollution is bothering residents. Keep industry and coal plants away from homes.');
    if (unemp > 0.2) is.push('💼 Not enough jobs. Zone more commercial or industrial land.');
    if (ST.dem[0] > 0.45 && rP > 0.95 && pop > 0) is.push('🏘️ People want to move in. Zone more residential land.');
    if (S.tax > 12) is.push('💸 Taxes are high and citizens are unhappy.');
    if (ST.net < 0 && pop > 0) is.push('📉 Budget deficit of ' + fmt(-ST.net) + '/month. Raise taxes or cut services.');
    ST.issues = is;
    // utilities spread for people/NPC
    lamps = [];
    for (const i of roadList) {
      const x = i % MAP, y = (i / MAP) | 0; if (hash2(x * 5, y * 3) > 0.16) continue;
      let px = null, py = null;
      if (!isRoad(x, y - 1)) { px = x + 0.5; py = y + 0.07; } else if (!isRoad(x + 1, y)) { px = x + 0.93; py = y + 0.5; } else if (!isRoad(x, y + 1)) { px = x + 0.5; py = y + 0.93; } else if (!isRoad(x - 1, y)) { px = x + 0.07; py = y + 0.5; }
      if (px !== null) lamps.push({ x: px, y: py });
    }
    const want = Math.min(14, Math.floor(roadList.length / 10));
    while (npcs.length < want) { if (!spawnNpc()) break; } while (npcs.length > want) npcs.pop();
    const wantP = Math.min(40, Math.floor(pop / 8));
    while (people.length < wantP) { if (!spawnPerson()) break; } while (people.length > wantP) people.pop();
  }
  function spawnZone(x, y, z) {
    const b = { id: S.nextId++, type: ZT[z], x, y, lvl: 1, v: (hash2(x * 3, y * 7) * 4) | 0 };
    S.blds.set(b.id, b); S.occ[idx(x, y)] = b.id; S.scen.delete(idx(x, y)); return b;
  }
  function removeBuilding(b) {
    const d = dOf(b); for (let y = b.y; y < b.y + d.d; y++) for (let x = b.x; x < b.x + d.w; x++) S.occ[idx(x, y)] = 0;
    S.blds.delete(b.id);
  }
  function growStep() {
    if (!zoneList.length) return;
    const gate = ST.rP >= 0.9 && ST.rW >= 0.9 && S.money > -5000;
    let changed = false;
    for (let n = 0; n < 4; n++) {
      const i = zoneList[(Math.random() * zoneList.length) | 0], z = S.zone[i], x = i % MAP, y = (i / MAP) | 0, o = S.occ[i], dem = ST.dem[z - 1];
      if (!o) {
        if (!gate || S.water[i]) continue;
        if (!nearXY(S.road, x, y, 1, 1, 2) || !nearXY(pwF, x, y, 1, 1, 2) || !nearXY(wtF, x, y, 1, 1, 2)) continue;
        if (dem > Math.random() * 0.9) { spawnZone(x, y, z); changed = true; }
      } else {
        const b = S.blds.get(o); if (!b || b.type !== ZT[z]) continue;
        if (!b.road && Math.random() < 0.3) { removeBuilding(b); changed = true; continue; }
        if (dem < -0.3 && Math.random() < 0.05) { removeBuilding(b); changed = true; continue; }
        if (b.lvl < 3 && dem > 0.12 && gate && Math.random() < 0.22) {
          const lv = b.lv || 0, p = ST.pop, ok = b.lvl === 1 ? lv >= 52 && (z !== 2 || p > 30) : lv >= 66 && p > (z === 1 ? 70 : z === 2 ? 150 : 120);
          if (ok) { b.lvl++; changed = true; }
        }
      }
    }
    if (changed) { recalc(); markDirty(); }
  }
  function seedCity() {
    for (const i of zoneList) {
      const x = i % MAP, y = (i / MAP) | 0, z = S.zone[i];
      if (S.occ[i] || !nearXY(S.road, x, y, 1, 1, 2)) continue;
      const p = z === 1 ? 0.5 : z === 2 ? 0.45 : 0.4; if (hash2(x * 11, y * 5) < p) { const b = spawnZone(x, y, z); if (z === 1 && hash2(x, y * 9) > 0.8) b.lvl = 2; }
    }
  }

  // ---------- placing ----------
  function canPlace(type, x0, y0) {
    const d = DEFS[type];
    for (let y = y0; y < y0 + d.d; y++) for (let x = x0; x < x0 + d.w; x++) if (!inb(x, y) || S.road[idx(x, y)] || S.occ[idx(x, y)] || S.water[idx(x, y)]) return false;
    return true;
  }
  function placeBuilding(type, x0, y0, free) {
    const d = DEFS[type];
    if (!canPlace(type, x0, y0)) { toast('Not enough space there'); return false; }
    if (!free && S.money < d.cost) { toast('Not enough cash for ' + d.name); return false; }
    if (!free) S.money -= d.cost;
    const b = { id: S.nextId++, type, x: x0, y: y0, lvl: 1, v: (hash2(x0 * 3, y0 * 7) * 4) | 0 };
    S.blds.set(b.id, b);
    for (let y = y0; y < y0 + d.d; y++) for (let x = x0; x < x0 + d.w; x++) { S.occ[idx(x, y)] = b.id; S.zone[idx(x, y)] = 0; S.scen.delete(idx(x, y)); }
    recalc(); markDirty(); return true;
  }
  function bulldoze(x, y) {
    if (!inb(x, y)) return;
    const i = idx(x, y), o = S.occ[i];
    if (o) { const b = S.blds.get(o), d = dOf(b); removeBuilding(b); if (b.type[0] !== 'z') S.money += Math.floor(d.cost * 0.5); recalc(); markDirty(); }
    else if (S.road[i]) { S.road[i] = 0; S.money += 10; recalc(); markDirty(); }
    else if (S.zone[i]) { S.zone[i] = 0; recalc(); markDirty(); }
    else if (S.scen.has(i)) { S.scen.delete(i); markDirty(); }
  }
  let warnT = 0;
  function paintRoad(x, y) {
    if (!inb(x, y)) return; const i = idx(x, y); if (S.road[i] || S.occ[i] || S.water[i]) return;
    if (S.money < 20) { if (now - warnT > 2) { toast('Not enough cash for roads'); warnT = now; } return; }
    S.money -= 20; S.road[i] = 1; S.zone[i] = 0; S.scen.delete(i); recalc(); markDirty();
  }
  function lineTiles(x0, y0, x1, y1, fn) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) fn(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n))); }
  function zoneRect(a, b) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y); let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inb(x, y)) continue; const i = idx(x, y);
      if (S.zoneType === 0) { if (S.zone[i]) { const o = S.occ[i]; if (o && S.blds.get(o).type[0] === 'z') removeBuilding(S.blds.get(o)); S.zone[i] = 0; n++; } continue; }
      if (S.road[i] || S.water[i] || (S.occ[i] && S.zone[i] !== S.zoneType) || S.zone[i] === S.zoneType) continue;
      if (S.money < 10) { toast('Not enough cash to zone more'); break; }
      S.money -= 10; S.zone[i] = S.zoneType; S.scen.delete(i); n++;
    }
    if (n) { recalc(); markDirty(); toast(n + ' tiles ' + (S.zoneType ? 'zoned · ' + fmt(n * 10) : 'cleared')); }
  }

  // ---------- save / load ----------
  let dirty = false, lastSave = 0;
  function markDirty() { dirty = true; }
  function save() {
    try {
      const roads = [], zones = [], bl = [], scen = [];
      for (let i = 0; i < N; i++) { if (S.road[i]) roads.push(i); if (S.zone[i]) zones.push(i * 4 + S.zone[i]); }
      for (const b of S.blds.values()) bl.push([b.id, b.type, b.x, b.y, b.lvl, b.v]);
      for (const [i, v] of S.scen) scen.push(i * 8 + v);
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, money: S.money, t: S.t, month: S.month, name: S.name, tax: S.tax, nextId: S.nextId, rank: S.rank, roads, zones, bl, scen, cars: S.cars }));
      dirty = false;
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const d = JSON.parse(raw); if (!d || d.v !== 2) return false;
      Object.assign(S, { money: d.money, t: d.t, month: d.month, name: d.name, tax: d.tax, nextId: d.nextId, rank: d.rank || 0, cars: d.cars && d.cars.length ? d.cars : S.cars });
      S.road.fill(0); S.zone.fill(0); S.occ.fill(0); S.blds.clear(); S.scen.clear();
      for (const i of d.roads) S.road[i] = 1; for (const z of d.zones) S.zone[z >> 2] = z & 3; for (const s of d.scen) S.scen.set(s >> 3, s & 7);
      for (const [id, type, x, y, lvl, v] of d.bl) { if (!DEFS[type]) continue; const dd = DEFS[type]; S.blds.set(id, { id, type, x, y, lvl: lvl || 1, v: v || 0 }); for (let yy = y; yy < y + dd.d; yy++) for (let xx = x; xx < x + dd.w; xx++) S.occ[idx(xx, yy)] = id; }
      return true;
    } catch (e) { return false; }
  }
  function newCity() {
    S.road.fill(0); S.zone.fill(0); S.occ.fill(0); S.blds.clear(); S.scen.clear(); S.nextId = 1; S.money = 60000; S.t = 8; S.month = 0; S.tax = 9; S.rank = 0; S.name = 'New Haven';
    S.cars = [{ m: 'hatch', color: '#2f6fed' }];
    for (const [i, v] of G.scenery(MAP, S.water)) S.scen.set(i, v);
    for (let i = 16; i <= 32; i++) { S.road[idx(i, 16)] = 1; S.road[idx(i, 32)] = 1; S.road[idx(16, i)] = 1; S.road[idx(32, i)] = 1; }
    for (let i = 10; i <= 38; i++) { S.road[idx(i, 24)] = 1; S.road[idx(24, i)] = 1; }
    const zrect = (x0, y0, x1, y1, z) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!S.road[idx(x, y)]) S.zone[idx(x, y)] = z; };
    zrect(17, 17, 23, 23, 1); zrect(17, 25, 23, 31, 1); zrect(25, 17, 31, 23, 2); zrect(25, 25, 31, 31, 3);
    placeBuilding('coal', 33, 17, true); placeBuilding('water', 31, 20, true); placeBuilding('garage', 25, 13, true); placeBuilding('park', 21, 13, true);
    for (const k of [...S.scen.keys()]) { const x = k % MAP, y = (k / MAP) | 0; if (x >= 8 && x <= 40 && y >= 8 && y <= 40 && (S.road[k] || S.zone[k] || S.occ[k])) S.scen.delete(k); }
    recalc(); seedCity(); recalc(); ST.appr = ST.apprT; cam.x = 24; cam.y = 24;
  }

  // ---------- lighting ----------
  const KEYS = [{ h: 0, mul: [75, 90, 155], n: 1 }, { h: 5, mul: [75, 90, 155], n: 1 }, { h: 6.5, mul: [255, 200, 165], n: 0.45 }, { h: 8, mul: [255, 252, 246], n: 0 }, { h: 17, mul: [255, 252, 246], n: 0 }, { h: 19, mul: [255, 178, 128], n: 0.4 }, { h: 20.5, mul: [95, 105, 175], n: 0.9 }, { h: 21.5, mul: [75, 90, 155], n: 1 }, { h: 24, mul: [75, 90, 155], n: 1 }];
  function updateLighting() {
    const h = S.t;
    for (let i = 0; i < KEYS.length - 1; i++) { const a = KEYS[i], b = KEYS[i + 1]; if (h >= a.h && h <= b.h) { const k = (h - a.h) / (b.h - a.h || 1); nightness = lerp(a.n, b.n, k); mulCol = 'rgb(' + Math.round(lerp(a.mul[0], b.mul[0], k)) + ',' + Math.round(lerp(a.mul[1], b.mul[1], k)) + ',' + Math.round(lerp(a.mul[2], b.mul[2], k)) + ')'; return; } }
  }

  // ---------- traffic & people ----------
  function spawnNpc() {
    if (!roadList.length) return false;
    for (let t = 0; t < 20; t++) {
      const i = roadList[(Math.random() * roadList.length) | 0], x = i % MAP, y = (i / MAP) | 0, dirs = D4.filter(([dx, dy]) => isRoad(x + dx, y + dy)); if (!dirs.length) continue;
      const [dx, dy] = dirs[(Math.random() * dirs.length) | 0];
      npcs.push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y, dx, dy, a: Math.atan2(dy, dx), m: NPC_MODELS[(Math.random() * NPC_MODELS.length) | 0], color: NPC_COLORS[(Math.random() * NPC_COLORS.length) | 0], v: 1.5 + Math.random() * 1.2, brake: 0 }); return true;
    }
    return false;
  }
  function stepWalker(n, dt, v) {
    const gx = n.tx + n.dx + 0.5, gy = n.ty + n.dy + 0.5, ddx = gx - n.x, ddy = gy - n.y, dist = Math.hypot(ddx, ddy), step = v * dt;
    if (dist <= step) {
      n.x = gx; n.y = gy; n.tx += n.dx; n.ty += n.dy;
      const opts = D4.filter(([dx, dy]) => isRoad(n.tx + dx, n.ty + dy) && !(dx === -n.dx && dy === -n.dy));
      if (opts.length) { const st = opts.find(([dx, dy]) => dx === n.dx && dy === n.dy); const pk = st && Math.random() < 0.65 ? st : opts[(Math.random() * opts.length) | 0]; n.dx = pk[0]; n.dy = pk[1]; } else { n.dx = -n.dx; n.dy = -n.dy; }
    } else { n.x += ddx / dist * step; n.y += ddy / dist * step; }
  }
  function updateNpcs(dt) {
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (!isRoad(n.tx, n.ty) || !isRoad(n.tx + n.dx, n.ty + n.dy)) { npcs.splice(i, 1); spawnNpc(); continue; }
      stepWalker(n, dt, n.v);
      const want = Math.atan2(n.dy, n.dx); let diff = want - n.a; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; n.a += diff * Math.min(1, dt * 8);
    }
  }
  function spawnPerson() {
    if (!roadList.length) return false;
    for (let t = 0; t < 20; t++) {
      const i = roadList[(Math.random() * roadList.length) | 0], x = i % MAP, y = (i / MAP) | 0, dirs = D4.filter(([dx, dy]) => isRoad(x + dx, y + dy)); if (!dirs.length) continue;
      const [dx, dy] = dirs[(Math.random() * dirs.length) | 0];
      people.push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y, dx, dy, side: Math.random() < 0.5 ? -1 : 1, lat: 0, ph: Math.random() * 6, col: ['#d9534f', '#5b8def', '#f0ad4e', '#5cb85c', '#9b59b6', '#ecf0f1', '#2c3e50', '#e67e22'][(Math.random() * 8) | 0], skin: ['#f1c9a5', '#c68c63', '#8d5a3b', '#5a3825'][(Math.random() * 4) | 0] }); return true;
    }
    return false;
  }
  function updatePeople(dt) {
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      if (!isRoad(p.tx, p.ty) || !isRoad(p.tx + p.dx, p.ty + p.dy)) { people.splice(i, 1); spawnPerson(); continue; }
      stepWalker(p, dt, 0.5); p.lat = lerp(p.lat, p.side * 0.405, Math.min(1, dt * 3));
    }
  }

  // ---------- player car ----------
  const keys = { up: 0, down: 0, left: 0, right: 0 }, tc = { up: 0, down: 0, left: 0, right: 0 };
  let AC = null, osc = null, gainN = null, lpN = null, muted = false;
  function audioStart() {
    if (muted) return;
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); if (!osc) { osc = AC.createOscillator(); osc.type = 'sawtooth'; lpN = AC.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 420; gainN = AC.createGain(); gainN.gain.value = 0; osc.connect(lpN); lpN.connect(gainN); gainN.connect(AC.destination); osc.start(); } } catch (e) { /* no audio */ }
  }
  function audioUpdate(r, thr) {
    if (!osc) return; const t = AC.currentTime;
    osc.frequency.setTargetAtTime(48 + r * 170 + thr * 18, t, 0.08); lpN.frequency.setTargetAtTime(380 + r * 900, t, 0.1); gainN.gain.setTargetAtTime(S.mode === 'drive' && !muted ? 0.04 + r * 0.05 : 0, t, 0.12);
  }
  function carBlocked(c, L) { const ca = Math.cos(c.a), sa = Math.sin(c.a); for (const u of [0, L * 0.5, -L * 0.5]) if (solid(Math.floor(c.x + ca * u), Math.floor(c.y + sa * u))) return true; return false; }
  function updateDrive(dt) {
    const c = S.drive, m = CARS[S.cars[c.idx].m], up = keys.up || tc.up, dn = keys.down || tc.down, lf = keys.left || tc.left, rt = keys.right || tc.right;
    const onRoad = isRoad(Math.floor(c.x), Math.floor(c.y)), max = m.max * (onRoad ? 1 : 0.55); c.brake = 0;
    if (up) c.v += m.acc * dt * (c.v < 0 ? 2 : 1); else if (dn) { if (c.v > 0.15) { c.v -= m.brake * dt; c.brake = 1; } else c.v -= m.acc * 0.55 * dt; } else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.4 * dt);
    if (!onRoad) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.6 * dt);
    c.v = clamp(c.v, -max * 0.3, max);
    c.a += ((rt ? 1 : 0) - (lf ? 1 : 0)) * (2.5 / (1 + 0.1 * Math.abs(c.v))) * dt * clamp(c.v / 1.8, -1, 1);
    const nx = c.x + Math.cos(c.a) * c.v * dt, ny = c.y + Math.sin(c.a) * c.v * dt;
    if (carBlocked({ x: nx, y: ny, a: c.a }, m.L)) c.v = -c.v * 0.25; else { c.x = nx; c.y = ny; }
    audioUpdate(Math.abs(c.v) / m.max, up ? 1 : 0);
  }
  function findSpawn() {
    const gs = []; for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    for (let i = gs.length - 1; i >= 0; i--) { const b = gs[i]; for (let x = b.x; x < b.x + 2; x++) { if (!solid(x, b.y + 2)) return { x: x + 0.5, y: b.y + 2.5, a: Math.PI / 2 }; } }
    let best = null, bd = 1e9; for (const i of roadList) { const x = i % MAP, y = (i / MAP) | 0, d = Math.hypot(x - 24, y - 24); if (d < bd) { bd = d; best = [x, y]; } }
    return best ? { x: best[0] + 0.5, y: best[1] + 0.5, a: 0 } : { x: 24.5, y: 24.5, a: 0 };
  }
  function startDrive(i) {
    const sp = findSpawn(); S.drive = { idx: i, x: sp.x, y: sp.y, a: sp.a, v: 0, brake: 0 }; S.mode = 'drive'; pending = null; hideConfirm();
    document.body.classList.add('driving'); closePanels(); $('carname').textContent = CARS[S.cars[i].m].name; cam.x = sp.x; cam.y = sp.y; audioStart();
  }
  function stopDrive() { S.drive = null; S.mode = 'build'; document.body.classList.remove('driving'); keys.up = keys.down = keys.left = keys.right = 0; tc.up = tc.down = tc.left = tc.right = 0; audioUpdate(0, 0); }
  function parkedCars() {
    const out = [], gs = []; for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    const owned = S.cars.map((c, i) => ({ c, i })).filter(o => !S.drive || o.i !== S.drive.idx); let k = 0;
    for (const b of gs) for (let s = 0; s < 2 && k < owned.length; s++, k++) out.push({ x: b.x + 0.5 + s, y: b.y + 1.5, a: Math.PI / 2, m: owned[k].c.m, color: owned[k].c.color, brake: 0 });
    return out;
  }

  // ---------- camera ----------
  const camIso = () => [PXf(cam.x, cam.y), PYf(cam.x, cam.y, 0)];
  function screenToWorld(px, py) { const [cx, cy] = camIso(), ix = (px - W / 2) / cam.zoom + cx, iy = (py - H / 2) / cam.zoom + cy; return [(ix / 32 + iy / 16) / 2, (iy / 16 - ix / 32) / 2]; }
  function panByScreen(dx, dy) { const ix = -dx / cam.zoom, iy = -dy / cam.zoom; cam.x = clamp(cam.x + (ix / 32 + iy / 16) / 2, 0, MAP); cam.y = clamp(cam.y + (iy / 16 - ix / 32) / 2, 0, MAP); }
  const tileAt = (px, py) => { const [x, y] = screenToWorld(px, py); return { x: Math.floor(x), y: Math.floor(y) }; };
  const anchorFor = (type, t) => { const d = DEFS[type]; return { x: t.x - Math.floor(d.w / 2), y: t.y - Math.floor(d.d / 2) }; };

  // ---------- drawing ----------
  const quadW = (pts, col) => { G.path(pts.map(p => P(p[0], p[1], 0.012))); ctx.fillStyle = col; ctx.fill(); };
  const rcnt = (x, y) => (isRoad(x, y - 1) ? 1 : 0) + (isRoad(x + 1, y) ? 1 : 0) + (isRoad(x, y + 1) ? 1 : 0) + (isRoad(x - 1, y) ? 1 : 0);
  function drawRoadTile(x, y) {
    const nN = isRoad(x, y - 1), nE = isRoad(x + 1, y), nS = isRoad(x, y + 1), nW = isRoad(x - 1, y);
    quadW([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], hash2(x, y) < 0.5 ? '#3a3e45' : '#3e4249');
    const s = 0.15, sw = '#bdb9ae', cb = '#8f8b82';
    if (!nN) { quadW([[x, y], [x + 1, y], [x + 1, y + s], [x, y + s]], sw); quadW([[x, y + s], [x + 1, y + s], [x + 1, y + s + 0.02], [x, y + s + 0.02]], cb); }
    if (!nE) { quadW([[x + 1, y], [x + 1, y + 1], [x + 1 - s, y + 1], [x + 1 - s, y]], sw); quadW([[x + 1 - s, y], [x + 1 - s, y + 1], [x + 1 - s - 0.02, y + 1], [x + 1 - s - 0.02, y]], cb); }
    if (!nS) { quadW([[x, y + 1], [x + 1, y + 1], [x + 1, y + 1 - s], [x, y + 1 - s]], sw); quadW([[x, y + 1 - s], [x + 1, y + 1 - s], [x + 1, y + 1 - s - 0.02], [x, y + 1 - s - 0.02]], cb); }
    if (!nW) { quadW([[x, y], [x, y + 1], [x + s, y + 1], [x + s, y]], sw); quadW([[x + s, y], [x + s, y + 1], [x + s + 0.02, y + 1], [x + s + 0.02, y]], cb); }
    const n = rcnt(x, y), dc = '#e8e2c8', w = 0.022;
    if (n >= 1 && n <= 2) {
      if (nE) quadW([[x + 0.62, y + 0.5 - w], [x + 0.9, y + 0.5 - w], [x + 0.9, y + 0.5 + w], [x + 0.62, y + 0.5 + w]], dc); if (nW) quadW([[x + 0.1, y + 0.5 - w], [x + 0.38, y + 0.5 - w], [x + 0.38, y + 0.5 + w], [x + 0.1, y + 0.5 + w]], dc);
      if (nN) quadW([[x + 0.5 - w, y + 0.1], [x + 0.5 + w, y + 0.1], [x + 0.5 + w, y + 0.38], [x + 0.5 - w, y + 0.38]], dc); if (nS) quadW([[x + 0.5 - w, y + 0.62], [x + 0.5 + w, y + 0.62], [x + 0.5 + w, y + 0.9], [x + 0.5 - w, y + 0.9]], dc);
    }
    if (n === 2 && ((nE && nW) || (nN && nS))) { // zebra crossing next to intersections
      const z = '#e9e6da';
      if (nE && nW) { if (rcnt(x + 1, y) >= 3) for (let k = 0; k < 6; k++) quadW([[x + 0.76, y + 0.2 + k * 0.1], [x + 0.94, y + 0.2 + k * 0.1], [x + 0.94, y + 0.25 + k * 0.1], [x + 0.76, y + 0.25 + k * 0.1]], z); if (rcnt(x - 1, y) >= 3) for (let k = 0; k < 6; k++) quadW([[x + 0.06, y + 0.2 + k * 0.1], [x + 0.24, y + 0.2 + k * 0.1], [x + 0.24, y + 0.25 + k * 0.1], [x + 0.06, y + 0.25 + k * 0.1]], z); }
      else { if (rcnt(x, y + 1) >= 3) for (let k = 0; k < 6; k++) quadW([[x + 0.2 + k * 0.1, y + 0.76], [x + 0.25 + k * 0.1, y + 0.76], [x + 0.25 + k * 0.1, y + 0.94], [x + 0.2 + k * 0.1, y + 0.94]], z); if (rcnt(x, y - 1) >= 3) for (let k = 0; k < 6; k++) quadW([[x + 0.2 + k * 0.1, y + 0.06], [x + 0.25 + k * 0.1, y + 0.06], [x + 0.25 + k * 0.1, y + 0.24], [x + 0.2 + k * 0.1, y + 0.24]], z); }
    }
  }
  function lampDraw(l) {
    ctx.beginPath(); const a = P(l.x, l.y, 0), b = P(l.x, l.y, 0.58); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = '#444b52'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(b[0], b[1], 1.8, 0, 7); ctx.fillStyle = nightness > 0.25 ? '#ffe9a8' : '#d9dde1'; ctx.fill();
    if (nightness > 0.25) E.glows.push({ x: l.x, y: l.y, z: 0.55, r: 55, c: '255,214,130', a: 0.3 * nightness });
  }
  function emitters(b) {
    if (b.type === 'coal') return [[b.x + 2.6, b.y + 2.1, 2.3, '70,70,70'], [b.x + 2.3, b.y + 2.5, 2.0, '70,70,70'], [b.x + 2.0, b.y + 1.0, 1.7, '235,235,235'], [b.x + 1.0, b.y + 0.9, 1.7, '235,235,235']];
    if (b.type === 'zi' && b.lvl === 2) return [[b.x + 0.6, b.y + 0.38, 1.45, '95,95,95']];
    if (b.type === 'zi' && b.lvl === 3) return [[b.x + 0.2, b.y + 0.32, 1.75, '95,95,95'], [b.x + 0.42, b.y + 0.3, 1.55, '95,95,95']];
    return null;
  }
  function drawSmoke(x, y, z, col, seed) {
    for (let i = 0; i < 5; i++) {
      const age = (now * 0.3 + i / 5 + seed) % 1, p = P(x + age * 0.35, y - age * 0.2, z + age * 1.1);
      ctx.beginPath(); ctx.arc(p[0], p[1], 3 + age * 9, 0, 7); ctx.fillStyle = 'rgba(' + col + ',' + ((1 - age) * 0.38).toFixed(3) + ')'; ctx.fill();
    }
  }
  function ring(cx, cy, r, fill, stroke) {
    ctx.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, p = P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.03); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  }
  function bldSprite(b) { const d = dOf(b); return G.sprite(d.kind, b.lvl || 1, d.kind === 'tree' ? ((hash2(b.x * 5, b.y * 3) * 6) | 0) : (b.v || 0)); }

  function draw() {
    E.g = ctx; E.lit = null; E.glows = []; E.now = now; E.night = nightness;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const sea = ctx.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#46a0c2'); sea.addColorStop(1, '#1d6388'); ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    const z = cam.zoom, [cix, ciy] = camIso();
    const T = () => ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cix * z), DPR * (H / 2 - ciy * z));
    T(); ctx.imageSmoothingEnabled = true;
    { const vx = cix - W / 2 / z, vy = ciy - H / 2 / z, vw = W / z, vh = H / z, cw = TER.canvas.width, ch = TER.canvas.height;
      const sx = clamp(vx + MAP * 32, 0, cw), sy = clamp(vy, 0, ch), ex = clamp(vx + vw + MAP * 32, 0, cw), ey = clamp(vy + vh, 0, ch);
      if (ex > sx && ey > sy) ctx.drawImage(TER.canvas, sx, sy, ex - sx, ey - sy, sx - MAP * 32, sy, ex - sx, ey - sy); }
    const cs = [screenToWorld(0, 0), screenToWorld(W, 0), screenToWorld(0, H), screenToWorld(W, H)];
    const minX = clamp(Math.floor(Math.min(...cs.map(c => c[0]))) - 1, 0, MAP - 1), maxX = clamp(Math.ceil(Math.max(...cs.map(c => c[0]))) + 1, 0, MAP - 1);
    const minY = clamp(Math.floor(Math.min(...cs.map(c => c[1]))) - 1, 0, MAP - 1), maxY = clamp(Math.ceil(Math.max(...cs.map(c => c[1]))) + 1, 0, MAP - 1);
    const zt = S.mode === 'build' && S.tool === 'zone';
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = idx(x, y);
      if (S.road[i]) drawRoadTile(x, y);
      else if (S.water[i]) { const ph = hash2(x, y) * 6; ctx.beginPath(); for (let k = 0; k < 2; k++) { const px = x + 0.25 + k * 0.4, py = y + 0.3 + k * 0.35, p = P(px, py, 0), o = Math.sin(now * 1.4 + ph + k * 2) * 3; ctx.moveTo(p[0] - 6 + o, p[1]); ctx.lineTo(p[0] + 6 + o, p[1]); } ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke(); }
      if (S.zone[i] && !S.occ[i] && !S.road[i]) { const zc = ZONES[S.zone[i] - 1]; G.path([P(x, y, 0.02), P(x + 1, y, 0.02), P(x + 1, y + 1, 0.02), P(x, y + 1, 0.02)]); ctx.fillStyle = zc.col; ctx.globalAlpha = zt ? 0.5 : 0.3; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = zt ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'; ctx.lineWidth = 0.7; ctx.stroke(); }
    }
    const grid = S.mode === 'build' && (S.tool === 'build' || S.tool === 'road' || S.tool === 'bull' || S.tool === 'zone');
    if (grid) { ctx.beginPath(); for (let i = minX; i <= maxX + 1; i++) { ctx.moveTo(PXf(i, minY), PYf(i, minY, 0.02)); ctx.lineTo(PXf(i, maxY + 1), PYf(i, maxY + 1, 0.02)); } for (let j = minY; j <= maxY + 1; j++) { ctx.moveTo(PXf(minX, j), PYf(minX, j, 0.02)); ctx.lineTo(PXf(maxX + 1, j), PYf(maxX + 1, j, 0.02)); } ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 0.8; ctx.stroke(); }
    // cloud shadows
    for (let c = 0; c < 5; c++) { const cx = ((now * 0.5 + c * 19) % 90) - 20, cy = (c * 13.7 + now * 0.2) % 60 - 6, p = P(cx, cy, 0), r = 150 + c * 25, gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); gr.addColorStop(0, 'rgba(10,20,30,.13)'); gr.addColorStop(1, 'rgba(10,20,30,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
    // entities
    const vx0 = cix - W / 2 / z, vx1 = cix + W / 2 / z, vy0 = ciy - H / 2 / z, vy1 = ciy + H / 2 / z;
    const ents = [], smokes = [];
    for (const b of S.blds.values()) {
      const s = bldSprite(b), d = dOf(b), sx = PXf(b.x, b.y) - s.ox, sy = PYf(b.x, b.y, 0) - s.oy;
      if (sx > vx1 || sx + s.w < vx0 || sy > vy1 || sy + s.h < vy0) continue;
      ents.push({ k: b.x + b.y + (d.w + d.d) / 2, t: 0, o: b, s });
      const em = emitters(b); if (em) for (const e of em) smokes.push([e[0], e[1], e[2], e[3], b.id * 0.37]);
    }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const v = S.scen.get(idx(x, y)); if (v !== undefined && !S.occ[idx(x, y)]) ents.push({ k: x + y + 1, t: 3, x, y, s: G.sprite('scen', 1, v) }); }
    for (const l of lamps) { const lx = PXf(l.x, l.y), ly = PYf(l.x, l.y, 0); if (lx > vx0 && lx < vx1 && ly > vy0 && ly < vy1 + 40) ents.push({ k: l.x + l.y, t: 1, o: l }); }
    for (const n of npcs) { const ca = Math.cos(n.a), sa = Math.sin(n.a), o = { x: n.x - sa * 0.17, y: n.y + ca * 0.17, a: n.a, m: n.m, color: n.color, brake: 0 }; ents.push({ k: o.x + o.y, t: 2, o }); }
    for (const p of people) { const nx = -p.dy, ny = p.dx; ents.push({ k: p.x + nx * p.lat + p.y + ny * p.lat, t: 4, o: { x: p.x + nx * p.lat, y: p.y + ny * p.lat, ph: p.ph, col: p.col, skin: p.skin } }); }
    for (const p of parkedCars()) ents.push({ k: p.x + p.y + 0.2, t: 2, o: p });
    if (S.drive) { const c = S.drive; ents.push({ k: c.x + c.y, t: 2, o: { x: c.x, y: c.y, a: c.a, m: S.cars[c.idx].m, color: S.cars[c.idx].color, brake: c.brake } }); }
    ents.sort((a, b) => a.k - b.k);
    const night = nightness > 0.25;
    for (const e of ents) {
      if (e.t === 0) { G.blit(e.s, e.o.x, e.o.y); if (night) G.litWindows(e.s, e.o.x, e.o.y); const d = dOf(e.o); if (d.beacon) E.glows.push({ x: e.o.x + d.beacon[0], y: e.o.y + d.beacon[1], z: d.beacon[2], r: 22, c: '255,50,50', a: 0.5 + 0.5 * Math.sin(now * 3) }); if (e.o.s && e.o.s.cons && !e.o.op && S.mode === 'build') { const p = P(e.o.x + d.w / 2, e.o.y + d.d / 2, 1.6); ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.o.road ? '⚡' : '🛣️', p[0], p[1]); } }
      else if (e.t === 3) G.blit(e.s, e.x, e.y);
      else if (e.t === 1) lampDraw(e.o);
      else if (e.t === 4) G.drawPerson(e.o);
      else G.drawCar(e.o, CARS[e.o.m], false);
    }
    for (const s of smokes) drawSmoke(s[0], s[1], s[2], s[3], s[4]);
    // ghost / overlays
    if (S.mode === 'build' && S.tool === 'build' && S.toolType) {
      const t = pending || hoverT;
      if (t) {
        const d = DEFS[S.toolType], a = anchorFor(S.toolType, t), ok = canPlace(S.toolType, a.x, a.y);
        if (d.r) ring(a.x + d.w / 2, a.y + d.d / 2, d.r, 'rgba(90,170,255,.12)', 'rgba(120,190,255,.7)'); if (d.poll) ring(a.x + d.w / 2, a.y + d.d / 2, d.poll, 'rgba(160,120,60,.1)', 'rgba(200,150,70,.6)');
        G.path([P(a.x, a.y, 0.03), P(a.x + d.w, a.y, 0.03), P(a.x + d.w, a.y + d.d, 0.03), P(a.x, a.y + d.d, 0.03)]); ctx.fillStyle = ok ? 'rgba(80,230,130,.4)' : 'rgba(240,70,70,.5)'; ctx.fill();
        if (ok) G.blit(G.sprite(d.kind, 1, d.kind === 'tree' ? 0 : 0), a.x, a.y, 0.65);
      }
    } else if (S.mode === 'build' && S.tool === 'zone' && zStart && zEnd) {
      const x0 = Math.min(zStart.x, zEnd.x), x1 = Math.max(zStart.x, zEnd.x) + 1, y0 = Math.min(zStart.y, zEnd.y), y1 = Math.max(zStart.y, zEnd.y) + 1;
      G.path([P(x0, y0, 0.03), P(x1, y0, 0.03), P(x1, y1, 0.03), P(x0, y1, 0.03)]); ctx.fillStyle = S.zoneType ? ZONES[S.zoneType - 1].col : '#f87171'; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (S.mode === 'build' && (S.tool === 'road' || S.tool === 'bull') && hoverT && inb(hoverT.x, hoverT.y)) {
      const t = hoverT; G.path([P(t.x, t.y, 0.03), P(t.x + 1, t.y, 0.03), P(t.x + 1, t.y + 1, 0.03), P(t.x, t.y + 1, 0.03)]); ctx.fillStyle = S.tool === 'road' ? 'rgba(255,255,255,.35)' : 'rgba(240,70,70,.5)'; ctx.fill();
    }
    // day/night + vignette
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mulCol !== 'rgb(255,255,255)') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mulCol; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    T();
    if (night) { const lit = ctx; }
    if (E.glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const gl of E.glows) { const x = PXf(gl.x, gl.y), y = PYf(gl.x, gl.y, gl.z), rg = ctx.createRadialGradient(x, y, 0, x, y, gl.r); rg.addColorStop(0, 'rgba(' + gl.c + ',' + clamp(gl.a, 0, 1) + ')'); rg.addColorStop(1, 'rgba(' + gl.c + ',0)'); ctx.fillStyle = rg; ctx.fillRect(x - gl.r, y - gl.r, gl.r * 2, gl.r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,15,30,.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- update ----------
  let growAcc = 0, hudAcc = 0, recAcc = 0, lastIssue = '', lastIssueT = -99;
  function rankIndex() { let r = 0; for (let i = 0; i < RANKS.length; i++) if (ST.pop >= RANKS[i].p) r = i; return r; }
  function update(dt) {
    const sd = S.mode === 'drive' ? dt : dt * S.speed;
    S.t = (S.t + sd * 24 / DAY_SEC) % 24; updateLighting();
    if (sd > 0) {
      const m0 = Math.floor(S.month); S.month += sd / MONTH_SEC; S.money += ST.net / MONTH_SEC * sd; ST.appr += (ST.apprT - ST.appr) * Math.min(1, sd * 0.4);
      if (Math.floor(S.month) !== m0) { markDirty(); const r = rankIndex(); if (r > S.rank) { S.rank = r; S.money += r * 15000; toast('🎉 ' + S.name + ' is now a ' + RANKS[r].n + '! Government grant: ' + fmt(r * 15000)); } if (S.money < 0 && ST.pop > 0) toast('⚠️ You are in debt. Raise taxes or cut spending.'); }
      growAcc += sd; if (growAcc > 0.8) { growAcc = 0; growStep(); }
      recAcc += sd; if (recAcc > 2) { recAcc = 0; recalc(); const is = ST.issues[0]; if (is && is !== lastIssue && now - lastIssueT > 25 && S.mode === 'build') { lastIssue = is; lastIssueT = now; info('<b>Advisor</b> ' + is, 6000); } }
    }
    updateNpcs(dt * Math.max(1, S.speed)); updatePeople(dt * Math.max(1, S.speed));
    if (S.mode === 'drive' && S.drive) { updateDrive(dt); cam.x += (S.drive.x - cam.x) * Math.min(1, dt * 5); cam.y += (S.drive.y - cam.y) * Math.min(1, dt * 5); cam.zoom += (1.25 - cam.zoom) * Math.min(1, dt * 2); }
    else { const sp = 11 / cam.zoom * dt; if (keys.up) { cam.x -= sp; cam.y -= sp; } if (keys.down) { cam.x += sp; cam.y += sp; } if (keys.left) { cam.x -= sp; cam.y += sp; } if (keys.right) { cam.x += sp; cam.y -= sp; } cam.x = clamp(cam.x, 0, MAP); cam.y = clamp(cam.y, 0, MAP); }
    hudAcc += dt;
    if (hudAcc > 0.15) {
      hudAcc = 0; const mo = Math.floor(S.month);
      $('money').textContent = fmt(S.money); $('net').textContent = (ST.net >= 0 ? '+' : '') + fmt(ST.net) + '/mo'; $('net').style.color = ST.net >= 0 ? '#86efac' : '#fca5a5';
      $('pop').textContent = ST.pop.toLocaleString('en-US'); $('cname').textContent = S.name; $('cdate').textContent = MONTHS[mo % 12] + ' ' + (2031 + Math.floor(mo / 12)) + ' · ' + RANKS[rankIndex()].n + (nightness > 0.5 ? ' 🌙' : ' ☀️');
      const ap = Math.round(ST.appr); $('appr').textContent = (ap >= 70 ? '😀 ' : ap >= 45 ? '😐 ' : '😠 ') + ap + '%';
      ['r', 'c', 'i'].forEach((k, j) => { const e = $('d' + k), v = ST.dem[j]; e.style.height = Math.max(6, (v + 1) / 2 * 100) + '%'; e.style.opacity = v < 0 ? 0.5 : 1; });
      $('btnSpeed').textContent = S.speed === 0 ? '⏸' : '▶'.repeat(S.speed);
      if (S.drive) $('speed').textContent = Math.round(Math.abs(S.drive.v) * 26);
    }
    if (now - lastSave > 10) { save(); lastSave = now; }
  }

  // ---------- UI ----------
  const BAR = [['move', '🔍', 'Look'], ['road', '🛣️', 'Roads'], ['zone', '🟩', 'Zones'], ['utils', '⚡', 'Utilities'], ['serv', '🚓', 'Services'], ['homes', '🏠', 'Homes'], ['extras', '🌳', 'Extras'], ['bull', '🧹', 'Demolish'], ['hall', '📊', 'City Hall'], ['cars', '🚗', 'Cars']];
  function buildBar() {
    const bar = $('bar'); bar.innerHTML = '';
    for (const [id, ic, label] of BAR) { const bt = document.createElement('button'); bt.className = 'tb'; bt.dataset.id = id; bt.innerHTML = '<span>' + ic + '</span><small>' + label + '</small>'; bt.onclick = () => setTool(id); bar.appendChild(bt); }
  }
  function refreshBar() { for (const b of $('bar').children) b.classList.toggle('on', b.dataset.id === S.cat); }
  function buildTray(cat) {
    const tray = $('tray'); tray.innerHTML = '';
    const add = (key, icon, name, sub, on, click) => { const bt = document.createElement('button'); bt.className = 'item' + (on ? ' on' : ''); bt.innerHTML = '<span class="ic">' + icon + '</span><b>' + name + '</b><small>' + sub + '</small>'; bt.onclick = click; tray.appendChild(bt); };
    if (cat === 'zone') for (const z of ZONES) add(z.id, z.icon, z.name, z.id ? z.sub + ' · $10/tile' : z.sub, S.zoneType === z.id, () => { S.zoneType = z.id; S.tool = 'zone'; buildTray(cat); });
    else for (const k in DEFS) { const d = DEFS[k]; if (d.cat !== cat) continue; add(k, d.icon, d.name, fmt(d.cost) + (d.sub ? ' · ' + d.sub : d.inc ? ' · +' + fmt(d.inc) + '/mo' : d.upkeep ? ' · ' + fmt(d.upkeep) + '/mo' : ''), S.toolType === k, () => { S.toolType = k; S.tool = 'build'; pending = null; hideConfirm(); buildTray(cat); }); }
    tray.hidden = false;
  }
  function setTool(id) {
    pending = null; hideConfirm(); zStart = zEnd = null; $('tray').hidden = true;
    if (id === 'cars') { openCars(); return; } if (id === 'hall') { openHall(); return; }
    closePanels(); S.cat = id;
    if (id === 'zone') { S.tool = 'zone'; buildTray('zone'); }
    else if (['utils', 'serv', 'homes', 'extras'].includes(id)) { S.tool = 'build'; if (!S.toolType || DEFS[S.toolType].cat !== id) S.toolType = Object.keys(DEFS).find(k => DEFS[k].cat === id); buildTray(id); }
    else S.tool = id;
    refreshBar();
  }
  function showConfirm() { const d = DEFS[S.toolType]; $('conftxt').textContent = d.name + ' · ' + fmt(d.cost); $('confirm').hidden = false; }
  function hideConfirm() { $('confirm').hidden = true; }
  function closePanels() { $('panel').hidden = true; $('hall').hidden = true; carOpen = false; previews = []; }

  // cars sheet
  let carOpen = false, carTab = 'mine', previews = [];
  function openCars() { closePanels(); carOpen = true; $('panel').hidden = false; renderCars(); }
  function renderCars() {
    previews = []; const box = $('plist'); box.innerHTML = '';
    $('tabMine').classList.toggle('on', carTab === 'mine'); $('tabShop').classList.toggle('on', carTab === 'shop'); $('pcash').textContent = fmt(S.money);
    const card = (k, color, infoHtml, btn) => { const c = document.createElement('div'); c.className = 'card'; const p = document.createElement('canvas'); p.className = 'pv'; c.appendChild(p); previews.push({ cv: p, m: k, car: { color } }); const i = document.createElement('div'); i.className = 'info'; i.innerHTML = infoHtml; if (btn) i.appendChild(btn); c.appendChild(i); box.appendChild(c); return i; };
    if (carTab === 'mine') S.cars.forEach((c, i) => {
      const m = CARS[c.m], inf = card(c.m, c.color, '<b>' + m.name + '</b><small>' + m.tag + ' · top ' + Math.round(m.max * 26) + ' km/h</small>');
      const sw = document.createElement('div'); sw.className = 'sw'; m.colors.forEach(col => { const s = document.createElement('button'); s.className = 'swb' + (c.color === col ? ' on' : ''); s.style.background = col; s.onclick = () => { c.color = col; markDirty(); renderCars(); }; sw.appendChild(s); }); inf.appendChild(sw);
      const dr = document.createElement('button'); dr.className = 'go'; dr.textContent = '🏁 Drive'; dr.onclick = () => startDrive(i); inf.appendChild(dr);
    });
    else for (const k in CARS) {
      const m = CARS[k]; if (!m.price) continue; const own = S.cars.some(c => c.m === k), bt = document.createElement('button'); bt.className = 'go' + (own ? ' dis' : ''); bt.textContent = own ? '✔ Owned' : 'Buy';
      if (!own) bt.onclick = () => { if (S.money < m.price) { toast('Not enough cash. Grow your city!'); return; } S.money -= m.price; S.cars.push({ m: k, color: m.colors[0] }); markDirty(); save(); toast('You bought the ' + m.name + '!'); renderCars(); };
      card(k, m.colors[0], '<b>' + m.name + '</b><small>' + m.tag + ' · top ' + Math.round(m.max * 26) + ' km/h</small><small class="price">' + fmt(m.price) + '</small>', bt);
    }
    for (const p of previews) { p.cv.width = 180 * DPR; p.cv.height = 110 * DPR; }
  }
  function drawPreviews(t) {
    for (const p of previews) {
      const c = p.cv, x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0);
      const bg = x.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, '#2a3a52'); bg.addColorStop(1, '#141c2b'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
      E.g = x; E.glows = null; x.setTransform(3.1 * DPR, 0, 0, 3.1 * DPR, c.width / 2, c.height * 0.64);
      G.ell(0, 0, 0, 0.8, 'rgba(255,255,255,.07)'); G.drawCar({ x: 0, y: 0, a: t * 0.5 + 0.35, m: p.m, color: p.car.color, brake: 0 }, CARS[p.m], true); E.g = ctx;
    }
  }

  // city hall
  function openHall() { closePanels(); $('hall').hidden = false; renderHall(); }
  function tbl(rows) { return '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="r' + (r[2] ? ' ' + r[2] : '') + '">' + r[1] + '</td></tr>').join('') + '</table>'; }
  function renderBudget() {
    const i = ST.inc, e = ST.exp;
    $('budT').innerHTML = '<h4>Monthly income</h4>' + tbl([['🏠 Residential tax', fmt(i.r)], ['🏬 Commercial tax', fmt(i.c)], ['🏭 Industrial tax', fmt(i.i)], ['🏰 Luxury rent', fmt(i.l)], ['<b>Total</b>', '<b>' + fmt(ST.incT) + '</b>']]) +
      '<h4>Monthly expenses</h4>' + tbl([['🚓 Police', fmt(e.police)], ['🚒 Fire', fmt(e.fire)], ['🏥 Health', fmt(e.health)], ['🏫 Education', fmt(e.edu)], ['⚡ Power', fmt(e.power)], ['💧 Water', fmt(e.water)], ['🌳 Parks', fmt(e.park)], ['🛣️ Roads', fmt(e.road)], ['<b>Total</b>', '<b>' + fmt(ST.expT) + '</b>']]) +
      tbl([['<b>Net per month</b>', '<b>' + (ST.net >= 0 ? '+' : '') + fmt(ST.net) + '</b>', ST.net >= 0 ? 'good' : 'bad']]);
  }
  function renderHall() {
    const pc = v => Math.round(v * 100) + '%';
    $('hallB').innerHTML = '<div class="sec"><label>City name</label><input id="nameIn" maxlength="22" value="' + S.name.replace(/"/g, '') + '"></div>' +
      '<div class="sec"><label>Tax rate: <b id="taxV">' + S.tax + '%</b></label><input id="taxR" type="range" min="0" max="20" step="1" value="' + S.tax + '"><small>Low taxes make people happy and attract growth. High taxes fill the treasury.</small></div>' +
      '<div id="budT"></div>' +
      '<h4>Citizens</h4>' + tbl([['Population', ST.pop.toLocaleString('en-US')], ['Jobs', Math.round(ST.jobs).toLocaleString('en-US')], ['Approval', Math.round(ST.appr) + '%'], ['Power supplied', pc(ST.rP) + ' (' + ST.supP + ' / ' + ST.demP + ')'], ['Water supplied', pc(ST.rW) + ' (' + ST.supW + ' / ' + ST.demW + ')'], ['Police coverage', pc(ST.cov.police)], ['Fire coverage', pc(ST.cov.fire)], ['Healthcare coverage', pc(ST.cov.health)], ['Education coverage', pc(ST.cov.edu)], ['Park coverage', pc(ST.cov.park)], ['Pollution exposure', pc(ST.cov.poll)]]) +
      '<h4>Advisor</h4>' + (ST.issues.length ? ST.issues.map(s => '<p class="tip">' + s + '</p>').join('') : '<p class="tip">✅ Everything looks good, Mayor. Keep growing!</p>');
    renderBudget();
    $('taxR').oninput = e => { S.tax = +e.target.value; $('taxV').textContent = S.tax + '%'; recalc(); renderBudget(); markDirty(); };
    $('nameIn').onchange = e => { S.name = (e.target.value || 'New Haven').trim().slice(0, 22) || 'New Haven'; markDirty(); };
  }

  // inspect
  function inspect(t) {
    if (!inb(t.x, t.y)) return; const i = idx(t.x, t.y), o = S.occ[i];
    if (o) {
      const b = S.blds.get(o), d = dOf(b), s = b.s || bstats(b); let h = '<b>' + d.icon + ' ' + d.name + (b.type[0] === 'z' ? ' · Level ' + b.lvl : '') + '</b>';
      if (s.pop) h += '<br>👥 ' + (b.popNow || 0) + ' residents'; if (s.jobs) h += '<br>💼 ' + Math.round(b.jobsNow || 0) + ' jobs';
      if (s.cons) h += '<br>' + (b.road ? '🛣️✓' : '🛣️✗') + ' ' + (b.pw ? '⚡✓' : '⚡✗') + ' ' + (b.wt ? '💧✓' : '💧✗') + ' · land value ' + Math.round(b.lv || 0);
      if (s.lux) h += '<br>💰 +' + fmt(s.lux * (b.eff || 1)) + '/mo'; if (d.supply) h += '<br>' + (d.supply === 'power' ? '⚡' : '💧') + ' capacity ' + d.cap; if (d.upkeep) h += '<br>Upkeep ' + fmt(d.upkeep) + '/mo';
      info(h);
    } else if (S.zone[i]) info('<b>' + ZONES[S.zone[i] - 1].icon + ' ' + ZONES[S.zone[i] - 1].name + ' zone</b><br>Waiting for demand, road, power & water.');
    else if (S.road[i]) info('<b>🛣️ Road</b><br>' + (pwF[i] ? '⚡ powered ' : '⚡ no power ') + (wtF[i] ? '💧 water' : '💧 no water'), 3000);
    else if (S.water[i]) info('<b>🌊 Water</b>', 2000);
  }

  // ---------- input ----------
  const ptrs = new Map(); let painting = false, lastTile = null, pinch = null, dragMoved = false, rightPan = false;
  function applyPaint(t) { if (!t) return; const f = S.tool === 'road' ? paintRoad : bulldoze; if (lastTile) lineTiles(lastTile.x, lastTile.y, t.x, t.y, f); else f(t.x, t.y); lastTile = t; }
  cv.addEventListener('pointerdown', e => {
    if (S.mode === 'drive') return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; painting = false; zStart = zEnd = null; return; }
    dragMoved = false; rightPan = e.button === 2; const t = tileAt(e.clientX, e.clientY); hoverT = t; if (rightPan) return;
    if (S.tool === 'road' || S.tool === 'bull') { painting = true; lastTile = null; applyPaint(t); }
    else if (S.tool === 'zone') { zStart = t; zEnd = t; }
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) { hoverT = tileAt(e.clientX, e.clientY); return; }
    if (pinch && ptrs.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; cam.zoom = clamp(pinch.z * d / (pinch.d || 1), 0.45, 2.4); panByScreen(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; hoverT = tileAt(e.clientX, e.clientY);
    if (rightPan) { panByScreen(dx, dy); return; }
    if (painting) { applyPaint(hoverT); return; } if (zStart) { zEnd = hoverT; return; }
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) dragMoved = true; if (dragMoved) panByScreen(dx, dy);
  });
  function endPtr(e) {
    const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; dragMoved = true; return; }
    if (rightPan) { rightPan = false; return; }
    if (painting) { painting = false; lastTile = null; return; }
    if (zStart) { if (e.type !== 'pointercancel') zoneRect(zStart, zEnd || zStart); zStart = zEnd = null; return; }
    if (e.type === 'pointercancel' || dragMoved) return;
    const t = tileAt(e.clientX, e.clientY);
    if (S.tool === 'build' && S.toolType) { const a = anchorFor(S.toolType, t); if (e.pointerType === 'mouse') placeBuilding(S.toolType, a.x, a.y); else { pending = t; if (canPlace(S.toolType, a.x, a.y)) showConfirm(); else { hideConfirm(); toast('Not enough space there'); } } }
    else if (S.tool === 'move') inspect(t);
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hoverT = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (S.mode !== 'drive') cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.45, 2.4); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const KMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'down' };
  addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; const k = KMAP[e.key]; if (k) { keys[k] = 1; if (S.mode === 'drive' || e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); } if (e.key === 'Escape') { if (S.mode === 'drive') stopDrive(); else { closePanels(); pending = null; hideConfirm(); } } });
  addEventListener('keyup', e => { const k = KMAP[e.key]; if (k) keys[k] = 0; });
  addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = 0; });
  function holdBtn(id, k) { const el = $(id), on = e => { e.preventDefault(); tc[k] = 1; el.classList.add('down'); }, off = e => { e.preventDefault(); tc[k] = 0; el.classList.remove('down'); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off); }
  holdBtn('bLeft', 'left'); holdBtn('bRight', 'right'); holdBtn('bGas', 'up'); holdBtn('bBrake', 'down');

  let deferredInstall = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('btnInstall').hidden = false; });
  addEventListener('appinstalled', () => { $('btnInstall').hidden = true; toast('Installed! Open it from your home screen.'); });
  $('btnInstall').onclick = () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('btnInstall').hidden = true; } else toast('Tap Share, then Add to Home Screen'); };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) $('btnInstall').hidden = false;
  $('btnSound').onclick = () => { muted = !muted; $('btnSound').textContent = muted ? '🔇' : '🔊'; if (!muted && S.mode === 'drive') audioStart(); audioUpdate(0, 0); };
  $('btnReset').onclick = () => { if (confirm('Start a brand new city? Your current city will be erased.')) { if (S.drive) stopDrive(); newCity(); save(); toast('New city started'); } };
  $('btnSpeed').onclick = () => { S.speed = S.speed === 0 ? 1 : S.speed === 3 ? 0 : S.speed + 1; toast(S.speed === 0 ? 'Paused' : 'Speed ' + S.speed + 'x'); };
  $('cityBtn').onclick = openHall;
  $('btnPark').onclick = stopDrive; $('tabMine').onclick = () => { carTab = 'mine'; renderCars(); }; $('tabShop').onclick = () => { carTab = 'shop'; renderCars(); };
  $('pclose').onclick = closePanels; $('hclose').onclick = closePanels;
  $('btnPlace').onclick = () => { if (!pending || !S.toolType) return; const a = anchorFor(S.toolType, pending); if (placeBuilding(S.toolType, a.x, a.y)) { pending = null; hideConfirm(); } };
  $('btnCancel').onclick = () => { pending = null; hideConfirm(); };
  addEventListener('visibilitychange', () => { if (document.hidden) save(); }); addEventListener('pagehide', save);

  // ---------- boot ----------
  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  addEventListener('resize', resize); resize(); buildBar();
  if (!load()) newCity();
  recalc(); ST.appr = ST.apprT; cam.zoom = W < 700 ? 0.8 : 1; setTool('move');
  let last = 0;
  function frame(ts) { requestAnimationFrame(frame); const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; now = ts / 1000; update(dt); draw(); if (carOpen) drawPreviews(now); }
  requestAnimationFrame(frame);
  window.__city = { S, ST, DEFS, CARS, placeBuilding, startDrive, stopDrive, update, draw, openCars, openHall, renderCars, recalc, newCity, keys, cam, setTool, growStep, zoneRect };
})();
