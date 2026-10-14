// Marching in formation (several squads ordered together, far off — formation in command.js): the formation's middle
// drives a route round lakes, buildings and the ground the most limited of them can't cross (A* — path.js), at the
// slowest one's pace, each unit keeping its place in the formation the whole way, the whole formation turning with the
// route (MARCH_TURN). Where the way narrows (a gap between lakes, a row of buildings), it folds into a column as wide
// as the gap — as many abreast as fit, the rest behind, front rows first — and opens again past it (MARCH_WIDEN s of
// room). A unit a little ahead of its place (MARCH_AHEAD) doesn't drive back to it (it lets its place come to it); at
// the end each takes the nearest place of its kind there (marchSettle). The middle waits while one is more than MARCH_LAG
// behind its place (not one lost far off, past MARCH_LOST: stuck, or its order not there yet; not more than MARCH_HOLD s).
// And orders queued (Shift + click): s.ways — the squads go on to the next point once all of them are where they were
// sent (wayTick).
const MARCH_TURN = 0.9, MARCH_LAG = 130, MARCH_LOST = 380, MARCH_DS = 16, MARCH_LOOK = 90, MARCH_SIDE = 260, MARCH_HOLD = 4, MARCH_WIDEN = 2.5, MARCH_AHEAD = 60;

// the most limited way of moving among these units (wheels can't go in woods, tracks crawl there, feet are slowed)
const marchClass = us => { const c = new Set(us.map(u => moveClass(u.type))); return c.has('wheel') ? 'wheel' : c.has('track') ? 'track' : c.has('foot') ? 'foot' : 'commando'; };

