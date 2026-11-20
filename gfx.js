'use strict';
/* gfx.js — all drawing for My City. Everything is drawn by code (no image downloads).
   Buildings are rendered once into cached sprites, so detailed textures stay fast. */
window.GFX = (function () {
  const TW = 64, TH = 32, ZS = 38, SPR = 2;
  const E = { g: null, now: 0, night: 0, lit: null, glows: null };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash2(a, b) {
    let h = (a | 0) * 374761393 + (b | 0) * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi + s * 131, yi + s * 17), b = hash2(xi + 1 + s * 131, yi + s * 17);
    const c = hash2(xi + s * 131, yi + 1 + s * 17), d = hash2(xi + 1 + s * 131, yi + 1 + s * 17);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, s, o) {
    let a = 0.5, f = 1, t = 0, n = 0;
    for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i); n += a; a *= 0.5; f *= 2.03; }
    return t / n;
  }
  const shCache = {};
  function shade(hex, f) {
    const k = hex + '|' + f.toFixed(2);
    let v = shCache[k]; if (v) return v;
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    v = 'rgb(' + clamp(Math.round(r * f), 0, 255) + ',' + clamp(Math.round(g * f), 0, 255) + ',' + clamp(Math.round(b * f), 0, 255) + ')';
    shCache[k] = v; return v;
  }
  const PXf = (x, y) => (x - y) * TW / 2;
  const PYf = (x, y, z) => (x + y) * TH / 2 - (z || 0) * ZS;
  const P = (x, y, z) => [PXf(x, y), PYf(x, y, z)];
  const mix = (A, B, u) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];

  function path(pts) {
    const g = E.g; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function F(pts, col, f, grad, edge) {
    const g = E.g; path(pts);
    if (grad) {
      let mn = 1e9, mx = -1e9;
      for (const p of pts) { if (p[1] < mn) mn = p[1]; if (p[1] > mx) mx = p[1]; }
      const gr = g.createLinearGradient(0, mn, 0, mx);
      gr.addColorStop(0, shade(col, f * 1.1)); gr.addColorStop(1, shade(col, f * 0.85));
      g.fillStyle = gr;
    } else g.fillStyle = shade(col, f);
    g.fill();
    if (edge !== false) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.6; g.stroke(); }
  }
  const quadF = (A, B, z0, z1) => [P(A[0], A[1], z1), P(B[0], B[1], z1), P(B[0], B[1], z0), P(A[0], A[1], z0)];
  function lot(x0, y0, x1, y1, col, edge) {
    const g = E.g; path([P(x0, y0, 0.01), P(x1, y0, 0.01), P(x1, y1, 0.01), P(x0, y1, 0.01)]);
    g.fillStyle = col; g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 0.8; g.stroke(); }
  }
  function line(a, b, col, w) { const g = E.g; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = w || 1; g.stroke(); }

  // ---------- walls, windows, boxes ----------
  function wall(A, B, z0, z1, col, f, tex) {
    const q = quadF(A, B, z0, z1); F(q, col, f, true);
    const g = E.g;
    if (tex === 'brick' || tex === 'siding') {
      const step = tex === 'brick' ? 0.065 : 0.085;
      g.beginPath();
      for (let z = z0 + step; z < z1 - 0.01; z += step) { const a = P(A[0], A[1], z), b = P(B[0], B[1], z); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.strokeStyle = tex === 'brick' ? 'rgba(60,25,15,.2)' : 'rgba(0,0,0,.09)'; g.lineWidth = 0.6; g.stroke();
      if (tex === 'brick') {
        g.beginPath(); let k = 0;
        for (let z = z0; z < z1 - 0.01; z += step, k++) {
          for (let u = (k % 2) * 0.04 + 0.04; u < 1; u += 0.08) { const a = mix(A, B, u); const p0 = P(a[0], a[1], z), p1 = P(a[0], a[1], Math.min(z1, z + step)); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
        }
        g.strokeStyle = 'rgba(60,25,15,.1)'; g.lineWidth = 0.5; g.stroke();
      }
    } else if (tex === 'ribs') {
      g.beginPath();
      for (let u = 0.04; u < 1; u += 0.05) { const a = mix(A, B, u); const p0 = P(a[0], a[1], z0), p1 = P(a[0], a[1], z1); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
      g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 0.7; g.stroke();
    }
    if (z0 < 0.2) { path(quadF(A, B, z0, z0 + 0.07)); g.fillStyle = 'rgba(0,0,0,.14)'; g.fill(); }
  }
  function boxS(x0, y0, x1, y1, z0, z1, o) {
    o = o || {}; const c = o.c || '#cccccc';
    wall([x1, y0], [x1, y1], z0, z1, o.cr || c, 0.95, o.tex);
    wall([x0, y1], [x1, y1], z0, z1, o.cl || c, 0.66, o.tex);
    if (!o.notop) F([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], o.ct || c, 1.07, false, true);
  }
  function winf(A, B, u0, u1, z0, z1, f, o) {
    o = o || {}; const g = E.g;
    const a = mix(A, B, u0), b = mix(A, B, u1);
    path([P(a[0], a[1], z1), P(b[0], b[1], z1), P(b[0], b[1], z0), P(a[0], a[1], z0)]);
    g.fillStyle = shade(o.frame || '#ebe7df', f); g.fill();
    const ins = o.ins == null ? 0.13 : o.ins, du = (u1 - u0) * ins, dz = (z1 - z0) * ins;
    const a2 = mix(A, B, u0 + du), b2 = mix(A, B, u1 - du);
    const gq = [P(a2[0], a2[1], z1 - dz), P(b2[0], b2[1], z1 - dz), P(b2[0], b2[1], z0 + dz), P(a2[0], a2[1], z0 + dz)];
    path(gq); g.fillStyle = shade(o.glass || '#78a3c6', f * 0.95); g.fill();
    // sky reflection
    path([gq[0], mix(gq[0], gq[1], 0.62), mix(gq[3], gq[2], 0.2), gq[3]]); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();
    path([mix(gq[0], gq[1], 0.7), mix(gq[0], gq[1], 0.82), mix(gq[3], gq[2], 0.42), mix(gq[3], gq[2], 0.3)]); g.fillStyle = 'rgba(255,255,255,.1)'; g.fill();
    if (o.mull) {
      g.beginPath(); const t0 = mix(gq[0], gq[1], 0.5), b0 = mix(gq[3], gq[2], 0.5), l0 = mix(gq[0], gq[3], 0.5), r0 = mix(gq[1], gq[2], 0.5);
      g.moveTo(t0[0], t0[1]); g.lineTo(b0[0], b0[1]); g.moveTo(l0[0], l0[1]); g.lineTo(r0[0], r0[1]);
      g.strokeStyle = shade(o.frame || '#ebe7df', f * 0.9); g.lineWidth = 0.7; g.stroke();
    }
    path(gq); g.strokeStyle = 'rgba(30,30,40,.35)'; g.lineWidth = 0.5; g.stroke();
    if (o.shut) {
      const sw = (u1 - u0) * 0.28, l = [mix(A, B, u0 - sw), mix(A, B, u0)], r = [mix(A, B, u1), mix(A, B, u1 + sw)];
      for (const s of [l, r]) F([P(s[0][0], s[0][1], z1), P(s[1][0], s[1][1], z1), P(s[1][0], s[1][1], z0), P(s[0][0], s[0][1], z0)], o.shut, f, false);
    }
    if (o.sill) F([P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z0 - 0.03), P(a[0], a[1], z0 - 0.03)], '#d8d2c6', f, false, false);
    if (E.lit && hash2((o.s || 0) * 31 + 7, 91) < (o.litp == null ? 0.5 : o.litp)) E.lit.push(gq);
  }
  function winGrid(A, B, z0, z1, cols, rows, mu, mz, f, o) {
    o = o || {};
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const uc = (c + 0.5) / cols; if (o.skip && uc > o.skip[0] && uc < o.skip[1]) continue;
      const oo = Object.assign({}, o); oo.s = (o.s || 0) * 53 + c * 7 + r * 13 + (o.fs || 0);
      winf(A, B, (c + mu) / cols, (c + 1 - mu) / cols, z0 + (z1 - z0) * (r + mz) / rows, z0 + (z1 - z0) * (r + 1 - mz) / rows, f, oo);
    }
  }
  function doorF(A, B, u, wu, zt, col) {
    const a = mix(A, B, u - wu / 2), b = mix(A, B, u + wu / 2), g = E.g;
    const q = [P(a[0], a[1], zt), P(b[0], b[1], zt), P(b[0], b[1], 0.01), P(a[0], a[1], 0.01)];
    path(q); g.fillStyle = shade(col, 0.85); g.fill(); g.strokeStyle = 'rgba(240,235,225,.9)'; g.lineWidth = 1.1; g.stroke();
    const k = mix(a, b, 0.8), kp = P(k[0], k[1], zt * 0.45); g.beginPath(); g.arc(kp[0], kp[1], 0.9, 0, 7); g.fillStyle = '#e8c35a'; g.fill();
  }
  function band(A, B, z0, z1, col, f) { F(quadF(A, B, z0, z1), col, f, false, false); }
  function ledge(A, B, z, out, nx, ny, col, f) {
    const a2 = [A[0] + nx * out, A[1] + ny * out], b2 = [B[0] + nx * out, B[1] + ny * out];
    F([P(A[0], A[1], z), P(B[0], B[1], z), P(b2[0], b2[1], z), P(a2[0], a2[1], z)], col, 1.05, false, true);
    F([P(a2[0], a2[1], z), P(b2[0], b2[1], z), P(b2[0], b2[1], z - 0.04), P(a2[0], a2[1], z - 0.04)], col, f, false, true);
    const g = E.g; g.beginPath();
    for (let i = 0; i <= 6; i++) { const m = mix(a2, b2, i / 6), p0 = P(m[0], m[1], z), p1 = P(m[0], m[1], z + 0.07); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
    const m0 = P(a2[0], a2[1], z + 0.07), m1 = P(b2[0], b2[1], z + 0.07); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]);
    g.strokeStyle = 'rgba(40,40,45,.75)'; g.lineWidth = 0.7; g.stroke();
  }
  function awning(A, B, u0, u1, z, drop, out, nx, ny, c1, c2) {
    const n = Math.max(4, Math.round((u1 - u0) * 12));
    for (let i = 0; i < n; i++) {
      const ua = u0 + (u1 - u0) * i / n, ub = u0 + (u1 - u0) * (i + 1) / n, a = mix(A, B, ua), b = mix(A, B, ub);
      F([P(a[0], a[1], z), P(b[0], b[1], z), P(b[0] + nx * out, b[1] + ny * out, z - drop), P(a[0] + nx * out, a[1] + ny * out, z - drop)], i % 2 ? c1 : c2, 0.95, false, false);
    }
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
    const s = Math.min(h, 3), dx = -0.65 * s, dy = 0.3 * s, pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { pts.push(P(x, y, 0.01)); pts.push(P(x + dx, y + dy, 0.01)); }
    path(hull(pts)); E.g.fillStyle = 'rgba(12,22,10,.26)'; E.g.fill();
  }
  function gableRoof(x0, y0, x1, y1, z, rh, rc, wc, rx, ov) {
    ov = ov == null ? 0.06 : ov; const g = E.g;
    let s;
    if (rx) {
      const ym = (y0 + y1) / 2;
      F([P(x1, y0, z), P(x1, y1, z), P(x1, ym, z + rh)], wc, 0.95, false);
      s = [P(x0 - ov, y1 + ov, z - 0.02), P(x1 + ov, y1 + ov, z - 0.02), P(x1 + ov, ym, z + rh), P(x0 - ov, ym, z + rh)];
      F(s, rc, 0.86, true);
    } else {
      const xm = (x0 + x1) / 2;
      F([P(x0, y1, z), P(x1, y1, z), P(xm, y1, z + rh)], wc, 0.66, false);
      s = [P(x1 + ov, y0 - ov, z - 0.02), P(x1 + ov, y1 + ov, z - 0.02), P(xm, y1 + ov, z + rh), P(xm, y0 - ov, z + rh)];
      F(s, rc, 1.0, true);
    }
    g.beginPath();
    for (let t = 0.14; t < 0.95; t += 0.14) { const a = mix(s[0], s[3], t), b = mix(s[1], s[2], t); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 0.6; g.stroke();
    line(s[3], s[2], 'rgba(255,255,255,.3)', 1);
  }
  function cyl(cx, cy, r, z0, z1, col, r1) {
    const g = E.g, rr = r * 45.25, ry = r * 22.63, x = PXf(cx, cy), yb = PYf(cx, cy, z0), yt = PYf(cx, cy, z1);
    const gr = g.createLinearGradient(x - rr, 0, x + rr, 0);
    gr.addColorStop(0, shade(col, 0.62)); gr.addColorStop(0.45, shade(col, 1.12)); gr.addColorStop(1, shade(col, 0.7));
    const rt = (r1 == null ? r : r1) * 45.25, ryt = (r1 == null ? r : r1) * 22.63;
    g.beginPath(); g.moveTo(x - rr, yb); g.ellipse(x, yb, rr, ry, 0, Math.PI, 0, true); g.lineTo(x + rt, yt); g.ellipse(x, yt, rt, ryt, 0, 0, Math.PI, false); g.closePath();
    g.fillStyle = gr; g.fill();
    g.beginPath(); g.ellipse(x, yt, rt, ryt, 0, 0, Math.PI * 2); g.fillStyle = shade(col, 1.18); g.fill();
    return [x, yt];
  }
  function blob(x, y, z, r, c0, c1, c2) {
    const g = E.g, p = P(x, y, z), rr = r * 46;
    const gr = g.createRadialGradient(p[0] - rr * 0.35, p[1] - rr * 0.35, rr * 0.1, p[0], p[1], rr);
    gr.addColorStop(0, c0); gr.addColorStop(0.6, c1); gr.addColorStop(1, c2);
    g.beginPath(); g.arc(p[0], p[1], rr, 0, 7); g.fillStyle = gr; g.fill();
  }
  function rail(A, B, h) {
    const g = E.g, n = Math.max(3, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.12));
    g.beginPath();
    for (let i = 0; i <= n; i++) { const m = mix(A, B, i / n), p0 = P(m[0], m[1], 0.01), p1 = P(m[0], m[1], h); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
    for (const z of [h * 0.45, h * 0.95]) { const a = P(A[0], A[1], z), b = P(B[0], B[1], z); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.strokeStyle = 'rgba(248,246,238,.92)'; g.lineWidth = 0.9; g.stroke();
  }
  const rnd = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

  // ---------- trees ----------
  function treeAt(cx, cy, v, sc) {
    sc = sc || 1; const g = E.g, r = rnd(v * 977 + 13);
    const sp = P(cx - 0.12 * sc, cy + 0.06 * sc, 0.01);
    g.beginPath(); g.ellipse(sp[0], sp[1], 0.3 * sc * 45, 0.3 * sc * 22, 0, 0, 7); g.fillStyle = 'rgba(12,22,10,.22)'; g.fill();
    const k = v % 6;
    if (k === 2) { // pine
      boxS(cx - 0.03, cy - 0.03, cx + 0.03, cy + 0.03, 0, 0.2 * sc, { c: '#5a3f28', notop: true });
      for (const [z, wr, hh] of [[0.12, 0.27, 0.34], [0.34, 0.21, 0.32], [0.56, 0.15, 0.3]]) {
        const base = P(cx, cy, z * sc), apex = P(cx, cy, (z + hh) * sc), wp = wr * 62 * 0.72 * sc;
        path([[apex[0], apex[1]], [base[0], base[1] + 3], [base[0] - wp, base[1]]]); g.fillStyle = '#245a38'; g.fill();
        path([[apex[0], apex[1]], [base[0], base[1] + 3], [base[0] + wp, base[1]]]); g.fillStyle = '#3a8650'; g.fill();
      }
      return;
    }
    if (k === 4) { // bush
      blob(cx, cy, 0.12 * sc, 0.17 * sc, '#7fd05f', '#3f9a3e', '#2a6e30'); blob(cx + 0.1 * sc, cy + 0.03 * sc, 0.1 * sc, 0.13 * sc, '#8bd86a', '#46a244', '#2d7433');
      return;
    }
    boxS(cx - 0.04, cy - 0.04, cx + 0.04, cy + 0.04, 0, 0.3 * sc, { c: '#6b4a2f', notop: true });
    const pal = k === 3 ? [['#f6c85a', '#dd8b2b', '#a8571a'], ['#f3b64c', '#d97a26', '#9e4d17']] : k === 5 ? [['#8bd96a', '#4aa545', '#2b7234']] : [['#82d463', '#42a040', '#2a6e30'], ['#96dc72', '#55ad4a', '#34803a']];
    const blobs = k === 5 ? [[0, 0, 0.36, 0.17], [0, 0, 0.58, 0.16], [0, 0, 0.8, 0.13]] : [[0, 0, 0.32, 0.27], [-0.09, 0.05, 0.43, 0.22], [0.09, -0.04, 0.52, 0.2], [-0.02, -0.05, 0.62, 0.15]];
    blobs.forEach((b, i) => { const c = pal[i % pal.length]; blob(cx + b[0] * sc, cy + b[1] * sc, b[2] * sc, b[3] * sc, c[0], c[1], c[2]); });
    const cp = P(cx, cy, 0.46 * sc);
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 0.22 * sc * 46; g.fillStyle = r() < 0.5 ? 'rgba(255,255,200,.22)' : 'rgba(10,50,20,.22)';
      g.fillRect(cp[0] + Math.cos(a) * d, cp[1] + Math.sin(a) * d * 0.8 - 6, 2, 1.6);
    }
  }

  // ---------- residential ----------
  function resHouse(v) {
    const wc = ['#efe2cc', '#d3dfe8', '#f0d6c2', '#e3e7d0'][v & 3], rc = ['#a5503a', '#55636f', '#7a5844', '#476a52'][v & 3], sh = ['#4a6a55', '#6a4a40', '#3e5a78', '#6b5a3a'][v & 3];
    const rx = (v & 1) === 0, gar = v >= 2;
    lot(0, 0, 1, 1, '#8ccb68', 'rgba(60,110,50,.25)');
    lot(0.44, 0.7, 0.56, 1, '#d8d1c3'); if (gar) lot(0.7, 0.7, 0.9, 1, '#b9b6b0');
    rail([0.04, 1], [0.44, 1], 0.1); rail([0.56, 1], [0.96, 1], 0.1); rail([0.96, 0.04], [0.96, 1], 0.1);
    const x0 = 0.18, y0 = 0.18, x1 = 0.68, y1 = 0.7, h = 0.46;
    shadowBox(x0, y0, gar ? 0.9 : x1, y1, h + 0.3);
    if (gar) { boxS(0.68, 0.3, 0.9, 0.7, 0, 0.3, { c: '#e6e2da', tex: 'siding' }); doorF([0.68, 0.7], [0.9, 0.7], 0.5, 0.72, 0.22, '#c9ced3'); }
    boxS(x0, y0, x1, y1, 0, h, { c: wc, tex: 'siding' });
    const A = [x0, y1], B = [x1, y1];
    winf(A, B, 0.1, 0.33, 0.13, 0.36, 0.66, { s: v * 7 + 1, mull: 1, shut: sh, sill: 1 }); winf(A, B, 0.67, 0.9, 0.13, 0.36, 0.66, { s: v * 7 + 2, mull: 1, shut: sh, sill: 1 });
    doorF(A, B, 0.5, 0.15, 0.32, '#6a4228');
    winf([x1, y0], [x1, y1], 0.3, 0.7, 0.13, 0.36, 0.95, { s: v * 7 + 3, mull: 1, sill: 1 });
    boxS(0.4, 0.7, 0.6, 0.77, 0, 0.035, { c: '#cfc7b8' });
    gableRoof(x0, y0, x1, y1, h, 0.3, rc, wc, rx);
    if (rx) boxS(0.46, 0.34, 0.53, 0.41, h + 0.14, h + 0.5, { c: '#8a4b3a' }); else boxS(0.38, 0.3, 0.45, 0.37, h + 0.14, h + 0.5, { c: '#8a4b3a' });
    treeAt(0.84, 0.86, v + 1, 0.8); blob(0.26, 0.76, 0.06, 0.09, '#8bd86a', '#46a244', '#2d7433'); blob(0.6, 0.77, 0.06, 0.08, '#f4a5b8', '#e0708d', '#b94867');
  }
  function resTown(v) {
    const cs = [['#c9a58a', '#e4d2b6'], ['#9db4c4', '#e9e2d3'], ['#c98c7a', '#efe6d6'], ['#b5c29b', '#e8dfcf']][v & 3];
    lot(0, 0, 1, 1, '#8aca67', 'rgba(60,110,50,.25)'); lot(0.06, 0.76, 0.94, 1, '#d6d0c4');
    const y0 = 0.16, y1 = 0.74, h = 0.9; shadowBox(0.08, y0, 0.92, y1, h + 0.1);
    boxS(0.08, y0, 0.5, y1, 0, h, { c: cs[0], tex: 'brick' }); boxS(0.5, y0, 0.92, y1, 0, h * 0.94, { c: cs[1], tex: 'siding' });
    for (let u = 0; u < 2; u++) {
      const xa = 0.08 + u * 0.42, xb = xa + 0.42, A = [xa, y1], B = [xb, y1], hh = u ? h * 0.94 : h;
      winf(A, B, 0.1, 0.38, 0.12, 0.38, 0.66, { s: v * 5 + u, mull: 1, sill: 1 }); doorF(A, B, 0.7, 0.2, 0.34, u ? '#3f5f78' : '#7a3a2a');
      winf(A, B, 0.1, 0.38, 0.52, hh - 0.14, 0.66, { s: v * 5 + u + 2, mull: 1, sill: 1 }); winf(A, B, 0.56, 0.88, 0.52, hh - 0.14, 0.66, { s: v * 5 + u + 4, mull: 1, sill: 1 });
    }
    winf([0.92, y0], [0.92, y1], 0.2, 0.45, 0.12, 0.38, 0.95, { s: v + 9, mull: 1 }); winf([0.92, y0], [0.92, y1], 0.55, 0.8, 0.12, 0.38, 0.95, { s: v + 10, mull: 1 });
    winf([0.92, y0], [0.92, y1], 0.2, 0.45, 0.52, 0.76, 0.95, { s: v + 11, mull: 1 }); winf([0.92, y0], [0.92, y1], 0.55, 0.8, 0.52, 0.76, 0.95, { s: v + 12, mull: 1 });
    boxS(0.06, y0 - 0.02, 0.52, y1 + 0.02, h, h + 0.06, { c: '#9a8f84' }); boxS(0.48, y0 - 0.02, 0.94, y1 + 0.02, h * 0.94, h * 0.94 + 0.06, { c: '#a69b90' });
    ledge([0.55, y1], [0.85, y1], 0.5, 0.1, 0, 1, '#8c8279', 0.66);
    boxS(0.62, 0.3, 0.7, 0.38, h * 0.94 + 0.06, h * 0.94 + 0.16, { c: '#9aa0a6' });
    treeAt(0.88, 0.9, v + 3, 0.7);
  }
  function resApt(v) {
    const wc = ['#c8b8a4', '#d2cfc8', '#b9a89a', '#c9c2b0'][v & 3], h = 2.1;
    lot(0, 0, 1, 1, '#8ccb68', 'rgba(60,110,50,.25)'); lot(0.04, 0.04, 0.96, 0.96, '#a8aca9');
    shadowBox(0.1, 0.1, 0.9, 0.9, h + 0.2);
    boxS(0.08, 0.08, 0.92, 0.92, 0, 0.32, { c: '#8f8a84', tex: 'brick' });
    boxS(0.12, 0.12, 0.88, 0.88, 0.32, h, { c: wc, tex: 'brick' });
    const L = [[0.12, 0.88], [0.88, 0.88]], R = [[0.88, 0.12], [0.88, 0.88]];
    winGrid(L[0], L[1], 0.4, h - 0.1, 4, 5, 0.2, 0.2, 0.66, { s: v, mull: 1, sill: 1, litp: 0.45 });
    winGrid(R[0], R[1], 0.4, h - 0.1, 4, 5, 0.2, 0.2, 0.95, { s: v + 30, fs: 9, mull: 1, sill: 1, litp: 0.45 });
    for (let i = 1; i < 5; i++) { const z = 0.4 + (h - 0.5) * i / 5; ledge([0.22, 0.88], [0.5, 0.88], z, 0.07, 0, 1, '#b0a291', 0.66); ledge([0.88, 0.5], [0.88, 0.78], z, 0.07, 1, 0, '#b0a291', 0.95); }
    winf(L[0], L[1], 0.3, 0.7, 0.04, 0.28, 0.66, { glass: '#2f4a60', s: v + 90, litp: 1 }); doorF(L[0], L[1], 0.5, 0.1, 0.26, '#2b3a46');
    boxS(0.1, 0.1, 0.9, 0.9, h - 0.02, h + 0.07, { c: '#a89684' });
    boxS(0.2, 0.2, 0.42, 0.4, h + 0.07, h + 0.22, { c: '#9aa0a6' }); cyl(0.7, 0.3, 0.1, h + 0.07, h + 0.3, '#b9805a');
  }
  function bigHouse() {
    lot(0, 0, 2, 2, '#8ccb68', 'rgba(60,110,50,.25)'); lot(0.9, 1.5, 1.1, 2, '#d8d1c3'); lot(1.5, 1.3, 1.95, 2, '#b9b6b0');
    rail([0.06, 2], [0.9, 2], 0.1); rail([1.1, 2], [1.5, 2], 0.1); rail([1.95, 0.06], [1.95, 2], 0.1);
    shadowBox(0.2, 0.3, 1.9, 1.5, 1.3);
    boxS(1.35, 0.7, 1.9, 1.3, 0, 0.46, { c: '#efe6d2', tex: 'siding' }); doorF([1.35, 1.3], [1.9, 1.3], 0.5, 0.65, 0.3, '#cfd2d6');
    boxS(0.2, 0.3, 1.4, 1.5, 0, 0.62, { c: '#f1ede3', tex: 'siding' });
    const A = [0.2, 1.5], B = [1.4, 1.5];
    winf(A, B, 0.06, 0.22, 0.16, 0.5, 0.66, { s: 1, mull: 1, shut: '#586878', sill: 1 }); winf(A, B, 0.28, 0.44, 0.16, 0.5, 0.66, { s: 2, mull: 1, shut: '#586878', sill: 1 });
    winf(A, B, 0.78, 0.94, 0.16, 0.5, 0.66, { s: 3, mull: 1, shut: '#586878', sill: 1 }); winf(A, B, 0.56, 0.72, 0.16, 0.5, 0.66, { s: 4, mull: 1, shut: '#586878', sill: 1 });
    winf([1.4, 0.3], [1.4, 1.5], 0.15, 0.4, 0.16, 0.5, 0.95, { s: 5, mull: 1 }); winf([1.4, 0.3], [1.4, 1.5], 0.6, 0.85, 0.16, 0.5, 0.95, { s: 6, mull: 1 });
    boxS(0.62, 1.5, 0.98, 1.64, 0, 0.05, { c: '#cfc7b8' }); doorF([0.7, 1.5], [0.9, 1.5], 0.5, 0.45, 0.36, '#5f3a24');
    gableRoof(0.2, 0.3, 1.4, 1.5, 0.62, 0.55, '#586878', '#f1ede3', true); gableRoof(1.35, 0.7, 1.9, 1.3, 0.46, 0.3, '#586878', '#efe6d2', false);
    boxS(0.55, 0.78, 0.7, 0.93, 0.8, 1.35, { c: '#8a4b3a' });
    treeAt(0.3, 1.78, 2, 1); treeAt(1.7, 0.4, 4, 0.9); blob(0.5, 1.7, 0.06, 0.1, '#f4a5b8', '#e0708d', '#b94867'); blob(1.2, 1.7, 0.06, 0.1, '#ffe27a', '#e8b93a', '#b88a20');
  }
  function apartment2() {
    lot(0, 0, 2, 2, '#8ccb68'); lot(0.1, 0.1, 1.9, 1.9, '#a8aca9');
    const h = 2.3; shadowBox(0.2, 0.2, 1.8, 1.8, h + 0.2);
    boxS(0.18, 0.18, 1.82, 1.82, 0, 0.36, { c: '#8f8a84', tex: 'brick' }); boxS(0.24, 0.24, 1.76, 1.76, 0.36, h, { c: '#cdb9a4', tex: 'brick' });
    const L = [[0.24, 1.76], [1.76, 1.76]], R = [[1.76, 0.24], [1.76, 1.76]];
    winGrid(L[0], L[1], 0.46, h - 0.1, 8, 5, 0.2, 0.2, 0.66, { s: 3, mull: 1, sill: 1, skip: [0.44, 0.56] }); winGrid(R[0], R[1], 0.46, h - 0.1, 8, 5, 0.2, 0.2, 0.95, { s: 33, fs: 9, mull: 1, sill: 1 });
    winf(L[0], L[1], 0.36, 0.64, 0.05, 0.32, 0.66, { glass: '#2f4a60', s: 80, litp: 1 }); doorF(L[0], L[1], 0.5, 0.08, 0.3, '#2b3a46');
    boxS(0.2, 0.2, 1.8, 1.8, h - 0.02, h + 0.08, { c: '#a89684' }); boxS(0.5, 0.5, 0.9, 0.85, h + 0.08, h + 0.26, { c: '#9aa0a6' }); cyl(1.4, 0.6, 0.14, h + 0.08, h + 0.36, '#b9805a');
  }
  function villa() {
    lot(0, 0, 3, 3, '#8ccb68'); lot(0.05, 2.05, 0.95, 3, '#9a9ca1'); lot(1.05, 2.1, 2.95, 2.9, '#d8d2c4');
    shadowBox(0, 0, 3, 2, 1.5);
    path([P(1.2, 2.25, 0.02), P(2.8, 2.25, 0.02), P(2.8, 2.75, 0.02), P(1.2, 2.75, 0.02)]);
    const g = E.g, gr = g.createLinearGradient(...P(1.2, 2.25, 0), ...P(2.8, 2.75, 0)); gr.addColorStop(0, '#74d6ec'); gr.addColorStop(0.5, '#a2eaf6'); gr.addColorStop(1, '#3fadd0'); g.fillStyle = gr; g.fill(); g.strokeStyle = '#eee'; g.lineWidth = 1.2; g.stroke();
    boxS(0, 0, 3, 2, 0, 0.7, { c: '#f3f2ee' });
    winGrid([0.1, 2], [2.9, 2], 0.1, 0.62, 3, 1, 0.08, 0.1, 0.66, { glass: '#6f9cc0', s: 1, litp: 0.8, ins: 0.06, frame: '#2a2e33' }); winf([3, 0.1], [3, 1.9], 0.1, 0.45, 0.1, 0.62, 0.95, { glass: '#6f9cc0', s: 2, ins: 0.06, frame: '#2a2e33' }); winf([3, 0.1], [3, 1.9], 0.55, 0.9, 0.1, 0.62, 0.95, { glass: '#6f9cc0', s: 3, ins: 0.06, frame: '#2a2e33' });
    boxS(-0.05, -0.05, 3.05, 2.05, 0.7, 0.77, { c: '#ffffff' }); boxS(0.25, 0.2, 2.0, 1.75, 0.77, 1.4, { c: '#e9e6df' });
    winGrid([0.25, 1.75], [2.0, 1.75], 0.84, 1.34, 2, 1, 0.06, 0.08, 0.66, { glass: '#6f9cc0', s: 5, litp: 0.8, ins: 0.06, frame: '#2a2e33' }); winf([2.0, 0.2], [2.0, 1.75], 0.15, 0.85, 0.84, 1.34, 0.95, { glass: '#6f9cc0', s: 7, ins: 0.06, frame: '#2a2e33' });
    boxS(0.2, 0.15, 2.05, 1.8, 1.4, 1.46, { c: '#ffffff' });
    treeAt(0.4, 2.6, 5, 1.1); treeAt(2.8, 0.5, 1, 1.0); blob(1.0, 2.0, 0.08, 0.1, '#f4a5b8', '#e0708d', '#b94867');
  }
  function mansion() {
    lot(0, 0, 4, 3, '#8ccb68'); lot(1.4, 2.05, 2.6, 3, '#b9b3a6'); lot(1.7, 2.0, 2.3, 3, '#d9d3c5');
    shadowBox(0, 0, 4, 2, 1.8);
    boxS(0, 0, 4, 2, 0, 1.5, { c: '#efe6d2', tex: 'siding' });
    winGrid([0, 2], [4, 2], 0.2, 1.4, 8, 2, 0.2, 0.12, 0.66, { s: 1, mull: 1, skip: [0.36, 0.64], shut: '#3a3f4a', sill: 1 }); winGrid([4, 0], [4, 2], 0.2, 1.4, 4, 2, 0.2, 0.12, 0.95, { s: 9, fs: 3, mull: 1, sill: 1 });
    doorF([0, 2], [4, 2], 0.5, 0.12, 0.7, '#4a3326');
    for (let i = 0; i < 4; i++) { const cx = 1.45 + i * 0.37; boxS(cx - 0.05, 2.4, cx + 0.05, 2.5, 0, 1.2, { c: '#f6f3ea' }); }
    boxS(1.3, 2.0, 2.7, 2.58, 1.2, 1.3, { c: '#f6f3ea' }); F([P(1.3, 2.58, 1.3), P(2.7, 2.58, 1.3), P(2.0, 2.58, 1.62)], '#efe6d2', 0.66, false);
    boxS(-0.05, -0.05, 4.05, 2.05, 1.5, 1.62, { c: '#3a3f4a' }); boxS(0.6, 0.4, 3.4, 1.6, 1.62, 1.82, { c: '#4d5463' });
    boxS(0.1, 2.6, 1.2, 2.85, 0, 0.14, { c: '#2f6b34' }); boxS(2.8, 2.6, 3.9, 2.85, 0, 0.14, { c: '#2f6b34' });
    treeAt(0.4, 2.5, 5, 1.2); treeAt(3.7, 2.4, 1, 1.2); treeAt(3.8, 0.3, 3, 1.1);
  }
  function lumTower() {
    lot(0, 0, 3, 3, '#a9adb0'); lot(0, 0, 0.3, 3, '#8ccb68'); shadowBox(0.2, 0.2, 2.8, 2.8, 10);
    boxS(0, 0, 3, 3, 0, 0.35, { c: '#2b3a46' }); const a = 0.18, c = 2.82, h = 10;
    boxS(a, a, c, c, 0.35, h, { c: '#6a90ad' });
    winGrid([a, c], [c, c], 0.42, h - 0.08, 8, 22, 0.08, 0.1, 0.66, { glass: '#a4cdea', s: 1, litp: 0.5, ins: 0.05, frame: '#7d9bb2' });
    winGrid([c, a], [c, c], 0.42, h - 0.08, 8, 22, 0.08, 0.1, 0.95, { glass: '#a4cdea', s: 5, fs: 5, litp: 0.5, ins: 0.05, frame: '#7d9bb2' });
    doorF([a, c], [c, c], 0.5, 0.18, 0.3, '#1d2a35');
    boxS(0.6, 0.6, 2.4, 2.4, h, h + 1, { c: '#7da0b8' }); winGrid([0.6, 2.4], [2.4, 2.4], h + 0.06, h + 0.95, 4, 3, 0.1, 0.1, 0.66, { glass: '#a4cdea', s: 3, ins: 0.05 }); winGrid([2.4, 0.6], [2.4, 2.4], h + 0.06, h + 0.95, 4, 3, 0.1, 0.1, 0.95, { glass: '#a4cdea', s: 4, ins: 0.05 });
    boxS(1.2, 1.2, 1.8, 1.8, h + 1, h + 1.3, { c: '#8aa9be' }); line(P(1.5, 1.5, h + 1.3), P(1.5, 1.5, h + 2.4), '#cfd6dc', 1.4);
  }

  // ---------- commercial ----------
  function comShop(v) {
    const col = ['#d97757', '#6fa8a0', '#d9b44a', '#8e7cc3', '#c0504d'][v % 5];
    lot(0, 0, 1, 1, '#aeb1b3', 'rgba(0,0,0,.15)'); lot(0, 0.82, 1, 1, '#9da0a2');
    const y0 = 0.2, y1 = 0.78; shadowBox(0.1, y0, 0.9, y1, 0.8);
    boxS(0.1, y0, 0.9, y1, 0, 0.54, { c: col, tex: 'siding' });
    const A = [0.1, y1], B = [0.9, y1];
    winf(A, B, 0.08, 0.5, 0.07, 0.38, 0.66, { glass: '#2a4056', s: v + 1, litp: 1, ins: 0.06, frame: '#3a3d42' }); winf(A, B, 0.56, 0.78, 0.07, 0.38, 0.66, { glass: '#2a4056', s: v + 2, litp: 1, ins: 0.06, frame: '#3a3d42' }); doorF(A, B, 0.88, 0.1, 0.34, '#3a3d42');
    awning(A, B, 0.06, 0.8, 0.42, 0.1, 0.2, 0, 1, '#f4f1ea', '#b03a2e');
    band([0.12, y1], [0.88, y1], 0.44, 0.52, '#f3efe4', 0.66);
    winf([0.9, y0], [0.9, y1], 0.25, 0.75, 0.14, 0.4, 0.95, { s: v + 3, ins: 0.08 });
    boxS(0.08, y0 - 0.02, 0.92, y1 + 0.02, 0.54, 0.6, { c: '#e8e2d2' }); boxS(0.2, 0.3, 0.45, 0.5, 0.6, 0.74, { c: '#9aa0a6' }); cyl(0.7, 0.4, 0.09, 0.6, 0.72, '#8a9097');
    treeAt(0.9, 0.93, v, 0.5);
  }
  function comMid(v) {
    const wc = ['#d8c9b0', '#c7cdd2', '#e0cfc1', '#cdd6c6'][v & 3], h = 1.35;
    lot(0, 0, 1, 1, '#aeb1b3', 'rgba(0,0,0,.15)'); shadowBox(0.08, 0.14, 0.92, 0.84, h + 0.2);
    boxS(0.08, 0.14, 0.92, 0.84, 0, h, { c: wc, tex: 'brick' });
    const A = [0.08, 0.84], B = [0.92, 0.84], R = [[0.92, 0.14], [0.92, 0.84]];
    winf(A, B, 0.06, 0.94, 0.04, 0.4, 0.66, { glass: '#2a4056', s: v, litp: 1, ins: 0.05, frame: '#3a3d42', mull: 1 }); doorF(A, B, 0.5, 0.1, 0.36, '#3a3d42');
    awning(A, B, 0.06, 0.94, 0.46, 0.08, 0.12, 0, 1, '#2f6a8a', '#f4f1ea');
    winGrid(A, B, 0.55, h - 0.1, 5, 2, 0.2, 0.15, 0.66, { s: v + 4, mull: 1, sill: 1 }); winGrid(R[0], R[1], 0.08, h - 0.1, 4, 3, 0.2, 0.15, 0.95, { s: v + 40, fs: 3, mull: 1, sill: 1 });
    ledge([0.3, 0.84], [0.7, 0.84], 0.55, 0.08, 0, 1, '#9a9086', 0.66);
    boxS(0.06, 0.12, 0.94, 0.86, h, h + 0.08, { c: '#a69b90' }); boxS(0.2, 0.3, 0.5, 0.55, h + 0.08, h + 0.24, { c: '#9aa0a6' }); boxS(0.6, 0.3, 0.8, 0.4, h + 0.08, h + 0.5, { c: '#d9c36a' });
  }
  function comTower(v) {
    const gc = ['#5f8fb0', '#4f9a9a', '#6b86b8', '#7f93a3'][v & 3], h = 3.2;
    lot(0, 0, 1, 1, '#aeb1b3', 'rgba(0,0,0,.15)'); shadowBox(0.16, 0.18, 0.84, 0.82, h + 0.5);
    boxS(0.08, 0.1, 0.92, 0.9, 0, 0.4, { c: '#6d7a86' }); winf([0.08, 0.9], [0.92, 0.9], 0.08, 0.92, 0.05, 0.32, 0.66, { glass: '#243b52', s: v, litp: 1, ins: 0.05, frame: '#2f3a44', mull: 1 });
    boxS(0.16, 0.18, 0.84, 0.82, 0.4, h, { c: gc });
    winGrid([0.16, 0.82], [0.84, 0.82], 0.46, h - 0.06, 6, 12, 0.06, 0.1, 0.66, { glass: '#bfe0f3', s: v + 1, litp: 0.5, ins: 0.04, frame: '#8fa7b8' });
    winGrid([0.84, 0.18], [0.84, 0.82], 0.46, h - 0.06, 6, 12, 0.06, 0.1, 0.95, { glass: '#bfe0f3', s: v + 17, fs: 6, litp: 0.5, ins: 0.04, frame: '#8fa7b8' });
    boxS(0.26, 0.28, 0.74, 0.72, h, h + 0.45, { c: gc }); winGrid([0.26, 0.72], [0.74, 0.72], h + 0.04, h + 0.42, 4, 2, 0.08, 0.1, 0.66, { glass: '#bfe0f3', s: v + 3, ins: 0.04 }); winGrid([0.74, 0.28], [0.74, 0.72], h + 0.04, h + 0.42, 4, 2, 0.08, 0.1, 0.95, { glass: '#bfe0f3', s: v + 5, ins: 0.04 });
    boxS(0.4, 0.4, 0.6, 0.6, h + 0.45, h + 0.62, { c: '#9aa7b2' }); line(P(0.5, 0.5, h + 0.62), P(0.5, 0.5, h + 1.3), '#cfd6dc', 1.3);
  }

  // ---------- industrial ----------
  function indWare(v) {
    lot(0, 0, 1, 1, '#a39f96', 'rgba(0,0,0,.15)'); lot(0.05, 0.8, 0.95, 1, '#8f8b83');
    shadowBox(0.08, 0.22, 0.92, 0.78, 0.7);
    boxS(0.08, 0.22, 0.92, 0.78, 0, 0.5, { c: ['#c9ccd0', '#c8d3c8', '#d3cfc4', '#c6ced8'][v & 3], tex: 'ribs' });
    const A = [0.08, 0.78], B = [0.92, 0.78];
    for (const u of [0.22, 0.5, 0.78]) { const a = mix(A, B, u - 0.1), b = mix(A, B, u + 0.1); F([P(a[0], a[1], 0.3), P(b[0], b[1], 0.3), P(b[0], b[1], 0.01), P(a[0], a[1], 0.01)], '#7a8086', 0.66, false); for (let z = 0.06; z < 0.3; z += 0.05) { const p0 = P(a[0], a[1], z), p1 = P(b[0], b[1], z); line(p0, p1, 'rgba(0,0,0,.25)', 0.6); } }
    band(A, B, 0.38, 0.46, '#d0452f', 0.66);
    boxS(0.06, 0.2, 0.94, 0.8, 0.5, 0.56, { c: '#8f949a' }); for (let i = 0; i < 3; i++) boxS(0.16 + i * 0.26, 0.32, 0.3 + i * 0.26, 0.68, 0.56, 0.62, { c: '#a9d0e6' });
    boxS(0.1, 0.84, 0.36, 0.96, 0, 0.18, { c: '#b9473c', tex: 'ribs' }); boxS(0.4, 0.84, 0.66, 0.96, 0, 0.18, { c: '#2f6f9f', tex: 'ribs' }); boxS(0.14, 0.86, 0.34, 0.94, 0.18, 0.34, { c: '#d4a137', tex: 'ribs' });
  }
  function stack(cx, cy, z1, r) {
    cyl(cx, cy, r, 0, z1, '#d9d6d0');
    for (let i = 0; i < 3; i++) { const z = z1 - 0.12 - i * 0.26, p0 = P(cx - r, cy + r, z), p1 = P(cx + r, cy - r, z); line([PXf(cx, cy) - r * 45.25, PYf(cx, cy, z)], [PXf(cx, cy) + r * 45.25, PYf(cx, cy, z)], 'rgba(200,40,40,.85)', 3); }
    return PYf(cx, cy, z1);
  }
  function indFactory(v) {
    lot(0, 0, 1, 1, '#a39f96', 'rgba(0,0,0,.15)'); lot(0, 0.86, 1, 1, '#8f8b83'); shadowBox(0.08, 0.26, 0.9, 0.84, 1.3);
    boxS(0.08, 0.3, 0.74, 0.84, 0, 0.56, { c: '#c1665b', tex: 'brick' });
    const A = [0.08, 0.84], B = [0.74, 0.84];
    winGrid(A, B, 0.2, 0.46, 5, 1, 0.14, 0.12, 0.66, { glass: '#8fb4cc', s: v, ins: 0.06 });
    winGrid([0.74, 0.3], [0.74, 0.84], 0.2, 0.46, 3, 1, 0.14, 0.12, 0.95, { glass: '#8fb4cc', s: v + 5, ins: 0.06 });
    for (let k = 0; k < 3; k++) {
      const xa = 0.08 + 0.22 * k, xb = xa + 0.22;
      F([P(xa, 0.3, 0.56), P(xa, 0.84, 0.56), P(xb, 0.84, 0.74), P(xb, 0.3, 0.74)], '#8a9096', 0.9, true);
      F([P(xb, 0.3, 0.74), P(xb, 0.84, 0.74), P(xb, 0.84, 0.56), P(xb, 0.3, 0.56)], '#b8dcef', 0.95, false);
    }
    boxS(0.74, 0.34, 0.92, 0.6, 0, 0.4, { c: '#9aa0a6', tex: 'ribs' }); cyl(0.83, 0.74, 0.1, 0, 0.5, '#aeb4ba');
    stack(0.6, 0.38, 1.45, 0.07);
  }
  function indPlant(v) {
    lot(0, 0, 1, 1, '#a39f96', 'rgba(0,0,0,.15)'); shadowBox(0.06, 0.2, 0.94, 0.9, 1.6);
    boxS(0.06, 0.4, 0.62, 0.9, 0, 0.6, { c: '#9ea5ad', tex: 'ribs' }); winGrid([0.06, 0.9], [0.62, 0.9], 0.3, 0.5, 5, 1, 0.14, 0.1, 0.66, { glass: '#8fb4cc', s: v + 2, ins: 0.06 });
    boxS(0.04, 0.38, 0.64, 0.92, 0.6, 0.66, { c: '#6f757c' });
    cyl(0.78, 0.7, 0.14, 0, 0.8, '#d9dde0'); cyl(0.78, 0.7, 0.14, 0.8, 0.88, '#cfd3d6', 0.04);
    cyl(0.78, 0.4, 0.12, 0, 0.7, '#cfd3d6');
    line(P(0.62, 0.6, 0.45), P(0.78, 0.7, 0.45), '#4f565c', 2.2); line(P(0.62, 0.55, 0.3), P(0.78, 0.4, 0.3), '#4f565c', 2.2);
    stack(0.2, 0.32, 1.75, 0.07); stack(0.42, 0.3, 1.55, 0.06);
  }

  // ---------- services & utilities ----------
  function police() {
    lot(0, 0, 2, 2, '#9ea1a4'); lot(0, 0, 2, 0.15, '#8ccb68'); shadowBox(0.2, 0.3, 1.8, 1.4, 1.1);
    boxS(0.2, 0.3, 1.8, 1.4, 0, 0.9, { c: '#dfe3ea' }); const A = [0.2, 1.4], B = [1.8, 1.4];
    band(A, B, 0.46, 0.58, '#2457a6', 0.66); band([1.8, 0.3], [1.8, 1.4], 0.46, 0.58, '#2457a6', 0.95);
    winGrid(A, B, 0.1, 0.4, 6, 1, 0.16, 0.12, 0.66, { glass: '#7fa6c8', s: 1, ins: 0.08, mull: 1 }); winGrid(A, B, 0.62, 0.84, 6, 1, 0.16, 0.1, 0.66, { glass: '#7fa6c8', s: 2, ins: 0.08 });
    winGrid([1.8, 0.3], [1.8, 1.4], 0.1, 0.8, 3, 2, 0.2, 0.15, 0.95, { s: 3, ins: 0.08 });
    boxS(0.75, 1.4, 1.25, 1.62, 0.0, 0.5, { c: '#e9edf2', notop: true }); boxS(0.7, 1.35, 1.3, 1.65, 0.5, 0.56, { c: '#2457a6' }); doorF(A, B, 0.5, 0.2, 0.34, '#2f4a64');
    boxS(0.2, 0.3, 1.8, 1.4, 0.9, 0.97, { c: '#c4c9d0' }); boxS(0.9, 0.55, 1.1, 0.7, 0.97, 1.03, { c: '#2457a6' }); boxS(0.9, 0.55, 0.96, 0.7, 1.03, 1.1, { c: '#d9342b' }); boxS(1.04, 0.55, 1.1, 0.7, 1.03, 1.1, { c: '#2c6fe0' });
    line(P(1.6, 0.5, 0.97), P(1.6, 0.5, 1.7), '#cfd6dc', 1.2);
    for (let i = 0; i < 4; i++) line(P(0.3 + i * 0.35, 1.72, 0.01), P(0.3 + i * 0.35, 1.95, 0.01), 'rgba(255,255,255,.7)', 1);
    treeAt(1.85, 1.75, 2, 0.8);
  }
  function fire() {
    lot(0, 0, 2, 2, '#a3a5a8'); lot(0, 0, 2, 0.12, '#8ccb68'); shadowBox(0.2, 0.3, 1.85, 1.35, 1.5);
    boxS(0.2, 0.3, 1.45, 1.35, 0, 0.8, { c: '#c4402f', tex: 'brick' }); const A = [0.2, 1.35], B = [1.45, 1.35];
    for (const u of [0.3, 0.7]) { const a = mix(A, B, u - 0.17), b = mix(A, B, u + 0.17); F([P(a[0], a[1], 0.55), P(b[0], b[1], 0.55), P(b[0], b[1], 0.01), P(a[0], a[1], 0.01)], '#c7ccd1', 0.66, false); for (let z = 0.06; z < 0.55; z += 0.06) line(P(a[0], a[1], z), P(b[0], b[1], z), 'rgba(0,0,0,.22)', 0.6); }
    band(A, B, 0.6, 0.68, '#f2c230', 0.66); winGrid([1.45, 0.3], [1.45, 1.35], 0.2, 0.6, 3, 1, 0.2, 0.1, 0.95, { s: 4, ins: 0.08 });
    boxS(1.4, 0.35, 1.85, 0.8, 0, 1.5, { c: '#b3382a', tex: 'brick' }); winGrid([1.4, 0.8], [1.85, 0.8], 0.9, 1.3, 1, 1, 0.2, 0.1, 0.66, { s: 5 }); winGrid([1.85, 0.35], [1.85, 0.8], 0.9, 1.3, 1, 1, 0.2, 0.1, 0.95, { s: 6 }); boxS(1.36, 0.31, 1.89, 0.84, 1.5, 1.58, { c: '#6f757c' });
    boxS(0.2, 0.3, 1.45, 1.35, 0.8, 0.86, { c: '#8f949a' });
    for (let i = 0; i < 3; i++) line(P(0.35 + i * 0.5, 1.75, 0.01), P(0.35 + i * 0.5, 1.98, 0.01), 'rgba(255,255,255,.6)', 1);
  }
  function clinic() {
    lot(0, 0, 2, 2, '#9fa3a6'); lot(0, 0, 2, 0.15, '#8ccb68'); shadowBox(0.2, 0.25, 1.8, 1.4, 1.1);
    boxS(0.2, 0.25, 1.8, 1.4, 0, 0.95, { c: '#f2f4f5' }); const A = [0.2, 1.4], B = [1.8, 1.4];
    band(A, B, 0.0, 0.1, '#6fbf8a', 0.66); winGrid(A, B, 0.2, 0.85, 7, 2, 0.16, 0.14, 0.66, { glass: '#8fbfd6', s: 7, ins: 0.08, mull: 1, skip: [0.42, 0.58] }); winGrid([1.8, 0.25], [1.8, 1.4], 0.2, 0.85, 3, 2, 0.2, 0.14, 0.95, { glass: '#8fbfd6', s: 8, ins: 0.08 });
    const cr = [0.4, 0.6], g = E.g;
    for (const [u0, u1, z0, z1] of [[0.455, 0.545, 0.55, 0.86], [0.41, 0.59, 0.64, 0.77]]) { const a = mix(A, B, u0), b = mix(A, B, u1); F([P(a[0], a[1], z1), P(b[0], b[1], z1), P(b[0], b[1], z0), P(a[0], a[1], z0)], '#d9342b', 0.66, false, false); }
    boxS(0.75, 1.4, 1.25, 1.7, 0, 0.45, { c: '#cfe5ef', notop: true }); boxS(0.7, 1.35, 1.3, 1.75, 0.45, 0.5, { c: '#6fbf8a' }); doorF(A, B, 0.5, 0.14, 0.32, '#4a6a78');
    boxS(0.2, 0.25, 1.8, 1.4, 0.95, 1.0, { c: '#cfd3d6' }); boxS(1.2, 0.5, 1.6, 0.9, 1.0, 1.12, { c: '#9aa0a6' });
    F([P(0.5, 0.5, 1.01), P(0.9, 0.5, 1.01), P(0.9, 0.9, 1.01), P(0.5, 0.9, 1.01)], '#d9342b', 1.0, false);
    treeAt(1.85, 1.8, 4, 0.7); treeAt(0.2, 1.8, 3, 0.7);
  }
  function school() {
    lot(0, 0, 3, 2, '#c9b98c'); lot(0, 0, 3, 0.12, '#8ccb68'); lot(0.1, 1.35, 2.9, 2, '#d6c8a0'); shadowBox(0.2, 0.2, 2.8, 1.1, 1.2);
    boxS(0.2, 0.2, 2.8, 1.1, 0, 0.85, { c: '#c77a5a', tex: 'brick' }); const A = [0.2, 1.1], B = [2.8, 1.1];
    winGrid(A, B, 0.1, 0.4, 10, 1, 0.18, 0.12, 0.66, { s: 1, ins: 0.08, mull: 1, skip: [0.44, 0.56] }); winGrid(A, B, 0.5, 0.78, 10, 1, 0.18, 0.1, 0.66, { s: 2, ins: 0.08, mull: 1 });
    winGrid([2.8, 0.2], [2.8, 1.1], 0.1, 0.78, 3, 2, 0.2, 0.14, 0.95, { s: 3, ins: 0.08 });
    boxS(1.2, 1.1, 1.8, 1.3, 0, 0.6, { c: '#e8dcc4', notop: true }); doorF(A, B, 0.5, 0.1, 0.3, '#3f5f78'); boxS(1.15, 1.05, 1.85, 1.35, 0.6, 0.66, { c: '#e8dcc4' });
    boxS(0.2, 0.2, 2.8, 1.1, 0.85, 0.92, { c: '#a8603f' }); boxS(1.3, 0.4, 1.7, 0.8, 0.92, 1.25, { c: '#e8dcc4' }); F([P(1.25, 0.8, 1.25), P(1.75, 0.8, 1.25), P(1.5, 0.8, 1.5)], '#e8dcc4', 0.66, false); F([P(1.75, 0.35, 1.25), P(1.75, 0.85, 1.25), P(1.5, 0.6, 1.5)], '#8a4b3a', 0.95, false);
    line(P(2.5, 1.5, 0.01), P(2.5, 1.5, 1.1), '#cfd6dc', 1.2); F([P(2.5, 1.5, 1.1), P(2.5, 1.5, 0.95), P(2.8, 1.5, 1.02)], '#d9342b', 1.0, false);
    boxS(0.3, 1.55, 0.9, 1.9, 0.0, 0.01, { c: '#4d7a4a' }); line(P(0.6, 1.55, 0.01), P(0.6, 1.9, 0.01), 'rgba(255,255,255,.8)', 1);
    treeAt(0.2, 1.75, 2, 0.8); treeAt(2.8, 1.85, 5, 0.7);
  }
  function park() {
    lot(0, 0, 2, 2, '#7ec45c'); const g = E.g;
    g.beginPath(); const pp = [[0, 1.4], [0.5, 1.2], [1, 1.0], [1.5, 0.7], [2, 0.5]].map(p => P(p[0], p[1], 0.02)); g.moveTo(pp[0][0], pp[0][1]); for (let i = 1; i < pp.length; i++) g.lineTo(pp[i][0], pp[i][1]); g.strokeStyle = '#dcd4bf'; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
    g.beginPath(); const p2 = [[1.0, 0], [1.0, 0.5], [1.0, 1.0], [0.9, 1.5], [0.8, 2.0]].map(p => P(p[0], p[1], 0.02)); g.moveTo(p2[0][0], p2[0][1]); for (let i = 1; i < p2.length; i++) g.lineTo(p2[i][0], p2[i][1]); g.stroke(); g.lineCap = 'butt';
    const pc = P(1.45, 1.4, 0.02); g.beginPath(); g.ellipse(pc[0], pc[1], 26, 13, 0, 0, 7); const wg = g.createLinearGradient(pc[0] - 26, pc[1], pc[0] + 26, pc[1]); wg.addColorStop(0, '#6bd0e8'); wg.addColorStop(1, '#3a9fc4'); g.fillStyle = wg; g.fill(); g.strokeStyle = '#d6cfc0'; g.lineWidth = 2; g.stroke();
    boxS(0.45, 0.9, 0.7, 1.0, 0, 0.1, { c: '#8a5a3a' }); boxS(1.2, 0.3, 1.45, 0.4, 0, 0.1, { c: '#8a5a3a' });
    for (const [x, y, c] of [[0.3, 0.4, '#f4a5b8'], [0.5, 0.5, '#ffe27a'], [0.4, 1.7, '#ffffff'], [1.7, 1.8, '#f4a5b8'], [0.2, 0.9, '#ffe27a']]) blob(x, y, 0.03, 0.05, c, c, '#c85a7a');
    treeAt(0.3, 0.3, 0, 1.2); treeAt(1.7, 0.3, 3, 1.1); treeAt(0.4, 1.8, 2, 1.2); treeAt(1.5, 1.85, 1, 1.0); treeAt(1.85, 1.0, 5, 1.0);
  }
  function coal() {
    lot(0, 0, 3, 3, '#8c8f90', 'rgba(0,0,0,.2)'); shadowBox(0.1, 0.3, 2.9, 2.7, 2.2);
    boxS(0.15, 1.6, 1.7, 2.8, 0, 0.9, { c: '#9aa0a6', tex: 'ribs' }); winGrid([0.15, 2.8], [1.7, 2.8], 0.4, 0.75, 6, 1, 0.14, 0.1, 0.66, { glass: '#8fb4cc', s: 1, ins: 0.06 }); boxS(0.1, 1.55, 1.75, 2.85, 0.9, 0.97, { c: '#5f656b' });
    for (const [cx, cy] of [[2.0, 1.0], [1.0, 0.9]]) { const x = PXf(cx, cy), yb = PYf(cx, cy, 0), yt = PYf(cx, cy, 1.7), g = E.g, gr = g.createLinearGradient(x - 40, 0, x + 40, 0); gr.addColorStop(0, '#9a9792'); gr.addColorStop(0.5, '#d5d2cc'); gr.addColorStop(1, '#85827d'); g.beginPath(); g.moveTo(x - 42, yb); g.ellipse(x, yb, 42, 21, 0, Math.PI, 0, true); g.lineTo(x + 26, yt); g.ellipse(x, yt, 26, 13, 0, 0, Math.PI, false); g.closePath(); g.fillStyle = gr; g.fill(); g.beginPath(); g.ellipse(x, yt, 26, 13, 0, 0, 7); g.fillStyle = '#3a3a3a'; g.fill(); }
    stack(2.6, 2.1, 2.3, 0.1); stack(2.3, 2.5, 2.0, 0.09);
    blob(0.5, 0.7, 0.05, 0.22, '#4a4a4a', '#2b2b2b', '#151515'); blob(0.8, 0.5, 0.05, 0.16, '#555', '#2e2e2e', '#111');
    line(P(0.7, 1.4, 0.3), P(1.7, 1.55, 0.6), '#4f565c', 2.2);
  }
  function solar() {
    lot(0, 0, 3, 2, '#9aa56f', 'rgba(0,0,0,.15)'); shadowBox(0.1, 0.1, 2.9, 1.9, 0.4); const g = E.g;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 0.12 + c * 0.95, y = 0.1 + r * 0.6, w = 0.8, d = 0.4;
      const q = [P(x, y, 0.4), P(x + w, y, 0.4), P(x + w, y + d, 0.14), P(x, y + d, 0.14)];
      line(P(x + 0.1, y + d - 0.02, 0.14), P(x + 0.1, y + d - 0.02, 0.01), '#6b7076', 1); line(P(x + w - 0.1, y + d - 0.02, 0.14), P(x + w - 0.1, y + d - 0.02, 0.01), '#6b7076', 1);
      path(q); const gr = g.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]); gr.addColorStop(0, '#2c4d86'); gr.addColorStop(0.5, '#3d68ad'); gr.addColorStop(1, '#223e6e'); g.fillStyle = gr; g.fill(); g.strokeStyle = '#d9dde0'; g.lineWidth = 1.1; g.stroke();
      g.beginPath(); for (let i = 1; i < 4; i++) { const a = mix(q[0], q[1], i / 4), b = mix(q[3], q[2], i / 4); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } const m0 = mix(q[0], q[3], 0.5), m1 = mix(q[1], q[2], 0.5); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.strokeStyle = 'rgba(210,225,245,.55)'; g.lineWidth = 0.6; g.stroke();
      path([q[0], mix(q[0], q[1], 0.5), mix(q[3], q[2], 0.2), q[3]]); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
    }
    boxS(2.6, 1.7, 2.9, 1.95, 0, 0.3, { c: '#d9dde0' });
  }
  function waterTower() {
    lot(0, 0, 1, 1, '#9fa3a6', 'rgba(0,0,0,.15)'); shadowBox(0.3, 0.3, 0.7, 0.7, 1.2);
    for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) line(P(x, y, 0.01), P(0.5 + (x - 0.5) * 0.7, 0.5 + (y - 0.5) * 0.7, 0.62), '#6b7076', 2);
    line(P(0.3, 0.7, 0.2), P(0.7, 0.7, 0.2), '#6b7076', 1); line(P(0.7, 0.3, 0.2), P(0.7, 0.7, 0.2), '#6b7076', 1);
    cyl(0.5, 0.5, 0.3, 0.6, 1.05, '#7fb6d9'); const x = PXf(0.5, 0.5), yt = PYf(0.5, 0.5, 1.05), g = E.g;
    g.beginPath(); g.moveTo(x - 0.3 * 45.25, yt); g.lineTo(x, yt - 15); g.lineTo(x + 0.3 * 45.25, yt); g.closePath(); g.fillStyle = '#5f8fb0'; g.fill();
    for (const z of [0.72, 0.9]) line([x - 0.3 * 45.25, PYf(0.5, 0.5, z)], [x + 0.3 * 45.25, PYf(0.5, 0.5, z)], 'rgba(0,0,0,.15)', 1);
  }
  function garage() {
    lot(0, 0, 2, 2, '#8d9096'); lot(0, 0, 2, 0.1, '#8ccb68');
    for (let i = 0; i <= 2; i++) { const g = E.g; path([P(i, 1.02, 0.02), P(i + 0.05, 1.02, 0.02), P(i + 0.05, 1.98, 0.02), P(i, 1.98, 0.02)]); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
    shadowBox(0, 0.1, 2, 1, 0.7); boxS(0, 0.1, 2, 1, 0, 0.62, { c: '#d6d3cc', tex: 'ribs' });
    const A = [0.12, 1], B = [1.88, 1]; F(quadF(A, B, 0.01, 0.5), '#aab0b6', 0.66, false);
    for (let i = 1; i < 6; i++) { const z = 0.5 * i / 6; line(P(A[0], A[1], z), P(B[0], B[1], z), 'rgba(0,0,0,.28)', 0.7); }
    boxS(-0.02, 0.08, 2.02, 1.02, 0.62, 0.68, { c: '#7f868c' });
  }
  function fountain() {
    const g = E.g; lot(0, 0, 1, 1, '#c9c4b6', 'rgba(0,0,0,.12)');
    const p0 = P(0.5, 0.5, 0), p1 = P(0.5, 0.5, 0.14);
    g.beginPath(); g.ellipse(p0[0], p0[1], 20, 10, 0, 0, 7); g.fillStyle = '#8c9196'; g.fill(); g.fillStyle = '#a9aeb3'; g.fillRect(p0[0] - 20, p1[1], 40, p0[1] - p1[1]);
    g.beginPath(); g.ellipse(p1[0], p1[1], 20, 10, 0, 0, 7); g.fillStyle = '#d4d8db'; g.fill();
    const gr = g.createRadialGradient(p1[0], p1[1], 2, p1[0], p1[1], 17); gr.addColorStop(0, '#9be0f2'); gr.addColorStop(1, '#4fb2d4');
    g.beginPath(); g.ellipse(p1[0], p1[1], 16.5, 8.2, 0, 0, 7); g.fillStyle = gr; g.fill();
    boxS(0.45, 0.45, 0.55, 0.55, 0.14, 0.42, { c: '#bfc4c8' });
  }

  // ---------- sprite registry ----------
  const KINDS = {
    zr: { w: 1, d: 1, h: 2.6, draw: (l, v) => l === 1 ? resHouse(v) : l === 2 ? resTown(v) : resApt(v) },
    zc: { w: 1, d: 1, h: 4.5, draw: (l, v) => l === 1 ? comShop(v) : l === 2 ? comMid(v) : comTower(v) },
    zi: { w: 1, d: 1, h: 2.0, draw: (l, v) => l === 1 ? indWare(v) : l === 2 ? indFactory(v) : indPlant(v) },
    cottage: { w: 1, d: 1, h: 1.2, draw: (l, v) => resHouse(v) }, family: { w: 2, d: 2, h: 1.9, draw: bigHouse }, apartment: { w: 2, d: 2, h: 2.8, draw: apartment2 },
    villa: { w: 3, d: 3, h: 1.8, draw: villa }, mansion: { w: 4, d: 3, h: 2.2, draw: mansion }, tower: { w: 3, d: 3, h: 12.8, draw: lumTower },
    police: { w: 2, d: 2, h: 2.0, draw: police }, fire: { w: 2, d: 2, h: 1.9, draw: fire }, clinic: { w: 2, d: 2, h: 1.5, draw: clinic }, school: { w: 3, d: 2, h: 1.8, draw: school },
    park: { w: 2, d: 2, h: 1.6, draw: park }, coal: { w: 3, d: 3, h: 3.0, draw: coal }, solar: { w: 3, d: 2, h: 0.8, draw: solar }, water: { w: 1, d: 1, h: 1.4, draw: waterTower },
    garage: { w: 2, d: 2, h: 0.9, draw: garage }, fountain: { w: 1, d: 1, h: 0.8, draw: fountain }, tree: { w: 1, d: 1, h: 1.3, draw: (l, v) => treeAt(0.5, 0.5, v, 1.15) }, scen: { w: 1, d: 1, h: 1.3, draw: (l, v) => treeAt(0.5, 0.5, v, 1.0) }
  };
  const cache = {};
  function sprite(kind, lvl, v) {
    const key = kind + '|' + lvl + '|' + v; let s = cache[key]; if (s) return s;
    const k = KINDS[kind], ml = 36 + Math.min(k.h, 3) * 40, mt = k.h * ZS + 30;
    const minX = -k.d * 32 - ml, maxX = k.w * 32 + 30, minY = -mt, maxY = (k.w + k.d) * 16 + 24;
    const cv = document.createElement('canvas'); cv.width = Math.ceil((maxX - minX) * SPR); cv.height = Math.ceil((maxY - minY) * SPR);
    const g = cv.getContext('2d'); g.setTransform(SPR, 0, 0, SPR, -minX * SPR, -minY * SPR);
    const pg = E.g, pl = E.lit; E.g = g; E.lit = [];
    k.draw(lvl, v);
    s = { cv, ox: -minX, oy: -minY, w: maxX - minX, h: maxY - minY, lit: E.lit };
    E.g = pg; E.lit = pl; cache[key] = s; return s;
  }
  function blit(s, bx, by, alpha) {
    const g = E.g; if (alpha != null) g.globalAlpha = alpha;
    g.drawImage(s.cv, PXf(bx, by) - s.ox, PYf(bx, by, 0) - s.oy, s.w, s.h);
    if (alpha != null) g.globalAlpha = 1;
  }
  function litWindows(s, bx, by) {
    if (!s.lit.length) return; const g = E.g;
    g.save(); g.translate(PXf(bx, by), PYf(bx, by, 0)); g.beginPath();
    for (const q of s.lit) { g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); }
    g.fillStyle = 'rgba(255,214,120,.95)'; g.fill(); g.restore();
  }

  // ---------- terrain ----------
  const WT = 0.4;
  function heightAt(x, y, MAP) {
    const n = fbm(x * 0.07 + 11.3, y * 0.07 + 4.7, 3, 4), d = Math.hypot(x - MAP / 2, y - MAP / 2);
    const edge = Math.min(x, y, MAP - x, MAP - y);
    return n + 0.5 * sstep(23, 9, d) - 0.55 * sstep(5, 0, edge);
  }
  function terrain(MAP) {
    const water = new Uint8Array(MAP * MAP);
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) water[y * MAP + x] = heightAt(x + 0.5, y + 0.5, MAP) < WT + 0.03 ? 1 : 0;
    const w2 = MAP * 32, h2 = MAP * 16, lo = document.createElement('canvas'); lo.width = w2; lo.height = h2;
    const lg = lo.getContext('2d'), id = lg.createImageData(w2, h2), D = id.data;
    for (let py = 0; py < h2; py++) for (let px = 0; px < w2; px++) {
      const sx = px * 2 - MAP * 32 + 1, sy = py * 2 + 1, x = (sx / 32 + sy / 16) / 2, y = (sy / 16 - sx / 32) / 2, i = (py * w2 + px) * 4;
      if (x < 0 || y < 0 || x >= MAP || y >= MAP) continue;
      const h = heightAt(x, y, MAP); let r, g, b;
      if (h < WT) {
        const dd = clamp((WT - h) / 0.16, 0, 1), k = (vnoise(x * 3, y * 3, 9) - 0.5) * 16;
        r = lerp(98, 30, dd) + k * 0.4; g = lerp(194, 104, dd) + k; b = lerp(206, 156, dd) + k;
        if (h > WT - 0.012) { r += 40; g += 30; b += 20; }
      } else if (h < WT + 0.055) {
        const t = (h - WT) / 0.055; r = lerp(190, 232, t); g = lerp(180, 218, t); b = lerp(138, 170, t);
      } else {
        const gn = fbm(x * 0.2, y * 0.2, 5, 3), dry = sstep(0.6, 0.78, fbm(x * 0.09 + 5, y * 0.09, 12, 2));
        r = lerp(88, 116, gn); g = lerp(150, 172, gn); b = lerp(58, 74, gn);
        r = lerp(r, 150, dry * 0.5); g = lerp(g, 156, dry * 0.4); b = lerp(b, 84, dry * 0.4);
        const j = (hash2(px, py) - 0.5) * 8; r += j; g += j; b += j * 0.5;
        if (h < WT + 0.09) { r = lerp(r, 120, 0.25); g = lerp(g, 160, 0.25); }
      }
      D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255;
    }
    lg.putImageData(id, 0, 0);
    const cv = document.createElement('canvas'); cv.width = MAP * 64; cv.height = MAP * 32; const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, cv.width, cv.height);
    const pt = document.createElement('canvas'); pt.width = 128; pt.height = 128; const pg = pt.getContext('2d'), r = rnd(4242);
    for (let i = 0; i < 520; i++) { const t = r(); pg.fillStyle = t < 0.4 ? 'rgba(200,235,130,.5)' : t < 0.8 ? 'rgba(30,85,35,.45)' : 'rgba(255,255,255,.35)'; pg.fillRect(r() * 128, r() * 128, 1 + (r() < 0.3), 1 + (r() < 0.5)); }
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(pt, 'repeat'); g.fillRect(0, 0, cv.width, cv.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return { water, canvas: cv };
  }
  function scenery(MAP, water) {
    const out = [];
    for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) {
      const i = y * MAP + x; if (water[i] || heightAt(x + 0.5, y + 0.5, MAP) < WT + 0.1) continue;
      const f = fbm(x * 0.16 + 3, y * 0.16 + 9, 21, 3), p = f > 0.6 ? 0.6 : f > 0.5 ? 0.12 : 0.03;
      if (hash2(x * 9 + 1, y * 7 + 3) < p) { let v = (hash2(x, y * 3) * 6) | 0; if (v === 3 && hash2(x + 5, y) < 0.8) v = 0; out.push([i, v]); }
    }
    return out;
  }

  // ---------- cars & people ----------
  function frus(cx, cy, a, z0, z1, b, t, col, sideCol, topCol, vc) {
    const ca = Math.cos(a), sa = Math.sin(a); vc = vc || 0;
    const W2 = (u, v, z) => P(cx + ca * u - sa * v, cy + sa * u + ca * v, z);
    const BFR = W2(b[1], vc + b[2], z0), BFL = W2(b[1], vc - b[2], z0), BBL = W2(b[0], vc - b[2], z0), BBR = W2(b[0], vc + b[2], z0);
    const TFR = W2(t[1], vc + t[2], z1), TFL = W2(t[1], vc - t[2], z1), TBL = W2(t[0], vc - t[2], z1), TBR = W2(t[0], vc + t[2], z1);
    const h = z1 - z0;
    const faces = [{ n: [ca, sa], p: [BFL, BFR, TFR, TFL], run: b[1] - t[1] }, { n: [-ca, -sa], p: [BBR, BBL, TBL, TBR], run: t[0] - b[0] }, { n: [-sa, ca], p: [BFR, BBR, TBR, TFR], run: b[2] - t[2] }, { n: [sa, -ca], p: [BBL, BFL, TFL, TBL], run: b[2] - t[2] }];
    const vis = [];
    for (const f of faces) { const s = f.n[0] + f.n[1]; if (s > -0.816 * f.run / h) vis.push([s, f]); }
    vis.sort((p, q) => p[0] - q[0]);
    for (const [, f] of vis) F(f.p, sideCol || col, clamp(0.78 + 0.16 * f.n[0] - 0.16 * f.n[1] + 0.12 * clamp(f.run / h, 0, 1), 0.4, 1.1), true);
    F([TFL, TFR, TBR, TBL], topCol || col, 1.08, false);
  }
  function drawCar(c, m, preview) {
    const L = m.L, Wd = m.W, a = c.a, ca = Math.cos(a), sa = Math.sin(a), g = E.g;
    const WP = (u, v) => [c.x + ca * u - sa * v, c.y + sa * u + ca * v];
    const sh = [[-0.54, -0.6], [0.54, -0.6], [0.54, 0.6], [-0.54, 0.6]].map(([u, v]) => { const w = WP(u * L + 0.03, v * Wd - 0.02); return P(w[0] + 0.03, w[1] + 0.03, 0.01); });
    path(sh); g.fillStyle = 'rgba(0,0,0,0.32)'; g.fill();
    const wheel = (v) => { for (const u of [0.31, -0.31]) frus(c.x, c.y, a, 0, 0.13, [u * L - 0.06, u * L + 0.06, 0.045], [u * L - 0.05, u * L + 0.05, 0.045], '#16181b', null, null, v * (Wd / 2 + 0.005)); };
    const nearV = (ca - sa) > 0 ? 1 : -1; wheel(-nearV);
    const backVis = (ca + sa) < 0;
    const spoil = () => {
      if (!m.spoiler) return; const big = m.spoiler === 2, z0 = m.bh + (big ? 0.07 : 0.04), z1 = z0 + 0.025;
      frus(c.x, c.y, a, z0, z1, [-0.5 * L, -0.4 * L, Wd * 0.44], [-0.5 * L, -0.4 * L, Wd * 0.44], c.color, null, null, 0);
      for (const v of [-0.3, 0.3]) frus(c.x, c.y, a, m.bh - 0.01, z0, [-0.47 * L, -0.43 * L, 0.012], [-0.47 * L, -0.43 * L, 0.012], '#1d1f23', null, null, v * Wd);
    };
    if (!backVis) spoil();
    frus(c.x, c.y, a, 0.05, m.bh, [-0.5 * L, 0.5 * L, Wd / 2], [-0.47 * L, 0.46 * L, Wd * 0.46], c.color);
    frus(c.x, c.y, a, m.bh, m.bh + m.ch, [m.cab[0] * L, m.cab[1] * L, Wd * m.cwb], [m.cab[2] * L, m.cab[3] * L, Wd * m.cwt], c.color, '#243546', c.color);
    wheel(nearV); if (backVis) spoil();
    const lq = (u, v0, v1, z0, z1, col) => { const q = [[u, v0, z1], [u, v1, z1], [u, v1, z0], [u, v0, z0]].map(([uu, vv, zz]) => { const w = WP(uu, vv); return P(w[0], w[1], zz); }); path(q); g.fillStyle = col; g.fill(); };
    const night = !preview && E.night > 0.25;
    if ((ca + sa) > -0.1) { const col = night ? '#fffbe0' : '#fff2c4'; lq(0.487 * L, Wd * 0.27, Wd * 0.43, m.bh * 0.5, m.bh * 0.85, col); lq(0.487 * L, -Wd * 0.43, -Wd * 0.27, m.bh * 0.5, m.bh * 0.85, col); }
    if ((ca + sa) < 0.1) { const col = c.brake ? '#ff3030' : (night ? '#d02020' : '#9b1717'); lq(-0.487 * L, Wd * 0.27, Wd * 0.43, m.bh * 0.5, m.bh * 0.85, col); lq(-0.487 * L, -Wd * 0.43, -Wd * 0.27, m.bh * 0.5, m.bh * 0.85, col); }
    if (night && E.glows) {
      const f = WP(L * 0.5 + 0.55, 0); E.glows.push({ x: f[0], y: f[1], z: 0.05, r: 60, c: '255,238,180', a: 0.2 });
      const r = WP(-L * 0.5, 0); E.glows.push({ x: r[0], y: r[1], z: 0.1, r: c.brake ? 28 : 14, c: '255,40,40', a: c.brake ? 0.45 : 0.2 });
    }
  }
  function drawPerson(p) {
    const g = E.g, q = P(p.x, p.y, 0), sw = Math.sin(E.now * 7 + p.ph) * 1.6;
    g.beginPath(); g.ellipse(q[0] - 1, q[1] + 0.5, 3, 1.4, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill();
    g.strokeStyle = '#2d3340'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(q[0] - 0.7, q[1] - 3.5); g.lineTo(q[0] - 0.7 + sw, q[1]); g.moveTo(q[0] + 0.7, q[1] - 3.5); g.lineTo(q[0] + 0.7 - sw, q[1]); g.stroke();
    g.fillStyle = p.col; g.fillRect(q[0] - 1.7, q[1] - 8, 3.4, 4.8);
    g.beginPath(); g.arc(q[0], q[1] - 9.4, 1.7, 0, 7); g.fillStyle = p.skin; g.fill();
  }
  function ell(x, y, z, r, fill) { const g = E.g; g.beginPath(); g.ellipse(PXf(x, y), PYf(x, y, z), r * 45.25, r * 22.63, 0, 0, 7); g.fillStyle = fill; g.fill(); }

  return { E, TW, TH, ZS, clamp, lerp, hash2, fbm, shade, P, PXf, PYf, path, F, lot, band, line, KINDS, sprite, blit, litWindows, terrain, scenery, drawCar, drawPerson, ell, treeAt };
})();
