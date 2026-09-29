// Sim: structures — the HQ, production buildings, forward HQs and drones; building, production,
// destruction, healing/rearming spots, and power (collapse victory + comeback boost).

function addStruct(s, side, kind, x, y, instant) {
  const S = STRUCTS[kind];
  const n = { id: s.nextNode++, kind, side, x, y, hp: S.hp, t0: s.t, ready: instant ? s.t : s.t + (S.build || 0), until: Infinity, squad: null, prog: 0 };
  s.nodes.push(n);
  return n;
}
const alive = (s, side, kinds) => s.nodes.filter(n => n.side === side && n.hp > 0 && (!kinds || kinds.includes(n.kind)));
const hqOf = (s, side) => s.nodes.find(n => n.side === side && n.kind === 'hq' && n.hp > 0);

// how many production buildings a side may have: BUILD_BASE + BUILD_PER_NODE per working HQ / forward HQ
const buildLimit = (s, side) => BUILD_BASE + BUILD_PER_NODE * alive(s, side, ['hq', 'fhq']).filter(n => s.t >= n.ready).length;
const buildCount = (s, side) => alive(s, side, PRODUCERS).length;
// why a building can't go at (x, y): '' when it can; 'q' poor control, 'limit' no free slot, 'gap' too close, 'bad' bad input
function buildCheck(s, side, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 20 || y < 20 || x > s.W - 20 || y > s.H - 20) return 'bad';
  if (buildCount(s, side) >= buildLimit(s, side)) return 'limit';
  if (quality(s, side, { x, y }, true) < BUILD_MIN_Q) return 'q'; // drones don't count
  if (lakeAt(s, { x, y }, LAKE_PAD)) return 'bad';
  if (s.nodes.some(n => n.kind !== 'drone' && dist(n, { x, y }) < BUILD_GAP)) return 'gap';
  return '';
}
function build(s, side, kind, x, y) {
  if (s.over || !PRODUCERS.includes(kind) || (s.builds && !s.builds.includes(kind)) || buildCheck(s, side, x, y)) return false;
  addStruct(s, side, kind, x, y);
  if (side === 'blue') note(s, `מתחילים לבנות ${STRUCTS[kind].name}`);
  return true;
}

// where a squad goes to fall back, heal and refill: its building, else the HQ, else any structure of its side
function homeOf(s, sq) {
  const h = sq.home && s.nodes.find(n => n.id === sq.home && n.hp > 0);
  return h || hqOf(s, sq.side) || alive(s, sq.side).find(n => n.kind !== 'drone') || { x: sq.cx, y: sq.cy };
}
// aircraft rearm at the nearest working airfield, or at the HQ
function rearmSpot(s, u) {
  let best = hqOf(s, u.side), bd = best ? dist(u, best) : Infinity;
  for (const n of alive(s, u.side, ['airfield'])) if (s.t >= n.ready && dist(u, n) < bd) { bd = dist(u, n); best = n; }
  return best || s.bases[u.side];
}
// units heal near their own HQ, working buildings and forward HQs
const healSpot = (s, u) => s.nodes.some(n => n.side === u.side && n.hp > 0 && n.kind !== 'drone' && s.t >= n.ready && dist(n, u) <= HEAL_R);

function power(s, side) {
  let p = 0;
  for (const u of s.units) if (u.side === side) p += UNIT_VALUE[u.type] * Math.max(0, u.hp) / TYPES[u.type].hp;
  for (const n of s.nodes) if (n.side === side && n.hp > 0) p += STRUCTS[n.kind].value * (n.hp / STRUCTS[n.kind].hp) * (s.t >= n.ready ? 1 : 0.5);
  return p;
}
function updatePower(s) {
  for (const side of ['blue', 'red']) { s.power[side] = power(s, side); s.peak[side] = Math.max(s.peak[side], s.power[side]); }
}
const share = (s, side) => { const a = s.power[side], b = s.power[side === 'blue' ? 'red' : 'blue']; return a + b > 0 ? a / (a + b) : 0.5; };
// the weaker side produces faster: 0 at an even share, BOOST_MAX at BOOST_FULL or below
const boost = (s, side) => BOOST_MAX * clamp((0.5 - share(s, side)) / (0.5 - BOOST_FULL), 0, 1);

