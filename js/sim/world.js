// Sim: creating a game, spawning units, squad body position, unit spacing
function spawn(s, sq, x, y) {
  const T = TYPES[sq.type], a = s.rand() * Math.PI * 2, m = Math.sqrt(s.rand());
  s.units.push({ id: s.nextId++, side: sq.side, squad: sq.id, type: sq.type,
    x: clamp(x + Math.cos(a) * m * 20, 5, s.W - 5), y: clamp(y + Math.sin(a) * m * 20, 5, s.H - 5),
    trophy: sq.type === 'tank' && s.trophy && s.trophy[sq.side] ? TROPHY_MAX : undefined,
    hp: T.hp, sup: 1, hd: sq.side === 'blue' ? 0 : Math.PI, aim: sq.side === 'blue' ? 0 : Math.PI, lastFire: -99, ammo: T.ammo || 0, rearm: false, rearmT: 0, cd: s.rand() * T.cd, sx: Math.cos(a) * m, sy: Math.sin(a) * m, engaged: false });
  // (a ground unit coming out by a lake: on its shore, not in it — a workshop by the water put a jeep in it)
  const u = s.units[s.units.length - 1];
  if (!T.air && s.lakes.length && lakeAt(s, u)) { const d = dryOf(s, u, 2); u.x = d.x; u.y = d.y; }
}

