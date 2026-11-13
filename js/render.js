/* =========================================================================
 * AGES OF DOMINION — живописная карта мира на canvas.
 * Логика игры — на гексах, но отрисовка бесшовная: рельеф с освещением,
 * побережья с пеной, реки, леса, горы со снежными шапками, вулкан с лавой,
 * волнистые светящиеся границы держав, облачный туман войны.
 * Анимации: марш отрядов по пути, атаки (выпад, стрелы, камни катапульт),
 * искры и дым, захват городов (пожар), герои с аурой, дым из труб,
 * плывущие облака, блики на воде.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const SQ3 = Math.sqrt(3);
  const INK = '#2b1d14';
  const K0 = 0.5, K1 = 0.25; // разрешения сеток: рельеф/границы и туман/маски
  const TCODE = { ocean: 0, grass: 1, plains: 2, forest: 3, hills: 4, mountain: 5, desert: 6, tundra: 7, ash: 8 };
  const HT = [-0.25, 0.16, 0.18, 0.24, 0.52, 1.0, 0.16, 0.2, 0.3];
  const PAL = [null,
    [78, 132, 44, 150, 186, 74],
    [168, 156, 78, 214, 194, 108],
    [44, 86, 36, 82, 124, 52],
    [122, 124, 70, 168, 152, 96],
    [112, 104, 96, 156, 148, 136],
    [210, 180, 116, 238, 214, 156],
    [205, 216, 224, 246, 249, 252],
    [60, 32, 26, 112, 54, 36],
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeNoise(seed) {
    const rnd = mulberry(seed || 1);
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = rnd();
    const v = (ix, iy) => vals[perm[(ix & 255) + perm[iy & 255]]];
    const n = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const fbm = (x, y, o) => { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < (o || 3); i++) { s += n(x * f + i * 17.3, y * f - i * 9.1) * a; t += a; a *= 0.5; f *= 2.03; } return s / t; };
    return { n, fbm, rnd };
  }
  function boxBlur(src, W, H, r) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H), d = 2 * r + 1;
    for (let y = 0; y < H; y++) {
      const row = y * W; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) { tmp[row + x] = acc / d; acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = acc / d; acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
    }
    return out;
  }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function hexA(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }
  function shade(hex, k) { const [r, g, b] = rgbOf(hex); const f = (v) => Math.round(clamp(v + (k > 0 ? (255 - v) * k : v * k), 0, 255)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function star(ctx, x, y, r, n) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (Math.PI / n) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }

  // ====================================================================== СПРАЙТЫ ЛАНДШАФТА
  function treeDeciduous(ctx, x, y, s, rnd) {
    ctx.fillStyle = 'rgba(20,30,10,.28)'; ctx.beginPath(); ctx.ellipse(x + 2.5 * s, y + 0.5, 6.5 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a321e'; ctx.fillRect(x - 0.9 * s, y - 4 * s, 1.8 * s, 4.2 * s);
    const g = rnd() * 0.15;
    ctx.fillStyle = `rgb(${38 + g * 60},${74 + g * 70},${30})`;
    ctx.beginPath(); ctx.arc(x - 2.6 * s, y - 6 * s, 3.8 * s, 0, Math.PI * 2); ctx.arc(x + 2.6 * s, y - 6.2 * s, 3.8 * s, 0, Math.PI * 2); ctx.arc(x, y - 9 * s, 4.2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${70 + g * 80},${120 + g * 60},${46})`;
    ctx.beginPath(); ctx.arc(x - 1.6 * s, y - 9.6 * s, 2.4 * s, 0, Math.PI * 2); ctx.arc(x - 3.2 * s, y - 6.8 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(190,230,120,.35)'; ctx.beginPath(); ctx.arc(x - 2 * s, y - 10.6 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  }
  function treeConifer(ctx, x, y, s, snow) {
    ctx.fillStyle = 'rgba(20,30,10,.28)'; ctx.beginPath(); ctx.ellipse(x + 2.5 * s, y + 0.5, 5 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d2a1a'; ctx.fillRect(x - 0.8 * s, y - 2.5 * s, 1.6 * s, 2.7 * s);
    for (let k = 0; k < 3; k++) {
      const by = y - 2 * s - k * 3.6 * s, w = (5.2 - k * 1.3) * s, h = 5.4 * s;
      ctx.fillStyle = snow ? '#2d4a3a' : '#21482a'; ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x, by - h); ctx.lineTo(x + w, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = snow ? '#3c6150' : '#2f6338'; ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x, by - h); ctx.lineTo(x - w * 0.1, by); ctx.closePath(); ctx.fill();
      if (snow) { ctx.fillStyle = '#f2f6fa'; ctx.beginPath(); ctx.moveTo(x - w * 0.55, by - h * 0.45); ctx.lineTo(x, by - h); ctx.lineTo(x + w * 0.5, by - h * 0.5); ctx.lineTo(x, by - h * 0.6); ctx.closePath(); ctx.fill(); }
    }
  }
  function mountainPeak(ctx, x, y, h, w, rnd, snowy) {
    const ax = x + (rnd() - 0.5) * w * 0.3, ay = y - h, mx = x + (rnd() - 0.3) * w * 0.25;
    ctx.fillStyle = 'rgba(25,18,10,.3)'; ctx.beginPath(); ctx.ellipse(x + w * 0.25, y + 1, w * 1.05, w * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a99e90'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(ax, ay); ctx.lineTo(mx, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c544b'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x + w, y); ctx.lineTo(mx, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,40,.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, mx, 0.5) - w * 0.08, lerp(ay, y, 0.5)); ctx.lineTo(mx, y);
    ctx.moveTo(lerp(ax, x - w, 0.4), lerp(ay, y, 0.4)); ctx.lineTo(lerp(ax, x - w, 0.4) + w * 0.18, lerp(ay, y, 0.62)); ctx.stroke();
    if (snowy) {
      const sh = h * (0.34 + rnd() * 0.12);
      const lx = lerp(ax, x - w, sh / h), rx = lerp(ax, x + w, sh / h), by = ay + sh;
      ctx.fillStyle = '#f5f7fa'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lx, by); ctx.lineTo(lerp(lx, ax, 0.4), by - sh * 0.18); ctx.lineTo(lerp(lx, rx, 0.45), by + sh * 0.08); ctx.lineTo(lerp(ax, mx, sh / h * 0.9), by - sh * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c4d0dc'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, mx, sh / h * 0.9), by - sh * 0.1); ctx.lineTo(lerp(mx, rx, 0.5), by + sh * 0.05); ctx.lineTo(rx, by); ctx.closePath(); ctx.fill();
    }
  }
  function volcanoSprite(ctx, x, y) {
    ctx.fillStyle = 'rgba(20,10,5,.35)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 2, 36, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b3a33'; ctx.beginPath(); ctx.moveTo(x - 32, y); ctx.lineTo(x - 7, y - 34); ctx.lineTo(x + 7, y - 34); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a201c'; ctx.beginPath(); ctx.moveTo(x + 7, y - 34); ctx.lineTo(x + 32, y); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1c1210'; ctx.beginPath(); ctx.ellipse(x, y - 34, 7.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7a1e'; ctx.beginPath(); ctx.ellipse(x, y - 34, 5.5, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 3, y - 33); ctx.bezierCurveTo(x - 8, y - 24, x - 4, y - 16, x - 13, y - 6); ctx.moveTo(x + 3, y - 33); ctx.bezierCurveTo(x + 7, y - 22, x + 12, y - 15, x + 9, y - 4); ctx.stroke();
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 0.9; ctx.stroke();
  }
  function hillMound(ctx, x, y, w, h, tint) {
    ctx.fillStyle = 'rgba(30,25,10,.22)'; ctx.beginPath(); ctx.ellipse(x + w * 0.2, y + 1, w * 1.05, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tint[0]; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w * 0.6, y - h * 1.2, x + w * 0.5, y - h * 1.25, x + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tint[1]; ctx.beginPath(); ctx.moveTo(x - w * 0.85, y - h * 0.2); ctx.bezierCurveTo(x - w * 0.55, y - h * 1.05, x - w * 0.05, y - h * 1.05, x + w * 0.05, y - h * 0.82); ctx.bezierCurveTo(x - w * 0.3, y - h * 0.7, x - w * 0.6, y - h * 0.4, x - w * 0.85, y - h * 0.2); ctx.fill();
    ctx.fillStyle = tint[2]; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.bezierCurveTo(x + w * 0.6, y - h * 0.9, x + w * 0.3, y - h * 0.95, x + w * 0.15, y - h * 0.9); ctx.bezierCurveTo(x + w * 0.5, y - h * 0.5, x + w * 0.6, y - h * 0.2, x + w * 0.55, y); ctx.closePath(); ctx.fill();
  }

  // ====================================================================== ФИГУРЫ ОТРЯДОВ
  /** Человечек: (x,y) — ноги; o: {col, helm, weapon, shield, walk, sc, face, cape, armor, noLegs} */
  function person(ctx, x, y, o, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale((o.sc || 1) * (o.face || 1), o.sc || 1);
    const sw = o.walk ? Math.sin(o.walk) * 2.2 : 0;
    if (o.cape) {
      const sway = Math.sin(t * 3 + x) * 1.2 - (o.walk ? 1.5 : 0);
      ctx.fillStyle = shade(o.cape, -0.15); ctx.beginPath(); ctx.moveTo(-3.6, -13.5); ctx.quadraticCurveTo(-7 + sway, -6, -6 + sway, -1); ctx.lineTo(2.5, -2); ctx.lineTo(3, -13.5); ctx.closePath(); ctx.fill();
    }
    if (!o.noLegs) {
      ctx.strokeStyle = '#2e2119'; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.6, -6.5); ctx.lineTo(-1.8 + sw, -0.3); ctx.moveTo(1.6, -6.5); ctx.lineTo(1.8 - sw, -0.3); ctx.stroke();
    }
    // туловище
    ctx.fillStyle = o.armor || o.col; ctx.strokeStyle = 'rgba(30,20,12,.85)'; ctx.lineWidth = 0.8;
    roundRect(ctx, -4, -14.5, 8, 9.5, 2.2); ctx.fill(); ctx.stroke();
    if (o.armor) { ctx.fillStyle = o.col; ctx.fillRect(-1.3, -14.2, 2.6, 9); }
    ctx.fillStyle = '#4e3420'; ctx.fillRect(-4, -7.6, 8, 1.3);
    // голова
    ctx.fillStyle = '#efc49a'; ctx.beginPath(); ctx.arc(0, -17.2, 3.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (o.helm === 'iron') { ctx.fillStyle = '#a4acb5'; ctx.beginPath(); ctx.arc(0, -17.6, 3.4, Math.PI, 0); ctx.fill(); ctx.fillRect(-0.5, -18, 1, 3); }
    else if (o.helm === 'gold') { ctx.fillStyle = '#e2bd52'; ctx.beginPath(); ctx.arc(0, -17.6, 3.5, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(-1, -21); ctx.lineTo(0, -24.5); ctx.lineTo(1, -21); ctx.fill(); }
    else if (o.helm === 'hood') { ctx.fillStyle = o.hoodCol || '#3d5a2c'; ctx.beginPath(); ctx.arc(0, -17.4, 3.8, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(2.6, -14); ctx.lineTo(-2.6, -14); ctx.closePath(); ctx.fill(); }
    else if (o.helm === 'fur') { ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(0, -18.2, 3.6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.moveTo(-3.5, -19); ctx.lineTo(-5, -22.5); ctx.lineTo(-2.2, -20.5); ctx.moveTo(3.5, -19); ctx.lineTo(5, -22.5); ctx.lineTo(2.2, -20.5); ctx.fill(); }
    else if (o.helm === 'cap') { ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(0, -18, 3.3, Math.PI, 0); ctx.fill(); }
    // оружие
    ctx.lineCap = 'round';
    const w = o.weapon;
    if (w === 'spear' || w === 'lance') {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(4.6, w === 'lance' ? -6 : 1); ctx.lineTo(w === 'lance' ? 13 : 4.6, w === 'lance' ? -16 : -25); ctx.stroke();
      ctx.fillStyle = '#d8dde2'; ctx.beginPath(); if (w === 'lance') { ctx.moveTo(13, -16); ctx.lineTo(15.5, -19.5); ctx.lineTo(11.6, -17.4); } else { ctx.moveTo(3.4, -25); ctx.lineTo(4.6, -29); ctx.lineTo(5.8, -25); } ctx.closePath(); ctx.fill();
    } else if (w === 'sword') {
      ctx.strokeStyle = '#e4e8ec'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(5, -9.5); ctx.lineTo(9.5, -19); ctx.stroke();
      ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(3.5, -10.6); ctx.lineTo(6.6, -9); ctx.stroke();
    } else if (w === 'club' || w === 'axe' || w === 'axe2') {
      ctx.strokeStyle = '#5d3e22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4.5, -8); ctx.lineTo(8, -18); ctx.stroke();
      ctx.fillStyle = w === 'club' ? '#5d3e22' : '#cfd4d9';
      if (w === 'club') { ctx.beginPath(); ctx.arc(8.2, -18.4, 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(7.4, -19.5); ctx.quadraticCurveTo(12, -19, 11, -14.5); ctx.lineTo(8, -16.5); ctx.closePath(); ctx.fill(); if (w === 'axe2') { ctx.beginPath(); ctx.moveTo(7.6, -19.5); ctx.quadraticCurveTo(3.5, -21.5, 3.6, -16.8); ctx.lineTo(7.2, -17.4); ctx.closePath(); ctx.fill(); } }
    } else if (w === 'bow') {
      ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(4.5, -11, 7, -1.25, 1.25); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,230,.8)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(4.5 + 7 * Math.cos(-1.25), -11 + 7 * Math.sin(-1.25)); ctx.lineTo(4.5 + 7 * Math.cos(1.25), -11 + 7 * Math.sin(1.25)); ctx.stroke();
      ctx.fillStyle = '#7a4a26'; ctx.fillRect(-5.2, -15, 2, 6);
    } else if (w === 'crossbow') {
      ctx.strokeStyle = '#5d3e22'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(10, -11); ctx.stroke();
      ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(9, -15); ctx.quadraticCurveTo(10.5, -11, 9, -7); ctx.stroke();
    } else if (w === 'hammer') {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(7.5, -17.5); ctx.stroke();
      ctx.fillStyle = o.hammerCol || '#8c8f94'; ctx.save(); ctx.translate(7.8, -18); ctx.rotate(0.35); ctx.fillRect(-3, -1.8, 6, 3.6); ctx.restore();
    } else if (w === 'banner') {
      ctx.strokeStyle = '#5d3e22'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(5, -31); ctx.stroke();
      ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(5, -31);
      for (let i = 0; i <= 6; i++) ctx.lineTo(5 + i * 1.7, -31 + Math.sin(t * 5 + i * 0.9) * 0.9);
      for (let i = 6; i >= 0; i--) ctx.lineTo(5 + i * 1.7, -24 + Math.sin(t * 5 + i * 0.9) * 0.9);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#e2bd52'; ctx.lineWidth = 0.6; ctx.stroke();
    } else if (w === 'staff') {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(5.5, -22); ctx.stroke();
    }
    // щит
    if (o.shield) {
      const sc = o.shield === true ? o.col : o.shield;
      ctx.fillStyle = sc; ctx.strokeStyle = 'rgba(30,20,12,.9)'; ctx.lineWidth = 0.8;
      if (o.kite) { ctx.beginPath(); ctx.moveTo(-7.5, -14); ctx.lineTo(-1.5, -14); ctx.lineTo(-1.8, -9); ctx.lineTo(-4.5, -5); ctx.lineTo(-7.2, -9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(-4.3, -10, 3.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = o.emblem || '#e9d48a'; ctx.beginPath(); ctx.arc(o.kite ? -4.5 : -4.3, o.kite ? -10.5 : -10, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function horse(ctx, x, y, o, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale((o.sc || 1) * (o.face || 1), o.sc || 1);
    const sw = o.walk ? Math.sin(o.walk) * 2.5 : 0;
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5.5, -7); ctx.lineTo(-6 + sw, 0); ctx.moveTo(-3.5, -7); ctx.lineTo(-3 - sw, 0); ctx.moveTo(4, -7); ctx.lineTo(4.5 - sw, 0); ctx.moveTo(6, -7); ctx.lineTo(6.5 + sw, 0); ctx.stroke();
    ctx.fillStyle = o.coat || '#7a4a2a'; ctx.strokeStyle = 'rgba(30,18,10,.9)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -9.5, 8.5, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.5, -11.5); ctx.lineTo(9.5, -17.5); ctx.lineTo(12.8, -16); ctx.lineTo(9.5, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(-8, -10.5); ctx.quadraticCurveTo(-12, -9 + Math.sin(t * 4) * 1, -10.5, -4.5); ctx.lineTo(-8.4, -8.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6.5, -13); ctx.lineTo(9, -18); ctx.lineTo(7.8, -13.5); ctx.fill();
    if (o.caparison) { ctx.fillStyle = o.caparison; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(7, -10); ctx.lineTo(6, -5.2); ctx.lineTo(-7, -5.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#e2bd52'; ctx.lineWidth = 0.5; ctx.stroke(); }
    ctx.restore();
  }
  function wagon(ctx, x, y, o, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale((o.sc || 1) * (o.face || 1), o.sc || 1);
    const sp = o.walk ? o.walk : 0;
    ctx.fillStyle = '#6b4526'; ctx.strokeStyle = 'rgba(30,18,10,.9)'; ctx.lineWidth = 0.8;
    ctx.fillRect(-9, -9, 15, 5); ctx.strokeRect(-9, -9, 15, 5);
    ctx.fillStyle = '#efe5cf'; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.bezierCurveTo(-9, -17, 6, -17, 6, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,100,70,.6)'; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-4.5, -15.2); ctx.moveTo(1, -9); ctx.lineTo(1.5, -15.2); ctx.stroke();
    for (const wx of [-6, 3]) { ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.arc(wx, -3, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#c8a878'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(wx + Math.cos(sp) * 2.6, -3 + Math.sin(sp) * 2.6); ctx.lineTo(wx - Math.cos(sp) * 2.6, -3 - Math.sin(sp) * 2.6); ctx.stroke(); }
    ctx.fillStyle = o.col; ctx.fillRect(-2.5, -13, 4, 2.5);
    ctx.restore();
    horse(ctx, x + 12 * (o.face || 1) * (o.sc || 1), y, { sc: (o.sc || 1) * 0.75, face: o.face, walk: o.walk, coat: '#8a6a4a' }, t);
  }
  function catapult(ctx, x, y, o, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale((o.sc || 1) * (o.face || 1), o.sc || 1);
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(8, -4); ctx.moveTo(-6, -4); ctx.lineTo(-1, -14); ctx.lineTo(4, -4); ctx.stroke();
    const arm = o.fire ? -0.4 : 0.9;
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-1, -13); ctx.lineTo(-1 - Math.cos(arm) * 13, -13 - Math.sin(arm) * 9); ctx.stroke();
    ctx.fillStyle = '#7b7b7b'; ctx.beginPath(); ctx.arc(-1 - Math.cos(arm) * 13, -13 - Math.sin(arm) * 9, 2, 0, Math.PI * 2); ctx.fill();
    for (const wx of [-6, 5]) { ctx.fillStyle = '#3e2a18'; ctx.beginPath(); ctx.arc(wx, -2.5, 2.7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = o.col; ctx.fillRect(2, -10, 4, 3);
    ctx.restore();
  }
  const HERO_LOOK = {
    hero_paladin: { weapon: 'hammer', shield: true, kite: true, helm: 'gold', emblem: '#fff3b0', hammerCol: '#e2bd52' },
    hero_warlord: { weapon: 'banner', shield: true, helm: 'gold' },
    hero_ranger: { weapon: 'bow', helm: 'hood', hoodCol: '#2e4a2a' },
    hero_berserker: { weapon: 'axe2', helm: 'fur' },
  };
  /** Отряд целиком: строй из фигур, конница, повозка, катапульта или герой. */
  function squad(ctx, type, col, x, y, t, o) {
    o = o || {};
    const face = o.face || 1, walk = o.walking ? t * 14 : 0, sc = o.sc || 1, bandit = o.bandit;
    const tunic = bandit ? '#4a3a34' : col;
    const U = RF.Data.UNITS[type] || {};
    if (U.hero) {
      const L = HERO_LOOK[type] || {};
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const g = ctx.createRadialGradient(x, y - 2, 2, x, y - 2, 18 * sc);
      g.addColorStop(0, `rgba(255,224,120,${0.55 + pulse * 0.25})`); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 1, 18 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
      person(ctx, x, y + 2, { col, armor: '#d6b15a', cape: col, sc: 1.45 * sc, face, walk, ...L }, t);
      const lvl = o.lvl || 1;
      ctx.fillStyle = '#ffd95a'; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
      for (let i = 0; i < lvl; i++) { star(ctx, x + (i - (lvl - 1) / 2) * 5.2 * sc, y - 40 * sc, 2.4 * sc, 5); ctx.fill(); ctx.stroke(); }
      return;
    }
    if (type === 'settler') return wagon(ctx, x - 4 * face * sc, y + 2, { col, sc: sc * 1.05, face, walk }, t);
    if (type === 'builder') { person(ctx, x, y + 2, { col: tunic, helm: 'cap', weapon: 'hammer', sc: 1.15 * sc, face, walk }, t); return; }
    if (type === 'catapult') { catapult(ctx, x - 2, y + 2, { col, sc: 1.1 * sc, face, fire: o.fire }, t); person(ctx, x + 10 * face * sc, y + 2, { col: tunic, sc: 0.85 * sc, face, walk, helm: 'cap' }, t); return; }
    if (U.cls === 'mounted') {
      const knight = type === 'knight';
      const rows = [[-6, -2, 0.82], [5, 3, 0.95]];
      for (const [dx, dy, k] of rows) {
        const hx = x + dx * sc, hy = y + dy * sc;
        horse(ctx, hx, hy, { sc: k * sc, face, walk: walk + dx, coat: knight ? '#d9d4cc' : '#7a4a2a', caparison: knight ? col : null }, t);
        person(ctx, hx - 1 * face * k * sc, hy - 8.5 * k * sc, { col: tunic, sc: k * sc * 0.9, face, noLegs: true, helm: knight ? 'gold' : 'iron', weapon: knight ? 'lance' : 'spear', shield: knight ? true : false, kite: knight }, t);
      }
      return;
    }
    const looks = {
      warrior: { weapon: 'club', helm: 'cap', shield: '#8a6a44' },
      spearman: { weapon: 'spear', helm: 'iron', shield: true },
      archer: { weapon: 'bow', helm: 'hood', hoodCol: shade(col, -0.35) },
      swordsman: { weapon: 'sword', helm: 'iron', shield: true, kite: true },
      crossbow: { weapon: 'crossbow', helm: 'iron' },
      scout: { weapon: 'staff', helm: 'hood', hoodCol: '#3d5a2c' },
    };
    const L = bandit ? { weapon: 'axe', helm: 'hood', hoodCol: '#7a1e1a' } : (looks[type] || looks.warrior);
    const rows = type === 'scout' ? [[0, 2, 1.05]] : bandit ? [[-5, -1, 0.9], [5, 2, 1]] : [[-7, -3, 0.84], [7, -3, 0.84], [0, 3, 1]];
    for (const [dx, dy, k] of rows) person(ctx, x + dx * sc, y + dy * sc, { col: tunic, sc: k * sc, face, walk: walk ? walk + dx : 0, ...L }, t);
  }

  // ====================================================================== РЕНДЕРЕР
  const R = {
    canvas: null, ctx: null, s: null, size: 34, cam: { x: 0, y: 0, z: 1 }, W: 0, H: 0, dpr: 1, BK: 1.5,
    hover: null, reach: null, targets: null, path: null, pathTurns: null, selUnit: null, selCity: null, cityOverlay: null,
    floats: [], dirty: true, handlers: {}, passive: false, world: null,

    resetState() {
      Object.assign(this, { floats: [], parts: [], battles: [], ghosts: [], emitters: [], anim: {}, disp: {}, lunge: {}, facing: {}, born: {}, shake: null, lastT: 0, worldT: 0 });
    },
    init(canvas, handlers) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.handlers = handlers || {};
      this.resetState();
      this.bind();
      new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
      this.resize();
      const loop = (now) => {
        if (this.canvas.offsetParent !== null) { this.draw(now); if (this.handlers.frame) this.handlers.frame(); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    setState(s) { if (this.s !== s) this.resetState(); this.s = s; this.dirty = true; },
    resize() {
      const p = this.canvas.parentElement;
      this.dpr = window.devicePixelRatio || 1;
      this.W = p.clientWidth; this.H = p.clientHeight;
      this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
      this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
      this.vign = null;
    },
    center(c, r) { return [this.size * SQ3 * (c + 0.5 * (r & 1)) + this.size, this.size * 1.5 * r + this.size]; },
    toScreen(x, y) { return [(x - this.cam.x) * this.cam.z + this.W / 2, (y - this.cam.y) * this.cam.z + this.H / 2]; },
    centerOn(c, r) { const [x, y] = this.center(c, r); this.cam.x = x; this.cam.y = y; this.clampCam(); },
    hexIdx(s, x, y) {
      const size = this.size, xx = x - size, yy = y - size;
      const rf = yy / (1.5 * size), qf = xx / (SQ3 * size) - rf / 2;
      let q = Math.round(qf), r = Math.round(rf); const sf = -qf - rf, sr = Math.round(sf);
      const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(sr - sf);
      if (dq > dr && dq > ds) q = -r - sr; else if (dr > ds) r = -q - sr;
      const c = q + (r - (r & 1)) / 2;
      return c >= 0 && r >= 0 && c < s.w && r < s.h ? r * s.w + c : -1;
    },
    /** Клетка под точкой мира — по той же «волнистой» разметке, что видна на карте. */
    worldTile(x, y) {
      const Wd = this.world, s = this.s;
      if (Wd) {
        const px = Math.floor((x - Wd.ox) * K0), py = Math.floor((y - Wd.oy) * K0);
        if (px >= 0 && py >= 0 && px < Wd.GW && py < Wd.GH) { const i = Wd.tIdx0[py * Wd.GW + px]; return i >= 0 ? i : -1; }
      }
      return s ? this.hexIdx(s, x, y) : -1;
    },
    screenToTile(px, py) {
      if (!this.s) return null;
      const x = (px - this.W / 2) / this.cam.z + this.cam.x, y = (py - this.H / 2) / this.cam.z + this.cam.y;
      const i = this.worldTile(x, y);
      return i >= 0 ? [i % this.s.w, Math.floor(i / this.s.w)] : null;
    },
    float(c, r, text, color) { const [x, y] = this.center(c, r); this.floats.push({ x, y, text, color: color || '#fff', t0: performance.now() }); },

    bind() {
      const cv = this.canvas;
      let down = null, dragged = false;
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, btn: e.button }; dragged = false; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        const rect = cv.getBoundingClientRect();
        if (down) {
          const dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
          if (dragged) { this.cam.x = down.cx - dx / this.cam.z; this.cam.y = down.cy - dy / this.cam.z; this.clampCam(); }
          return;
        }
        const t = this.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        const k = t ? t.join(',') : null;
        if (k !== (this.hover && this.hover.join(','))) { this.hover = t; this.handlers.hover && this.handlers.hover(t); }
      });
      cv.addEventListener('pointerleave', () => { if (!down && this.hover) { this.hover = null; this.handlers.hover && this.handlers.hover(null); } });
      cv.addEventListener('pointerup', (e) => {
        if (!down) return;
        const btn = down.btn; down = null;
        if (dragged) return;
        const rect = cv.getBoundingClientRect();
        const t = this.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
        if (!t) return;
        if (btn === 2) this.handlers.rightClick && this.handlers.rightClick(t[0], t[1]);
        else this.handlers.click && this.handlers.click(t[0], t[1]);
      });
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        const px = e.clientX - rect.left, py = e.clientY - rect.top;
        const wx = (px - this.W / 2) / this.cam.z + this.cam.x, wy = (py - this.H / 2) / this.cam.z + this.cam.y;
        this.cam.z = clamp(this.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.5, 2.1);
        this.cam.x = wx - (px - this.W / 2) / this.cam.z; this.cam.y = wy - (py - this.H / 2) / this.cam.z;
        this.clampCam();
      }, { passive: false });
    },
    pan(dx, dy) { this.cam.x += dx / this.cam.z; this.cam.y += dy / this.cam.z; this.clampCam(); },
    clampCam() {
      if (!this.s) return;
      const [mx, my] = this.center(this.s.w - 1, this.s.h - 1);
      this.cam.x = clamp(this.cam.x, 0, mx + this.size);
      this.cam.y = clamp(this.cam.y, 0, my + this.size);
    },

    // ================================================================== ЗАПЕКАНИЕ МИРА
    buildWorld(s) {
      const size = this.size, BK = this.BK;
      const WW = size * SQ3 * (s.w + 0.5) + size, WH = size * 1.5 * (s.h - 1) + 2 * size;
      const M = size * 2.5, ox = -M, oy = -M, TW = WW + 2 * M, TH = WH + 2 * M;
      const GW = Math.ceil(TW * K0), GH = Math.ceil(TH * K0), NP = GW * GH;
      const N = makeNoise((s.seed | 0) ^ 0x5bd1e995);
      const tIdx0 = new Int32Array(NP), tc = new Uint8Array(NP);
      // «Волнистая» разметка: смещение растёт от центра клетки к краю — центры (города, отряды)
      // всегда остаются внутри своей клетки, а границы становятся природными.
      const A = size * 1.25;
      for (let py = 0; py < GH; py++) for (let px = 0; px < GW; px++) {
        const x = ox + (px + 0.5) / K0, y = oy + (py + 0.5) / K0;
        const i0 = this.hexIdx(s, x, y);
        let att = 1;
        if (i0 >= 0) { const [hx, hy] = this.center(i0 % s.w, Math.floor(i0 / s.w)); att = smooth(0.12, 0.7, Math.hypot(x - hx, y - hy) / size); }
        const fine = (N.fbm(x / 24 - 11, y / 24 + 5, 2) - 0.5) * size * 0.45;
        const wx = x + ((N.fbm(x / 80, y / 80, 2) - 0.5) * 2 * A + fine) * att, wy = y + ((N.fbm(x / 80 + 40, y / 80 - 30, 2) - 0.5) * 2 * A + fine * 0.8) * att;
        const i = this.hexIdx(s, wx, wy), p = py * GW + px;
        tIdx0[p] = i;
        tc[p] = i < 0 ? 0 : TCODE[s.tiles[i].t] || 0;
      }
      const land = new Float32Array(NP), hRaw = new Float32Array(NP);
      for (let p = 0; p < NP; p++) {
        const code = tc[p]; land[p] = code ? 1 : 0;
        const x = ox + ((p % GW) + 0.5) / K0, y = oy + (Math.floor(p / GW) + 0.5) / K0;
        hRaw[p] = HT[code] + (code ? (N.fbm(x / 38, y / 38, 2) - 0.5) * (code === 5 ? 0.5 : 0.22) : 0);
      }
      const hS = boxBlur(boxBlur(hRaw, GW, GH, 5), GW, GH, 4);
      const near = boxBlur(land, GW, GH, 3), far = boxBlur(boxBlur(land, GW, GH, 12), GW, GH, 10);
      const low = mkCanvas(GW, GH), lctx = low.getContext('2d');
      const img = lctx.createImageData(GW, GH), D = img.data;
      const lavaPts = [], wavePts = [];
      for (let py = 0; py < GH; py++) for (let px = 0; px < GW; px++) {
        const p = py * GW + px, code = tc[p];
        const x = ox + (px + 0.5) / K0, y = oy + (py + 0.5) / K0;
        let r, g, b;
        if (!code) {
          const k = smooth(0, 0.6, far[p]);
          r = lerp(16, 44, k); g = lerp(52, 122, k); b = lerp(98, 158, k);
          const rip = N.fbm(x / 24, y / 24, 2) - 0.5; r += rip * 12; g += rip * 18; b += rip * 20;
          const nn = near[p];
          if (nn > 0.12) { const f = smooth(0.12, 0.46, nn) * 0.7; r = lerp(r, 96, f); g = lerp(g, 190, f); b = lerp(b, 200, f); }
          if (nn > 0.36) { const f = smooth(0.36, 0.5, nn) * 0.85; r = lerp(r, 236, f); g = lerp(g, 248, f); b = lerp(b, 246, f); }
          if (nn < 0.05 && ((px * 7 + py * 13) % 97) === 0) wavePts.push([x, y, N.rnd() * 6.28]);
        } else {
          const P = PAL[code];
          const v = N.fbm(x / 62, y / 62, 3), v2 = N.fbm(x / 13 + 7, y / 13 - 3, 2);
          const k = clamp(v * 1.35 - 0.18 + (v2 - 0.5) * 0.55, 0, 1);
          r = lerp(P[0], P[3], k); g = lerp(P[1], P[4], k); b = lerp(P[2], P[5], k);
          if (code === 5 && hS[p] > 0.6) { const f = smooth(0.6, 0.8, hS[p]); r = lerp(r, 236, f); g = lerp(g, 240, f); b = lerp(b, 246, f); }
          if (code === 8) { const rd = Math.abs(N.fbm(x / 30, y / 30, 3) - 0.5); if (rd < 0.018) { const f = 1 - rd / 0.018; r = lerp(r, 255, f); g = lerp(g, 118, f * 0.9); b = lerp(b, 28, f * 0.6); if (f > 0.75 && (px * 3 + py * 5) % 11 === 0) lavaPts.push([x, y, N.rnd() * 6.28]); } }
          if (code === 7) { const f = N.fbm(x / 20, y / 20, 2); b += f * 10; }
          const nn = near[p];
          if (nn < 0.64 && code !== 5 && code !== 7 && code !== 8) { const f = (1 - smooth(0.5, 0.64, nn)) * 0.85; r = lerp(r, 224, f); g = lerp(g, 206, f); b = lerp(b, 150, f); }
          const xl = Math.max(0, px - 1), xr = Math.min(GW - 1, px + 1), yu = Math.max(0, py - 1), yd = Math.min(GH - 1, py + 1);
          const sh = (hS[py * GW + xr] - hS[py * GW + xl]) + (hS[yd * GW + px] - hS[yu * GW + px]);
          const L = 1 + clamp(sh * 9, -0.42, 0.42);
          r *= L; g *= L; b *= L;
        }
        D[p * 4] = r; D[p * 4 + 1] = g; D[p * 4 + 2] = b; D[p * 4 + 3] = 255;
      }
      lctx.putImageData(img, 0, 0);
      // запекание в высоком разрешении
      const bake = mkCanvas(TW * BK, TH * BK), b = bake.getContext('2d');
      b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
      b.drawImage(low, 0, 0, bake.width, bake.height);
      // зерно «краски»
      const grain = mkCanvas(128, 128), gx = grain.getContext('2d'), gi = gx.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) { const v = 128 + (N.rnd() - 0.5) * 90; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
      gx.putImageData(gi, 0, 0);
      b.globalCompositeOperation = 'overlay'; b.globalAlpha = 0.14; b.fillStyle = b.createPattern(grain, 'repeat'); b.fillRect(0, 0, bake.width, bake.height);
      b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
      b.setTransform(BK, 0, 0, BK, -ox * BK, -oy * BK);
      const tileAtW = (x, y) => { const px = Math.floor((x - ox) * K0), py = Math.floor((y - oy) * K0); return px >= 0 && py >= 0 && px < GW && py < GH ? tIdx0[py * GW + px] : -1; };
      // реки
      const rnd = mulberry((s.seed | 0) + 77);
      for (const path of s.rivers || []) {
        const base = path.map((i, k) => { const [x, y] = this.center(i % s.w, Math.floor(i / s.w)); return k === 0 || k === path.length - 1 ? [x, y] : [x + (rnd() - 0.5) * size * 0.4, y + (rnd() - 0.5) * size * 0.4]; });
        // меандры: промежуточные точки со смещением поперёк течения
        const pts = [base[0]];
        for (let k = 1; k < base.length; k++) {
          const [x0, y0] = base[k - 1], [x1, y1] = base[k], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
          for (const f of [0.33, 0.66]) { const o = (rnd() - 0.5) * size * 0.55; pts.push([x0 + dx * f - (dy / L) * o, y0 + dy * f + (dx / L) * o]); }
          pts.push(base[k]);
        }
        const curve = () => { b.beginPath(); b.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) b.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2); b.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
        b.lineCap = 'round'; b.lineJoin = 'round';
        curve(); b.strokeStyle = 'rgba(70,80,40,.3)'; b.lineWidth = 7; b.stroke();
        curve(); b.strokeStyle = '#2e6c98'; b.lineWidth = 4.4; b.stroke();
        curve(); b.strokeStyle = '#58a8d6'; b.lineWidth = 2.6; b.stroke();
        curve(); b.strokeStyle = 'rgba(210,240,252,.65)'; b.lineWidth = 0.8; b.stroke();
      }
      // декор: деревья, горы, холмы, дюны
      const sprites = [];
      const volcanoes = [];
      for (let i = 0; i < s.tiles.length; i++) {
        const t = s.tiles[i];
        if (t.t === 'ocean') continue;
        const c = i % s.w, r = Math.floor(i / s.w);
        const [cx, cy] = this.center(c, r);
        const north = r / s.h < 0.22;
        const scatter = (n, fn, spread) => {
          for (let k = 0; k < n; k++) {
            const x = cx + (rnd() - 0.5) * size * (spread || 2), y = cy + (rnd() - 0.5) * size * (spread || 2) * 0.9;
            if (tileAtW(x, y) !== i) continue;
            fn(x, y);
          }
        };
        if (t.t === 'forest') scatter(26, (x, y) => { const sc = 0.85 + rnd() * 0.4; const con = north || rnd() < 0.3; sprites.push([y, () => (con ? treeConifer(b, x, y, sc, north) : treeDeciduous(b, x, y, sc, rnd))]); }, 2.1);
        else if (t.t === 'tundra') scatter(4, (x, y) => { if (rnd() < 0.6) sprites.push([y, () => treeConifer(b, x, y, 0.8, true)]); });
        else if (t.t === 'grass' || t.t === 'plains') scatter(t.t === 'grass' ? 3 : 2, (x, y) => { if (rnd() < 0.45) sprites.push([y, () => treeDeciduous(b, x, y, 0.75, rnd)]); });
        else if (t.t === 'hills' || t.t === 'ash') {
          const tint = t.t === 'ash' ? ['#5a3428', '#7a4a36', '#3a201a'] : ['#8d8a52', '#aaa46a', '#686336'];
          scatter(4, (x, y) => sprites.push([y, () => hillMound(b, x, y, 9 + rnd() * 5, 7 + rnd() * 4, tint)]), 1.5);
        } else if (t.t === 'mountain') {
          if (t.volcano) { volcanoes.push([cx, cy - 34]); sprites.push([cy + 4, () => volcanoSprite(b, cx, cy + 6)]); continue; }
          const n = 4 + Math.floor(rnd() * 2);
          scatter(n + 3, (x, y) => { const h = 18 + rnd() * 16, w = 10 + rnd() * 6; sprites.push([y, () => mountainPeak(b, x, y + 6, h, w, rnd, h > 22 || north)]); }, 1.6);
          sprites.push([cy + 6, () => mountainPeak(b, cx, cy + 8, 30 + rnd() * 8, 15, rnd, true)]);
        } else if (t.t === 'desert') {
          b.strokeStyle = 'rgba(160,120,60,.45)'; b.lineWidth = 1.2;
          for (let k = 0; k < 3; k++) { const x = cx + (rnd() - 0.5) * size, y = cy + (rnd() - 0.5) * size * 0.8; b.beginPath(); b.moveTo(x - 9, y); b.quadraticCurveTo(x, y - 5, x + 9, y); b.stroke(); b.strokeStyle = 'rgba(255,240,200,.35)'; b.beginPath(); b.moveTo(x - 8, y - 1.5); b.quadraticCurveTo(x - 2, y - 5.5, x + 3, y - 3.5); b.stroke(); b.strokeStyle = 'rgba(160,120,60,.45)'; }
        }
        if (t.t === 'tundra') { b.strokeStyle = 'rgba(255,255,255,.7)'; b.lineWidth = 1.2; for (let k = 0; k < 2; k++) { const x = cx + (rnd() - 0.5) * size, y = cy + (rnd() - 0.5) * size * 0.8; b.beginPath(); b.moveTo(x - 7, y); b.quadraticCurveTo(x, y - 3, x + 7, y); b.stroke(); } }
      }
      sprites.sort((a, c) => a[0] - c[0]);
      for (const [, fn] of sprites) fn();
      b.setTransform(1, 0, 0, 1, 0, 0);
      // сетка для тумана/масок
      const GW1 = Math.ceil(TW * K1), GH1 = Math.ceil(TH * K1), tIdx1 = new Int32Array(GW1 * GH1), cloud = new Float32Array(GW1 * GH1);
      for (let py = 0; py < GH1; py++) for (let px = 0; px < GW1; px++) {
        tIdx1[py * GW1 + px] = tIdx0[Math.min(GH - 1, py * 2 + 1) * GW + Math.min(GW - 1, px * 2 + 1)];
        const x = ox + (px + 0.5) / K1, y = oy + (py + 0.5) / K1;
        cloud[py * GW1 + px] = N.fbm(x / 85, y / 85, 4);
      }
      // плывущие облака
      const clouds = [];
      const cn = Math.max(5, Math.round((TW * TH) / 220000));
      for (let k = 0; k < cn; k++) clouds.push({ x: ox + rnd() * TW, y: oy + rnd() * TH, s: 0.7 + rnd() * 0.9, v: 6 + rnd() * 8 });
      return { key: `${s.seed}:${s.w}x${s.h}`, ox, oy, TW, TH, GW, GH, GW1, GH1, tIdx0, tIdx1, cloud, bake, lavaPts: lavaPts.slice(0, 500), wavePts, volcanoes, clouds, borderKey: null, fogKey: null, reachKey: null, mm: null };
    },
    ensureWorld(s) {
      const key = `${s.seed}:${s.w}x${s.h}`;
      if (!this.world || this.world.key !== key) { this.world = this.buildWorld(s); this.worldT = performance.now(); }
      return this.world;
    },
    ensureBorders(s, Wd) {
      let h = 7;
      const codes = {}; s.order.forEach((id, k) => (codes[id] = k + 1));
      for (let i = 0; i < s.tiles.length; i++) { const o = s.tiles[i].owner; h = (Math.imul(h, 31) + (o ? codes[o] || 9 : 0)) | 0; }
      if (Wd.borderKey === h && Wd.borderCv) return Wd.borderCv;
      Wd.borderKey = h;
      const { GW, GH, tIdx0 } = Wd, NP = GW * GH;
      const own = new Int16Array(NP);
      const rgb = [null];
      s.order.forEach((id) => rgb.push(rgbOf(s.realms[id].color)));
      for (let p = 0; p < NP; p++) { const i = tIdx0[p]; const o = i >= 0 ? s.tiles[i].owner : null; own[p] = o ? codes[o] || 0 : 0; }
      const tmp = mkCanvas(GW, GH), tx = tmp.getContext('2d'), img = tx.createImageData(GW, GH), D = img.data;
      for (let py = 0; py < GH; py++) for (let px = 0; px < GW; px++) {
        const p = py * GW + px, o = own[p];
        if (!o) continue;
        let edge = 0;
        for (let d = 1; d <= 2 && !edge; d++) {
          if (px - d < 0 || own[p - d] !== o || px + d >= GW || own[p + d] !== o || py - d < 0 || own[p - d * GW] !== o || py + d >= GH || own[p + d * GW] !== o) edge = d;
        }
        const [r, g, b] = rgb[o];
        const k = edge === 1 ? 0.45 : 0;
        D[p * 4] = lerp(r, 255, k); D[p * 4 + 1] = lerp(g, 240, k); D[p * 4 + 2] = lerp(b, 200, k);
        D[p * 4 + 3] = edge === 1 ? 255 : edge === 2 ? 235 : 46;
      }
      tx.putImageData(img, 0, 0);
      const cv = Wd.borderCv || mkCanvas(GW, GH), cx = cv.getContext('2d');
      cx.clearRect(0, 0, GW, GH);
      cx.filter = 'blur(2.5px)'; cx.globalAlpha = 0.9; cx.drawImage(tmp, 0, 0);
      cx.filter = 'none'; cx.globalAlpha = 1; cx.drawImage(tmp, 0, 0);
      Wd.borderCv = cv;
      return cv;
    },
    ensureFog(s, Wd) {
      const vis = s._vis;
      let h = vis ? vis.size : 0, ex = 0;
      for (let i = 0; i < s.explored.length; i++) if (s.explored[i]) ex += (i % 13) + 1;
      if (vis) for (const k of vis) h = (Math.imul(h, 31) + k) | 0;
      const key = ex + ':' + h;
      if (Wd.fogKey === key && Wd.fogCv) return Wd.fogCv;
      Wd.fogKey = key;
      const { GW1, GH1, tIdx1, cloud } = Wd, NP = GW1 * GH1;
      const tmp = mkCanvas(GW1, GH1), tx = tmp.getContext('2d'), img = tx.createImageData(GW1, GH1), D = img.data;
      for (let p = 0; p < NP; p++) {
        const i = tIdx1[p];
        const state = i < 0 ? 1 : !s.explored[i] ? 2 : vis && vis.has(i) ? 0 : 1;
        if (state === 2) {
          const v = cloud[p], c = smooth(0.25, 0.8, v);
          D[p * 4] = lerp(118, 246, c); D[p * 4 + 1] = lerp(128, 248, c); D[p * 4 + 2] = lerp(150, 252, c); D[p * 4 + 3] = 255;
        } else if (state === 1) { D[p * 4] = 10; D[p * 4 + 1] = 14; D[p * 4 + 2] = 30; D[p * 4 + 3] = 100; }
      }
      tx.putImageData(img, 0, 0);
      const cv = Wd.fogCv || mkCanvas(GW1, GH1), cx = cv.getContext('2d');
      cx.clearRect(0, 0, GW1, GH1); cx.filter = 'blur(3.2px)'; cx.drawImage(tmp, 0, 0); cx.filter = 'none';
      Wd.fogCv = cv;
      return cv;
    },
    ensureReach(Wd) {
      if (!this.reach || !this.reach.size) return null;
      if (Wd.reachKey === this.reach && Wd.reachCv) return Wd.reachCv;
      Wd.reachKey = this.reach;
      const s = this.s, set = new Set();
      for (const v of this.reach.values()) set.add(v.r * s.w + v.c);
      const { GW1, GH1, tIdx1 } = Wd;
      const tmp = mkCanvas(GW1, GH1), tx = tmp.getContext('2d'), img = tx.createImageData(GW1, GH1), D = img.data;
      const inS = (p) => set.has(tIdx1[p]);
      for (let py = 1; py < GH1 - 1; py++) for (let px = 1; px < GW1 - 1; px++) {
        const p = py * GW1 + px;
        if (!inS(p)) continue;
        const edge = !inS(p - 1) || !inS(p + 1) || !inS(p - GW1) || !inS(p + GW1);
        D[p * 4] = 255; D[p * 4 + 1] = 244; D[p * 4 + 2] = 196; D[p * 4 + 3] = edge ? 230 : 62;
      }
      tx.putImageData(img, 0, 0);
      const cv = Wd.reachCv || mkCanvas(GW1, GH1), cx = cv.getContext('2d');
      cx.clearRect(0, 0, GW1, GH1); cx.filter = 'blur(0.8px)'; cx.drawImage(tmp, 0, 0); cx.filter = 'none';
      Wd.reachCv = cv;
      return cv;
    },

    // ================================================================== ЭФФЕКТЫ
    isVis(c, r) {
      if (this.passive) return true;
      const v = this.s._vis; return !!(v && v.has(r * this.s.w + c));
    },
    unitTarget(u) {
      const [x, y] = this.center(u.c, u.r);
      return RF.Engine.cityAt(this.s, u.c, u.r) ? [x + this.size * 0.55, y + this.size * 0.12] : [x, y + 4];
    },
    drainFx(s, now) {
      const q = s._fx;
      if (!q || !q.length) return;
      const list = q.splice(0, q.length);
      let stagger = 0;
      for (const e of list) {
        try { this.onFx(e, now, stagger); } catch (err) { console.warn('fx', err); }
        if (e.type === 'battle') stagger++;
        if (this.handlers.onFx) this.handlers.onFx(e);
      }
    },
    onFx(e, now, stagger) {
      const s = this.s, size = this.size;
      if (e.type === 'move') {
        const u = s.units[e.id];
        if (!u) return;
        if (!this.passive && !e.path.some(([c, r]) => this.isVis(c, r))) { delete this.disp[u.id]; return; }
        const pts = e.path.map(([c, r]) => { const [x, y] = this.center(c, r); return [x, y + 4]; });
        pts[pts.length - 1] = this.unitTarget(u);
        const d0 = this.disp[u.id]; if (d0) pts[0] = [d0.x, d0.y];
        const a = this.anim[u.id];
        if (a && now < a.t0 + a.dur) { a.pts = a.pts.concat(pts.slice(1)); a.dur += 170 * (pts.length - 1); }
        else this.anim[u.id] = { pts, t0: now, dur: 170 * (pts.length - 1) };
        const dx = pts[pts.length - 1][0] - pts[0][0]; if (Math.abs(dx) > 1) this.facing[u.id] = dx < 0 ? -1 : 1;
      } else if (e.type === 'battle') {
        if (!this.isVis(e.from[0], e.from[1]) && !this.isVis(e.to[0], e.to[1])) return;
        const A = this.center(e.from[0], e.from[1]), B = this.center(e.to[0], e.to[1]);
        const am = this.anim[e.aid];
        const t0 = Math.max(now + stagger * 280, am ? am.t0 + am.dur : 0);
        const b = { e, t0, dur: e.ranged ? 760 : 640, A: [A[0], A[1] + 4], B: [B[0], B[1] + 4], impact: false };
        b.tImpact = t0 + b.dur * (e.ranged ? 1 : 0.5);
        this.battles.push(b);
        if (Math.abs(B[0] - A[0]) > 1) this.facing[e.aid] = B[0] < A[0] ? -1 : 1;
        if (!e.ranged && !e.died) this.lunge[e.aid] = b;
        if (e.killed && e.dtype) this.ghosts.push({ type: e.dtype, realm: e.def, x: B[0], y: B[1] + 4, tEnd: b.tImpact, face: A[0] < B[0] ? -1 : 1 });
        if (e.died) this.ghosts.push({ type: e.utype, realm: e.att, x: A[0], y: A[1] + 4, tEnd: b.tImpact, battle: e.ranged ? null : b, face: B[0] < A[0] ? -1 : 1 });
      } else if (e.type === 'capture') {
        const [x, y] = this.center(e.c, e.r);
        this.emitters.push({ x, y: y - 8, kind: 'fire', t0: now + 400, until: now + 4200, rate: 26, acc: 0, spread: 18 });
        this.emitters.push({ x, y: y - 14, kind: 'smoke', t0: now + 400, until: now + 5200, rate: 9, acc: 0, spread: 14, dark: true });
        this.floats.push({ x, y: y - 20, text: 'Город захвачен!', color: '#ffd36b', t0: now + 500, big: true });
      } else if (e.type === 'levelup') {
        const [x, y] = this.center(e.c, e.r);
        for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; this.parts.push({ kind: 'star', x, y: y - 14, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, life: 0, max: 1.1, r: 2.6 }); }
        this.floats.push({ x, y: y - 26, text: `Уровень ${e.lvl}!`, color: '#ffe27a', t0: now, big: true });
      } else if (e.type === 'herofall') {
        const [x, y] = this.center(e.c, e.r);
        for (let k = 0; k < 14; k++) this.parts.push({ kind: 'smoke', x: x + (Math.random() - 0.5) * 16, y: y - 6, vx: (Math.random() - 0.5) * 12, vy: -12 - Math.random() * 10, life: 0, max: 1.8, r: 4, dark: true });
        this.floats.push({ x, y: y - 24, text: 'Герой пал', color: '#ffb3a8', t0: now + 300, big: true });
      } else if (e.type === 'heal') {
        if (!this.isVis(e.c, e.r)) return;
        const [x, y] = this.center(e.c, e.r);
        for (let k = 0; k < 5; k++) this.parts.push({ kind: 'heal', x: x + (Math.random() - 0.5) * 18, y: y - 8, vx: 0, vy: -16, life: -k * 0.12, max: 1.3, r: 3 });
      }
    },
    impact(b, now) {
      const e = b.e, [x, y] = b.B, size = this.size;
      const n = e.city ? 26 : 18;
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70; this.parts.push({ kind: 'spark', x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: 0.45 + Math.random() * 0.3 }); }
      for (let k = 0; k < 6; k++) this.parts.push({ kind: 'smoke', x: x + (Math.random() - 0.5) * 14, y: y - 4, vx: (Math.random() - 0.5) * 18, vy: -8 - Math.random() * 8, life: 0, max: 1.1, r: 3.5, dust: true });
      if (e.toDef) this.floats.push({ x, y: y - 14, text: `−${e.toDef}`, color: '#ff8f80', t0: now });
      if (e.toAtt) this.floats.push({ x: b.A[0], y: b.A[1] - 14, text: `−${e.toAtt}`, color: '#ffe08a', t0: now + 120 });
      if (e.killed) this.floats.push({ x, y: y - 30, text: '✖', color: '#ffffff', t0: now + 200, big: true });
      if (!this.passive) { this.shake = { t0: now, amp: e.city ? 5 : 3.5 }; if (this.handlers.sfx) this.handlers.sfx(e.ranged ? 'sword' : 'sword'); }
      void size;
    },
    emit(kind, x, y, o) {
      if (this.parts.length > 900) return;
      const p = { kind, x, y, vx: 0, vy: 0, life: 0, max: 1, r: 3, ...o };
      this.parts.push(p);
    },
    stepParticles(dt) {
      const wind = 7;
      for (const p of this.parts) {
        p.life += dt;
        if (p.life < 0) continue;
        if (p.kind === 'spark') { p.vy += 160 * dt; }
        else if (p.kind === 'smoke') { p.vx += (wind - p.vx) * dt * 0.4; p.vy *= 1 - dt * 0.3; }
        else if (p.kind === 'ember') { p.vx += Math.sin(p.life * 6 + p.x) * 12 * dt; }
        else if (p.kind === 'star') { p.vx *= 1 - dt * 2.5; p.vy *= 1 - dt * 2.5; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      this.parts = this.parts.filter((p) => p.life < p.max);
    },
    drawParticles(ctx) {
      for (const p of this.parts) {
        if (p.life < 0) continue;
        const k = p.life / p.max;
        if (p.kind === 'smoke') {
          const r = (p.r || 3) * (1 + k * 2.6);
          ctx.fillStyle = p.dark ? `rgba(48,40,38,${0.55 * (1 - k)})` : p.dust ? `rgba(150,125,90,${0.45 * (1 - k)})` : `rgba(225,225,222,${0.45 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'spark') {
          ctx.strokeStyle = `rgba(255,${200 - k * 120},90,${1 - k})`; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else if (p.kind === 'ember') {
          ctx.fillStyle = `rgba(255,${150 + Math.sin(p.life * 20) * 60},40,${1 - k})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'fire') {
          const r = (p.r || 5) * (1 - k * 0.7);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,240,150,${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(255,120,30,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(200,40,10,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'heal') {
          ctx.fillStyle = `rgba(120,255,140,${1 - k})`; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', p.x, p.y);
        } else if (p.kind === 'star') {
          ctx.fillStyle = `rgba(255,226,110,${1 - k})`; star(ctx, p.x, p.y, p.r * (1 - k * 0.5), 4); ctx.fill();
        }
      }
    },

    // ================================================================== КАДР
    draw(now) {
      now = now || performance.now();
      const ctx = this.ctx, s = this.s;
      const dt = Math.min(0.05, Math.max(0, (now - (this.lastT || now)) / 1000)); this.lastT = now;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#123552'; ctx.fillRect(0, 0, this.W, this.H);
      if (!s) return;
      const E = RF.Engine;
      const Wd = this.ensureWorld(s);
      this.drainFx(s, now);
      const t = now / 1000, size = this.size, z = this.cam.z;
      let shx = 0, shy = 0;
      if (this.shake) { const k = (now - this.shake.t0) / 320; if (k > 1) this.shake = null; else { const a = this.shake.amp * (1 - k); shx = (Math.random() - 0.5) * a * 2; shy = (Math.random() - 0.5) * a * 2; } }
      ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.W / 2 - this.cam.x * z + shx), this.dpr * (this.H / 2 - this.cam.y * z + shy));
      const vx0 = this.cam.x - this.W / 2 / z - size * 2, vx1 = this.cam.x + this.W / 2 / z + size * 2;
      const vy0 = this.cam.y - this.H / 2 / z - size * 2, vy1 = this.cam.y + this.H / 2 / z + size * 2;
      const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(Wd.bake, Wd.ox, Wd.oy, Wd.TW, Wd.TH);
      // блики на воде и лава
      ctx.lineCap = 'round';
      for (const [x, y, ph] of Wd.wavePts) {
        if (!inView(x, y)) continue;
        const a = Math.sin(t * 1.3 + ph); if (a < 0.15) continue;
        const dx = Math.sin(t * 0.4 + ph) * 4;
        ctx.strokeStyle = `rgba(225,245,255,${a * 0.45})`; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x - 5 + dx, y); ctx.quadraticCurveTo(x + dx, y - 2.2 * a, x + 5 + dx, y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, ph] of Wd.lavaPts) {
        if (!inView(x, y)) continue;
        const a = 0.12 + 0.12 * Math.sin(t * 2.2 + ph);
        ctx.fillStyle = `rgba(255,110,30,${a})`; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      for (const [x, y] of Wd.volcanoes) {
        if (!inView(x, y)) continue;
        const a = 0.35 + 0.2 * Math.sin(t * 3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22); g.addColorStop(0, `rgba(255,150,50,${a})`); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
        if (Math.random() < dt * 7) this.emit('smoke', x + (Math.random() - 0.5) * 6, y - 2, { vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 8, max: 3.2, r: 4, dark: true });
        if (Math.random() < dt * 5) this.emit('ember', x, y, { vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, max: 1.4 });
      }
      ctx.globalCompositeOperation = 'source-over';
      // тени облаков
      this.drawClouds(ctx, Wd, t, dt, true);
      // границы
      ctx.drawImage(this.ensureBorders(s, Wd), Wd.ox, Wd.oy, Wd.TW, Wd.TH);
      // объекты клеток
      const vis = this.passive ? null : (s._vis || E.updateVisibility(s));
      const seen = (i) => this.passive || s.explored[i];
      const r0 = clamp(Math.floor((vy0 - size) / (1.5 * size)) - 1, 0, s.h - 1), r1 = clamp(Math.ceil((vy1 - size) / (1.5 * size)) + 1, 0, s.h - 1);
      const c0 = clamp(Math.floor((vx0 - size) / (SQ3 * size)) - 1, 0, s.w - 1), c1 = clamp(Math.ceil((vx1 - size) / (SQ3 * size)) + 1, 0, s.w - 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const i = r * s.w + c;
        if (!seen(i)) continue;
        const tl = s.tiles[i], [x, y] = this.center(c, r);
        if (tl.imp) this.improvement(ctx, tl.imp, x, y, i);
        if (tl.district) this.district(ctx, tl.district, x, y, i);
        if (tl.camp) this.camp(ctx, x, y, t, dt);
        if (tl.res) this.resource(ctx, tl.res, x + size * 0.48, y + size * 0.36);
      }
      // подсветки
      const rc = this.ensureReach(Wd);
      if (rc) { ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3); ctx.drawImage(rc, Wd.ox, Wd.oy, Wd.TW, Wd.TH); ctx.globalAlpha = 1; }
      if (this.cityOverlay) this.drawCityOverlay(ctx, s, size);
      if (this.path && this.path.length) this.drawPath(ctx, s, t);
      if (this.hover) {
        const [x, y] = this.center(this.hover[0], this.hover[1]);
        const g = ctx.createRadialGradient(x, y, 4, x, y, size * 0.95);
        g.addColorStop(0, 'rgba(255,245,200,.0)'); g.addColorStop(0.7, 'rgba(255,240,190,.18)'); g.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, size * 0.95, size * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,190,.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 12;
        ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.62, size * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (this.targets) for (const k of this.targets) {
        const [c, r] = k.split(',').map(Number), [x, y] = this.center(c, r);
        const p = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.strokeStyle = `rgba(255,70,50,${0.6 + p * 0.4})`; ctx.lineWidth = 2.5 + p;
        ctx.beginPath(); ctx.ellipse(x, y + 3, size * 0.6, size * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
        this.swords(ctx, x, y - size * 0.62, 7);
      }
      // спрайты по глубине: города, отряды, «призраки» павших
      const items = [];
      for (const city of Object.values(s.cities)) {
        if (!seen(city.r * s.w + city.c)) continue;
        const [x, y] = this.center(city.c, city.r);
        if (!inView(x, y)) continue;
        items.push([y, () => this.city(ctx, s, city, x, y, t, dt, !vis || vis.has(city.r * s.w + city.c))]);
      }
      for (const u of Object.values(s.units)) {
        if (vis && !vis.has(u.r * s.w + u.c)) { const a = this.anim[u.id]; if (!a || now > a.t0 + a.dur) { delete this.disp[u.id]; continue; } }
        const pos = this.unitPos(u, now, dt);
        if (!inView(pos[0], pos[1])) continue;
        items.push([pos[1], () => this.unit(ctx, s, u, pos, t, now)]);
      }
      this.ghosts = this.ghosts.filter((g) => now < g.tEnd + 900);
      for (const g of this.ghosts) items.push([g.y, () => this.ghost(ctx, s, g, t, now)]);
      items.sort((a, b) => a[0] - b[0]);
      for (const [, fn] of items) fn();
      // сражения: снаряды и удары
      this.battles = this.battles.filter((b) => {
        const k = (now - b.t0) / b.dur;
        if (k < 0) return true;
        if (b.e.ranged && k <= 1) this.projectile(ctx, b, k);
        if (!b.impact && now >= b.tImpact) { b.impact = true; this.impact(b, now); }
        if (k > 1.05) { if (this.lunge[b.e.aid] === b) delete this.lunge[b.e.aid]; return false; }
        return true;
      });
      // излучатели (пожары) и частицы
      this.emitters = this.emitters.filter((em) => {
        if (now < em.t0) return true;
        em.acc += dt * em.rate;
        while (em.acc > 1) { em.acc--; this.emit(em.kind, em.x + (Math.random() - 0.5) * em.spread, em.y + (Math.random() - 0.5) * em.spread * 0.5, em.kind === 'fire' ? { vx: (Math.random() - 0.5) * 8, vy: -22 - Math.random() * 18, max: 0.8 + Math.random() * 0.4, r: 5 + Math.random() * 4 } : { vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 8, max: 2.6, r: 4, dark: em.dark }); }
        return now < em.until;
      });
      this.stepParticles(dt);
      ctx.globalCompositeOperation = 'source-over';
      this.drawParticles(ctx);
      // облака
      this.drawClouds(ctx, Wd, t, dt, false);
      // туман войны
      if (!this.passive) ctx.drawImage(this.ensureFog(s, Wd), Wd.ox, Wd.oy, Wd.TW, Wd.TH);
      // всплывающие надписи
      this.floats = this.floats.filter((f) => now - f.t0 < 1600);
      for (const f of this.floats) {
        const k = (now - f.t0) / 1600; if (k < 0) continue;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `bold ${f.big ? 15 : 17}px Cinzel, "PT Serif", serif`; ctx.textAlign = 'center';
        const yy = f.y - 18 - k * 34;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,6,.9)'; ctx.strokeText(f.text, f.x, yy);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, yy);
        ctx.globalAlpha = 1;
      }
      // виньетка
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (!this.vign || this.vign.w !== this.W || this.vign.h !== this.H) {
        const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, this.passive ? 'rgba(8,5,3,.6)' : 'rgba(8,5,3,.38)');
        this.vign = { w: this.W, h: this.H, g };
      }
      ctx.fillStyle = this.vign.g; ctx.fillRect(0, 0, this.W, this.H);
    },

    drawClouds(ctx, Wd, t, dt, shadows) {
      if (!this.cloudSprite) {
        const cs = mkCanvas(260, 150), c = cs.getContext('2d');
        const rnd = mulberry(99);
        for (let k = 0; k < 16; k++) {
          const x = 50 + rnd() * 160, y = 50 + rnd() * 50, r = 22 + rnd() * 30;
          const g = c.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
          g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, 'rgba(240,244,250,.7)'); g.addColorStop(1, 'rgba(220,228,240,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        }
        R.cloudSprite = cs;
        const sh = mkCanvas(260, 150), sc = sh.getContext('2d');
        sc.drawImage(cs, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#0a1420'; sc.fillRect(0, 0, 260, 150);
        R.cloudShadow = sh;
      }
      const alpha = this.passive ? 0.55 : 0.2;
      for (const cl of Wd.clouds) {
        if (!shadows) { cl.x += cl.v * dt; if (cl.x > Wd.ox + Wd.TW + 200) cl.x = Wd.ox - 300; }
        const w = 260 * cl.s * 1.6, h = 150 * cl.s * 1.6;
        if (shadows) { ctx.globalAlpha = alpha * 0.4; ctx.drawImage(this.cloudShadow, cl.x - w / 2 + 50, cl.y - h / 2 + 80, w, h); }
        else { ctx.globalAlpha = alpha; ctx.drawImage(this.cloudSprite, cl.x - w / 2, cl.y - h / 2, w, h); }
      }
      ctx.globalAlpha = 1;
    },

    unitPos(u, now, dt) {
      const tgt = this.unitTarget(u);
      const lg = this.lunge[u.id];
      const d = this.disp[u.id];
      let x = tgt[0], y = tgt[1], walking = false;
      if (lg && now < lg.t0 + lg.dur && d) {
        x = d.x; y = d.y;
        const k = (now - lg.t0) / lg.dur;
        if (k > 0) { const o = Math.sin(Math.PI * k) * 0.42; x += (lg.B[0] - lg.A[0]) * o; y += (lg.B[1] - lg.A[1]) * o; }
        return [x, y, false];
      }
      let a = this.anim[u.id];
      if (!a && d && Math.abs(d.x - tgt[0]) + Math.abs(d.y - tgt[1]) > 2) { a = this.anim[u.id] = { pts: [[d.x, d.y], tgt], t0: now, dur: 300 }; if (Math.abs(tgt[0] - d.x) > 1) this.facing[u.id] = tgt[0] < d.x ? -1 : 1; }
      if (a) {
        const k = (now - a.t0) / a.dur;
        if (k >= 1) delete this.anim[u.id];
        else {
          const kk = Math.max(0, k), n = a.pts.length - 1, sg = kk * n, i = Math.min(n - 1, Math.floor(sg)), f = sg - i;
          x = lerp(a.pts[i][0], a.pts[i + 1][0], f); y = lerp(a.pts[i][1], a.pts[i + 1][1], f);
          walking = k >= 0;
          if (walking && Math.random() < dt * 8) this.emit('smoke', x + (Math.random() - 0.5) * 10, y, { vx: (Math.random() - 0.5) * 6, vy: -4, max: 0.7, r: 2, dust: true });
        }
      }
      if (!d && !this.born[u.id] && this.worldT && now - this.worldT > 800) this.born[u.id] = now;
      this.disp[u.id] = { x, y };
      return [x, y, walking];
    },

    unit(ctx, s, u, pos, t, now) {
      const E = RF.Engine;
      const [x, y, walking] = pos;
      const R0 = s.realms[u.realm], col = R0.color, bandit = u.realm === E.BANDITS;
      const sel = this.selUnit === u.id, mine = u.realm === E.PLAYER;
      const inCity = !!E.cityAt(s, u.c, u.r);
      let sc = inCity ? 0.78 : 1;
      const b = this.born[u.id];
      if (b) { const k = (now - b) / 450; if (k >= 1) delete this.born[u.id]; else sc *= 0.3 + 0.7 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)); }
      const hash = (strHash(u.id) % 100) / 100;
      const bob = walking ? 0 : Math.sin(t * 2 + hash * 6) * 0.5;
      // подложка
      if (sel) {
        ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 2.2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 18;
        ctx.beginPath(); ctx.ellipse(x, y + 1, 21 * sc, 8.5 * sc, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(10,8,4,.35)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 16 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA(bandit ? '#3a2a24' : col, 0.6); ctx.strokeStyle = mine ? '#f2d27a' : shade(bandit ? '#3a2a24' : col, -0.3); ctx.lineWidth = mine ? 1.6 : 1.1;
      ctx.beginPath(); ctx.ellipse(x, y + 1, 15 * sc, 5.4 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const face = this.facing[u.id] || (hash > 0.5 ? 1 : -1);
      const bt = this.battles.find((bb) => bb.e.aid === u.id && bb.e.ranged && now >= bb.t0 && now < bb.t0 + 250);
      squad(ctx, u.type, col, x, y + bob, t, { face, walking, sc, bandit, lvl: u.hero ? u.hero.lvl : 0, fire: !!bt });
      if (u.fort) {
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.6;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 5 * sc, y + 6 * sc); ctx.lineTo(x + k * 5 * sc + 2, y + 1 * sc); ctx.stroke(); }
      }
      // полоска здоровья и маркеры
      const top = y - (u.hero ? 46 : 30) * sc;
      if (u.hp < 100) { ctx.fillStyle = 'rgba(40,0,0,.85)'; ctx.fillRect(x - 12, top, 24, 3.2); ctx.fillStyle = u.hp > 50 ? '#6fd36a' : u.hp > 25 ? '#f2c14c' : '#ea5a3c'; ctx.fillRect(x - 12, top, 24 * u.hp / 100, 3.2); }
      if (mine && u.mp > 0 && !u.fort && !u.sleep && !u.goto) {
        const p = 0.5 + 0.5 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(125,255,106,${0.75 + p * 0.25})`; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x - 16 * sc, y - 18 * sc); ctx.lineTo(x - 13 * sc, y - 22 * sc); ctx.lineTo(x - 10 * sc, y - 18 * sc); ctx.lineTo(x - 13 * sc, y - 14 * sc); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (u.hero && (sel || this.cam.z > 1.15)) {
        ctx.font = 'bold 8.5px Cinzel, serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,6,.85)'; ctx.strokeText(u.hero.name, x, top - 9);
        ctx.fillStyle = '#ffe9a8'; ctx.fillText(u.hero.name, x, top - 9);
      }
    },
    ghost(ctx, s, g, t, now) {
      let alpha = 1, dy = 0, x = g.x, y = g.y;
      if (g.battle && now < g.battle.t0 + g.battle.dur && now > g.battle.t0) { const k = (now - g.battle.t0) / g.battle.dur; const o = Math.sin(Math.PI * k) * 0.42; x += (g.battle.B[0] - g.battle.A[0]) * o; y += (g.battle.B[1] - g.battle.A[1]) * o; }
      if (now > g.tEnd) { const k = (now - g.tEnd) / 900; alpha = 1 - k; dy = k * 5; }
      if (alpha <= 0) return;
      const R0 = s.realms[g.realm];
      ctx.globalAlpha = alpha;
      squad(ctx, g.type, R0 ? R0.color : '#555', x, y + dy, t, { face: g.face, bandit: g.realm === RF.Engine.BANDITS });
      ctx.globalAlpha = 1;
    },
    projectile(ctx, b, k) {
      const [ax, ay] = b.A, [bx, by] = b.B;
      const stone = b.e.utype === 'catapult';
      const hgt = stone ? 60 : 34;
      const pos = (kk) => [lerp(ax, bx, kk), lerp(ay, by, kk) - 12 - Math.sin(Math.PI * kk) * hgt];
      const n = stone ? 1 : 3;
      for (let j = 0; j < n; j++) {
        const kk = clamp(k - j * 0.06, 0, 1);
        const [x, y] = pos(kk), [x2, y2] = pos(Math.min(1, kk + 0.02));
        const ang = Math.atan2(y2 - y, x2 - x);
        if (stone) { ctx.fillStyle = '#5a5550'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(80,70,60,.3)'; ctx.beginPath(); ctx.arc(x - Math.cos(ang) * 5, y - Math.sin(ang) * 5, 2.5, 0, Math.PI * 2); ctx.fill(); continue; }
        ctx.save(); ctx.translate(x + j * 3, y + j * 2); ctx.rotate(ang);
        ctx.strokeStyle = b.e.utype === 'hero_ranger' ? '#ffe27a' : '#3a2a1a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.fillStyle = '#d0d4d8'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(3, -1.8); ctx.lineTo(3, 1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },
    swords(ctx, x, y, r) {
      ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
      for (const a of [-0.8, 0.8]) { ctx.save(); ctx.rotate(a); ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, -r); ctx.stroke(); ctx.strokeStyle = '#eef0f2'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, r * 0.55); ctx.lineTo(3, r * 0.55); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    },
    drawPath(ctx, s, t) {
      const pts = this.path.map(([c, r]) => this.center(c, r));
      const u = s.units[this.selUnit];
      if (u) { const d = this.disp[u.id]; pts.unshift(d ? [d.x, d.y] : this.center(u.c, u.r)); }
      const curve = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2); ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
      ctx.lineCap = 'round';
      curve(); ctx.strokeStyle = 'rgba(30,18,8,.55)'; ctx.lineWidth = 6; ctx.stroke();
      curve(); ctx.strokeStyle = 'rgba(255,240,190,.95)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 26; ctx.stroke(); ctx.setLineDash([]);
      const turns = this.pathTurns || [];
      this.path.forEach(([c, r], i) => {
        const [x, y] = this.center(c, r);
        const end = i === this.path.length - 1 || turns[i + 1] !== turns[i];
        if (!end) return;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = '#fff3c4'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        if (turns[i]) { ctx.fillStyle = INK; ctx.font = 'bold 11px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(turns[i], x, y + 0.5); ctx.textBaseline = 'alphabetic'; }
      });
    },

    // ================================================================== ОБЪЕКТЫ НА КЛЕТКАХ
    house(ctx, x, y, sc, roof, chimney) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(20,12,6,.3)'; ctx.beginPath(); ctx.ellipse(1.5, 0.5, 7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ead9b6'; ctx.strokeStyle = 'rgba(40,25,15,.8)'; ctx.lineWidth = 0.6;
      ctx.fillRect(-5, -6, 10, 6); ctx.strokeRect(-5, -6, 10, 6);
      ctx.fillStyle = '#cdb994'; ctx.fillRect(1.5, -6, 3.5, 6);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-6.5, -5.6); ctx.lineTo(-1.2, -11.5); ctx.lineTo(4.2, -11.5); ctx.lineTo(6.5, -5.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(roof, -0.3); ctx.beginPath(); ctx.moveTo(4.2, -11.5); ctx.lineTo(6.5, -5.6); ctx.lineTo(2, -5.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a2e1a'; ctx.fillRect(-2.6, -3.4, 2, 3.4);
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(1.8, -4.2, 1.4, 1.4);
      if (chimney) { ctx.fillStyle = '#7a6a5a'; ctx.fillRect(-4, -12.5, 1.8, 3.5); }
      ctx.restore();
    },
    tower(ctx, x, y, w, h, roof, crown) {
      ctx.fillStyle = 'rgba(20,12,6,.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 0.5, w * 0.9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ddd5c6'; ctx.strokeStyle = 'rgba(40,28,18,.85)'; ctx.lineWidth = 0.7;
      ctx.fillRect(x - w / 2, y - h, w, h); ctx.strokeRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = '#b9b0a0'; ctx.fillRect(x + w * 0.12, y - h, w * 0.38, h);
      ctx.fillStyle = '#2e2218'; ctx.fillRect(x - 0.9, y - h * 0.62, 1.8, 3);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w / 2 - 1.5, y - h); ctx.lineTo(x, y - h - w * 1.25); ctx.lineTo(x + w / 2 + 1.5, y - h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(roof, -0.3); ctx.beginPath(); ctx.moveTo(x, y - h - w * 1.25); ctx.lineTo(x + w / 2 + 1.5, y - h); ctx.lineTo(x + 0.5, y - h); ctx.closePath(); ctx.fill();
      if (crown) { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(x, y - h - w * 1.25 - 1.5, 1.8, 0, Math.PI * 2); ctx.fill(); }
    },
    city(ctx, s, city, x, y, t, dt, visible) {
      const E = RF.Engine;
      const col = s.realms[city.realm].color;
      const rnd = mulberry(strHash(city.id));
      const n = Math.min(18, 5 + city.pop * 2), rad = 14 + Math.min(12, city.pop * 1.8);
      const walls = city.buildings.includes('walls') || city.buildings.includes('castle');
      ctx.fillStyle = 'rgba(120,96,62,.5)'; ctx.beginPath(); ctx.ellipse(x, y + 1, rad + 7, (rad + 7) * 0.58, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(170,150,110,.45)'; ctx.beginPath(); ctx.ellipse(x, y + 1, rad * 0.6, rad * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      const wallR = rad + 4;
      const ring = (a0, a1) => { ctx.strokeStyle = '#6f685d'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.ellipse(x, y + 1, wallR, wallR * 0.58, 0, a0, a1); ctx.stroke(); ctx.strokeStyle = '#a69e90'; ctx.lineWidth = 2.4; ctx.stroke(); };
      if (walls) ring(Math.PI, Math.PI * 2);
      const roofs = ['#b5452f', '#a33d2a', '#8f4a2b', '#b5452f', '#58677f'];
      const parts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.5, rr = rad * (0.42 + 0.58 * rnd());
        parts.push([y + Math.sin(a) * rr * 0.58, x + Math.cos(a) * rr, 'h', roofs[Math.floor(rnd() * roofs.length)], rnd() < 0.35, 0.8 + rnd() * 0.35]);
      }
      parts.push([y + 2, x, 'keep']);
      parts.sort((a, b) => a[0] - b[0]);
      const chimneys = [];
      for (const p of parts) {
        if (p[2] === 'h') { this.house(ctx, p[1], p[0], p[5], p[3], p[4]); if (p[4]) chimneys.push([p[1] - 3.6 * p[5], p[0] - 13 * p[5]]); }
        else {
          const cap = city.capital;
          this.tower(ctx, x - 7, y, 5.5, 13, col, false);
          this.tower(ctx, x + 7, y, 5.5, 13, col, false);
          this.tower(ctx, x, y + 2, 8, cap ? 24 : 18, col, cap);
          const fy = y + 2 - (cap ? 24 : 18) - 8 * 1.25 - 3;
          ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy - 11); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, fy - 11);
          for (let i = 0; i <= 6; i++) ctx.lineTo(x + i * 1.6, fy - 11 + Math.sin(t * 5 + i * 0.8 + x) * 0.9);
          for (let i = 6; i >= 0; i--) ctx.lineTo(x + i * 1.6, fy - 6 + Math.sin(t * 5 + i * 0.8 + x) * 0.9);
          ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(30,20,10,.7)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      if (walls) {
        ring(0, Math.PI);
        for (const a of [0.3, 1.2, 1.95, 2.85]) this.tower(ctx, x + Math.cos(a) * wallR, y + 1 + Math.sin(a) * wallR * 0.58, 4.5, 8, '#6f685d', false);
      }
      if (visible && chimneys.length && Math.random() < dt * 1.6) { const [cx, cy] = chimneys[Math.floor(Math.random() * chimneys.length)]; this.emit('smoke', cx, cy, { vx: 2, vy: -10, max: 2.4, r: 1.6 }); }
      // лента с названием
      const sel = this.selCity === city.id;
      ctx.font = 'bold 10.5px Cinzel, "PT Serif", serif';
      const name = city.name, tw = ctx.measureText(name).width;
      const w = tw + 30, by = y + rad * 0.58 + 13;
      ctx.fillStyle = shade(col, -0.45);
      ctx.beginPath(); ctx.moveTo(x - w / 2 - 7, by - 4); ctx.lineTo(x - w / 2 + 2, by - 4); ctx.lineTo(x - w / 2 + 2, by + 7); ctx.lineTo(x - w / 2 - 7, by + 7); ctx.lineTo(x - w / 2 - 3, by + 1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w / 2 + 7, by - 4); ctx.lineTo(x + w / 2 - 2, by - 4); ctx.lineTo(x + w / 2 - 2, by + 7); ctx.lineTo(x + w / 2 + 7, by + 7); ctx.lineTo(x + w / 2 + 3, by + 1.5); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(0, by - 8, 0, by + 8); g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.2));
      ctx.fillStyle = g; ctx.strokeStyle = sel ? '#ffe08a' : '#e7cf8a'; ctx.lineWidth = sel ? 2 : 1;
      roundRect(ctx, x - w / 2, by - 8, w, 16, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - w / 2 + 8, by, 7, 0, Math.PI * 2); ctx.fillStyle = '#2a1d12'; ctx.fill(); ctx.strokeStyle = '#e7cf8a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 9px "PT Serif", serif'; ctx.fillText(city.pop, x - w / 2 + 8, by + 0.5);
      ctx.font = 'bold 10.5px Cinzel, "PT Serif", serif';
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,10,4,.6)'; ctx.strokeText(name, x + 7, by + 0.5); ctx.fillText(name, x + 7, by + 0.5);
      if (city.capital) { ctx.fillStyle = '#f2c94c'; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; star(ctx, x + w / 2 - 6, by - 8, 3.4, 5); ctx.fill(); ctx.stroke(); }
      ctx.textBaseline = 'alphabetic';
      const max = E.maxCityHp(city);
      if (city.hp < max) { ctx.fillStyle = 'rgba(40,0,0,.85)'; ctx.fillRect(x - 18, by + 10, 36, 3.5); ctx.fillStyle = city.hp / max > 0.5 ? '#6fd36a' : '#ea5a3c'; ctx.fillRect(x - 18, by + 10, 36 * city.hp / max, 3.5); }
      if (city.realm === E.PLAYER && city.item && !this.passive) {
        const k = Math.min(1, city.prod / E.itemCost(city.item));
        ctx.fillStyle = 'rgba(30,20,10,.75)'; ctx.fillRect(x - 18, by + 14.5, 36, 3); ctx.fillStyle = '#f2a33a'; ctx.fillRect(x - 18, by + 14.5, 36 * k, 3);
      }
      if (city.realm === E.PLAYER && !city.item && !this.passive) { const p = 0.5 + 0.5 * Math.sin(t * 5); ctx.fillStyle = `rgba(255,223,107,${0.6 + p * 0.4})`; ctx.font = 'bold 15px serif'; ctx.textAlign = 'center'; ctx.fillText('!', x + w / 2 + 12, by + 5); }
    },
    improvement(ctx, imp, x, y, seed) {
      const rnd = mulberry(seed * 31 + 7);
      ctx.save(); ctx.translate(x, y);
      if (imp === 'farm') {
        const cols = ['#d8bd4e', '#b9c45a', '#c9a843', '#a5b44c'];
        for (let k = 0; k < 5; k++) {
          const fx = (rnd() - 0.5) * 30, fy = (rnd() - 0.5) * 20, w = 10 + rnd() * 6, h = 6 + rnd() * 3, a = -0.35 + rnd() * 0.2;
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(a);
          ctx.fillStyle = cols[k % 4]; ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = 'rgba(110,80,30,.45)'; ctx.lineWidth = 0.6; for (let l = -h / 2 + 1.5; l < h / 2; l += 1.8) { ctx.beginPath(); ctx.moveTo(-w / 2, l); ctx.lineTo(w / 2, l); ctx.stroke(); }
          ctx.restore();
        }
        this.house(ctx, 6, 8, 0.75, '#a33d2a', true);
      } else if (imp === 'mine') {
        hillMound(ctx, 0, 8, 14, 11, ['#6e6250', '#8a7c66', '#4a4034']);
        ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.arc(-1, 6, 4.2, Math.PI, 0); ctx.lineTo(3.2, 6); ctx.lineTo(-5.2, 6); ctx.fill();
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-5.5, 6.5); ctx.lineTo(-5.5, 0.8); ctx.lineTo(3.5, 0.8); ctx.lineTo(3.5, 6.5); ctx.stroke();
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(7, 3, 7, 4); ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(10.5, 3, 2.6, Math.PI, 0); ctx.fill();
      } else if (imp === 'pasture') {
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 3, 16, 9, 0, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 16, 3 + Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 9); ctx.stroke(); }
        for (let k = 0; k < 4; k++) { const sx = (rnd() - 0.5) * 20, sy = 3 + (rnd() - 0.5) * 9; ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a3030'; ctx.beginPath(); ctx.arc(sx + 2.8, sy - 0.8, 1.2, 0, Math.PI * 2); ctx.fill(); }
      } else if (imp === 'quarry') {
        ctx.fillStyle = '#8e877c'; ctx.beginPath(); ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a645a'; ctx.beginPath(); ctx.ellipse(1, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9c2b6'; ctx.strokeStyle = 'rgba(40,30,20,.6)'; ctx.lineWidth = 0.6;
        for (const [bx, by] of [[-9, -1], [-4, -4], [7, -2], [10, 3]]) { ctx.fillRect(bx - 2.5, by - 2, 5, 4); ctx.strokeRect(bx - 2.5, by - 2, 5, 4); }
      } else if (imp === 'lumber') {
        ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = 'rgba(40,25,10,.8)'; ctx.lineWidth = 0.6;
        for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) { ctx.beginPath(); ctx.ellipse(-8 + j * 5 + k * 2.5, 8 - k * 4, 2.4, 2.4, 0, 0, Math.PI * 2); ctx.fillStyle = '#c99a62'; ctx.fill(); ctx.stroke(); }
        this.house(ctx, 7, 6, 0.8, '#6b4a2a', false);
      }
      ctx.restore();
    },
    district(ctx, id, x, y, seed) {
      const Dd = RF.Data.DISTRICTS[id];
      ctx.fillStyle = 'rgba(200,184,146,.75)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Dd.color; ctx.lineWidth = 1.6; ctx.stroke();
      const rnd = mulberry(seed * 17 + 3);
      const spots = [[-10, -2], [9, -3], [-4, 7], [8, 7]];
      for (const [dx, dy] of spots) this.house(ctx, x + dx, y + dy, 0.95 + rnd() * 0.2, Dd.color, false);
      ctx.save(); ctx.translate(x, y - 2);
      if (id === 'campus') { ctx.fillStyle = '#e8e4da'; ctx.fillRect(-4, -8, 8, 8); ctx.fillStyle = '#9fd0ea'; ctx.beginPath(); ctx.arc(0, -8, 4.5, Math.PI, 0); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); }
      if (id === 'commercial') { for (const [dx, c2] of [[-4, '#e0b13a'], [4, '#c0392b']]) { ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(dx - 4, -2); ctx.lineTo(dx, -8); ctx.lineTo(dx + 4, -2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f2e6c8'; ctx.fillRect(dx - 3.5, -2, 7, 3); } }
      if (id === 'holy') { this.tower(ctx, 0, 2, 6, 14, '#a870d9', true); }
      if (id === 'encampment') { for (const dx of [-5, 5]) { ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.moveTo(dx - 5, 2); ctx.lineTo(dx, -7); ctx.lineTo(dx + 5, 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); } ctx.strokeStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -14); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.fillRect(0, -14, 6, 4); }
      ctx.restore();
    },
    camp(ctx, x, y, t, dt) {
      ctx.save(); ctx.translate(x - 6, y + 2);
      for (const [dx, col] of [[-8, '#5a2a22'], [6, '#3e2c22']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(dx - 8, 6); ctx.lineTo(dx, -8); ctx.lineTo(dx + 8, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(dx, -8); ctx.lineTo(dx + 8, 6); ctx.lineTo(dx + 1, 6); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-1, -16); ctx.stroke();
      ctx.fillStyle = '#1a1414'; ctx.beginPath(); ctx.moveTo(-1, -16); ctx.lineTo(7, -14 + Math.sin(t * 5) * 1); ctx.lineTo(-1, -11); ctx.fill();
      const fl = 0.8 + 0.25 * Math.sin(t * 13) + 0.15 * Math.sin(t * 7.3);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(18, 4, 0, 18, 4, 10); g.addColorStop(0, `rgba(255,170,60,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(18, 4, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(18, 7); ctx.quadraticCurveTo(14, 1, 18, -5 * fl); ctx.quadraticCurveTo(22, 1, 18, 7); ctx.fill();
      ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.moveTo(18, 7); ctx.quadraticCurveTo(16.5, 3, 18, -1 * fl); ctx.quadraticCurveTo(19.5, 3, 18, 7); ctx.fill();
      ctx.restore();
      if (Math.random() < dt * 1.5) this.emit('smoke', x + 12, y - 4, { vx: 2, vy: -10, max: 2.2, r: 2.2, dark: true });
    },
    resource(ctx, res, x, y) {
      ctx.fillStyle = 'rgba(20,12,6,.35)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.2, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#f3e3c3'; ctx.fill(); ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.translate(x, y);
      const col = { wheat: '#d9a72e', fish: '#4a90b8', iron: '#6b7480', horses: '#8a5a33', gold: '#e0b13a', stone: '#8f8a84' }[res];
      ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      if (res === 'wheat') { ctx.moveTo(0, 5); ctx.lineTo(0, -5); ctx.moveTo(0, -2); ctx.lineTo(-3, -5); ctx.moveTo(0, -2); ctx.lineTo(3, -5); ctx.moveTo(0, 1); ctx.lineTo(-3, -2); ctx.moveTo(0, 1); ctx.lineTo(3, -2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
      else if (res === 'fish') { ctx.ellipse(-1, 0, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.moveTo(3, 0); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill(); }
      else if (res === 'horses') { ctx.arc(0, 0, 4, Math.PI * 0.15, Math.PI * 0.85, true); ctx.lineWidth = 2.6; ctx.strokeStyle = col; ctx.stroke(); }
      else if (res === 'gold') { ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.moveTo(-5, 3); ctx.lineTo(-3, -3); ctx.lineTo(3, -3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    },
    drawCityOverlay(ctx, s, size) {
      const E = RF.Engine, o = this.cityOverlay, city = s.cities[o.cityId];
      if (!city) return;
      const workedSet = new Set((o.worked || []).map((w) => w.c + ',' + w.r));
      for (const [c, r] of E.inRadius(s, city.c, city.r, 3)) {
        const t = E.tileAt(s, c, r);
        if (!s.explored[E.idx(s, c, r)]) continue;
        const [x, y] = this.center(c, r);
        const mine = t.workCity === city.id;
        if (o.mode === 'district') {
          const spot = o.spots.find((p) => p.c === c && p.r === r);
          if (spot) {
            const g = ctx.createRadialGradient(x, y, 2, x, y, size * 0.8); g.addColorStop(0, 'rgba(120,255,120,.4)'); g.addColorStop(1, 'rgba(120,255,120,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, y, size * 0.6, size * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
            this.badge(ctx, x, y - 2, `+${spot.adj}`, '#1f5f1f');
          }
          continue;
        }
        if (mine && !(c === city.c && r === city.r) && !t.district) {
          this.yieldPips(ctx, x, y + size * 0.05, E.tileYield(s, c, r));
          if (workedSet.has(c + ',' + r)) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.55, size * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); }
        } else if (o.buyable && o.buyable.has(c + ',' + r)) {
          ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.55, size * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          this.badge(ctx, x, y, `${o.buyable.get(c + ',' + r)}`, '#6a4a10');
        }
      }
    },
    yieldPips(ctx, x, y, yv) {
      const items = [];
      for (let i = 0; i < yv.food; i++) items.push('#5fbf4f');
      for (let i = 0; i < yv.prod; i++) items.push('#b07a3a');
      for (let i = 0; i < yv.gold; i++) items.push('#f2c94c');
      const n = items.length, w = n * 7;
      items.forEach((col, i) => { ctx.beginPath(); ctx.arc(x - w / 2 + 3.5 + i * 7, y + 12, 3.2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); });
    },
    badge(ctx, x, y, text, col) {
      ctx.font = 'bold 12px "PT Serif", serif';
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = col; roundRect(ctx, x - w / 2, y - 8, w, 16, 6); ctx.fill(); ctx.strokeStyle = '#f3e3c3'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5); ctx.textBaseline = 'alphabetic';
    },

    // ================================================================== МИНИ-КАРТА
    drawMinimap(mc) {
      const s = this.s, Wd = this.world; if (!s || !mc || !Wd) return;
      const ctx = mc.getContext('2d'), W = mc.width, H = mc.height;
      if (!Wd.mm || Wd.mm.width !== W) { Wd.mm = mkCanvas(W, H); const m = Wd.mm.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(Wd.bake, 0, 0, W, H); }
      ctx.drawImage(Wd.mm, 0, 0);
      if (Wd.borderCv) ctx.drawImage(Wd.borderCv, 0, 0, W, H);
      if (!this.passive && Wd.fogCv) ctx.drawImage(Wd.fogCv, 0, 0, W, H);
      const sx = W / Wd.TW, sy = H / Wd.TH;
      for (const city of Object.values(s.cities)) if (this.passive || s.explored[city.r * s.w + city.c]) { const [x, y] = this.center(city.c, city.r); ctx.fillStyle = '#fff'; ctx.strokeStyle = s.realms[city.realm].color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc((x - Wd.ox) * sx, (y - Wd.oy) * sy, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#f3d98a'; ctx.lineWidth = 1.5;
      ctx.strokeRect((this.cam.x - this.W / 2 / this.cam.z - Wd.ox) * sx, (this.cam.y - this.H / 2 / this.cam.z - Wd.oy) * sy, this.W / this.cam.z * sx, this.H / this.cam.z * sy);
      this._mm = { sx, sy };
    },
    minimapJump(mx, my) { if (!this._mm || !this.world) return; this.cam.x = mx / this._mm.sx + this.world.ox; this.cam.y = my / this._mm.sy + this.world.oy; this.clampCam(); },

    /** Значок отряда (для панелей интерфейса): та же фигура, что и на карте. */
    unitIcon(type, color, px, lvl) {
      const key = `${type}|${color}|${px}|${lvl || 0}`;
      this._icons = this._icons || {};
      if (this._icons[key]) return this._icons[key];
      const cv = mkCanvas(px * 2, px * 2), c = cv.getContext('2d');
      const U = RF.Data.UNITS[type] || {};
      const k = (px * 2) / (U.hero ? 60 : 44);
      c.setTransform(k, 0, 0, k, cv.width / 2, cv.height * (U.hero ? 0.84 : 0.76));
      squad(c, type, color, 0, 0, 0, { face: 1, lvl });
      this._icons[key] = cv.toDataURL();
      return this._icons[key];
    },

    /** Пассивный рендерер (фон меню): своя канва, без управления, медленный облёт живой карты. */
    spawnPassive(canvas, s) {
      const r = Object.create(R);
      Object.assign(r, { canvas, ctx: canvas.getContext('2d'), s, cam: { x: 0, y: 0, z: 1.05 }, passive: true, handlers: {}, hover: null, reach: null, targets: null, path: null, pathTurns: null, cityOverlay: null, selUnit: null, selCity: null, world: null, BK: 1.25, vign: null });
      r.resetState();
      const fit = () => { r.dpr = Math.min(1.5, window.devicePixelRatio || 1); r.W = window.innerWidth; r.H = window.innerHeight; canvas.width = r.W * r.dpr; canvas.height = r.H * r.dpr; canvas.style.width = r.W + 'px'; canvas.style.height = r.H + 'px'; r.vign = null; };
      fit(); window.addEventListener('resize', fit);
      const t0 = performance.now();
      const loop = (now) => {
        if (r.stopped) return;
        const [mx, my] = r.center(r.s.w - 1, r.s.h - 1);
        const k = (now - t0) / 90000;
        r.cam.z = 1.05 + 0.15 * Math.sin(k * Math.PI * 2 * 0.5);
        r.cam.x = mx * (0.5 + 0.3 * Math.sin(k * Math.PI * 2)); r.cam.y = my * (0.5 + 0.24 * Math.cos(k * Math.PI * 2 * 0.7));
        if (canvas.style.display !== 'none') r.draw(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return r;
    },
  };

  RF.Render = R;
  RF.Render.squad = squad;
})(window);
