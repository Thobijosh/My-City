'use strict';
/* My City — an offline isometric city builder. All graphics are drawn in code (no image downloads). */
(function () {
  const MAP = 48, TW = 64, TH = 32, ZS = 38, DAY_SEC = 300;
  const SAVE_KEY = 'mycity-save-v1';
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d');
  let g = ctx;
  let W = 800, H = 600, DPR = 1;
  const cam = { x: 24, y: 24, zoom: 1 };
  let now = 0, nightness = 0, mulCol = 'rgb(255,255,255)';
  let lit = [], glows = [];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = n => '$' + Math.floor(n).toLocaleString('en-US');
  function hash2(a, b) {
    let h = (a | 0) * 374761393 + (b | 0) * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  }

  // ---------- colour helpers ----------
  const shCache = {};
  function shade(hex, f) {
    const k = hex + '|' + f.toFixed(2);
    let v = shCache[k]; if (v) return v;
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), gg = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    v = 'rgb(' + clamp(Math.round(r * f), 0, 255) + ',' + clamp(Math.round(gg * f), 0, 255) + ',' + clamp(Math.round(b * f), 0, 255) + ')';
    shCache[k] = v; return v;
  }

  // ---------- projection ----------
  const PXf = (x, y) => (x - y) * TW / 2;
  const PYf = (x, y, z) => (x + y) * TH / 2 - (z || 0) * ZS;
  const P = (x, y, z) => [PXf(x, y), PYf(x, y, z)];
  function path(pts) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function F(pts, col, f, grad, edge) {
    path(pts);
    if (grad) {
      let mn = 1e9, mx = -1e9;
      for (const p of pts) { if (p[1] < mn) mn = p[1]; if (p[1] > mx) mx = p[1]; }
      const gr = g.createLinearGradient(0, mn, 0, mx);
      gr.addColorStop(0, shade(col, f * 1.08)); gr.addColorStop(1, shade(col, f * 0.88));
      g.fillStyle = gr;
    } else g.fillStyle = shade(col, f);
    g.fill();
    if (edge !== false) { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.6; g.stroke(); }
  }
  function ground(x0, y0, x1, y1, col, z) {
    path([P(x0, y0, z || 0.01), P(x1, y0, z || 0.01), P(x1, y1, z || 0.01), P(x0, y1, z || 0.01)]);
    g.fillStyle = col; g.fill();
  }
  function boxAA(x0, y0, x1, y1, z0, z1, col, o) {
    o = o || {};
    F([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], o.cr || col, 0.94, o.grad);
    F([P(x1, y1, z1), P(x0, y1, z1), P(x0, y1, z0), P(x1, y1, z0)], o.cl || col, 0.64, o.grad);
    if (!o.notop) F([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], o.ct || col, 1.05);
  }
  function wins(A, B, z0, z1, cols, rows, m, f, seed, o) {
    o = o || {};
    const glass = o.glass || '#7fa9cc';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const uc = (c + 0.5) / cols;
      if (o.skip && uc > o.skip[0] && uc < o.skip[1]) continue;
      const u0 = (c + m) / cols, u1 = (c + 1 - m) / cols;
      const zb = z0 + (z1 - z0) * ((r + m) / rows), zt = z0 + (z1 - z0) * ((r + 1 - m) / rows);
      const ax = A[0] + (B[0] - A[0]) * u0, ay = A[1] + (B[1] - A[1]) * u0;
      const bx = A[0] + (B[0] - A[0]) * u1, by = A[1] + (B[1] - A[1]) * u1;
      const q = [P(ax, ay, zt), P(bx, by, zt), P(bx, by, zb), P(ax, ay, zb)];
      path(q); g.fillStyle = shade(glass, f); g.fill();
      if (o.frame) { g.strokeStyle = 'rgba(20,20,25,.45)'; g.lineWidth = 0.6; g.stroke(); }
      if (nightness > 0.25 && hash2(seed * 31 + c + (o.fs || 0), r * 17 + Math.round(A[0] * 7 + A[1])) < (o.litp || 0.45)) lit.push(q);
    }
  }
  function doorAt(A, B, u, wu, zt, col) {
    const u0 = u - wu / 2, u1 = u + wu / 2;
    const ax = A[0] + (B[0] - A[0]) * u0, ay = A[1] + (B[1] - A[1]) * u0;
    const bx = A[0] + (B[0] - A[0]) * u1, by = A[1] + (B[1] - A[1]) * u1;
    const q = [P(ax, ay, zt), P(bx, by, zt), P(bx, by, 0.01), P(ax, ay, 0.01)];
    path(q); g.fillStyle = shade(col, 0.8); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6; g.stroke();
  }
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  function shadowBox(x0, y0, x1, y1, h) {
    const s = Math.min(h, 3.2), dx = -0.6 * s, dy = 0.35 * s;
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { pts.push(P(x, y, 0.01)); pts.push(P(x + dx, y + dy, 0.01)); }
    const hp = hull(pts);
    path(hp); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill();
  }
  function ell(x, y, z, r, fill) {
    g.beginPath(); g.ellipse(PXf(x, y), PYf(x, y, z), r * 45.25, r * 22.63, 0, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
  }

  // ---------- definitions ----------
  const DEFS = {
    cottage: { name: 'Cottage', icon: '🏠', cat: 'homes', w: 1, d: 1, h: 0.85, cost: 2000, inc: 40, pop: 3, wall: '#ecdcc2', roof: '#a9472f', kind: 'gable', cols: 2 },
    family: { name: 'Family Home', icon: '🏡', cat: 'homes', w: 2, d: 2, h: 1.1, cost: 6500, inc: 150, pop: 5, wall: '#f1ede3', roof: '#586878', kind: 'gable', cols: 4, chimney: true },
    apartment: { name: 'Apartments', icon: '🏢', cat: 'homes', w: 2, d: 2, h: 3.4, cost: 40000, inc: 1300, pop: 24, wall: '#cdb9a4', kind: 'block', floors: 4 },
    villa: { name: 'Modern Villa', icon: '🏖️', cat: 'homes', w: 3, d: 3, h: 1.46, cost: 28000, inc: 700, pop: 6, kind: 'villa' },
    mansion: { name: 'Mansion', icon: '🏰', cat: 'homes', w: 4, d: 3, h: 1.82, cost: 95000, inc: 2700, pop: 8, wall: '#efe6d2', roof: '#3a3f4a', kind: 'mansion' },
    tower: { name: 'Skyscraper', icon: '🏙️', cat: 'homes', w: 3, d: 3, h: 10, cost: 260000, inc: 8200, pop: 150, kind: 'tower' },
    shop: { name: 'Shop', icon: '🏪', cat: 'city', w: 2, d: 1, h: 0.85, cost: 8000, inc: 230, pop: 0, kind: 'shop' },
    garage: { name: 'Garage', icon: '🅿️', cat: 'city', w: 2, d: 2, h: 0.62, cost: 6000, inc: 0, pop: 0, kind: 'garage' },
    tree: { name: 'Trees', icon: '🌳', cat: 'city', w: 1, d: 1, h: 1, cost: 100, inc: 0, pop: 0, kind: 'tree' },
    fountain: { name: 'Fountain', icon: '⛲', cat: 'city', w: 1, d: 1, h: 0.5, cost: 600, inc: 0, pop: 0, kind: 'fountain' }
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

  // ---------- state ----------
  const S = {
    money: 60000, t: 8, nextId: 1,
    road: new Uint8Array(MAP * MAP), occ: new Int32Array(MAP * MAP), blds: new Map(),
    cars: [{ m: 'hatch', color: '#2f6fed' }],
    mode: 'build', tool: 'move', toolType: null, cat: 'move', drive: null
  };
  let pop = 0, incPerMin = 0, roadCount = 0, roadList = [], lamps = [], npcs = [];
  let pending = null, hoverT = null;
  const idx = (x, y) => y * MAP + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP;
  const isRoad = (x, y) => inb(x, y) && S.road[idx(x, y)] === 1;
  const solid = (x, y) => !inb(x, y) || S.occ[idx(x, y)] > 0;

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- city maths ----------
  function recalc() {
    pop = 0; incPerMin = 0;
    for (const b of S.blds.values()) {
      const d = DEFS[b.type];
      if (!d.inc) continue;
      let acc = false;
      for (let y = b.y - 1; y <= b.y + d.d && !acc; y++) for (let x = b.x - 1; x <= b.x + d.w; x++) if (isRoad(x, y)) { acc = true; break; }
      let n = 0;
      for (let y = b.y - 3; y < b.y + d.d + 3; y++) for (let x = b.x - 3; x < b.x + d.w + 3; x++) {
        if (!inb(x, y)) continue;
        const o = S.occ[idx(x, y)]; if (!o) continue;
        const t = S.blds.get(o); if (t && (t.type === 'tree' || t.type === 'fountain')) n++;
      }
      b.acc = acc; b.bonus = Math.min(0.3, n * 0.05);
      b.rate = d.inc * (acc ? 1 : 0.4) * (1 + b.bonus);
      incPerMin += b.rate; if (acc) pop += d.pop;
    }
    roadCount = 0; roadList = [];
    for (let i = 0; i < S.road.length; i++) if (S.road[i]) { roadCount++; roadList.push(i); }
    lamps = [];
    for (const i of roadList) {
      const x = i % MAP, y = (i / MAP) | 0;
      if (hash2(x * 5, y * 3) > 0.16) continue;
      let px = null, py = null;
      if (!isRoad(x, y - 1)) { px = x + 0.5; py = y + 0.07; }
      else if (!isRoad(x + 1, y)) { px = x + 0.93; py = y + 0.5; }
      else if (!isRoad(x, y + 1)) { px = x + 0.5; py = y + 0.93; }
      else if (!isRoad(x - 1, y)) { px = x + 0.07; py = y + 0.5; }
      if (px !== null) lamps.push({ x: px, y: py });
    }
    const want = Math.min(14, Math.floor(roadCount / 9));
    while (npcs.length < want) { if (!spawnNpc()) break; }
    while (npcs.length > want) npcs.pop();
  }
  function rankName() {
    return pop < 10 ? 'Hamlet' : pop < 50 ? 'Village' : pop < 200 ? 'Town' : pop < 800 ? 'City' : 'Metropolis';
  }
  function canPlace(type, x0, y0) {
    const d = DEFS[type];
    for (let y = y0; y < y0 + d.d; y++) for (let x = x0; x < x0 + d.w; x++) {
      if (!inb(x, y) || S.road[idx(x, y)] || S.occ[idx(x, y)]) return false;
    }
    return true;
  }
  function placeBuilding(type, x0, y0, free) {
    const d = DEFS[type];
    if (!canPlace(type, x0, y0)) { toast('Not enough space there'); return false; }
    if (!free && S.money < d.cost) { toast('Not enough cash for ' + d.name); return false; }
    if (!free) S.money -= d.cost;
    const b = { id: S.nextId++, type, x: x0, y: y0 };
    S.blds.set(b.id, b);
    for (let y = y0; y < y0 + d.d; y++) for (let x = x0; x < x0 + d.w; x++) S.occ[idx(x, y)] = b.id;
    recalc(); markDirty(); return true;
  }
  function bulldoze(x, y) {
    if (!inb(x, y)) return;
    const o = S.occ[idx(x, y)];
    if (o) {
      const b = S.blds.get(o), d = DEFS[b.type];
      for (let yy = b.y; yy < b.y + d.d; yy++) for (let xx = b.x; xx < b.x + d.w; xx++) S.occ[idx(xx, yy)] = 0;
      S.blds.delete(o); S.money += Math.floor(d.cost * 0.5); recalc(); markDirty();
    } else if (S.road[idx(x, y)]) {
      S.road[idx(x, y)] = 0; S.money += 10; recalc(); markDirty();
    }
  }
  let roadWarn = 0;
  function paintRoad(x, y) {
    if (!inb(x, y) || S.road[idx(x, y)] || S.occ[idx(x, y)]) return;
    if (S.money < 20) { if (now - roadWarn > 2) { toast('Not enough cash for roads'); roadWarn = now; } return; }
    S.money -= 20; S.road[idx(x, y)] = 1; recalc(); markDirty();
  }
  function lineTiles(x0, y0, x1, y1, fn) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) fn(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)));
  }

  // ---------- save / load ----------
  let dirty = false, lastSave = 0;
  function markDirty() { dirty = true; }
  function save() {
    try {
      const roads = []; for (let i = 0; i < S.road.length; i++) if (S.road[i]) roads.push(i);
      const bl = []; for (const b of S.blds.values()) bl.push([b.id, b.type, b.x, b.y]);
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, money: S.money, t: S.t, nextId: S.nextId, roads, bl, cars: S.cars }));
      dirty = false;
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const d = JSON.parse(raw); if (!d || d.v !== 1) return false;
      S.money = d.money; S.t = d.t; S.nextId = d.nextId; S.cars = d.cars && d.cars.length ? d.cars : S.cars;
      S.road.fill(0); S.occ.fill(0); S.blds.clear();
      for (const i of d.roads) S.road[i] = 1;
      for (const [id, type, x, y] of d.bl) {
        if (!DEFS[type]) continue;
        const dd = DEFS[type]; S.blds.set(id, { id, type, x, y });
        for (let yy = y; yy < y + dd.d; yy++) for (let xx = x; xx < x + dd.w; xx++) S.occ[idx(xx, yy)] = id;
      }
      return true;
    } catch (e) { return false; }
  }
  function newCity() {
    S.road.fill(0); S.occ.fill(0); S.blds.clear(); S.nextId = 1; S.money = 60000; S.t = 8;
    S.cars = [{ m: 'hatch', color: '#2f6fed' }];
    for (let i = 16; i <= 32; i++) { S.road[idx(i, 16)] = 1; S.road[idx(i, 32)] = 1; S.road[idx(16, i)] = 1; S.road[idx(32, i)] = 1; }
    for (let i = 10; i <= 38; i++) { S.road[idx(i, 24)] = 1; S.road[idx(24, i)] = 1; }
    placeBuilding('garage', 25, 25, true);
    placeBuilding('cottage', 23, 22, true); placeBuilding('cottage', 25, 22, true);
    placeBuilding('cottage', 22, 26, true);
    placeBuilding('tree', 21, 22, true); placeBuilding('tree', 27, 23, true); placeBuilding('tree', 21, 27, true);
    placeBuilding('tree', 28, 26, true); placeBuilding('fountain', 23, 25, true);
    cam.x = 24; cam.y = 24;
    recalc();
  }

  // ---------- lighting / time ----------
  const KEYS = [
    { h: 0, mul: [75, 90, 155], n: 1 }, { h: 5, mul: [75, 90, 155], n: 1 }, { h: 6.5, mul: [255, 195, 160], n: 0.45 },
    { h: 8, mul: [255, 252, 246], n: 0 }, { h: 17, mul: [255, 252, 246], n: 0 }, { h: 19, mul: [255, 175, 125], n: 0.4 },
    { h: 20.5, mul: [95, 105, 175], n: 0.9 }, { h: 21.5, mul: [75, 90, 155], n: 1 }, { h: 24, mul: [75, 90, 155], n: 1 }
  ];
  function updateLighting() {
    const h = S.t;
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (h >= a.h && h <= b.h) {
        const k = (h - a.h) / (b.h - a.h || 1);
        nightness = lerp(a.n, b.n, k);
        mulCol = 'rgb(' + Math.round(lerp(a.mul[0], b.mul[0], k)) + ',' + Math.round(lerp(a.mul[1], b.mul[1], k)) + ',' + Math.round(lerp(a.mul[2], b.mul[2], k)) + ')';
        return;
      }
    }
  }

  // ---------- buildings (drawing) ----------
  function drawGable(b, d) {
    const x0 = b.x, y0 = b.y, x1 = b.x + d.w, y1 = b.y + d.d, h = d.h, rh = 0.5, ov = 0.07;
    shadowBox(x0, y0, x1, y1, h + rh);
    boxAA(x0, y0, x1, y1, 0, 0.1, '#8d8579', { notop: true });
    boxAA(x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0.1, h, d.wall, { grad: 1 });
    const A = [x0 + 0.04, y1 - 0.04], B = [x1 - 0.04, y1 - 0.04];
    const rows = h > 1 ? 2 : 1;
    wins(A, B, 0.22, h - 0.1, d.cols, rows, 0.2, 0.64, b.id, { skip: [0.32, 0.68], frame: 1 });
    doorAt(A, B, 0.5, 0.2 / Math.max(1, d.w * 0.6), Math.min(0.55, h * 0.6), '#7a4a2b');
    wins([x1 - 0.04, y0 + 0.04], [x1 - 0.04, y1 - 0.04], 0.22, h - 0.1, d.d, rows, 0.22, 0.94, b.id, { frame: 1, fs: 9 });
    const ym = (y0 + y1) / 2;
    // back slope
    F([P(x0 - ov, y0 - ov, h), P(x1 + ov, y0 - ov, h), P(x1 + ov, ym, h + rh), P(x0 - ov, ym, h + rh)], d.roof, 1.05, true);
    if (d.chimney) boxAA(x0 + d.w * 0.2, y0 + d.d * 0.2, x0 + d.w * 0.2 + 0.17, y0 + d.d * 0.2 + 0.17, h + 0.05, h + rh + 0.22, '#8a4b3a');
    // gable end
    F([P(x1, y0, h), P(x1, y1, h), P(x1, ym, h + rh)], d.wall, 0.94);
    // front slope
    F([P(x0 - ov, y1 + ov, h), P(x1 + ov, y1 + ov, h), P(x1 + ov, ym, h + rh), P(x0 - ov, ym, h + rh)], d.roof, 0.86, true);
    path([P(x0 - ov, ym, h + rh), P(x1 + ov, ym, h + rh)]); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.stroke();
  }
  function drawBlock(b, d) {
    const x0 = b.x, y0 = b.y, x1 = b.x + d.w, y1 = b.y + d.d, h = d.h;
    shadowBox(x0, y0, x1, y1, h);
    boxAA(x0, y0, x1, y1, 0, 0.12, '#756e66', { notop: true });
    boxAA(x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, 0.12, h, d.wall, { grad: 1 });
    wins([x0 + 0.03, y1 - 0.03], [x1 - 0.03, y1 - 0.03], 0.5, h - 0.08, d.w * 3, d.floors, 0.2, 0.64, b.id, { frame: 1, skip: [0.4, 0.6] });
    doorAt([x0 + 0.03, y1 - 0.03], [x1 - 0.03, y1 - 0.03], 0.5, 0.2, 0.4, '#3d3a36');
    wins([x1 - 0.03, y0 + 0.03], [x1 - 0.03, y1 - 0.03], 0.5, h - 0.08, d.d * 3, d.floors, 0.2, 0.94, b.id, { frame: 1, fs: 9 });
    boxAA(x0, y0, x1, y1, h - 0.05, h + 0.07, '#a89684');
    boxAA(x0 + 0.5, y0 + 0.4, x0 + 0.95, y0 + 0.85, h + 0.07, h + 0.24, '#9aa0a6');
  }
  function drawTower(b, d) {
    const x0 = b.x, y0 = b.y, x1 = b.x + d.w, y1 = b.y + d.d, h = d.h;
    shadowBox(x0, y0, x1, y1, h);
    boxAA(x0, y0, x1, y1, 0, 0.35, '#2b3a46', { grad: 1 });
    const a = x0 + 0.18, b2 = y0 + 0.18, c = x1 - 0.18, e = y1 - 0.18;
    boxAA(a, b2, c, e, 0.35, h, '#5f86a3', { grad: 1 });
    const rows = Math.round((h - 0.4) * 2.2);
    wins([a, e], [c, e], 0.42, h - 0.06, 6, rows, 0.1, 0.64, b.id, { glass: '#a4cdea', litp: 0.5 });
    wins([c, b2], [c, e], 0.42, h - 0.06, 6, rows, 0.1, 0.94, b.id, { glass: '#a4cdea', litp: 0.5, fs: 5 });
    doorAt([a, e], [c, e], 0.5, 0.18, 0.3, '#1d2a35');
    boxAA(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6, h, h + 1, '#7da0b8', { grad: 1 });
    wins([x0 + 0.6, y1 - 0.6], [x1 - 0.6, y1 - 0.6], h + 0.06, h + 0.95, 3, 3, 0.1, 0.64, b.id, { glass: '#a4cdea', fs: 3 });
    wins([x1 - 0.6, y0 + 0.6], [x1 - 0.6, y1 - 0.6], h + 0.06, h + 0.95, 3, 3, 0.1, 0.94, b.id, { glass: '#a4cdea', fs: 4 });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const p0 = P(cx, cy, h + 1), p1 = P(cx, cy, h + 2.3);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.strokeStyle = '#cfd6dc'; g.lineWidth = 1.4; g.stroke();
    glows.push({ x: cx, y: cy, z: h + 2.3, r: 22, c: '255,50,50', a: 0.5 + 0.5 * Math.sin(now * 3) });
  }
  const SHOP_COLS = ['#d97757', '#6fa8a0', '#d9b44a', '#8e7cc3', '#c0504d'];
  function drawShop(b, d) {
    const x0 = b.x, y0 = b.y, x1 = b.x + d.w, y1 = b.y + d.d, h = d.h;
    const col = SHOP_COLS[b.id % SHOP_COLS.length];
    shadowBox(x0, y0, x1, y1, h);
    boxAA(x0 + 0.03, y0 + 0.04, x1 - 0.03, y1 - 0.04, 0, h, col, { grad: 1 });
    wins([x0 + 0.1, y1 - 0.04], [x1 - 0.1, y1 - 0.04], 0.04, 0.5, 2, 1, 0.12, 0.7, b.id, { glass: '#243b52', litp: 1, frame: 1 });
    wins([x1 - 0.03, y0 + 0.1], [x1 - 0.03, y1 - 0.1], 0.2, 0.6, 1, 1, 0.2, 0.94, b.id, { frame: 1 });
    const n = d.w * 4;
    for (let i = 0; i < n; i++) {
      const xa = x0 + 0.03 + (d.w - 0.06) * i / n, xb = x0 + 0.03 + (d.w - 0.06) * (i + 1) / n;
      F([P(xa, y1 - 0.04, 0.62), P(xb, y1 - 0.04, 0.62), P(xb, y1 + 0.22, 0.46), P(xa, y1 + 0.22, 0.46)], i % 2 ? '#f4f1ea' : '#b03a2e', 0.9, false, false);
    }
    boxAA(x0 + 0.03, y0 + 0.04, x1 - 0.03, y1 - 0.04, h, h + 0.05, '#e8e2d2');
    boxAA(x0 + 0.25, y0 + 0.1, x0 + 0.7, y0 + 0.4, h + 0.05, h + 0.2, '#9aa0a6');
  }
  function drawGarage(b, d) {
    const x0 = b.x, y0 = b.y, x1 = b.x + d.w, y1 = b.y + d.d;
    ground(x0, y0 + 1, x1, y1, '#8d9096');
    for (let i = 0; i <= d.w; i++) {
      path([P(x0 + i, y0 + 1.02, 0.02), P(x0 + i + 0.04, y0 + 1.02, 0.02), P(x0 + i + 0.04, y1 - 0.02, 0.02), P(x0 + i, y1 - 0.02, 0.02)]);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    }
    shadowBox(x0, y0, x1, y0 + 1, d.h);
    boxAA(x0, y0, x1, y0 + 1, 0, d.h, '#d6d3cc', { grad: 1, ct: '#9da3a8' });
    const A = [x0 + 0.12, y0 + 1], B = [x1 - 0.12, y0 + 1];
    path([P(A[0], A[1], 0.5), P(B[0], B[1], 0.5), P(B[0], B[1], 0.01), P(A[0], A[1], 0.01)]);
    g.fillStyle = shade('#aab0b6', 0.64); g.fill();
    for (let i = 1; i < 6; i++) {
      const z = 0.5 * i / 6;
      path([P(A[0], A[1], z), P(B[0], B[1], z)]); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.7; g.stroke();
    }
    boxAA(x0 + 0.15, y0 + 0.2, x0 + 0.5, y0 + 0.5, d.h, d.h + 0.14, '#7f868c');
  }
  function drawVilla(b, d) {
    const x0 = b.x, y0 = b.y;
    shadowBox(x0, y0, x0 + 3, y0 + 2, d.h);
    ground(x0 + 0.05, y0 + 2.05, x0 + 0.95, y0 + 3, '#9a9ca1');
    ground(x0 + 1.05, y0 + 2.1, x0 + 2.95, y0 + 2.9, '#d8d2c4');
    path([P(x0 + 1.2, y0 + 2.25, 0.02), P(x0 + 2.8, y0 + 2.25, 0.02), P(x0 + 2.8, y0 + 2.75, 0.02), P(x0 + 1.2, y0 + 2.75, 0.02)]);
    const pg = g.createLinearGradient(PXf(x0 + 1.2, y0 + 2.25), PYf(x0 + 1.2, y0 + 2.25), PXf(x0 + 2.8, y0 + 2.75), PYf(x0 + 2.8, y0 + 2.75));
    pg.addColorStop(0, '#6fd3ea'); pg.addColorStop(0.5 + 0.3 * Math.sin(now * 1.5), '#9ee8f5'); pg.addColorStop(1, '#3ba8cc');
    g.fillStyle = pg; g.fill();
    boxAA(x0, y0, x0 + 3, y0 + 2, 0, 0.7, '#f3f2ee', { grad: 1 });
    wins([x0 + 0.1, y0 + 2], [x0 + 2.9, y0 + 2], 0.1, 0.62, 3, 1, 0.08, 0.64, b.id, { glass: '#6f9cc0', frame: 1, litp: 0.8 });
    wins([x0 + 3, y0 + 0.1], [x0 + 3, y0 + 1.9], 0.1, 0.62, 2, 1, 0.1, 0.94, b.id, { glass: '#6f9cc0', frame: 1, fs: 3 });
    boxAA(x0 - 0.05, y0 - 0.05, x0 + 3.05, y0 + 2.05, 0.7, 0.76, '#ffffff');
    boxAA(x0 + 0.25, y0 + 0.2, x0 + 2.0, y0 + 1.75, 0.76, 1.4, '#e9e6df', { grad: 1 });
    wins([x0 + 0.25, y0 + 1.75], [x0 + 2.0, y0 + 1.75], 0.82, 1.34, 2, 1, 0.06, 0.64, b.id, { glass: '#6f9cc0', frame: 1, fs: 5, litp: 0.8 });
    wins([x0 + 2.0, y0 + 0.2], [x0 + 2.0, y0 + 1.75], 0.82, 1.34, 2, 1, 0.1, 0.94, b.id, { glass: '#6f9cc0', frame: 1, fs: 7 });
    boxAA(x0 + 0.2, y0 + 0.15, x0 + 2.05, y0 + 1.8, 1.4, 1.46, '#ffffff');
  }
  function drawMansion(b, d) {
    const x0 = b.x, y0 = b.y;
    shadowBox(x0, y0, x0 + 4, y0 + 2, d.h);
    ground(x0 + 1.4, y0 + 2.05, x0 + 2.6, y0 + 3, '#b9b3a6');
    boxAA(x0, y0, x0 + 4, y0 + 2, 0, 1.5, d.wall, { grad: 1 });
    wins([x0, y0 + 2], [x0 + 4, y0 + 2], 0.18, 1.4, 8, 2, 0.2, 0.64, b.id, { skip: [0.36, 0.64], frame: 1 });
    wins([x0 + 4, y0], [x0 + 4, y0 + 2], 0.18, 1.4, 4, 2, 0.2, 0.94, b.id, { frame: 1, fs: 3 });
    doorAt([x0, y0 + 2], [x0 + 4, y0 + 2], 0.5, 0.12, 0.62, '#4a3326');
    for (let i = 0; i < 4; i++) {
      const cx = x0 + 1.45 + i * 0.37;
      boxAA(cx - 0.05, y0 + 2.4, cx + 0.05, y0 + 2.5, 0, 1.2, '#f6f3ea');
    }
    boxAA(x0 + 1.3, y0 + 2.0, x0 + 2.7, y0 + 2.58, 1.2, 1.3, '#f6f3ea');
    boxAA(x0 - 0.05, y0 - 0.05, x0 + 4.05, y0 + 2.05, 1.5, 1.62, d.roof);
    boxAA(x0 + 0.6, y0 + 0.4, x0 + 3.4, y0 + 1.6, 1.62, 1.82, '#4d5463');
    boxAA(x0 + 0.1, y0 + 2.6, x0 + 1.2, y0 + 2.85, 0, 0.14, '#2f6b34');
    boxAA(x0 + 2.8, y0 + 2.6, x0 + 3.9, y0 + 2.85, 0, 0.14, '#2f6b34');
  }
  function drawTree(b) {
    const cx = b.x + 0.5, cy = b.y + 0.5, hv = hash2(b.x * 7, b.y * 13);
    ell(cx + 0.1, cy + 0.06, 0.01, 0.28, 'rgba(0,0,0,.2)');
    boxAA(cx - 0.04, cy - 0.04, cx + 0.04, cy + 0.04, 0, 0.3, '#6b4a2f');
    const sway = Math.sin(now * 1.3 + hv * 6) * 1.2;
    if (hv > 0.72 && hv < 0.9) {
      const lv = [[0.14, 0.26, 0.3], [0.36, 0.2, 0.3], [0.58, 0.14, 0.3]];
      for (const [z, wr, hh] of lv) {
        const base = P(cx, cy, z), apex = P(cx, cy, z + hh), wpx = wr * 62 * 0.7;
        const sx = sway * (z + hh);
        path([[apex[0] + sx, apex[1]], [base[0], base[1]], [base[0] - wpx, base[1]]]); g.fillStyle = '#2a5d3a'; g.fill();
        path([[apex[0] + sx, apex[1]], [base[0], base[1]], [base[0] + wpx, base[1]]]); g.fillStyle = '#3f8a52'; g.fill();
      }
    } else {
      const pal = hv >= 0.9 ? ['#f2b441', '#d9822b', '#a85a1c'] : ['#7ccf60', '#3f9a3e', '#2a6e30'];
      const cr = [[0, 0, 0.3, 0.26], [-0.07, 0.04, 0.4, 0.21], [0.07, -0.03, 0.5, 0.18]];
      for (const [ox, oy, z, r] of cr) {
        const p = P(cx + ox, cy + oy, z), rr = r * 46, px = p[0] + sway * z, py = p[1];
        const gr = g.createRadialGradient(px - rr * 0.35, py - rr * 0.35, rr * 0.1, px, py, rr);
        gr.addColorStop(0, pal[0]); gr.addColorStop(0.6, pal[1]); gr.addColorStop(1, pal[2]);
        g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
      }
    }
  }
  function drawFountain(b) {
    const cx = b.x + 0.5, cy = b.y + 0.5;
    ell(cx, cy, 0.0, 0.44, '#7b8085');
    const p0 = P(cx, cy, 0), p1 = P(cx, cy, 0.14);
    g.fillStyle = '#9ba1a6'; g.fillRect(p0[0] - 0.42 * 45.25, p1[1], 0.84 * 45.25, p0[1] - p1[1]);
    ell(cx, cy, 0.14, 0.44, '#cfd3d6');
    const gr = g.createRadialGradient(p1[0], p1[1], 2, p1[0], p1[1], 0.36 * 45);
    gr.addColorStop(0, '#9be0f2'); gr.addColorStop(1, '#4fb2d4');
    g.beginPath(); g.ellipse(p1[0], p1[1], 0.36 * 45.25, 0.36 * 22.63, 0, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
    boxAA(cx - 0.05, cy - 0.05, cx + 0.05, cy + 0.05, 0.14, 0.42, '#bfc4c8');
    g.strokeStyle = 'rgba(235,250,255,.85)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + now * 0.4, ht = 14 + 5 * Math.sin(now * 3 + i);
      const sx = p1[0], sy = p1[1] - 0.42 * ZS + 2;
      g.beginPath(); g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + Math.cos(a) * 9, sy - ht * 0.6, sx + Math.cos(a) * 17, sy + 14 + Math.sin(a) * 4); g.stroke();
    }
  }
  function drawLamp(l) {
    boxAA(l.x - 0.015, l.y - 0.015, l.x + 0.015, l.y + 0.015, 0, 0.55, '#444b52');
    boxAA(l.x - 0.05, l.y - 0.05, l.x + 0.05, l.y + 0.05, 0.55, 0.6, '#d9dde1');
    if (nightness > 0.25) glows.push({ x: l.x, y: l.y, z: 0.55, r: 80, c: '255,220,140', a: 0.55 * nightness });
  }
  function drawBuilding(b) {
    const d = DEFS[b.type];
    switch (d.kind) {
      case 'gable': drawGable(b, d); break;
      case 'block': drawBlock(b, d); break;
      case 'tower': drawTower(b, d); break;
      case 'shop': drawShop(b, d); break;
      case 'garage': drawGarage(b, d); break;
      case 'villa': drawVilla(b, d); break;
      case 'mansion': drawMansion(b, d); break;
      case 'tree': drawTree(b); break;
      case 'fountain': drawFountain(b); break;
    }
    if (d.inc && b.acc === false) {
      const p = P(b.x + d.w / 2, b.y + d.d / 2, d.h + 0.4);
      g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('⚠️', p[0], p[1]);
    }
  }

  // ---------- cars (drawing) ----------
  function frus(cx, cy, a, z0, z1, b, t, col, sideCol, topCol, vc) {
    const ca = Math.cos(a), sa = Math.sin(a); vc = vc || 0;
    const W2 = (u, v, z) => P(cx + ca * u - sa * v, cy + sa * u + ca * v, z);
    const BFR = W2(b[1], vc + b[2], z0), BFL = W2(b[1], vc - b[2], z0), BBL = W2(b[0], vc - b[2], z0), BBR = W2(b[0], vc + b[2], z0);
    const TFR = W2(t[1], vc + t[2], z1), TFL = W2(t[1], vc - t[2], z1), TBL = W2(t[0], vc - t[2], z1), TBR = W2(t[0], vc + t[2], z1);
    const h = z1 - z0;
    const faces = [
      { n: [ca, sa], p: [BFL, BFR, TFR, TFL], run: b[1] - t[1] },
      { n: [-ca, -sa], p: [BBR, BBL, TBL, TBR], run: t[0] - b[0] },
      { n: [-sa, ca], p: [BFR, BBR, TBR, TFR], run: b[2] - t[2] },
      { n: [sa, -ca], p: [BBL, BFL, TFL, TBL], run: b[2] - t[2] }
    ];
    const vis = [];
    for (const f of faces) { const s = f.n[0] + f.n[1]; if (s > -0.816 * f.run / h) vis.push([s, f]); }
    vis.sort((p, q) => p[0] - q[0]);
    for (const [, f] of vis) {
      const fl = clamp(0.78 + 0.16 * f.n[0] - 0.16 * f.n[1] + 0.12 * clamp(f.run / h, 0, 1), 0.4, 1.1);
      F(f.p, sideCol || col, fl);
    }
    F([TFL, TFR, TBR, TBL], topCol || col, 1.06);
  }
  function drawCar(c, preview) {
    const m = CARS[c.m], L = m.L, Wd = m.W, a = c.a, ca = Math.cos(a), sa = Math.sin(a);
    const WP = (u, v) => [c.x + ca * u - sa * v, c.y + sa * u + ca * v];
    // shadow
    const sh = [[-0.54, -0.6], [0.54, -0.6], [0.54, 0.6], [-0.54, 0.6]].map(([u, v]) => { const w = WP(u * L + 0.03, v * Wd - 0.02); return P(w[0] + 0.03, w[1] + 0.03, 0.01); });
    path(sh); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
    const wheel = (v) => { for (const u of [0.31, -0.31]) frus(c.x, c.y, a, 0, 0.13, [u * L - 0.06, u * L + 0.06, 0.045], [u * L - 0.05, u * L + 0.05, 0.045], '#16181b', null, null, v * (Wd / 2 + 0.005)); };
    const rightNear = (ca - sa) > 0, nearV = rightNear ? 1 : -1;
    wheel(-nearV);
    const backVis = (ca + sa) < 0;
    const spoil = () => {
      if (!m.spoiler) return;
      const big = m.spoiler === 2, z0 = m.bh + (big ? 0.07 : 0.04), z1 = z0 + 0.025;
      frus(c.x, c.y, a, z0, z1, [-0.5 * L, -0.4 * L, Wd * 0.44], [-0.5 * L, -0.4 * L, Wd * 0.44], c.color, null, null, 0);
      for (const v of [-0.3, 0.3]) frus(c.x, c.y, a, m.bh - 0.01, z0, [-0.47 * L, -0.43 * L, 0.012], [-0.47 * L, -0.43 * L, 0.012], '#1d1f23', null, null, v * Wd);
    };
    if (!backVis) spoil();
    frus(c.x, c.y, a, 0.05, m.bh, [-0.5 * L, 0.5 * L, Wd / 2], [-0.47 * L, 0.46 * L, Wd * 0.46], c.color);
    frus(c.x, c.y, a, m.bh, m.bh + m.ch, [m.cab[0] * L, m.cab[1] * L, Wd * m.cwb], [m.cab[2] * L, m.cab[3] * L, Wd * m.cwt], c.color, '#1f2c3b', c.color);
    wheel(nearV);
    if (backVis) spoil();
    const lightQuad = (u, v0, v1, z0, z1, col) => {
      const q = [[u, v0, z1], [u, v1, z1], [u, v1, z0], [u, v0, z0]].map(([uu, vv, zz]) => { const w = WP(uu, vv); return P(w[0], w[1], zz); });
      path(q); g.fillStyle = col; g.fill();
    };
    const night = !preview && nightness > 0.25;
    if ((ca + sa) > -0.1) {
      const col = night ? '#fffbe0' : '#fff2c4';
      lightQuad(0.487 * L, Wd * 0.27, Wd * 0.43, m.bh * 0.5, m.bh * 0.85, col);
      lightQuad(0.487 * L, -Wd * 0.43, -Wd * 0.27, m.bh * 0.5, m.bh * 0.85, col);
    }
    if ((ca + sa) < 0.1) {
      const col = c.brake ? '#ff3030' : (night ? '#d02020' : '#9b1717');
      lightQuad(-0.487 * L, Wd * 0.27, Wd * 0.43, m.bh * 0.5, m.bh * 0.85, col);
      lightQuad(-0.487 * L, -Wd * 0.43, -Wd * 0.27, m.bh * 0.5, m.bh * 0.85, col);
    }
    if (night) {
      const f = WP(L * 0.5 + 0.55, 0);
      glows.push({ x: f[0], y: f[1], z: 0.05, r: 70, c: '255,238,180', a: 0.4 });
      const r = WP(-L * 0.5, 0);
      glows.push({ x: r[0], y: r[1], z: 0.1, r: c.brake ? 36 : 18, c: '255,40,40', a: c.brake ? 0.6 : 0.3 });
    }
  }

  // ---------- traffic ----------
  function spawnNpc() {
    if (!roadList.length) return false;
    for (let tries = 0; tries < 20; tries++) {
      const i = roadList[(Math.random() * roadList.length) | 0], x = i % MAP, y = (i / MAP) | 0;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isRoad(x + dx, y + dy));
      if (!dirs.length) continue;
      const [dx, dy] = dirs[(Math.random() * dirs.length) | 0];
      npcs.push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y, dx, dy, a: Math.atan2(dy, dx), m: NPC_MODELS[(Math.random() * NPC_MODELS.length) | 0], color: NPC_COLORS[(Math.random() * NPC_COLORS.length) | 0], v: 1.5 + Math.random() * 1.2, brake: 0 });
      return true;
    }
    return false;
  }
  function updateNpcs(dt) {
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (!isRoad(n.tx, n.ty) || !isRoad(n.tx + n.dx, n.ty + n.dy)) {
        npcs.splice(i, 1); spawnNpc(); continue;
      }
      const gx = n.tx + n.dx + 0.5, gy = n.ty + n.dy + 0.5;
      const ddx = gx - n.x, ddy = gy - n.y, dist = Math.hypot(ddx, ddy), step = n.v * dt;
      if (dist <= step) {
        n.x = gx; n.y = gy; n.tx += n.dx; n.ty += n.dy;
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isRoad(n.tx + dx, n.ty + dy) && !(dx === -n.dx && dy === -n.dy));
        if (opts.length) {
          const straight = opts.find(([dx, dy]) => dx === n.dx && dy === n.dy);
          const pick = straight && Math.random() < 0.6 ? straight : opts[(Math.random() * opts.length) | 0];
          n.dx = pick[0]; n.dy = pick[1];
        } else { n.dx = -n.dx; n.dy = -n.dy; }
      } else { n.x += ddx / dist * step; n.y += ddy / dist * step; }
      const want = Math.atan2(n.dy, n.dx);
      let diff = want - n.a; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      n.a += diff * Math.min(1, dt * 8);
    }
  }

  // ---------- player car ----------
  const keys = { up: 0, down: 0, left: 0, right: 0 }, tc = { up: 0, down: 0, left: 0, right: 0 };
  let AC = null, osc = null, gainN = null, lpN = null, muted = false;
  function audioStart() {
    if (muted) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      if (!osc) {
        osc = AC.createOscillator(); osc.type = 'sawtooth'; lpN = AC.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 420;
        gainN = AC.createGain(); gainN.gain.value = 0; osc.connect(lpN); lpN.connect(gainN); gainN.connect(AC.destination); osc.start();
      }
    } catch (e) { /* no audio */ }
  }
  function audioUpdate(r, thr) {
    if (!osc) return;
    const t = AC.currentTime;
    osc.frequency.setTargetAtTime(48 + r * 170 + thr * 18, t, 0.08);
    lpN.frequency.setTargetAtTime(380 + r * 900, t, 0.1);
    gainN.gain.setTargetAtTime(S.mode === 'drive' && !muted ? 0.04 + r * 0.05 : 0, t, 0.12);
  }
  function carBlocked(c, L) {
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (const u of [0, L * 0.5, -L * 0.5]) {
      const x = c.x + ca * u, y = c.y + sa * u;
      if (solid(Math.floor(x), Math.floor(y))) return true;
    }
    return false;
  }
  function updateDrive(dt) {
    const c = S.drive, m = CARS[S.cars[c.idx].m];
    const up = keys.up || tc.up, dn = keys.down || tc.down, lf = keys.left || tc.left, rt = keys.right || tc.right;
    const onRoad = isRoad(Math.floor(c.x), Math.floor(c.y));
    const max = m.max * (onRoad ? 1 : 0.55);
    c.brake = 0;
    if (up) c.v += m.acc * dt * (c.v < 0 ? 2 : 1);
    else if (dn) { if (c.v > 0.15) { c.v -= m.brake * dt; c.brake = 1; } else c.v -= m.acc * 0.55 * dt; }
    else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.4 * dt);
    if (!onRoad) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.6 * dt);
    c.v = clamp(c.v, -max * 0.3, max);
    const steer = (rt ? 1 : 0) - (lf ? 1 : 0);
    const turn = 2.5 / (1 + 0.1 * Math.abs(c.v));
    c.a += steer * turn * dt * clamp(c.v / 1.8, -1, 1);
    const nx = c.x + Math.cos(c.a) * c.v * dt, ny = c.y + Math.sin(c.a) * c.v * dt;
    const test = { x: nx, y: ny, a: c.a };
    if (carBlocked(test, m.L)) { c.v = -c.v * 0.25; } else { c.x = nx; c.y = ny; }
    audioUpdate(Math.abs(c.v) / m.max, up ? 1 : 0);
  }
  function findSpawn() {
    const gs = []; for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    for (let i = gs.length - 1; i >= 0; i--) {
      const b = gs[i];
      for (let x = b.x; x < b.x + 2; x++) {
        const ty = b.y + 2;
        if (!solid(x, ty)) return { x: x + 0.5, y: ty + 0.5, a: Math.PI / 2 };
      }
    }
    let best = null, bd = 1e9;
    for (const i of roadList) { const x = i % MAP, y = (i / MAP) | 0, d = Math.hypot(x - 24, y - 24); if (d < bd) { bd = d; best = [x, y]; } }
    if (best) return { x: best[0] + 0.5, y: best[1] + 0.5, a: 0 };
    return { x: 24.5, y: 24.5, a: 0 };
  }
  function startDrive(i) {
    const sp = findSpawn();
    S.drive = { idx: i, x: sp.x, y: sp.y, a: sp.a, v: 0, brake: 0 };
    S.mode = 'drive'; pending = null; hideConfirm();
    document.body.classList.add('driving');
    $('panel').hidden = true; carPanelOpen = false;
    $('carname').textContent = CARS[S.cars[i].m].name;
    cam.x = sp.x; cam.y = sp.y;
    audioStart();
  }
  function stopDrive() {
    S.drive = null; S.mode = 'build'; document.body.classList.remove('driving');
    keys.up = keys.down = keys.left = keys.right = 0; tc.up = tc.down = tc.left = tc.right = 0;
    audioUpdate(0, 0);
  }
  function parkedCars() {
    const out = [], gs = [];
    for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    const owned = S.cars.map((c, i) => ({ c, i })).filter(o => !S.drive || o.i !== S.drive.idx);
    let k = 0;
    for (const b of gs) for (let s = 0; s < 2 && k < owned.length; s++, k++) {
      out.push({ x: b.x + 0.5 + s, y: b.y + 1.5, a: Math.PI / 2, m: owned[k].c.m, color: owned[k].c.color, brake: 0 });
    }
    return out;
  }

  // ---------- camera / screen maths ----------
  function camIso() { return [PXf(cam.x, cam.y), PYf(cam.x, cam.y, 0)]; }
  function screenToWorld(px, py) {
    const [cix, ciy] = camIso();
    const ix = (px - W / 2) / cam.zoom + cix, iy = (py - H / 2) / cam.zoom + ciy;
    return [(ix / (TW / 2) + iy / (TH / 2)) / 2, (iy / (TH / 2) - ix / (TW / 2)) / 2];
  }
  function panByScreen(dx, dy) {
    const ix = -dx / cam.zoom, iy = -dy / cam.zoom;
    cam.x += (ix / (TW / 2) + iy / (TH / 2)) / 2; cam.y += (iy / (TH / 2) - ix / (TW / 2)) / 2;
    cam.x = clamp(cam.x, 0, MAP); cam.y = clamp(cam.y, 0, MAP);
  }
  function tileAt(px, py) { const [x, y] = screenToWorld(px, py); return { x: Math.floor(x), y: Math.floor(y) }; }
  function anchorFor(type, t) { const d = DEFS[type]; return { x: t.x - Math.floor(d.w / 2), y: t.y - Math.floor(d.d / 2) }; }

  // ---------- ground drawing ----------
  const grassTiles = [];
  function mkGrass() {
    const bases = [[94, 158, 66], [90, 152, 62], [100, 164, 70], [86, 148, 60], [96, 156, 64], [92, 160, 68], [88, 150, 58], [102, 160, 72]];
    for (let v = 0; v < 8; v++) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const x = c.getContext('2d');
      x.beginPath(); x.moveTo(64, 0); x.lineTo(128, 32); x.lineTo(64, 64); x.lineTo(0, 32); x.closePath(); x.clip();
      x.fillStyle = 'rgb(' + bases[v].join(',') + ')'; x.fillRect(0, 0, 128, 64);
      let s = v * 977 + 13; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 80; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(190,230,120,.25)' : 'rgba(30,80,30,.22)'; x.fillRect(rnd() * 128, rnd() * 64, 2, 1.4); }
      for (let i = 0; i < 5; i++) { x.strokeStyle = 'rgba(40,100,40,.35)'; x.lineWidth = 1; const px = rnd() * 128, py = rnd() * 64; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 1, py - 3); x.stroke(); }
      for (let i = 0; i < 3; i++) { x.fillStyle = ['#ffffff', '#ffe066', '#f9a8d4'][i % 3]; x.fillRect(rnd() * 128, rnd() * 64, 1.6, 1.6); }
      grassTiles.push(c);
    }
  }
  function quadW(pts, col) { path(pts.map(p => P(p[0], p[1], 0.012))); g.fillStyle = col; g.fill(); }
  function drawRoadTile(x, y) {
    const nN = isRoad(x, y - 1), nE = isRoad(x + 1, y), nS = isRoad(x, y + 1), nW = isRoad(x - 1, y);
    quadW([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], hash2(x, y) < 0.5 ? '#3a3e45' : '#3d4148');
    const s = 0.14, sw = '#b8b4aa';
    if (!nN) quadW([[x, y], [x + 1, y], [x + 1, y + s], [x, y + s]], sw);
    if (!nE) quadW([[x + 1, y], [x + 1, y + 1], [x + 1 - s, y + 1], [x + 1 - s, y]], sw);
    if (!nS) quadW([[x, y + 1], [x + 1, y + 1], [x + 1, y + 1 - s], [x, y + 1 - s]], sw);
    if (!nW) quadW([[x, y], [x, y + 1], [x + s, y + 1], [x + s, y]], sw);
    const n = (nN ? 1 : 0) + (nE ? 1 : 0) + (nS ? 1 : 0) + (nW ? 1 : 0);
    if (n >= 1 && n <= 2) {
      const dc = '#e8e2c8', w = 0.022;
      if (nE) quadW([[x + 0.62, y + 0.5 - w], [x + 0.9, y + 0.5 - w], [x + 0.9, y + 0.5 + w], [x + 0.62, y + 0.5 + w]], dc);
      if (nW) quadW([[x + 0.1, y + 0.5 - w], [x + 0.38, y + 0.5 - w], [x + 0.38, y + 0.5 + w], [x + 0.1, y + 0.5 + w]], dc);
      if (nN) quadW([[x + 0.5 - w, y + 0.1], [x + 0.5 + w, y + 0.1], [x + 0.5 + w, y + 0.38], [x + 0.5 - w, y + 0.38]], dc);
      if (nS) quadW([[x + 0.5 - w, y + 0.62], [x + 0.5 + w, y + 0.62], [x + 0.5 + w, y + 0.9], [x + 0.5 - w, y + 0.9]], dc);
    }
  }

  // ---------- main draw ----------
  function draw() {
    g = ctx; lit = []; glows = [];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const sea = ctx.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#3f93ba'); sea.addColorStop(1, '#1b5a82');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    const z = cam.zoom, [cix, ciy] = camIso();
    const T = () => ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cix * z), DPR * (H / 2 - ciy * z));
    T();
    // island sides
    F([P(0, MAP, 0), P(MAP, MAP, 0), P(MAP, MAP, -1), P(0, MAP, -1)], '#7b5a3b', 0.8, true, false);
    F([P(MAP, 0, 0), P(MAP, MAP, 0), P(MAP, MAP, -1), P(MAP, 0, -1)], '#7b5a3b', 1.0, true, false);
    // visible area
    const corners = [screenToWorld(0, 0), screenToWorld(W, 0), screenToWorld(0, H), screenToWorld(W, H)];
    const minX = clamp(Math.floor(Math.min(...corners.map(c => c[0]))) - 1, 0, MAP - 1), maxX = clamp(Math.ceil(Math.max(...corners.map(c => c[0]))) + 1, 0, MAP - 1);
    const minY = clamp(Math.floor(Math.min(...corners.map(c => c[1]))) - 1, 0, MAP - 1), maxY = clamp(Math.ceil(Math.max(...corners.map(c => c[1]))) + 1, 0, MAP - 1);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (S.road[idx(x, y)]) drawRoadTile(x, y);
      else g.drawImage(grassTiles[((hash2(x, y) * 8) | 0) & 7], PXf(x, y) - 32.3, PYf(x, y, 0) - 0.3, 64.6, 32.6);
    }
    const building = S.mode === 'build' && (S.tool === 'build' || S.tool === 'road' || S.tool === 'bull');
    if (building) {
      g.beginPath();
      for (let i = minX; i <= maxX + 1; i++) { g.moveTo(PXf(i, minY), PYf(i, minY, 0.02)); g.lineTo(PXf(i, maxY + 1), PYf(i, maxY + 1, 0.02)); }
      for (let j = minY; j <= maxY + 1; j++) { g.moveTo(PXf(minX, j), PYf(minX, j, 0.02)); g.lineTo(PXf(maxX + 1, j), PYf(maxX + 1, j, 0.02)); }
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 0.8; g.stroke();
    }
    // entities
    const vx0 = cix - W / 2 / z - 120, vx1 = cix + W / 2 / z + 120, vy0 = ciy - H / 2 / z - 100, vy1 = ciy + H / 2 / z + 260;
    const ents = [];
    for (const b of S.blds.values()) {
      const d = DEFS[b.type], bx = PXf(b.x + d.w / 2, b.y + d.d / 2), by = PYf(b.x + d.w, b.y + d.d, 0);
      if (bx < vx0 - (d.w + d.d) * 32 || bx > vx1 + (d.w + d.d) * 32 || by < vy0 || by - d.h * ZS - 120 > vy1) continue;
      ents.push({ k: b.x + b.y + (d.w + d.d) / 2 - (d.kind === 'tree' || d.kind === 'fountain' ? 0 : 0), t: 0, o: b });
    }
    for (const l of lamps) { const lx = PXf(l.x, l.y), ly = PYf(l.x, l.y, 0); if (lx > vx0 && lx < vx1 && ly > vy0 && ly < vy1) ents.push({ k: l.x + l.y, t: 1, o: l }); }
    for (const n of npcs) {
      const ca = Math.cos(n.a), sa = Math.sin(n.a), o = { x: n.x - sa * 0.17, y: n.y + ca * 0.17, a: n.a, m: n.m, color: n.color, brake: 0 };
      ents.push({ k: o.x + o.y, t: 2, o });
    }
    for (const p of parkedCars()) ents.push({ k: p.x + p.y + 0.2, t: 2, o: p });
    if (S.drive) { const c = S.drive; ents.push({ k: c.x + c.y, t: 2, o: { x: c.x, y: c.y, a: c.a, m: S.cars[c.idx].m, color: S.cars[c.idx].color, brake: c.brake } }); }
    ents.sort((a, b) => a.k - b.k);
    for (const e of ents) { if (e.t === 0) drawBuilding(e.o); else if (e.t === 1) drawLamp(e.o); else drawCar(e.o); }
    // ghost
    if (S.mode === 'build' && S.tool === 'build' && S.toolType) {
      const t = pending || hoverT;
      if (t) {
        const d = DEFS[S.toolType], a = anchorFor(S.toolType, t), ok = canPlace(S.toolType, a.x, a.y);
        path([P(a.x, a.y, 0.03), P(a.x + d.w, a.y, 0.03), P(a.x + d.w, a.y + d.d, 0.03), P(a.x, a.y + d.d, 0.03)]);
        g.fillStyle = ok ? 'rgba(80,230,130,.45)' : 'rgba(240,70,70,.5)'; g.fill();
        if (ok) { g.globalAlpha = 0.6; drawBuilding({ id: 0, type: S.toolType, x: a.x, y: a.y }); g.globalAlpha = 1; }
      }
    } else if (S.mode === 'build' && (S.tool === 'road' || S.tool === 'bull') && hoverT && inb(hoverT.x, hoverT.y)) {
      const t = hoverT;
      path([P(t.x, t.y, 0.03), P(t.x + 1, t.y, 0.03), P(t.x + 1, t.y + 1, 0.03), P(t.x, t.y + 1, 0.03)]);
      g.fillStyle = S.tool === 'road' ? 'rgba(255,255,255,.35)' : 'rgba(240,70,70,.5)'; g.fill();
    }
    // day / night
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mulCol !== 'rgb(255,255,255)') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mulCol; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    T();
    if (lit.length) { ctx.fillStyle = 'rgba(255,208,110,0.95)'; for (const q of lit) { path(q); ctx.fill(); } }
    if (glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const gl of glows) {
        const x = PXf(gl.x, gl.y), y = PYf(gl.x, gl.y, gl.z);
        const rg = ctx.createRadialGradient(x, y, 0, x, y, gl.r);
        rg.addColorStop(0, 'rgba(' + gl.c + ',' + clamp(gl.a, 0, 1) + ')'); rg.addColorStop(1, 'rgba(' + gl.c + ',0)');
        ctx.fillStyle = rg; ctx.fillRect(x - gl.r, y - gl.r, gl.r * 2, gl.r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- update ----------
  let incAcc = 0, hudAcc = 0;
  function update(dt) {
    S.t = (S.t + dt * 24 / DAY_SEC) % 24;
    updateLighting();
    incAcc += dt; if (incAcc >= 1) { S.money += incPerMin / 60 * incAcc; incAcc = 0; }
    updateNpcs(dt);
    if (S.mode === 'drive' && S.drive) {
      updateDrive(dt);
      cam.x += (S.drive.x - cam.x) * Math.min(1, dt * 5); cam.y += (S.drive.y - cam.y) * Math.min(1, dt * 5);
      cam.zoom += (1.25 - cam.zoom) * Math.min(1, dt * 2);
    } else {
      const sp = 11 / cam.zoom * dt;
      if (keys.up) { cam.x -= sp; cam.y -= sp; } if (keys.down) { cam.x += sp; cam.y += sp; }
      if (keys.left) { cam.x -= sp; cam.y += sp; } if (keys.right) { cam.x += sp; cam.y -= sp; }
      cam.x = clamp(cam.x, 0, MAP); cam.y = clamp(cam.y, 0, MAP);
    }
    hudAcc += dt;
    if (hudAcc > 0.15) {
      hudAcc = 0;
      $('money').textContent = fmt(S.money); $('pop').textContent = pop.toLocaleString('en-US'); $('rank').textContent = rankName();
      $('inc').textContent = '+' + fmt(incPerMin) + '/min';
      const hh = Math.floor(S.t), mm = Math.floor((S.t % 1) * 60);
      $('clock').textContent = (nightness > 0.5 ? '🌙 ' : '☀️ ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (S.drive) $('speed').textContent = Math.round(Math.abs(S.drive.v) * 26);
    }
    if (dirty && now - lastSave > 6) { save(); lastSave = now; }
  }

  // ---------- UI ----------
  const BAR = [['move', '✋', 'Move'], ['road', '🛣️', 'Road'], ['homes', '🏠', 'Homes'], ['city', '🏙️', 'City'], ['bull', '🧹', 'Demolish'], ['cars', '🚗', 'Cars']];
  function refreshBar() {
    for (const b of $('bar').children) b.classList.toggle('on', b.dataset.id === S.cat);
  }
  function buildBar() {
    const bar = $('bar'); bar.innerHTML = '';
    for (const [id, ic, label] of BAR) {
      const bt = document.createElement('button'); bt.className = 'tb'; bt.dataset.id = id;
      bt.innerHTML = '<span>' + ic + '</span><small>' + label + '</small>'; bt.onclick = () => setTool(id); bar.appendChild(bt);
    }
    refreshBar();
  }
  function buildTray(cat) {
    const tray = $('tray'); tray.innerHTML = '';
    for (const k in DEFS) {
      const d = DEFS[k]; if (d.cat !== cat) continue;
      const bt = document.createElement('button'); bt.className = 'item' + (S.toolType === k ? ' on' : ''); bt.dataset.k = k;
      bt.innerHTML = '<span class="ic">' + d.icon + '</span><b>' + d.name + '</b><small>' + fmt(d.cost) + (d.inc ? ' · +' + fmt(d.inc) + '/min' : '') + '</small>';
      bt.onclick = () => { S.toolType = k; S.tool = 'build'; pending = null; hideConfirm(); buildTray(cat); };
      tray.appendChild(bt);
    }
    tray.hidden = false;
  }
  function setTool(id) {
    pending = null; hideConfirm();
    if (id === 'cars') { openCars(); return; }
    S.cat = id;
    if (id === 'homes' || id === 'city') {
      S.tool = 'build';
      if (!S.toolType || DEFS[S.toolType].cat !== id) S.toolType = id === 'homes' ? 'cottage' : 'shop';
      buildTray(id);
    } else { S.tool = id; $('tray').hidden = true; }
    refreshBar();
  }
  function showConfirm() {
    const d = DEFS[S.toolType]; $('conftxt').textContent = d.name + ' · ' + fmt(d.cost); $('confirm').hidden = false;
  }
  function hideConfirm() { $('confirm').hidden = true; }

  // cars panel
  let carPanelOpen = false, carTab = 'mine', previews = [];
  function openCars() { carPanelOpen = true; $('panel').hidden = false; renderCars(); }
  function closeCars() { carPanelOpen = false; $('panel').hidden = true; previews = []; }
  function renderCars() {
    previews = [];
    const box = $('plist'); box.innerHTML = '';
    $('tabMine').classList.toggle('on', carTab === 'mine'); $('tabShop').classList.toggle('on', carTab === 'shop');
    $('pcash').textContent = fmt(S.money);
    if (carTab === 'mine') {
      S.cars.forEach((c, i) => {
        const m = CARS[c.m], card = document.createElement('div'); card.className = 'card';
        const cvp = document.createElement('canvas'); cvp.className = 'pv'; card.appendChild(cvp);
        previews.push({ cv: cvp, m: c.m, car: c });
        const info = document.createElement('div'); info.className = 'info';
        info.innerHTML = '<b>' + m.name + '</b><small>' + m.tag + ' · top ' + Math.round(m.max * 26) + ' km/h</small>';
        const sw = document.createElement('div'); sw.className = 'sw';
        m.colors.forEach(col => {
          const s = document.createElement('button'); s.className = 'swb' + (c.color === col ? ' on' : ''); s.style.background = col;
          s.onclick = () => { c.color = col; markDirty(); renderCars(); }; sw.appendChild(s);
        });
        info.appendChild(sw);
        const drive = document.createElement('button'); drive.className = 'go'; drive.textContent = '🏁 Drive';
        drive.onclick = () => startDrive(i); info.appendChild(drive);
        card.appendChild(info); box.appendChild(card);
      });
    } else {
      for (const k in CARS) {
        const m = CARS[k]; if (!m.price) continue;
        const own = S.cars.some(c => c.m === k);
        const card = document.createElement('div'); card.className = 'card';
        const cvp = document.createElement('canvas'); cvp.className = 'pv'; card.appendChild(cvp);
        previews.push({ cv: cvp, m: k, car: { color: m.colors[0] } });
        const info = document.createElement('div'); info.className = 'info';
        info.innerHTML = '<b>' + m.name + '</b><small>' + m.tag + ' · top ' + Math.round(m.max * 26) + ' km/h</small><small class="price">' + fmt(m.price) + '</small>';
        const bt = document.createElement('button'); bt.className = 'go' + (own ? ' dis' : '');
        bt.textContent = own ? '✔ Owned' : 'Buy';
        if (!own) bt.onclick = () => {
          if (S.money < m.price) { toast('Not enough cash — build more income!'); return; }
          S.money -= m.price; S.cars.push({ m: k, color: m.colors[0] }); markDirty(); save(); toast('You bought the ' + m.name + '!'); renderCars();
        };
        info.appendChild(bt); card.appendChild(info); box.appendChild(card);
      }
    }
    for (const p of previews) { p.cv.width = 180 * DPR; p.cv.height = 110 * DPR; }
  }
  function drawPreviews(t) {
    for (const p of previews) {
      const c = p.cv, x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0);
      const bg = x.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, '#2a3a52'); bg.addColorStop(1, '#141c2b');
      x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
      g = x; x.setTransform(3.1 * DPR, 0, 0, 3.1 * DPR, c.width / 2, c.height * 0.64);
      ell(0, 0, 0, 0.8, 'rgba(255,255,255,.07)');
      drawCar({ x: 0, y: 0, a: t * 0.5 + 0.35, m: p.m, color: p.car.color, brake: 0 }, true);
      g = ctx;
    }
  }

  // ---------- input ----------
  const ptrs = new Map();
  let painting = false, lastTile = null, pinch = null, dragMoved = false;
  function applyPaint(t) {
    if (!t) return;
    const f = S.tool === 'road' ? paintRoad : bulldoze;
    if (lastTile) lineTiles(lastTile.x, lastTile.y, t.x, t.y, f); else f(t.x, t.y);
    lastTile = t;
  }
  cv.addEventListener('pointerdown', e => {
    if (S.mode === 'drive') return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; painting = false; return;
    }
    dragMoved = false;
    const t = tileAt(e.clientX, e.clientY); hoverT = t;
    if (S.tool === 'road' || S.tool === 'bull') { painting = true; lastTile = null; applyPaint(t); }
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { hoverT = tileAt(e.clientX, e.clientY); return; }
    if (pinch && ptrs.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.zoom = clamp(pinch.z * d / (pinch.d || 1), 0.45, 2.4); panByScreen(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my; return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    hoverT = tileAt(e.clientX, e.clientY);
    if (painting) { applyPaint(hoverT); return; }
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) dragMoved = true;
    if (dragMoved) panByScreen(dx, dy);
  });
  function endPtr(e) {
    const p = ptrs.get(e.pointerId); if (!p) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; dragMoved = true; return; }
    if (painting) { painting = false; lastTile = null; return; }
    if (e.type === 'pointercancel' || dragMoved) return;
    const t = tileAt(e.clientX, e.clientY);
    if (S.tool === 'build' && S.toolType) {
      const a = anchorFor(S.toolType, t);
      if (e.pointerType === 'mouse') { placeBuilding(S.toolType, a.x, a.y); }
      else { pending = t; if (canPlace(S.toolType, a.x, a.y)) showConfirm(); else { hideConfirm(); toast('Not enough space there'); } }
    } else if (S.tool === 'move' && inb(t.x, t.y)) {
      const o = S.occ[idx(t.x, t.y)];
      if (o) {
        const b = S.blds.get(o), d = DEFS[b.type];
        toast(d.name + (d.inc ? ' · +' + fmt(b.rate || 0) + '/min' + (b.acc ? '' : ' · ⚠ needs a road next to it') + (b.bonus ? ' · +' + Math.round(b.bonus * 100) + '% greenery' : '') : ''));
      }
    }
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hoverT = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (S.mode === 'drive') return; cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.45, 2.4); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  const KMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'down' };
  addEventListener('keydown', e => {
    const k = KMAP[e.key]; if (k) { keys[k] = 1; if (S.mode === 'drive' || e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); }
    if (e.key === 'Escape') { if (S.mode === 'drive') stopDrive(); else { closeCars(); pending = null; hideConfirm(); } }
  });
  addEventListener('keyup', e => { const k = KMAP[e.key]; if (k) keys[k] = 0; });
  addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = 0; });
  function holdBtn(id, k) {
    const el = $(id);
    const on = e => { e.preventDefault(); tc[k] = 1; el.classList.add('down'); };
    const off = e => { e.preventDefault(); tc[k] = 0; el.classList.remove('down'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  }
  holdBtn('bLeft', 'left'); holdBtn('bRight', 'right'); holdBtn('bGas', 'up'); holdBtn('bBrake', 'down');

  // ---------- install / menu ----------
  let deferredInstall = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('btnInstall').hidden = false; });
  addEventListener('appinstalled', () => { $('btnInstall').hidden = true; toast('Installed! Open it from your home screen.'); });
  $('btnInstall').onclick = () => {
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('btnInstall').hidden = true; }
    else toast('Tap Share → Add to Home Screen');
  };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) $('btnInstall').hidden = false;
  $('btnSound').onclick = () => { muted = !muted; $('btnSound').textContent = muted ? '🔇' : '🔊'; if (!muted && S.mode === 'drive') audioStart(); audioUpdate(0, 0); };
  $('btnReset').onclick = () => { if (confirm('Start a brand new city? Your current city will be erased.')) { if (S.drive) stopDrive(); newCity(); save(); toast('New city started'); } };
  $('btnPark').onclick = () => { stopDrive(); };
  $('tabMine').onclick = () => { carTab = 'mine'; renderCars(); };
  $('tabShop').onclick = () => { carTab = 'shop'; renderCars(); };
  $('pclose').onclick = closeCars;
  $('btnPlace').onclick = () => {
    if (!pending || !S.toolType) return;
    const a = anchorFor(S.toolType, pending);
    if (placeBuilding(S.toolType, a.x, a.y)) { pending = null; hideConfirm(); }
  };
  $('btnCancel').onclick = () => { pending = null; hideConfirm(); };
  addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', save);

  // ---------- boot ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  addEventListener('resize', resize);
  resize(); mkGrass(); buildBar();
  if (!load()) newCity();
  cam.zoom = W < 700 ? 0.8 : 1;
  recalc(); setTool('move');
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; now = ts / 1000;
    update(dt); draw();
    if (carPanelOpen) drawPreviews(now);
  }
  requestAnimationFrame(frame);
  window.__city = { S, DEFS, CARS, placeBuilding, startDrive, stopDrive, update, draw, openCars, renderCars, drawPreviews, newCity, keys };
})();
