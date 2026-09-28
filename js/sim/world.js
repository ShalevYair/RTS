// Sim: creating a game, spawning units, squad body position, unit spacing
function spawn(s, sq, x, y) {
  const T = TYPES[sq.type], a = s.rand() * Math.PI * 2, m = Math.sqrt(s.rand());
  s.units.push({ id: s.nextId++, side: sq.side, squad: sq.id, type: sq.type,
    x: clamp(x + Math.cos(a) * m * 20, 5, s.W - 5), y: clamp(y + Math.sin(a) * m * 20, 5, s.H - 5),
    hp: T.hp, hd: sq.side === 'blue' ? 0 : Math.PI, aim: sq.side === 'blue' ? 0 : Math.PI, lastFire: -99, ammo: T.ammo || 0, rearm: false, rearmT: 0, cd: s.rand() * T.cd, sx: Math.cos(a) * m, sy: Math.sin(a) * m, engaged: false });
}

function makeBase(x, x0, x1, h) {
  return { x, y: h / 2, x0, x1 };
}
// The ground, new every game (from the seed, on its own random stream so it doesn't shift the rest of the game).
// Our half is made first; the enemy's is its twin — mirrored left-right or turned half a circle (picked per map),
// each feature nudged by up to MAP_JITTER and resized by up to MAP_RESIZE: close to fair, never identical.
// A few hills sit on the centre line. Nothing within `clear` of either edge (the bases), nothing overlapping.
function makeTerrain(s) {
  const W = s.W, h = s.H, cx = W / 2, big = h > H, r = rng(s.seed ^ 0x5bd1e995);
  const clear = big ? HILL_CLEAR : clamp(0.2 * W, 140, HILL_CLEAR), J = big ? MAP_JITTER * 1.5 : MAP_JITTER;
  const turn = r() < 0.5, jit = () => (r() * 2 - 1) * J, size = v => v * (1 + (r() * 2 - 1) * MAP_RESIZE);
  const twin = f => ({ ...f, x: W - f.x + jit(), y: (turn ? h - f.y : f.y) + jit() });
  const lakes = [], hills = [];
  const inside = (f, R) => f.x - R >= clear && f.x + R <= W - clear && f.y - R >= 10 && f.y + R <= h - 10;
  const lakeFree = (f, R) => inside(f, R) && lakes.every(l => Math.hypot(l.x - f.x, l.y - f.y) > l.rx + R + LAKE_GAP);
  const hillFree = (f, R) => inside(f, R) && hills.every(o => Math.hypot(o.x - f.x, o.y - f.y) > o.r + R + HILL_GAP) &&
    lakes.every(l => Math.hypot(l.x - f.x, l.y - f.y) > l.rx + R + HILL_GAP);
  // lakes: pairs (and on a big map sometimes one on the centre line)
  const lakePairs = big ? 2 + Math.floor(r() * 2) : W >= 1100 && r() < 0.5 ? 2 : 1;
  for (let i = 0, n = 0; i < 300 && n < lakePairs; i++) {
    const rx = 40 + r() * 25, ry = 16 + r() * 12, a = (r() - 0.5) * 1.2;
    const f = { x: clear + rx + r() * (cx - clear - 2 * rx - 20), y: ry + 20 + r() * (h - 2 * ry - 40), rx, ry, a };
    const g = { ...twin(f), rx: size(rx), ry: size(ry), a: turn ? a : -a };
    if (lakeFree(f, rx) && lakeFree(g, g.rx) && Math.hypot(f.x - g.x, f.y - g.y) > rx + g.rx + LAKE_GAP) { lakes.push(f, g); n++; }
  }
  if (big && r() < 0.5) for (let i = 0; i < 50; i++) {
    const f = { x: cx, y: 60 + r() * (h - 120), rx: 30 + r() * 15, ry: 45 + r() * 20, a: (r() - 0.5) * 0.4 };
    if (lakeFree(f, f.ry)) { lakes.push(f); break; }
  }
  // hills: one to three on the centre line, then pairs up to about one per HILL_AREA (small map: 6-8 in all)
  const mids = big ? 3 : 1 + Math.floor(r() * 2);
  for (let i = 0, n = 0; i < 200 && n < mids; i++) {
    const R = 50 + r() * 25, f = { x: cx + (r() - 0.5) * J, y: R + 20 + r() * (h - 2 * R - 40), r: R };
    if (hillFree(f, R)) { hills.push(f); n++; }
  }
  const want = big ? Math.round(W * h / HILL_AREA) : 6 + Math.floor(r() * 3);
  for (let i = 0; i < 3000 && hills.length < want; i++) {
    const R = (big ? 40 : 45) + r() * (big ? 40 : 25);
    const f = { x: clear + R + r() * (cx - clear - 2 * R - 30), y: R + 10 + r() * (h - 2 * R - 20), r: R };
    const g = { ...twin(f), r: size(R) };
    if (hillFree(f, R) && hillFree(g, g.r) && Math.hypot(f.x - g.x, f.y - g.y) > R + g.r + HILL_GAP) hills.push(f, g);
  }
  s.lakes = lakes; s.hills = hills; s.turn = turn;
}

