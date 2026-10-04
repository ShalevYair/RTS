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
  // (no dirt roads any more — roads are the bulldozers' now, roads.js; made and dropped, so the rest of the map's dice
  // fall as before)
  const roads = (makeRoads(s, r), []), fields = [];
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
  const items = [], hash = (x, y) => Math.abs(Math.round(x * 7.1 + y * 13.7)), TREE_K = [2 / WORLD_K, 4 / WORLD_K];
  const addTree = (x, y, R) => {
    // (the picture 2–4× the drawn crown, by where it stands: trees in proportion to the vehicles)
    const k = bucket(); items.push({ t: 'tree', x, y, s: R * 2.7 * (TREE_K[0] + (hash(x, y) % 97) / 96 * (TREE_K[1] - TREE_K[0])), v: hash(x, y) });
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
    const k = bucket(), m = 2 + Math.floor(r() * 2); items.push({ t: 'bush', x, y, s: (4 + m * 0.9) / WORLD_K, v: hash(x, y) });
    for (let j = 0; j < m; j++) { const R = 1.3 + r() * 1.7, px = x + (r() - 0.5) * 5, py = y + (r() - 0.5) * 4; bush[k].moveTo(px + R, py); bush[k].arc(px, py, R, 0, Math.PI * 2); }
  }
  // stones and boulders: a few on the plain, many more up the hills (the higher, the rockier)
  const addRock = (x, y, R) => {
    const k = bucket(), w = [[0.2, 2, r() * 7], [0.12, 3, r() * 7]]; items.push({ t: 'rock', x, y, s: R * 2.5 / WORLD_K, v: hash(x, y), hi: Sim.elevAt(s, { x, y }) > 3 });
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
// a helicopter's main rotor: a faint disc and two blades turning fast
function drawRotor(c, x, y, k, col) {
  const a = reduceMotion ? 0.6 : performance.now() / 45, r = k * 0.82, a0 = c.globalAlpha;
  c.save(); c.translate(x, y); c.globalAlpha = a0 * 0.18; c.fillStyle = '#ddd'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.globalAlpha = a0 * 0.7; c.strokeStyle = col; c.lineWidth = Math.max(1, k * 0.06); c.lineCap = 'round';
  c.beginPath(); for (const b of [a, a + Math.PI / 2]) { c.moveTo(-Math.cos(b) * r, -Math.sin(b) * r); c.lineTo(Math.cos(b) * r, Math.sin(b) * r); } c.stroke(); c.restore();
}
function glyph(c, type, x, y, k, fill, outline, hd = 0, aim = hd, lw = 1.2, step = 0) {
  if (type === 'commando') return glyph(c, 'inf', x, y, k, shade(fill, -0.35), outline, hd, aim, lw, step); // (a commando: a soldier, darker)
  const sw = Math.sin(step) * 0.26 * k, bob = step ? Math.abs(Math.sin(step)) * 0.12 * k : 0;
  c.save(); c.translate(x, y - bob); c.lineJoin = 'round'; c.lineCap = 'round';
  const paint = () => { if (outline) { c.lineWidth = lw; c.strokeStyle = outline; c.stroke(); } c.fillStyle = fill; c.fill(); };
  const barrel = (x1, y1, x2, y2, w) => {
    if (outline) { c.strokeStyle = outline; c.lineWidth = w + lw * 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    c.strokeStyle = fill; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  if (type === 'air' || type === 'tanker') { c.rotate(hd); c.beginPath(); poly(c, PLANE, k); paint(); }
  else if (type === 'lift') {
    // a transport helicopter from above: a long body and two big rotors, front and back
    c.rotate(hd); c.beginPath(); c.roundRect ? c.roundRect(-k * 0.85, -k * 0.24, k * 1.7, k * 0.48, k * 0.22) : c.rect(-k * 0.85, -k * 0.24, k * 1.7, k * 0.48); paint();
    c.rotate(-hd);
    for (const f of [0.55, -0.55]) drawRotor(c, Math.cos(hd) * k * f, Math.sin(hd) * k * f, k * 0.75, outline || fill);
  }
  else if (type === 'heli' || type === 'gunship') {
    // a helicopter from above: the cabin, the tail boom with its small rotor, stub wings (missiles) or a gun, and the
    // big rotor turning over it all (drawRotor)
    c.rotate(hd); c.beginPath(); c.ellipse(k * 0.12, 0, k * 0.46, k * 0.27, 0, 0, Math.PI * 2); paint();
    c.beginPath(); c.rect(-k * 0.95, -k * 0.06, k * 0.7, k * 0.12); paint();
    c.beginPath(); c.rect(-k * 1.0, -k * 0.2, k * 0.1, k * 0.4); paint();
    if (type === 'heli') { c.beginPath(); c.rect(0, -k * 0.46, k * 0.12, k * 0.92); paint(); }
    else { c.beginPath(); c.rect(k * 0.45, -k * 0.04, k * 0.3, k * 0.08); paint(); }
    c.rotate(-hd); drawRotor(c, k * 0.12 * Math.cos(hd), k * 0.12 * Math.sin(hd), k, outline || fill);
  }
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
  } else if (type === 'ssm' || type === 'arrow' || type === 'dome') {
    // a missile truck: the cab in front, a launcher on the back — one long missile, two (Arrow), a box of tubes (Dome)
    c.rotate(hd); c.beginPath(); c.rect(-0.85 * k, -0.42 * k, 1.7 * k, 0.84 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0.5 * k, -0.38 * k, 0.35 * k, 0.76 * k);
    c.fillStyle = outline ? '#e8e2d0' : fill;
    if (type === 'ssm') c.fillRect(-0.8 * k, -0.11 * k, 1.25 * k, 0.22 * k);
    else if (type === 'arrow') { c.fillRect(-0.75 * k, -0.3 * k, 1.1 * k, 0.16 * k); c.fillRect(-0.75 * k, 0.14 * k, 1.1 * k, 0.16 * k); }
    else for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(-0.55 * k + i * 0.32 * k, -0.15 * k + j * 0.3 * k, 0.11 * k, 0, Math.PI * 2); c.fill(); }
  } else if (type === 'truck' || type === 'fueltruck' || type === 'watertruck') {
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
// a hill's colour at height e (a map anyone reads: green low, browner and lighter going up, light rock at the top):
// the grass, then olive by the middle lines, then the light hilltop colour
function hillRGB(e) {
  const low = rgbOf(colors.grass2), mid = lerp3(low, rgbOf(colors.hill), 0.55), top = rgbOf(colors.hillHi);
  return e < HYPSO_MID ? lerp3(low, mid, e / HYPSO_MID) : lerp3(mid, top, Math.min(1, (e - HYPSO_MID) / (HILL_TOP - HYPSO_MID)) * 0.8);
}
const HYPSO_MID = 4, HILL_TOP = 10;
function landRGB(e) {
  const grass = lerp3(rgbOf(colors.ground), rgbOf(colors.grass2), 0.5);
  if (e <= 0) return grass;
  return lerp3(grass, hillRGB(e), Math.min(1, e / 1.2) * 0.92);
}
// the hills' colour by height (the tint; the light and shade come separately, over the textures: hillShade)
function relief(E) {
  const cv2 = document.createElement('canvas'); cv2.width = E.w; cv2.height = E.h;
  const c = cv2.getContext('2d'), img = c.createImageData(E.w, E.h), d = img.data, g = E.g;
  for (let k = 0; k < g.length; k++) {
    const e = g[k]; if (e <= 0) continue;
    const m = hillRGB(e), o = k * 4;
    d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2]; d[o + 3] = 255 * Math.min(1, e / 1.2) * 0.92;
  }
  c.putImageData(img, 0, 0); return cv2;
}
// light and shade on the hills, so high and low read at a glance: each slope lit by the sun from the north-west (the
// side facing it brighter, the far side darker), and the shadow each hill throws to the south-east. Two layers — a
// dark one and a light one — from the height grid, worked out once per map. SHADE_Z: how tall a contour line is
// (world units; more = steeper, stronger shading); SUN_UP: how high the sun stands (its shadows' slope).
const SHADE_Z = 14, SUN_UP = 0.42, SHADE_DARK = 0.44, SHADE_LITE = 0.3, CAST_DARK = 0.24;
// (as a job: a few rows at a time, so a new sun's shading is worked out over some frames — on the huge map it takes
// ~100 ms — while the last one still shows; hillShade does it all at once)
// every frame: when the sun has moved on, the hills' new shading a few rows at a time (at most SHADE_MS a frame);
// done, it takes over (and the ground is drawn again)
const SHADE_MS = 5;
function sunShadeTick() {
  const R = decor && decor.hills; if (!R || !R.shade || R.shadeOf !== s.elev) return;
  // (the same minute of the day, the same shading: each is worked out once a map, SHADES kept)
  if (!R.job && R.sunKey !== SUN.hill) {
    R.done = R.done || {}; const had = R.done[SUN.hill];
    if (had) { R.shade = had; R.sunKey = SUN.hill; return; }
    R.job = hillShadeJob(s.elev, SUN); R.jobKey = SUN.hill;
  }
  if (!R.job) return;
  const t0 = performance.now(); let r;
  while (!(r = R.job.next()).done) if (performance.now() - t0 > SHADE_MS) return;
  R.shade = r.value; R.sunKey = R.jobKey; R.done[R.jobKey] = r.value; R.job = null;
}
function hillShade(E, sun = SUN) { const j = hillShadeJob(E, sun); let r; while (!(r = j.next()).done); return r.value; }
function* hillShadeJob(E, sun) {
  const W = E.w, H = E.h, g = E.g, dark = document.createElement('canvas'), lite = document.createElement('canvas');
  dark.width = lite.width = W; dark.height = lite.height = H;
  const dc = dark.getContext('2d'), lc = lite.getContext('2d'), di = dc.createImageData(W, H), li = lc.createImageData(W, H);
  const at = (i, j) => g[Math.max(0, Math.min(H - 1, j)) * W + Math.max(0, Math.min(W - 1, i))];
  // (toward the sun: north-west at noon; lower in the morning and evening — longer shadows)
  const hz = Math.hypot(sun.lx, sun.ly) || 1, L = [sun.lx / hz * Math.SQRT2, sun.ly / hz * Math.SQRT2, 1.4 * sun.up], Ln = Math.hypot(...L), l = L.map(v => v / Ln), flat = l[2];
  // (the sun's way across the grid, back toward it: a step of the longer side per cell)
  const m = Math.max(Math.abs(sun.lx), Math.abs(sun.ly)) || 1, sx = sun.lx / m, sy = sun.ly / m;
  const step = Math.hypot(sx, sy) * ELEV, rise = SUN_UP * sun.up * step / SHADE_Z; // (how many lines the ray climbs per step)
  for (let j = 0; j < H; j++) { if (j % 12 === 11) yield; for (let i = 0; i < W; i++) {
    const k = j * W + i, e = g[k];
    // the slope, over two cells each way (smoother than next-door cells)
    const dx = (at(i + 2, j) - at(i - 2, j)) * SHADE_Z / (4 * ELEV), dy = (at(i, j + 2) - at(i, j - 2)) * SHADE_Z / (4 * ELEV);
    const n = Math.hypot(dx, dy, 1), lit = (-dx * l[0] - dy * l[1] + l[2]) / n - flat;
    let sh = lit < 0 ? Math.min(1, -lit * 1.6) * SHADE_DARK : 0, hi = lit > 0 ? Math.min(1, lit * 2.2) * SHADE_LITE : 0;
    // cast shadow: something higher between here and the sun
    let h = e, cast = 0;
    for (let s2 = 1; s2 < 60; s2++) {
      h += rise; const t = at(Math.round(i + sx * s2), Math.round(j + sy * s2)); if (t > h) { cast = Math.min(1, (t - h) * 0.9); break; }
      if (h > HILL_TOP) break;
    }
    sh = Math.min(0.7, sh + cast * CAST_DARK); if (cast) hi *= 0.3;
    di.data[k * 4 + 3] = 255 * sh; li.data[k * 4 + 3] = 255 * hi;
    di.data[k * 4] = 14; di.data[k * 4 + 1] = 20; di.data[k * 4 + 2] = 34; // (a cool dark)
    li.data[k * 4] = 255; li.data[k * 4 + 1] = 244; li.data[k * 4 + 2] = 210; // (a warm light)
  } }
  dc.putImageData(di, 0, 0); lc.putImageData(li, 0, 0);
  return { dark, lite };
}
// contour lines at 1, 2, … lines high, traced over the height grid (marching squares); a path per height in each
// square of CONT_CELL (a tile strokes only the squares over it: the whole map's paths cost the most of a tile)
const CONT_CELL = 256;
function contours(E) {
  const out = { cells: new Map(), n: 0 }, g = E.g;
  let top = 0; for (const v of g) if (v > top) top = v;
  out.n = Math.floor(top);
  for (let L = 1; L <= out.n; L++) {
    const at = (x, y) => { const k = Math.floor(x / CONT_CELL) + ',' + Math.floor(y / CONT_CELL); let l = out.cells.get(k); if (!l) out.cells.set(k, l = []); return l[L - 1] || (l[L - 1] = new Path2D()); };
    for (let j = 0; j < E.h - 1; j++) for (let i = 0; i < E.w - 1; i++) {
      const k = j * E.w + i, a = g[k], b = g[k + 1], c = g[k + E.w + 1], d = g[k + E.w];
      const m = (a >= L) | (b >= L) << 1 | (c >= L) << 2 | (d >= L) << 3;
      if (m === 0 || m === 15) continue;
      const x = i * ELEV, y = j * ELEV, f = (u, v) => (L - u) / (v - u) * ELEV;
      const top_ = [x + f(a, b), y], right = [x + ELEV, y + f(b, c)], bot = [x + f(d, c), y + ELEV], left = [x, y + f(a, d)];
      const p = at(x, y), seg = (P, Q) => { p.moveTo(P[0], P[1]); p.lineTo(Q[0], Q[1]); };
      switch (m) {
        case 1: case 14: seg(left, top_); break; case 2: case 13: seg(top_, right); break;
        case 3: case 12: seg(left, right); break; case 4: case 11: seg(right, bot); break;
        case 6: case 9: seg(top_, bot); break; case 7: case 8: seg(left, bot); break;
        case 5: seg(left, top_); seg(right, bot); break; case 10: seg(top_, right); seg(left, bot); break;
      }
    }
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
// the ground: painted into tiles of BG_TILE canvas pixels at the current zoom, each when it first comes near the
// screen or goes out of date (the sun's next minute, the theme, a tree run over) — a few a frame (BG_MS), the old
// picture shown until then (stretched, after a zoom). It used to be one picture of the screen and a margin, painted
// whole again at every pan past the margin, every zoom step and twice a second while tanks crushed trees: 100–170ms
// each, the game stuttered.
const bg = { key: '', of: null, sc: 0, tw: 0, tiles: new Map(), old: [], x0: 0, y0: 0, w: 0, h: 0, cv: document.createElement('canvas') };
const BG_TILE = 384, BG_MS = 5, BG_MS_BLANK = 9, BG_KEEP = 70, BG_STILL = 250;
bg.cv.width = bg.cv.height = BG_TILE;
function bgPaint(t, quick) {
  bg.quick = !!quick; t.rough = !!quick; // (quick: while the camera moves — see drawGround)
  // (straight into the tile's own canvas: painted on one and copied, each copy waited for all the painting)
  if (!t.cv) { t.cv = document.createElement('canvas'); t.cv.width = t.cv.height = BG_TILE; }
  const sc = bg.sc, g = t.cv.getContext('2d');
  bg.x0 = t.x0; bg.y0 = t.y0; bg.w = bg.h = bg.tw; // (what's in this tile: drawScenery draws only that)
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = colors.ground; g.fillRect(0, 0, BG_TILE, BG_TILE);
  g.setTransform(sc, 0, 0, sc, -t.x0 * sc, -t.y0 * sc);
  const grass = tilePat(g, 'grass1');
  if (grass) { g.fillStyle = grass; g.fillRect(t.x0, t.y0, bg.tw, bg.tw); g.globalAlpha = GROUND_TINT; g.fillStyle = colors.ground; g.fillRect(t.x0, t.y0, bg.tw, bg.tw); g.globalAlpha = 1; }
  // (off the map: the grass only)
  if (t.x0 < s.W && t.x0 + bg.tw > 0 && t.y0 < s.H && t.y0 + bg.tw > 0) drawTerrain(g, s.W, s.H, s.W / 2);
  t.stale = false;
}
// a picture on the height grid (a pixel a cell: the relief, the shading, the stony mask), only the part over the tile
// being painted (the whole of it, stretched, cost several ms a tile)
function drawGridPic(c, L) {
  const sx = Math.max(0, Math.floor((bg.x0 + ELEV / 2) / ELEV) - 1), sy = Math.max(0, Math.floor((bg.y0 + ELEV / 2) / ELEV) - 1);
  const ex = Math.min(L.width, Math.ceil((bg.x0 + bg.w + ELEV / 2) / ELEV) + 1), ey = Math.min(L.height, Math.ceil((bg.y0 + bg.h + ELEV / 2) / ELEV) + 1);
  if (ex > sx && ey > sy) c.drawImage(L, sx, sy, ex - sx, ey - sy, sx * ELEV - ELEV / 2, sy * ELEV - ELEV / 2, (ex - sx) * ELEV, (ey - sy) * ELEV);
}
// the tiles over (x, y, r) are painted again (a tree cleared or run over)
function bgDirty(x, y, r) {
  const tw = bg.tw; if (!tw) return;
  for (let i = Math.floor((x - r) / tw); i <= Math.floor((x + r) / tw); i++) for (let j = Math.floor((y - r) / tw); j <= Math.floor((y + r) / tw); j++) {
    const t = bg.tiles.get(i + ',' + j); if (t) t.stale = true;
  }
}
// tiles let go: their canvases emptied now (each held its pixels — on the graphics card too — until collected)
function bgFree(l) { for (const t of l) if (t.cv) { t.cv.width = 0; t.cv = null; } }
function drawGround(c) {
  sunTick(); sunShadeTick(); groundTick(); // (groundTick: woods cut — their tiles painted again) // (the sun turns a minute at a time: the ground, its hills' and trees' shadows, drawn again then)
  const sc = view.scale, vx0 = -view.ox / sc, vy0 = -view.oy / sc, vw = cv.width / sc, vh = cv.height / sc;
  // (the tiles are painted at the zoom rounded up to a step of √2 and drawn a little smaller: a wheel notch inside the
  // step paints nothing again)
  // (the low graphics: at half that — a quarter of the pixels to paint and keep)
  const L = Math.pow(2, Math.ceil(Math.log2(sc) * 2 - 1e-6) / 2) * (gfxLow ? 0.5 : 1);
  // (a new map: nothing of the old one; another step: the tiles there are stay, stretched, under the new ones until
  // those are painted; the theme, the sun, a picture loaded: each tile painted again in its turn)
  if (bg.of !== decor) { bg.of = decor; bg.tiles.clear(); bg.old = []; bg.sc = 0; }
  if (L !== bg.sc) {
    const all = bg.old.concat([...bg.tiles.values()].filter(t => t.cv)); bg.old = all.slice(-BG_KEEP); bgFree(all.slice(0, -BG_KEEP));
    bg.tiles = new Map(); bg.sc = L; bg.tw = BG_TILE / L;
  }
  const key = [colors.ground, colors.hill, colors.tree, decor.hills.sunKey, gfxLow].join();
  if (key !== bg.key) { bg.key = key; for (const t of bg.tiles.values()) t.stale = true; }
  const tw = bg.tw, i0 = Math.floor(vx0 / tw), i1 = Math.floor((vx0 + vw) / tw), j0 = Math.floor(vy0 / tw), j1 = Math.floor((vy0 + vh) / tw);
  const get = (i, j) => { const k = i + ',' + j; let t = bg.tiles.get(k); if (!t) bg.tiles.set(k, t = { i, j, x0: i * tw, y0: j * tw, tw, cv: null, stale: true }); return t; };
  // what to paint, the middle of the screen first; then a ring around it on the map, ready for a pan
  const cx = (i0 + i1) / 2, cy = (j0 + j1) / 2, near = (a, b) => Math.hypot(a.i - cx, a.j - cy) - Math.hypot(b.i - cx, b.j - cy);
  const onMap = (i, j) => (i + 1) * tw > 0 && i * tw < s.W && (j + 1) * tw > 0 && j * tw < s.H;
  const shown = [], ring = [];
  for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) {
    if (i < i0 || i > i1 || j < j0 || j > j1) { if (onMap(i, j)) ring.push(get(i, j)); } else shown.push(get(i, j));
  }
  const covered = t => bg.old.some(o => o.x0 < t.x0 + tw && o.y0 < t.y0 + tw && o.x0 + o.tw > t.x0 && o.y0 + o.tw > t.y0);
  const t0 = performance.now(); let n = 0;
  // (the camera moving — a pan, a zoom: new tiles quick and rough, the ground, its colours and shading only; painted
  // whole once it has stood BG_STILL ms. Every tile whole while panning was the slow part of it)
  const ck = view.ox + ',' + view.oy + ',' + sc, now = performance.now();
  if (ck !== bg.cam) { bg.cam = ck; bg.movedAt = now; }
  const moving = now - (bg.movedAt || 0) < BG_STILL;
  const redo = t => t.stale || (!moving && t.rough);
  const todo = [...shown.filter(t => !t.cv).sort(near), ...shown.filter(t => t.cv && redo(t)).sort(near), ...ring.filter(t => !moving && redo(t)).sort(near)];
  // (all while the frame has time — BG_MS, a little more with blanks on screen —, one at least. A blank with nothing
  // under it used to be painted at once, every one: after a zoom out that was up to 30 tiles in a frame, 50–110ms
  // stalls at every wheel notch (the player's log). Now it's plain grass for the few frames until its turn)
  const blanks = shown.filter(t => !t.cv && !covered(t)), budget = blanks.length ? BG_MS_BLANK : BG_MS;
  for (const t of todo) {
    if ((n > 0 || !shown.includes(t)) && performance.now() - t0 > budget) continue;
    bgPaint(t, moving && !t.cv ? true : moving && t.rough); n++;
  }
  const grass = null; // (a flat colour: a pattern over them every frame cost more than it saved)
  for (const t of blanks) if (!t.cv) { c.fillStyle = grass || colors.ground; c.fillRect(t.x0, t.y0, tw, tw); }
  // (the old tiles under, until every tile on screen is the new one)
  if (shown.every(t => t.cv) && bg.old.length) { bgFree(bg.old); bg.old = []; }
  for (const o of bg.old) if (o.x0 < vx0 + vw && o.x0 + o.tw > vx0 && o.y0 < vy0 + vh && o.y0 + o.tw > vy0) c.drawImage(o.cv, o.x0, o.y0, o.tw, o.tw);
  // (edge to edge at whole canvas pixels: no seams between them)
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const X = i => Math.round(view.ox + i * tw * sc), Y = j => Math.round(view.oy + j * tw * sc);
  for (const t of shown) if (t.cv) { const x = X(t.i), y = Y(t.j); c.drawImage(t.cv, x, y, X(t.i + 1) - x, Y(t.j + 1) - y); }
  c.restore();
  // (far-off tiles let go)
  if (bg.tiles.size > BG_KEEP) {
    const far = [...bg.tiles.values()].sort((a, b) => near(b, a));
    for (const t of far.slice(0, bg.tiles.size - BG_KEEP)) { bg.tiles.delete(t.i + ',' + t.j); bgFree([t]); }
  }
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
  if (!bg.quick && !gfxLow) for (const f of decor.fields) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = shade(colors.field, f.t); c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    c.strokeStyle = shade(colors.field2, f.t); c.lineWidth = 3;
    for (let x = -f.w / 2 + 4; x < f.w / 2; x += f.gap) { c.beginPath(); c.moveTo(x, -f.h / 2); c.lineTo(x, f.h / 2); c.stroke(); }
    c.restore();
  }
  // lakes: shallow rim, water, a darker middle, a glint
  for (const k of decor.lakes) {
    const mud = tilePat(c, 'mud'); c.fillStyle = mud || shade(colors.waterEdge, 0.35 + k.t); c.globalAlpha = mud ? 0.45 : 0.6; c.fill(k.edge); c.globalAlpha = 1;
    // (with the water texture: it, a touch of the theme's water colour over it)
    const wat = tilePat(c, 'water');
    if (wat) { c.fillStyle = wat; c.fill(k.body); c.globalAlpha = 0.12; c.fillStyle = shade(colors.water, k.t); c.fill(k.body); c.globalAlpha = 1; }
    else { c.fillStyle = shade(colors.water, k.t); c.fill(k.body); }
    c.lineWidth = 2; c.strokeStyle = shade(colors.waterEdge, k.t); c.stroke(k.body);
    // (the deep middle: lighter over the flat colour, darker over the photo of water)
    if (wat) { c.fillStyle = 'rgb(4,22,32)'; c.globalAlpha = 0.28; } else { c.fillStyle = shade(colors.waterEdge, -0.1 + k.t); c.globalAlpha = 0.45; }
    c.fill(k.deep); c.globalAlpha = 1;
    const l = k.l; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(l.x - l.rx * 0.25, l.y - l.ry * 0.3, l.rx * 0.3, l.ry * 0.25, l.a, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  }
  // hills: the relief (colour by height, lit from the north-west) blends into the grass; then the contour lines,
  // every fifth a little stronger
  const R = decor.hills, key = colors.tree + colors.ground + colors.grass2;
  if (R.theme !== key) { R.relief = relief(s.elev); R.theme = key; }
  // (a new map: its shading now; a new sun: worked out over the next frames, see sunShadeTick)
  if (R.shadeOf !== s.elev) { R.shade = hillShade(s.elev); R.shadeOf = s.elev; R.sunKey = SUN.hill; R.job = null; R.done = { [SUN.hill]: R.shade }; }
  const rocky = tilePat(c, 'rocky');
  if (rocky) c.globalAlpha = RELIEF_OVER_TILES;
  drawGridPic(c, R.relief);
  c.globalAlpha = 1;
  if (rocky && !bg.quick && !gfxLow) drawStony(c, rocky);
  // (the light and shade over it all, the textures too)
  c.imageSmoothingEnabled = true;
  // (in the dark: no light, and the shade only faintly)
  if (!gfxLow) [R.shade.dark, R.shade.lite].forEach((L, k) => { c.globalAlpha = k ? SUN.a : 0.35 + 0.65 * SUN.a; drawGridPic(c, L); });
  c.globalAlpha = 1;
  drawGroundSoft(c); // (mud, cut lanes, the woods' floor: ground.js)
  if (bg.quick) return; // (quick: the rest when the camera stands)
  c.strokeStyle = shade(colors.tree, -0.35); c.lineCap = 'round';
  // (far out the thin ones are under a pixel: left out — the whole map's lines cost the most of a tile there)
  const thin = c.getTransform().a >= 0.7;
  const C = R.contours, ci0 = Math.floor((bg.x0 - ELEV) / CONT_CELL), ci1 = Math.floor((bg.x0 + bg.w + ELEV) / CONT_CELL), cj0 = Math.floor((bg.y0 - ELEV) / CONT_CELL), cj1 = Math.floor((bg.y0 + bg.h + ELEV) / CONT_CELL);
  if (!gfxLow) for (let k = 0; k < C.n; k++) {
    if (!thin && (k + 1) % 5) continue;
    c.globalAlpha = (k + 1) % 5 ? 0.13 : 0.26; c.lineWidth = (k + 1) % 5 ? 0.9 : 1.4;
    for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) { const l = C.cells.get(i + ',' + j), p = l && l[k]; if (p) c.stroke(p); }
  }
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
  drawGroundHard(c); // (the dense woods' trees, the cliffs: ground.js)
  // woods, bushes and stones: the pictures (art/Background) when they're in, else a few fills (each shade one path)
  if (drawScenery(c)) { if (!gfxLow) drawGrade(c, W, H); return; }
  const T = decor.trees, Rk = decor.rocks, nb = T.treeBody.length;
  c.fillStyle = colors.shadow; c.fill(T.treeShadow); c.fill(Rk.rockShadow);
  for (let k = 0; k < nb; k++) { const u = -0.14 + 0.26 * k / (nb - 1); c.fillStyle = shade(mix(colors.tree, colors.grass2, 0.45), u); c.fill(T.bush[k]); }
  for (let k = 0; k < nb; k++) { const u = -0.12 + 0.24 * k / (nb - 1); c.fillStyle = shade(colors.tree, u); c.fill(T.treeBody[k]); c.fillStyle = shade(colors.treeHi, u); c.fill(T.treeTop[k]); }
  for (let k = 0; k < nb; k++) { c.fillStyle = shade(colors.rock, -0.15 + 0.3 * k / (nb - 1)); c.fill(Rk.rock[k]); }
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fill(Rk.rockHi);
  drawGrade(c, W, H);
}

// drone: a quadcopter from above — four rotors on an X frame
const AMMO = '#e0b020', GLOW_K = 1.8, GLOW = { commando: 2.5, inf: 2.5, aa: 2.5, at: 2.5, med: 2.5 }; // (the vehicles, big now, need none)
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
const fogCv = document.createElement('canvas'), fctx = fogCv.getContext('2d'), FOG_RES = 0.5;
function drawFog() {
  const f = fctx;
  // (at FOG_RES of the canvas, scaled up: its edges are soft anyway, and a full-size layer every frame was slow)
  const fw = Math.ceil(cv.width * FOG_RES), fh = Math.ceil(cv.height * FOG_RES);
  if (fogCv.width !== fw || fogCv.height !== fh) { fogCv.width = fw; fogCv.height = fh; }
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, fogCv.width, fogCv.height);
  f.setTransform(view.scale * FOG_RES, 0, 0, view.scale * FOG_RES, view.ox * FOG_RES, view.oy * FOG_RES);
  f.fillStyle = colors.fog; f.fillRect(0, 0, s.W, s.H);
  f.globalCompositeOperation = 'destination-out'; f.fillStyle = '#000';
  const hole = (x, y, r) => {
    const g = f.createRadialGradient(x, y, r * 0.75, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
  };
  // our squads lift the fog around them only where they're drawn (not around a guess)
  // (as far as they see now: the dark, the weather, a held radar)
  for (const q of s.squads) if (q.side === 'blue' && !q.dead && sqShown(q)) hole(q.cx, q.cy, Sim.TYPES[q.type].sight * Sim.envSight(s, { side: 'blue', type: q.type, x: q.cx, y: q.cy }) + 30);
  const sk = Sim.skySight(s, 'blue');
  for (const n of s.nodes) if (n.side === 'blue' && s.t >= n.ready) hole(n.x, n.y, (n.kind === 'drone' ? Sim.DRONE_SIGHT + 15 : n.kind === 'fhq' ? Sim.NODES.fhq.sight : n.kind === 'hq' ? Sim.STRUCTS.hq.sight + 20 : 170) * sk);
  // (and our posts: an observation tower far)
  for (const p of s.posts || []) if (p.side === 'blue') hole(p.x, p.y, (p.kind === 'tower' ? Sim.TOWER_SIGHT : Sim.POST_SIGHT) * sk);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = s.fogAt ? Math.min(1, (s.t - s.fogAt) / 3) : 1; ctx.drawImage(fogCv, 0, 0, cv.width, cv.height); ctx.restore();
}

// enemy as blobs of uncertainty: tight when just seen, spreading and fading with the age of the sighting
const STALE = 12, TRAIL = 8, BLOB_LIFE = 40, BLOB_R = 25, BLOB_MAX = 150, UNSURE = 4;
const intelAt = new Map(); let intelT = 0; // (where each sighting is drawn: easing toward the latest fix)
function drawEnemyIntel(c) {
  const now = performance.now(), ease = 1 - Math.exp(-Math.min(0.1, (now - intelT) / 1000) * 2.5); intelT = now; const vr = viewRect();
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
    if (vr && (m.x + r < vr.x || m.x - r > vr.x + vr.w || m.y + r < vr.y || m.y - r > vr.y + vr.h)) continue; // (off the screen)
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
// (and all that a drone or a signals truck of ours sees — as Sim.clearAt, with the eyes gathered once per tick)
const eyes = { s: null, t: -1, l: [] };
function clearEyes() {
  if (eyes.s === s && eyes.t === s.t) return eyes.l;
  eyes.s = s; eyes.t = s.t; eyes.l = [];
  const ds = Sim.DRONE_SIGHT * Sim.skySight(s, 'blue');
  for (const n of s.nodes) if (n.side === 'blue' && n.kind === 'drone' && n.hp > 0 && s.t >= n.ready) eyes.l.push({ x: n.x, y: n.y, r2: ds * ds });
  // (a signals truck, and a commando — he sees round him as a drone does: as far as the dark and the weather let them)
  for (const u of s.units) if (u.side === 'blue' && (u.type === 'radio' || u.type === 'commando')) { const r = Sim.TYPES[u.type].sight * Sim.envSight(s, u); eyes.l.push({ x: u.x, y: u.y, r2: r * r }); }
  return eyes.l;
}
const shownAt = p => !Sim.friction(s) || clearEyes().some(e => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= e.r2) || Sim.quality(s, 'blue', p) >= 1;
// control quality: a blue wash, deepest at full control and fading smoothly out to nothing (the rings of the rules
// blend into each other on the map). Worked out once on a grid (a point every QC units) and redone only when the
// nodes change.
// (worked out a few rows a frame, QUAL_MS, the old picture shown till then: the whole map at once, every time a
// building or a drone came or went, was 120–250ms)
const qual = { cv: document.createElement('canvas'), key: '', job: null }, QC = ELEV, QUAL_MS = 3;
function drawQuality(c) {
  const nodes = s.nodes.filter(n => n.side === 'blue' && Sim.nodeSpec(n.kind) && n.hp > 0 && s.t >= n.ready);
  const key = s.seed + ':' + s.W + ':' + nodes.map(n => n.id).join() + ':' + colors.blue;
  if (key !== qual.key) {
    const fresh = !qual.key.startsWith(s.seed + ':' + s.W + ':'); qual.key = key;
    const w = Math.ceil(s.W / QC) + 1, h = Math.ceil(s.H / QC) + 1;
    qual.job = { w, h, j: 0, img: new ImageData(w, h), rgb: rgbOf(colors.blue), now: fresh }; // (a new map: at once)
  }
  const J = qual.job;
  if (J) {
    const t0 = performance.now(), d = J.img.data, [r0, g0, b0] = J.rgb;
    while (J.j < J.h && (J.now || performance.now() - t0 < QUAL_MS)) {
      for (let i = 0, j = J.j; i < J.w; i++) {
        const k = j * J.w + i, v = Sim.quality(s, 'blue', { x: i * QC, y: j * QC }, false, true) - 0.15; // above the floor
        if (v <= 0) continue;
        d[k * 4] = r0; d[k * 4 + 1] = g0; d[k * 4 + 2] = b0; d[k * 4 + 3] = Math.round(255 * 0.24 * Math.pow(v / 0.85, 1.4));
      }
      J.j++;
    }
    if (J.j >= J.h) { const q = qual.cv; q.width = J.w; q.height = J.h; q.getContext('2d').putImageData(J.img, 0, 0); qual.job = null; }
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
const DRONE_PX = 30 / WORLD_K, STRUCT_PX = 40, pxOf = kind => Math.round((Sim.STRUCTS[kind].r || 16) * 2.4), HQ_PX = pxOf('hq');
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
  if (n.kind === 'drone' && sprite.img.drone) { // (the picture: up in the air, its shadow far off, turning slowly)
    const D = SPRITES.drone, sc = DRONE_PX / Math.max(D.w, D.h), rot = s.t * 0.35 + n.id;
    c.globalAlpha = ghost ? 0.3 : 0.9; drawShadowPic(c, 'drone', n.x, n.y, D.w * sc, D.h * sc, rot, DRONE_PX * 0.5);
    c.save(); c.translate(n.x, n.y); c.rotate(rot); c.drawImage(spritePic('drone', col), -D.w / 2 * sc, -D.h / 2 * sc, D.w * sc, D.h * sc); c.restore();
  } else if (n.kind === 'drone') { c.globalAlpha = ghost ? 0.2 : 0.32; drawDrone(c, n.x, n.y, 8, col, s.t * 0.35 + n.id, on ? s.t * 25 : 0); }
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
  // our HQ: the next bulldozer / signals truck coming out (the same bar, the shapes of what's coming beside it)
  const hn = on && n.kind === 'hq' && n.side === 'blue' && hqNext();
  if (hn) {
    const y = n.y - top - 2; c.fillStyle = colors.halo; c.globalAlpha = 0.8; c.fillRect(n.x - 15, y - 2, 30, 5); c.globalAlpha = 1;
    c.fillStyle = col; c.fillRect(n.x - 14, y - 1, 28 * hn.prog, 3);
    hn.types.forEach((t, i) => glyph(c, t, n.x - 21 - i * 12, y, Math.min(6, SIZE[t] * 0.55), col, colors.outline, 0, 0, 0.8));
  }
}
// what our HQ sends out next (open field: bulldozers and signals trucks, every SUPPORT_EVERY s, while under the cap):
// { types, prog 0–1, left s }, or null
function hqNext() {
  if (!s.dozers) return null;
  const types = ['dozer', 'radio'].filter(t => s.squads.filter(q => q.side === 'blue' && q.type === t && !q.dead).length < Sim.SUPPORT_CAP);
  if (!types.length) return null;
  const left = Math.max(0, (s.supNext && s.supNext.blue) ?? Sim.SUPPORT_EVERY);
  return { types, prog: Math.min(1, 1 - left / Sim.SUPPORT_EVERY), left };
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
  drawRoadPlans(c); // (roadui.js)
  if (!buildArmed) return;
  drawBuildZone(c);
  // (the building at the pointer, in its size: faint where it can't go)
  if (mouseAt) { const r = cv.getBoundingClientRect(), w = { x: (mouseAt.x - r.left - view.cox) / view.css, y: (mouseAt.y - r.top - view.coy) / view.css }; c.globalAlpha = Sim.buildCheck(s, 'blue', w.x, w.y, buildArmed) ? 0.25 : 0.7; drawBuilding(c, buildArmed, colors.blue, w.x, w.y, pxOf(buildArmed)); c.globalAlpha = 1; }
}
// where the armed building may go: a soft green wash. The screen's part of the map in BZ_CELLS cells across (finer
// than before: zoomed in on a phone, 20-unit squares were big blocks), one pixel each, drawn scaled up smoothly — soft
// edges, no squares. Worked out again only when the view, the buildings change, or BZ_EVERY s go by
const BZ_CELLS = 90, BZ_EVERY = 3, bz = { cv: document.createElement('canvas'), key: '' };
function drawBuildZone(c) {
  // (the whole canvas, not only viewRect: on a phone held upright the map shows above and below that part too)
  const cw = cv.width / (fit ? fit.dpr : 1), ch = cv.height / (fit ? fit.dpr : 1);
  const v = fit ? { x: -view.cox / view.css, y: -view.coy / view.css, w: cw / view.css, h: ch / view.css } : { x: 0, y: 0, w: s.W, h: s.H }, G = Math.max(6, Math.ceil(v.w / BZ_CELLS));
  const x0 = Math.max(0, Math.floor(v.x / G) - 1), y0 = Math.max(0, Math.floor(v.y / G) - 1);
  const x1 = Math.min(Math.ceil(s.W / G), Math.ceil((v.x + v.w) / G) + 1), y1 = Math.min(Math.ceil(s.H / G), Math.ceil((v.y + v.h) / G) + 1);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const key = [buildArmed, G, x0, y0, w, h, s.nodes.length, s.nodes.reduce((a, n) => a + (n.hp > 0) + (s.t >= n.ready), 0), Math.floor(s.t / BZ_EVERY)].join(); // (and every BZ_EVERY s: control moves with drones and signals trucks)
  if (key !== bz.key) {
    bz.key = key; bz.cv.width = w; bz.cv.height = h;
    const g = bz.cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!Sim.buildCheck(s, 'blue', (x0 + i + 0.5) * G, (y0 + j + 0.5) * G, buildArmed)) { const k = (j * w + i) * 4; d[k] = 80; d[k + 1] = 200; d[k + 2] = 90; d[k + 3] = 70; }
    g.putImageData(img, 0, 0);
  }
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(bz.cv, x0 * G, y0 * G, w * G, h * G); c.restore();
}
// event reports appear where they happened, pop in and fade out
// (not shown: arrived, roger, contact — the voice says them — nor the envelopes of orders on their way; nor 💥 / ✖ for a
// blast, a loss or a building down: the shells, missiles and blasts themselves are seen, and the message list says it)
const MARK = { missile: '🚀', promo: '⭐', unclear: '❓', flag: '🚩', flagLost: '🏳', call: '📞', fhq: '🏕️', ff: '⚠' };
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
const tracks = [], TRACK_T = 8, TRACK_MAX = 1500, TRACK_BANDS = 6;
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
  // (only those on the screen, and in TRACK_BANDS paths by how faded — one each, not a save / turn / restore for every
  // mark: with a big army this was the slowest thing drawn)
  const vr = viewRect(), paths = [];
  for (const p of tracks) {
    if (p.t > s.t || (vr && (p.x < vr.x - 20 || p.x > vr.x + vr.w + 20 || p.y < vr.y - 20 || p.y > vr.y + vr.h + 20))) continue;
    const b = Math.min(TRACK_BANDS - 1, Math.floor((s.t - p.t) / TRACK_T * TRACK_BANDS)), P = paths[b] || (paths[b] = new Path2D());
    const ca = Math.cos(p.a) * 2.5, sa = Math.sin(p.a) * 2.5, o = p.w * p.k, ox = -Math.sin(p.a) * o, oy = Math.cos(p.a) * o;
    P.moveTo(p.x + ox - ca, p.y + oy - sa); P.lineTo(p.x + ox + ca, p.y + oy + sa);
    P.moveTo(p.x - ox - ca, p.y - oy - sa); P.lineTo(p.x - ox + ca, p.y - oy + sa);
  }
  c.strokeStyle = colors.shadow; c.lineWidth = 2; c.lineCap = 'butt';
  paths.forEach((P, b) => { if (P) { c.globalAlpha = 0.6 * (1 - (b + 0.5) / TRACK_BANDS); c.stroke(P); } });
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
    // (a unit with a picture casts its own shadow, the picture's outline: drawUnitPic)
    if (hasSprite(u.type)) { /* its shadow comes with its picture */ }
    else if (T.air) { c.globalAlpha = 0.22; glyph(c, 'air', u.x + 7, u.y + 10, k, '#000', null, u.hd); c.globalAlpha = 1; }
    else { c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(u.x + 2, u.y + 4, k * 0.75, k * 0.35, 0, 0, Math.PI * 2); c.fill(); }
    // soldiers are small: a glow round them in their side's colour, so they stand out from the ground (the dark halo
    // they had vanished on grey rock, and ours, hardly blue in the picture, couldn't be seen at all)
    const glow = GLOW[u.type]; if (glow) { c.shadowColor = colors[u.side]; c.shadowBlur = glow * GLOW_K * view.scale; }
    glyphRecoil = Math.max(0, 1 - (s.t - u.lastFire) / 0.25);
    if (u.side === 'blue') hurt.push(u);
    // (its picture; a soldier turns to where he fires)
    // (a soldier standing easy sways a little: never quite still)
    // (and every second or two turns where he stands, 30–60° one way or the other: lookAround)
    const sway = SPRITE_ACROSS[u.type] && !recent && !reduceMotion ? Math.sin(performance.now() / 900 + u.id * 1.7) * 0.07 + lookAround(u) : 0;
    const ga = c.globalAlpha; if (u.type === 'commando' && u.side === 'blue') c.globalAlpha = ga * 0.7; // (ours a little see-through: hidden from the enemy)
    if (hasSprite(u.type)) { stride(u); drawUnitPic(c, u.type, u.x, u.y, k, colors[u.side], (SPRITE_ACROSS[u.type] && recent ? u.aim : u.hd) + sway, aim, glyphRecoil); }
    else glyph(c, u.type, u.x, u.y, k, colors[u.side], colors.outline, u.hd, aim, glow ? 0.9 : 1.2, T.air ? 0 : stride(u));
    glyphRecoil = 0; c.globalAlpha = ga;
    if (glow) c.shadowBlur = 0;
    if (u.rearm) label('⟲', u.x, u.y - k - 4, colors.ink);
    if (u.type === 'commando' && u.plant > 0) { c.strokeStyle = '#ff7a3d'; c.lineWidth = 2; c.beginPath(); c.arc(u.x, u.y, k + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u.plant / Sim.PLANT_T); c.stroke(); }
    if (u.type === 'tank' && u.side === 'blue' && u.trophy !== undefined) for (let i = 0; i < Sim.TROPHY_MAX; i++) { c.fillStyle = i < u.trophy ? '#ffd54a' : 'rgba(255,255,255,.3)'; ring(u.x + (i - 1) * 4, u.y + k * 0.9, 1.4); c.fill(); }
    // (a missile truck of ours: a ring filling while it reloads — whole = a missile ready)
    if (u.type === 'ssm' && u.side === 'blue') { const f = 1 - (u.reload || 0) / Sim.SSM_RELOAD; c.lineWidth = 2.2 / view.css; c.strokeStyle = 'rgba(0,0,0,.35)'; ring(u.x, u.y, k * 1.15); c.stroke(); c.strokeStyle = f >= 1 ? '#ffd54a' : 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(u.x, u.y, k * 1.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke(); }
    if (u.type === 'lift' && u.side === 'blue' && u.cargo && u.cargo.length) label('👥' + u.cargo.length, u.x, u.y - k - 6, colors.ink);
    // (a fuel truck: a yellow tank on its back)
    if (u.type === 'fueltruck' || u.type === 'watertruck') { c.save(); c.translate(u.x, u.y); c.rotate(u.hd); c.fillStyle = u.type === 'watertruck' ? '#3d8fd6' : '#d9a91f'; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 0.8 / view.css; c.beginPath(); c.ellipse(-k * 0.18, 0, k * 0.32, k * 0.2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore(); }
    // (no ammunition or care marks, no health bar: a hurt unit of ours has its dot, see healthDot)
    if (u.side === 'blue' && isSel(u.squad) && !(sel === 'all' && NOT_ALL.includes(u.type))) { // (all picked: every one but the bulldozers)
      // picked: a faint light ring close round the unit
      c.globalAlpha = 0.4; c.strokeStyle = colors.halo; c.lineWidth = 1; ring(u.x, u.y, k * (u.type === 'tank' ? 0.95 : 1) + 2.5); c.stroke(); c.globalAlpha = 1;
    }
  }
  for (const u of hurt) healthDot(c, u);
  for (const u of hurt) fuelGauge(c, u); // (lights: fuel, water, ammunition — fuelui.js)
  // a hurt unit picked (not just "all"): a red Star of David pulsing over it — click it again to send it to be treated
  if (sel !== 'all' && sel != null) for (const u of hurt) if (isSel(u.squad) && hurtUnit(u)) starOfDavid(c, u.x, u.y - SIZE[u.type] * (Sim.TYPES[u.type].air ? 1.2 : 1.05) - 9 / view.css);
}
function starOfDavid(c, x, y) {
  const f = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 160), r = (7 + 2 * f) / view.css;
  c.save(); c.globalAlpha = 0.7 + 0.3 * f; c.lineJoin = 'round';
  for (const pass of [0, 1]) {
    c.lineWidth = (pass ? 1.8 : 4) / view.css; c.strokeStyle = pass ? '#e01b24' : 'rgba(255,255,255,.95)';
    for (const a0 of [-Math.PI / 2, Math.PI / 2]) {
      c.beginPath(); for (let i = 0; i < 3; i++) { const a = a0 + i * Math.PI * 2 / 3; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.stroke();
    }
  }
  c.restore();
}

// a standing soldier looks round: a new turn (30–60°, either way, from his heading) every 1–2 s, eased in over LOOK_EASE s
const LOOK_EASE = 0.35, lookHash = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
function lookAround(u) {
  if (u.moving !== undefined && s.t - u.moving < 0.5) return 0; // (walking: eyes front)
  const per = 1 + lookHash(u.id * 3.1), t = s.t + lookHash(u.id) * per, i = Math.floor(t / per), f = t / per - i;
  const turn = k => k % 3 === 0 ? 0 : (lookHash(k * 7.7 + u.id) < 0.5 ? -1 : 1) * (0.52 + lookHash(k * 3.3 + u.id) * 0.53);
  const a0 = turn(i - 1), a1 = turn(i), e = Math.min(1, f * per / LOOK_EASE);
  return a0 + (a1 - a0) * e * e * (3 - 2 * e);
}
// surface-to-surface missiles in flight (s.missiles): an arc up from the truck and down on the target, a smoke trail
// behind, a shadow on the ground below; seen by both sides
const MISSILE_ARC = 0.35; // (how high, of the way's length)
const MISSILE_PX = 28; // (the picture's length, art/missile.jpg, if there is one)
function drawMissiles(c) {
  for (const m of s.missiles || []) {
    const T = Sim.SSM_FLIGHT, at = f => { const g = Math.min(1, Math.max(0, f)), L = Math.hypot(m.x - m.x0, m.y - m.y0); return { x: m.x0 + (m.x - m.x0) * g, y: m.y0 + (m.y - m.y0) * g, h: Math.sin(Math.PI * g) * L * MISSILE_ARC }; };
    const f = (s.t - m.t0) / T, p = at(f), q = at(f - 0.03);
    c.globalAlpha = 0.25; c.fillStyle = '#000'; ring(p.x + p.h * 0.15, p.y + p.h * 0.1, 3); c.fill(); // (its shadow)
    c.globalAlpha = 0.45; c.strokeStyle = '#d8d8d0'; c.lineWidth = 3; c.beginPath();
    for (let k = 0; k <= 10; k++) { const r = at(f - 0.12 * k / 10); c.lineTo(r.x, r.y - r.h); } c.stroke();
    c.globalAlpha = 1; c.save(); c.translate(p.x, p.y - p.h); c.rotate(Math.atan2((p.y - p.h) - (q.y - q.h), p.x - q.x));
    if (sprite.img.missile) { const M = SPRITES.missile, sc = MISSILE_PX / M.w; c.drawImage(spritePic('missile', colors[m.side]), -M.w / 2 * sc, -M.h / 2 * sc, M.w * sc, M.h * sc); }
    else { c.fillStyle = colors[m.side]; c.beginPath(); c.moveTo(9, 0); c.lineTo(-7, -2.5); c.lineTo(-7, 2.5); c.closePath(); c.fill(); }
    c.fillStyle = '#ffb347'; c.beginPath(); c.arc(sprite.img.missile ? -MISSILE_PX / 2 : -8, 0, 2.2 + Math.random() * 1.2, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.globalAlpha = 1;
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
    if (sh.kind === 'air' || sh.kind === 'heli' || sh.kind === 'arrow' || sh.kind === 'dome' || sh.kind === 'aa' || sh.kind === 'at' || sh.kind === 'ajeep' || sh.kind === 'tjeep') {
      const back = Math.min(d * k, 40);
      c.globalAlpha = 0.35 * (k < 1 ? 1 : sh.life / 0.12); c.strokeStyle = '#d8d8d0'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x - ux * back, y - uy * back); c.lineTo(x, y); c.stroke();
      if (k < 1) { c.globalAlpha = 1; c.strokeStyle = sh.kind !== 'air' ? '#fff1a8' : colors[sh.side]; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - ux * 5, y - uy * 5); c.lineTo(x, y); c.stroke(); c.fillStyle = '#ffb040'; ring(x - ux * 6, y - uy * 6, 1.6); c.fill(); }
    } else if (k < 1) {
      // (a tracer: a longer faint tail, a bright head — added light, no blur)
      const tank = sh.kind === 'tank', len = tank ? 22 : 12;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.35; c.strokeStyle = tank ? '#ff9a3c' : '#ffd36a'; c.lineWidth = tank ? 4 : 2.2;
      c.beginPath(); c.moveTo(x - ux * len, y - uy * len); c.lineTo(x, y); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = tank ? '#fff0c0' : '#fffbe0'; c.lineWidth = tank ? 2 : 1.1;
      c.beginPath(); c.moveTo(x - ux * len * 0.4, y - uy * len * 0.4); c.lineTo(x, y); c.stroke();
      c.globalCompositeOperation = 'source-over';
    }
  }
  c.restore(); c.globalAlpha = 1;
  // units: exact picture without fog; under fog what we see where the picture is exact (see shownAt)
  if (anim.s !== s) { anim.s = s; anim.walk.clear(); anim.last.clear(); tracks.length = 0; dust.length = 0; }
  if (!lite) { drawTracks(c); drawDust(c); } drawFallen(c); // (the light mode: no tracks or dust)
  if (!s.fog) drawUnits(c, () => true);
  else { const whole = new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)); drawUnits(c, u => (u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u)); drawGhosts(c); }
  // explosions: fireball, smoke ring for medium+, sparks for big
  for (const f of s.fx) {
    if (f.wait > 0) continue; // its shot is still flying
    const t = 1 - f.life / f.max, a = 1 - t, R = f.size, r = R * (0.35 + 0.65 * Math.sqrt(t));
    // (once, as it goes off: a little smoke left behind, rising — drawSmoke)
    if (!f.smoked && R >= 8) { f.smoked = true; const n = R >= 26 ? 3 : R >= 18 ? 2 : 1; for (let i = 0; i < n; i++) puff(f.x + (Math.random() - 0.5) * R * 0.6, f.y, R >= 18, 0.7 + R / 30); }
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,255,220,${a})`); g.addColorStop(0.35, `rgba(255,200,60,${a * 0.9})`);
    g.addColorStop(0.7, `rgba(240,90,20,${a * 0.6})`); g.addColorStop(1, 'rgba(120,40,10,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; ring(f.x, f.y, r); c.fill(); c.globalCompositeOperation = 'source-over'; // (added light: a glow)
    // (a dark scorch of smoke under it, and for the bigger ones a shockwave running out over the ground)
    if (R >= 10) { c.strokeStyle = `rgba(70,70,70,${a * 0.5})`; c.lineWidth = R >= 18 ? 3 : 2; ring(f.x, f.y, r * 1.3); c.stroke(); }
    if (R >= 14 && t < 0.6) { c.strokeStyle = `rgba(255,240,210,${(0.6 - t) * 0.7})`; c.lineWidth = 1.5; ring(f.x, f.y, R * (0.6 + t * 2.4)); c.stroke(); }
    if (R >= 18) {
      c.strokeStyle = `rgba(255,220,120,${a})`; c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.047 + f.x * 0.1, d0 = r * 0.8, d1 = r * 1.6;
        c.beginPath(); c.moveTo(f.x + Math.cos(ang) * d0, f.y + Math.sin(ang) * d0); c.lineTo(f.x + Math.cos(ang) * d1, f.y + Math.sin(ang) * d1); c.stroke();
      }
    }
  }
  drawSmoke(c); drawFlashes(c); if (!lite) drawClouds(c); drawWeather(c); // (rain, the morning fog: field.js)
  drawNightLit(c);
  if (s.fog) { drawFog(); if (Sim.friction(s)) drawQuality(c); drawEnemyIntel(c); drawMarks(c); }
  drawPosts(c); drawNodes(c); drawPiles(c); drawDozerJobs(c); // (drawPiles: fuel barrels — fuelui.js)
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
  drawMissiles(c);
  drawFront(c); drawPicked(c); drawPings(c); // (the vignette: #vig, in CSS — a full-screen layer drawn every frame was slow)
}
// the front (🚩 set): a blue flag on a pole, a faint ring round it
function drawFront(c) {
  const f = s.front && s.front.blue; if (!f) return;
  const p = 1 / view.css, wave = reduceMotion ? 0 : Math.sin(performance.now() / 300) * 2 * p;
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = colors.blue; c.lineWidth = 2 * p; c.setLineDash([6 * p, 6 * p]); ring(f.x, f.y, 26 * p); c.stroke(); c.setLineDash([]);
  c.globalAlpha = 0.95; c.strokeStyle = '#fff'; c.lineWidth = 2.2 * p; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - 26 * p); c.stroke();
  c.fillStyle = colors.blue; c.beginPath(); c.moveTo(f.x, f.y - 26 * p); c.quadraticCurveTo(f.x + 9 * p, f.y - 27 * p + wave, f.x + 17 * p, f.y - 22 * p); c.lineTo(f.x, f.y - 16 * p); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2 * p; c.stroke(); c.restore();
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
  // (the message list stands under it, below where it reaches when it grows under the mouse)
  const fd = $('feed'); fd.classList.toggle('underMini', !m.hidden);
  if (m.hidden) return;
  const w = MINI_W, h = Math.round(w * s.H / s.W), k = w / s.W;
  if (m.width !== w || m.height !== h) { m.width = w; m.height = h; m.style.setProperty('--ar', (s.W / s.H).toFixed(3)); fd.style.setProperty('--ar', (s.W / s.H).toFixed(3)); }
  const c = m.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = colors.ground; c.fillRect(0, 0, s.W, s.H);
  c.fillStyle = hexA(colors.tree, 0.35); for (const hl of s.hills) { c.beginPath(); c.ellipse(hl.x, hl.y, hl.r, hl.r * hl.e, hl.a, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = colors.water; for (const l of s.lakes) { c.beginPath(); c.ellipse(l.x, l.y, l.rx, l.ry, l.a, 0, Math.PI * 2); c.fill(); }
  if (s.fog) { c.fillStyle = hexA(colors.blue, 0.12); for (const n of s.nodes) if (n.side === 'blue' && Sim.nodeSpec(n.kind) && s.t >= n.ready) { c.beginPath(); c.arc(n.x, n.y, Sim.nodeSpec(n.kind).r0, 0, Math.PI * 2); c.fill(); } }
  const dot = (x, y, r, col, sq) => { c.fillStyle = col; c.beginPath(); if (sq) c.rect(x - r, y - r, 2 * r, 2 * r); else c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  for (const n of s.nodes) if (nodeShown(n)) { if (n.kind === 'drone') { c.globalAlpha = 0.35; dot(n.x, n.y, 7, colors[n.side]); c.globalAlpha = 1; } else dot(n.x, n.y, 14, colors[n.side], true); }
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { c.globalAlpha = 0.5; const n = s.memNodes.blue[id]; dot(n.x, n.y, 14, colors.red, true); c.globalAlpha = 1; }
  // (the posts: a diamond in the holder's colour, white for no one's)
  for (const p of s.posts || []) { c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4); c.fillStyle = p.side ? colors[p.side] : '#f2f2f2'; c.fillRect(-15, -15, 30, 30); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeRect(-15, -15, 30, 30); c.restore(); }
  for (const q of s.squads) {
    if (q.dead) continue;
    // (ours out of the exact picture — in the fog: only just seen)
    if (q.side === 'blue') { const p = guessAt(q); if (p) { c.globalAlpha = sqShown(q) ? 1 : 0.2; dot(p.x, p.y, 20, colors.blue); c.globalAlpha = 1; } continue; }
    const e = s.fog ? s.mem.blue[q.id] : { x: q.cx, y: q.cy, t: s.t };
    if (e && s.t - e.t < 40) { c.globalAlpha = 1 - (s.t - e.t) / 40; dot(e.x, e.y, 20, colors.red); c.globalAlpha = 1; }
  }
  // a missile launched (ours, or theirs at us): the truck's spot flashes for a few seconds
  for (const f of s.marks) if ((f.kind === 'missile' || f.kind === 'launch') && s.t - f.t < 6 && Math.floor((s.t - f.t) * 3) % 2 === 0) { c.fillStyle = f.kind === 'missile' ? colors.red : '#ffd54a'; c.beginPath(); c.arc(f.x, f.y, 34, 0, Math.PI * 2); c.fill(); c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke(); }
  for (const f of s.marks) { c.strokeStyle = f.kind === 'lost' || f.kind === 'ff' || f.kind === 'nodeLost' ? colors.red : colors.ink; c.lineWidth = 10; c.beginPath(); c.arc(f.x, f.y, 40 + 30 * (s.t - f.t), 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = colors.ink; c.lineWidth = 2 / k; c.strokeRect(vr.x, vr.y, vr.w, vr.h);
  drawViews(c, k); // (the saved views' numbers)
}

// the selection rectangle while it's being drawn (screen pixels)
function drawBox() {
  if (faceDrag && fit) {
    const f = faceDrag, c = ctx, a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0), L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
    c.save(); c.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0); c.strokeStyle = colors.blue; c.fillStyle = colors.blue; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(f.x0, f.y0, 6, 0, Math.PI * 2); c.fill();
    if (L > 10) {
      // (where the forces will stand: a band from the tail — the last row — to the head — the first, the front)
      const W = 45, px = -Math.sin(a) * W, py = Math.cos(a) * W;
      c.globalAlpha = 0.14; c.beginPath(); c.moveTo(f.x0 + px, f.y0 + py); c.lineTo(f.x1 + px, f.y1 + py); c.lineTo(f.x1 - px, f.y1 - py); c.lineTo(f.x0 - px, f.y0 - py); c.closePath(); c.fill();
      c.globalAlpha = 1; c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x1, f.y1); c.stroke();
      c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x1 - Math.cos(a - 0.45) * 14, f.y1 - Math.sin(a - 0.45) * 14); c.lineTo(f.x1 - Math.cos(a + 0.45) * 14, f.y1 - Math.sin(a + 0.45) * 14); c.closePath(); c.fill();
      // the front: a line across the head; the last row: a fainter one across the tail
      c.globalAlpha = 0.8; c.beginPath(); c.moveTo(f.x1 + px, f.y1 + py); c.lineTo(f.x1 - px, f.y1 - py); c.stroke();
      c.globalAlpha = 0.4; c.beginPath(); c.moveTo(f.x0 + px, f.y0 + py); c.lineTo(f.x0 - px, f.y0 - py); c.stroke();
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