// the march's route and how wide the way is along it: m.pts (from where they are), m.cum (the length to each point),
// m.w / m.o every MARCH_DS (the room across, and how far its middle is off the route — to the left +)
function marchPlan(s, m, us, sx, sy, x, y) {
  let pts = null, G = null;
  if (!s.noPath && s.W) {
    G = classGrid(s, pathGrid(s), marchClass(us));
    if (!pathClear(G, sx, sy, x, y)) pts = pathFind(s, G, sx, sy, x, y);
  }
  pts = [{ x: sx, y: sy }, ...(pts || [{ x, y }])];
  // (the corners rounded — twice cut, where the cut way is still clear: at a sharp corner every row swung across)
  for (let it = 0; it < 2 && G && pts.length > 2; it++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (i > 0) out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (i < pts.length - 2) out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    if (out.every((p, i) => !i || pathClear(G, out[i - 1].x, out[i - 1].y, p.x, p.y))) pts = out; else break;
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  m.pts = pts; m.cum = cum; m.L = cum[cum.length - 1];
  // (across the way at each step: free squares to each side, out to MARCH_SIDE)
  const n = Math.max(1, Math.ceil(m.L / MARCH_DS)); m.w = new Float32Array(n + 1); m.o = new Float32Array(n + 1);
  for (let k = 0; k <= n; k++) {
    if (!G) { m.w[k] = 1e9; continue; }
    const p = marchAt(m, k * MARCH_DS), a = marchDir(m, k * MARCH_DS), lx = -Math.sin(a), ly = Math.cos(a);
    const side = sgn => { let d = 0; for (; d < MARCH_SIDE; d += 8) { const qx = p.x + lx * sgn * (d + 8), qy = p.y + ly * sgn * (d + 8); if (qx < 0 || qy < 0 || qx > s.W || qy > s.H || G.b[pathCell(G, qx, qy)]) break; } return d; };
    const l = side(1), r = side(-1);
    m.w[k] = l + r >= 2 * MARCH_SIDE - 16 ? 1e9 : l + r; m.o[k] = (l - r) / 2;
  }
  // (the room's middle, smoothed along: from one square to the next it jumped about, and the column with it)
  const o = m.o.slice(); for (let k = 0; k < o.length; k++) { let a = 0, n = 0; for (let j = Math.max(0, k - 6); j <= Math.min(o.length - 1, k + 6); j++) { a += o[j]; n++; } m.o[k] = a / n; }
}
// the point on the route g along it, and the way it goes there
function marchAt(m, g) {
  const P = m.pts, C = m.cum; g = clamp(g, 0, m.L);
  let i = 1; while (i < P.length - 1 && C[i] < g) i++;
  const seg = C[i] - C[i - 1] || 1, f = clamp((g - C[i - 1]) / seg, 0, 1);
  return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * f, y: P[i - 1].y + (P[i].y - P[i - 1].y) * f };
}
function marchDir(m, g) {
  const a = marchAt(m, g), b = marchAt(m, Math.min(m.L, g + MARCH_LOOK));
  if (Math.hypot(b.x - a.x, b.y - a.y) < 4) { const c = marchAt(m, Math.max(0, g - MARCH_LOOK)); return Math.atan2(a.y - c.y, a.x - c.x); }
  return Math.atan2(b.y - a.y, b.x - a.x);
}
// the places folded into a column `cols` abreast: front first, left to right (cached)
function marchCols(m, cols) {
  if (!m.cols) m.cols = new Map();
  if (m.cols.has(cols)) return m.cols.get(cols);
  const g = m.slots.filter(t => !t.air).sort((a, b) => a.depth - b.depth || a.lat - b.lat), out = new Map(), d0 = g.length ? g[0].depth : 0;
  g.forEach((t, p) => out.set(t.id, { depth: d0 + Math.floor(p / cols) * m.sp * 1.15, lat: (p % cols - (cols - 1) / 2) * m.sp }));
  for (const t of m.slots) if (t.air) out.set(t.id, { depth: t.depth, lat: t.lat });
  m.cols.set(cols, out); return out;
}
const marchSpan = L => { let a = Infinity, b = -Infinity; for (const t of L.values()) { a = Math.min(a, t.depth); b = Math.max(b, t.depth); } return [a, b]; };
// the narrowest room from `back` behind g to `ahead` of it — and its middle's offset there
function marchRoom(m, g, ahead, back) {
  const k0 = Math.max(0, Math.floor((g - back) / MARCH_DS)), k1 = Math.min(m.w.length - 1, Math.ceil((g + ahead) / MARCH_DS));
  let w = 1e9, o = 0; for (let k = k0; k <= k1; k++) if (m.w[k] < w) { w = m.w[k]; o = m.o[k]; }
  return { w, o };
}
// once a tick (the first squad of the march to ask): on along the route, unless one is lagging; the formation's
// shape (open, or a column) and each squad's place in it — m.at
function marchTick(s, m, dt) {
  if (m.tk === s.tk) return; m.tk = s.tk;
  const ids = new Set(m.slots.map(t => t.id)), us = s.units.filter(u => ids.has(u.squad) && !TYPES[u.type].air);
  // (the shape here: the whole formation's room, from its front to its back — the column is longer, so twice)
  // (columns: 0 = open; narrower at once, wider only after MARCH_WIDEN s of room — changing shape every few steps,
  // as the room came and went, had them crossing over all the time)
  let need = 0, [d0, d1] = marchSpan(m.open), r = marchRoom(m, m.g, -d0 + 30, d1 + 30);
  if (r.w < m.F) { const c = Math.max(1, Math.floor(r.w / m.sp)); [d0, d1] = marchSpan(marchCols(m, c)); r = marchRoom(m, m.g, -d0 + 30, d1 + 30); if (r.w < m.F) need = Math.max(1, Math.min(c, Math.floor(r.w / m.sp))); }
  const cur = m.cur || 0;
  if (cur && (!need || need > cur)) { m.widen = (m.widen || 0) + dt; if (m.widen > MARCH_WIDEN) { m.cur = need; m.widen = 0; } }
  else { m.widen = 0; if (need) m.cur = need; }
  const lay = m.cur ? marchCols(m, m.cur) : m.open;
  m.narrow = !!m.cur;
  // (the way it faces: along the route)
  const want = marchDir(m, m.g);
  m.a = m.a === undefined ? want : turnTo(m.a, want, MARCH_TURN * dt);
  const dx = Math.cos(m.a), dy = Math.sin(m.a);
  // (each row where the route was / will be its depth behind / ahead of the middle — the column snakes along the
  // route, round a lake, not cutting across it)
  const d0p = marchDir(m, 0), d1p = marchDir(m, m.L), P0 = m.pts[0], P1 = m.pts[m.pts.length - 1];
  m.at = {};
  for (const [id, t] of lay) {
    let x, y, a; const gg = m.g - t.depth;
    if (gg < 0) { a = d0p; x = P0.x + Math.cos(a) * gg; y = P0.y + Math.sin(a) * gg; }
    else if (gg > m.L) { a = d1p; x = P1.x + Math.cos(a) * (gg - m.L); y = P1.y + Math.sin(a) * (gg - m.L); }
    else { const p = marchAt(m, gg); a = Math.abs(t.depth) < 1 ? m.a : marchDir(m, gg); x = p.x; y = p.y; }
    const k = clamp(Math.round(gg / MARCH_DS), 0, m.w.length - 1), lat = t.lat + (m.narrow ? m.o[k] : 0);
    m.at[id] = { x: clamp(x - Math.sin(a) * lat, 10, s.W - 10), y: clamp(y + Math.cos(a) * lat, 10, s.H - 10) };
  }
  // (on: unless one is behind its place — not one lost far off; not waiting more than MARCH_HOLD s on end, though:
  // one that can't get there is left to catch up)
  let lag = 0;
  for (const u of us) { const p = m.at[u.squad]; if (!p) continue; const a = (p.x - u.x) * dx + (p.y - u.y) * dy; if (a > lag && Math.hypot(p.x - u.x, p.y - u.y) < MARCH_LOST) lag = a; }
  const held = s.t >= m.t0 && lag >= MARCH_LAG; m.held = held ? (m.held || 0) + dt : 0;
  if (s.t >= m.t0 && (!held || m.held > MARCH_HOLD)) m.g = Math.min(m.L, m.g + m.v * dt);
  // (the middle there: the march is over — each to its place in the formation there, as any order; the places of a
  // kind given again by where they are now — the nearest first — so they don't cross over one another to get there)
  if (m.g >= m.L) { m.done = true; marchSettle(s, m); }
}
function marchSettle(s, m) {
  const qs = m.slots.map(t => s.squads.find(q => q.id === t.id)).filter(q => q && !q.dead && q.order.form && q.order.form.march === m && !TYPES[q.type].air);
  const byType = new Map(); for (const q of qs) { if (!byType.has(q.type)) byType.set(q.type, []); byType.get(q.type).push(q); }
  const ca = Math.cos(m.fa), sa = Math.sin(m.fa);
  for (const list of byType.values()) {
    if (list.length < 2) continue;
    const spots = list.map(q => ({ depth: q.order.form.depth, lat: q.order.form.lat })), pairs = [];
    list.forEach((q, i) => { const u = s.units.find(k => k.squad === q.id); if (!u) return; const f = q.order.form;
      spots.forEach((p, j) => pairs.push([Math.hypot(f.x - ca * p.depth - sa * p.lat - u.x, f.y - sa * p.depth + ca * p.lat - u.y), i, j])); });
    pairs.sort((a, b) => a[0] - b[0]);
    const qi = new Set(), sj = new Set();
    for (const [, i, j] of pairs) { if (qi.has(i) || sj.has(j)) continue; qi.add(i); sj.add(j); const f = list[i].order.form; f.depth = spots[j].depth; f.lat = spots[j].lat; }
  }
}
// the march going on (not over): its places move, nobody's 'arrived' on the way
const leadMarch = f => !!(f && f.march && f.march.lead && f.march.pts && !f.march.done);

