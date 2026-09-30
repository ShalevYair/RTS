// UI: canvas rendering — terrain, bases, points, fog, intel, marks, units
// scenery (no effect on play), new every game like the ground. Nothing is a perfect shape or one flat colour:
// hills and lakes follow the sim's uneven outlines, grass comes in blotches of several shades with tufts, roads
// wander and change width, and every hill, lake, field and tree gets its own tint. Shapes are built once as Path2D.
function makeDecor(s) {
  const W = s.W, ky = s.H / Sim.H, K = W * ky, TUFT_SHADES = 8;
  let a = (s.seed * 2654435761 >>> 1) || 12345; const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const mid = W / 2, ok = (x, m = 0) => x > 90 + m && x < W - 90 - m && Math.abs(x - mid) > 80 + m;
  const inLake = (x, y) => !!Sim.lakeAt(s, { x, y }, 8);
  const tone = (k = 0.12) => (r() * 2 - 1) * k;
  // a closed outline through n points at radius R(th) around (x, y), rotated by rot
  const outline = (x, y, R, n = 56, rot = 0) => {
    const p = new Path2D();
    for (let i = 0; i <= n; i++) {
      const th = i / n * Math.PI * 2, [px, py] = R(th), c = Math.cos(rot), sn = Math.sin(rot);
      const X = x + px * c - py * sn, Y = y + px * sn + py * c;
      if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
    }
    p.closePath(); return p;
  };
  // a soft random blob (grass, bare earth)
  const blob = (x, y, rx, ry) => { const w = [[0.18, 2, r() * 7], [0.12, 3, r() * 7], [0.08, 5, r() * 7]]; return outline(x, y, th => { const f = Sim.wobble(w, th); return [Math.cos(th) * rx * f, Math.sin(th) * ry * f]; }, 24); };
  // grass: big blotches in a few shades, then small tufts, grouped by shade (one path per shade)
  const patches = [];
  // (each blotch anywhere between the two grass colours, a touch lighter or darker: a continuous range, not two tones)
  for (let i = 0; i < Math.round(K / 40); i++) patches.push({ p: blob(r() * W, r() * s.H, 30 + r() * 100, 20 + r() * 60), u: r(), t: tone(0.06), dirt: r() < 0.15 });
  const tufts = Array.from({ length: TUFT_SHADES }, () => new Path2D());
  for (let i = 0; i < Math.round(K / 3); i++) { const x = r() * W, y = r() * s.H, k = Math.floor(r() * TUFT_SHADES); if (!inLake(x, y)) { tufts[k].moveTo(x + 1.6, y); tufts[k].arc(x, y, 0.8 + r() * 1.2, 0, Math.PI * 2); } }
  const roads = makeRoads(s, r), fields = [];
  // where roads run (a coarse mask): nothing grows on them
  const RC = 10, rw = Math.ceil(W / RC) + 1, onRoad = new Uint8Array(rw * (Math.ceil(s.H / RC) + 1));
  for (const pts of roads) for (let i = 1; i < pts.length; i++) {
    const a0 = pts[i - 1], b0 = pts[i], n = Math.ceil(Math.hypot(b0.x - a0.x, b0.y - a0.y) / 4);
    for (let k = 0; k <= n; k++) { const x = a0.x + (b0.x - a0.x) * k / n, y = a0.y + (b0.y - a0.y) * k / n; onRoad[Math.round(y / RC) * rw + Math.round(x / RC)] = 1; }
  }
  const road = (x, y) => onRoad[Math.round(y / RC) * rw + Math.round(x / RC)] === 1;
  for (let i = 0; i < Math.round(K / 220); i++) {
    const x = 100 + r() * (W - 200), y = 30 + r() * (s.H - 60);
    if (ok(x, 30) && !inLake(x, y) && Sim.elevAt(s, { x, y }) < 1) fields.push({ x, y, w: 50 + r() * 40, h: 30 + r() * 20, a: (r() - 0.5) * 0.8, t: tone(0.1), gap: 6 + r() * 4 });
  }
  const inField = (x, y) => fields.some(f => Math.abs(x - f.x) < f.w * 0.6 && Math.abs(y - f.y) < f.w * 0.6);
  const free = (x, y) => x > 70 && x < W - 70 && y > 4 && y < s.H - 4 && !inLake(x, y) && !road(x, y) && !inField(x, y);
  // shade buckets: one path per shade, so thousands of trees, bushes and stones are a handful of fills
  const B = 6, bucket = () => Math.floor(r() * B), paths = () => Array.from({ length: B }, () => new Path2D());
  const treeBody = paths(), treeTop = paths(), treeShadow = new Path2D(), bush = paths(), rock = paths(), rockHi = new Path2D(), rockShadow = new Path2D();
  // (and each one as an item, for the drawn pictures when there are some: see drawScenery)
  const items = [], hash = (x, y) => Math.abs(Math.round(x * 7.1 + y * 13.7));
  const addTree = (x, y, R) => {
    const k = bucket(); items.push({ t: 'tree', x, y, s: R * 2.7, v: hash(x, y) });
    treeShadow.moveTo(x + 2 + R, y + 3); treeShadow.ellipse(x + 2, y + 3, R, R * 0.8, 0, 0, Math.PI * 2);
    treeBody[k].moveTo(x + R, y); treeBody[k].arc(x, y, R, 0, Math.PI * 2);
    treeTop[k].moveTo(x - R * 0.3 + R * 0.5, y - R * 0.3); treeTop[k].arc(x - R * 0.3, y - R * 0.3, R * 0.5, 0, Math.PI * 2);
  };
  // woods: clusters in the low ground and on the lower slopes
  for (let i = 0; i < Math.round(K / 70); i++) {
    const cx = 80 + r() * (W - 160), cy = r() * s.H, R = 25 + r() * 60, n = Math.round(R * (0.25 + r() * 0.3));
    if (Sim.elevAt(s, { x: cx, y: cy }) > 4) continue;
    for (let j = 0; j < n; j++) { const a = r() * 7, d = R * Math.sqrt(r()), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8; if (free(x, y) && Sim.elevAt(s, { x, y }) < 5) addTree(x, y, 3.5 + r() * 4); }
  }
  // lone trees and small groves anywhere but high up
  for (let i = 0; i < Math.round(K / 17); i++) {
    const x = 80 + r() * (W - 160), y = r() * s.H, m = 1 + Math.floor(Math.pow(r(), 2) * 4);
    for (let j = 0; j < m; j++) { const px = x + (r() - 0.5) * 22, py = y + (r() - 0.5) * 18; if (free(px, py) && Sim.elevAt(s, { x: px, y: py }) < 6) addTree(px, py, 3 + r() * 4.5); }
  }
  // bushes: little clumps of two or three blobs
  for (let i = 0; i < Math.round(K / 2.5); i++) {
    const x = 70 + r() * (W - 140), y = r() * s.H; if (!free(x, y) || Sim.elevAt(s, { x, y }) > 7) continue;
    const k = bucket(), m = 2 + Math.floor(r() * 2); items.push({ t: 'bush', x, y, s: 4 + m * 0.9, v: hash(x, y) });
    for (let j = 0; j < m; j++) { const R = 1.3 + r() * 1.7, px = x + (r() - 0.5) * 5, py = y + (r() - 0.5) * 4; bush[k].moveTo(px + R, py); bush[k].arc(px, py, R, 0, Math.PI * 2); }
  }
  // stones and boulders: a few on the plain, many more up the hills (the higher, the rockier)
  const addRock = (x, y, R) => {
    const k = bucket(), w = [[0.2, 2, r() * 7], [0.12, 3, r() * 7]]; items.push({ t: 'rock', x, y, s: R * 2.5, v: hash(x, y), hi: Sim.elevAt(s, { x, y }) > 3 });
    const at = (px, py, s0) => { const p = new Path2D(); for (let q = 0; q <= 8; q++) { const th = q / 8 * Math.PI * 2, f = R * s0 * Sim.wobble(w, th); if (q) p.lineTo(px + Math.cos(th) * f, py + Math.sin(th) * f * 0.8); else p.moveTo(px + Math.cos(th) * f, py + Math.sin(th) * f * 0.8); } p.closePath(); return p; };
    rockShadow.addPath(at(x + 1.2, y + 1.6, 1)); rock[k].addPath(at(x, y, 1)); rockHi.addPath(at(x - R * 0.25, y - R * 0.25, 0.45));
  };
  for (let i = 0; i < Math.round(K / 2); i++) {
    const x = 70 + r() * (W - 140), y = r() * s.H, e = Sim.elevAt(s, { x, y });
    if (!free(x, y) || r() > 0.12 + e * 0.09) continue;
    const m = r() < 0.3 ? 2 + Math.floor(r() * 4) : 1;
    for (let j = 0; j < m; j++) addRock(x + (r() - 0.5) * 14, y + (r() - 0.5) * 10, 1 + r() * (e > 3 ? 4 : 2.5));
  }
  const trees = { treeBody, treeTop, treeShadow, bush }, rocks = { rock, rockHi, rockShadow, items: items.sort((a, b) => (a.t === 'tree') - (b.t === 'tree') || a.y - b.y) };
  // hills: contour lines traced from the sim's height grid (so what's drawn is what counts); the colouring is made
  // when drawn, from the theme (see relief)
  const hills = { contours: contours(s.elev), relief: null, theme: '' };
  // lakes: the sim's outline, a darker middle, a shallow rim
  const lakes = s.lakes.map(l => {
    const shp = f => outline(l.x, l.y, th => { const q = f * Sim.wobble(l.w, Math.atan2(Math.sin(th) / l.ry, Math.cos(th) / l.rx)); return [Math.cos(th) * l.rx * q, Math.sin(th) * l.ry * q]; }, 56, l.a);
    return { l, edge: shp(1.08), body: shp(1), deep: shp(0.55), t: tone(0.08) };
  });
  return { patches, tufts, fields, lakes, hills, trees, rocks, roads };
}
function makeRoads(s, r) {
  const W = s.W, H = s.H, n = H > Sim.H ? 5 : 3 + (r() < 0.5 ? 1 : 0);
  let roads = [];
  const bez = (P, k) => { const u = 1 - k; return { x: u * u * u * P[0].x + 3 * u * u * k * P[1].x + 3 * u * k * k * P[2].x + k * k * k * P[3].x, y: u * u * u * P[0].y + 3 * u * u * k * P[1].y + 3 * u * k * k * P[2].y + k * k * k * P[3].y }; };
  const dry = P => { for (let i = 0; i <= 30; i++) if (Sim.lakeAt(s, bez(P, i / 30), 14)) return false; return true; };
  const high = P => { let m = 0; for (let i = 0; i <= 30; i++) m += Sim.elevAt(s, bez(P, i / 30)); return m; }; // total climb along it
  const twin = p => ({ x: W - p.x + (r() - 0.5) * 30, y: (s.turn ? H - p.y : p.y) + (r() - 0.5) * 30 });
  // roads for one crossing X: for each lane, a few tries at a dry pair (ours and its twin)
  const lay = X => {
    const out = [];
    // (of the dry tries, the one that climbs least: roads find the passes and valleys)
    for (let k = 0; k < n; k++) {
      let best = null, bh = Infinity;
      for (let tries = 0; tries < 15; tries++) {
        const y = H * (k + 0.5) / n + (r() - 0.5) * H / n * 0.6;
        const P = [{ x: 60, y }, { x: W * (0.18 + r() * 0.1), y: y + (r() - 0.5) * 120 }, { x: W * (0.3 + r() * 0.1), y: X.y + (r() - 0.5) * 160 }, X];
        const Q = [{ x: W - 60, y: s.turn ? H - y : y }, twin(P[1]), twin(P[2]), X];
        if (!dry(P) || !dry(Q)) continue;
        const hgt = Math.max(high(P), high(Q)); if (hgt < bh) { bh = hgt; best = [P, Q]; }
      }
      if (best) out.push(...best);
    }
    return out;
  };
  // the crossing that gets the most roads through (lakes near the middle can block some spots)
  for (let i = 0; i < 12 && roads.length < 2 * n; i++) {
    const X = { x: W / 2 + (r() - 0.5) * 160, y: H / 2 + (r() - 0.5) * H * 0.5 };
    if (Sim.lakeAt(s, X, 30)) continue;
    const got = lay(X); if (got.length > roads.length) roads = got;
  }
  // a dirt road wanders a little off its curve and gets wider and narrower (points with a width each)
  return roads.map(P => {
    const f1 = r() * 7, f2 = r() * 7, f3 = r() * 7, len = Math.hypot(P[3].x - P[0].x, P[3].y - P[0].y), m = Math.max(24, Math.round(len / 14)), pts = [];
    for (let i = 0; i <= m; i++) {
      const k = i / m, p = bez(P, k), q = bez(P, Math.min(1, k + 0.01)), o = bez(P, Math.max(0, k - 0.01));
      const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy) || 1, sway = (Math.sin(k * 9 + f1) * 4 + Math.sin(k * 23 + f2) * 1.5) * Math.sin(Math.PI * k);
      pts.push({ x: p.x - dy / d * sway, y: p.y + dx / d * sway, w: 4.2 + Math.sin(k * 13 + f3) * 1 + Math.sin(k * 31 + f1) * 0.4 });
    }
    return pts;
  });
}