// a squad with its commander; `home` is the building that raises and refills it (null: no refills)
function makeSquad(s, side, type, home, x, y, trait = 'balanced') {
  const temper = side === 'blue' ? Object.keys(TEMPERS)[Math.floor(s.rand() * 3)] : 'steady';
  if (!s.names[side].length) s.names[side] = SURNAMES.slice();
  const boss = s.names[side].splice(Math.floor(s.rand() * s.names[side].length), 1)[0];
  const size = home ? STRUCTS[s.nodes.find(n => n.id === home).kind].size : 4;
  const sq = { id: side + s.nextSq++, side, name: TYPES[type].name, type, size, trait, home,
    order: { type: 'hold', x, y, r: ORDER_R.hold }, prodProg: 0,
    retreating: false, arrived: true, contactCd: 0, wasContact: false, dead: false,
    strength: 1, count: 0, cx: x, cy: y, support: null, supportSince: 0, lastContact: -99, checkIn: 0,
    temper, boss, firmUntil: -99, lastCall: -99 };
  s.squads.push(sq);
  return sq;
}
const fillSquad = (s, sq, x, y) => {
  for (let k = 0; k < sq.size; k++) spawn(s, sq, x, y);
  const c0 = bodyCenter(s.units.filter(u => u.squad === sq.id)); sq.cx = c0.x; sq.cy = c0.y; sq.count = sq.size; sq.born = true;
};

// Opening (DESIGN.md §3): HQ, a tent with its infantry, and one jeep squad without a building
// mapH: the world's height (H = the small map; up to MAP_H_MAX for the big one, DESIGN.md §5)
function create(seed = 1, W = 1000, diff = 'normal', mapH = H) {
  const h = clamp(Math.round(mapH) || H, H, MAP_H_MAX);
  W = clamp(Math.round(W) || 1000, 700, MAP_W_MAX);
  const s = { W, H: h, seed, t: 0, over: null, nextId: 1, nextSq: 0, rand: rng(seed), hills: [], lakes: [],
    bases: { blue: makeBase(30, 0, 60, h), red: makeBase(W - 30, W - 60, W, h) },
    squads: [], units: [], shots: [], fx: [], log: [], aiIn: { blue: 0, red: 0 }, noReinforce: false, stats: { rein: { blue: 0, red: 0 } }, fog: true,
    vis: { blue: new Set(), red: new Set() }, visSq: { blue: new Set(), red: new Set() }, mem: { blue: {}, red: {} }, memNodes: { blue: {}, red: {} },
    rep: {}, marks: [], outbox: [], calls: [], nextCall: 1, hist: [], histIn: 0, names: { blue: SURNAMES.slice(), red: SURNAMES.slice() }, lastBuild: {},
    log2: { orders: 0, delay: 0, answered: 0, missed: 0, off: 0, offN: 0, ff: 0 }, ff: [], power: { blue: 0, red: 0 }, peak: { blue: 0, red: 0 }, plan: { blue: 0, red: 0 },
    nodes: [], nextNode: 1, visNodes: { blue: new Set(), red: new Set() }, cd: { blue: { drone: 0, fhq: 0 }, red: { drone: 0, fhq: 0 } },
    diff: diff in DIFFS ? diff : 'normal', bots: ['red'], botDiff: 'normal', aiFhq: { blue: null, red: null } };
  makeTerrain(s);
  for (const side of ['blue', 'red']) {
    const b = s.bases[side], dir = side === 'blue' ? 1 : -1;
    addStruct(s, side, 'hq', b.x, h / 2, true);
    const tent = addStruct(s, side, 'tent', b.x + dir * 75, h / 2 - 130, true);
    const inf = makeSquad(s, side, 'inf', tent.id, b.x + dir * 150, h / 2 - 130, side === 'blue' ? 'aggressive' : 'balanced');
    tent.squad = inf.id; fillSquad(s, inf, inf.order.x, inf.order.y);
    const jeep = makeSquad(s, side, 'jeep', null, b.x + dir * 150, h / 2 + 130);
    fillSquad(s, jeep, jeep.order.x, jeep.order.y);
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

function separate(s) {
  const us = s.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i], ra = TYPES[a.type].r;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (!TYPES[a.type].air !== !TYPES[b.type].air) continue; // air and ground don't collide
      const min = ra + TYPES[b.type].r + 2, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.01, p = (min - d) / 2, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
      }
    }
  }
  for (const u of us) {
    u.x = clamp(u.x, 5, s.W - 5); u.y = clamp(u.y, 5, s.H - 5);
    if (!TYPES[u.type].air && lakeAt(s, u)) { const d = dryOf(s, u); u.x = d.x; u.y = d.y; } // pushed into a lake: back to the shore
  }
}
