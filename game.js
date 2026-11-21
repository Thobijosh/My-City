'use strict';
/* My City — mayor mode. Zone, build, balance the budget, and drive exotic cars. */
(function () {
  const G = GFX, E = G.E, P = G.P, PXf = G.PXf, PYf = G.PYf, hash2 = G.hash2, clamp = G.clamp, lerp = G.lerp;
  const MAP = 48, DAY_SEC = 300, MONTH_SEC = 20, SAVE_KEY = 'mycity-save-v3', OLD_KEY = 'mycity-save-v2';
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d');
  let W = 800, H = 600, DPR = 1;
  const cam = { x: 24, y: 24, zoom: 1 };
  let now = 0, nightness = 0, mulCol = 'rgb(255,255,255)';
  const fmt = n => { const a = Math.abs(n), sg = n < 0 ? '-$' : '$'; if (a >= 1e12) return sg + (a / 1e12).toFixed(3) + 'T'; if (a >= 1e9) return sg + (a / 1e9).toFixed(2) + 'B'; if (a >= 1e7) return sg + (a / 1e6).toFixed(1) + 'M'; return sg + Math.floor(a).toLocaleString('en-US'); };
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
    brown: { name: 'Brownstone Row', icon: '🏘️', cat: 'homes', w: 2, d: 2, cost: 260000, inc: 9000, pop: 20, cons: 4, kind: 'brown', sub: 'NYC style' },
    apartment: { name: 'Apartments', icon: '🏢', cat: 'homes', w: 2, d: 2, cost: 45000, inc: 3200, pop: 36, cons: 6, kind: 'apartment' },
    highrise: { name: 'Residential High-Rise', icon: '🏬', cat: 'homes', w: 2, d: 2, cost: 3200000, inc: 120000, pop: 150, cons: 14, kind: 'highrise' },
    marinaT: { name: 'Waterfront Condo Tower', icon: '🌆', cat: 'homes', w: 2, d: 2, cost: 6500000, inc: 260000, pop: 200, cons: 18, kind: 'marinaT' },
    villa: { name: 'Modern Villa', icon: '🏖️', cat: 'homes', w: 3, d: 3, cost: 38000, inc: 2600, pop: 6, cons: 3, kind: 'villa' },
    mansion: { name: 'Mansion', icon: '🏰', cat: 'homes', w: 4, d: 4, cost: 120000, inc: 9500, pop: 8, cons: 5, kind: 'mansion' },
    tower: { name: 'Luxury Tower', icon: '🏙️', cat: 'homes', w: 3, d: 3, cost: 320000, inc: 30000, pop: 120, cons: 16, kind: 'tower', beacon: [1.5, 1.5, 12.3] },
    glassTower: { name: 'Glass Skyscraper', icon: '🏙️', cat: 'sky', w: 3, d: 3, cost: 180000000, inc: 2600000, pop: 600, jobs: 400, cons: 40, kind: 'glassTower', beacon: [1.5, 1.5, 12.0] },
    egg: { name: 'Egg Tower', icon: '🥚', cat: 'sky', w: 3, d: 3, cost: 260000000, inc: 3500000, pop: 500, jobs: 300, cons: 34, kind: 'egg' },
    twisted: { name: 'Twisted Tower', icon: '🌀', cat: 'sky', w: 3, d: 3, cost: 350000000, inc: 4600000, pop: 700, jobs: 350, cons: 44, kind: 'twisted', beacon: [1.5, 1.5, 10.2] },
    twin: { name: 'Twin Towers', icon: '🏢', cat: 'sky', w: 4, d: 4, cost: 420000000, inc: 6000000, pop: 1400, jobs: 900, cons: 80, kind: 'twin', beacon: [2, 2, 11] },
    needle: { name: 'Needle Tower', icon: '🗼', cat: 'sky', w: 3, d: 3, cost: 900000000, inc: 11000000, pop: 900, jobs: 700, cons: 70, kind: 'needle', beacon: [1.5, 1.5, 12.4] },
    mayor: { name: "Mayor's Penthouse", icon: '👑', cat: 'sky', w: 3, d: 3, cost: 2500000000, pop: 12, cons: 6, kind: 'mayor', sub: 'Your home', beacon: [1.5, 1.5, 7.2] },
    coal: { name: 'Coal Power Plant', icon: '🏭', cat: 'utils', w: 3, d: 3, cost: 38000, upkeep: 520, ucat: 'power', supply: 'power', cap: 140, poll: 8, kind: 'coal', jobs: 14, sub: '⚡140 · pollutes' },
    solar: { name: 'Solar Farm', icon: '☀️', cat: 'utils', w: 3, d: 3, cost: 22000, upkeep: 140, ucat: 'power', supply: 'power', cap: 45, kind: 'solar', jobs: 3, sub: '⚡45 · clean' },
    water: { name: 'Water Tower', icon: '💧', cat: 'utils', w: 1, d: 1, cost: 9000, upkeep: 160, ucat: 'water', supply: 'water', cap: 110, kind: 'water', jobs: 2, sub: '💧110' },
    police: { name: 'Police Station', icon: '🚓', cat: 'serv', w: 2, d: 2, cost: 14000, upkeep: 650, ucat: 'police', cov: 'police', r: 9, cons: 2, kind: 'police', jobs: 8 },
    fire: { name: 'Fire Station', icon: '🚒', cat: 'serv', w: 2, d: 2, cost: 14000, upkeep: 650, ucat: 'fire', cov: 'fire', r: 9, cons: 2, kind: 'fire', jobs: 8 },
    clinic: { name: 'Clinic', icon: '🏥', cat: 'serv', w: 2, d: 2, cost: 20000, upkeep: 800, ucat: 'health', cov: 'health', r: 10, cons: 2, kind: 'clinic', jobs: 12 },
    school: { name: 'School', icon: '🏫', cat: 'serv', w: 3, d: 3, cost: 24000, upkeep: 700, ucat: 'edu', cov: 'edu', r: 10, cons: 2, kind: 'school', jobs: 14 },
    library: { name: 'Library', icon: '📚', cat: 'serv', w: 2, d: 2, cost: 3000000, upkeep: 30000, ucat: 'edu', cov: 'edu', r: 9, cons: 2, kind: 'library', jobs: 10 },
    park: { name: 'Park', icon: '🌳', cat: 'serv', w: 2, d: 2, cost: 4000, upkeep: 60, ucat: 'park', cov: 'park', r: 6, kind: 'park' },
    stadium: { name: 'Stadium', icon: '🏟️', cat: 'fun', w: 4, d: 4, cost: 75000000, inc: 900000, upkeep: 400000, ucat: 'park', cov: 'fun', r: 14, cons: 20, jobs: 150, kind: 'stadium', sub: 'Match days!' },
    mall: { name: 'Shopping Mall', icon: '🛍️', cat: 'fun', w: 3, d: 3, cost: 28000000, inc: 600000, upkeep: 90000, ucat: 'park', cov: 'fun', r: 10, cons: 14, jobs: 120, kind: 'mall' },
    cinema: { name: 'Cinema', icon: '🎬', cat: 'fun', w: 2, d: 2, cost: 6000000, inc: 80000, upkeep: 20000, ucat: 'park', cov: 'fun', r: 9, cons: 4, jobs: 25, kind: 'cinema' },
    hotel: { name: 'Luxury Hotel', icon: '🏨', cat: 'fun', w: 2, d: 2, cost: 40000000, inc: 700000, upkeep: 80000, ucat: 'park', cov: 'fun', r: 8, cons: 12, jobs: 90, kind: 'hotel' },
    ferris: { name: 'Ferris Wheel', icon: '🎡', cat: 'fun', w: 3, d: 3, cost: 15000000, inc: 200000, upkeep: 40000, ucat: 'park', cov: 'fun', r: 11, cons: 6, jobs: 20, kind: 'ferris' },
    golf: { name: 'Golf Course', icon: '⛳', cat: 'fun', w: 4, d: 4, cost: 25000000, inc: 300000, upkeep: 50000, ucat: 'park', cov: 'fun', r: 9, jobs: 30, kind: 'golf' },
    marina: { name: 'Marina & Yachts', icon: '⛵', cat: 'fun', w: 3, d: 3, cost: 18000000, inc: 250000, upkeep: 30000, ucat: 'park', cov: 'fun', r: 10, jobs: 25, kind: 'marina' },
    pool: { name: 'Public Pool', icon: '🏊', cat: 'fun', w: 2, d: 2, cost: 1200000, upkeep: 15000, ucat: 'park', cov: 'fun', r: 6, cons: 2, jobs: 8, kind: 'pool' },
    market: { name: 'Street Market', icon: '🧺', cat: 'fun', w: 2, d: 2, cost: 800000, inc: 20000, upkeep: 6000, ucat: 'park', cov: 'fun', r: 6, jobs: 12, kind: 'market' },
    mosque: { name: 'Mosque', icon: '🕌', cat: 'fun', w: 2, d: 2, cost: 2000000, upkeep: 10000, ucat: 'park', cov: 'fun', r: 7, jobs: 5, kind: 'mosque' },
    church: { name: 'Church', icon: '⛪', cat: 'fun', w: 2, d: 2, cost: 2000000, upkeep: 10000, ucat: 'park', cov: 'fun', r: 7, jobs: 5, kind: 'church' },
    obelisk: { name: 'Monument', icon: '🗿', cat: 'fun', w: 1, d: 1, cost: 500000, cov: 'fun', r: 4, kind: 'obelisk' },
    garage: { name: 'Garage', icon: '🅿️', cat: 'extras', w: 2, d: 2, cost: 6000, kind: 'garage' },
    tree: { name: 'Tree', icon: '🌲', cat: 'extras', w: 1, d: 1, cost: 100, kind: 'tree' },
    fountain: { name: 'Fountain', icon: '⛲', cat: 'extras', w: 1, d: 1, cost: 600, kind: 'fountain' },
    zr: { name: 'Residential', icon: '🏘️', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zr' },
    zc: { name: 'Commercial', icon: '🏬', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zc' },
    zi: { name: 'Industrial', icon: '🏭', cat: 'zone', w: 1, d: 1, cost: 0, kind: 'zi' }
  };
  const PC = { police: 700, fire: 900, clinic: 350, school: 500, library: 400, park: 600, stadium: 5000, mall: 2500, cinema: 800, hotel: 600, ferris: 1500, golf: 600, marina: 1200, pool: 500, market: 500, mosque: 700, church: 700, obelisk: 300 };
  for (const k in PC) DEFS[k].pc = PC[k];
  const mk = (name, price, max, acc, L, W, bh, ch, cab, cwb, cwt, colors, tag, extra) => Object.assign({ name, price, max, acc, brake: 7 + max * 0.3, L, W, bh, ch, cab, cwb, cwt, colors, tag }, extra || {});
  const CARS = {
    hatch: { name: 'City Hatch', price: 0, max: 4.6, acc: 3.2, brake: 6, L: 0.56, W: 0.3, bh: 0.17, ch: 0.13, cab: [-0.27, 0.1, -0.18, -0.02], cwb: 0.44, cwt: 0.34, colors: ['#2f6fed', '#e5e7eb', '#dc2626', '#f59e0b', '#16a34a', '#111827'], tag: 'Starter' },
    camry: mk('Toyota Camry', 0, 5.4, 3.6, 0.7, 0.33, 0.16, 0.13, [-0.27, 0.12, -0.2, -0.04], 0.44, 0.36, ['#e5e7eb', '#111827', '#7f1d1d', '#1e3a8a', '#9ca3af', '#f8fafc'], 'Sedan'),
    gwagon: mk('Mercedes G-Wagon', 0, 7.2, 4.4, 0.68, 0.37, 0.27, 0.19, [-0.35, 0.2, -0.33, 0.14], 0.47, 0.44, ['#111827', '#e5e7eb', '#1f3a2c', '#6b7280', '#7c2d12', '#0b3d91'], 'Luxury SUV'),
    zephyr: { name: 'Zephyr S Roadster', price: 35000, max: 7, acc: 4.5, brake: 7, L: 0.62, W: 0.32, bh: 0.15, ch: 0.09, cab: [-0.2, 0.05, -0.12, -0.02], cwb: 0.4, cwt: 0.3, colors: ['#e11d48', '#facc15', '#0ea5e9', '#f8fafc', '#7c3aed', '#111827'], tag: 'Roadster' },
    titan: { name: 'Titan SUV', price: 80000, max: 6.2, acc: 3.6, brake: 6.5, L: 0.68, W: 0.36, bh: 0.24, ch: 0.17, cab: [-0.33, 0.14, -0.28, 0.0], cwb: 0.44, cwt: 0.38, colors: ['#111827', '#e5e7eb', '#166534', '#7f1d1d', '#1e3a8a', '#92400e'], tag: 'SUV' },
    tesla: mk('Tesla Model S', 95000, 8.4, 6.2, 0.72, 0.34, 0.15, 0.12, [-0.25, 0.14, -0.15, 0.0], 0.42, 0.33, ['#f8fafc', '#111827', '#b91c1c', '#1e3a8a', '#6b7280', '#065f46'], 'Electric'),
    rangerover: mk('Range Rover', 120000, 7.6, 4.8, 0.7, 0.37, 0.25, 0.17, [-0.34, 0.18, -0.28, 0.1], 0.46, 0.4, ['#111827', '#f8fafc', '#14532d', '#4b5563', '#1e3a8a', '#78350f'], 'Luxury SUV'),
    porsche: mk('Porsche 911', 140000, 9.4, 6.6, 0.64, 0.34, 0.13, 0.09, [-0.2, 0.08, -0.12, 0.0], 0.4, 0.3, ['#facc15', '#dc2626', '#111827', '#f8fafc', '#0ea5e9', '#16a34a'], 'Sports car', { spoiler: 1 }),
    vortex: { name: 'Vortex GT', price: 120000, max: 8.6, acc: 5.5, brake: 8, L: 0.7, W: 0.35, bh: 0.14, ch: 0.09, cab: [-0.18, 0.1, -0.08, 0.0], cwb: 0.4, cwt: 0.3, spoiler: 1, colors: ['#f97316', '#2563eb', '#f8fafc', '#111827', '#dc2626', '#84cc16'], tag: 'Grand tourer' },
    urus: mk('Lamborghini Urus', 230000, 9.6, 6.4, 0.72, 0.38, 0.22, 0.14, [-0.34, 0.12, -0.28, 0.02], 0.46, 0.38, ['#facc15', '#111827', '#f97316', '#f8fafc', '#16a34a', '#7c3aed'], 'Super SUV'),
    stallion: { name: 'Stallion V12', price: 250000, max: 9.8, acc: 6.5, brake: 9, L: 0.74, W: 0.36, bh: 0.13, ch: 0.08, cab: [-0.14, 0.12, -0.06, 0.02], cwb: 0.38, cwt: 0.28, spoiler: 1, colors: ['#facc15', '#dc2626', '#0f172a', '#e2e8f0', '#059669', '#a855f7'], tag: 'Supercar' },
    lambo: mk('Lamborghini Huracán', 290000, 10.4, 7.2, 0.74, 0.38, 0.12, 0.08, [-0.14, 0.12, -0.06, 0.02], 0.38, 0.27, ['#84cc16', '#f97316', '#facc15', '#111827', '#dc2626', '#a855f7'], 'Supercar', { spoiler: 1 }),
    ferrari: mk('Ferrari 488', 330000, 10.6, 7.4, 0.74, 0.37, 0.12, 0.08, [-0.14, 0.1, -0.06, 0.02], 0.38, 0.27, ['#dc2626', '#facc15', '#111827', '#f8fafc', '#1e3a8a', '#b91c1c'], 'Supercar', { spoiler: 1 }),
    rolls: mk('Rolls-Royce Phantom', 450000, 7.4, 4.6, 0.86, 0.38, 0.19, 0.15, [-0.3, 0.14, -0.22, 0.04], 0.45, 0.38, ['#0f172a', '#f8fafc', '#7f1d1d', '#4b5563', '#1e3a8a', '#d4a017'], 'Ultra luxury'),
    phantom: { name: 'Phantom Aero', price: 650000, max: 11.5, acc: 8, brake: 10, L: 0.78, W: 0.38, bh: 0.115, ch: 0.075, cab: [-0.12, 0.1, -0.05, 0.03], cwb: 0.36, cwt: 0.26, spoiler: 2, colors: ['#0f172a', '#f8fafc', '#b91c1c', '#0369a1', '#d4a017', '#7e22ce'], tag: 'Hypercar' },
    mclaren: mk('McLaren P1', 1300000, 12, 8.6, 0.76, 0.38, 0.11, 0.075, [-0.12, 0.1, -0.05, 0.03], 0.36, 0.26, ['#f97316', '#111827', '#f8fafc', '#2563eb', '#84cc16', '#dc2626'], 'Hypercar', { spoiler: 2 }),
    bugatti: mk('Bugatti Chiron', 3000000, 13, 9.2, 0.78, 0.39, 0.115, 0.075, [-0.13, 0.1, -0.06, 0.03], 0.37, 0.27, ['#1e3a8a', '#111827', '#f8fafc', '#b91c1c', '#d4a017', '#0f766e'], 'Hypercar', { spoiler: 2 }),
    pickup: mk('Toyota Hilux', 45000, 6, 3.6, 0.78, 0.36, 0.22, 0.15, [-0.12, 0.1, -0.06, 0.04], 0.44, 0.4, ['#e5e7eb', '#111827', '#9a3412', '#1e3a8a', '#4b5563', '#166534'], 'Pickup'),
    danfo: mk('Danfo Bus', 0, 4, 2.6, 0.84, 0.36, 0.27, 0.2, [-0.42, 0.42, -0.4, 0.4], 0.46, 0.44, ['#facc15'], 'City bus'),
    keke: mk('Keke Tricycle', 0, 3.4, 2.8, 0.44, 0.26, 0.15, 0.14, [-0.3, 0.2, -0.26, 0.12], 0.42, 0.4, ['#16a34a', '#facc15'], 'Tricycle')
  };
  const NPC_MODELS = ['hatch', 'hatch', 'camry', 'camry', 'gwagon', 'tesla', 'danfo', 'keke', 'keke', 'pickup', 'rangerover', 'porsche', 'titan'];
  const NPC_COLORS = ['#e5e7eb', '#9ca3af', '#2563eb', '#dc2626', '#fbbf24', '#10b981', '#111827', '#f97316'];
  const RANKS = [{ n: 'Hamlet', p: 0 }, { n: 'Village', p: 60 }, { n: 'Town', p: 250 }, { n: 'City', p: 900 }, { n: 'Metropolis', p: 3000 }, { n: 'Megacity', p: 8000 }];

  // ---------- state ----------
  const TER = G.terrain(MAP);
  const S = {
    money: 1e12, t: 8, month: 0, tmode: 0, rot: 0, fp: false, odo: 0, photos: 0, tasks: [], wx: 'auto', rain: 0, nitroT: 0, nitroCD: 0, fw: 0, tid: 1, name: 'New Haven', tax: 9, nextId: 1, speed: 1,
    road: new Uint8Array(N), zone: new Uint8Array(N), occ: new Int32Array(N), water: TER.water, scen: new Map(), blds: new Map(),
    cars: [{ m: 'gwagon', color: '#111827' }, { m: 'camry', color: '#e5e7eb' }], mode: 'build', tool: 'move', toolType: null, zoneType: 1, cat: 'move', drive: null, rank: 0
  };
  const ST = { pop: 0, jobsC: 0, jobsI: 0, jobs: 0, dem: [0.3, 0.2, 0.2], appr: 50, apprT: 50, rP: 1, rW: 1, supP: 0, demP: 0, supW: 0, demW: 0, inc: { r: 0, c: 0, i: 0, l: 0 }, exp: { police: 0, fire: 0, health: 0, edu: 0, power: 0, water: 0, park: 0, road: 0 }, incT: 0, expT: 0, net: 0, cov: { police: 0, fire: 0, health: 0, edu: 0, park: 0, fun: 0, poll: 0 }, issues: [], unpow: 0, noroad: 0 };
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
    const cov = { police: new Uint8Array(N), fire: new Uint8Array(N), health: new Uint8Array(N), edu: new Uint8Array(N), park: new Uint8Array(N), fun: new Uint8Array(N) }, poll = new Uint8Array(N), green = new Uint8Array(N);
    const exp = { police: 0, fire: 0, health: 0, edu: 0, power: 0, water: 0, park: 0, road: roadList.length * 1.5 };
    let supP = 0, supW = 0, hasPlant = false; const capS = {};
    for (const b of S.blds.values()) {
      const d = dOf(b);
      if (d.supply === 'power') { supP += d.cap; hasPlant = true; } if (d.supply === 'water') supW += d.cap;
      if (d.upkeep) exp[d.ucat] += d.upkeep;
      if (d.pc) capS[d.cov] = (capS[d.cov] || 0) + d.pc;
      if (d.poll) stamp(poll, b, d, d.poll);
      if (b.type === 'zi') stamp(poll, b, d, 1 + b.lvl);
      if (b.type === 'tree' || b.type === 'fountain') stamp(green, b, d, 3, true);
    }
    let popAll = 0, demP = 0, demW = 0, pop = 0, jobsC = 0, jobsI = 0, jobsPub = 0, unpow = 0, noroad = 0;
    for (const b of S.blds.values()) {
      const d = dOf(b), s = bstats(b); b.s = s; popAll += s.pop;
      b.road = nearXY(S.road, b.x, b.y, d.w, d.d, 2); b.pw = true; b.wt = true;
      if (s.cons && b.road) { if (b.pw) demP += s.cons; if (b.wt) demW += s.cons; }
    }
    const covF = {}; for (const k of ['police', 'fire', 'health', 'edu', 'park', 'fun']) covF[k] = popAll > 0 ? Math.min(1, (capS[k] || 0) / popAll) : (capS[k] ? 1 : 0);
    const rP = demP > 0 ? Math.min(1, supP / demP) : 1, rW = demW > 0 ? Math.min(1, supW / demW) : 1;
    let wPop = 0, cP = 0, cF = 0, cH = 0, cE = 0, cK = 0, cU = 0, cPoll = 0;
    const inc = { r: 0, c: 0, i: 0, l: 0 }, k = S.tax / 9, ap = 0.6 + 0.4 * ST.appr / 100;
    for (const b of S.blds.values()) {
      const d = dOf(b), s = b.s; b.op = b.road && b.pw && b.wt;
      b.eff = s.cons ? (b.op ? Math.min(rP, rW) : (b.road ? 0.25 : 0.1)) : 1;
      if (s.cons && !b.op) { if (b.road) unpow++; else noroad++; }
      const ci = idx(clamp(b.x + (d.w >> 1), 0, MAP - 1), clamp(b.y + (d.d >> 1), 0, MAP - 1));
      b.lv = clamp(40 + 9 * covF.police + 9 * covF.fire + 11 * covF.health + 11 * covF.edu + 13 * covF.park + 9 * covF.fun + Math.min(12, green[ci] * 3) - 28 * poll[ci], 0, 100);
      if (s.pop) { const p = Math.round(s.pop * (b.op ? 1 : 0.4)); b.popNow = p; pop += p; wPop += p; cP += p * covF.police; cF += p * covF.fire; cH += p * covF.health; cE += p * covF.edu; cK += p * covF.park; cU += p * covF.fun; cPoll += p * poll[ci]; }
      const jobs = s.jobs * (b.op ? 1 : 0.3); b.jobsNow = jobs;
      if (s.kind === 'c') jobsC += jobs; else if (s.kind === 'i') jobsI += jobs; else if (s.jobs) jobsPub += jobs;
      if (s.kind === 'r') inc.r += s.pop * 28 * k * b.eff * ap; else if (s.kind === 'c') inc.c += jobs * 36 * k * b.eff * ap; else if (s.kind === 'i') inc.i += jobs * 32 * k * b.eff * ap; else if (s.kind === 'l') inc.l += s.lux * k * b.eff;
    }
    const f = v => wPop > 0 ? v / wPop : 0;
    ST.cov = { police: f(cP), fire: f(cF), health: f(cH), edu: f(cE), park: f(cK), fun: f(cU), poll: f(cPoll) > 0 ? Math.min(1, f(cPoll)) : 0 };
    const jobs = jobsC + jobsI + jobsPub, workers = pop * 0.55, unemp = workers > 0 ? Math.max(0, 1 - jobs / workers) : 0;
    Object.assign(ST, { pop, jobsC, jobsI, jobs, rP, rW, supP, demP, supW, demW, inc, exp, unpow, noroad, unemp });
    ST.incT = inc.r + inc.c + inc.i + inc.l; ST.expT = Object.values(exp).reduce((a, b) => a + b, 0); ST.net = ST.incT - ST.expT;
    const tx = S.tax - 9;
    ST.dem = [
      clamp(0.3 + (jobs - workers) / (jobs + workers + 40) * 1.4 + (ST.appr - 50) / 130 - tx * 0.035, -1, 1),
      clamp(0.15 + (pop * 0.3 - jobsC) / (pop * 0.3 + jobsC + 25) * 1.5 - tx * 0.03, -1, 1),
      clamp(0.2 + (pop * 0.28 - jobsI) / (pop * 0.28 + jobsI + 25) * 1.2 - tx * 0.03, -1, 1)];
    ST.apprT = clamp(50 - tx * 2.6 + 10 * ST.cov.police + 8 * ST.cov.fire + 8 * ST.cov.health + 6 * ST.cov.edu + 6 * ST.cov.park + 6 * ST.cov.fun - 22 * ST.cov.poll - 25 * (1 - rP) - 20 * (1 - rW) - 15 * unemp, 0, 100);
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
    if (pop > 150 && ST.cov.fun < 0.3) is.push('🎡 Citizens are bored. Build amenities (stadium, cinema, mall, ferris wheel) from the Amenities tab.');
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
  function tryConnect(starts) {
    // citizens lay a short road from a new home/shop to the nearest existing road
    const pass = (x, y) => inb(x, y) && !S.road[idx(x, y)] && !S.occ[idx(x, y)] && !S.water[idx(x, y)];
    const prev = new Map(), q = [];
    for (const [x, y] of starts) if (pass(x, y)) { prev.set(idx(x, y), -1); q.push([x, y, 0]); }
    for (let h = 0; h < q.length; h++) {
      const [x, y, dd] = q[h];
      if (D4.some(([dx, dy]) => isRoad(x + dx, y + dy))) {
        const path = []; let c = idx(x, y); while (c !== -1) { path.push(c); c = prev.get(c); }
        if (S.money < path.length * 20) return false;
        for (const c2 of path) { S.money -= 20; S.road[c2] = 1; S.zone[c2] = 0; S.scen.delete(c2); }
        return true;
      }
      if (dd >= 8) continue;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (pass(nx, ny) && !prev.has(idx(nx, ny))) { prev.set(idx(nx, ny), idx(x, y)); q.push([nx, ny, dd + 1]); } }
    }
    return false;
  }
  let roadToastT = -99;
  function growStep() {
    if (!zoneList.length) return;
    const gate = ST.rP >= 0.9 && ST.rW >= 0.9 && S.money > -5000;
    let changed = false;
    for (let n = 0; n < 4; n++) {
      const i = zoneList[(Math.random() * zoneList.length) | 0], z = S.zone[i], x = i % MAP, y = (i / MAP) | 0, o = S.occ[i], dem = ST.dem[z - 1];
      if (!o) {
        if (S.water[i]) continue;
        if (!nearXY(S.road, x, y, 1, 1, 2) && dem > 0.1 && Math.random() < 0.5 && tryConnect([[x, y]])) { changed = true; if (now - roadToastT > 30) { roadToastT = now; toast('🛣️ Citizens built a new road to connect their homes'); } continue; }
        if (!gate) continue;
        if (!nearXY(S.road, x, y, 1, 1, 2)) continue;
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
    // player-placed buildings with no road: residents link them up too
    if (Math.random() < 0.5) { const arr = [...S.blds.values()].filter(b => b.s && b.s.cons && !b.road && b.type[0] !== 'z'); if (arr.length) { const b = arr[(Math.random() * arr.length) | 0], d = dOf(b), st = []; for (let x = b.x - 1; x <= b.x + d.w; x++) { st.push([x, b.y - 1], [x, b.y + d.d]); } for (let y = b.y; y < b.y + d.d; y++) { st.push([b.x - 1, y], [b.x + d.w, y]); } if (tryConnect(st)) { changed = true; if (now - roadToastT > 30) { roadToastT = now; toast('🛣️ Citizens built a road to ' + d.name); } } } }
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
    moving = null; recalc(); markDirty(); return true;
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, money: S.money, t: S.t, month: S.month, name: S.name, tax: S.tax, nextId: S.nextId, rank: S.rank, roads, zones, bl, scen, cars: S.cars, tmode: S.tmode, rot: S.rot, fp: S.fp, odo: S.odo, photos: S.photos, tasks: S.tasks, tid: S.tid, wx: S.wx, decor: S.decor, hfl: S.hfl, hwl: S.hwl, hinit: S.hinit }));
      dirty = false;
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_KEY); if (!raw) return false;
      const d = JSON.parse(raw); if (!d || (d.v !== 2 && d.v !== 3)) return false;
      Object.assign(S, { money: d.money, t: d.t, month: d.month, name: d.name, tax: d.tax, nextId: d.nextId, rank: d.rank || 0, cars: d.cars && d.cars.length ? d.cars.filter(c => CARS[c.m]) : S.cars });
      if (d.v === 2) S.money = Math.max(S.money, 1e12);
      if (!S.cars.length) S.cars = [{ m: 'gwagon', color: '#111827' }];
      Object.assign(S, { tmode: d.tmode || 0, rot: d.rot || 0, fp: !!d.fp, odo: d.odo || 0, photos: d.photos || 0, tasks: d.tasks || [], tid: d.tid || 1, wx: d.wx || 'auto', decor: d.decor || [], hfl: d.hfl || 0, hwl: d.hwl || 0, hinit: !!d.hinit });
      S.road.fill(0); S.zone.fill(0); S.occ.fill(0); S.blds.clear(); S.scen.clear();
      for (const i of d.roads) S.road[i] = 1; for (const z of d.zones) S.zone[z >> 2] = z & 3; for (const s of d.scen) S.scen.set(s >> 3, s & 7);
      for (const [id, type, x, y, lvl, v] of d.bl) { if (!DEFS[type]) continue; const dd = DEFS[type]; S.blds.set(id, { id, type, x, y, lvl: lvl || 1, v: v || 0 }); for (let yy = y; yy < y + dd.d; yy++) for (let xx = x; xx < x + dd.w; xx++) S.occ[idx(xx, yy)] = id; }
      return true;
    } catch (e) { return false; }
  }
  function newCity() {
    S.road.fill(0); S.zone.fill(0); S.occ.fill(0); S.blds.clear(); S.scen.clear(); S.nextId = 1; S.money = 1e12; S.t = 8; S.month = 0; S.tax = 9; S.rank = 0; S.name = 'New Haven';
    S.cars = [{ m: 'gwagon', color: '#111827' }, { m: 'camry', color: '#e5e7eb' }]; S.tasks = []; S.tid = 1; S.odo = 0; S.photos = 0; S.fw = 0; S.decor = []; S.hinit = false; S.hfl = 0; S.hwl = 0;
    for (const [i, v] of G.scenery(MAP, S.water)) S.scen.set(i, v);
    for (let i = 16; i <= 32; i++) { S.road[idx(i, 16)] = 1; S.road[idx(i, 32)] = 1; S.road[idx(16, i)] = 1; S.road[idx(32, i)] = 1; }
    for (let i = 10; i <= 38; i++) { S.road[idx(i, 24)] = 1; S.road[idx(24, i)] = 1; }
    const zrect = (x0, y0, x1, y1, z) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!S.road[idx(x, y)]) S.zone[idx(x, y)] = z; };
    zrect(17, 17, 23, 23, 1); zrect(17, 25, 23, 31, 1); zrect(25, 17, 31, 23, 2); zrect(25, 25, 31, 31, 3);
    for (const k of [...S.scen.keys()]) { const x = k % MAP, y = (k / MAP) | 0; if (x >= 8 && x <= 40 && y >= 8 && y <= 40) S.scen.delete(k); }
    placeBuilding('coal', 33, 17, true); placeBuilding('water', 31, 20, true); placeBuilding('garage', 25, 13, true); placeBuilding('park', 21, 13, true); placeBuilding('mayor', 17, 13, true);
    recalc(); seedCity(); recalc(); ST.appr = ST.apprT; cam.x = 22; cam.y = 22; initTasks();
  }

  // ---------- lighting ----------
  const KEYS = [{ h: 0, mul: [75, 90, 155], n: 1 }, { h: 5, mul: [75, 90, 155], n: 1 }, { h: 6.5, mul: [255, 200, 165], n: 0.45 }, { h: 8, mul: [255, 252, 246], n: 0 }, { h: 17, mul: [255, 252, 246], n: 0 }, { h: 19, mul: [255, 178, 128], n: 0.4 }, { h: 20.5, mul: [95, 105, 175], n: 0.9 }, { h: 21.5, mul: [75, 90, 155], n: 1 }, { h: 24, mul: [75, 90, 155], n: 1 }];
  let mulA = [1, 1, 1];
  function updateLighting() {
    const h = S.t;
    for (let i = 0; i < KEYS.length - 1; i++) { const a = KEYS[i], b = KEYS[i + 1]; if (h >= a.h && h <= b.h) { const k = (h - a.h) / (b.h - a.h || 1); nightness = lerp(a.n, b.n, k); const m = [0, 1, 2].map(j => Math.round(lerp(a.mul[j], b.mul[j], k))); mulCol = 'rgb(' + m + ')'; mulA = m.map(v => v / 255); return; } }
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
  function horn() {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); if (muted) return; const t = AC.currentTime, g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); g.connect(AC.destination); for (const f of [392, 494]) { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.5); } } catch (e) { /* no audio */ }
  }
  function nitro() { if (!S.drive) return; if (S.nitroCD > 0 || S.nitroT > 0) { toast('Nitro recharging…'); return; } S.nitroT = 2.8; S.nitroCD = 9; }
  function offRoad(nx, ny, ox, oy) {
    const tx = Math.floor(nx), ty = Math.floor(ny); if (isRoad(tx, ty)) return false;
    // allow only the short driveway between a road and the garage/home
    return !(nearXY(S.road, tx, ty, 1, 1, 1) && (isRoad(Math.floor(ox), Math.floor(oy)) || nearXY(S.road, Math.floor(ox), Math.floor(oy), 1, 1, 1)) && nearGarage(tx, ty));
  }
  function nearGarage(x, y) { for (const b of S.blds.values()) if ((b.type === 'garage' || b.type === 'mayor') && x >= b.x - 1 && x <= b.x + dOf(b).w && y >= b.y - 1 && y <= b.y + dOf(b).d) return true; return false; }
  function carBlocked(c, L) { const ca = Math.cos(c.a), sa = Math.sin(c.a); for (const u of [0, L * 0.5, -L * 0.5]) if (solid(Math.floor(c.x + ca * u), Math.floor(c.y + sa * u))) return true; return false; }
  function updateDrive(dt) {
    const c = S.drive, m = CARS[S.cars[c.idx].m], nb = S.nitroT > 0 ? 1.45 : 1, up = keys.up || tc.up, dn = keys.down || tc.down, lf = keys.left || tc.left, rt = keys.right || tc.right;
    const onRoad = isRoad(Math.floor(c.x), Math.floor(c.y)), max = m.max * 0.75 * nb * (onRoad ? 1 : 0.55); c.brake = 0;
    if (up) c.v += m.acc * 0.7 * nb * dt * (c.v < 0 ? 2 : 1); else if (dn) { if (c.v > 0.15) { c.v -= m.brake * dt; c.brake = 1; } else c.v -= m.acc * 0.55 * dt; } else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.4 * dt);
    if (!onRoad) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.6 * dt);
    c.v = clamp(c.v, -max * 0.3, max);
    c.sv = (c.sv || 0) + (((rt ? 1 : 0) - (lf ? 1 : 0)) - (c.sv || 0)) * Math.min(1, dt * 4);
    c.a += c.sv * (1.7 / (1 + 0.32 * Math.abs(c.v))) * dt * clamp(c.v / 1.2, -1, 1);
    const nx = c.x + Math.cos(c.a) * c.v * dt, ny = c.y + Math.sin(c.a) * c.v * dt;
    if (carBlocked({ x: nx, y: ny, a: c.a }, m.L) || offRoad(nx, ny, c.x, c.y)) c.v = -c.v * 0.25; else { c.x = nx; c.y = ny; S.odo += Math.abs(c.v) * dt; }
    c.steer = c.sv;
    audioUpdate(Math.abs(c.v) / m.max, up ? 1 : 0);
  }
  function findSpawn() {
    const gs = []; for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    for (let i = gs.length - 1; i >= 0; i--) { const b = gs[i]; for (let y = b.y - 1; y <= b.y + 2; y += 3) for (let x = b.x - 1; x <= b.x + 2; x++) { if (isRoad(x, y)) return { x: x + 0.5, y: y + 0.5, a: isRoad(x, y + 1) || isRoad(x, y - 1) ? Math.PI / 2 : 0 }; } for (let x = b.x; x < b.x + 2; x++) { if (!solid(x, b.y + 2)) return { x: x + 0.5, y: b.y + 2.5, a: Math.PI / 2 }; } }
    let best = null, bd = 1e9; for (const i of roadList) { const x = i % MAP, y = (i / MAP) | 0, d = Math.hypot(x - 24, y - 24); if (d < bd) { bd = d; best = [x, y]; } }
    return best ? { x: best[0] + 0.5, y: best[1] + 0.5, a: 0 } : { x: 24.5, y: 24.5, a: 0 };
  }
  function startDrive(i) {
    const sp = findSpawn(); S.drive = { idx: i, x: sp.x, y: sp.y, a: sp.a, v: 0, brake: 0, steer: 0 }; document.body.classList.toggle('fp', S.fp); S.mode = 'drive'; pending = null; hideConfirm();
    document.body.classList.add('driving'); closePanels(); $('carname').textContent = CARS[S.cars[i].m].name; cam.x = sp.x; cam.y = sp.y; audioStart();
  }
  function stopDrive() { S.drive = null; document.body.classList.remove('fp'); S.nitroT = 0; S.mode = 'build'; document.body.classList.remove('driving'); keys.up = keys.down = keys.left = keys.right = 0; tc.up = tc.down = tc.left = tc.right = 0; audioUpdate(0, 0); }
  function parkedCars() {
    const out = [], gs = []; for (const b of S.blds.values()) if (b.type === 'garage') gs.push(b);
    const owned = S.cars.map((c, i) => ({ c, i })).filter(o => !S.drive || o.i !== S.drive.idx); let k = 0;
    for (const b of gs) for (let s = 0; s < 2 && k < owned.length; s++, k++) out.push({ x: b.x + 0.5 + s, y: b.y + 1.5, a: Math.PI / 2, m: owned[k].c.m, color: owned[k].c.color, brake: 0 });
    return out;
  }

  // ---------- camera ----------
  const vu = (x, y) => G.rvx(x, y), vv = (x, y) => G.rvy(x, y);
  const camIso = () => { const u = vu(cam.x, cam.y), v = vv(cam.x, cam.y); return [(u - v) * 32, (u + v) * 16]; };
  function viewToWorld(u, v) { const r = S.rot; return r === 0 ? [u, v] : r === 1 ? [v, MAP - u] : r === 2 ? [MAP - u, MAP - v] : [MAP - v, u]; }
  function dViewToWorld(du, dv) { const r = S.rot; return r === 0 ? [du, dv] : r === 1 ? [dv, -du] : r === 2 ? [-du, -dv] : [-dv, du]; }
  function screenToWorld(px, py) { const [cx, cy] = camIso(), ix = (px - W / 2) / cam.zoom + cx, iy = (py - H / 2) / cam.zoom + cy; return viewToWorld((ix / 32 + iy / 16) / 2, (iy / 16 - ix / 32) / 2); }
  function panView(du, dv) { const [dx, dy] = dViewToWorld(du, dv); cam.x = clamp(cam.x + dx, 0, MAP); cam.y = clamp(cam.y + dy, 0, MAP); }
  function panByScreen(dx, dy) { const ix = -dx / cam.zoom, iy = -dy / cam.zoom; panView((ix / 32 + iy / 16) / 2, (iy / 16 - ix / 32) / 2); }
  function setRot(r) { S.rot = ((r % 4) + 4) % 4; G.E.rot = S.rot; markDirty(); }
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

  // first-person data
  const FPC = { homes: ['#e9dcc4', '#d9c2a3', '#c9d4dd', '#e6c9c0'], sky: ['#5d86a6', '#4b6f8e', '#7893a8', '#6a8fa8'], fun: ['#d8c9a8', '#cfd6dc', '#e2c9a0', '#bfae93'] };
  function fpB(b, d) {
    const K = G.KINDS[d.kind] || { h: 2 }; let h = K.h * 0.85, col, rows = 0, gable = 0, roof = '#7c8088', glass = '#6f9cc0', v = b.v || 0;
    const k = d.kind;
    if (b.type === 'zr') { h = [0.6, 1.1, 2.6][b.lvl - 1]; col = FPC.homes[v % 4]; if (b.lvl < 3) { gable = 0.3; roof = '#a5503a'; } else { rows = 8; col = '#d3c7b4'; } }
    else if (b.type === 'zc') { h = [0.7, 1.8, 4.4][b.lvl - 1]; col = ['#d8d2c4', '#a9b5c0', '#6d8ca8'][b.lvl - 1]; rows = Math.round(h * 2.4); }
    else if (b.type === 'zi') { h = [0.7, 1.1, 1.5][b.lvl - 1]; col = '#9a9a94'; }
    else if (d.cat === 'sky') { col = FPC.sky[v % 4]; rows = Math.round(h * 2.6); glass = '#5f8db3'; }
    else if (d.cat === 'homes') { col = FPC.homes[v % 4]; if (h < 2.2) { gable = 0.32; roof = '#a5503a'; rows = 2; } else rows = Math.round(h * 2.4); }
    else if (k === 'police') col = '#4a6fa5'; else if (k === 'fire') col = '#c24a3a'; else if (k === 'clinic') col = '#e8eef2'; else if (k === 'school') col = '#d1a24b';
    else if (k === 'coal') { col = '#76787c'; h = 1.6; } else if (k === 'solar') { col = '#2b3f6b'; h = 0.15; } else if (k === 'water') col = '#cfd7de';
    else if (k === 'park' || k === 'golf') { col = '#6fae5a'; h = 0.12; } else if (k === 'pool') { col = '#4aa8d8'; h = 0.1; } else if (k === 'tree' || k === 'fountain' || k === 'garage') { col = '#9a9ca0'; h = k === 'garage' ? 0.5 : 0.25; }
    else col = FPC.fun[v % 4];
    return { x: b.x, y: b.y, w: d.w, d: d.d, h, col, rows, gable, roof, glass, cps: 3 };
  }
  function drawFP() {
    const c = S.drive, m = CARS[S.cars[c.idx].m], blds = [], scen = [], cars = [];
    for (const b of S.blds.values()) { const d = dOf(b); if (Math.hypot(b.x + d.w / 2 - c.x, b.y + d.d / 2 - c.y) < 26) blds.push(fpB(b, d)); }
    for (const [i, v] of S.scen) { if (S.occ[i]) continue; const x = i % MAP, y = (i / MAP) | 0; if (Math.abs(x - c.x) < 19 && Math.abs(y - c.y) < 19) scen.push({ x, y, v }); }
    for (const n of npcs) cars.push({ x: n.x - Math.sin(n.a) * 0.17, y: n.y + Math.cos(n.a) * 0.17, a: n.a, color: n.color, model: CARS[n.m] });
    for (const p of parkedCars()) cars.push({ x: p.x, y: p.y, a: p.a, color: p.color, model: CARS[p.m] });
    const pe = people.map(p => ({ x: p.x - p.dy * p.lat, y: p.y + p.dx * p.lat, col: p.col, skin: p.skin }));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    FP.draw(ctx, W, H, { x: c.x, y: c.y, a: c.a, eye: m.bh + m.ch * 0.55, speedKmh: Math.abs(c.v) * 26, steer: c.steer || 0, color: S.cars[c.idx].color, nitro: S.nitroT > 0, night: nightness, rain: S.rain, mul: mulA, isRoad, water: (x, y) => inb(x, y) && S.water[idx(x, y)] === 1, blds, scen, cars, people: pe });
    weatherFx(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function weatherFx() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S.rain > 0.02) {
      ctx.fillStyle = 'rgba(35,50,70,' + (0.22 * S.rain).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(210,225,245,' + (0.35 * S.rain).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      const n = Math.round(160 * S.rain); for (let i = 0; i < n; i++) { const x = (i * 73.13 + now * 40) % (W + 20), y = (i * 41.7 + now * 900) % H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); }
      ctx.stroke();
    }
    if (S.flash > 0.02) { ctx.fillStyle = 'rgba(235,240,255,' + (S.flash * 0.55).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function drawWheel(b) {
    const cx = b.x + 1.5, cy = b.y + 1.5, R = 1.25, z0 = 1.9, ang = now * 0.25;
    ctx.lineWidth = 1.3; ctx.strokeStyle = '#e8edf2'; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283, p = P(cx, cy + Math.cos(a) * R, z0 + Math.sin(a) * R); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); } ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = ang + i / 8 * 6.283, p = P(cx, cy + Math.cos(a) * R, z0 + Math.sin(a) * R), c0 = P(cx, cy, z0); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(p[0], p[1]); } ctx.strokeStyle = 'rgba(232,237,242,.8)'; ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = ang + i / 8 * 6.283, p = P(cx, cy + Math.cos(a) * R, z0 + Math.sin(a) * R - 0.08); ctx.beginPath(); ctx.arc(p[0], p[1] + 2, 2.6, 0, 7); ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][i % 4]; ctx.fill(); if (nightness > 0.25) E.glows.push({ x: cx, y: cy + Math.cos(a) * R, z: z0 + Math.sin(a) * R, r: 14, c: '255,220,140', a: 0.5 }); }
  }
  let fwP = [];
  function fireworks(dt) {
    if (S.fw > 0) {
      S.fw -= dt; const mb = mayorB(); fwP.fwT = (fwP.fwT || 0) - dt;
      if (mb && fwP.fwT <= 0) { fwP.fwT = 0.55 + Math.random() * 0.5; const ox = (Math.random() - 0.5) * 4, oy = (Math.random() - 0.5) * 4, bx = mb.x + 1.5 + ox, by = mb.y + 1.5 + oy, z = 8 + Math.random() * 4, x = PXf(bx, by), y = PYf(bx, by, z), col = ['255,90,90', '255,210,90', '120,220,255', '170,255,140', '255,140,230'][(Math.random() * 5) | 0]; for (let i = 0; i < 34; i++) { const a = Math.random() * 6.283, sp = 15 + Math.random() * 40; fwP.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 1.3 + Math.random() * 0.4, t: 0, c: col }); } }
    }
    for (let i = fwP.length - 1; i >= 0; i--) { const p = fwP[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 28 * dt; p.vx *= 0.99; if (p.t > p.l) fwP.splice(i, 1); }
  }
  function drawFireworks() {
    if (!fwP.length) return; ctx.globalCompositeOperation = 'lighter';
    for (const p of fwP) { const a = 1 - p.t / p.l; ctx.fillStyle = 'rgba(' + p.c + ',' + a.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawPlane() {
    const per = 70, ph = (now % per) / per * 1.0; if (ph > 0.28) return; const k = ph / 0.28, x = -80 + k * (W + 160), y = H * 0.18 + k * H * 0.25;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.save(); ctx.translate(x + 30, y + 80); ctx.rotate(0.45); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 4, 0, 0, 7); ctx.fill(); ctx.fillRect(-4, -16, 6, 32); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.45); ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.ellipse(0, 0, 28, 3.6, 0, 0, 7); ctx.fill(); ctx.fillRect(-4, -18, 7, 36); ctx.fillRect(-26, -7, 6, 14); ctx.fillStyle = '#d93b3b'; ctx.fillRect(-27, -3, 54, 1.2); if (nightness > 0.25 && Math.sin(now * 6) > 0) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(0, -18, 2, 0, 7); ctx.fill(); } ctx.restore();
  }
  const mayorB = () => { for (const b of S.blds.values()) if (b.type === 'mayor') return b; return null; };
  function terrainPass(cix, ciy, z) {
    // draw baked terrain with rotation affine (view = Rot(world))
    const cw = TER.canvas.width, ch = TER.canvas.height, M32 = MAP * 32;
    const f = (px, py) => { const sx = px - M32, sy = py, x = (sx / 32 + sy / 16) / 2, y = (sy / 16 - sx / 32) / 2, u = vu(x, y), v = vv(x, y); return [(u - v) * 32, (u + v) * 16]; };
    const a = f(0, 0), b = f(1, 0), c = f(0, 1);
    ctx.save(); ctx.transform(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1], a[0], a[1]); ctx.drawImage(TER.canvas, 0, 0, cw, ch); ctx.restore();
  }
  function draw() {
    if (S.mode === 'drive' && S.fp && S.drive) { E.g = ctx; drawFP(); return; }
    E.g = ctx; E.lit = null; E.glows = []; E.now = now; E.night = nightness; E.rot = S.rot; E.map = MAP; E.world = true;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const sea = ctx.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#46a0c2'); sea.addColorStop(1, '#1d6388'); ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    const z = cam.zoom, [cix, ciy] = camIso();
    const T = () => ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cix * z), DPR * (H / 2 - ciy * z));
    T(); ctx.imageSmoothingEnabled = true; terrainPass(cix, ciy, z);
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
    for (let c = 0; c < 5; c++) { const cx = ((now * 0.5 + c * 19) % 90) - 20, cy = (c * 13.7 + now * 0.2) % 60 - 6, p = P(cx, cy, 0), r = 150 + c * 25, gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); gr.addColorStop(0, 'rgba(10,20,30,.13)'); gr.addColorStop(1, 'rgba(10,20,30,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
    const vx0 = cix - W / 2 / z, vx1 = cix + W / 2 / z, vy0 = ciy - H / 2 / z, vy1 = ciy + H / 2 / z;
    const ents = [], smokes = [], ks = (x, y) => G.vsum(x, y);
    for (const b of S.blds.values()) {
      const s = bldSprite(b), d = dOf(b), an = G.vAnchor(b.x, b.y, d.w, d.d), sx = (an[0] - an[1]) * 32 - s.ox, sy = (an[0] + an[1]) * 16 - s.oy;
      if (sx > vx1 || sx + s.w < vx0 || sy > vy1 || sy + s.h < vy0) continue;
      ents.push({ k: an[0] + an[1] + (d.w + d.d) / 2, t: 0, o: b, s, an });
      const em = emitters(b); if (em) for (const e of em) smokes.push([e[0], e[1], e[2], e[3], b.id * 0.37]);
    }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const v = S.scen.get(idx(x, y)); if (v !== undefined && !S.occ[idx(x, y)]) { const an = G.vAnchor(x, y, 1, 1); ents.push({ k: an[0] + an[1] + 1, t: 3, an, s: G.sprite('scen', 1, v) }); } }
    for (const l of lamps) { const lx = PXf(l.x, l.y), ly = PYf(l.x, l.y, 0); if (lx > vx0 && lx < vx1 && ly > vy0 && ly < vy1 + 40) ents.push({ k: ks(l.x, l.y), t: 1, o: l }); }
    for (const n of npcs) { const ca = Math.cos(n.a), sa = Math.sin(n.a), o = { x: n.x - sa * 0.17, y: n.y + ca * 0.17, a: n.a, m: n.m, color: n.color, brake: 0 }; ents.push({ k: ks(o.x, o.y), t: 2, o }); }
    for (const p of people) { const nx = -p.dy, ny = p.dx, px = p.x + nx * p.lat, py = p.y + ny * p.lat; ents.push({ k: ks(px, py), t: 4, o: { x: px, y: py, ph: p.ph, col: p.col, skin: p.skin } }); }
    for (const p of parkedCars()) ents.push({ k: ks(p.x, p.y) + 0.2, t: 2, o: p });
    if (S.drive) { const c = S.drive; ents.push({ k: ks(c.x, c.y), t: 2, o: { x: c.x, y: c.y, a: c.a, m: S.cars[c.idx].m, color: S.cars[c.idx].color, brake: c.brake } }); }
    ents.sort((a, b) => a.k - b.k);
    const night = nightness > 0.25;
    for (const e of ents) {
      if (e.t === 0) { G.blit(e.s, e.an[0], e.an[1]); if (night) G.litWindows(e.s, e.an[0], e.an[1]); const d = dOf(e.o); if (d.kind === 'ferris') drawWheel(e.o); if (d.beacon) E.glows.push({ x: e.o.x + d.beacon[0], y: e.o.y + d.beacon[1], z: d.beacon[2], r: 22, c: '255,50,50', a: 0.5 + 0.5 * Math.sin(now * 3) }); if (e.o.s && e.o.s.cons && !e.o.op && S.mode === 'build') { const p = P(e.o.x + d.w / 2, e.o.y + d.d / 2, 1.6); ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.o.road ? '⚡' : '🛣️', p[0], p[1]); } }
      else if (e.t === 3) G.blit(e.s, e.an[0], e.an[1]);
      else if (e.t === 1) lampDraw(e.o);
      else if (e.t === 4) G.drawPerson(e.o);
      else G.drawCar(e.o, CARS[e.o.m], false);
    }
    for (const s of smokes) drawSmoke(s[0], s[1], s[2], s[3], s[4]);
    if (S.mode === 'build' && S.tool === 'build' && S.toolType) {
      const t = pending || hoverT;
      if (t) {
        const d = DEFS[S.toolType], a = anchorFor(S.toolType, t), ok = canPlace(S.toolType, a.x, a.y);
        if (d.poll) ring(a.x + d.w / 2, a.y + d.d / 2, d.poll, 'rgba(160,120,60,.1)', 'rgba(200,150,70,.6)');
        G.path([P(a.x, a.y, 0.03), P(a.x + d.w, a.y, 0.03), P(a.x + d.w, a.y + d.d, 0.03), P(a.x, a.y + d.d, 0.03)]); ctx.fillStyle = ok ? 'rgba(80,230,130,.4)' : 'rgba(240,70,70,.5)'; ctx.fill();
        if (ok) { const an = G.vAnchor(a.x, a.y, d.w, d.d); G.blit(G.sprite(d.kind, 1, 0), an[0], an[1], 0.65); }
      }
    } else if (S.mode === 'build' && S.tool === 'zone' && zStart && zEnd) {
      const x0 = Math.min(zStart.x, zEnd.x), x1 = Math.max(zStart.x, zEnd.x) + 1, y0 = Math.min(zStart.y, zEnd.y), y1 = Math.max(zStart.y, zEnd.y) + 1;
      G.path([P(x0, y0, 0.03), P(x1, y0, 0.03), P(x1, y1, 0.03), P(x0, y1, 0.03)]); ctx.fillStyle = S.zoneType ? ZONES[S.zoneType - 1].col : '#f87171'; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (S.mode === 'build' && (S.tool === 'road' || S.tool === 'bull') && hoverT && inb(hoverT.x, hoverT.y)) {
      const t = hoverT; G.path([P(t.x, t.y, 0.03), P(t.x + 1, t.y, 0.03), P(t.x + 1, t.y + 1, 0.03), P(t.x, t.y + 1, 0.03)]); ctx.fillStyle = S.tool === 'road' ? 'rgba(255,255,255,.35)' : 'rgba(240,70,70,.5)'; ctx.fill();
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mulCol !== 'rgb(255,255,255)') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mulCol; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    T();
    if (E.glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const gl of E.glows) { const x = PXf(gl.x, gl.y), y = PYf(gl.x, gl.y, gl.z), rg = ctx.createRadialGradient(x, y, 0, x, y, gl.r); rg.addColorStop(0, 'rgba(' + gl.c + ',' + clamp(gl.a, 0, 1) + ')'); rg.addColorStop(1, 'rgba(' + gl.c + ',0)'); ctx.fillStyle = rg; ctx.fillRect(x - gl.r, y - gl.r, gl.r * 2, gl.r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
    drawFireworks();
    E.world = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawPlane(); weatherFx();
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,15,30,.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- update ----------
  let rotT = 0, moving = null, selB = null, wxT = 60, wxTarget = 0, taskAcc = 0, growAcc = 0, hudAcc = 0, recAcc = 0, lastIssue = '', lastIssueT = -99;
  function rankIndex() { let r = 0; for (let i = 0; i < RANKS.length; i++) if (ST.pop >= RANKS[i].p) r = i; return r; }
  function update(dt) {
    const sd = S.mode === 'drive' ? dt : dt * S.speed;
    if (S.tmode === 0) { const dn = new Date(); S.t = dn.getHours() + dn.getMinutes() / 60 + dn.getSeconds() / 3600; } else if (S.tmode === 1) S.t = (S.t + dt * 24 / DAY_SEC) % 24; else S.t = S.tmode === 2 ? 12 : 0; updateLighting();
    S.nitroT = Math.max(0, S.nitroT - dt); S.nitroCD = Math.max(0, S.nitroCD - dt); S.flash = Math.max(0, (S.flash || 0) - dt * 2.5);
    wxT -= dt; if (S.wx === 'auto') { if (wxT <= 0) { wxTarget = wxTarget > 0 ? 0 : (Math.random() < 0.4 ? 0.4 + Math.random() * 0.6 : 0); wxT = wxTarget > 0 ? 50 + Math.random() * 70 : 120 + Math.random() * 240; } } else wxTarget = S.wx === 'rain' ? 1 : 0;
    S.rain += (wxTarget - S.rain) * Math.min(1, dt * 0.5); if (S.rain > 0.5 && Math.random() < dt * 0.15) S.flash = 1;
    fireworks(dt); taskAcc += dt; if (taskAcc > 0.5) { taskAcc = 0; checkTasks(); }
    if (sd > 0) {
      const m0 = Math.floor(S.month); S.month += sd / MONTH_SEC; S.money += ST.net / MONTH_SEC * sd; ST.appr += (ST.apprT - ST.appr) * Math.min(1, sd * 0.4);
      if (Math.floor(S.month) !== m0) { markDirty(); const r = rankIndex(); if (r > S.rank) { S.rank = r; S.money += r * 15000; toast('🎉 ' + S.name + ' is now a ' + RANKS[r].n + '! Government grant: ' + fmt(r * 15000)); } if (S.money < 0 && ST.pop > 0) toast('⚠️ You are in debt. Raise taxes or cut spending.'); }
      growAcc += sd; if (growAcc > 0.8) { growAcc = 0; growStep(); }
      recAcc += sd; if (recAcc > 2) { recAcc = 0; recalc(); const is = ST.issues[0]; if (is && is !== lastIssue && now - lastIssueT > 25 && S.mode === 'build') { lastIssue = is; lastIssueT = now; info('<b>Advisor</b> ' + is, 6000); } }
    }
    updateNpcs(dt * Math.max(1, S.speed)); updatePeople(dt * Math.max(1, S.speed));
    if (S.mode === 'drive' && S.drive) { updateDrive(dt); cam.x += (S.drive.x - cam.x) * Math.min(1, dt * 5); cam.y += (S.drive.y - cam.y) * Math.min(1, dt * 5); cam.zoom += (1.25 - cam.zoom) * Math.min(1, dt * 2); }
    else { const sp = 11 / cam.zoom * dt; if (keys.up) panView(-sp, -sp); if (keys.down) panView(sp, sp); if (keys.left) panView(-sp, sp); if (keys.right) panView(sp, -sp); }
    hudAcc += dt;
    if (hudAcc > 0.15) {
      hudAcc = 0; const mo = Math.floor(S.month);
      $('money').textContent = fmt(S.money); $('net').textContent = (ST.net >= 0 ? '+' : '') + fmt(ST.net) + '/mo'; $('net').style.color = ST.net >= 0 ? '#86efac' : '#fca5a5';
      $('pop').textContent = ST.pop.toLocaleString('en-US'); $('cname').textContent = S.name; const hh = Math.floor(S.t), mm = Math.floor((S.t % 1) * 60); $('cdate').textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ' · ' + RANKS[rankIndex()].n + (S.rain > 0.3 ? ' 🌧️' : nightness > 0.5 ? ' 🌙' : ' ☀️'); $('tbadge').textContent = S.tasks.length; $('tbadge').hidden = !S.tasks.length;
      const ap = Math.round(ST.appr); $('appr').textContent = (ap >= 70 ? '😀 ' : ap >= 45 ? '😐 ' : '😠 ') + ap + '%';
      ['r', 'c', 'i'].forEach((k, j) => { const e = $('d' + k), v = ST.dem[j]; e.style.height = Math.max(6, (v + 1) / 2 * 100) + '%'; e.style.opacity = v < 0 ? 0.5 : 1; });
      $('btnSpeed').textContent = S.speed === 0 ? '⏸' : '▶'.repeat(S.speed);
      $('btnDone').hidden = !(S.mode === 'build' && (S.tool !== 'move' || !$('tray').hidden || !$('selbar').hidden));
      if (S.drive) { $('speed').textContent = Math.round(Math.abs(S.drive.v) * 26); $('bNitro').style.opacity = S.nitroCD > 0 ? 0.45 : 1; $('tgt').textContent = tgtText(); }
    }
    if (now - lastSave > 10) { save(); lastSave = now; }
  }

  // ---------- citizen tasks ----------
  const WHO = [['Amara', '👩🏾'], ['Tunde', '👨🏿'], ['Sofia', '👩🏽'], ['Liam', '👨🏼'], ['Mei', '👩🏻'], ['Carlos', '👨🏽'], ['Priya', '👩🏽'], ['Jack', '🧔🏻'], ['Zainab', '🧕🏾'], ['Kofi', '👴🏿']];
  const TB = ['park', 'school', 'clinic', 'cinema', 'mall', 'hotel', 'library', 'stadium', 'ferris', 'church', 'mosque', 'market', 'pool', 'golf', 'marina', 'fire', 'police', 'fountain'];
  const cntB = t => { let n = 0; for (const b of S.blds.values()) if (b.type === t) n++; return n; };
  function newTask() {
    const who = WHO[(Math.random() * WHO.length) | 0], used = S.tasks.map(t => t.type + (t.arg || ''));
    for (let k = 0; k < 30; k++) {
      const r = Math.random(); let t = null;
      if (r < 0.35) { const b = TB[(Math.random() * TB.length) | 0]; t = { type: 'build', arg: b, n: cntB(b) + 1, txt: 'We need a ' + DEFS[b].name + ' in town!', reward: Math.round(DEFS[b].cost * 0.3) + 2e6 }; }
      else if (r < 0.5) { const n = Math.ceil((ST.pop + 60) / 50) * 50; t = { type: 'pop', n, txt: 'Grow the city to ' + n + ' citizens.', reward: 3e6 }; }
      else if (r < 0.62) t = { type: 'drive', n: S.odo + 40, txt: 'Take a long drive and enjoy the city (8 km).', reward: 2e6 };
      else if (r < 0.85) { const L = [...S.blds.values()].filter(b => ['hotel', 'mall', 'stadium', 'cinema', 'clinic', 'school', 'library', 'park', 'ferris', 'church', 'mosque', 'market', 'marina', 'golf', 'pool', 'police', 'fire'].includes(b.type)); if (L.length) { const b = L[(Math.random() * L.length) | 0]; t = { type: 'visit', arg: b.id, n: 1, txt: 'Please drive me to the ' + DEFS[b.type].name + '!', reward: 2.5e6 }; } }
      else if (r < 0.93) t = { type: 'photo', n: S.photos + 1, txt: 'Take a photo of the city with 📸 while driving.', reward: 1.5e6 };
      else { const n = Math.min(95, Math.round(ST.appr) + 8); t = { type: 'appr', n, txt: 'Make citizens happier: reach ' + n + '% approval.', reward: 4e6 }; }
      if (!t || used.includes(t.type + (t.arg || ''))) continue;
      t.id = S.tid++; t.who = who[0]; t.ic = who[1]; return t;
    }
    return null;
  }
  function initTasks() { while (S.tasks.length < 4) { const t = newTask(); if (!t) break; S.tasks.push(t); } }
  function visitDist(t) { const b = S.blds.get(t.arg); if (!b || !S.drive) return null; const d = dOf(b); return Math.hypot(b.x + d.w / 2 - S.drive.x, b.y + d.d / 2 - S.drive.y) - Math.max(d.w, d.d) / 2; }
  function taskProg(t) { if (t.type === 'build') return cntB(t.arg) + '/' + t.n; if (t.type === 'pop') return ST.pop + '/' + t.n; if (t.type === 'drive') return Math.max(0, 8 - Math.round((t.n - S.odo) * 0.2)) + '/8 km'; if (t.type === 'appr') return Math.round(ST.appr) + '/' + t.n + '%'; if (t.type === 'photo') return S.photos >= t.n ? '1/1' : '0/1'; const b = S.blds.get(t.arg); return b ? 'Drive there 🚗' : 'gone'; }
  function checkTasks() {
    if (!S.tasks.length) initTasks();
    for (let i = 0; i < S.tasks.length; i++) {
      const t = S.tasks[i]; let done = false, drop = false;
      if (t.type === 'build') done = cntB(t.arg) >= t.n; else if (t.type === 'pop') done = ST.pop >= t.n; else if (t.type === 'drive') done = S.odo >= t.n; else if (t.type === 'photo') done = S.photos >= t.n; else if (t.type === 'appr') done = ST.appr >= t.n;
      else if (t.type === 'visit') { if (!S.blds.get(t.arg)) drop = true; else { const d = visitDist(t); done = d !== null && d < 1.6; } }
      if (done || drop) {
        if (done) { S.money += t.reward; toast(t.ic + ' ' + t.who + ': Thank you, Mayor! +' + fmt(t.reward)); markDirty(); }
        const nt = newTask(); if (nt) S.tasks[i] = nt; else S.tasks.splice(i, 1); if (!$('tasks').hidden) renderTasks(); break;
      }
    }
  }
  function tgtText() { let best = null; for (const t of S.tasks) if (t.type === 'visit') { const d = visitDist(t); if (d !== null && (best === null || d < best.d)) best = { d, t }; } return best ? '📍 ' + DEFS[S.blds.get(best.t.arg).type].name + ' · ' + Math.round(best.d) + ' tiles' : ''; }
  function renderTasks() {
    $('tasksB').innerHTML = '<p class="tip">Citizens ask the mayor for favours. Complete them for cash rewards.</p>' + S.tasks.map(t => '<div class="tip"><b>' + t.ic + ' ' + t.who + '</b><br>' + t.txt + '<br><small>Reward ' + fmt(t.reward) + ' · ' + taskProg(t) + '</small></div>').join('');
  }
  function openTasks() { closePanels(); $('tasks').hidden = false; renderTasks(); }
  function openMayor() {
    closePanels(); $('mayor').hidden = false; const mb = mayorB();
    const sel = (id, opts, cur) => '<select id="' + id + '">' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    $('mayorB').innerHTML = '<div class="tip"><b>👑 Mayor ' + 'of ' + S.name + '</b><br>' + (mb ? 'Your penthouse sits at the top of the Grand Residence, with its own helipad.' : 'You have no penthouse. Build one from the Skyline tab.') + '<br><small>Treasury ' + fmt(S.money) + ' · ' + RANKS[rankIndex()].n + '</small></div>' +
      '<div class="sec"><button class="go" id="mParty">🎆 Throw a party (fireworks)</button></div><div class="sec"><button class="go" id="mHome">🏠 Fly to my penthouse</button></div><div class="sec"><button class="go" id="mDeco">🛋️ Decorate my penthouse</button></div><div class="sec"><button class="go" id="mCars">🚗 My garage</button></div>' +
      '<div class="sec"><label>Time of day</label>' + sel('mTime', [[0, '🕐 Real clock (default)'], [1, '⏩ Fast day cycle (5 min)'], [2, '☀️ Always day'], [3, '🌙 Always night']], S.tmode) + '</div>' +
      '<div class="sec"><label>Weather</label>' + sel('mWx', [['auto', '🌦️ Automatic'], ['clear', '☀️ Clear'], ['rain', '🌧️ Rain & storm']], S.wx) + '</div>' +
      '<div class="sec"><label>Driving view (also the 👁 button)</label>' + sel('mFp', [[0, '🚗 Chase view'], [1, '👁 First person']], S.fp ? 1 : 0) + '</div>';
    $('mParty').onclick = () => { S.fw = 30; closePanels(); if (mb) { cam.x = mb.x + 1.5; cam.y = mb.y + 1.5; } toast('🎆 Party at the penthouse!'); };
    $('mDeco').onclick = openHome; $('mHome').onclick = () => { if (mb) { cam.x = mb.x + 1.5; cam.y = mb.y + 1.5; cam.zoom = 1.5; closePanels(); } };
    $('mCars').onclick = openCars;
    $('mTime').onchange = e => { S.tmode = +e.target.value; markDirty(); }; $('mWx').onchange = e => { S.wx = e.target.value; markDirty(); }; $('mFp').onchange = e => { S.fp = e.target.value === '1'; markDirty(); };
  }
  // ---------- phone ----------
  function openPhone() { closePanels(); const d = new Date(); $('ptime').textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); const B = $('phoneB'); B.innerHTML = '';
    for (const [id, ic, label] of BAR) { const a = document.createElement('button'); a.className = 'app'; a.innerHTML = '<i>' + ic + '</i>' + label; a.onclick = () => { $('phone').hidden = true; setTool(id); }; B.appendChild(a); }
    $('phone').hidden = false; }
  // ---------- penthouse interior ----------
  const FURN = [['sofa', '🛋️', 'Sofa', 250000], ['bed', '🛏️', 'King bed', 400000], ['tv', '📺', 'Giant TV', 300000], ['books', '📚', 'Bookshelf', 120000], ['plant', '🪴', 'Plant', 20000], ['lamp', '💡', 'Floor lamp', 40000], ['piano', '🎹', 'Grand piano', 1500000], ['fish', '🐠', 'Aquarium', 800000], ['pool', '🎱', 'Pool table', 900000], ['arcade', '🕹️', 'Arcade', 600000], ['rug', '🟫', 'Luxury rug', 80000], ['fridge', '🧊', 'Fridge', 150000], ['art', '🖼️', 'Painting', 2500000], ['gym', '🏋️', 'Home gym', 500000], ['pc', '🖥️', 'Gaming desk', 280000], ['bar', '🍸', 'Cocktail bar', 700000], ['statue', '🗿', 'Statue', 3000000], ['car', '🏎️', 'Display supercar', 5000000], ['tree', '🎄', 'Indoor tree', 60000], ['table', '🍽️', 'Dining table', 220000], ['trophy', '🏆', 'Trophy case', 1000000], ['tub', '🛁', 'Bathtub', 450000]];
  const BX = {
    sofa: [[.05, .15, .9, .7, 0, 9, '#46607f'], [.05, .15, .9, .2, 9, 16, '#3d546f'], [.05, .15, .14, .7, 9, 7, '#3d546f'], [.81, .15, .14, .7, 9, 7, '#3d546f'], [.2, .35, .28, .45, 9, 4, '#5a7699'], [.52, .35, .28, .45, 9, 4, '#5a7699']],
    bed: [[.04, .04, .92, .92, 0, 8, '#6b4a2e'], [.08, .08, .84, .84, 8, 7, '#eef2f8'], [.08, .08, .84, .2, 15, 10, '#cdd7e8'], [.08, .5, .84, .42, 15, 3, '#2f5f95']],
    tv: [[.1, .35, .8, .3, 0, 9, '#2a2d33'], [.12, .4, .76, .08, 9, 26, '#0a0c10'], [.15, .47, .7, .02, 12, 20, '#4f86d8']],
    books: [[.05, .1, .9, .3, 0, 46, '#6d4528'], [.08, .38, .84, .02, 4, 40, '#c9a36b'], [.12, .14, .15, .22, 8, 10, '#c0392b'], [.3, .14, .15, .22, 8, 10, '#2e86c1'], [.5, .14, .15, .22, 22, 10, '#27ae60'], [.7, .14, .15, .22, 22, 10, '#f1c40f']],
    plant: [[.3, .3, .4, .4, 0, 10, '#8a5a3c'], [.2, .2, .6, .6, 10, 22, '#2f8f46'], [.32, .32, .36, .36, 32, 12, '#3fae58']],
    lamp: [[.45, .45, .1, .1, 0, 44, '#2b2b2b'], [.3, .3, .4, .4, 44, 14, '#f4e3a8']],
    piano: [[.05, .05, .9, .9, 6, 22, '#101114'], [.1, .5, .8, .4, 28, 3, '#f5f5f0'], [.1, .1, .8, .35, 28, 10, '#17181c'], [.1, .1, .06, .06, 0, 6, '#101114'], [.84, .84, .06, .06, 0, 6, '#101114']],
    fish: [[.05, .15, .9, .7, 0, 14, '#2d3138'], [.08, .18, .84, .64, 14, 28, '#5bc3e8'], [.2, .3, .15, .1, 20, 6, '#ff8a3c'], [.55, .5, .15, .1, 28, 6, '#ffd23c']],
    pool: [[.04, .04, .92, .92, 12, 4, '#1f8a57'], [.04, .04, .92, .92, 0, 12, '#5a3a22']],
    arcade: [[.2, .2, .6, .6, 0, 48, '#2b2f7a'], [.25, .45, .5, .1, 28, 14, '#53d2ff'], [.25, .2, .5, .2, 48, 8, '#ff4fa3']],
    rug: [[.0, .0, 1, 1, 0, 1.5, '#8e2f3f'], [.1, .1, .8, .8, 1.5, .6, '#d9b36a']],
    fridge: [[.15, .15, .7, .7, 0, 58, '#c9cfd6'], [.15, .15, .7, .02, 6, 24, '#9aa2ac'], [.8, .5, .04, .1, 30, 12, '#6b7078']],
    art: [[.1, .4, .8, .05, 36, 30, '#c9a14a'], [.14, .45, .72, .02, 39, 24, '#d96c5b'], [.3, .45, .3, .03, 44, 10, '#2f6fb0']],
    gym: [[.1, .1, .8, .8, 0, 6, '#222'], [.15, .2, .2, .6, 6, 34, '#444'], [.4, .3, .5, .4, 6, 14, '#b8272d'], [.4, .2, .5, .06, 20, 6, '#999']],
    pc: [[.05, .15, .9, .5, 20, 4, '#2b2d34'], [.1, .2, .06, .4, 0, 20, '#2b2d34'], [.84, .2, .06, .4, 0, 20, '#2b2d34'], [.3, .5, .4, .08, 24, 22, '#0c0e14'], [.34, .54, .32, .02, 27, 16, '#7d5cff']],
    bar: [[.05, .15, .9, .5, 0, 30, '#4a2e1d'], [.03, .12, .94, .56, 30, 4, '#d8d2c4'], [.2, .3, .08, .08, 34, 10, '#9fe3d0'], [.6, .3, .08, .08, 34, 12, '#ff9b9b']],
    statue: [[.2, .2, .6, .6, 0, 12, '#c8c4bb'], [.35, .35, .3, .3, 12, 30, '#e8e4da'], [.4, .4, .2, .2, 42, 10, '#e8e4da']],
    car: [[.05, .1, .9, .8, 4, 10, '#d62828'], [.25, .2, .5, .6, 14, 8, '#b01f1f'], [.3, .25, .4, .5, 22, 4, '#1c2b3a'], [.1, .08, .12, .08, 0, 5, '#111'], [.78, .08, .12, .08, 0, 5, '#111'], [.1, .84, .12, .08, 0, 5, '#111'], [.78, .84, .12, .08, 0, 5, '#111']],
    tree: [[.38, .38, .24, .24, 0, 14, '#6b4a2f'], [.15, .15, .7, .7, 14, 18, '#1f7a3f'], [.27, .27, .46, .46, 32, 16, '#2a9650'], [.38, .38, .24, .24, 48, 10, '#36b162']],
    table: [[.05, .15, .9, .7, 22, 4, '#6a4326'], [.1, .2, .06, .06, 0, 22, '#4b2f1a'], [.84, .2, .06, .06, 0, 22, '#4b2f1a'], [.1, .76, .06, .06, 0, 22, '#4b2f1a'], [.84, .76, .06, .06, 0, 22, '#4b2f1a'], [.4, .4, .2, .2, 26, 6, '#e8d9b8']],
    trophy: [[.1, .15, .8, .3, 0, 50, '#3a2a1c'], [.14, .42, .72, .02, 6, 38, '#bfe0f0'], [.4, .2, .2, .2, 8, 12, '#f0c040'], [.4, .2, .2, .2, 26, 12, '#f0c040']],
    tub: [[.05, .1, .9, .8, 0, 16, '#f4f6f8'], [.15, .2, .7, .6, 16, 1, '#7fc8e8']]
  };
  const FLOORS = [['#9c7a52', 'Oak'], ['#d9d4c8', 'Marble'], ['#4a4f5a', 'Slate'], ['#7a4a3a', 'Walnut'], ['#2d5a46', 'Green carpet']], WALLS = [['#e8e2d4', 'Cream'], ['#b9c8d8', 'Sky blue'], ['#d9b8c0', 'Rose'], ['#3a4256', 'Midnight'], ['#c9d4b8', 'Sage']];
  const DEF_DECOR = [{ k: 'bed', x: 6, y: 0 }, { k: 'sofa', x: 3, y: 5 }, { k: 'tv', x: 3, y: 7 }, { k: 'fridge', x: 0, y: 6 }, { k: 'table', x: 5, y: 4 }, { k: 'plant', x: 7, y: 7 }, { k: 'rug', x: 3, y: 4 }];
  let hsel = null; const RW = 8, HT = 36, HH = 18, HOX = 210, HOY = 112;
  function openHome() { closePanels(); $('home').hidden = false; if (!S.decor || (!S.decor.length && !S.hinit)) { S.decor = DEF_DECOR.map(d => Object.assign({}, d)); } S.hinit = true; S.hfl = S.hfl || 0; S.hwl = S.hwl || 0;
    const fill = (id, arr, cur, set) => { const e = $(id); e.innerHTML = arr.map((o, i) => '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + o[1] + '</option>').join(''); e.onchange = () => { set(+e.value); markDirty(); drawHome(); }; };
    fill('hFloor', FLOORS, S.hfl, v => S.hfl = v); fill('hWall', WALLS, S.hwl, v => S.hwl = v); renderShop(); drawHome(); }
  function renderShop() { $('hcash').textContent = fmt(S.money); $('hshop').innerHTML = ''; for (const f of FURN) { const b = document.createElement('button'); b.className = hsel === f[0] ? 'on' : ''; b.innerHTML = '<span>' + f[1] + '</span>' + f[2] + '<small>' + fmt(f[3]) + '</small>'; b.onclick = () => { hsel = hsel === f[0] ? null : f[0]; renderShop(); }; $('hshop').appendChild(b); } }
  function drawHome() {
    const c = $('homeCv'), g = c.getContext('2d'), Wd = c.width, pt = (x, y, z) => [HOX + (x - y) * HT / 2, HOY + (x + y) * HH / 2 - (z || 0)], wh = 120, n = Math.min(1, Math.max(0, nightness));
    const poly = (pts, col) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = col; g.fill(); };
    const bgc = g.createLinearGradient(0, 0, 0, c.height); bgc.addColorStop(0, '#0d1626'); bgc.addColorStop(1, '#16233b'); g.fillStyle = bgc; g.fillRect(0, 0, Wd, c.height);
    const wc = WALLS[S.hwl][0], fc = FLOORS[S.hfl][0];
    poly([pt(0, 0, 0), pt(RW, 0, 0), pt(RW, 0, wh), pt(0, 0, wh)], hexMix(wc, 0.92)); poly([pt(0, 0, 0), pt(0, RW, 0), pt(0, RW, wh), pt(0, 0, wh)], hexMix(wc, 0.72));
    const win = (wall, u0, u1, z0, z1) => { const P4 = [[u0, z0], [u1, z0], [u1, z1], [u0, z1]].map(([u, z]) => wall === 0 ? pt(u, 0, z) : pt(0, u, z)); g.save(); g.beginPath(); P4.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
      const sk = g.createLinearGradient(0, P4[3][1], 0, P4[0][1]); const t1 = [[120, 180, 235], [8, 12, 30]], t2 = [[205, 230, 250], [30, 42, 80]]; const mx = (a, b) => 'rgb(' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * n)) + ')'; sk.addColorStop(0, mx(t1[0], t1[1])); sk.addColorStop(1, mx(t2[0], t2[1])); g.fillStyle = sk; g.fillRect(0, 0, Wd, c.height);
      for (let i = 0; i < 14; i++) { const uu = u0 + (u1 - u0) * (i / 14), bw = (u1 - u0) / 14 * (0.7 + (i * 7 % 5) * 0.12), bhh = z0 + 8 + ((i * 37) % 9) * 5; const q = [[uu, z0 - 2], [uu + bw, z0 - 2], [uu + bw, bhh], [uu, bhh]].map(([u, z]) => wall === 0 ? pt(u, 0, z) : pt(0, u, z)); poly(q, hexMix('#4a5f7a', 1 - n * 0.55)); if (n > 0.3) { g.fillStyle = 'rgba(255,214,120,.8)'; for (let k = 0; k < 3; k++) { const wz = z0 + 6 + k * 9, wu = uu + bw * 0.3; const p2 = wall === 0 ? pt(wu, 0, wz) : pt(0, wu, wz); g.fillRect(p2[0], p2[1], 2, 2); } } }
      g.restore(); g.strokeStyle = '#2a2f38'; g.lineWidth = 2.5; g.beginPath(); P4.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
      const m1 = wall === 0 ? pt((u0 + u1) / 2, 0, z0) : pt(0, (u0 + u1) / 2, z0), m2 = wall === 0 ? pt((u0 + u1) / 2, 0, z1) : pt(0, (u0 + u1) / 2, z1); g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.stroke(); };
    win(0, 1, 7, 22, 100); win(1, 1, 6, 22, 100);
    // door on left wall
    poly([pt(0, 6.2, 0), pt(0, 7.5, 0), pt(0, 7.5, 88), pt(0, 6.2, 88)], '#5b3d28'); g.fillStyle = '#e6c26a'; { const hp = pt(0, 6.45, 40); g.fillRect(hp[0], hp[1], 3, 3); }
    poly([pt(0, 0, 0), pt(RW, 0, 0), pt(RW, 0, 6), pt(0, 0, 6)], hexMix(wc, 1.2)); poly([pt(0, 0, 0), pt(0, RW, 0), pt(0, RW, 6), pt(0, 0, 6)], hexMix(wc, 1.0));
    for (let y = 0; y < RW; y++) for (let x = 0; x < RW; x++) { poly([pt(x, y, 0), pt(x + 1, y, 0), pt(x + 1, y + 1, 0), pt(x, y + 1, 0)], hexMix(fc, (x + y) % 2 ? 1 : 0.93)); }
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= RW; i++) { const a = pt(i, 0, 0), b = pt(i, RW, 0), c2 = pt(0, i, 0), d = pt(RW, i, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); } g.stroke();
    if (n > 0.25) { const l = pt(4, 4, 112), rg = g.createRadialGradient(l[0], l[1], 0, l[0], l[1], 150); rg.addColorStop(0, 'rgba(255,224,160,' + 0.3 * n + ')'); rg.addColorStop(1, 'rgba(255,224,160,0)'); g.fillStyle = rg; g.fillRect(0, 0, Wd, c.height); }
    const box = (x, y, w, d, z, h, col) => { const A = pt(x, y, z + h), B = pt(x + w, y, z + h), C = pt(x + w, y + d, z + h), D = pt(x, y + d, z + h); poly([pt(x + w, y, z), pt(x + w, y + d, z), C, B], hexMix(col, 0.78)); poly([pt(x, y + d, z), pt(x + w, y + d, z), C, D], hexMix(col, 0.6)); poly([A, B, C, D], hexMix(col, 1.12)); };
    const items = (S.decor || []).slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const it of items) { const bl = BX[it.k]; if (!bl) continue; const p = pt(it.x + 0.5, it.y + 0.5, 0); g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(p[0], p[1], 16, 8, 0, 0, 7); g.fill(); for (const [dx, dy, w, d, z, h, col] of bl) box(it.x + dx, it.y + dy, w, d, z, h, col); }
    g.fillStyle = '#9fb0c8'; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(items.length + ' items', 8, 16);
  }
  function homeTap(e) {
    const c = $('homeCv'), r = c.getBoundingClientRect(), px = (e.clientX - r.left) * c.width / r.width - HOX, py = (e.clientY - r.top) * c.height / r.height - HOY, a = px / (HT / 2), b = py / (HH / 2), x = Math.floor((a + b) / 2), y = Math.floor((b - a) / 2);
    if (x < 0 || y < 0 || x >= RW || y >= RW) return; S.decor = S.decor || []; const ex = S.decor.findIndex(d => d.x === x && d.y === y);
    if (hsel) { const f = FURN.find(q => q[0] === hsel); if (ex >= 0) { toast('That spot is taken'); return; } if (S.money < f[3]) { toast('Not enough cash'); return; } S.money -= f[3]; S.decor.push({ k: hsel, x, y }); markDirty(); }
    else if (ex >= 0) { const f = FURN.find(q => q[0] === S.decor[ex].k); S.money += Math.floor(f[3] / 2); S.decor.splice(ex, 1); toast('Sold for ' + fmt(Math.floor(f[3] / 2))); markDirty(); }
    $('hcash').textContent = fmt(S.money); drawHome();
  }
  $('homeCv').addEventListener('pointerdown', homeTap); $('btnPhone').onclick = openPhone; $('phclose').onclick = closePanels; $('hmclose').onclick = closePanels;
  $('phone').addEventListener('pointerdown', e => { if (e.target === $('phone')) closePanels(); });
  function photo() { draw(); try { cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'mycity-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (e) { /* ignore */ } S.photos++; toast('📸 Photo saved'); markDirty(); }

  // ---------- UI ----------
  const BAR = [['move', '🔍', 'Look'], ['road', '🛣️', 'Roads'], ['zone', '🟩', 'Zones'], ['utils', '⚡', 'Utilities'], ['serv', '🚓', 'Services'], ['homes', '🏠', 'Homes'], ['sky', '🏙️', 'Skyline'], ['fun', '🎡', 'Amenities'], ['extras', '🌳', 'Extras'], ['bull', '🧹', 'Demolish'], ['tasks', '📋', 'Tasks'], ['mayor', '👑', 'Mayor'], ['home', '🏡', 'My Home'], ['hall', '📊', 'City Hall'], ['cars', '🚗', 'Cars']];
  function buildBar() {
    const bar = $('bar'); bar.innerHTML = '';
    for (const [id, ic, label] of BAR) { const bt = document.createElement('button'); bt.className = 'tb'; bt.dataset.id = id; bt.innerHTML = '<span>' + ic + '</span><small>' + label + '</small>'; bt.onclick = () => setTool(id); bar.appendChild(bt); }
  }
  function refreshBar() { for (const b of $('bar').children) b.classList.toggle('on', b.dataset.id === S.cat); }
  function buildTray(cat) {
    const tray = $('tray'); tray.innerHTML = '';
    const add = (key, icon, name, sub, on, click) => { const bt = document.createElement('button'); bt.className = 'item' + (on ? ' on' : ''); bt.innerHTML = '<span class="ic">' + icon + '</span><b>' + name + '</b><small>' + sub + '</small>'; bt.onclick = click; tray.appendChild(bt); };
    add('done', '✖️', 'Done', 'Stop building', false, () => setTool('move'));
    if (cat === 'zone') for (const z of ZONES) add(z.id, z.icon, z.name, z.id ? z.sub + ' · $10/tile' : z.sub, S.zoneType === z.id, () => { S.zoneType = z.id; S.tool = 'zone'; buildTray(cat); });
    else for (const k in DEFS) { const d = DEFS[k]; if (d.cat !== cat) continue; add(k, d.icon, d.name, fmt(d.cost) + (d.pc ? ' · serves ' + d.pc.toLocaleString('en-US') : '') + (d.sub ? ' · ' + d.sub : d.inc ? ' · +' + fmt(d.inc) + '/mo' : d.upkeep ? ' · ' + fmt(d.upkeep) + '/mo' : ''), S.toolType === k, () => { if (S.tool === 'build' && S.toolType === k) { setTool('move'); return; } S.toolType = k; S.tool = 'build'; pending = null; hideConfirm(); buildTray(cat); }); }
    tray.hidden = false;
  }
  function restoreMoving() { if (!moving) return; const m = moving; moving = null; if (placeBuilding(m.type, m.x, m.y, true)) { S.money -= DEFS[m.type].cost; const b = [...S.blds.values()].pop(); if (b) { b.lvl = m.lvl; b.v = m.v; } } }
  function selectB(b) { selB = b; hideConfirm(); const d = dOf(b); $('seltxt').textContent = d.icon + ' ' + d.name; $('selbar').hidden = false; inspect({ x: b.x, y: b.y }); }
  function hideSel() { selB = null; $('selbar').hidden = true; }
  function setTool(id) {
    restoreMoving(); hideSel(); pending = null; hideConfirm(); zStart = zEnd = null; $('tray').hidden = true;
    if (id === 'cars') { openCars(); return; } if (id === 'hall') { openHall(); return; } if (id === 'tasks') { openTasks(); return; } if (id === 'home') { openHome(); return; } if (id === 'mayor') { openMayor(); return; }
    closePanels(); S.cat = id;
    if (id === 'zone') { S.tool = 'zone'; buildTray('zone'); }
    else if (['utils', 'serv', 'homes', 'sky', 'fun', 'extras'].includes(id)) { S.tool = 'move'; S.toolType = null; buildTray(id); }
    else S.tool = id;
    refreshBar();
  }
  function showConfirm() { const d = DEFS[S.toolType]; $('conftxt').textContent = d.name + ' · ' + fmt(d.cost); $('confirm').hidden = false; }
  function hideConfirm() { $('confirm').hidden = true; }
  function closePanels() { $('panel').hidden = true; $('hall').hidden = true; $('tasks').hidden = true; $('mayor').hidden = true; $('phone').hidden = true; $('home').hidden = true; carOpen = false; previews = []; }

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
  const hexMix = (h, f, a) => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)); const r = v.map(c => Math.max(0, Math.min(255, Math.round(f >= 1 ? c + (255 - c) * (f - 1) : c * f)))); return 'rgba(' + r + ',' + (a == null ? 1 : a) + ')'; };
  function carSide(g, Wc, Hc, m, color, t) {
    const bg = g.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, '#2a3a52'); bg.addColorStop(1, '#10182a'); g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
    const L = Wc * 0.8, x0 = Wc * 0.1, gy = Hc * 0.8, sc = L / m.L, wr = 0.078 * L, z0 = wr * 0.85 / sc, X = u => x0 + L * (u + 0.5), Z = z => gy - z * sc;
    const fl = g.createRadialGradient(Wc / 2, gy, 0, Wc / 2, gy, Wc * 0.55); fl.addColorStop(0, 'rgba(255,255,255,.16)'); fl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fl; g.fillRect(0, gy - 10, Wc, Hc);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(Wc / 2, gy + 2, L * 0.52, wr * 0.35, 0, 0, 7); g.fill();
    const [c0, c1, c2, c3] = m.cab, bh = m.bh, top = bh + m.ch;
    if (m.spoiler) { const sh = m.spoiler === 2 ? 0.075 : 0.045; g.fillStyle = hexMix(color, 0.6); g.fillRect(X(-0.5), Z(bh + sh), L * 0.012, sh * sc); g.fillStyle = hexMix(color, 0.85); g.beginPath(); g.roundRect(X(-0.52), Z(bh + sh) - 3, L * 0.14, 4, 2); g.fill(); }
    const body = () => { g.beginPath(); g.moveTo(X(-0.5), Z(z0)); g.lineTo(X(-0.5), Z(bh * 0.8)); g.quadraticCurveTo(X(-0.5), Z(bh), X(-0.44), Z(bh)); g.lineTo(X(c0), Z(bh)); g.quadraticCurveTo(X(c2 - 0.02), Z(top * 0.98), X(c2 + 0.03), Z(top)); g.lineTo(X(c3 - 0.03), Z(top)); g.quadraticCurveTo(X(c3 + 0.02), Z(top * 0.98), X(c1 + 0.02), Z(bh)); g.quadraticCurveTo(X(0.36), Z(bh * 1.03), X(0.45), Z(bh * 0.9)); g.quadraticCurveTo(X(0.5), Z(bh * 0.8), X(0.5), Z(bh * 0.5)); g.lineTo(X(0.5), Z(z0)); g.closePath(); };
    body(); const pg = g.createLinearGradient(0, Z(top), 0, Z(z0)); pg.addColorStop(0, hexMix(color, 1.45)); pg.addColorStop(0.35, hexMix(color, 1.05)); pg.addColorStop(0.7, hexMix(color, 0.7)); pg.addColorStop(1, hexMix(color, 0.4)); g.fillStyle = pg; g.fill();
    g.save(); body(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X(-0.47), Z(bh * 0.72)); g.lineTo(X(0.46), Z(bh * 0.72)); g.stroke(); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(X(-0.5), Z(z0 + 0.03), L, 0.03 * sc + 2); const sw = g.createLinearGradient(X(-0.5) + ((t * 40) % (L * 1.6)) - L * 0.3, 0, X(-0.5) + ((t * 40) % (L * 1.6)), 0); sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,.18)'); sw.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sw; g.fillRect(x0, Z(top), L, (top) * sc); g.restore();
    const gl = g.createLinearGradient(0, Z(top), 0, Z(bh)); gl.addColorStop(0, '#9fc3e0'); gl.addColorStop(1, '#1d2b3b'); g.fillStyle = gl; g.beginPath(); g.moveTo(X(c0 + 0.03), Z(bh + 0.01)); g.quadraticCurveTo(X(c2 - 0.01), Z(top - 0.012), X(c2 + 0.04), Z(top - 0.012)); g.lineTo(X(c3 - 0.035), Z(top - 0.012)); g.quadraticCurveTo(X(c3 + 0.01), Z(top - 0.012), X(c1 - 0.015), Z(bh + 0.01)); g.closePath(); g.fill();
    const mid = (c0 + c1) / 2 + 0.01; g.strokeStyle = hexMix(color, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(X(mid), Z(bh + 0.01)); g.lineTo(X(mid + (c2 + c3) / 2 - (c0 + c1) / 2), Z(top - 0.012)); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(c0 - 0.01), Z(bh)); g.lineTo(X(c0 - 0.02), Z(z0 + 0.03)); g.moveTo(X(c1 + 0.01), Z(bh)); g.lineTo(X(c1 + 0.01), Z(z0 + 0.03)); g.moveTo(X(mid + 0.05), Z(bh)); g.lineTo(X(mid + 0.05), Z(z0 + 0.03)); g.stroke();
    g.fillStyle = 'rgba(220,225,232,.85)'; g.fillRect(X(c1 - 0.06), Z(bh - 0.025), L * 0.035, 2.2); g.fillStyle = hexMix(color, 0.6); g.beginPath(); g.ellipse(X(c1 + 0.02), Z(bh + 0.025), L * 0.018, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#fff6c9'; g.beginPath(); g.moveTo(X(0.5), Z(bh * 0.86)); g.quadraticCurveTo(X(0.47), Z(bh * 0.96), X(0.43), Z(bh * 0.88)); g.lineTo(X(0.46), Z(bh * 0.7)); g.lineTo(X(0.5), Z(bh * 0.7)); g.closePath(); g.fill(); g.shadowColor = '#fff6c9'; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#e0261f'; g.fillRect(X(-0.5), Z(bh * 0.88), L * 0.025, bh * 0.2 * sc); g.fillStyle = 'rgba(30,30,34,.9)'; g.fillRect(X(0.47), Z(z0 + 0.012), L * 0.03, 3);
    for (const u of [-0.31, 0.31]) { const cx = X(u), cy = gy - wr; g.fillStyle = '#0b0c0f'; g.beginPath(); g.arc(cx, cy, wr * 1.22, 0, 7); g.fill(); g.fillStyle = '#17191d'; g.beginPath(); g.arc(cx, cy, wr, 0, 7); g.fill(); const rg = g.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, wr * 0.68); rg.addColorStop(0, '#f2f4f7'); rg.addColorStop(1, '#868c96'); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, wr * 0.68, 0, 7); g.fill(); g.strokeStyle = '#4b505a'; g.lineWidth = 1.6; g.beginPath(); const sp = (u < 0 ? -1 : 1) * t * 2; for (let i = 0; i < 5; i++) { const a = sp + i * 1.2566; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * wr * 0.66, cy + Math.sin(a) * wr * 0.66); } g.stroke(); g.fillStyle = '#2b2f36'; g.beginPath(); g.arc(cx, cy, wr * 0.14, 0, 7); g.fill(); }
  }
  function drawPreviews(t) {
    for (const p of previews) { const c = p.cv, x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); carSide(x, c.width, c.height, CARS[p.m], p.car.color, t); }
  }

  // city hall
  function openHall() { closePanels(); $('hall').hidden = false; renderHall(); }
  function tbl(rows) { return '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="r' + (r[2] ? ' ' + r[2] : '') + '">' + r[1] + '</td></tr>').join('') + '</table>'; }
  function renderBudget() {
    const i = ST.inc, e = ST.exp;
    $('budT').innerHTML = '<h4>Monthly income</h4>' + tbl([['🏠 Residential tax', fmt(i.r)], ['🏬 Commercial tax', fmt(i.c)], ['🏭 Industrial tax', fmt(i.i)], ['🏰 Luxury rent', fmt(i.l)], ['<b>Total</b>', '<b>' + fmt(ST.incT) + '</b>']]) +
      '<h4>Monthly expenses</h4>' + tbl([['🚓 Police', fmt(e.police)], ['🚒 Fire', fmt(e.fire)], ['🏥 Health', fmt(e.health)], ['🏫 Education', fmt(e.edu)], ['⚡ Power', fmt(e.power)], ['💧 Water', fmt(e.water)], ['🌳 Parks & amenities', fmt(e.park)], ['🛣️ Roads', fmt(e.road)], ['<b>Total</b>', '<b>' + fmt(ST.expT) + '</b>']]) +
      tbl([['<b>Net per month</b>', '<b>' + (ST.net >= 0 ? '+' : '') + fmt(ST.net) + '</b>', ST.net >= 0 ? 'good' : 'bad']]);
  }
  function renderHall() {
    const pc = v => Math.round(v * 100) + '%';
    $('hallB').innerHTML = '<div class="sec"><label>City name</label><input id="nameIn" maxlength="22" value="' + S.name.replace(/"/g, '') + '"></div>' +
      '<div class="sec"><label>Tax rate: <b id="taxV">' + S.tax + '%</b></label><input id="taxR" type="range" min="0" max="20" step="1" value="' + S.tax + '"><small>Low taxes make people happy and attract growth. High taxes fill the treasury.</small></div>' +
      '<div id="budT"></div>' +
      '<h4>Citizens</h4>' + tbl([['Population', ST.pop.toLocaleString('en-US')], ['Jobs', Math.round(ST.jobs).toLocaleString('en-US')], ['Approval', Math.round(ST.appr) + '%'], ['Power supplied', pc(ST.rP) + ' (' + ST.supP + ' / ' + ST.demP + ')'], ['Water supplied', pc(ST.rW) + ' (' + ST.supW + ' / ' + ST.demW + ')'], ['Police coverage', pc(ST.cov.police)], ['Fire coverage', pc(ST.cov.fire)], ['Healthcare coverage', pc(ST.cov.health)], ['Education coverage', pc(ST.cov.edu)], ['Park coverage', pc(ST.cov.park)], ['Amenities coverage', pc(ST.cov.fun)], ['Pollution exposure', pc(ST.cov.poll)]]) +
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
      if (s.lux) h += '<br>💰 +' + fmt(s.lux * (b.eff || 1)) + '/mo'; if (d.pc) h += '<br>Serves up to ' + d.pc.toLocaleString('en-US') + ' people'; if (d.supply) h += '<br>' + (d.supply === 'power' ? '⚡' : '💧') + ' capacity ' + d.cap; if (d.upkeep) h += '<br>Upkeep ' + fmt(d.upkeep) + '/mo';
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
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { ang: Math.atan2(b.y - a.y, b.x - a.x), acc: 0, d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; painting = false; zStart = zEnd = null; return; }
    dragMoved = false; rightPan = e.button === 2; const t = tileAt(e.clientX, e.clientY); hoverT = t; if (rightPan) return;
    if (S.tool === 'road' || S.tool === 'bull') { painting = true; lastTile = null; applyPaint(t); }
    else if (S.tool === 'zone') { zStart = t; zEnd = t; }
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) { hoverT = tileAt(e.clientX, e.clientY); return; }
    if (pinch && ptrs.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; cam.zoom = clamp(pinch.z * Math.pow(d / (pinch.d || 1), 0.7), 0.45, 2.4); { const an = Math.atan2(b.y - a.y, b.x - a.x); let da = an - pinch.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; pinch.ang = an; pinch.acc += da; if (Math.abs(pinch.acc) > 1.15 && now - rotT > 0.8) { rotT = now; setRot(S.rot + (pinch.acc > 0 ? 1 : -1)); pinch.acc = 0; } } panByScreen(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my; return; }
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
    { const oo = inb(t.x, t.y) ? S.occ[idx(t.x, t.y)] : 0, ob = oo ? S.blds.get(oo) : null; if (ob && ob.type[0] !== 'z' && (S.tool === 'move' || S.tool === 'build')) { selectB(ob); return; } }
    if (S.tool === 'build' && S.toolType) { const a = anchorFor(S.toolType, t); if (e.pointerType === 'mouse') placeBuilding(S.toolType, a.x, a.y); else { pending = t; if (canPlace(S.toolType, a.x, a.y)) showConfirm(); else { hideConfirm(); toast('Not enough space there'); } } }
    else if (S.tool === 'move') inspect(t);
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hoverT = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); if (S.mode !== 'drive') cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.45, 2.4); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const KMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'down' };
  addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; const k = KMAP[e.key]; if (k) { keys[k] = 1; if (S.mode === 'drive' || e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); } if (S.mode !== 'drive') { if (e.key === 'q' || e.key === 'Q') setRot(S.rot - 1); if (e.key === 'e' || e.key === 'E') setRot(S.rot + 1); } else { if (e.key === 'h' || e.key === 'H') horn(); if (e.key === 'n' || e.key === 'N') nitro(); if (e.key === 'c' || e.key === 'C') toggleCam(); if (e.key === 'p' || e.key === 'P') photo(); }
    if (e.key === 'Escape') { if (S.mode === 'drive') stopDrive(); else { closePanels(); pending = null; hideConfirm(); } } });
  addEventListener('keyup', e => { const k = KMAP[e.key]; if (k) keys[k] = 0; });
  addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = 0; });
  function holdBtn(id, k) { const el = $(id), on = e => { e.preventDefault(); tc[k] = 1; el.classList.add('down'); }, off = e => { e.preventDefault(); tc[k] = 0; el.classList.remove('down'); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off); }
  holdBtn('bLeft', 'left'); holdBtn('bRight', 'right'); holdBtn('bGas', 'up'); holdBtn('bBrake', 'down');

  $('selX').onclick = hideSel;
  $('selSell').onclick = () => { if (!selB) return; const b = selB, d = dOf(b); hideSel(); bulldoze(b.x, b.y); toast('Sold ' + d.name + ' for ' + fmt(Math.floor(d.cost * 0.5))); };
  $('selMove').onclick = () => { if (!selB) return; const b = selB, d = dOf(b); hideSel(); moving = { type: b.type, x: b.x, y: b.y, lvl: b.lvl, v: b.v }; removeBuilding(b); S.money += d.cost; recalc(); markDirty(); S.cat = d.cat; S.toolType = b.type; S.tool = 'build'; pending = null; buildTray(d.cat); refreshBar(); toast('Tap where you want the ' + d.name + '. Tap ✖️ Done to cancel.'); };
  $('btnDone').onclick = () => setTool('move');
  function toggleCam() { S.fp = !S.fp; document.body.classList.toggle('fp', S.fp); markDirty(); toast(S.fp ? '👁 First-person view' : '🚗 Chase view'); }
  $('btnCam').onclick = toggleCam; $('bHorn').onclick = horn; $('bNitro').onclick = nitro; $('btnPhoto').onclick = photo;
  $('rotL').onclick = () => setRot(S.rot - 1); $('rotR').onclick = () => setRot(S.rot + 1); $('btnTasks').onclick = openTasks; $('tclose').onclick = closePanels; $('mclose').onclick = closePanels;
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
  G.E.rot = S.rot; G.E.map = MAP; recalc(); ST.appr = ST.apprT; cam.zoom = W < 700 ? 0.8 : 1; if (!S.tasks.length) initTasks(); setTool('move');
  let last = 0;
  function frame(ts) { requestAnimationFrame(frame); const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; now = ts / 1000; update(dt); draw(); if (carOpen) drawPreviews(now); }
  requestAnimationFrame(frame);
  window.__city = { selectB, setRot, openMayor, openTasks, openPhone, openHome, checkTasks, photo, horn, nitro, toggleCam, tryConnect, S, ST, DEFS, CARS, placeBuilding, startDrive, stopDrive, update, draw, openCars, openHall, renderCars, recalc, newCity, keys, cam, setTool, growStep, zoneRect };
})();