// ---- render ----
function ring(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function hexA(col, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(col || '');
  if (!m) return col;
  const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function label(txt, x, y, col) {
  const c = ctx; c.font = '700 13px Rubik, sans-serif'; c.lineWidth = 3; c.strokeStyle = colors.halo;
  c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y);
}
// symmetric outlines (top half; mirrored around the x axis), facing +x
const PLANE = [[0.95, 0], [0.55, -0.12], [0.15, -0.12], [-0.12, -0.85], [-0.32, -0.85], [-0.22, -0.12], [-0.62, -0.12], [-0.82, -0.42], [-0.95, -0.42], [-0.85, 0]];
const MISSILE = [[0.9, 0], [0.5, -0.15], [-0.5, -0.15], [-0.78, -0.45], [-0.92, -0.45], [-0.82, -0.15], [-0.88, 0]];
function poly(c, pts, k) {
  c.moveTo(pts[0][0] * k, pts[0][1] * k);
  for (const [x, y] of pts.slice(1)) c.lineTo(x * k, y * k);
  for (const [x, y] of pts.slice().reverse()) c.lineTo(x * k, -y * k);
  c.closePath();
}
// unit / facility glyphs: soldier, missile, tank (with barrel), plane
// step: how far along its stride / tracks the unit is (radians; 0 = standing): legs swing, treads run, bodies bob
let glyphRecoil = 0; // (0..1: how far a tank's barrel is kicked back, for the unit being drawn)
function glyph(c, type, x, y, k, fill, outline, hd = 0, aim = hd, lw = 1.2, step = 0) {
  const sw = Math.sin(step) * 0.26 * k, bob = step ? Math.abs(Math.sin(step)) * 0.12 * k : 0;
  c.save(); c.translate(x, y - bob); c.lineJoin = 'round'; c.lineCap = 'round';
  const paint = () => { if (outline) { c.lineWidth = lw; c.strokeStyle = outline; c.stroke(); } c.fillStyle = fill; c.fill(); };
  const barrel = (x1, y1, x2, y2, w) => {
    if (outline) { c.strokeStyle = outline; c.lineWidth = w + lw * 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    c.strokeStyle = fill; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  if (type === 'air') { c.rotate(hd); c.beginPath(); poly(c, PLANE, k); paint(); }
  else if (type === 'aa' || type === 'at') {
    // anti-aircraft: a soldier with a launcher tube on his shoulder, pointing where he aims (up, at aircraft);
    // anti-tank: the same, level, with a fat warhead
    const flip = Math.cos(aim) < 0; if (flip) c.scale(-1, 1);
    const a = flip ? Math.PI - aim : aim;
    c.beginPath(); c.arc(-0.1 * k, -0.62 * k, 0.24 * k, 0, Math.PI * 2);
    c.moveTo(-0.42 * k, -0.34 * k); c.lineTo(0.22 * k, -0.34 * k); c.lineTo(0.14 * k, 0.2 * k); c.lineTo(-0.34 * k, 0.2 * k); c.closePath();
    c.rect(-0.34 * k + sw, 0.2 * k, 0.18 * k, 0.55 * k); c.rect(-0.04 * k - sw, 0.2 * k, 0.18 * k, 0.55 * k);
    paint();
    c.save(); c.translate(0.05 * k, -0.42 * k); c.rotate(a);
    c.beginPath(); c.rect(-0.45 * k, -0.15 * k, 1.35 * k, 0.3 * k); paint();
    if (type === 'at') { c.beginPath(); c.arc(0.98 * k, 0, 0.24 * k, 0, Math.PI * 2); paint(); }
    else { c.beginPath(); c.moveTo(0.9 * k, -0.15 * k); c.lineTo(1.12 * k, 0); c.lineTo(0.9 * k, 0.15 * k); c.closePath(); paint(); }
    c.restore();
  }
  else if (type === 'tank') {
    c.rotate(hd); c.beginPath(); c.rect(-0.8 * k, -0.55 * k, 1.6 * k, 1.1 * k); paint();
    if (outline) { c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(-0.8 * k, -0.31 * k, 1.6 * k, 0.28 * k); }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-0.8 * k, -0.55 * k, 1.6 * k, 0.24 * k); c.fillRect(-0.8 * k, 0.31 * k, 1.6 * k, 0.24 * k);
    // tread links running back as it drives
    c.fillStyle = step ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.28)';
    for (let i = 0; i < 5; i++) { const tx = (-0.8 + (((i * 0.32 - step * 0.09) % 1.6) + 1.6) % 1.6) * k; c.fillRect(tx, -0.55 * k, 0.11 * k, 0.24 * k); c.fillRect(tx, 0.31 * k, 0.11 * k, 0.24 * k); }
    c.rotate(aim - hd); barrel(0, 0, 1.3 * k * (1 - 0.28 * glyphRecoil), 0, 0.22 * k);
    c.beginPath(); c.arc(0, 0, 0.36 * k, 0, Math.PI * 2); paint();
    if (outline) { c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(-0.1 * k, -0.1 * k, 0.16 * k, 0, Math.PI * 2); c.fill(); }
  } else if (type === 'truck') {
    // supply truck: a cargo box behind a darker cab, with a crate mark
    c.rotate(hd); c.beginPath(); c.rect(-0.8 * k, -0.45 * k, 1.6 * k, 0.9 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0.4 * k, -0.4 * k, 0.4 * k, 0.8 * k);
    c.strokeStyle = outline ? 'rgba(0,0,0,.45)' : tcol('truck'); c.lineWidth = 0.1 * k; c.strokeRect(-0.6 * k, -0.28 * k, 0.8 * k, 0.56 * k);
    c.beginPath(); c.moveTo(-0.6 * k, -0.28 * k); c.lineTo(0.2 * k, 0.28 * k); c.moveTo(0.2 * k, -0.28 * k); c.lineTo(-0.6 * k, 0.28 * k); c.stroke();
  } else if (type === 'mech') {
    // mechanics: a tow truck — body, a darker cab in front, a crane boom off the back with its hook
    c.rotate(hd); c.beginPath(); c.rect(-0.75 * k, -0.45 * k, 1.5 * k, 0.9 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0.3 * k, -0.45 * k, 0.45 * k, 0.9 * k);
    barrel(-0.4 * k, 0, -1.15 * k, 0, 0.14 * k);
    c.beginPath(); c.arc(-1.2 * k, 0, 0.17 * k, 0, Math.PI * 2); paint();
  } else if (type === 'dozer') {
    c.rotate(hd); c.beginPath(); c.rect(-0.7 * k, -0.45 * k, 1.2 * k, 0.9 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-0.7 * k, -0.5 * k, 1.2 * k, 0.16 * k); c.fillRect(-0.7 * k, 0.34 * k, 1.2 * k, 0.16 * k);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-0.35 * k, -0.25 * k, 0.45 * k, 0.5 * k);
    barrel(0.72 * k, -0.62 * k, 0.72 * k, 0.62 * k, 0.2 * k); // (the blade)
  } else if (type === 'radio') {
    c.rotate(hd); c.beginPath(); c.rect(-0.8 * k, -0.42 * k, 1.6 * k, 0.84 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0.4 * k, -0.38 * k, 0.4 * k, 0.76 * k);
    c.strokeStyle = outline || fill; c.lineWidth = 0.1 * k; c.beginPath(); c.arc(-0.25 * k, 0, 0.3 * k, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-0.6 * k, -0.3 * k); c.lineTo(-1.1 * k, -0.9 * k); c.stroke();
  } else if (type === 'med') {
    // medics: a soldier with no rifle and a cross on the chest
    if (Math.cos(hd) < 0) c.scale(-1, 1);
    c.beginPath(); c.arc(0, -0.62 * k, 0.24 * k, 0, Math.PI * 2);
    c.moveTo(-0.32 * k, -0.34 * k); c.lineTo(0.32 * k, -0.34 * k); c.lineTo(0.24 * k, 0.2 * k); c.lineTo(-0.24 * k, 0.2 * k); c.closePath();
    c.rect(-0.24 * k + sw, 0.2 * k, 0.18 * k, 0.55 * k); c.rect(0.06 * k - sw, 0.2 * k, 0.18 * k, 0.55 * k);
    paint();
    c.fillStyle = outline ? '#fff' : tcol('med');
    c.fillRect(-0.07 * k, -0.3 * k, 0.14 * k, 0.44 * k); c.fillRect(-0.2 * k, -0.15 * k, 0.4 * k, 0.14 * k);
  } else if (type === 'jeep' || type === 'ajeep' || type === 'tjeep') {
    // jeep: open body, four wheels, a pintle gun on top (AA jeep: a rack of two missiles; AT jeep: one fat launcher)
    c.rotate(hd); c.beginPath(); c.rect(-0.75 * k, -0.45 * k, 1.5 * k, 0.9 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.45)'; for (const [wx, wy] of [[-0.5, -0.55], [0.35, -0.55], [-0.5, 0.42], [0.35, 0.42]]) c.fillRect(wx * k, wy * k, 0.3 * k, 0.14 * k);
    if (step) { c.fillStyle = 'rgba(255,255,255,.6)'; const o = (Math.sin(step * 2) + 1) * 0.1 * k; for (const [wx, wy] of [[-0.5, -0.55], [0.35, -0.55], [-0.5, 0.42], [0.35, 0.42]]) c.fillRect(wx * k + o, wy * k, 0.09 * k, 0.14 * k); }
    c.rotate(aim - hd);
    if (type === 'ajeep') { barrel(-0.4 * k, -0.17 * k, 0.6 * k, -0.17 * k, 0.17 * k); barrel(-0.4 * k, 0.17 * k, 0.6 * k, 0.17 * k, 0.17 * k); }
    else if (type === 'tjeep') { barrel(-0.45 * k, 0, 0.6 * k, 0, 0.26 * k); c.beginPath(); c.arc(0.68 * k, 0, 0.19 * k, 0, Math.PI * 2); paint(); }
    else barrel(0, 0, 0.9 * k, 0, 0.12 * k);
  } else {
    if (Math.cos(hd) < 0) c.scale(-1, 1);
    c.beginPath(); c.arc(0, -0.62 * k, 0.24 * k, 0, Math.PI * 2);
    c.moveTo(-0.32 * k, -0.34 * k); c.lineTo(0.32 * k, -0.34 * k); c.lineTo(0.24 * k, 0.2 * k); c.lineTo(-0.24 * k, 0.2 * k); c.closePath();
    c.rect(-0.24 * k + sw, 0.2 * k, 0.18 * k, 0.55 * k); c.rect(0.06 * k - sw, 0.2 * k, 0.18 * k, 0.55 * k);
    paint(); barrel(0.05 * k, 0.05 * k, 0.62 * k, -0.75 * k, 0.14 * k);
  }
  c.restore();
}
const idleAim = (type, side) => type === 'aa' ? -Math.PI / 2 + (side === 'blue' ? 0.6 : -0.6) : (side === 'blue' ? 0 : Math.PI);

