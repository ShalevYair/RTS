// Ground (the full game on the big maps, with the extras): dense woods, mud and cliffs, on a grid of PATH_CELL
// squares (s.ground.k: GR_WOOD / GR_MUD / GR_CLIFF, GR_CUT = woods a tank or bulldozer broke through). Each kind of
// unit moves through them its own way (GROUND_K, by moveClass): soldiers go into the woods (a little slower) and the
// mud (half speed); tanks and bulldozers push through both at a tenth of their speed, and a wood square they go
// through is cut down for good (a lane others can use); wheels don't go in at all; cliffs stop everyone but the
// commando. Like the hills, our half is made first and the enemy's is its exact twin. Kept clear of the bases (the HQ
// strip) and of the posts; nothing is built on mud or a cliff, and a building on woods clears them.
const GR_WOOD = 1, GR_MUD = 2, GR_CLIFF = 3, GR_CUT = 4, GR_ROAD = 5; // (GR_ROAD: a bulldozer's road — roads.js)
// how a unit moves: 'foot' (soldiers), 'commando', 'track' (tanks, bulldozers), 'wheel' (all other ground vehicles)
const FOOT_TYPES = ['inf', 'aa', 'at', 'med'];
const moveClass = t => t === 'commando' ? 'commando' : FOOT_TYPES.includes(t) ? 'foot' : t === 'tank' || t === 'dozer' ? 'track' : 'wheel';