function makeBase(x, x0, x1, h) {
  return { x, y: h / 2, x0, x1 };
}
// The ground, new every game (from the seed, on its own random stream so it doesn't shift the rest of the game).
// Our half is made first; the enemy's is its twin — mirrored left-right or turned half a circle (picked per map),
// each feature nudged by up to MAP_JITTER and resized by up to MAP_RESIZE: close to fair, never identical.
// Mountains come as chains curling round a basin (with passes into it, and a lake in the hollow), plus a few long
// single ridges and hills on the centre line. Each hill is a long, uneven dome `lv` contour lines high; the height
// of the whole map is a grid (s.elev) made from them. Nothing within `clear` of either edge (the bases).
function makeTerrain(s) {
  const W = s.W, h = s.H, cx = W / 2, big = h > H, r = rng(s.seed ^ 0x5bd1e995);
  const clear = big ? HILL_CLEAR : clamp(0.2 * W, 140, HILL_CLEAR), J = big ? MAP_JITTER * 1.5 : MAP_JITTER;
  const turn = r() < 0.5, jit = () => (r() * 2 - 1) * J, size = v => v * (1 + (r() * 2 - 1) * MAP_RESIZE);
  const twin = f => ({ ...f, x: W - f.x + jit(), y: (turn ? h - f.y : f.y) + jit(), a: turn ? f.a : Math.PI - f.a });
  const lakes = [], hills = [];
  // a rim of a few waves (the outline wanders up to about ±SHAPE_AMP of the radius)
  const shape = () => [[SHAPE_AMP * (0.5 + r() * 0.5), 2, r() * 7], [SHAPE_AMP * 0.6 * r(), 3, r() * 7], [SHAPE_AMP * 0.35 * r(), 5, r() * 7]];
  const onMap = (f, R) => f.x - R >= clear && f.x + R <= W - clear && f.y - R >= 0 && f.y + R <= h;
  const dry = (f, R) => lakes.every(l => Math.hypot(l.x - f.x, l.y - f.y) > l.rx * 1.15 + R);
  // a long hill: major half-length `len`, width `wid` (as a share), along angle a, `lv` lines high
  const hill = (x, y, len, wid, a, lv) => ({ x, y, r: len, e: wid, a, lv: clamp(Math.round(lv), 1, HILL_LEVELS) });
  const addPair = (f, check = true) => {
    const g = { ...twin(f), r: size(f.r), lv: clamp(f.lv + Math.round(r() * 2 - 1), 1, HILL_LEVELS) };
    const R = f.r * f.e;
    if (check && !(onMap(f, R) && onMap(g, R) && dry(f, f.r * 0.7) && dry(g, g.r * 0.7))) return false;
    hills.push(f, g); return true;
  };
  // basins: a ring of ridges round a hollow, broken by passes; a lake in the middle
  // (the huge map, 4× the big one's area: 4× the basins and single ridges)
  const huge = h > 2 * H * 1.5, nb = huge ? 8 : big ? 2 : 1, room = cx - clear;
  for (let b = 0, tries = 0; b < nb && tries < 60 * nb; tries++) {
    const Rb = clamp(room * (big ? 0.3 : 0.5), 100, 300) * (0.85 + r() * 0.25);
    const c = { x: clear + Rb * 0.8 + r() * Math.max(1, room - Rb * 1.3), y: Rb + r() * Math.max(1, h - 2 * Rb) };
    if (hills.some(o => Math.hypot(o.x - c.x, o.y - c.y) < Rb * 1.5)) continue;
    const span = Math.PI * (1.2 + r() * 0.5), a0 = r() * 7, len = Rb * (0.5 + r() * 0.15), n = Math.max(3, Math.round(span * Rb / (len * 1.15)));
    const pass = 1 + Math.floor(r() * (n - 2)); // one more gap inside the arc, besides its open side
    const lk = { x: c.x, y: c.y, rx: Rb * (0.42 + r() * 0.12), ry: 0, a: r() * 3 };
    lk.ry = lk.rx * (0.55 + r() * 0.3);
    const lg = { ...twin(lk), rx: size(lk.rx), ry: size(lk.ry) };
    if (!onMap(lk, lk.rx + 20) || !onMap(lg, lg.rx + 20)) continue;
    lakes.push(lk, lg); b++;
    for (let i = 0; i < n; i++) {
      if (i === pass) continue;
      const t = n > 1 ? i / (n - 1) : 0.5, ang = a0 + span * t, rad = Rb * (1 + r() * 0.12);
      const lv = 2 + 6 * Math.sin(Math.PI * t) + r() * 3 - (big ? 0 : 1);
      addPair(hill(c.x + Math.cos(ang) * rad, c.y + Math.sin(ang) * rad, len * (0.9 + r() * 0.3), 0.45 + r() * 0.25, ang + Math.PI / 2 + (r() - 0.5) * 0.35, lv), false);
    }
  }
  // a few long single ridges and low hills elsewhere, clear of the basins
  const singles = huge ? 24 : big ? 6 : 2 + Math.floor(r() * 2);
  for (let i = 0, n = 0; i < 400 * (huge ? 4 : 1) && n < singles; i++) {
    const len = (big ? 90 : 60) + r() * (big ? 100 : 60), f = hill(clear + len * 0.6 + r() * Math.max(1, room - len), len * 0.5 + r() * (h - len), len, 0.35 + r() * 0.3, r() * Math.PI, 1 + Math.pow(r(), 1.5) * 7);
    if (hills.some(o => Math.hypot(o.x - f.x, o.y - f.y) < (o.r + len) * 0.75)) continue;
    if (addPair(f)) n++;
  }
  // on the centre line (they're their own twin)
  for (let i = 0, n = 0, want = big ? 2 : 1; i < 100 && n < want; i++) {
    const len = 50 + r() * 60, f = hill(cx + (r() - 0.5) * J, len + r() * (h - 2 * len), len, 0.35 + r() * 0.3, Math.PI / 2 + (r() - 0.5) * 0.8, 1 + r() * 5);
    if (!dry(f, len) || hills.some(o => Math.hypot(o.x - f.x, o.y - f.y) < (o.r + len) * 0.6)) continue;
    hills.push(f); n++;
  }
  for (const f of [...lakes, ...hills]) f.w = shape(); // twins get their own outline
  for (const f of hills) f.r *= HILL_SPREAD; // placed as before, then spread wide (same height)
  s.lakes = lakes; s.hills = hills; s.turn = turn;
  makeElevation(s);
}
// height of one hill at (x, y), in contour lines: a dome that rises to lv + 0.6 (so a 1-line hill has a top)
function hillHeight(f, x, y) {
  const c = Math.cos(f.a), sn = Math.sin(f.a), dx = x - f.x, dy = y - f.y;
  const u = (dx * c + dy * sn) / f.r, v = (-dx * sn + dy * c) / (f.r * f.e), q = Math.hypot(u, v);
  if (q >= 1.3) return 0;
  const t = q / wobble(f.w, Math.atan2(v, u));
  return t >= 1 ? 0 : (f.lv + 0.6) * (1 - Math.pow(t, 1.25));
}
// the height grid (every ELEV_CELL): the highest hill at each point
function makeElevation(s) {
  const gw = Math.ceil(s.W / ELEV_CELL) + 1, gh = Math.ceil(s.H / ELEV_CELL) + 1, g = new Float32Array(gw * gh);
  for (const f of s.hills) {
    const R = f.r * 1.3, i0 = Math.max(0, Math.floor((f.x - R) / ELEV_CELL)), i1 = Math.min(gw - 1, Math.ceil((f.x + R) / ELEV_CELL));
    const j0 = Math.max(0, Math.floor((f.y - R) / ELEV_CELL)), j1 = Math.min(gh - 1, Math.ceil((f.y + R) / ELEV_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const e = hillHeight(f, i * ELEV_CELL, j * ELEV_CELL); if (e > g[j * gw + i]) g[j * gw + i] = e; }
  }
  // lakes are flat; the ground flattens out toward either edge, so the bases always stand on the plain
  const clear = s.H > H ? HILL_CLEAR : clamp(0.2 * s.W, 140, HILL_CLEAR);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i, x = i * ELEV_CELL; if (!g[k]) continue;
    if (lakeAt(s, { x, y: j * ELEV_CELL }, 4)) { g[k] = 0; continue; }
    const edge = Math.min(x, s.W - x); if (edge < clear) g[k] *= clamp((edge - clear * 0.5) / (clear * 0.5), 0, 1);
  }
  s.elev = { w: gw, h: gh, g };
}