const ELEV = 8; // the sim's height grid step (ELEV_CELL)
// the height grid as a picture, one pixel per grid point, drawn stretched (smoothly) over the map: transparent on
// the plain, then from the grass's green through the hill's earth to its light top as it climbs; each point lit by
// how it faces a light in the north-west (so slopes read as slopes)
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lerp3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
// the colour of the land at height e (lines): the grass on the plain, then as in the relief
// a hill's colour at height e: the grass, darker green the higher it climbs
const hillRGB = e => lerp3(rgbOf(colors.grass2), rgbOf(colors.tree), Math.min(1, e / 9) * 0.85);
function landRGB(e) {
  const grass = lerp3(rgbOf(colors.ground), rgbOf(colors.grass2), 0.5);
  if (e <= 0) return grass;
  return lerp3(grass, hillRGB(e), Math.min(1, e / 1.2) * 0.92);
}
function relief(E) {
  const cv2 = document.createElement('canvas'); cv2.width = E.w; cv2.height = E.h;
  const c = cv2.getContext('2d'), img = c.createImageData(E.w, E.h), d = img.data, g = E.g;
  const lerp = lerp3;
  for (let j = 0; j < E.h; j++) for (let i = 0; i < E.w; i++) {
    const k = j * E.w + i, e = g[k]; if (e <= 0) continue;
    const col = hillRGB(e);
    const dx = (g[k + (i < E.w - 1 ? 1 : 0)] - g[k - (i > 0 ? 1 : 0)]), dy = (g[k + (j < E.h - 1 ? E.w : 0)] - g[k - (j > 0 ? E.w : 0)]);
    const lit = Math.max(-1, Math.min(1, (-dx - dy) * 1.3)), f = lit > 0 ? [255, 246, 214] : [18, 28, 38], amt = Math.abs(lit) * (lit > 0 ? 0.3 : 0.38);
    const o = k * 4, m = lerp(col, f, amt);
    d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2]; d[o + 3] = 255 * Math.min(1, e / 1.2) * 0.92;
  }
  c.putImageData(img, 0, 0); return cv2;
}
// contour lines at 1, 2, … lines high, traced over the height grid (marching squares); one path per height
function contours(E) {
  const out = [], g = E.g;
  let top = 0; for (const v of g) if (v > top) top = v;
  for (let L = 1; L <= Math.floor(top); L++) {
    const p = new Path2D();
    for (let j = 0; j < E.h - 1; j++) for (let i = 0; i < E.w - 1; i++) {
      const k = j * E.w + i, a = g[k], b = g[k + 1], c = g[k + E.w + 1], d = g[k + E.w];
      const m = (a >= L) | (b >= L) << 1 | (c >= L) << 2 | (d >= L) << 3;
      if (m === 0 || m === 15) continue;
      const x = i * ELEV, y = j * ELEV, f = (u, v) => (L - u) / (v - u) * ELEV;
      const top_ = [x + f(a, b), y], right = [x + ELEV, y + f(b, c)], bot = [x + f(d, c), y + ELEV], left = [x, y + f(a, d)];
      const seg = (P, Q) => { p.moveTo(P[0], P[1]); p.lineTo(Q[0], Q[1]); };
      switch (m) {
        case 1: case 14: seg(left, top_); break; case 2: case 13: seg(top_, right); break;
        case 3: case 12: seg(left, right); break; case 4: case 11: seg(right, bot); break;
        case 6: case 9: seg(top_, bot); break; case 7: case 8: seg(left, bot); break;
        case 5: seg(left, top_); seg(right, bot); break; case 10: seg(top_, right); seg(left, bot); break;
      }
    }
    out.push(p);
  }
  return out;
}
// a shade of a theme colour: k > 0 toward white, k < 0 toward black
function shade(col, k) {
  const m = /^#([0-9a-f]{6})$/i.exec(col || ''); if (!m) return col;
  const n = parseInt(m[1], 16), f = v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
// between two theme colours (u 0..1), then a shade
function mix(a, b, u, k = 0) {
  const m = /^#([0-9a-f]{6})$/i.exec(a || ''), n = /^#([0-9a-f]{6})$/i.exec(b || ''); if (!m || !n) return a;
  const A = parseInt(m[1], 16), B = parseInt(n[1], 16), ch = sh => Math.round(((A >> sh) & 255) * (1 - u) + ((B >> sh) & 255) * u);
  return shade('#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0'), k);
}
// The ground doesn't move, so it's painted once into a picture of the screen plus a margin (at up to 2 device pixels
// per CSS pixel) and each frame only copies it; it's repainted when the view leaves that margin, the zoom or
// window changes, a new map starts, or the theme changes.
const bg = { cv: document.createElement('canvas'), key: '', x0: 0, y0: 0, w: 0, h: 0 }, BG_MARGIN = 160;
function drawGround(c) {
  const sc = view.scale, vx0 = -view.ox / sc, vy0 = -view.oy / sc, vw = cv.width / sc, vh = cv.height / sc;
  const key = [sc.toFixed(4), cv.width, cv.height, colors.ground, colors.hill, colors.tree, s.seed, s.W].join();
  if (key !== bg.key || vx0 < bg.x0 || vy0 < bg.y0 || vx0 + vw > bg.x0 + bg.w || vy0 + vh > bg.y0 + bg.h) {
    const d = Math.min(2, window.devicePixelRatio || 1), k = d / (window.devicePixelRatio || 1); // cache pixels per canvas pixel
    const m = BG_MARGIN * (window.devicePixelRatio || 1) / sc; // the margin, in world units
    bg.key = key; bg.x0 = vx0 - m; bg.y0 = vy0 - m; bg.w = vw + 2 * m; bg.h = vh + 2 * m;
    bg.cv.width = Math.ceil(bg.w * sc * k); bg.cv.height = Math.ceil(bg.h * sc * k);
    const g = bg.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = colors.ground; g.fillRect(0, 0, bg.cv.width, bg.cv.height);
    g.setTransform(sc * k, 0, 0, sc * k, -bg.x0 * sc * k, -bg.y0 * sc * k);
    const grass = tilePat(g, 'grass1');
    if (grass) { g.fillStyle = grass; g.fillRect(bg.x0, bg.y0, bg.w, bg.h); g.globalAlpha = GROUND_TINT; g.fillStyle = colors.ground; g.fillRect(bg.x0, bg.y0, bg.w, bg.h); g.globalAlpha = 1; }
    drawTerrain(g, s.W, s.H, s.W / 2);
  }
  c.drawImage(bg.cv, bg.x0, bg.y0, bg.w, bg.h);
}
function drawTerrain(c, W, H, mid) {
  c.globalAlpha = 0.75;
  // (a few are bare brown earth)
  const dry = tilePat(c, 'grass2'), dirt = tilePat(c, 'dirt');
  if (dry && dirt) {
    // (textures: a blotch is dry grass or bare earth, faint where it is only a little of either)
    for (const p of decor.patches) { c.globalAlpha = p.dirt ? 0.55 : 0.12 + 0.4 * p.u; c.fillStyle = p.dirt ? dirt : dry; c.fill(p.p); }
    c.globalAlpha = 1;
  } else {
    for (const p of decor.patches) { c.fillStyle = p.dirt ? mix(colors.ground, colors.hill, 0.45 + p.u * 0.3, p.t) : mix(colors.ground, colors.grass2, p.u, p.t); c.fill(p.p); }
    c.globalAlpha = 1;
    const n = decor.tufts.length;
    decor.tufts.forEach((p, k) => { c.fillStyle = shade(colors.grass2, -0.2 + 0.32 * k / (n - 1)); c.fill(p); });
    drawGrain(c, W, H);
  }
  for (const f of decor.fields) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = shade(colors.field, f.t); c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    c.strokeStyle = shade(colors.field2, f.t); c.lineWidth = 3;
    for (let x = -f.w / 2 + 4; x < f.w / 2; x += f.gap) { c.beginPath(); c.moveTo(x, -f.h / 2); c.lineTo(x, f.h / 2); c.stroke(); }
    c.restore();
  }
  // lakes: shallow rim, water, a darker middle, a glint
  for (const k of decor.lakes) {
    const mud = tilePat(c, 'mud'); c.fillStyle = mud || shade(colors.waterEdge, 0.35 + k.t); c.globalAlpha = mud ? 0.45 : 0.6; c.fill(k.edge); c.globalAlpha = 1;
    c.fillStyle = shade(colors.water, k.t); c.fill(k.body);
    c.lineWidth = 2; c.strokeStyle = shade(colors.waterEdge, k.t); c.stroke(k.body);
    c.fillStyle = shade(colors.waterEdge, -0.1 + k.t); c.globalAlpha = 0.45; c.fill(k.deep); c.globalAlpha = 1;
    const l = k.l; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(l.x - l.rx * 0.25, l.y - l.ry * 0.3, l.rx * 0.3, l.ry * 0.25, l.a, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  }
  // hills: the relief (colour by height, lit from the north-west) blends into the grass; then the contour lines,
  // every fifth a little stronger
  const R = decor.hills, key = colors.tree + colors.ground + colors.grass2;
  if (R.theme !== key) { R.relief = relief(s.elev); R.theme = key; }
  const rocky = tilePat(c, 'rocky');
  if (rocky) c.globalAlpha = RELIEF_OVER_TILES;
  c.drawImage(R.relief, -ELEV / 2, -ELEV / 2, R.relief.width * ELEV, R.relief.height * ELEV);
  c.globalAlpha = 1;
  if (rocky) drawStony(c, rocky);
  c.strokeStyle = shade(colors.tree, -0.35); c.lineCap = 'round';
  R.contours.forEach((p, k) => { c.globalAlpha = (k + 1) % 5 ? 0.22 : 0.4; c.lineWidth = (k + 1) % 5 ? 1 : 1.6; c.stroke(p); });
  c.globalAlpha = 1;
  // roads: thin dirt tracks in the colour of the land they cross, only a little lighter, with a faint darker edge
  // (colours per stretch, remade when the theme changes)
  c.lineCap = 'round'; c.lineJoin = 'round';
  const RK = colors.road + colors.ground + colors.hill;
  if (decor.roadKey !== RK) {
    decor.roadKey = RK;
    const dirt = rgbOf(colors.road), css = v => 'rgb(' + v.map(Math.round).join(',') + ')';
    decor.roadCol = decor.roads.map(pts => pts.map(p => { const land = landRGB(Sim.elevAt(s, p)); return [css(lerp3(land, [0, 0, 0], 0.1)), css(lerp3(land, dirt, 0.38))]; }));
  }
  // (with the textures: a track of bare earth over the grass, a faint darker edge)
  const track = tilePat(c, 'dirt');
  for (const pass of [0, 1]) decor.roads.forEach((pts, j) => {
    if (track) c.globalAlpha = pass ? 0.5 : 0.1;
    for (let i = 1; i < pts.length; i++) {
      c.strokeStyle = track ? (pass ? track : '#000') : decor.roadCol[j][i][pass]; c.lineWidth = pts[i].w + (pass ? 0 : 1.6);
      c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke();
    }
  });
  c.globalAlpha = 1;
  // woods, bushes and stones: the pictures (art/Background) when they're in, else a few fills (each shade one path)
  if (drawScenery(c)) { drawGrade(c, W, H); return; }
  const T = decor.trees, Rk = decor.rocks, nb = T.treeBody.length;
  c.fillStyle = colors.shadow; c.fill(T.treeShadow); c.fill(Rk.rockShadow);
  for (let k = 0; k < nb; k++) { const u = -0.14 + 0.26 * k / (nb - 1); c.fillStyle = shade(mix(colors.tree, colors.grass2, 0.45), u); c.fill(T.bush[k]); }
  for (let k = 0; k < nb; k++) { const u = -0.12 + 0.24 * k / (nb - 1); c.fillStyle = shade(colors.tree, u); c.fill(T.treeBody[k]); c.fillStyle = shade(colors.treeHi, u); c.fill(T.treeTop[k]); }
  for (let k = 0; k < nb; k++) { c.fillStyle = shade(colors.rock, -0.15 + 0.3 * k / (nb - 1)); c.fill(Rk.rock[k]); }
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fill(Rk.rockHi);
  drawGrade(c, W, H);
}

