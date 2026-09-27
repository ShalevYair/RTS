// UI: canvas rendering — terrain, bases, points, fog, intel, marks, units
function makeDecor(W) {
  let a = 12345; const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const mid = W / 2, ok = (x, m = 0) => x > 90 + m && x < W - 90 - m && Math.abs(x - mid) > 80 + m;
  const lakes = [{ x: W * 0.36, y: 592, rx: 55, ry: 22, a: 0.1 }, { x: W * 0.64, y: 50, rx: 55, ry: 22, a: -0.1 }];
  const inLake = (x, y) => lakes.some(l => ((x - l.x) / (l.rx + 8)) ** 2 + ((y - l.y) / (l.ry + 8)) ** 2 < 1);
  const patches = [], fields = [], trees = [], rocks = [], n = Math.round(W / 70);
  for (let i = 0; i < n; i++) patches.push({ x: 90 + r() * (W - 180), y: r() * 640, rx: 40 + r() * 70, ry: 25 + r() * 40 });
  for (let i = 0; i < Math.round(W / 220); i++) {
    const x = 100 + r() * (W - 200), y = 30 + r() * 580;
    if (ok(x, 30) && !inLake(x, y)) fields.push({ x, y, w: 50 + r() * 40, h: 30 + r() * 20, a: (r() - 0.5) * 0.8 });
  }
  for (let i = 0; i < Math.round(W / 55); i++) {
    const cx = 100 + r() * (W - 200), cy = 20 + r() * 600, m = 3 + Math.floor(r() * 6);
    for (let j = 0; j < m; j++) { const x = cx + (r() - 0.5) * 50, y = cy + (r() - 0.5) * 40; if (ok(x) && !inLake(x, y)) trees.push({ x, y, r: 4 + r() * 4 }); }
  }
  for (let i = 0; i < Math.round(W / 80); i++) { const x = 100 + r() * (W - 200), y = 20 + r() * 600; if (ok(x) && !inLake(x, y)) rocks.push({ x, y, r: 1.5 + r() * 2.5 }); }
  trees.sort((p, q) => p.y - q.y);
  return { patches, fields, lakes, trees, rocks };
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
  const c = ctx; c.font = '700 13px Assistant, sans-serif'; c.lineWidth = 3; c.strokeStyle = colors.halo;
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
function glyph(c, type, x, y, k, fill, outline, hd = 0, aim = hd, lw = 1.2) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  const paint = () => { if (outline) { c.lineWidth = lw; c.strokeStyle = outline; c.stroke(); } c.fillStyle = fill; c.fill(); };
  const barrel = (x1, y1, x2, y2, w) => {
    if (outline) { c.strokeStyle = outline; c.lineWidth = w + lw * 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    c.strokeStyle = fill; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  if (type === 'air') { c.rotate(hd); c.beginPath(); poly(c, PLANE, k); paint(); }
  else if (type === 'aa') { c.rotate(aim); c.beginPath(); poly(c, MISSILE, k); paint(); }
  else if (type === 'tank') {
    c.rotate(hd); c.beginPath(); c.rect(-0.8 * k, -0.55 * k, 1.6 * k, 1.1 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-0.8 * k, -0.55 * k, 1.6 * k, 0.24 * k); c.fillRect(-0.8 * k, 0.31 * k, 1.6 * k, 0.24 * k);
    c.rotate(aim - hd); barrel(0, 0, 1.3 * k, 0, 0.22 * k);
    c.beginPath(); c.arc(0, 0, 0.36 * k, 0, Math.PI * 2); paint();
  } else if (type === 'jeep') {
    // jeep: open body, four wheels, a pintle gun on top
    c.rotate(hd); c.beginPath(); c.rect(-0.75 * k, -0.45 * k, 1.5 * k, 0.9 * k); paint();
    c.fillStyle = 'rgba(0,0,0,.45)'; for (const [wx, wy] of [[-0.5, -0.55], [0.35, -0.55], [-0.5, 0.42], [0.35, 0.42]]) c.fillRect(wx * k, wy * k, 0.3 * k, 0.14 * k);
    c.rotate(aim - hd); barrel(0, 0, 0.9 * k, 0, 0.12 * k);
  } else {
    if (Math.cos(hd) < 0) c.scale(-1, 1);
    c.beginPath(); c.arc(0, -0.62 * k, 0.24 * k, 0, Math.PI * 2);
    c.moveTo(-0.32 * k, -0.34 * k); c.lineTo(0.32 * k, -0.34 * k); c.lineTo(0.24 * k, 0.2 * k); c.lineTo(-0.24 * k, 0.2 * k); c.closePath();
    c.rect(-0.24 * k, 0.2 * k, 0.18 * k, 0.55 * k); c.rect(0.06 * k, 0.2 * k, 0.18 * k, 0.55 * k);
    paint(); barrel(0.05 * k, 0.05 * k, 0.62 * k, -0.75 * k, 0.14 * k);
  }
  c.restore();
}
const idleAim = (type, side) => type === 'aa' ? -Math.PI / 2 + (side === 'blue' ? 0.6 : -0.6) : (side === 'blue' ? 0 : Math.PI);

function drawTerrain(c, W, H, mid) {
  c.fillStyle = colors.grass2;
  for (const p of decor.patches) { c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); c.fill(); }
  for (const f of decor.fields) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = colors.field; c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    c.strokeStyle = colors.field2; c.lineWidth = 3;
    for (let x = -f.w / 2 + 4; x < f.w / 2; x += 8) { c.beginPath(); c.moveTo(x, -f.h / 2); c.lineTo(x, f.h / 2); c.stroke(); }
    c.restore();
  }
  for (const l of decor.lakes) {
    c.beginPath(); c.ellipse(l.x, l.y, l.rx, l.ry, l.a, 0, Math.PI * 2); c.fillStyle = colors.water; c.fill();
    c.lineWidth = 3; c.strokeStyle = colors.waterEdge; c.stroke();
    c.beginPath(); c.ellipse(l.x - l.rx * 0.2, l.y - l.ry * 0.25, l.rx * 0.45, l.ry * 0.3, l.a, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
  }
  for (const h of s.hills) {
    const g = c.createRadialGradient(h.x - h.r * 0.35, h.y - h.r * 0.35, h.r * 0.1, h.x, h.y, h.r);
    g.addColorStop(0, colors.hillHi); g.addColorStop(1, colors.hill);
    c.fillStyle = g; ring(h.x, h.y, h.r); c.fill();
    c.strokeStyle = colors.hillLine; c.lineWidth = 1; c.globalAlpha = 0.6;
    for (const f of [1, 0.7, 0.4]) { ring(h.x, h.y, h.r * f); c.stroke(); }
    c.globalAlpha = 1;
  }
  for (const t of decor.trees) {
    c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(t.x + 2, t.y + 3, t.r, t.r * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = colors.tree; ring(t.x, t.y, t.r); c.fill();
    c.fillStyle = colors.treeHi; ring(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5); c.fill();
  }
  c.fillStyle = colors.rock; for (const r of decor.rocks) { ring(r.x, r.y, r.r); c.fill(); }
  const roads = () => {
    c.beginPath(); c.moveTo(mid, 60); c.lineTo(mid, 580);
    for (const y of [80, 240, 400, 560]) {
      c.moveTo(60, y); c.bezierCurveTo(W * 0.25, y, W * 0.3, 320, mid, 320);
      c.moveTo(W - 60, y); c.bezierCurveTo(W * 0.75, y, W * 0.7, 320, mid, 320);
    }
  };
  c.lineCap = 'round';
  roads(); c.strokeStyle = colors.roadEdge; c.lineWidth = 13; c.stroke();
  roads(); c.strokeStyle = colors.road; c.lineWidth = 9; c.stroke();
}

function drawBases(c, H) {
  for (const side of ['blue', 'red']) {
    const b = s.bases[side], w = b.x1 - b.x0, inner = side === 'blue' ? b.x1 : b.x0, face = side === 'blue' ? 0 : Math.PI;
    c.save();
    c.fillStyle = hexA(colors[side], 0.2); c.fillRect(b.x0, 0, w, H);
    c.beginPath(); c.rect(b.x0, 0, w, H); c.clip();
    c.strokeStyle = hexA(colors[side], 0.14); c.lineWidth = 2;
    for (let y = -w; y < H + w; y += 14) { c.beginPath(); c.moveTo(b.x0, y); c.lineTo(b.x1, y + w); c.stroke(); }
    c.restore();
    c.strokeStyle = colors[side]; c.lineWidth = 2; c.beginPath(); c.moveTo(inner, 0); c.lineTo(inner, H); c.stroke();
    c.fillStyle = colors[side]; for (let y = 6; y < H; y += 16) c.fillRect(inner - 2, y, 4, 4);
  }
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
  const b = s.bases.blue; f.fillRect(b.x0, 0, b.x1 - b.x0 + 5, s.H);
  for (const q of s.squads) if (q.side === 'blue' && !q.dead) { const p = pos(q); hole(p.x, p.y, Sim.TYPES[q.type].sight + 30); }
  for (const n of s.nodes) if (n.side === 'blue' && s.t >= n.ready) hole(n.x, n.y, n.kind === 'drone' ? Sim.NODES.drone.r0 + 15 : n.kind === 'fhq' ? Sim.NODES.fhq.sight : 120);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fogCv, 0, 0); ctx.restore();
}

// enemy as blobs of uncertainty: tight when just seen, spreading and fading with the age of the sighting
const STALE = 12, TRAIL = 8, BLOB_LIFE = 40, BLOB_R = 25, BLOB_MAX = 150, UNSURE = 4;
function drawEnemyIntel(c) {
  for (const q of s.squads) {
    const m = q.side === 'red' && s.mem.blue[q.id], age = m ? s.t - m.t : Infinity;
    if (!m || age > BLOB_LIFE) continue;
    const k = 1 - age / BLOB_LIFE, r = Math.min(BLOB_MAX, BLOB_R + Sim.TYPES[m.type].speed * age * 0.5);
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    g.addColorStop(0, hexA(colors.red, 0.4 * k + 0.1)); g.addColorStop(0.6, hexA(colors.red, 0.2 * k)); g.addColorStop(1, hexA(colors.red, 0));
    c.fillStyle = g; ring(m.x, m.y, r); c.fill();
    c.globalAlpha = 0.35 + 0.65 * k;
    c.fillStyle = colors.red; ring(m.x, m.y, 11); c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
    glyph(c, m.type, m.x, m.y, m.type === 'air' ? 8 : 6, '#fff', null, Math.PI, m.type === 'aa' ? -Math.PI / 2 : Math.PI);
    // rough size: 1-3 dots from how many were seen
    const dots = m.n <= 2 ? 1 : m.n <= 4 ? 2 : 3; c.fillStyle = colors.red;
    for (let i = 0; i < dots; i++) { ring(m.x - (dots - 1) * 4 + i * 8, m.y + 17, 2.5); c.fill(); }
    if (age > UNSURE) label('?', m.x + 15, m.y - 8, colors.red);
    c.globalAlpha = 1;
  }
}
// control quality: a soft blue wash around every working node, full inside r0 and fading out to r1
function drawQuality(c) {
  const nodes = s.nodes.filter(n => n.side === 'blue' && Sim.NODES[n.kind] && s.t >= n.ready);
  for (const n of nodes) {
    const N = Sim.NODES[n.kind], a = 0.2 * N.q, g = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, N.r1);
    g.addColorStop(0, hexA(colors.blue, a)); g.addColorStop(N.r0 / N.r1, hexA(colors.blue, a)); g.addColorStop(1, hexA(colors.blue, 0));
    c.fillStyle = g; ring(n.x, n.y, N.r1); c.fill();
  }
}
// control nodes: forward HQs (build-up ring, then working) and drones (warm-up, then flight time left)
// structures: HQ, buildings, forward HQs, drones. Ours always; the enemy's while seen, then faded where last seen.
// Arc: construction / warm-up progress, then a drone's flight time left, or a building's next unit.
const nodeShown = n => n.side === 'blue' || !s.fog || s.visNodes.blue.has(n.id);
function drawStruct(c, n, ghost) {
  const S = Sim.STRUCTS[n.kind], N = Sim.NODES[n.kind], col = colors[n.side], on = s.t >= n.ready, big = n.kind === 'hq' ? 1.5 : 1;
  if (n.side === 'blue' && N && n.kind !== 'hq') {
    c.strokeStyle = col; c.lineWidth = on ? 2 : 1; c.globalAlpha = on ? 0.7 : 0.35; c.setLineDash([6, 5]);
    ring(n.x, n.y, N.r0); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
  }
  c.globalAlpha = ghost ? 0.45 : 1;
  if (!ghost) {
    const k = !on ? (s.t - n.t0) / Math.max(0.01, n.ready - n.t0) : n.kind === 'drone' ? (n.until - s.t) / N.life : S.unit ? n.prog : 1;
    c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(n.x, n.y, 16 * big, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, k)) * Math.PI * 2); c.stroke();
  }
  c.fillStyle = colors.halo; ring(n.x, n.y, 13 * big); c.fill(); c.lineWidth = 1.5; c.strokeStyle = col; c.stroke();
  c.globalAlpha = ghost ? 0.45 : on ? 1 : 0.55; c.font = `${Math.round(16 * big)}px sans-serif`; c.fillText(S.icon, n.x, n.y + 6 * big); c.globalAlpha = 1;
  if (ghost) return;
  if (!on) label(String(Math.ceil(n.ready - s.t)), n.x, n.y - 20 * big, col);
  if (n.hp < S.hp) { c.fillStyle = colors.shadow; c.fillRect(n.x - 14, n.y + 19 * big, 28, 3); c.fillStyle = col; c.fillRect(n.x - 14, n.y + 19 * big, 28 * Math.max(0, n.hp / S.hp), 3); }
}
function drawNodes(c) {
  for (const n of s.nodes) if (nodeShown(n)) drawStruct(c, n, false);
  if (!s.fog) return;
  for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) drawStruct(c, { ...s.memNodes.blue[id], side: 'red' }, true);
}
// build placement: green where a building may go (strong enough control, a free slot, room)
function drawBuildArea(c) {
  if (!buildArmed) return;
  const G = 20; c.fillStyle = 'rgba(80,200,90,.22)';
  for (let y = G / 2; y < s.H; y += G) for (let x = G / 2; x < s.W; x += G) if (!Sim.buildCheck(s, 'blue', x, y)) c.fillRect(x - G / 2, y - G / 2, G, G);
}
// event reports appear where they happened, pop in and fade out
const MARK = { contact: '⚔', hit: '💥', lost: '✖', ok: '✓', flag: '🚩', flagLost: '🏳', call: '📞', fhq: '🏕', nodeLost: '💥' };
// orders still on their way: a courier dot runs from HQ toward the squad, the new target is a ghost ring
function drawMail(c) {
  const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || { x: s.bases.blue.x, y: s.H / 2 };
  for (const m of s.outbox) {
    const q = m.side === 'blue' && s.squads.find(x => x.id === m.id);
    if (!q || q.dead) continue;
    const p = pos(q), k = Math.min(1, (s.t - m.sent) / Math.max(0.01, m.at - m.sent));
    c.globalAlpha = 0.55; c.strokeStyle = colors.blue; c.lineWidth = 1; c.setLineDash([2, 5]);
    c.beginPath(); c.moveTo(hq.x, hq.y); c.lineTo(p.x, p.y - 26); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1; c.font = '13px sans-serif';
    c.fillText('✉', hq.x + (p.x - hq.x) * k, hq.y + (p.y - 26 - hq.y) * k + 4);
    if (m.kind === 'order') {
      c.globalAlpha = 0.45; c.setLineDash([3, 5]); c.lineWidth = 1.5; ring(m.x, m.y, 30); c.stroke(); c.setLineDash([]);
      c.globalAlpha = 0.8; c.fillText('⏳', m.x, m.y + 5); c.globalAlpha = 1;
    }
  }
}
function drawMarks(c) {
  for (const k of s.marks) {
    const a = (s.t - k.t) / Sim.MARK_LIFE, sc = a < 0.15 ? 0.6 + a / 0.15 * 0.6 : 1.2 - Math.min(0.2, a);
    c.globalAlpha = Math.max(0, 1 - a); c.font = `${Math.round(18 * sc)}px sans-serif`;
    c.lineWidth = 3; c.strokeStyle = colors.halo; c.strokeText(MARK[k.kind], k.x, k.y - 44);
    c.fillStyle = k.kind === 'lost' || k.kind === 'flagLost' ? colors.red : colors.ink; c.fillText(MARK[k.kind], k.x, k.y - 44);
  }
  c.globalAlpha = 1;
}