// a squad with its commander; `home` is the building that raises and refills it (null: no refills)
// a new commander: a name not in use, and (ours) a temper
function newBoss(s, side) {
  if (!s.names[side].length) s.names[side] = SURNAMES.slice();
  return { boss: s.names[side].splice(Math.floor(s.rand() * s.names[side].length), 1)[0], temper: side === 'blue' ? Object.keys(TEMPERS)[Math.floor(s.rand() * 3)] : 'steady' };
}
function makeSquad(s, side, type, home, x, y, trait = 'balanced') {
  const { boss, temper } = newBoss(s, side);
  const size = home ? STRUCTS[s.nodes.find(n => n.id === home).kind].size : 4;
  const sq = { id: side + s.nextSq++, side, name: TYPES[type].name, type, size, trait, home,
    order: { type: 'hold', x, y, r: ORDER_R.hold }, prodProg: 0,
    retreating: false, arrived: true, contactCd: 0, wasContact: false, dead: false,
    strength: 1, count: 0, cx: x, cy: y, support: null, supportSince: 0, lastContact: -99, checkIn: 0,
    temper, boss, firmUntil: -99, lastCall: -99, xp: 0, silent: false };
  s.squads.push(sq);
  return sq;
}
// the player's units are each their own squad (singles); the AI keeps its squads of several (its commanders sent
// singles in one at a time, and bot games stalled)
// (on when the game is made with { singles: true } — the UI's games; the tests' games keep squads)
const singles = (s, side) => !!s.singles && !(s.bots || []).includes(side);
// every unit its own squad (sq.single): n of them, one a squad, standing in a line across the way to the enemy at
// (x, y); home: the building that raised them (it refills them). Returns the squads.
function raiseSingles(s, side, type, home, x, y, n, trait) {
  const out = [], sp = TYPES[type].r * 2 + (FOOT.includes(type) ? LINE_GAP : VEH_GAP);
  for (let i = 0; i < n; i++) {
    const yy = clamp(y + (i - (n - 1) / 2) * sp, 10, s.H - 10), q = makeSquad(s, side, type, home, x, yy, trait);
    q.size = 1; q.single = true; spawn(s, q, x, yy); q.count = 1; q.cx = x; q.cy = yy; q.born = true; out.push(q);
  }
  return out;
}
const fillSquad = (s, sq, x, y) => {
  for (let k = 0; k < sq.size; k++) spawn(s, sq, x, y);
  const c0 = bodyCenter(s.units.filter(u => u.squad === sq.id)); sq.cx = c0.x; sq.cy = c0.y; sq.count = sq.size; sq.born = true;
};

