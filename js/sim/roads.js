// Roads (the full game, s.dozers): a bulldozer paves them. The player lays one from a point to a point (planRoad); it
// goes on a bulldozer's work list like a building site (in order), and the bulldozer paves it square by square
// (PATH_CELL squares, s.ground), standing on each ROAD_T s — on mud ROAD_MUD_K times that, through a wood
// ROAD_WOOD_K. A paved square is road whatever was under it (mud, a wood): every ground unit goes ROAD_K faster on it,
// wheels included. Not across a lake or a cliff.
let roadN = 0;
// the ground grid, made empty where the map has none (the small map: no woods, mud or cliffs, but roads)
function ensureGround(s) {
  if (s.ground) return s.ground;
  const C = PATH_CELL, w = Math.ceil(s.W / C), h = Math.ceil(s.H / C);
  return (s.ground = { C, w, h, k: new Uint8Array(w * h), cliffs: [], cut: [] });
}
// the squares along a to b, in order (each once)
function roadCells(s, a, b) {
  const G = ensureGround(s), d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (G.C * 0.35))), out = [];
  for (let i = 0; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) continue;
    const c = Math.floor(y / G.C) * G.w + Math.floor(x / G.C);
    if (out[out.length - 1] !== c) out.push(c);
  }
  return out;
}
// why a road can't go from a to b: '' when it can; 'short', 'bad' (across a lake or a cliff, off the map), 'nodozer'
function roadCheck(s, side, a, b) {
  if (!s.dozers) return 'bad';
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return 'bad';
  if (Math.hypot(b.x - a.x, b.y - a.y) < ROAD_MIN) return 'short';
  if (!dozers(s, side).length) return 'nodozer';
  const G = ensureGround(s);
  for (const c of roadCells(s, a, b)) { const p = { x: (c % G.w + 0.5) * G.C, y: (Math.floor(c / G.w) + 0.5) * G.C }; if (G.k[c] === GR_CLIFF || lakeAt(s, p, 2)) return 'bad'; }
  return '';
}
// lay a road a → b (want: the bulldozer asked to pave it, else the nearest free one); returns it, or null
function planRoad(s, side, a, b, want) {
  if (s.over || roadCheck(s, side, a, b)) return null;
  const G = ensureGround(s), cells = roadCells(s, a, b).filter(c => G.k[c] !== GR_ROAD);
  if (!cells.length) return null;
  const r = { id: 'r' + (++roadN) + '_' + Math.round(s.t * 10), side, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, cells, i: 0, work: 0, road: true };
  roadAt(s, r);
  (s.roadJobs || (s.roadJobs = [])).push(r);
  const d = pickDozer(s, side, r, want);
  if (d) { d.jobs = d.jobs || []; d.jobs.push(r.id); if (!jobOf(s, d) || jobOf(s, d) === r) d.paused = false; }
  if (side === 'blue') note(s, 'מתחילים לסלול כביש');
  return r;
}
// where the road's work is now: the next square to pave (x, y), and how long it takes (need)
function roadAt(s, r) {
  const G = s.ground, c = r.cells[r.i];
  if (c === undefined) { r.done = true; return; }
  r.x = (c % G.w + 0.5) * G.C; r.y = (Math.floor(c / G.w) + 0.5) * G.C;
  r.need = ROAD_T * (G.k[c] === GR_MUD ? ROAD_MUD_K : G.k[c] === GR_WOOD ? ROAD_WOOD_K : 1);
}
const roadOf = (s, id) => (s.roadJobs || []).find(r => r.id === id);
// every tick: a road's next square goes down while a bulldozer of its side stands still on it (within ROAD_NEAR);
// paved, the bulldozer goes on to the next (sent again: jobAt cleared), and at the end on down its list
function roadWork(s, dt) {
  if (!s.roadJobs || !s.roadJobs.length) return;
  const G = s.ground;
  for (const r of s.roadJobs) {
    if (r.done) continue;
    // (a square paved meanwhile — another road over it — is skipped)
    while (!r.done && G.k[r.cells[r.i]] === GR_ROAD) { r.i++; r.work = 0; roadAt(s, r); }
    if (r.done) continue;
    r.working = s.units.some(u => u.type === 'dozer' && u.side === r.side && u.still && Math.hypot(u.x - r.x, u.y - r.y) <= ROAD_NEAR);
    if (!r.working) continue;
    r.work += dt * (s.prodRate ? s.prodRate[r.side] : 1);
    if (r.work < r.need) continue;
    const c = r.cells[r.i]; pave(s, c); r.i++; r.work = 0; roadAt(s, r);
    // (on to the next square: its bulldozer's order moved there at once — not a new message, slow in the fog)
    for (const q of s.squads) if (q.type === 'dozer' && q.jobAt === r.id) { if (r.done) q.jobAt = null; else { q.order = { ...q.order, x: r.x, y: r.y, want: { x: r.x, y: r.y } }; q.arrived = false; } }
    if (r.done && r.side === 'blue') note(s, 'הכביש מוכן');
  }
  s.roadJobs = s.roadJobs.filter(r => !r.done || s.t - (r.doneAt ?? (r.doneAt = s.t)) < 1);
}
// a square becomes road: whatever was there, gone; the path grids learn it at once
function pave(s, c) {
  const G = s.ground; G.k[c] = GR_ROAD; G.cut.push(c); (G.paved || (G.paved = [])).push(c); s.groundV = (s.groundV || 0) + 1;
  const P = s.pathG; if (P && P.cls) for (const cls in P.cls) { const g = P.cls[cls]; g.b[c] = P.b[c]; g.core[c] = P.core[c]; g.cost[c] = Math.round(8 / GROUND_K[cls][GR_ROAD]); }
}