// ---- orders queued: Shift + click adds a point; the squads go on once all of them alive are there ----
// s.ways: [{ ids, pts: [{ type, x, y, fa, move }], sent }] — sent: when the last point was given (−∞: their own orders)
function queueOrder(s, ids, type, x, y, fa, move) {
  if (!s.ways) s.ways = [];
  ids = ids.filter(id => { const q = s.squads.find(k => k.id === id); return q && !q.dead; });
  if (!ids.length || type === 'retreat') return false;
  let w = s.ways.find(v => v.ids.length === ids.length && ids.every(id => v.ids.includes(id)));
  if (!w) { unqueue(s, ids); w = { ids, pts: [], sent: -Infinity }; s.ways.push(w); }
  w.pts.push({ type, x, y, fa, move: !!move });
  return true;
}
// a new order for these squads (not queued): out of any queue
function unqueue(s, ids) { if (s.ways) { for (const w of s.ways) w.ids = w.ids.filter(id => !ids.includes(id)); s.ways = s.ways.filter(w => w.ids.length); } }
function wayTick(s) {
  if (!s.ways || !s.ways.length) return;
  for (const w of s.ways) {
    const qs = w.ids.map(id => s.squads.find(k => k.id === id)).filter(q => q && !q.dead); w.ids = qs.map(q => q.id);
    if (!qs.length || !w.pts.length) continue;
    // (all there: the order given since this point was sent, and arrived — a march over)
    if (!qs.every(q => q.arrived && (q.orderAt ?? -Infinity) >= w.sent && !leadMarch(q.order.form))) continue;
    const p = w.pts.shift(); w.sent = s.t;
    if (qs.length > 1) formation(s, w.ids, p.type, p.x, p.y, true, p.fa, undefined, { move: p.move });
    else order(s, w.ids[0], p.type, p.x, p.y, true, Number.isFinite(p.fa) || p.move ? { fa: p.fa, move: p.move } : undefined);
  }
  s.ways = s.ways.filter(w => w.ids.length && w.pts.length);
}