function makeGround(s) {
  const C = PATH_CELL, w = Math.ceil(s.W / C), h = Math.ceil(s.H / C), k = new Uint8Array(w * h), W = s.W, H = s.H;
  const r = rng(s.seed ^ 0x2545f491), huge = s.scale >= 4, cliffs = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : Math.floor(y / C) * w + Math.floor(x / C);
  const twin = p => ({ x: W - p.x, y: s.turn ? H - p.y : p.y });
  // (a spot for a feature of radius R on our half: off the HQ strip and the centre line, dry, clear of the posts and
  // of what's there already)
  const free = (p, R) => p.x - R > W * GROUND_X0 && p.x + R < W * GROUND_X1 && p.y - R > 20 && p.y + R < H - 20 &&
    !lakeAt(s, p, R * 0.6 + 20) && (s.posts || []).every(o => dist(o, p) > R + POSTS[o.kind].r + 50) && !k[at(p.x, p.y)];
  // (a square and its twin; force: over what's there — a cliff through a wood)
  const put = (x, y, kind, force) => { const c = at(x, y), q = twin({ x, y }), d = at(q.x, q.y); if (c >= 0 && (force || !k[c])) k[c] = kind; if (d >= 0 && (force || !k[d])) k[d] = kind; };
  // a blob (wobbly ellipse) of a kind, cell by cell
  const blob = (p, rx, ry, a, kind) => {
    const sh = [[0.18, 2, r() * 7], [0.1, 3, r() * 7], [0.06, 5, r() * 7]], R = Math.max(rx, ry) * 1.3, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = p.y - R; y <= p.y + R; y += C) for (let x = p.x - R; x <= p.x + R; x += C) {
      const dx = x - p.x, dy = y - p.y, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      if (u * u + v * v < wobble(sh, Math.atan2(v, u)) ** 2 && !lakeAt(s, { x, y }, 6)) put(x, y, kind);
    }
  };
  const [nW, nM, nC] = huge ? GROUND_N.huge : GROUND_N.big;
  // woods: on low ground
  for (let n = 0, i = 0; n < nW && i < 300; i++) {
    const R = GROUND_WOOD[0] + r() * (GROUND_WOOD[1] - GROUND_WOOD[0]), p = { x: W * (GROUND_X0 + r() * (GROUND_X1 - GROUND_X0)), y: R + r() * (H - 2 * R) };
    if (!free(p, R) || elevAt(s, p) > 2.5) continue;
    blob(p, R, R * (0.55 + r() * 0.4), r() * Math.PI, GR_WOOD); n++;
  }
  // mud: on a lake's shore, else on the plain
  const ours = s.lakes.filter(l => l.x < W / 2);
  for (let n = 0, i = 0; n < nM && i < 300; i++) {
    const R = GROUND_MUD[0] + r() * (GROUND_MUD[1] - GROUND_MUD[0]);
    let p;
    if (ours.length && i < 200) { const l = ours[Math.floor(r() * ours.length)], a = r() * Math.PI * 2, d = Math.max(l.rx, l.ry) * 0.9 + R * 0.5; p = { x: l.x + Math.cos(a) * d, y: l.y + Math.sin(a) * d }; }
    else p = { x: W * (GROUND_X0 + r() * (GROUND_X1 - GROUND_X0)), y: R + r() * (H - 2 * R) };
    if (!(p.x - R > W * GROUND_X0 && p.x + R < W * GROUND_X1 && p.y - R > 20 && p.y + R < H - 20) || (s.posts || []).some(o => dist(o, p) < R + POSTS[o.kind].r + 50) || elevAt(s, p) > 1.5) continue;
    blob(p, R, R * (0.5 + r() * 0.4), r() * Math.PI, GR_MUD); n++;
  }
  // cliffs: a stretch of a high hill's flank (where it's about halfway up), one side only — the rest of the hill
  // stays open, so there's always a way up
  const tall = s.hills.filter(f => f.x < W * GROUND_X1 && f.x > W * GROUND_X0 && f.lv >= 3);
  for (let n = 0, i = 0; n < nC && i < 60 && tall.length; i++) {
    const f = tall[Math.floor(r() * tall.length)], ca = Math.cos(f.a), sa = Math.sin(f.a);
    const span = GROUND_CLIFF_SPAN[0] + r() * (GROUND_CLIFF_SPAN[1] - GROUND_CLIFF_SPAN[0]), a0 = r() * Math.PI * 2, line = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const th = a0 + span * t, q = GROUND_CLIFF_AT * wobble(f.w, th), u = q * Math.cos(th) * f.r, v = q * Math.sin(th) * f.r * f.e;
      line.push({ x: f.x + u * ca - v * sa, y: f.y + u * sa + v * ca });
    }
    if (line.some(p => !(p.x > W * GROUND_X0 && p.x < W * GROUND_X1 && p.y > 10 && p.y < H - 10) || lakeAt(s, p, 20) || (s.posts || []).some(o => dist(o, p) < POSTS[o.kind].r + 60))) continue;
    // (cells within GROUND_CLIFF_W of the line)
    for (let j = 1; j < line.length; j++) {
      const a = line[j - 1], b = line[j], L = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(L / 4));
      for (let q = 0; q <= m; q++) {
        const x = a.x + (b.x - a.x) * q / m, y = a.y + (b.y - a.y) * q / m;
        for (let dy = -GROUND_CLIFF_W; dy <= GROUND_CLIFF_W; dy += 4) for (let dx = -GROUND_CLIFF_W; dx <= GROUND_CLIFF_W; dx += 4) if (dx * dx + dy * dy <= GROUND_CLIFF_W ** 2) put(x + dx, y + dy, GR_CLIFF, true);
      }
    }
    cliffs.push({ p: line, c: { x: f.x, y: f.y } }, { p: line.map(twin), c: twin(f) }); n++; // (c: the hill's middle — the cliff faces away from it)
  }
  // (nothing under a post)
  for (const o of s.posts || []) clearGround({ k, w, h, C }, o.x, o.y, POSTS[o.kind].r + 20);
  s.ground = { C, w, h, k, cliffs, cut: [] };
}
// the ground square at p (0 = nothing, or none at all)
const groundAt = (s, x, y) => {
  const G = s.ground; if (!G) return 0;
  const i = Math.floor(x / G.C), j = Math.floor(y / G.C);
  return i < 0 || j < 0 || i >= G.w || j >= G.h ? 0 : G.k[j * G.w + i];
};
// mud or a cliff within R of (x, y): nothing is built there (woods are cleared instead)
function groundBad(s, x, y, R) {
  const G = s.ground; if (!G) return false;
  for (let j = Math.max(0, Math.floor((y - R) / G.C)); j <= Math.min(G.h - 1, Math.floor((y + R) / G.C)); j++)
    for (let i = Math.max(0, Math.floor((x - R) / G.C)); i <= Math.min(G.w - 1, Math.floor((x + R) / G.C)); i++) {
      const k = G.k[j * G.w + i];
      if ((k === GR_MUD || k === GR_CLIFF) && Math.hypot((i + 0.5) * G.C - x, (j + 0.5) * G.C - y) < R + G.C * 0.5) return true;
    }
  return false;
}
// how fast a class goes on a kind of ground (0: it can't go there)
const groundK = (cls, kind) => kind && GROUND_K[cls][kind] !== undefined ? GROUND_K[cls][kind] : 1;
// clear the ground within R of (x, y) (a building put there, a post) — woods cut, mud and cliffs gone
function clearGround(G, x, y, R) {
  for (let j = Math.max(0, Math.floor((y - R) / G.C)); j <= Math.min(G.h - 1, Math.floor((y + R) / G.C)); j++)
    for (let i = Math.max(0, Math.floor((x - R) / G.C)); i <= Math.min(G.w - 1, Math.floor((x + R) / G.C)); i++)
      if (Math.hypot((i + 0.5) * G.C - x, (j + 0.5) * G.C - y) < R + G.C * 0.5 && G.k[j * G.w + i]) { G.k[j * G.w + i] = G.k[j * G.w + i] === GR_WOOD ? GR_CUT : 0; if (G.cut) G.cut.push(j * G.w + i); }
}
// a wood square cut down (by a tank / bulldozer going through): for good, and the path grids learn it at once
function cutWood(s, c) {
  const G = s.ground; if (G.k[c] !== GR_WOOD) return;
  G.k[c] = GR_CUT; G.cut.push(c); s.groundV = (s.groundV || 0) + 1;
  const P = s.pathG; if (P && P.cls) for (const cls in P.cls) { const g = P.cls[cls]; g.b[c] = P.b[c]; g.core[c] = P.core[c]; g.cost[c] = 8; }
}
// may a unit of this class stand at (x, y)? (only the ground: lakes and buildings are separate's)
const groundOk = (s, cls, x, y) => groundK(cls, groundAt(s, x, y)) > 0;
// how fast this unit goes here: by the ground under it — and for a tank / bulldozer, by what's just ahead (it slows
// to push into the woods, then the square is cut and it's through)
function groundSpeed(s, u, cls, vx, vy, d) {
  if (!s.ground) return 1;
  let k = groundK(cls, groundAt(s, u.x, u.y));
  if (cls === 'track' && d > 0) {
    // (the squares under its body are cut: a lane as wide as the tank, room for a jeep after it; it's slow while
    // there's wood just past what it's cutting)
    const G = s.ground, rb = TYPES[u.type].r + 4, R = rb + G.C * 0.25 + 3, ax = u.x + vx / d * R, ay = u.y + vy / d * R;
    if (groundAt(s, ax, ay) === GR_WOOD) k = Math.min(k, GROUND_K.track[GR_WOOD]);
    for (let j = Math.max(0, Math.floor((u.y - rb) / G.C)); j <= Math.min(G.h - 1, Math.floor((u.y + rb) / G.C)); j++)
      for (let i = Math.max(0, Math.floor((u.x - rb) / G.C)); i <= Math.min(G.w - 1, Math.floor((u.x + rb) / G.C)); i++) {
        const c = j * G.w + i;
        if (G.k[c] === GR_WOOD && Math.hypot((i + 0.5) * G.C - u.x, (j + 0.5) * G.C - u.y) < rb + G.C * 0.25) cutWood(s, c);
      }
  }
  return k;
}
