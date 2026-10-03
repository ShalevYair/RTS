// Path finding for ground units: a grid of PATH_CELL squares over the map, blocked where a lake is (grown by
// PATH_PAD) and round every building and post (its r + PATH_PAD). A unit whose straight way to where it's going is
// blocked gets a path (A* on the grid, 8 ways, then pulled straight where it can see past a corner) and follows it
// point by point; the straight way clear, it goes straight, as before. Units bumping into units are still steer's.
// The grid is made again when the buildings change (lakes once a map); a path made on an older grid is dropped.
// At most PATH_BUDGET grid squares are searched a tick, all units together: the rest go straight and try next tick.
// With ground (terrain.js), each way of moving (moveClass) has its own view of the grid (classGrid): where it can't go
// at all is blocked like a building, and slow ground costs more (cost, in quarters: 4 = open) — a tank goes round a
// wood when that's quicker than through it.

// the grid: lakes once (s.lakes is the same list), the buildings and posts stamped on a copy when they change
function pathGrid(s) {
  const G0 = s.pathG;
  if (G0 && G0.t === s.t) return G0;
  const sig = pathSig(s);
  if (G0 && G0.sig === sig && G0.lakes === s.lakes && G0.W === s.W && G0.H === s.H) { G0.t = s.t; return G0; }
  const C = PATH_CELL, w = Math.ceil(s.W / C), h = Math.ceil(s.H / C);
  let base = G0 && G0.lakes === s.lakes && G0.W === s.W && G0.H === s.H ? G0.base : null;
  if (!base) {
    base = new Uint8Array(w * h);
    for (const l of s.lakes) {
      const R = Math.max(l.rx, l.ry) * 1.3 + PATH_PAD; // (the wobble reaches a little past the ellipse)
      const i0 = Math.max(0, Math.floor((l.x - R) / C)), i1 = Math.min(w - 1, Math.floor((l.x + R) / C));
      const j0 = Math.max(0, Math.floor((l.y - R) / C)), j1 = Math.min(h - 1, Math.floor((l.y + R) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (lakeK(l, { x: (i + 0.5) * C, y: (j + 0.5) * C }, PATH_PAD) < 1) base[j * w + i] = 1;
    }
  }
  const b = base.slice(), k = (G0 && G0.lakes === s.lakes && G0.W === s.W && G0.H === s.H ? G0.core0 : null) || coreLakes(s, w, h, C), core = k.slice();
  const stamp = (x, y, r) => {
    const R = r + PATH_PAD, Rc = r - PATH_CORE, i0 = Math.max(0, Math.floor((x - R) / C)), i1 = Math.min(w - 1, Math.floor((x + R) / C));
    const j0 = Math.max(0, Math.floor((y - R) / C)), j1 = Math.min(h - 1, Math.floor((y + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot((i + 0.5) * C - x, (j + 0.5) * C - y); if (d < R) b[j * w + i] = 1; if (d < Rc) core[j * w + i] = 1; }
  };
  for (const n of s.nodes) if (pathBlocks(n)) stamp(n.x, n.y, STRUCTS[n.kind].r);
  if (s.posts) for (const p of s.posts) stamp(p.x, p.y, POSTS[p.kind].r);
  const G = { t: s.t, sig, lakes: s.lakes, W: s.W, H: s.H, w, h, C, base, b, core0: k, core, v: (G0 ? G0.v : 0) + 1 };
  s.pathG = G; return G;
}
// the lakes themselves (no pad, a little inside the shore): what a straight way may never cross
function coreLakes(s, w, h, C) {
  const k = new Uint8Array(w * h);
  for (const l of s.lakes) {
    const R = Math.max(l.rx, l.ry) * 1.3;
    const i0 = Math.max(0, Math.floor((l.x - R) / C)), i1 = Math.min(w - 1, Math.floor((l.x + R) / C));
    const j0 = Math.max(0, Math.floor((l.y - R) / C)), j1 = Math.min(h - 1, Math.floor((l.y + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (lakeK(l, { x: (i + 0.5) * C, y: (j + 0.5) * C }, -PATH_CORE) < 1) k[j * w + i] = 1;
  }
  return k;
}
// one way of moving's view of the grid: b (blocked: the padded lakes and buildings, and ground it can't go on), core
// (never crossed: the lakes and buildings themselves, and that ground), cost (4 = open, more = slower ground; null =
// all open). Made once per grid; a wood cut down is put in at once (cutWood)
function classGrid(s, G, cls) {
  if (!s.ground) return G;
  if (!G.cls) G.cls = {};
  if (G.cls[cls]) return G.cls[cls];
  const N = G.w * G.h, b = G.b.slice(), core = G.core.slice(), cost = new Uint8Array(N).fill(4), K = s.ground.k;
  for (let c = 0; c < N; c++) if (K[c]) {
    const k = groundK(cls, K[c]);
    if (k <= 0) { b[c] = 1; core[c] = 1; } else cost[c] = Math.min(255, Math.round(4 / k));
  }
  return (G.cls[cls] = { w: G.w, h: G.h, C: G.C, b, core, cost });
}
const pathBlocks = n => n.kind !== 'drone' && n.hp > 0 && !!STRUCTS[n.kind];
// what the grid was made from: the buildings (where, how big) and the posts
function pathSig(s) {
  let h = s.nodes.length * 7919 + (s.posts ? s.posts.length : 0);
  for (const n of s.nodes) if (pathBlocks(n)) h = (h * 31 + n.id * 17 + Math.round(n.x) * 3 + Math.round(n.y)) % 1e9;
  return h;
}
const pathCell = (G, x, y) => clamp(Math.floor(y / G.C), 0, G.h - 1) * G.w + clamp(Math.floor(x / G.C), 0, G.w - 1);
// is the straight way from a to b clear? The padded ring round a building or lake at its start (a unit right by one)
// (up to PATH_LEAD of it) and at its end (a goal by or in one — a building attacked, up to PATH_END of it) doesn't count; a blocked stretch
// with clear ground beyond it does, a long one up to the goal (a lake between, the goal on its far shore), and the
// building or lake itself (core) anywhere but in that last stretch.
// (slow ground: the way is only clear over ground no slower than at its two ends)
function pathClear(G, ax, ay, bx, by) {
  const C = G.C, d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / (C * 0.5)));
  let free = false, wall = 0, hard = false;
  const cost = G.cost, ce = cost ? Math.max(cost[pathCell(G, ax, ay)], cost[pathCell(G, bx, by)]) : 0;
  for (let k = 0; k <= n; k++) {
    const c = pathCell(G, ax + (bx - ax) * k / n, ay + (by - ay) * k / n);
    if (cost && !G.b[c] && cost[c] > ce) return false;
    if (G.b[c]) { wall++; if (G.core[c]) hard = true; if (!free && wall * d / n > PATH_LEAD) return false; } // (the ring it stands in: only so deep — not on through a row of buildings)
    else { if (wall && (free || hard)) return false; free = true; wall = 0; hard = false; }
  }
  return wall * d / n <= PATH_END || !free;
}
// the nearest clear square to square c (a ring at a time, up to PATH_FIND rings); -1 if none
function pathFree(G, c) {
  if (!G.b[c]) return c;
  const ci = c % G.w, cj = Math.floor(c / G.w);
  for (let r = 1; r <= PATH_FIND; r++) {
    let best = -1, bd = Infinity;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= G.w || j >= G.h || (Math.abs(i - ci) < r && Math.abs(j - cj) < r)) continue;
      const k = j * G.w + i, dd = (i - ci) ** 2 + (j - cj) ** 2;
      if (!G.b[k] && dd < bd) { bd = dd; best = k; }
    }
    if (best >= 0) return best;
  }
  return -1;
}
// A* from (ax, ay) to (bx, by): the points to drive through (the last one = the goal itself), or null
// (s.pathUsed counts the squares searched this tick, against PATH_BUDGET)
function pathFind(s, G, ax, ay, bx, by) {
  const w = G.w, N = w * G.h, C = G.C;
  const a = pathFree(G, pathCell(G, ax, ay)), z = pathFree(G, pathCell(G, bx, by));
  if (a < 0 || z < 0) return null;
  if (a === z) return [{ x: bx, y: by }];
  let W = s.pathWork;
  if (!W || W.N !== N) W = s.pathWork = { N, g: new Float32Array(N), from: new Int32Array(N), seen: new Uint32Array(N), shut: new Uint32Array(N), id: 0, hf: new Float32Array(N * 4), hk: new Int32Array(N * 4) };
  const id = ++W.id, { g, from, seen, shut, hf, hk } = W; let hn = 0;
  const zi = z % w, zj = Math.floor(z / w);
  const hOf = k => { const dx = Math.abs(k % w - zi), dy = Math.abs(Math.floor(k / w) - zj); return (Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)) * PATH_GREED; };
  // (a binary heap on typed arrays: f and the square; a square may be in it more than once, the stale ones skipped)
  const push = (f, k) => {
    if (hn >= hf.length) return; let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hk[i] = hk[p]; i = p; }
    hf[i] = f; hk[i] = k;
  };
  const pop = () => {
    const top = hk[0], f = hf[--hn], k = hk[hn]; let i = 0;
    for (;;) { const l = 2 * i + 1; if (l >= hn) break; const m = l + 1 < hn && hf[l + 1] < hf[l] ? l + 1 : l; if (hf[m] >= f) break; hf[i] = hf[m]; hk[i] = hk[m]; i = m; }
    hf[i] = f; hk[i] = k; return top;
  };
  g[a] = 0; seen[a] = id; from[a] = -1; push(hOf(a), a);
  let found = false, used = 0;
  while (hn) {
    const k = pop();
    if (shut[k] === id) continue;
    shut[k] = id; used++;
    if (k === z) { found = true; break; }
    if (used > PATH_MAX) break;
    const i = k % w, j = Math.floor(k / w);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= G.h) continue;
      const nk = nj * w + ni;
      if (G.b[nk] || shut[nk] === id) continue;
      if (di && dj && (G.b[j * w + ni] || G.b[nj * w + i])) continue; // (no cutting a corner)
      const ng = g[k] + (di && dj ? 1.4142 : 1) * (G.cost ? G.cost[nk] / 4 : 1);
      if (seen[nk] === id && ng >= g[nk]) continue;
      seen[nk] = id; g[nk] = ng; from[nk] = k; push(ng + hOf(nk), nk);
    }
  }
  s.pathUsed = (s.pathUsed || 0) + used;
  if (!found) return null;
  const cells = []; for (let k = z; k >= 0; k = from[k]) cells.push(k);
  cells.reverse();
  // (pulled straight: from each point on along the squares while the next one is in plain sight; a turn where it isn't)
  const pt = k => ({ x: (k % w + 0.5) * C, y: (Math.floor(k / w) + 0.5) * C });
  const out = []; let at = { x: ax, y: ay };
  for (let i = 1; i < cells.length; i++) {
    const p = pt(cells[i]);
    if (i === cells.length - 1 || !pathClear(G, at.x, at.y, pt(cells[i + 1]).x, pt(cells[i + 1]).y)) { out.push(p); at = p; }
  }
  out.push({ x: bx, y: by });
  return out;
}
// where a ground unit should head this tick on its way to (tx, ty): the next point of its path, or straight there
function pathStep(s, u, tx, ty) {
  if (s.noPath || !s.W) return { x: tx, y: ty };
  if (s.pathTk !== s.t) { s.pathTk = s.t; s.pathUsed = 0; }
  const G = classGrid(s, pathGrid(s), moveClass(u.type)), V = s.pathG.v;
  let P = u.path;
  // (a path for somewhere else, or made on an older grid: dropped)
  if (P && (P.v !== V || Math.hypot(P.tx - tx, P.ty - ty) > PATH_RETARGET)) P = u.path = null;
  if (!P) {
    // (the straight way: looked at again every PATH_LOOK s, or when the goal moves)
    const L = u.pathLook;
    if (L && L.t > s.t && L.v === V && Math.hypot(L.tx - tx, L.ty - ty) < PATH_RETARGET * 0.5) return { x: tx, y: ty };
    if (pathClear(G, u.x, u.y, tx, ty)) { u.pathLook = { t: s.t + PATH_LOOK, v: V, tx, ty }; return { x: tx, y: ty }; }
    if (s.pathUsed > PATH_BUDGET) return { x: tx, y: ty }; // (enough searched this tick: next tick)
    const pts = pathFind(s, G, u.x, u.y, tx, ty);
    if (!pts) { u.pathLook = { t: s.t + PATH_FAIL, v: V, tx, ty }; return { x: tx, y: ty }; } // (no way there: straight, and not looked for again soon)
    P = u.path = { tx, ty, v: V, pts, i: 0 };
  }
  // (on to the next point once by it, or once the one after it is in plain sight)
  while (P.i < P.pts.length - 1 && (Math.hypot(P.pts[P.i].x - u.x, P.pts[P.i].y - u.y) < PATH_NEAR || pathClear(G, u.x, u.y, P.pts[P.i + 1].x, P.pts[P.i + 1].y))) P.i++;
  if (P.i >= P.pts.length - 1) { u.path = null; u.pathLook = { t: s.t + PATH_LOOK, v: V, tx, ty }; return { x: tx, y: ty }; }
  return P.pts[P.i];
}