// Opening (DESIGN.md §3): HQ, a tent with its infantry, and one jeep squad without a building
// mapH: the world's height (H = the small map; up to MAP_H_MAX for the big one, DESIGN.md §5)
function create(seed = 1, W = 1000, diff = 'normal', mapH = H, opts = {}) {
  // (opts.small: the tutorial's first levels may go under the small map's size)
  const h = clamp(Math.round(mapH) || H, opts.small ? 360 : H, MAP_H_MAX);
  W = clamp(Math.round(W) || 1000, opts.small ? 560 : 700, MAP_W_MAX);
  const s = { W, H: h, seed, t: 0, over: null, nextId: 1, nextSq: 0, rand: rng(seed), hills: [], lakes: [],
    bases: { blue: makeBase(30, 0, 60, h), red: makeBase(W - 30, W - 60, W, h) },
    squads: [], units: [], shots: [], fx: [], log: [], aiIn: { blue: 0, red: 0 }, noReinforce: false, stats: { rein: { blue: 0, red: 0 } }, fog: true,
    vis: { blue: new Set(), red: new Set() }, visSq: { blue: new Set(), red: new Set() }, mem: { blue: {}, red: {} }, memNodes: { blue: {}, red: {} },
    rep: {}, marks: [], outbox: [], calls: [], nextCall: 1, hist: [], histIn: 0, names: { blue: SURNAMES.slice(), red: SURNAMES.slice() }, lastBuild: {},
    log2: { orders: 0, delay: 0, answered: 0, missed: 0, off: 0, offN: 0, ff: 0 }, ff: [], power: { blue: 0, red: 0 }, peak: { blue: 0, red: 0 }, plan: { blue: 0, red: 0 },
    nodes: [], nextNode: 1, visNodes: { blue: new Set(), red: new Set() }, cd: { blue: { fhq: 0 }, red: { fhq: 0 } }, drones: { blue: { stock: 1, next: NODES.drone.every }, red: { stock: 1, next: NODES.drone.every } },
    diff: diff in DIFFS ? diff : 'normal', bots: ['red'], singles: !!opts.singles, botDiff: 'normal', aiFhq: { blue: null, red: null }, supply: true, fallen: [], night: true };
  s.log2.unclear = 0;
  // bigger maps allow more: the big one 2× the buildings and forward HQs, the huge one 4×
  s.scale = h > 2 * H * 1.5 ? 4 : h > H ? 2 : 1;
  // the enemy's style: from the seed, on its own stream
  const st = ['rush', 'turtle', 'flank', 'steady', 'missile'];
  s.style = { blue: 'steady', red: st[Math.floor(rng(seed ^ 0x2545f491)() * st.length)] };
  makeTerrain(s);
  for (const side of ['blue', 'red']) {
    const b = s.bases[side], dir = side === 'blue' ? 1 : -1;
    addStruct(s, side, 'hq', b.x + dir * (STRUCTS.hq.r - 30), h / 2, true); // (all of it on the map)
    const tent = addStruct(s, side, 'tent', b.x + dir * 75, h / 2 - 130, true);
    // (the player's: each soldier and jeep its own squad)
    const trait = side === 'blue' ? 'aggressive' : 'balanced';
    if (singles(s, side)) {
      const inf = raiseSingles(s, side, 'inf', tent.id, b.x + dir * 150, h / 2 - 130, STRUCTS.tent.size, trait);
      tent.squads = inf.map(q => q.id); tent.squad = inf[inf.length - 1].id;
      raiseSingles(s, side, 'jeep', null, b.x + dir * 150, h / 2 + 130, 4);
    } else {
      const inf = makeSquad(s, side, 'inf', tent.id, b.x + dir * 150, h / 2 - 130, trait);
      tent.squad = inf.id; fillSquad(s, inf, inf.order.x, inf.order.y);
      const jeep = makeSquad(s, side, 'jeep', null, b.x + dir * 150, h / 2 + 130);
      fillSquad(s, jeep, jeep.order.x, jeep.order.y);
    }
  }
  updatePower(s);
  visibility(s);
  for (const q of s.squads) sendReport(s, q);
  return s;
}

// Position of the squad's main body: the densest cluster, ignoring aircraft flying back
// to rearm. Reinforcements walking up from the base don't drag the squad's position back.
function bodyCenter(m) {
  const pool = m.some(u => !u.rearm) ? m.filter(u => !u.rearm) : m;
  let core = pool[0], bestN = -1;
  for (const a of pool) {
    let n = 0; for (const b of pool) if (Math.hypot(a.x - b.x, a.y - b.y) < 70) n++;
    if (n > bestN) { bestN = n; core = a; }
  }
  const g = pool.filter(u => Math.hypot(u.x - core.x, u.y - core.y) < 90);
  return { x: g.reduce((a, u) => a + u.x, 0) / g.length, y: g.reduce((a, u) => a + u.y, 0) / g.length };
}