// drone: a quadcopter from above — four rotors on an X frame
const AMMO = '#e0b020', GLOW = { inf: 2.5, aa: 2.5, at: 2.5, med: 2.5, jeep: 3, ajeep: 3, tjeep: 3 };
function drawDrone(c, x, y, k, col, rot = 0, spin = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.lineWidth = k * 0.16; c.strokeStyle = colors.outline;
  c.beginPath(); c.moveTo(-k * 0.7, -k * 0.7); c.lineTo(k * 0.7, k * 0.7); c.moveTo(k * 0.7, -k * 0.7); c.lineTo(-k * 0.7, k * 0.7); c.stroke();
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.fillStyle = colors.halo; c.beginPath(); c.arc(a * k * 0.7, b * k * 0.7, k * 0.42, 0, Math.PI * 2); c.fill();
    c.lineWidth = k * 0.1; c.strokeStyle = col; c.stroke();
    // a rotor blade, spinning (each pair the other way)
    const r = spin * (a * b), bx = Math.cos(r) * k * 0.36, by = Math.sin(r) * k * 0.36;
    c.lineWidth = k * 0.07; c.strokeStyle = colors.outline; c.beginPath(); c.moveTo(a * k * 0.7 - bx, b * k * 0.7 - by); c.lineTo(a * k * 0.7 + bx, b * k * 0.7 + by); c.stroke();
  }
  c.fillStyle = col; c.beginPath(); c.rect(-k * 0.28, -k * 0.28, k * 0.56, k * 0.56); c.fill(); c.lineWidth = k * 0.08; c.strokeStyle = colors.outline; c.stroke();
  c.restore();
}

// fog of war: dim everything outside what blue can see (units' sight, own base, held points)
const fogCv = document.createElement('canvas'), fctx = fogCv.getContext('2d');
function drawFog() {
  const f = fctx;
  if (fogCv.width !== cv.width || fogCv.height !== cv.height) { fogCv.width = cv.width; fogCv.height = cv.height; }
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, fogCv.width, fogCv.height);
  f.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  f.fillStyle = colors.fog; f.fillRect(0, 0, s.W, s.H);
  f.globalCompositeOperation = 'destination-out'; f.fillStyle = '#000';
  const hole = (x, y, r) => {
    const g = f.createRadialGradient(x, y, r * 0.75, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
  };
  // our squads lift the fog around them only where they're drawn (not around a guess)
  for (const q of s.squads) if (q.side === 'blue' && !q.dead && sqShown(q)) hole(q.cx, q.cy, Sim.TYPES[q.type].sight * (1 - 0.4 * Sim.nightAt(s)) + 30);
  for (const n of s.nodes) if (n.side === 'blue' && s.t >= n.ready) hole(n.x, n.y, n.kind === 'drone' ? Sim.DRONE_SIGHT + 15 : n.kind === 'fhq' ? Sim.NODES.fhq.sight : n.kind === 'hq' ? Sim.STRUCTS.hq.sight + 20 : 170);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = s.fogAt ? Math.min(1, (s.t - s.fogAt) / 3) : 1; ctx.drawImage(fogCv, 0, 0); ctx.restore();
}

