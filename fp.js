'use strict';
/* fp.js — first-person (cockpit) driving view. A small perspective 3D renderer, all drawn in code. */
window.FP = (function () {
  const NEAR = 0.05;
  let ctx, cx, cy, ca, sa, ez, W, H, focal, hz, fogC, T, lit, I;
  const cache = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (a, b) => { let h = (a | 0) * 374761393 + (b | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16); return ((h >>> 0) % 100000) / 100000; };
  function rgb(h) { let v = cache[h]; if (!v) { v = [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; cache[h] = v; } return v; }
  function colr(h, f, fog) {
    const c = rgb(h), t = fog || 0;
    return 'rgb(' + Math.min(255, Math.round(c[0] * f * T[0] * (1 - t) + fogC[0] * t)) + ',' + Math.min(255, Math.round(c[1] * f * T[1] * (1 - t) + fogC[1] * t)) + ',' + Math.min(255, Math.round(c[2] * f * T[2] * (1 - t) + fogC[2] * t)) + ')';
  }
  const fogT = d => clamp((d - 7) / 17, 0, 0.9);
  function toCam(x, y, z) { const dx = x - cx, dy = y - cy; return [-dx * sa + dy * ca, z - ez, dx * ca + dy * sa]; }
  function projPts(pts) {
    const c = pts.map(p => toCam(p[0], p[1], p[2])), out = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], ain = a[2] > NEAR, bin = b[2] > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    if (out.length < 3) return null;
    return out.map(p => [W / 2 + p[0] / p[2] * focal, hz - p[1] / p[2] * focal]);
  }
  function poly(pts, color) {
    const sp = projPts(pts); if (!sp) return null;
    ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); return sp;
  }
  function windows(A, B, z0, z1, o, lf, fog, seed) {
    const rows = o.rows, glass = o.glass || '#6f9cc0', len = Math.hypot(B[0] - A[0], B[1] - A[1]), cols = Math.max(2, Math.round(len * (o.cps || 3)));
    const a = [A[0] + (B[0] - A[0]) * 0.06, A[1] + (B[1] - A[1]) * 0.06], b = [A[0] + (B[0] - A[0]) * 0.94, A[1] + (B[1] - A[1]) * 0.94];
    for (let r = 0; r < rows; r++) {
      const za = z0 + (z1 - z0) * (r + 0.22) / rows, zb = z0 + (z1 - z0) * (r + 0.78) / rows;
      const q = [[a[0], a[1], zb], [b[0], b[1], zb], [b[0], b[1], za], [a[0], a[1], za]];
      const sp = poly(q, colr(glass, lf, fog)); if (sp && I.night > 0.3 && hash(seed * 7 + r, 3) < 0.5) lit.push(sp);
    }
    if (fog < 0.3) {
      ctx.beginPath();
      for (let k = 1; k < cols; k++) { const u = 0.06 + 0.88 * k / cols, x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u, p0 = toCam(x, y, z0 + 0.02), p1 = toCam(x, y, z1 - 0.02); if (p0[2] > NEAR && p1[2] > NEAR) { ctx.moveTo(W / 2 + p0[0] / p0[2] * focal, hz - p0[1] / p0[2] * focal); ctx.lineTo(W / 2 + p1[0] / p1[2] * focal, hz - p1[1] / p1[2] * focal); } }
      ctx.strokeStyle = colr('#e8e4dc', lf, fog); ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function box3(bx, by, hx, hy, ang, z0, z1, col, o) {
    o = o || {}; const c = Math.cos(ang), s = Math.sin(ang);
    const P4 = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([u, v]) => [bx + u * c - v * s, by + u * s + v * c]), faces = [];
    const cd = Math.hypot(bx - cx, by - cy), fog = fogT(cd);
    for (let i = 0; i < 4; i++) {
      const A = P4[i], B = P4[(i + 1) % 4], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; let nx = B[1] - A[1], ny = -(B[0] - A[0]); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (nx * (mx - bx) + ny * (my - by) < 0) { nx = -nx; ny = -ny; }
      if (nx * (cx - mx) + ny * (cy - my) <= 0) continue;
      faces.push({ A, B, nx, ny, d: Math.hypot(mx - cx, my - cy) });
    }
    faces.sort((a, b) => b.d - a.d);
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i], lf = 0.6 + 0.4 * clamp(f.nx * 0.85 - f.ny * 0.5, 0, 1);
      poly([[f.A[0], f.A[1], z0], [f.B[0], f.B[1], z0], [f.B[0], f.B[1], z1], [f.A[0], f.A[1], z1]], colr(col, lf, fog));
      if (o.rows && cd < 15) windows(f.A, f.B, z0 + (o.wz0 || 0.08), z1 - 0.04, o, lf, fog, Math.round(bx * 13 + by * 7) + i);
    }
    if (o.gable) {
      const rh = o.gable, xm = (P4[0][1] + P4[2][1]) / 2, gx0 = bx - hx - 0.04, gx1 = bx + hx + 0.04, y0 = by - hy - 0.04, y1 = by + hy + 0.04;
      const near = cy > by;
      const back = [[gx0, y0, z1], [gx1, y0, z1], [gx1, by, z1 + rh], [gx0, by, z1 + rh]], front = [[gx0, y1, z1], [gx1, y1, z1], [gx1, by, z1 + rh], [gx0, by, z1 + rh]];
      const rc = o.roof || '#a5503a';
      if (near) { poly(back, colr(rc, 0.7, fog)); poly(front, colr(rc, 0.95, fog)); } else { poly(front, colr(rc, 0.7, fog)); poly(back, colr(rc, 0.95, fog)); }
      poly([[gx1 - 0.04, y0 + 0.04, z1], [gx1 - 0.04, y1 - 0.04, z1], [gx1 - 0.04, by, z1 + rh]], colr(col, 0.9, fog)); void xm;
    } else if (ez > z1) poly(P4.map(p => [p[0], p[1], z1]), colr(o.roof || col, 1.05, fog));
  }
  function tree(x, y, v) {
    const t = toCam(x, y, 0); if (t[2] < NEAR) return; const k = focal / t[2], sx = W / 2 + t[0] * k, base = hz - t[1] * k, fog = fogT(t[2]);
    if (sx < -80 || sx > W + 80) return;
    ctx.fillStyle = colr('#6b4a2f', 1, fog); ctx.fillRect(sx - 0.03 * k, base - 0.3 * k, 0.06 * k, 0.3 * k);
    if (v % 6 === 2) { for (const [z, w, h] of [[0.12, 0.26, 0.34], [0.34, 0.2, 0.3], [0.54, 0.14, 0.28]]) { ctx.beginPath(); ctx.moveTo(sx, base - (z + h) * k); ctx.lineTo(sx - w * k, base - z * k); ctx.lineTo(sx + w * k, base - z * k); ctx.closePath(); ctx.fillStyle = colr('#2f7448', 1, fog); ctx.fill(); } return; }
    const pal = v % 6 === 3 ? ['#dd8b2b', '#f1b347'] : ['#3f9a3e', '#6cbf55'];
    ctx.beginPath(); ctx.arc(sx, base - 0.46 * k, 0.27 * k, 0, 7); ctx.fillStyle = colr(pal[0], 1, fog); ctx.fill();
    ctx.beginPath(); ctx.arc(sx - 0.05 * k, base - 0.52 * k, 0.17 * k, 0, 7); ctx.fillStyle = colr(pal[1], 1, fog); ctx.fill();
  }
  function person(p) {
    const t = toCam(p.x, p.y, 0); if (t[2] < NEAR) return; const k = focal / t[2], sx = W / 2 + t[0] * k, base = hz - t[1] * k, fog = fogT(t[2]);
    ctx.fillStyle = colr('#2d3340', 1, fog); ctx.fillRect(sx - 0.025 * k, base - 0.08 * k, 0.05 * k, 0.08 * k);
    ctx.fillStyle = colr(p.col, 1, fog); ctx.fillRect(sx - 0.04 * k, base - 0.17 * k, 0.08 * k, 0.1 * k);
    ctx.beginPath(); ctx.arc(sx, base - 0.2 * k, 0.03 * k, 0, 7); ctx.fillStyle = colr(p.skin, 1, fog); ctx.fill();
  }
  function car(c) {
    const m = c.model, L = m.L, Wd = m.W, ca2 = Math.cos(c.a), sa2 = Math.sin(c.a);
    box3(c.x, c.y, L / 2, Wd / 2, c.a, 0.04, m.bh, c.color);
    const mid = (m.cab[0] + m.cab[1]) / 2 * L, half = (m.cab[1] - m.cab[0]) / 2 * L;
    box3(c.x + ca2 * mid, c.y + sa2 * mid, half, Wd * m.cwb / 2, c.a, m.bh, m.bh + m.ch, '#2a3b4d');
    if (ca2 * (c.x - cx) + sa2 * (c.y - cy) > 0) { // we see the rear
      const rx = c.x - ca2 * L / 2, ry = c.y - sa2 * L / 2, px = -sa2, py = ca2;
      for (const sd of [-1, 1]) poly([[rx + px * sd * Wd * 0.18 - ca2 * 0.002, ry + py * sd * Wd * 0.18 - sa2 * 0.002, m.bh * 0.85], [rx + px * sd * Wd * 0.42 - ca2 * 0.002, ry + py * sd * Wd * 0.42 - sa2 * 0.002, m.bh * 0.85], [rx + px * sd * Wd * 0.42 - ca2 * 0.002, ry + py * sd * Wd * 0.42 - sa2 * 0.002, m.bh * 0.5], [rx + px * sd * Wd * 0.18 - ca2 * 0.002, ry + py * sd * Wd * 0.18 - sa2 * 0.002, m.bh * 0.5]], I.night > 0.25 ? '#ff3a2a' : '#8f1a15');
    }
  }
  function dash() {
    const hy0 = H * 0.8, g = ctx.createLinearGradient(0, hy0, 0, H);
    const base = rgb(I.color); g.addColorStop(0, 'rgb(' + Math.min(255, base[0] * 0.9 * T[0] + 30) + ',' + Math.min(255, base[1] * 0.9 * T[1] + 30) + ',' + Math.min(255, base[2] * 0.9 * T[2] + 30) + ')'); g.addColorStop(1, 'rgb(' + base[0] * 0.35 * T[0] + ',' + base[1] * 0.35 * T[1] + ',' + base[2] * 0.35 * T[2] + ')');
    ctx.beginPath(); ctx.moveTo(W * 0.2, H); ctx.quadraticCurveTo(W * 0.3, hy0 + 8, W * 0.5, hy0); ctx.quadraticCurveTo(W * 0.7, hy0 + 8, W * 0.8, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(W * 0.5, hy0 + 4); ctx.lineTo(W * 0.5, H); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0d1118'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.055, 0); ctx.lineTo(W * 0.1, H * 0.62); ctx.lineTo(0, H * 0.9); ctx.fill(); ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.945, 0); ctx.lineTo(W * 0.9, H * 0.62); ctx.lineTo(W, H * 0.9); ctx.fill();
    ctx.fillStyle = '#0d1118'; ctx.fillRect(0, 0, W, H * 0.025); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W * 0.43, H * 0.03, W * 0.14, H * 0.05, 8) : ctx.rect(W * 0.43, H * 0.03, W * 0.14, H * 0.05); ctx.fillStyle = '#10151d'; ctx.fill();
    const dg = ctx.createLinearGradient(0, H * 0.88, 0, H); dg.addColorStop(0, '#171c26'); dg.addColorStop(1, '#07090d'); ctx.fillStyle = dg; ctx.fillRect(0, H * 0.9, W, H * 0.1);
    ctx.save(); ctx.translate(W * 0.5, H * 1.04); ctx.rotate((I.steer || 0) * 0.8); ctx.strokeStyle = '#1b1f27'; ctx.lineWidth = H * 0.035; ctx.beginPath(); ctx.arc(0, 0, H * 0.2, 0, 7); ctx.stroke(); ctx.strokeStyle = '#2b313c'; ctx.lineWidth = H * 0.012; ctx.beginPath(); ctx.arc(0, 0, H * 0.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.lineWidth = H * 0.03; ctx.strokeStyle = '#1b1f27'; ctx.beginPath(); ctx.moveTo(-H * 0.2, 0); ctx.lineTo(H * 0.2, 0); ctx.moveTo(0, 0); ctx.lineTo(0, -H * 0.2); ctx.stroke(); ctx.restore();
    const gx = W * 0.2, gy = H * 0.945, gr = Math.min(W, H) * 0.075; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 7); ctx.fillStyle = '#0a0d12'; ctx.fill(); ctx.strokeStyle = '#3a4150'; ctx.lineWidth = 2; ctx.stroke();
    const f = clamp(I.speedKmh / 300, 0, 1), ang = Math.PI * 0.75 + f * Math.PI * 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ang) * gr * 0.85, gy + Math.sin(ang) * gr * 0.85); ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.font = '700 ' + Math.round(H * 0.05) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText(Math.round(I.speedKmh), gx, gy + gr * 0.55); ctx.font = '600 ' + Math.round(H * 0.02) + 'px system-ui'; ctx.fillStyle = '#8fa0b8'; ctx.fillText('km/h', gx, gy + gr * 0.82);
    if (I.nitro) { ctx.fillStyle = '#ff7a1a'; ctx.font = '800 ' + Math.round(H * 0.035) + 'px system-ui'; ctx.fillText('🔥 NITRO', W * 0.8, H * 0.95); }
  }
  function draw(c, w, h, inp) {
    ctx = c; W = w; H = h; I = inp; cx = I.x; cy = I.y; ca = Math.cos(I.a); sa = Math.sin(I.a); ez = I.eye || 0.16; focal = H * 0.95; hz = H * 0.46; T = I.mul; lit = [];
    const n = clamp(I.night, 0, 1), mixc = (a, b) => [a[0] + (b[0] - a[0]) * n, a[1] + (b[1] - a[1]) * n, a[2] + (b[2] - a[2]) * n];
    const top = mixc([88, 158, 226], [5, 8, 20]), hor = mixc([200, 228, 250], [34, 46, 78]); fogC = hor;
    if (I.rain > 0) { for (let i = 0; i < 3; i++) { top[i] = top[i] * (1 - 0.35 * I.rain) + 90 * 0.35 * I.rain; hor[i] = hor[i] * (1 - 0.35 * I.rain) + 100 * 0.35 * I.rain; } }
    const sk = ctx.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, 'rgb(' + top.map(Math.round) + ')'); sk.addColorStop(1, 'rgb(' + hor.map(Math.round) + ')'); ctx.fillStyle = sk; ctx.fillRect(0, 0, W, hz + 1);
    if (n > 0.4) { ctx.fillStyle = 'rgba(255,255,255,' + (n * 0.8) + ')'; for (let i = 0; i < 70; i++) { const sx = hash(i, 1) * W, sy = hash(i, 2) * hz * 0.9; ctx.fillRect(sx, sy, 1.5, 1.5); } ctx.beginPath(); ctx.arc(W * 0.78, hz * 0.28, 16, 0, 7); ctx.fillStyle = 'rgba(245,244,225,' + n + ')'; ctx.fill(); }
    const gg = ctx.createLinearGradient(0, hz, 0, H), gr = rgb('#5e9a42'); gg.addColorStop(0, 'rgb(' + fogC.map(Math.round) + ')'); gg.addColorStop(0.28, colr('#5e9a42', 1, 0.45)); gg.addColorStop(1, colr('#4f8a3a', 1, 0)); void gr; ctx.fillStyle = gg; ctx.fillRect(0, hz, W, H - hz);
    const R = 15, x0 = Math.floor(cx) - R, y0 = Math.floor(cy) - R, isR = I.isRoad;
    for (let y = y0; y <= y0 + 2 * R; y++) for (let x = x0; x <= x0 + 2 * R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy); if (d > R) continue; if (dx * ca + dy * sa < -1.5) continue; const fog = fogT(d);
      if (isR(x, y)) {
        poly([[x, y, 0.002], [x + 1, y, 0.002], [x + 1, y + 1, 0.002], [x, y + 1, 0.002]], colr('#3a3e45', 1, fog));
        const nN = isR(x, y - 1), nE = isR(x + 1, y), nS = isR(x, y + 1), nW = isR(x - 1, y), s = 0.16, sw = colr('#bdb9ae', 1, fog);
        if (!nN) poly([[x, y, 0.004], [x + 1, y, 0.004], [x + 1, y + s, 0.004], [x, y + s, 0.004]], sw); if (!nS) poly([[x, y + 1 - s, 0.004], [x + 1, y + 1 - s, 0.004], [x + 1, y + 1, 0.004], [x, y + 1, 0.004]], sw);
        if (!nW) poly([[x, y, 0.004], [x + s, y, 0.004], [x + s, y + 1, 0.004], [x, y + 1, 0.004]], sw); if (!nE) poly([[x + 1 - s, y, 0.004], [x + 1, y, 0.004], [x + 1, y + 1, 0.004], [x + 1 - s, y + 1, 0.004]], sw);
        const dc = colr('#e8e2c8', 1, fog); if (nE && nW && !nN && !nS) poly([[x + 0.3, y + 0.485, 0.005], [x + 0.7, y + 0.485, 0.005], [x + 0.7, y + 0.515, 0.005], [x + 0.3, y + 0.515, 0.005]], dc); else if (nN && nS && !nE && !nW) poly([[x + 0.485, y + 0.3, 0.005], [x + 0.515, y + 0.3, 0.005], [x + 0.515, y + 0.7, 0.005], [x + 0.485, y + 0.7, 0.005]], dc);
      } else if (I.water(x, y)) poly([[x, y, 0.001], [x + 1, y, 0.001], [x + 1, y + 1, 0.001], [x, y + 1, 0.001]], colr('#3d9fc4', 1, fog));
    }
    const objs = [];
    for (const b of I.blds) { const d = Math.hypot(b.x + b.w / 2 - cx, b.y + b.d / 2 - cy); if (d > 22) continue; objs.push({ d, f: () => { const i = b.inset == null ? 0.08 : b.inset, hx = b.w / 2 - i, hy = b.d / 2 - i; box3(b.x + b.w / 2, b.y + b.d / 2, hx, hy, 0, 0, b.h, b.col, { rows: b.rows, roof: b.roof, gable: b.gable, glass: b.glass, cps: b.cps }); } }); }
    for (const t of I.scen) { const d = Math.hypot(t.x + 0.5 - cx, t.y + 0.5 - cy); if (d < 18) objs.push({ d, f: () => tree(t.x + 0.5, t.y + 0.5, t.v) }); }
    for (const c of I.cars) { const d = Math.hypot(c.x - cx, c.y - cy); if (d < 18 && d > 0.05) objs.push({ d, f: () => car(c) }); }
    for (const p of I.people) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < 14) objs.push({ d, f: () => person(p) }); }
    objs.sort((a, b) => b.d - a.d); for (const o of objs) o.f();
    if (lit.length) { ctx.fillStyle = 'rgba(255,214,120,.9)'; for (const sp of lit) { ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]); ctx.closePath(); ctx.fill(); } }
    if (I.night > 0.3) { ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(W / 2, hz + H * 0.22, 0, W / 2, hz + H * 0.22, W * 0.5); lg.addColorStop(0, 'rgba(255,240,190,' + (0.3 * I.night) + ')'); lg.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = lg; ctx.fillRect(0, hz - H * 0.1, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (I.nitro) { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = hash(i, 9) * 6.28, r0 = H * (0.3 + hash(i, 4) * 0.25), r1 = r0 + H * 0.22; ctx.moveTo(W / 2 + Math.cos(a) * r0 * 1.4, hz + Math.sin(a) * r0 * 0.8); ctx.lineTo(W / 2 + Math.cos(a) * r1 * 1.4, hz + Math.sin(a) * r1 * 0.8); } ctx.stroke(); }
    dash();
  }
  return { draw };
})();
