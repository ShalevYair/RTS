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
// hills: the small map keeps its fixed layout; a bigger one gets many, from the seed, mirrored so both sides
// get the same ground (plus a few on the centre line). Kept clear of the bases and each other.
function makeHills(s) {
  const W = s.W, h = s.H, cx = W / 2;
  if (h <= H) {
    const off = 0.17 * W;
    return [{ x: cx, y: 555, r: 75 }, { x: cx - off, y: 165, r: 60 }, { x: cx + off, y: 165, r: 60 }, { x: cx - off, y: 470, r: 55 }, { x: cx + off, y: 470, r: 55 }, { x: cx, y: 90, r: 55 }];
  }
  const out = [], free = (x, y, r) => out.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + HILL_GAP) &&
    !lakeAt(s, { x, y }, r + HILL_GAP);
  for (let i = 0, mid = 0; i < 200 && mid < 3; i++) {
    const r = 55 + s.rand() * 25, y = r + 20 + s.rand() * (h - 2 * r - 40);
    if (free(cx, y, r)) { out.push({ x: cx, y, r }); mid++; }
  }
  const want = Math.round(W * h / HILL_AREA);
  for (let i = 0; i < 2000 && out.length < want; i++) {
    const r = 40 + s.rand() * 40, x = HILL_CLEAR + r + s.rand() * (cx - HILL_CLEAR - 2 * r - 30), y = r + 10 + s.rand() * (h - 2 * r - 20);
    if (free(x, y, r) && free(W - x, y, r)) out.push({ x, y, r }, { x: W - x, y, r });
  }
  return out;
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
// lakes (ground units go around them): the small map has two, a taller one two more; mirrored like the hills
function makeLakes(s) {
  const W = s.W, ky = s.H / H;
  const out = [{ x: W * 0.36, y: 592 * ky, rx: 55, ry: 22, a: 0.1 }, { x: W * 0.64, y: 50 * ky, rx: 55, ry: 22, a: -0.1 }];
  if (ky > 1) out.push({ x: W * 0.2, y: s.H * 0.35, rx: 60, ry: 25, a: 0.2 }, { x: W * 0.8, y: s.H * 0.65, rx: 60, ry: 25, a: 0.2 });
  return out;
}

// mapH: the world's height (H = the small map; up to MAP_H_MAX for the big one, DESIGN.md §5)
function create(seed = 1, W = 1000, diff = 'normal', mapH = H) {
  const h = clamp(Math.round(mapH) || H, H, MAP_H_MAX);
  W = clamp(Math.round(W) || 1000, 700, MAP_W_MAX);
  const s = { W, H: h, t: 0, over: null, nextId: 1, nextSq: 0, rand: rng(seed), hills: [], lakes: [],
    bases: { blue: makeBase(30, 0, 60, h), red: makeBase(W - 30, W - 60, W, h) },
    squads: [], units: [], shots: [], fx: [], log: [], aiIn: { blue: 0, red: 0 }, noReinforce: false, stats: { rein: { blue: 0, red: 0 } }, fog: true,
    vis: { blue: new Set(), red: new Set() }, visSq: { blue: new Set(), red: new Set() }, mem: { blue: {}, red: {} }, memNodes: { blue: {}, red: {} },
    rep: {}, marks: [], outbox: [], calls: [], nextCall: 1, hist: [], histIn: 0, names: { blue: SURNAMES.slice(), red: SURNAMES.slice() }, lastBuild: {},
    log2: { orders: 0, delay: 0, answered: 0, missed: 0, off: 0, offN: 0, ff: 0 }, ff: [], power: { blue: 0, red: 0 }, peak: { blue: 0, red: 0 }, plan: { blue: 0, red: 0 },
    nodes: [], nextNode: 1, visNodes: { blue: new Set(), red: new Set() }, cd: { blue: { drone: 0, fhq: 0 }, red: { drone: 0, fhq: 0 } },
    diff: diff in DIFFS ? diff : 'normal', bots: ['red'], botDiff: 'normal', aiFhq: { blue: null, red: null } };
  s.lakes = makeLakes(s); s.hills = makeHills(s);
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
