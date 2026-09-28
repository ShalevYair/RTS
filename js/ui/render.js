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
  for (let i = 0; i < Math.round(K / 40); i++) patches.push({ p: blob(r() * W, r() * s.H, 30 + r() * 100, 20 + r() * 60), u: r(), t: tone(0.06) });
  const tufts = Array.from({ length: TUFT_SHADES }, () => new Path2D());
  for (let i = 0; i < Math.round(K / 3); i++) { const x = r() * W, y = r() * s.H, k = Math.floor(r() * TUFT_SHADES); if (!inLake(x, y)) { tufts[k].moveTo(x + 1.6, y); tufts[k].arc(x, y, 0.8 + r() * 1.2, 0, Math.PI * 2); } }
  const fields = [], trees = [], rocks = [];
  for (let i = 0; i < Math.round(K / 220); i++) {
    const x = 100 + r() * (W - 200), y = 30 + r() * (s.H - 60);
    if (ok(x, 30) && !inLake(x, y)) fields.push({ x, y, w: 50 + r() * 40, h: 30 + r() * 20, a: (r() - 0.5) * 0.8, t: tone(0.1), gap: 6 + r() * 4 });
  }
  for (let i = 0; i < Math.round(K / 55); i++) {
    const cx = 100 + r() * (W - 200), cy = 20 + r() * (s.H - 40), m = 3 + Math.floor(r() * 6), t0 = tone(0.1);
    for (let j = 0; j < m; j++) { const x = cx + (r() - 0.5) * 50, y = cy + (r() - 0.5) * 40; if (ok(x) && !inLake(x, y)) trees.push({ x, y, r: 3.5 + r() * 5, t: t0 + tone(0.06) }); }
  }
  for (let i = 0; i < Math.round(K / 60); i++) { const x = 60 + r() * (W - 120), y = 20 + r() * (s.H - 40); if (!inLake(x, y)) rocks.push({ x, y, r: 1.2 + r() * 2.8, t: tone(0.12) }); }
  trees.sort((p, q) => p.y - q.y);
  // hills: contour lines traced from the sim's height grid (so what's drawn is what counts); the colouring is made
  // when drawn, from the theme (see relief)
  const hills = { contours: contours(s.elev), relief: null, theme: '' };
  // lakes: the sim's outline, a darker middle, a shallow rim
  const lakes = s.lakes.map(l => {
    const shp = f => outline(l.x, l.y, th => { const q = f * Sim.wobble(l.w, Math.atan2(Math.sin(th) / l.ry, Math.cos(th) / l.rx)); return [Math.cos(th) * l.rx * q, Math.sin(th) * l.ry * q]; }, 56, l.a);
    return { l, edge: shp(1.08), body: shp(1), deep: shp(0.55), t: tone(0.08) };
  });
  return { patches, tufts, fields, lakes, hills, trees, rocks, roads: makeRoads(s, r) };
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
      pts.push({ x: p.x - dy / d * sway, y: p.y + dx / d * sway, w: 8 + Math.sin(k * 13 + f3) * 1.8 + Math.sin(k * 31 + f1) * 0.8 });
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
  else if (type === 'aa') {
    // anti-aircraft: a soldier with a launcher tube on his shoulder, pointing where he aims (up, at aircraft)
    const flip = Math.cos(aim) < 0; if (flip) c.scale(-1, 1);
    const a = flip ? Math.PI - aim : aim;
    c.beginPath(); c.arc(-0.1 * k, -0.62 * k, 0.24 * k, 0, Math.PI * 2);
    c.moveTo(-0.42 * k, -0.34 * k); c.lineTo(0.22 * k, -0.34 * k); c.lineTo(0.14 * k, 0.2 * k); c.lineTo(-0.34 * k, 0.2 * k); c.closePath();
    c.rect(-0.34 * k, 0.2 * k, 0.18 * k, 0.55 * k); c.rect(-0.04 * k, 0.2 * k, 0.18 * k, 0.55 * k);
    paint();
    c.save(); c.translate(0.05 * k, -0.42 * k); c.rotate(a);
    c.beginPath(); c.rect(-0.45 * k, -0.15 * k, 1.35 * k, 0.3 * k); paint();
    c.beginPath(); c.moveTo(0.9 * k, -0.15 * k); c.lineTo(1.12 * k, 0); c.lineTo(0.9 * k, 0.15 * k); c.closePath(); paint();
    c.restore();
  }
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