// units don't stand on each other: overlapping ones are pushed apart; a tank goes over enemy soldiers
// instead, crushing them. Ground units are pushed out of buildings too.
// the room a unit takes: its body; the player's vehicles VEH_ROOM more (see config)
const bodyR = (s, u) => TYPES[u.type].r * (s.singles && !FOOT.includes(u.type) && !TYPES[u.type].air && singles(s, u.side) ? VEH_ROOM : 1);
function separate(s, dt = 0) {
  const us = s.units;
  // (pairs near each other only: a grid of squares as wide as the widest touch, each unit against the ones in its
  // square and the 8 round it. It was the units in order across the map, cut off past that width: in a battle,
  // with hundreds in a column, every one went over all the others above and below it)
  let maxR = 0; for (const u of us) maxR = Math.max(maxR, bodyR(s, u));
  const far = 2 * maxR + UNIT_GAP, G = new Map(), cell = u => Math.floor(u.x / far) * 65536 + Math.floor(u.y / far);
  // (in order across the map, as before: the same pairs in the same order, the same pushes)
  const xs = us.slice().sort((a, b) => a.x - b.x);
  xs.forEach((u, i) => { u.si = i; const k = cell(u); let l = G.get(k); if (!l) G.set(k, l = []); l.push(u); });
  const near = [];
  for (const a of xs) {
    const ra = bodyR(s, a), aAir = !TYPES[a.type].air, ci = Math.floor(a.x / far), cj = Math.floor(a.y / far);
    near.length = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = G.get((ci + di) * 65536 + cj + dj); if (l) for (const b of l) if (b.si > a.si) near.push(b); }
    near.sort((p, q) => p.si - q.si);
    {
      for (const b of near) {
      if (aAir !== !TYPES[b.type].air) continue; // air and ground don't collide
      const min = ra + bodyR(s, b) + UNIT_GAP, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const crush = a.side !== b.side && (a.type === 'tank' && FOOT.includes(b.type) ? b : b.type === 'tank' && FOOT.includes(a.type) ? a : null);
        if (crush) { crush.hp -= CRUSH_DPS * dt; crush.by = (crush === a ? b : a).squad; continue; }
        const d = Math.sqrt(d2) || 0.01, p = (min - d) / 2, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        const wa = MASS[a.type] || 1, wb = MASS[b.type] || 1; let ka = 2 * wb / (wa + wb), kb = 2 * wa / (wa + wb); // the heavier gives way less
        // (the player's units, one moving and the other standing: the standing one is pushed aside, the moving one
        // hardly — it goes through, as in other RTS games; it was stopped, and stood blocked behind a line)
        if (a.side === b.side && singles(s, a.side) && !s.noPush) { // (s.noPush: off, to compare)
          const am = a.moving === s.t, bm = b.moving === s.t;
          if (am && !bm) { ka = PUSH_THROUGH; kb = 2 - PUSH_THROUGH; } else if (bm && !am) { kb = PUSH_THROUGH; ka = 2 - PUSH_THROUGH; }
        }
        // (a little to the side as well, so two meeting head-on slide past each other instead of standing locked)
        const tx = nx - ny * SLIDE, ty = ny + nx * SLIDE;
        a.x -= tx * p * ka; a.y -= ty * p * ka; b.x += tx * p * kb; b.y += ty * p * kb;
      }
      }
    }
  }
  // (posts block the way too)
  const blocks = s.nodes.filter(n => n.kind !== 'drone' && n.hp > 0).map(n => ({ x: n.x, y: n.y, r: STRUCTS[n.kind].r }));
  if (s.posts) for (const p of s.posts) blocks.push({ x: p.x, y: p.y, r: POSTS[p.kind].r });
  // (each listed in the squares it reaches over, so a unit tests the ones by it only)
  const BC = 128, BG = new Map();
  for (const n of blocks) { const R = n.r + maxR; for (let i = Math.floor((n.x - R) / BC); i <= Math.floor((n.x + R) / BC); i++) for (let j = Math.floor((n.y - R) / BC); j <= Math.floor((n.y + R) / BC); j++) { const k = i * 65536 + j; let l = BG.get(k); if (!l) BG.set(k, l = []); l.push(n); } }
  for (const u of us) {
    if (!TYPES[u.type].air) for (const n of BG.get(Math.floor(u.x / BC) * 65536 + Math.floor(u.y / BC)) || []) {
      const r = n.r + TYPES[u.type].r, dx = u.x - n.x, dy = u.y - n.y, d2 = dx * dx + dy * dy;
      if (d2 < r * r) { const d = Math.sqrt(d2) || 0.01, nx = d2 ? dx / d : (u.side === 'blue' ? 1 : -1), ny = d2 ? dy / d : 0; u.x = n.x + nx * r; u.y = n.y + ny * r; }
    }
    u.x = clamp(u.x, 5, s.W - 5); u.y = clamp(u.y, 5, s.H - 5);
    if (!TYPES[u.type].air && lakeAt(s, u)) { const d = dryOf(s, u); u.x = d.x; u.y = d.y; } // pushed into a lake: back to the shore
  }
}