// units: ground first, aircraft (with drop shadows) on top
function drawUnits(c, show) {
  for (const pass of [false, true]) for (const u of s.units) {
    const T = Sim.TYPES[u.type]; if (!!T.air !== pass || !show(u)) continue;
    const k = SIZE[u.type], recent = s.t - u.lastFire < 3;
    const aim = recent ? u.aim : (u.type === 'aa' ? idleAim('aa', u.side) : u.hd);
    if (T.air) { c.globalAlpha = 0.22; glyph(c, 'air', u.x + 7, u.y + 10, k, '#000', null, u.hd); c.globalAlpha = 1; }
    else { c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(u.x + 2, u.y + 4, k * 0.75, k * 0.35, 0, 0, Math.PI * 2); c.fill(); }
    glyph(c, u.type, u.x, u.y, k, colors[u.side], colors.outline, u.hd, aim);
    if (u.rearm) label('⟲', u.x, u.y - k - 4, colors.ink);
    if (u.side === 'blue' && (sel === 'all' || u.squad === sel)) {
      c.strokeStyle = colors.ink; c.lineWidth = 1.2; ring(u.x, u.y, k + 3); c.stroke();
      if (sel !== 'all') { c.globalAlpha = 0.16; c.strokeStyle = colors.blue; ring(u.x, u.y, T.range); c.stroke(); c.globalAlpha = 1; }
    }
    if (u.hp < T.hp) {
      c.fillStyle = colors.shadow; c.fillRect(u.x - 8, u.y - k - 7, 16, 3);
      c.fillStyle = colors[u.side]; c.fillRect(u.x - 8, u.y - k - 7, 16 * Math.max(0, u.hp / T.hp), 3);
    }
  }
}