const ELEV = 8; // the sim's height grid step (ELEV_CELL)
// the height grid as a picture, one pixel per grid point, drawn stretched (smoothly) over the map: transparent on
// the plain, then from the grass's green through the hill's earth to its light top as it climbs; each point lit by
// how it faces a light in the north-west (so slopes read as slopes)
function relief(E) {
  const cv2 = document.createElement('canvas'); cv2.width = E.w; cv2.height = E.h;
  const c = cv2.getContext('2d'), img = c.createImageData(E.w, E.h), d = img.data, g = E.g;
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const G = rgb(colors.grass2), M = rgb(colors.hill), T = rgb(colors.hillHi), lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  for (let j = 0; j < E.h; j++) for (let i = 0; i < E.w; i++) {
    const k = j * E.w + i, e = g[k]; if (e <= 0) continue;
    const q = Math.min(1, e / 10), col = q < 0.3 ? lerp(G, M, q / 0.3) : lerp(M, T, (q - 0.3) / 0.7);
    const dx = (g[k + (i < E.w - 1 ? 1 : 0)] - g[k - (i > 0 ? 1 : 0)]), dy = (g[k + (j < E.h - 1 ? E.w : 0)] - g[k - (j > 0 ? E.w : 0)]);
    const lit = Math.max(-1, Math.min(1, (-dx - dy) * 0.4)), f = lit > 0 ? [255, 255, 240] : [0, 0, 0], amt = Math.abs(lit) * 0.2;
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
function drawTerrain(c, W, H, mid) {
  c.globalAlpha = 0.75;
  for (const p of decor.patches) { c.fillStyle = mix(colors.ground, colors.grass2, p.u, p.t); c.fill(p.p); }
  c.globalAlpha = 1;
  const n = decor.tufts.length;
  decor.tufts.forEach((p, k) => { c.fillStyle = shade(colors.grass2, -0.2 + 0.32 * k / (n - 1)); c.fill(p); });
  for (const f of decor.fields) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = shade(colors.field, f.t); c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    c.strokeStyle = shade(colors.field2, f.t); c.lineWidth = 3;
    for (let x = -f.w / 2 + 4; x < f.w / 2; x += f.gap) { c.beginPath(); c.moveTo(x, -f.h / 2); c.lineTo(x, f.h / 2); c.stroke(); }
    c.restore();
  }
  // lakes: shallow rim, water, a darker middle, a glint
  for (const k of decor.lakes) {
    c.fillStyle = shade(colors.waterEdge, 0.35 + k.t); c.globalAlpha = 0.6; c.fill(k.edge); c.globalAlpha = 1;
    c.fillStyle = shade(colors.water, k.t); c.fill(k.body);
    c.lineWidth = 2; c.strokeStyle = shade(colors.waterEdge, k.t); c.stroke(k.body);
    c.fillStyle = shade(colors.waterEdge, -0.1 + k.t); c.globalAlpha = 0.45; c.fill(k.deep); c.globalAlpha = 1;
    const l = k.l; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(l.x - l.rx * 0.25, l.y - l.ry * 0.3, l.rx * 0.3, l.ry * 0.25, l.a, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  }
  // hills: the relief (colour by height, lit from the north-west) blends into the grass; then the contour lines,
  // every fifth a little stronger
  const R = decor.hills, key = colors.hill + colors.ground + colors.grass2;
  if (R.theme !== key) { R.relief = relief(s.elev); R.theme = key; }
  c.drawImage(R.relief, -ELEV / 2, -ELEV / 2, R.relief.width * ELEV, R.relief.height * ELEV);
  c.strokeStyle = colors.hillLine; c.lineCap = 'round';
  R.contours.forEach((p, k) => { c.globalAlpha = (k + 1) % 5 ? 0.45 : 0.7; c.lineWidth = (k + 1) % 5 ? 1 : 1.6; c.stroke(p); });
  c.globalAlpha = 1;
  // roads (over the hills: they climb them): an edge, the dirt (width changes along the way), then faint wheel ruts
  c.lineCap = 'round'; c.lineJoin = 'round';
  // (their colours lean toward the grass, so a road doesn't glare over the land it crosses)
  for (const [col, extra] of [[mix(colors.roadEdge, colors.grass2, 0.3), 4], [mix(colors.road, colors.ground, 0.25), 0]]) {
    c.strokeStyle = col;
    for (const pts of decor.roads) for (let i = 1; i < pts.length; i++) { c.lineWidth = pts[i].w + extra; c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke(); }
  }
  c.strokeStyle = shade(colors.roadEdge, -0.05); c.lineWidth = 1; c.globalAlpha = 0.35;
  for (const pts of decor.roads) for (const side of [-2.2, 2.2]) {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const x = pts[i].x - dy / d * side, y = pts[i].y + dx / d * side; if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
  for (const t of decor.trees) {
    c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(t.x + 2, t.y + 3, t.r, t.r * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(colors.tree, t.t); ring(t.x, t.y, t.r); c.fill();
    c.fillStyle = shade(colors.treeHi, t.t); ring(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5); c.fill();
  }
  for (const r of decor.rocks) { c.fillStyle = shade(colors.rock, r.t); ring(r.x, r.y, r.r); c.fill(); }
}

// headquarters: a walled compound with a command building, a radio mast and the side's flag (about 46 × 38, so it
// fits at the map's edge where the HQ stands)
function drawHQ(c, x, y, col) {
  c.save(); c.translate(x, y); c.scale(0.8, 0.8); c.lineJoin = 'round';
  c.fillStyle = colors.shadow; c.beginPath(); c.ellipse(3, 5, 28, 22, 0, 0, Math.PI * 2); c.fill();
  // wall with corner towers
  c.fillStyle = HQ_WALL; c.strokeStyle = colors.outline; c.lineWidth = 1.5;
  c.beginPath(); c.rect(-24, -19, 48, 38); c.fill(); c.stroke();
  c.fillStyle = HQ_YARD; c.fillRect(-19, -14, 38, 28);
  for (const [tx, ty] of [[-24, -19], [24, -19], [-24, 19], [24, 19]]) { c.fillStyle = HQ_WALL; c.beginPath(); c.rect(tx - 5, ty - 5, 10, 10); c.fill(); c.stroke(); }
  // gate toward the enemy
  c.fillStyle = HQ_YARD; c.fillRect(x < s.W / 2 ? 19 : -25, -5, 6, 10);
  // command building in the side's colour, with a roof ridge
  c.fillStyle = col; c.beginPath(); c.rect(-11, -8, 22, 16); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(-11, 0); c.lineTo(11, 0); c.stroke();
  // radio mast
  c.strokeStyle = colors.outline; c.lineWidth = 1.5; c.beginPath(); c.moveTo(6, -8); c.lineTo(6, -30); c.stroke();
  c.beginPath(); c.arc(6, -30, 5, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.beginPath(); c.arc(6, -30, 9, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
  // flag
  c.beginPath(); c.moveTo(-6, -8); c.lineTo(-6, -38); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-6, -38); c.lineTo(10 * (x < s.W / 2 ? 1 : -1) - 6, -33); c.lineTo(-6, -28); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
const HQ_WALL = '#b8a47a', HQ_YARD = '#9c8b66';
// drone: a quadcopter from above — four rotors on an X frame
// what a squad is doing, under its target ring: a symbol, not a word
const ORDER_ICON = { hold: '⚓', attack: '⚔', retreat: '↩', support: '➕' }, AMMO = '#e0b020';
function drawDrone(c, x, y, k, col) {
  c.save(); c.translate(x, y); c.lineWidth = k * 0.16; c.strokeStyle = colors.outline;
  c.beginPath(); c.moveTo(-k * 0.7, -k * 0.7); c.lineTo(k * 0.7, k * 0.7); c.moveTo(k * 0.7, -k * 0.7); c.lineTo(-k * 0.7, k * 0.7); c.stroke();
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.fillStyle = colors.halo; c.beginPath(); c.arc(a * k * 0.7, b * k * 0.7, k * 0.42, 0, Math.PI * 2); c.fill();
    c.lineWidth = k * 0.1; c.strokeStyle = col; c.stroke();
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
  for (const q of s.squads) if (q.side === 'blue' && !q.dead) { const p = pos(q); hole(p.x, p.y, Sim.TYPES[q.type].sight + 30); }
  for (const n of s.nodes) if (n.side === 'blue' && s.t >= n.ready) hole(n.x, n.y, n.kind === 'drone' ? Sim.NODES.drone.r0 + 15 : n.kind === 'fhq' ? Sim.NODES.fhq.sight : n.kind === 'hq' ? Sim.STRUCTS.hq.sight + 20 : 120);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fogCv, 0, 0); ctx.restore();
}

// enemy as blobs of uncertainty: tight when just seen, spreading and fading with the age of the sighting
const STALE = 12, TRAIL = 8, BLOB_LIFE = 40, BLOB_R = 25, BLOB_MAX = 150, UNSURE = 4;
function drawEnemyIntel(c) {
  for (const q of s.squads) {
    const m = q.side === 'red' && s.mem.blue[q.id], age = m ? s.t - m.t : Infinity;
    if (!m || age > BLOB_LIFE) continue;
    // how fast it could have moved since: by type when identified, else by what's known (aircraft / ground / anything)
    const speed = m.type ? Sim.TYPES[m.type].speed : m.air ? Sim.TYPES.air.speed : m.air === false ? 50 : 70;
    const k = 1 - age / BLOB_LIFE, r = Math.min(BLOB_MAX, BLOB_R + speed * age * 0.5);
    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    g.addColorStop(0, hexA(colors.red, 0.4 * k + 0.1)); g.addColorStop(0.6, hexA(colors.red, 0.2 * k)); g.addColorStop(1, hexA(colors.red, 0));
    c.fillStyle = g; ring(m.x, m.y, r); c.fill();
    c.globalAlpha = 0.35 + 0.65 * k;
    // identification (our control where it is): type and size / only ground or air / only "something moves"
    if (m.lvl >= 1) { c.fillStyle = colors.red; ring(m.x, m.y, 11); c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke(); }
    else { c.fillStyle = hexA(colors.red, 0.35); ring(m.x, m.y, 11); c.fill(); c.lineWidth = 1.5; c.strokeStyle = colors.red; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    if (m.type) glyph(c, m.type, m.x, m.y, m.type === 'air' ? 8 : 6, '#fff', null, Math.PI, m.type === 'aa' ? -Math.PI / 2 : Math.PI);
    else if (m.air) glyph(c, 'air', m.x, m.y, 8, '#fff', null, -Math.PI / 2);
    else if (m.lvl === 1) { c.fillStyle = '#fff'; c.fillRect(m.x - 5, m.y - 3, 10, 6); }
    else label('?', m.x, m.y + 5, colors.red);
    // rough size: 1-3 dots from how many were seen (only when identified)
    const dots = !m.n ? 0 : m.n <= 2 ? 1 : m.n <= 4 ? 2 : 3; c.fillStyle = colors.red;
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
  if (!ghost && n.kind !== 'hq') {
    const k = !on ? (s.t - n.t0) / Math.max(0.01, n.ready - n.t0) : n.kind === 'drone' ? (n.until - s.t) / N.life : S.unit ? n.prog : 1;
    c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(n.x, n.y, 16 * big, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, k)) * Math.PI * 2); c.stroke();
  }
  if (n.kind === 'hq') drawHQ(c, n.x, n.y, col);
  else if (n.kind === 'drone') { c.globalAlpha = ghost ? 0.45 : on ? 1 : 0.55; drawDrone(c, n.x, n.y, 11, col); }
  else {
    c.fillStyle = colors.halo; ring(n.x, n.y, 13 * big); c.fill(); c.lineWidth = 1.5; c.strokeStyle = col; c.stroke();
    c.globalAlpha = ghost ? 0.45 : on ? 1 : 0.55; c.font = `${Math.round(16 * big)}px sans-serif`; c.fillText(S.icon, n.x, n.y + 6 * big);
  }
  c.globalAlpha = 1;
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
const MARK = { ack: '👌', contact: '⚔', hit: '💥', lost: '✖', ok: '✓', flag: '🚩', flagLost: '🏳', call: '📞', fhq: '🏕', nodeLost: '💥', ff: '⚠' };
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
    c.fillStyle = k.kind === 'lost' || k.kind === 'flagLost' || k.kind === 'ff' ? colors.red : colors.ink; c.fillText(MARK[k.kind], k.x, k.y - 44);
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
    if (u.side === 'blue' && isSel(u.squad)) {
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
  // player orders
  const labelSpots = [];
  for (const q of s.squads) {
    if (q.side !== 'blue' || q.dead) continue;
    let o = q.retreating ? { ...Sim.homeOf(s, q), r: 30, type: 'retreat' } : Sim.effOrder(s, q);
    if (o.target) o = { ...o, x: pos(o.target).x, y: pos(o.target).y };
    const on = isSel(q.id), p = pos(q);
    c.strokeStyle = colors.blue; c.globalAlpha = on ? 0.9 : 0.35; c.lineWidth = on ? 2 : 1.2;
    c.setLineDash(o.type === 'support' ? [2, 4] : [7, 5]); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(o.x, o.y); c.stroke();
    ring(o.x, o.y, o.r); c.stroke(); c.setLineDash([]);
    // "roger": the ring is where the commander understood the order; a cross marks what was actually asked
    if (o.want && Math.hypot(o.want.x - o.x, o.want.y - o.y) > 8) {
      const w = o.want; c.lineWidth = 1.5; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(w.x, w.y); c.lineTo(o.x, o.y); c.stroke(); c.setLineDash([]);
      c.lineWidth = 2; c.beginPath(); c.moveTo(w.x - 5, w.y - 5); c.lineTo(w.x + 5, w.y + 5); c.moveTo(w.x + 5, w.y - 5); c.lineTo(w.x - 5, w.y + 5); c.stroke();
    }
    const stack = labelSpots.filter(p => Math.hypot(p.x - o.x, p.y - o.y) < 30).length; labelSpots.push(o);
    label(ORDER_ICON[o.type], o.x, o.y + o.r + 14 + stack * 15, tcol(q.type));
    c.globalAlpha = 1;
  }
  // shots in flight: bullets (a quick bright dot), shells (a glowing round with a short streak), missiles (a body
  // with a smoke trail back to where it was fired)
  c.save(); c.lineCap = 'round';
  for (const sh of s.shots) {
    const k = Math.min(1, (sh.dur + 0.12 - sh.life) / sh.dur), x = sh.x1 + (sh.x2 - sh.x1) * k, y = sh.y1 + (sh.y2 - sh.y1) * k;
    const dx = sh.x2 - sh.x1, dy = sh.y2 - sh.y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (sh.kind === 'air' || sh.kind === 'aa') {
      const back = Math.min(d * k, 40);
      c.globalAlpha = 0.35 * (k < 1 ? 1 : sh.life / 0.12); c.strokeStyle = '#d8d8d0'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x - ux * back, y - uy * back); c.lineTo(x, y); c.stroke();
      if (k < 1) { c.globalAlpha = 1; c.strokeStyle = sh.kind === 'aa' ? '#fff1a8' : colors[sh.side]; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - ux * 5, y - uy * 5); c.lineTo(x, y); c.stroke(); c.fillStyle = '#ffb040'; ring(x - ux * 6, y - uy * 6, 1.6); c.fill(); }
    } else if (k < 1) {
      const tank = sh.kind === 'tank', len = tank ? 9 : 5;
      c.globalAlpha = 1; c.shadowColor = '#ffcf6a'; c.shadowBlur = tank ? 6 : 3; c.strokeStyle = tank ? '#ffe2a0' : '#fff6c8'; c.lineWidth = tank ? 2.6 : 1.4;
      c.beginPath(); c.moveTo(x - ux * len, y - uy * len); c.lineTo(x, y); c.stroke(); c.shadowBlur = 0;
    }
  }
  c.restore(); c.globalAlpha = 1;
  // units: exact picture without fog; under fog only what a drone is looking at right now
  const eyes = s.nodes.filter(n => n.side === 'blue' && n.kind === 'drone' && s.t >= n.ready), R = Sim.NODES.drone.r0;
  if (!s.fog) drawUnits(c, () => true);
  else if (eyes.length) {
    c.save(); c.beginPath(); for (const d of eyes) { c.moveTo(d.x + R, d.y); c.arc(d.x, d.y, R, 0, Math.PI * 2); } c.clip();
    drawUnits(c, u => eyes.some(d => Math.hypot(u.x - d.x, u.y - d.y) <= R + 10)); c.restore();
  }
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
    const x = p.x, y = p.y - 26, on = isSel(q.id);
    c.fillStyle = colors.shadow; ring(x + 1.5, y + 2.5, 12); c.fill();
    c.fillStyle = tcol(q.type); ring(x, y, 12); c.fill();
    c.lineWidth = on ? 3 : 1.5; c.strokeStyle = on ? colors.ink : '#fff'; c.stroke();
    glyph(c, q.type, x - (q.type === 'tank' ? 1.5 : 0), y, q.type === 'air' ? 8.5 : 6.5, '#fff', null, 0, q.type === 'aa' ? -Math.PI / 2 : 0);
    c.fillStyle = colors.shadow; c.fillRect(x - 12, y + 15, 24, 3);
    c.fillStyle = tcol(q.type); c.fillRect(x - 12, y + 15, 24 * Math.min(1, p.strength), 3);
    c.font = '11px sans-serif'; c.fillText(POSTURE[q.trait], x + 20, y + 4);
    if (s.fog) c.fillText(Sim.TEMPERS[q.temper].icon, x - 20, y + 4);
    if (stale) label('?', x - 17, y - 6, colors.ink);
    // why it's heading back: 🩹 fell back after heavy losses (to heal at home); aircraft show ammo, ⟳ = going to rearm
    if (q.retreating) { c.font = '15px sans-serif'; c.fillText('🩹', x, y - 18); }
    if (Sim.TYPES[q.type].ammo) {
      const m = s.units.filter(u => u.squad === q.id), A = Sim.TYPES[q.type].ammo;
      const k = m.length ? m.reduce((a, u) => a + (u.rearm ? 0 : u.ammo / A), 0) / m.length : 0;
      c.fillStyle = colors.shadow; c.fillRect(x - 12, y + 19, 24, 3); c.fillStyle = AMMO; c.fillRect(x - 12, y + 19, 24 * k, 3);
      if (m.some(u => u.rearm)) { c.font = '15px sans-serif'; c.fillText('⟳', x, y - 18); }
    }
    c.globalAlpha = 1;
  }
}

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
  c.fillStyle = colors.hill; for (const hl of s.hills) { c.beginPath(); c.arc(hl.x, hl.y, hl.r, 0, Math.PI * 2); c.fill(); }
  if (s.fog) { c.fillStyle = hexA(colors.blue, 0.12); for (const n of s.nodes) if (n.side === 'blue' && Sim.NODES[n.kind] && s.t >= n.ready) { c.beginPath(); c.arc(n.x, n.y, Sim.NODES[n.kind].r0, 0, Math.PI * 2); c.fill(); } }
  const dot = (x, y, r, col, sq) => { c.fillStyle = col; c.beginPath(); if (sq) c.rect(x - r, y - r, 2 * r, 2 * r); else c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  for (const n of s.nodes) if (nodeShown(n)) dot(n.x, n.y, 14, colors[n.side], true);
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { c.globalAlpha = 0.5; const n = s.memNodes.blue[id]; dot(n.x, n.y, 14, colors.red, true); c.globalAlpha = 1; }
  for (const q of s.squads) {
    if (q.dead) continue;
    if (q.side === 'blue') { const p = pos(q); if (p) dot(p.x, p.y, 20, tcol(q.type)); continue; }
    const e = s.fog ? s.mem.blue[q.id] : { x: q.cx, y: q.cy, t: s.t };
    if (e && s.t - e.t < 40) { c.globalAlpha = 1 - (s.t - e.t) / 40; dot(e.x, e.y, 20, colors.red); c.globalAlpha = 1; }
  }
  for (const f of s.marks) { c.strokeStyle = f.kind === 'lost' || f.kind === 'ff' || f.kind === 'nodeLost' ? colors.red : colors.ink; c.lineWidth = 10; c.beginPath(); c.arc(f.x, f.y, 40 + 30 * (s.t - f.t), 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = colors.ink; c.lineWidth = 2 / k; c.strokeRect(vr.x, vr.y, vr.w, vr.h);
}

// the selection rectangle while it's being drawn (screen pixels)
function drawBox() {
  if (!boxSel || !fit) return;
  const b = boxSel, c = ctx; c.save(); c.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
  c.fillStyle = hexA(colors.blue, 0.12); c.strokeStyle = colors.blue; c.lineWidth = 1.5; c.setLineDash([5, 4]);
  c.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  c.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  c.restore();
}