// idle units near a damaged building of their side mend it (mechanics faster); n.fixing = being mended now
function repair(s, n, S, idle, dt) {
  n.fixing = false;
  if (n.hp >= S.hp || n.kind === 'drone') return;
  let k = 0;
  for (const u of idle) {
    if (u.side !== n.side || Math.hypot(u.x - n.x, u.y - n.y) > REPAIR_R) continue;
    k += u.type === 'mech' ? REPAIR_MECH : 1;
    if (k >= REPAIR_MAX) { k = REPAIR_MAX; break; }
  }
  if (k) { n.hp = Math.min(S.hp, n.hp + k * REPAIR_RATE * dt); n.fixing = true; }
}
function updateStructs(s, dt) {
  for (const side of ['blue', 'red']) for (const k in s.cd[side]) s.cd[side][k] = Math.max(0, s.cd[side][k] - dt);
  droneSupply(s, dt);
  const arrived = new Set(s.squads.filter(q => q.arrived && !q.dead && !q.retreating).map(q => q.id));
  const idle = s.units.filter(u => !TYPES[u.type].air && arrived.has(u.squad) && !u.care && !u.resup && !(s.t - u.lastFire < REPAIR_QUIET));
  for (const n of s.nodes) {
    const S = STRUCTS[n.kind];
    if (n.hp <= 0) {
      if (n.gone) continue;
      if (n.kind === 'hq') s.hqDown = n.side; // (step: that side has lost)
      n.gone = true; s.fx.push({ x: n.x, y: n.y, life: 0.9, max: 0.9, size: n.kind === 'drone' ? 18 : 34 });
      const sq = n.squad && s.squads.find(q => q.id === n.squad); if (sq) sq.home = null; // the squad fights on, without refills
      if (n.side === 'blue') { note(s, `${S.name}: ${n.kind === 'drone' ? 'הופל' : 'הושמד'}`); s.marks.push({ x: n.x, y: n.y, kind: 'nodeLost', t: s.t, who: n.kind }); }
      else if (n.kind !== 'drone') note(s, `השמדנו ${S.name} של האויב`);
      continue;
    }
    if (s.t < n.ready) continue;
    repair(s, n, S, idle, dt);
    if (n.kind === 'fhq' && n.side === 'blue' && !n.said) { n.said = true; note(s, 'הפיקוד הקדמי פועל'); }
    if (!S.unit) continue;
    // a finished building raises its squad, then keeps it full
    if (!n.squad) {
      const dir = n.side === 'blue' ? 1 : -1, sq = makeSquad(s, n.side, S.unit, n.id, n.x + dir * 60, n.y);
      n.squad = sq.id; sq.dead = true; // empty until the first unit comes out
      if (n.side === 'blue') note(s, `${S.name} מוכן, ${sq.name} מתחילים לצאת`);
    }
    const sq = s.squads.find(q => q.id === n.squad);
    if (!sq || s.noReinforce) continue;
    const have = s.units.filter(u => u.squad === sq.id).length;
    if (have >= sq.size) { n.prog = 0; continue; }
    n.prog += dt * (1 + boost(s, n.side)) * (s.prodRate ? s.prodRate[n.side] : 1) / S.every;
    if (n.prog >= 1) {
      n.prog = 0; spawn(s, sq, n.x, n.y); s.stats.rein[n.side]++;
      if (have + 1 === sq.size) report(s, sq, 'הכוח מאויש במלואו');
    }
  }
  for (const n of s.nodes) if (n.gone) for (const side of ['blue', 'red']) delete s.memNodes[side][n.id];
  s.nodes = s.nodes.filter(n => !n.gone && n.until > s.t);
}