// enemy as blobs of uncertainty: tight when just seen, spreading and fading with the age of the sighting
const STALE = 12, TRAIL = 8, BLOB_LIFE = 40, BLOB_R = 25, BLOB_MAX = 150, UNSURE = 4;
const intelAt = new Map(); let intelT = 0; // (where each sighting is drawn: easing toward the latest fix)
function drawEnemyIntel(c) {
  const now = performance.now(), ease = 1 - Math.exp(-Math.min(0.1, (now - intelT) / 1000) * 2.5); intelT = now;
  for (const q of s.squads) {
    const m0 = q.side === 'red' && s.mem.blue[q.id], age = m0 ? s.t - m0.t : Infinity;
    if (!m0 || age > BLOB_LIFE) { intelAt.delete(q.id); continue; }
    let d = intelAt.get(q.id); if (!d || Math.hypot(d.x - m0.x, d.y - m0.y) > 260) intelAt.set(q.id, d = { x: m0.x, y: m0.y });
    d.x += (m0.x - d.x) * ease; d.y += (m0.y - d.y) * ease;
    const m = { ...m0, x: d.x, y: d.y };
    if (age < 0.2 && shownAt(m)) continue; // seen right now where the units themselves are drawn
    // how fast it could have moved since: by type when identified, else by what's known (aircraft / ground / anything)
    const speed = m.type ? Sim.TYPES[m.type].speed : m.air ? Sim.TYPES.air.speed : m.air === false ? 50 : 70;
    const k = 1 - age / BLOB_LIFE, r = Math.min(BLOB_MAX, BLOB_R + speed * age * 0.5);
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    g.addColorStop(0, hexA(colors.red, 0.18 * k + 0.05)); g.addColorStop(0.6, hexA(colors.red, 0.08 * k)); g.addColorStop(1, hexA(colors.red, 0));
    c.fillStyle = g; ring(m.x, m.y, r); c.fill();
    c.globalAlpha = SYMBOL_A * (0.5 + 0.5 * k); // (a symbol only: faint, well under the units themselves)
    // identification (our control where it is): type and size / only ground or air / only "something moves"
    if (m.lvl >= 1) { c.fillStyle = hexA(colors.red, 0.6); ring(m.x, m.y, SYMBOL_R); c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke(); }
    else { c.fillStyle = hexA(colors.red, 0.25); ring(m.x, m.y, SYMBOL_R); c.fill(); c.lineWidth = 1; c.strokeStyle = colors.red; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    if (m.type) glyph(c, m.type, m.x, m.y, m.type === 'air' ? 7 : 5, '#fff', null, Math.PI, m.type === 'aa' ? -Math.PI / 2 : Math.PI);
    else if (m.air) glyph(c, 'air', m.x, m.y, 7, '#fff', null, -Math.PI / 2);
    else if (m.lvl === 1) { c.fillStyle = '#fff'; c.fillRect(m.x - 5, m.y - 3, 10, 6); }
    else label('?', m.x, m.y + 5, colors.red);
    // rough size: 1-3 dots from how many were seen (only when identified)
    const dots = !m.n ? 0 : m.n <= 2 ? 1 : m.n <= 4 ? 2 : 3; c.fillStyle = colors.red;
    for (let i = 0; i < dots; i++) { ring(m.x - (dots - 1) * 4 + i * 7, m.y + 14, 2); c.fill(); }
    if (age > UNSURE) label('?', m.x + 15, m.y - 8, colors.red);
    c.globalAlpha = 1;
  }
}
// where the picture is exact under fog: the full-control ring (a drone's centre, near the HQ); units there are drawn
// as they are, and our squads report there all the time. Only the fog without command friction shows every seen unit.
const shownAt = p => !Sim.friction(s) || Sim.quality(s, 'blue', p) >= 1;
// control quality: a blue wash, deepest at full control and fading smoothly out to nothing (the rings of the rules
// blend into each other on the map). Worked out once on a grid (a point every QC units) and redone only when the
// nodes change.
const qual = { cv: document.createElement('canvas'), key: '' }, QC = ELEV;
function drawQuality(c) {
  const nodes = s.nodes.filter(n => n.side === 'blue' && Sim.nodeSpec(n.kind) && n.hp > 0 && s.t >= n.ready);
  const key = s.seed + ':' + s.W + ':' + nodes.map(n => n.id).join() + ':' + colors.blue;
  if (key !== qual.key) {
    qual.key = key;
    const w = Math.ceil(s.W / QC) + 1, h = Math.ceil(s.H / QC) + 1, q = qual.cv; q.width = w; q.height = h;
    const g = q.getContext('2d'), img = g.createImageData(w, h), d = img.data, [r0, g0, b0] = rgbOf(colors.blue);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i, v = Sim.quality(s, 'blue', { x: i * QC, y: j * QC }, false, true) - 0.15; // above the floor
      if (v <= 0) continue;
      d[k * 4] = r0; d[k * 4 + 1] = g0; d[k * 4 + 2] = b0; d[k * 4 + 3] = Math.round(255 * 0.24 * Math.pow(v / 0.85, 1.4));
    }
    g.putImageData(img, 0, 0);
  }
  c.drawImage(qual.cv, -QC / 2, -QC / 2, qual.cv.width * QC, qual.cv.height * QC);
}
// control nodes: forward HQs (build-up ring, then working) and drones (warm-up, then flight time left)
// structures: HQ, buildings, forward HQs, drones. Ours always; the enemy's while seen, then faded where last seen.
// Arc: construction / warm-up progress, then a drone's flight time left, or a building's next unit.
const nodeShown = n => n.side === 'blue' || !s.fog || s.visNodes.blue.has(n.id);
// a building's picture in its side's colour: the emoji drawn once off screen, its coloured parts turned to the side's
// hue (keeping their light and shade; greys, whites and blacks stay), kept per picture, colour and size
const iconCache = new Map(), ICON_RES = 3;
function sideIcon(icon, col, px) {
  const key = icon + col + px; let pic = iconCache.get(key); if (pic) return pic;
  const w = Math.ceil(px * 1.3 * ICON_RES); pic = document.createElement('canvas'); pic.width = pic.height = w;
  const c = pic.getContext('2d'); c.font = `${px * ICON_RES}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon, w / 2, w / 2 + px * 0.06 * ICON_RES);
  const img = c.getImageData(0, 0, w, w), d = img.data, [hue] = toHsl(...rgbOf(col));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [, sat, l] = toHsl(d[i], d[i + 1], d[i + 2]);
    if (sat < 0.25 || l < 0.12 || l > 0.93) continue;
    const [r, g, b] = fromHsl(hue, Math.min(1, sat * 1.05), l); d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  c.putImageData(img, 0, 0); iconCache.set(key, pic); return pic;
}
function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, sat, l];
}
function fromHsl(h, sat, l) {
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// a building's picture across: by its footprint (the HQ and the airfield the biggest, the tents the smallest)
const STRUCT_PX = 40, pxOf = kind => Math.round((Sim.STRUCTS[kind].r || 16) * 2.4), HQ_PX = pxOf('hq');
function drawStruct(c, n, ghost) {
  const S = Sim.STRUCTS[n.kind], col = colors[n.side], on = s.t >= n.ready;
  // under construction: the building shows, from fully see-through to whole (a bulldozer's site: by the work done;
  // else by the time)
  const site = Number.isFinite(n.work) && !on;
  const grow = on || ghost || n.kind === 'drone' ? 1 : site ? Math.min(1, n.work / Math.max(0.01, n.need)) : n.kind === 'hq' ? 1 : Math.max(0, Math.min(1, (s.t - n.t0) / Math.max(0.01, n.ready - n.t0)));
  c.globalAlpha = ghost ? 0.45 : 1;
  if (!ghost && n.kind !== 'drone' && !on && (site || n.kind !== 'hq')) {
    c.strokeStyle = col; c.globalAlpha = 0.8; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, S.r + 12, -Math.PI / 2, -Math.PI / 2 + grow * Math.PI * 2); c.stroke(); c.globalAlpha = 1;
  }
  if (n.kind === 'drone') { c.globalAlpha = ghost ? 0.2 : 0.32; drawDrone(c, n.x, n.y, 8, col, s.t * 0.35 + n.id, on ? s.t * 25 : 0); }
  else {
    const px = pxOf(n.kind), k = px / STRUCT_PX;
    c.globalAlpha = ghost ? 0.45 : on ? 1 : 0.16 + grow * grow * 0.8; // (from faint — its spot shows — to solid)
    drawBuilding(c, n.kind, col, n.x, n.y, px);
    if ((n.kind === 'hq' || n.kind === 'decoy') && on && !ghost && !hasBuildingPic(n.kind)) drawFlag(c, n.x, n.y, k, col);
    if (n.kind === 'decoy' && n.side === 'blue') { c.font = '15px sans-serif'; c.fillText(S.badge, n.x + px * 0.35, n.y - px * 0.1); }
  }
  c.globalAlpha = 1;
  if (ghost) return;
  const R = Sim.STRUCTS[n.kind].r, top = n.kind === 'drone' ? 16 : R + 14, bot = n.kind === 'drone' ? 14 : R + 8;
  // (a site: ⏸ while no bulldozer works it; else the seconds left)
  // (a site: its % while a bulldozer works it or drives to it; nothing while it waits its turn in a queue — the queue's
  // number shows; ⏸ when no bulldozer has it at all, or its bulldozer was sent elsewhere)
  const queued = site && s.squads.some(q => q.type === 'dozer' && !q.dead && !q.paused && (q.jobs || []).includes(n.id));
  if (!on && !(site && !n.working && !dozerComing(n) && queued)) label(site ? (n.working || dozerComing(n) ? Math.round(grow * 100) + '%' : '⏸') : String(Math.ceil(n.ready - s.t)), n.x, n.y - top, col);
  if (n.fixing && nodeShown(n)) { c.font = '13px sans-serif'; c.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 150); c.fillText('🔧', n.x + 18, n.y - top + 4); c.globalAlpha = 1; }
  if (n.hp < S.hp) { c.fillStyle = colors.shadow; c.fillRect(n.x - 14, n.y + bot, 28, 3); c.fillStyle = col; c.fillRect(n.x - 14, n.y + bot, 28 * Math.max(0, n.hp / S.hp), 3); }
  // ours: the next unit coming out — a bar filling up, and the unit's shape beside it
  if (on && S.unit && n.side === 'blue' && n.prog > 0) {
    const y = n.y - top - 2; c.fillStyle = colors.halo; c.globalAlpha = 0.8; c.fillRect(n.x - 15, y - 2, 30, 5); c.globalAlpha = 1;
    c.fillStyle = col; c.fillRect(n.x - 14, y - 1, 28 * Math.min(1, n.prog), 3);
    const g = Math.min(6, SIZE[S.unit] * 0.55); glyph(c, S.unit, n.x - 21, y, g, col, colors.outline, 0, S.unit === 'aa' ? -Math.PI / 4 : 0, 0.8);
  }
}
function drawNodes(c) {
  for (const n of s.nodes) if (nodeShown(n)) drawStruct(c, n, false);
  if (!s.fog) return;
  for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) drawStruct(c, { ...s.memNodes.blue[id], side: 'red' }, true);
}
// our bulldozers' work lists: each site's place in its bulldozer's queue (a small number), a faint dotted line from a
// bulldozer to the site it's driving to, and ⏸ over one the player sent elsewhere while it still has work
const dozerComing = n => s.squads.some(q => q.side === n.side && q.type === 'dozer' && !q.dead && !q.paused && Sim.jobOf(s, q) === n);
function drawDozerJobs(c) {
  if (!s.dozers) return;
  for (const q of s.squads) {
    if (q.side !== 'blue' || q.type !== 'dozer' || q.dead) continue;
    const list = (q.jobs || []).map(id => s.nodes.find(n => n.id === id)).filter(n => n && n.hp > 0 && Sim.isSite(n) && s.t < n.ready);
    const u = s.units.find(u => u.squad === q.id), seen = u && sqShown(q), job = list[0];
    list.forEach((n, i) => {
      const R = Sim.STRUCTS[n.kind].r, x = n.x - R - 4, y = n.y - R - 2;
      c.globalAlpha = q.paused ? 0.45 : 0.9; c.fillStyle = hexA(colors.blue, 0.85); ring(x, y, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '700 9px Rubik, sans-serif'; c.fillText(String(i + 1), x, y + 3.2);
    });
    if (seen && job && !q.paused && Math.hypot(u.x - job.x, u.y - job.y) > Sim.STRUCTS[job.kind].r + Sim.DOZER_R + 8) {
      c.globalAlpha = 0.5; c.strokeStyle = colors.blue; c.lineWidth = 1.5; c.setLineDash([4, 5]);
      c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(job.x, job.y); c.stroke(); c.setLineDash([]);
    }
    if (seen && q.paused && job) { c.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 300); label('⏸', u.x, u.y - SIZE.dozer - 4, colors.blue); }
    c.globalAlpha = 1;
  }
}
// how far from a forward HQ building is allowed (its control there is at least the building minimum, in the rings)
const FHQ_BUILD_R = (() => { const N = Sim.NODES.fhq; let d = N.r0; while (d < N.r1 && N.q * (Math.ceil((1 - (d - N.r0) / (N.r1 - N.r0)) * 4) / 5) >= 0.5) d += 2; return d; })();
// build placement: green where a building may go (strong enough control, a free slot, room)
function drawBuildArea(c) {
  // forward HQs on their way: a faint 🏕️ where each will stand, a dotted line from its squad; placing one: the area it
  // will open for building, around the pointer
  for (const q of s.squads) if (q.side === 'blue' && q.fhqAt && !q.dead) {
    const p = pos(q), f = q.fhqAt;
    c.globalAlpha = 0.45; drawBuilding(c, 'fhq', colors.blue, f.x, f.y, pxOf('fhq')); c.globalAlpha = 1;
  }
  // open field: the HQ's spot on its way (a faint 🏰), and while placing it, our strip in green and 🏰 at the pointer
  const cq = s.squads.find(q => q.side === 'blue' && q.hqAt && !q.dead);
  if (cq && cq.hqAt) { c.globalAlpha = 0.45; drawBuilding(c, 'hq', colors.blue, cq.hqAt.x, cq.hqAt.y, HQ_PX); c.globalAlpha = 1; }
  if (hqArmed) {
    const [a, b] = Sim.hqBand(s, 'blue'); c.fillStyle = 'rgba(80,200,90,.16)'; c.fillRect(a, 30, b - a, s.H - 60);
    c.strokeStyle = 'rgba(60,170,70,.7)'; c.lineWidth = 1.5; c.setLineDash([6, 5]); c.strokeRect(a, 30, b - a, s.H - 60); c.setLineDash([]);
    if (mouseAt) { const r = cv.getBoundingClientRect(), w = { x: (mouseAt.x - r.left - view.cox) / view.css, y: (mouseAt.y - r.top - view.coy) / view.css }; c.globalAlpha = Sim.hqCheck(s, 'blue', w.x, w.y) ? 0.25 : 0.7; drawBuilding(c, 'hq', colors.blue, w.x, w.y, HQ_PX); c.globalAlpha = 1; }
  }
  if (fhqArmed && mouseAt) {
    const r = cv.getBoundingClientRect(), w = { x: (mouseAt.x - r.left - view.cox) / view.css, y: (mouseAt.y - r.top - view.coy) / view.css };
    c.fillStyle = 'rgba(80,200,90,.16)'; c.strokeStyle = 'rgba(60,170,70,.7)'; c.lineWidth = 1.5; c.setLineDash([6, 5]);
    ring(w.x, w.y, FHQ_BUILD_R); c.fill(); c.stroke(); c.setLineDash([]);
    c.globalAlpha = Sim.fhqCheck(s, w.x, w.y) ? 0.25 : 0.7; drawBuilding(c, 'fhq', colors.blue, w.x, w.y, pxOf('fhq')); c.globalAlpha = 1;
  }
  if (!buildArmed) return;
  const G = 20, v = viewRect() || { x: 0, y: 0, w: s.W, h: s.H }; c.fillStyle = 'rgba(80,200,90,.22)';
  const x0 = Math.max(G / 2, Math.floor(v.x / G) * G + G / 2), y0 = Math.max(G / 2, Math.floor(v.y / G) * G + G / 2);
  for (let y = y0; y < Math.min(s.H, v.y + v.h + G); y += G) for (let x = x0; x < Math.min(s.W, v.x + v.w + G); x += G) if (!Sim.buildCheck(s, 'blue', x, y, buildArmed)) c.fillRect(x - G / 2, y - G / 2, G, G);
  // (the building at the pointer, in its size: faint where it can't go)
  if (mouseAt) { const r = cv.getBoundingClientRect(), w = { x: (mouseAt.x - r.left - view.cox) / view.css, y: (mouseAt.y - r.top - view.coy) / view.css }; c.globalAlpha = Sim.buildCheck(s, 'blue', w.x, w.y, buildArmed) ? 0.25 : 0.7; drawBuilding(c, buildArmed, colors.blue, w.x, w.y, pxOf(buildArmed)); c.globalAlpha = 1; }
}
// event reports appear where they happened, pop in and fade out
// (not shown: arrived, roger, contact — the voice says them — nor the envelopes of orders on their way)
const MARK = { promo: '⭐', unclear: '❓', hit: '💥', lost: '✖', flag: '🚩', flagLost: '🏳', call: '📞', fhq: '🏕️', nodeLost: '💥', ff: '⚠' };
// orders still on their way: an envelope runs from HQ toward the squad
function drawMail(c) {
  const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || { x: s.bases.blue.x, y: s.H / 2 };
  for (const m of s.outbox) {
    const q = m.side === 'blue' && s.squads.find(x => x.id === m.id);
    if (!q || q.dead) continue;
    const p = guessAt(q), k = Math.min(1, (s.t - m.sent) / Math.max(0.01, m.at - m.sent));
    c.globalAlpha = 0.8; c.font = '13px sans-serif';
    c.fillText('✉', hq.x + (p.x - hq.x) * k, hq.y + (p.y - 26 - hq.y) * k + 4);
  }
  c.globalAlpha = 1;
}
function drawMarks(c) {
  for (const k of s.marks) {
    if (!MARK[k.kind]) continue;
    const a = (s.t - k.t) / Sim.MARK_LIFE, sc = a < 0.15 ? 0.6 + a / 0.15 * 0.6 : 1.2 - Math.min(0.2, a);
    c.globalAlpha = Math.max(0, 1 - a); c.font = `${Math.round(18 * sc)}px sans-serif`;
    c.lineWidth = 3; c.strokeStyle = colors.halo; c.strokeText(MARK[k.kind], k.x, k.y - 44);
    c.fillStyle = k.kind === 'lost' || k.kind === 'flagLost' || k.kind === 'ff' ? colors.red : colors.ink; c.fillText(MARK[k.kind], k.x, k.y - 44);
  }
  c.globalAlpha = 1;
}

// per unit (this game): its stride (how far it has moved, for the walking / driving look) and, under fog, where it was
// last drawn — a unit that leaves the exact picture fades out there over GHOST_T s (like a sighting), not all at once
const anim = { s: null, walk: new Map(), last: new Map() }, GHOST_T = 10;
function stride(u) {
  let a = anim.walk.get(u.id);
  if (!a) { a = { x: u.x, y: u.y, ph: 0 }; anim.walk.set(u.id, a); }
  const d = Math.hypot(u.x - a.x, u.y - a.y); a.x = u.x; a.y = u.y;
  if (d > 0.05 && d < 20) a.ph += d * 0.35; else if (d <= 0.05) a.ph = 0;
  if (d > 0.05) { addTrack(u, a); addDust(u, a, d); }
  return a.ph;
}
// the fallen lie where they fell for a while (soldiers on their side, vehicles as dark wrecks), fading
function drawFallen(c) {
  for (const f of s.fallen) {
    const age = s.t - f.t; if (s.fog && !shownAt(f)) continue;
    const a = Math.max(0, 1 - age / 12), T = Sim.TYPES[f.type], k = SIZE[f.type];
    if (T.air) { c.globalAlpha = 0.5 * a; c.fillStyle = '#2a2a24'; ring(f.x, f.y, k * 0.9); c.fill(); continue; } // a crash site
    c.globalAlpha = 0.75 * a;
    if (CAR.has(f.type) && hasSprite(f.type)) drawUnitPic(c, f.type, f.x, f.y, k, 'wreck', f.hd + 0.3, f.hd + 1.2);
    else if (CAR.has(f.type)) glyph(c, f.type, f.x, f.y, k, '#3b3833', colors.outline, f.hd + 0.3, f.hd + 1.2);
    else { c.save(); c.translate(f.x, f.y); c.rotate(Math.PI / 2 * (f.side === 'blue' ? -1 : 1) * Math.min(1, age / 0.35)); glyph(c, f.type, 0, 0, k, shade(colors[f.side], -0.35), colors.outline, 0); c.restore(); }
  }
  c.globalAlpha = 1;
}
// tracks: vehicles leave faint marks in the ground as they drive, fading over TRACK_T s
const tracks = [], TRACK_T = 8, TRACK_MAX = 1500;
function addTrack(u, a) {
  if (!CAR.has(u.type)) return;
  const d = Math.hypot(u.x - (a.tx ?? u.x - 99), u.y - (a.ty ?? u.y - 99));
  if (d < 7) return;
  a.tx = u.x; a.ty = u.y; tracks.push({ x: u.x, y: u.y, a: u.hd, t: s.t, w: u.type === 'tank' ? 0.55 : 0.45, k: SIZE[u.type] });
  if (tracks.length > TRACK_MAX) tracks.splice(0, tracks.length - TRACK_MAX);
}
// dust: little clouds kicked up behind moving vehicles (fewer behind soldiers), swelling and fading in DUST_T s
const dust = [], DUST_T = 0.9, DUST_MAX = 400;
function addDust(u, a, d) {
  const car = CAR.has(u.type);
  a.dd = (a.dd || 0) + d; if (a.dd < (car ? 6 : 26)) return; a.dd = 0;
  const k = SIZE[u.type], back = car ? k * 0.9 : k * 0.2, sx = (Math.random() - 0.5) * k * 0.6;
  dust.push({ x: u.x - Math.cos(u.hd) * back - Math.sin(u.hd) * sx, y: u.y + k * (car ? 0.2 : 0.7) - Math.sin(u.hd) * back + Math.cos(u.hd) * sx, t: s.t, r: car ? (u.type === 'tank' ? 3.2 : 2.4) : 0.8, a: car ? 0.45 : 0.18 });
  if (dust.length > DUST_MAX) dust.splice(0, dust.length - DUST_MAX);
}
function drawDust(c) {
  while (dust.length && s.t - dust[0].t > DUST_T) dust.shift();
  c.fillStyle = DUST_COL;
  for (const p of dust) {
    const a = (s.t - p.t) / DUST_T; if (a < 0 || a >= 1) continue; // (never past its fade)
    c.globalAlpha = p.a * (1 - a); ring(p.x, p.y - a * 3, p.r * (1 + a * 1.6)); c.fill();
  }
  c.globalAlpha = 1;
}
const DUST_COL = '#cbbd9c';
function drawTracks(c) {
  while (tracks.length && s.t - tracks[0].t > TRACK_T) tracks.shift();
  c.fillStyle = colors.shadow;
  for (const p of tracks) {
    if (p.t > s.t) continue;
    c.globalAlpha = 0.6 * (1 - (s.t - p.t) / TRACK_T);
    c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillRect(-2.5, -p.w * p.k - 1, 5, 2); c.fillRect(-2.5, p.w * p.k - 1, 5, 2); c.restore();
  }
  c.globalAlpha = 1;
}
function drawGhosts(c) {
  const alive = new Set(s.units.map(u => u.id));
  for (const [id, g] of anim.last) {
    const age = s.t - g.t;
    if (age < 0.05) continue; // still drawn for real
    if (age > GHOST_T || (!alive.has(id) && age < 0.3)) { anim.last.delete(id); continue; } // gone, or seen dying
    c.globalAlpha = 0.55 * (1 - age / GHOST_T);
    if (hasSprite(g.type)) drawUnitPic(c, g.type, g.x, g.y, SIZE[g.type], colors[g.side], g.hd, g.hd);
    else glyph(c, g.type, g.x, g.y, SIZE[g.type], colors[g.side], colors.outline, g.hd, g.hd);
  }
  c.globalAlpha = 1;
}
// units: ground first, aircraft (with drop shadows) on top
const BAR_BODY_R = 70; // (a squad's strength bar: over the units this near its middle)
// a hurt unit of ours: a small dot over it — yellow, orange under HURT_MID, red under HURT_LOW (none at full health)
const HURT_MID = 0.6, HURT_LOW = 0.3;
function healthDot(c, u) {
  const k = u.hp / Sim.TYPES[u.type].hp; if (k >= 0.97) return;
  const r = Math.max(2, 3.2 / view.css), y = u.y - SIZE[u.type] * (Sim.TYPES[u.type].air ? 0.9 : 0.75) - r - 1;
  c.fillStyle = k < HURT_LOW ? '#e53935' : k < HURT_MID ? '#ff8f1f' : '#ffd43b'; c.lineWidth = Math.max(0.8, 1.2 / view.css); c.strokeStyle = 'rgba(0,0,0,.55)';
  c.beginPath(); c.arc(u.x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
}
function drawUnits(c, show) {
  const hurt = [];
  for (const pass of [false, true]) for (const u of s.units) {
    const T = Sim.TYPES[u.type]; if (!!T.air !== pass || !show(u)) continue;
    if (s.fog && u.side === 'red') anim.last.set(u.id, { x: u.x, y: u.y, type: u.type, side: u.side, hd: u.hd, t: s.t });
    const k = SIZE[u.type], recent = s.t - u.lastFire < 3;
    const aim = recent ? u.aim : (u.type === 'aa' ? idleAim('aa', u.side) : u.hd);
    if (T.air) { c.globalAlpha = 0.22; glyph(c, 'air', u.x + 7, u.y + 10, k, '#000', null, u.hd); c.globalAlpha = 1; }
    else { c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(u.x + 2, u.y + 4, k * 0.75, k * 0.35, 0, 0, Math.PI * 2); c.fill(); }
    // soldiers and jeeps are small: a light glow round them, so they stand out from the ground
    const glow = GLOW[u.type]; if (glow) { c.shadowColor = colors.halo; c.shadowBlur = glow * view.scale; }
    glyphRecoil = Math.max(0, 1 - (s.t - u.lastFire) / 0.25);
    if (u.side === 'blue') hurt.push(u);
    if (hasSprite(u.type)) { stride(u); drawUnitPic(c, u.type, u.x, u.y, k, colors[u.side], u.hd, aim, glyphRecoil); } // (its picture)
    else glyph(c, u.type, u.x, u.y, k, colors[u.side], colors.outline, u.hd, aim, glow ? 0.9 : 1.2, T.air ? 0 : stride(u));
    glyphRecoil = 0;
    if (glow) c.shadowBlur = 0;
    if (u.rearm) label('⟲', u.x, u.y - k - 4, colors.ink);
    // (no ammunition or care marks, no health bar: a hurt unit of ours has its dot, see healthDot)
    if (u.side === 'blue' && sel !== 'all' && isSel(u.squad)) { // (all of them picked, as at the start: no rings)
      // picked: a faint light ring close round the unit
      c.globalAlpha = 0.4; c.strokeStyle = colors.halo; c.lineWidth = 1; ring(u.x, u.y, k * (u.type === 'tank' ? 0.95 : 1) + 2.5); c.stroke(); c.globalAlpha = 1;
    }
  }
  for (const u of hurt) healthDot(c, u);
}

function draw() {
  const c = ctx, W = s.W, H = s.H, mid = W / 2;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = colors.ground; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  c.textAlign = 'center';
  drawGround(c); sceneryTick(); drawGoneScenery(c); drawWater(c); drawScorch(c);
  // shots in flight: bullets (a quick bright dot), shells (a glowing round with a short streak), missiles (a body
  // with a smoke trail back to where it was fired)
  c.save(); c.lineCap = 'round';
  for (const sh of s.shots) {
    const k = Math.min(1, (sh.dur + 0.12 - sh.life) / sh.dur), x = sh.x1 + (sh.x2 - sh.x1) * k, y = sh.y1 + (sh.y2 - sh.y1) * k;
    const dx = sh.x2 - sh.x1, dy = sh.y2 - sh.y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (sh.kind === 'air' || sh.kind === 'aa' || sh.kind === 'at' || sh.kind === 'ajeep' || sh.kind === 'tjeep') {
      const back = Math.min(d * k, 40);
      c.globalAlpha = 0.35 * (k < 1 ? 1 : sh.life / 0.12); c.strokeStyle = '#d8d8d0'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x - ux * back, y - uy * back); c.lineTo(x, y); c.stroke();
      if (k < 1) { c.globalAlpha = 1; c.strokeStyle = sh.kind !== 'air' ? '#fff1a8' : colors[sh.side]; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - ux * 5, y - uy * 5); c.lineTo(x, y); c.stroke(); c.fillStyle = '#ffb040'; ring(x - ux * 6, y - uy * 6, 1.6); c.fill(); }
    } else if (k < 1) {
      const tank = sh.kind === 'tank', len = tank ? 9 : 5;
      c.globalAlpha = 1; c.shadowColor = '#ffcf6a'; c.shadowBlur = tank ? 6 : 3; c.strokeStyle = tank ? '#ffe2a0' : '#fff6c8'; c.lineWidth = tank ? 2.6 : 1.4;
      c.beginPath(); c.moveTo(x - ux * len, y - uy * len); c.lineTo(x, y); c.stroke(); c.shadowBlur = 0;
    }
  }
  c.restore(); c.globalAlpha = 1;
  // units: exact picture without fog; under fog what we see where the picture is exact (see shownAt)
  if (anim.s !== s) { anim.s = s; anim.walk.clear(); anim.last.clear(); tracks.length = 0; dust.length = 0; }
  drawTracks(c); drawFallen(c); drawDust(c);
  if (!s.fog) drawUnits(c, () => true);
  else { const whole = new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)); drawUnits(c, u => (u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u)); drawGhosts(c); }
  // explosions: fireball, smoke ring for medium+, sparks for big
  for (const f of s.fx) {
    if (f.wait > 0) continue; // its shot is still flying
    const t = 1 - f.life / f.max, a = 1 - t, R = f.size, r = R * (0.35 + 0.65 * Math.sqrt(t));
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,255,220,${a})`); g.addColorStop(0.35, `rgba(255,200,60,${a * 0.9})`);
    g.addColorStop(0.7, `rgba(240,90,20,${a * 0.6})`); g.addColorStop(1, 'rgba(120,40,10,0)');
    c.fillStyle = g; ring(f.x, f.y, r); c.fill();
    if (R >= 10) { c.strokeStyle = `rgba(70,70,70,${a * 0.5})`; c.lineWidth = R >= 18 ? 3 : 2; ring(f.x, f.y, r * 1.3); c.stroke(); }
    if (R >= 18) {
      c.strokeStyle = `rgba(255,220,120,${a})`; c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.047 + f.x * 0.1, d0 = r * 0.8, d1 = r * 1.6;
        c.beginPath(); c.moveTo(f.x + Math.cos(ang) * d0, f.y + Math.sin(ang) * d0); c.lineTo(f.x + Math.cos(ang) * d1, f.y + Math.sin(ang) * d1); c.stroke();
      }
    }
  }
  drawSmoke(c); drawFlashes(c); drawClouds(c);
  drawNightLit(c);
  if (s.fog) { drawFog(); if (Sim.friction(s)) drawQuality(c); drawEnemyIntel(c); drawMarks(c); }
  drawNodes(c); drawDozerJobs(c);
  drawBuildArea(c);
  // our squads. Where the units themselves are drawn: their strength and ammunition over them, no badge. Where they
  // aren't (out of the exact picture under command friction): faint units where they probably are by now, and a
  // badge with the type to pick them by — without strength or ammunition, which aren't known there.
  for (const q of s.squads) {
    if (q.side !== 'blue' || q.dead) continue;
    const m = s.units.filter(u => u.squad === q.id), on = isSel(q.id);
    if (sqShown(q)) {
      if (!m.length) continue;
      // (over the squad's main body: units far from its middle — off to a medic, on the way out of the base — don't pull it away)
      const mid = (a, f) => a.map(f).sort((p, r) => p - r)[a.length >> 1], mx = mid(m, u => u.x), my = mid(m, u => u.y);
      let body = m.filter(u => Math.hypot(u.x - mx, u.y - my) < BAR_BODY_R); if (!body.length) body = m;
      let top = Infinity, cx = 0; for (const u of body) { top = Math.min(top, u.y - SIZE[u.type]); cx += u.x; } cx /= body.length;
      const y = top - 12, bars = [];
      // (no bars over the squad: each unit shows its own health, see healthDot)
      // why it's heading back: 🩹 to heal, 📦 for ammunition, ⟳ aircraft rearming
      const why = [q.retreating && '🩹', m.some(u => u.rearm) && '⟳'].filter(Boolean);
      c.font = '14px sans-serif'; why.forEach((w, i) => c.fillText(w, cx + (i - (why.length - 1) / 2) * 16, y - 6));
      // a seasoned commander, while his squad is picked: ⭐ / ⭐⭐ (and 🤫 when silent)
      const rk = Sim.rankOf(q), tag = (rk ? '⭐'.repeat(rk) : '') + (q.silent ? '🤫' : '');
      if (on && sel !== 'all' && tag) { c.font = '11px sans-serif'; c.fillText(tag, cx, y - (why.length ? 22 : 5)); }
      continue;
    }
    drawGuess(c, q, guessAt(q), on);
  }
  drawPicked(c); drawPings(c);
  drawVignette(c);
}
// a squad's units are drawn as they are with no command friction, or while all of them are in the exact picture
// (else only its symbol, see drawGuess)
const sqShown = q => !Sim.friction(s) || s.units.every(u => u.squad !== q.id || shownAt(u));
// where a squad out of the exact picture probably is by now: its last report, carried on toward its order at its
// speed for the time since (so it's off from the truth as much as the report and the guess are); eased on screen
const guess = new Map();
function guessAt(q) {
  const r = pos(q);
  if (!r || !Sim.friction(s) || q.side !== 'blue') return r;
  const o = q.retreating ? Sim.homeOf(s, q) : Sim.effOrder(s, q), T = Sim.TYPES[q.type];
  const dx = o.x - r.x, dy = o.y - r.y, d = Math.hypot(dx, dy), go = d > 1 ? Math.min(d, T.speed * 0.8 * Math.max(0, s.t - r.t)) : 0;
  const want = { x: r.x + (d > 1 ? dx / d * go : 0), y: r.y + (d > 1 ? dy / d * go : 0) };
  let g = guess.get(q.id); const now = performance.now();
  if (!g || g.s !== s || Math.hypot(g.x - want.x, g.y - want.y) > 250) g = { x: want.x, y: want.y, at: now, s };
  const k = Math.min(1, (now - g.at) / 1000 * 2.5); g.at = now;
  g.mx = want.x - g.x; g.my = want.y - g.y; g.x += g.mx * k; g.y += g.my * k; g.moving = go > 2 && go < d - 2; g.hd = d > 1 ? Math.atan2(dy, dx) : (q.face ?? 0);
  guess.set(q.id, g);
  return { x: g.x, y: g.y, strength: r.strength, t: r.t, prev: r.prev, moving: g.moving, hd: g.hd };
}
// a squad not wholly in the exact picture: only its symbol, faint (like a sighting of the enemy), where it probably is
function drawGuess(c, q, p, on) {
  c.globalAlpha = SYMBOL_A; c.fillStyle = hexA(colors.blue, 0.6); ring(p.x, p.y, SYMBOL_R); c.fill();
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
  glyph(c, q.type, p.x, p.y, q.type === 'air' ? 7 : 5, '#fff', null, 0, q.type === 'aa' ? -Math.PI / 2 : 0);
  if (on) { c.globalAlpha = 0.7; c.strokeStyle = colors.halo; c.lineWidth = 1.2; ring(p.x, p.y, SYMBOL_R + 3); c.stroke(); }
  c.globalAlpha = 1;
}
const SYMBOL_R = 9, SYMBOL_A = 0.5;

