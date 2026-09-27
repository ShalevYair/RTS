// Sim: creating a game, spawning units, squad body position, unit spacing
function spawn(s, sq, x, y) {
  const T = TYPES[sq.type], a = s.rand() * Math.PI * 2, m = Math.sqrt(s.rand());
  s.units.push({ id: s.nextId++, side: sq.side, squad: sq.id, type: sq.type,
    x: clamp(x + Math.cos(a) * m * 20, 5, s.W - 5), y: clamp(y + Math.sin(a) * m * 20, 5, H - 5),
    hp: T.hp, hd: sq.side === 'blue' ? 0 : Math.PI, aim: sq.side === 'blue' ? 0 : Math.PI, lastFire: -99, ammo: T.ammo || 0, rearm: false, rearmT: 0, cd: s.rand() * T.cd, sx: Math.cos(a) * m, sy: Math.sin(a) * m, engaged: false });
}

function makeBase(x, x0, x1) {
  const fac = {}; for (const t in FAC_Y) fac[t] = { x, y: FAC_Y[t] };
  return { x, y: H / 2, x0, x1, fac };
}

function create(seed = 1, W = 1000, diff = 'normal', win = WIN) {
  W = Math.max(700, Math.min(1500, Math.round(W) || 1000));
  const cx = W / 2, off = 0.17 * W;
  const s = { W, H, WIN: clamp(Math.round(win) || WIN, 30, 1000), t: 0, over: null, score: { blue: 0, red: 0 }, nextId: 1, rand: rng(seed),
    hills: [{ x: cx, y: 555, r: 75 }, { x: cx - off, y: 165, r: 60 }, { x: cx + off, y: 165, r: 60 }, { x: cx - off, y: 470, r: 55 }, { x: cx + off, y: 470, r: 55 }],
    points: [{ name: 'שדה קדמי', type: 'air', x: cx, y: 85 }, { name: 'מחנה', type: 'inf', x: cx, y: 240 },
             { name: 'מוסך', type: 'tank', x: cx, y: 400 }, { name: 'מכ"ם', type: 'aa', x: cx, y: 555 }]
      .map(p => ({ ...p, r: 40, owner: null, prog: 0, contested: false })),
    bases: { blue: makeBase(30, 0, 60), red: makeBase(W - 30, W - 60, W) },
    squads: [], units: [], shots: [], fx: [], log: [], aiIn: 0, noReinforce: false, stats: { rein: { blue: 0, red: 0 } }, fog: true, vis: { blue: new Set(), red: new Set() }, visSq: { blue: new Set(), red: new Set() }, mem: { blue: {}, red: {} }, rep: {}, marks: [], outbox: [], calls: [], nextCall: 1, hist: [], histIn: 0,
    log2: { orders: 0, delay: 0, answered: 0, missed: 0 },
    nodes: [], nextNode: 1, visNodes: { blue: new Set(), red: new Set() }, cd: { blue: { drone: 0, fhq: 0 }, red: { drone: 0, fhq: 0 } },
    reserve: { blue: RESERVE_START, red: RESERVE_START },
    tune: { resEvery: RESERVE_EVERY, resMax: RESERVE_MAX, point: REIN_PER_POINT, match: REIN_PER_MATCH, catchup: CATCHUP_MAX, capture: CATCHUP_CAPTURE }, diff: diff in DIFFS ? diff : 'normal' };
  const comp = [['א', 'inf', 6], ['ב', 'aa', 4], ['ג', 'tank', 3], ['ד', 'air', 2]];
  const blueTraits = ['aggressive', 'cautious', 'balanced', 'balanced'];
  const names = SURNAMES.slice();
  for (const side of ['blue', 'red']) {
    comp.forEach(([name, type, size], i) => {
      const temper = side === 'blue' ? Object.keys(TEMPERS)[Math.floor(s.rand() * 3)] : 'steady';
      const boss = names.splice(Math.floor(s.rand() * names.length), 1)[0];
      const b = s.bases[side];
      const sq = { id: side + i, side, name: TYPES[type].name, type, size, trait: side === 'blue' ? blueTraits[i] : 'balanced',
        order: { type: 'hold', x: b.x + (side === 'blue' ? 75 : -75), y: FAC_Y[type], r: ORDER_R.hold }, reinProg: 0,
        retreating: false, arrived: true, contactCd: 0, wasContact: false, dead: false,
        strength: 1, count: size, cx: b.x, cy: b.y, support: null, supportSince: 0, lastContact: -99, checkIn: 0,
        temper, boss, firmUntil: -99, lastCall: -99 };
      s.squads.push(sq);
      for (let k = 0; k < size; k++) spawn(s, sq, sq.order.x, sq.order.y);
      // real position from the start, so markers and order lines are right before the first step
      const c0 = bodyCenter(s.units.filter(u => u.squad === sq.id)); sq.cx = c0.x; sq.cy = c0.y;
    });
  }
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
  for (const u of us) { u.x = clamp(u.x, 5, s.W - 5); u.y = clamp(u.y, 5, H - 5); }
}
