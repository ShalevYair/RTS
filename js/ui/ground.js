// UI: the ground of the big maps (terrain.js) — mud, dense woods (and the lanes cut through them), cliffs — painted
// into the ground tiles (drawTerrain). The squares are binned by GRD_BIN so a tile only looks at its own; a square cut
// (a tank through a wood, a building put on one) has its tiles painted again (groundTick).
const GRD_BIN = 256, grd = { of: null, bins: null, seen: 0 };
// (the trees in a wood: GRD_TREES a square, GRD_TREE across, on a dark floor)
const GRD_TREES = 2, GRD_TREE = [30 / WORLD_K, 46 / WORLD_K];
function groundBins() {
  const G = s.ground;
  if (grd.of === G) return grd;
  grd.of = G; grd.bins = new Map(); grd.seen = G ? G.cut.length : 0;
  if (!G) return grd;
  for (let c = 0; c < G.k.length; c++) if (G.k[c]) {
    const x = (c % G.w + 0.5) * G.C, y = (Math.floor(c / G.w) + 0.5) * G.C, key = Math.floor(x / GRD_BIN) + ',' + Math.floor(y / GRD_BIN);
    let l = grd.bins.get(key); if (!l) grd.bins.set(key, l = []); l.push(c);
  }
  return grd;
}
// the squares near the tile being painted (m: how far past its edge — a tree's crown)
function groundNear(m) {
  const B = groundBins(), out = [];
  for (let i = Math.floor((bg.x0 - m) / GRD_BIN); i <= Math.floor((bg.x0 + bg.w + m) / GRD_BIN); i++) for (let j = Math.floor((bg.y0 - m) / GRD_BIN); j <= Math.floor((bg.y0 + bg.h + m) / GRD_BIN); j++) {
    const l = B.bins.get(i + ',' + j); if (l) out.push(...l);
  }
  return out;
}
// a square's own dice: the same every time it's painted
const grdRand = (c, k) => { const h = Math.sin(c * 12.9898 + k * 78.233) * 43758.5453; return h - Math.floor(h); };
// the soft layers, under the trees: mud (wet earth, darker at its heart) and the cut lanes (bare earth); and the
// woods' dark floor
function drawGroundSoft(c) {
  const G = s.ground; if (!G) return;
  const near = groundNear(G.C * 2), C = G.C, mud = tilePat(c, 'mud'), dirt = tilePat(c, 'dirt');
  const blob = (want, r) => { const p = new Path2D(); let any = false; for (const k of near) if (want(G.k[k])) { const x = (k % G.w + 0.5) * C + (grdRand(k, 1) - 0.5) * C * 0.4, y = (Math.floor(k / G.w) + 0.5) * C + (grdRand(k, 2) - 0.5) * C * 0.4; p.moveTo(x + r, y); p.arc(x, y, r * (0.85 + grdRand(k, 3) * 0.3), 0, Math.PI * 2); any = true; } return any ? p : null; };
  // (mud: bare earth soaked dark, a soft rim, a few puddles catching the light)
  const rim = blob(k => k === Sim.GR_MUD, C * 1.25), m = blob(k => k === Sim.GR_MUD, C * 0.95);
  if (m) {
    c.globalAlpha = 0.35; c.fillStyle = '#3d3122'; c.fill(rim);
    c.globalAlpha = 0.95; c.fillStyle = dirt || '#5a4a32'; c.fill(m);
    c.globalAlpha = 0.55; c.fillStyle = '#2e2418'; c.fill(m);
    c.fillStyle = '#9fb0b4';
    for (const k of near) if (G.k[k] === Sim.GR_MUD && grdRand(k, 40) < 0.3) {
      const x = (k % G.w + grdRand(k, 41)) * C, y = (Math.floor(k / G.w) + grdRand(k, 42)) * C;
      c.globalAlpha = 0.22; c.beginPath(); c.ellipse(x, y, C * (0.35 + grdRand(k, 43) * 0.4), C * (0.2 + grdRand(k, 44) * 0.2), grdRand(k, 45) * 3, 0, Math.PI * 2); c.fill();
    }
  }
  const cut = blob(k => k === Sim.GR_CUT, C * 0.8);
  if (cut) { c.globalAlpha = 0.75; c.fillStyle = dirt || '#6b5a3c'; c.fill(cut); }
  const floor = blob(k => k === Sim.GR_WOOD, C * 1.05);
  if (floor) { c.globalAlpha = 0.6; c.fillStyle = shade(colors.tree, -0.45); c.fill(floor); }
  c.globalAlpha = 1;
}
// the woods' trees (the scenery's pictures, packed close; a few stumps in the cut lanes) and the cliffs: a band of
// rock along the line, dark on its low side, a light edge on top
function drawGroundHard(c) {
  const G = s.ground; if (!G) return;
  const C = G.C, near = groundNear(GRD_TREE[1]);
  const trees = Object.keys(sprite.img).filter(k => k.startsWith('d_tree')).sort().map(k => sprite.img[k]);
  const n = gfxLow ? 1 : GRD_TREES;
  for (const k of near) {
    const v = G.k[k], x0 = (k % G.w) * C, y0 = Math.floor(k / G.w) * C;
    if (v === Sim.GR_CUT) { c.fillStyle = '#4a3a26'; for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(x0 + grdRand(k, 20 + i) * C, y0 + grdRand(k, 30 + i) * C, 1.4, 0, Math.PI * 2); c.fill(); } continue; }
    if (v !== Sim.GR_WOOD) continue;
    for (let i = 0; i < n; i++) {
      const x = x0 + grdRand(k, 4 + i) * C, y = y0 + grdRand(k, 8 + i) * C, w = GRD_TREE[0] + grdRand(k, 12 + i) * (GRD_TREE[1] - GRD_TREE[0]);
      const im = trees.length ? trees[Math.floor(grdRand(k, 16 + i) * trees.length)] : null;
      if (im) { const h = w * im.height / im.width; c.drawImage(im, x - w / 2, y - h / 2, w, h); }
      else { c.fillStyle = shade(colors.tree, grdRand(k, 16 + i) * 0.3 - 0.15); c.beginPath(); c.arc(x, y, w * 0.35, 0, Math.PI * 2); c.fill(); }
    }
  }
  // (cliffs: a rock face falling away from the hill — lit along its top edge, dark down its face, a shadow at its foot;
  // the face's lower edge a little ragged)
  const rocky = tilePat(c, 'rocky'), W = Sim.GROUND_CLIFF_W || 10, m = W * 3;
  for (const L of G.cliffs) {
    const P = L.p;
    if (!P.some(p => p.x > bg.x0 - m && p.x < bg.x0 + bg.w + m && p.y > bg.y0 - m && p.y < bg.y0 + bg.h + m)) continue;
    const nrm = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let nx = -(b.y - a.y), ny = b.x - a.x; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d; if (nx * (p.x - L.c.x) + ny * (p.y - L.c.y) < 0) { nx = -nx; ny = -ny; } return { x: nx, y: ny }; });
    const top = P.map((p, i) => ({ x: p.x - nrm[i].x * W * 0.6, y: p.y - nrm[i].y * W * 0.6 }));
    const foot = P.map((p, i) => { const j = W * (1.1 + 0.5 * Math.sin(i * 2.3) * Math.cos(i * 1.7)); return { x: p.x + nrm[i].x * j, y: p.y + nrm[i].y * j }; });
    const shadow = P.map((p, i) => ({ x: p.x + nrm[i].x * W * 2.4, y: p.y + nrm[i].y * W * 2.4 }));
    const band = (a, b) => { const q = new Path2D(); q.moveTo(a[0].x, a[0].y); for (const p of a) q.lineTo(p.x, p.y); for (let i = b.length - 1; i >= 0; i--) q.lineTo(b[i].x, b[i].y); q.closePath(); return q; };
    c.globalAlpha = 0.3 * (0.4 + 0.6 * SUN.a); c.fillStyle = '#000'; c.fill(band(foot, shadow));
    const face = band(top, foot);
    c.globalAlpha = 1; c.fillStyle = rocky || '#7a6f62'; c.fill(face);
    c.globalAlpha = 0.5; c.fillStyle = '#2a231c'; c.fill(face);
    c.globalAlpha = 0.85; c.strokeStyle = '#e4dccb'; c.lineWidth = 1.8; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(top[0].x, top[0].y); for (const p of top) c.lineTo(p.x, p.y); c.stroke();
    c.globalAlpha = 0.6; c.strokeStyle = '#1a1510'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(foot[0].x, foot[0].y); for (const p of foot) c.lineTo(p.x, p.y); c.stroke();
    c.globalAlpha = 1;
  }
}
// a square cut since the last frame: its tiles painted again
function groundTick() {
  const G = s && s.ground; if (!G) return;
  groundBins();
  for (; grd.seen < G.cut.length; grd.seen++) { const k = G.cut[grd.seen]; bgDirty((k % G.w + 0.5) * G.C, (Math.floor(k / G.w) + 0.5) * G.C, GRD_TREE[1]); }
}