// minimap (shown when the map doesn't fit on screen): terrain, our squads and structures, what we know of the
// enemy, fresh reports, and the part on screen. Tap / drag it to look there.
const MINI_W = 360;
function drawMini() {
  const m = $('mini'), vr = viewRect(), all = !vr || (vr.w >= s.W - 1 && vr.h >= s.H - 1);
  m.hidden = all || !$('intro').hidden || !$('end').hidden;
  if (m.hidden) return;
  const w = MINI_W, h = Math.round(w * s.H / s.W), k = w / s.W;
  if (m.width !== w || m.height !== h) { m.width = w; m.height = h; m.style.setProperty('--ar', (s.W / s.H).toFixed(3)); }
  const c = m.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = colors.ground; c.fillRect(0, 0, s.W, s.H);
  c.fillStyle = hexA(colors.tree, 0.35); for (const hl of s.hills) { c.beginPath(); c.ellipse(hl.x, hl.y, hl.r, hl.r * hl.e, hl.a, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = colors.water; for (const l of s.lakes) { c.beginPath(); c.ellipse(l.x, l.y, l.rx, l.ry, l.a, 0, Math.PI * 2); c.fill(); }
  if (s.fog) { c.fillStyle = hexA(colors.blue, 0.12); for (const n of s.nodes) if (n.side === 'blue' && Sim.nodeSpec(n.kind) && s.t >= n.ready) { c.beginPath(); c.arc(n.x, n.y, Sim.nodeSpec(n.kind).r0, 0, Math.PI * 2); c.fill(); } }
  const dot = (x, y, r, col, sq) => { c.fillStyle = col; c.beginPath(); if (sq) c.rect(x - r, y - r, 2 * r, 2 * r); else c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  for (const n of s.nodes) if (nodeShown(n)) { if (n.kind === 'drone') { c.globalAlpha = 0.35; dot(n.x, n.y, 7, colors[n.side]); c.globalAlpha = 1; } else dot(n.x, n.y, 14, colors[n.side], true); }
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { c.globalAlpha = 0.5; const n = s.memNodes.blue[id]; dot(n.x, n.y, 14, colors.red, true); c.globalAlpha = 1; }
  for (const q of s.squads) {
    if (q.dead) continue;
    if (q.side === 'blue') { const p = guessAt(q); if (p) dot(p.x, p.y, 20, colors.blue); continue; }
    const e = s.fog ? s.mem.blue[q.id] : { x: q.cx, y: q.cy, t: s.t };
    if (e && s.t - e.t < 40) { c.globalAlpha = 1 - (s.t - e.t) / 40; dot(e.x, e.y, 20, colors.red); c.globalAlpha = 1; }
  }
  for (const f of s.marks) { c.strokeStyle = f.kind === 'lost' || f.kind === 'ff' || f.kind === 'nodeLost' ? colors.red : colors.ink; c.lineWidth = 10; c.beginPath(); c.arc(f.x, f.y, 40 + 30 * (s.t - f.t), 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = colors.ink; c.lineWidth = 2 / k; c.strokeRect(vr.x, vr.y, vr.w, vr.h);
}

// the selection rectangle while it's being drawn (screen pixels)
function drawBox() {
  if (faceDrag && fit) {
    const f = faceDrag, c = ctx, a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0), L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
    c.save(); c.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0); c.strokeStyle = colors.blue; c.fillStyle = colors.blue; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(f.x0, f.y0, 6, 0, Math.PI * 2); c.fill();
    if (L > 10) {
      c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x1, f.y1); c.stroke();
      c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x1 - Math.cos(a - 0.45) * 14, f.y1 - Math.sin(a - 0.45) * 14); c.lineTo(f.x1 - Math.cos(a + 0.45) * 14, f.y1 - Math.sin(a + 0.45) * 14); c.closePath(); c.fill();
      // the front: a line across the arrow at its start
      c.globalAlpha = 0.6; c.beginPath(); c.moveTo(f.x0 - Math.sin(a) * 40, f.y0 + Math.cos(a) * 40); c.lineTo(f.x0 + Math.sin(a) * 40, f.y0 - Math.cos(a) * 40); c.stroke();
    }
    c.restore();
  }
  if (!boxSel || !fit) return;
  const b = boxSel, c = ctx; c.save(); c.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
  c.fillStyle = hexA(colors.blue, 0.12); c.strokeStyle = colors.blue; c.lineWidth = 1.5; c.setLineDash([5, 4]);
  c.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  c.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  c.restore();
}