function draw() {
  const c = ctx, W = s.W, H = s.H, mid = W / 2;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = colors.ground; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  c.textAlign = 'center';
  drawTerrain(c, W, H, mid);
  drawBases(c, H);
  // player orders
  const labelSpots = [];
  for (const q of s.squads) {
    if (q.side !== 'blue' || q.dead) continue;
    let o = q.retreating ? { ...Sim.homeOf(s, q), r: 30, type: 'retreat' } : Sim.effOrder(s, q);
    if (o.target) o = { ...o, x: pos(o.target).x, y: pos(o.target).y };
    const on = sel === 'all' || q.id === sel, p = pos(q);
    c.strokeStyle = colors.blue; c.globalAlpha = on ? 0.9 : 0.35; c.lineWidth = on ? 2 : 1.2;
    c.setLineDash(o.type === 'support' ? [2, 4] : [7, 5]); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(o.x, o.y); c.stroke();
    ring(o.x, o.y, o.r); c.stroke(); c.setLineDash([]);
    const stack = labelSpots.filter(p => Math.hypot(p.x - o.x, p.y - o.y) < 30).length; labelSpots.push(o);
    label(Sim.ORDER_NAME[o.type], o.x, o.y + o.r + 14 + stack * 15, tcol(q.type));
    c.globalAlpha = 1;
  }
  // tracers
  c.save(); c.lineCap = 'round';
  for (const sh of s.shots) {
    c.globalAlpha = Math.max(0, sh.life / 0.15); c.shadowColor = colors[sh.side]; c.shadowBlur = 6;
    c.strokeStyle = sh.kind === 'aa' ? '#fff1a8' : colors[sh.side];
    c.lineWidth = sh.kind === 'tank' ? 2.5 : 1.3; c.setLineDash(sh.kind === 'air' ? [3, 3] : []);
    c.beginPath(); c.moveTo(sh.x1, sh.y1); c.lineTo(sh.x2, sh.y2); c.stroke();
  }
  c.restore();
  // units: exact picture without fog; under fog only what a drone is looking at right now
  const eyes = s.nodes.filter(n => n.side === 'blue' && n.kind === 'drone' && s.t >= n.ready), R = Sim.NODES.drone.r0;
  if (!s.fog) drawUnits(c, () => true);
  else if (eyes.length) {
    c.save(); c.beginPath(); for (const d of eyes) { c.moveTo(d.x + R, d.y); c.arc(d.x, d.y, R, 0, Math.PI * 2); } c.clip();
    drawUnits(c, u => eyes.some(d => Math.hypot(u.x - d.x, u.y - d.y) <= R + 10)); c.restore();
  }
  // explosions: fireball, smoke ring for medium+, sparks for big
  for (const f of s.fx) {
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
  if (s.fog) { drawFog(); drawQuality(c); drawEnemyIntel(c); drawMarks(c); drawMail(c); }
  drawNodes(c);
  drawBuildArea(c);
  // squad badges: tap to select; type icon, strength bar, posture. Under fog: at the last report.
  const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 180);
  for (const q of s.squads) {
    if (q.side !== 'blue' || q.dead) continue;
    const p = pos(q), age = s.t - p.t, stale = s.fog && age > STALE;
    if (s.fog && p.prev && age < TRAIL) {
      c.globalAlpha = 0.5 * (1 - age / TRAIL); c.strokeStyle = tcol(q.type); c.lineWidth = 2; c.setLineDash([2, 3]);
      c.beginPath(); c.moveTo(p.prev.x, p.prev.y - 26); c.lineTo(p.x, p.y - 26); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    if (stale) c.globalAlpha = pulse;
    const x = p.x, y = p.y - 26, on = sel === 'all' || q.id === sel;
    c.fillStyle = colors.shadow; ring(x + 1.5, y + 2.5, 12); c.fill();
    c.fillStyle = tcol(q.type); ring(x, y, 12); c.fill();
    c.lineWidth = on ? 3 : 1.5; c.strokeStyle = on ? colors.ink : '#fff'; c.stroke();
    glyph(c, q.type, x - (q.type === 'tank' ? 1.5 : 0), y, q.type === 'air' ? 8.5 : 6.5, '#fff', null, 0, q.type === 'aa' ? -Math.PI / 2 : 0);
    c.fillStyle = colors.shadow; c.fillRect(x - 12, y + 15, 24, 3);
    c.fillStyle = tcol(q.type); c.fillRect(x - 12, y + 15, 24 * Math.min(1, p.strength), 3);
    c.font = '11px sans-serif'; c.fillText(POSTURE[q.trait], x + 20, y + 4);
    if (s.fog) c.fillText(Sim.TEMPERS[q.temper].icon, x - 20, y + 4);
    if (stale) label('?', x - 17, y - 6, colors.ink);
    c.globalAlpha = 1;
  }
}
