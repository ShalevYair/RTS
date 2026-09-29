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
// (× s.scale: the big map 2×, the huge one 4×)
const buildLimit = (s, side) => (BUILD_BASE + BUILD_PER_NODE * alive(s, side, ['hq', 'fhq']).filter(n => s.t >= n.ready).length) * (s.scale || 1);
const buildCount = (s, side) => alive(s, side, PRODUCERS).length;
// why a building can't go at (x, y): '' when it can; 'q' poor control, 'limit' no free slot, 'gap' too close, 'bad' bad input
// (kind 'decoy': no slot, but at most DECOY_MAX of them)
function buildCheck(s, side, x, y, kind) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 20 || y < 20 || x > s.W - 20 || y > s.H - 20) return 'bad';
  if (s.hqPending && s.hqPending[side]) return 'nohq'; // (open field: the HQ first)
  if (kind === 'decoy' ? alive(s, side, ['decoy']).length >= DECOY_MAX : buildCount(s, side) >= buildLimit(s, side)) return 'limit';
  if (quality(s, side, { x, y }, true) < BUILD_MIN_Q) return 'q'; // drones don't count
  if (lakeAt(s, { x, y }, LAKE_PAD)) return 'bad';
  if (s.nodes.some(n => n.kind !== 'drone' && dist(n, { x, y }) < BUILD_GAP)) return 'gap';
  return '';
}
function build(s, side, kind, x, y) {
  if (s.over || !BUILDABLE.includes(kind) || (s.builds && !s.builds.includes(kind)) || (kind === 'decoy' && s.level) || buildCheck(s, side, x, y, kind)) return false;
  addStruct(s, side, kind, x, y);
  if (side === 'blue') note(s, `מתחילים לבנות ${STRUCTS[kind].name}`);
  return true;
}

// ---- open field: each side places its own HQ ----
const cmdSquad = (s, side) => s.squads.find(q => q.side === side && q.cmd && !q.dead);
// where a side may put its HQ: the first HQ_BAND of the width on its side, any height
const hqBand = (s, side) => side === 'blue' ? [30, s.W * HQ_BAND] : [s.W * (1 - HQ_BAND), s.W - 30];
// why the HQ can't go at (x, y): '' when it can; 'band' outside the allowed strip, 'bad' otherwise
function hqCheck(s, side, x, y) {
  if (!s.hqPending || !s.hqPending[side] || !cmdSquad(s, side) || s.nodes.some(n => n.side === side && n.kind === 'hq')) return 'bad';
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'bad';
  const [a, b] = hqBand(s, side);
  if (x < a || x > b || y < 30 || y > s.H - 30) return 'band';
  return lakeAt(s, { x, y }, LAKE_PAD) ? 'bad' : '';
}
// turn a normal opening into an open field: no HQ and no tent; a pair of command tanks by each side's edge
function openField(s) {
  s.nodes = s.nodes.filter(n => n.kind !== 'hq' && n.kind !== 'tent');
  for (const q of s.squads) if (q.home && !s.nodes.some(n => n.id === q.home)) q.home = null;
  for (const side of ['blue', 'red']) {
    const b = s.bases[side], dir = side === 'blue' ? 1 : -1, t = makeSquad(s, side, 'tank', null, b.x + dir * 50, s.H / 2);
    t.size = CMD_TANKS; fillSquad(s, t, t.order.x, t.order.y); t.cmd = true;
  }
  s.hqPending = { blue: true, red: true }; s.memNodes = { blue: {}, red: {} };
  updatePower(s); visibility(s); s.rep = {}; for (const q of s.squads) sendReport(s, q);
  return s;
}
// the command tanks drive to (x, y) and set the HQ up there (another order calls it off: pick again)
function planHq(s, side, x, y) {
  if (s.over || hqCheck(s, side, x, y)) return false;
  const sq = cmdSquad(s, side);
  order(s, sq.id, 'hold', x, y, true); sq.hqAt = { x, y };
  report(s, sq, 'יוצאים להקים את המפקדה');
  return true;
}
// every tick: the trip to the HQ's spot, its setting up, and the command tanks lost before it stands (= lost)
function hqTrips(s) {
  if (!s.hqPending) return;
  for (const side of ['blue', 'red']) {
    if (!s.hqPending[side]) continue;
    const h = s.nodes.find(n => n.side === side && n.kind === 'hq'), sq = cmdSquad(s, side);
    if (h) { if (s.t >= h.ready) { s.hqPending[side] = false; if (sq) sq.cmd = false; note(s, side === 'blue' ? 'המפקדה פועלת' : ''); } continue; }
    if (!sq) { s.hqDown = side; continue; }
    const p = sq.hqAt; if (!p) continue;
    const m = pending(s, sq.id, 'order'), o = m || sq.order, w = o.want || o;
    if (sq.retreating || o.type !== 'hold' || Math.hypot(w.x - p.x, w.y - p.y) > 1) { sq.hqAt = null; continue; }
    if (!m && (sq.arrived || Math.hypot(sq.cx - p.x, sq.cy - p.y) < 40)) {
      sq.hqAt = null; const n = addStruct(s, side, 'hq', p.x, p.y); n.ready = s.t + HQ_WARM;
      report(s, sq, 'מקימים את המפקדה');
    }
  }
}
// where a squad goes to fall back, heal and refill: its building, else the HQ, else any structure of its side
function homeOf(s, sq) {
  const h = sq.home && s.nodes.find(n => n.id === sq.home && n.hp > 0);
  return h || hqOf(s, sq.side) || alive(s, sq.side).find(n => n.kind !== 'drone' && n.kind !== 'decoy') || { x: sq.cx, y: sq.cy };
}
// aircraft rearm at the nearest working airfield, or at the HQ
function rearmSpot(s, u) {
  let best = hqOf(s, u.side), bd = best ? dist(u, best) : Infinity;
  for (const n of alive(s, u.side, ['airfield'])) if (s.t >= n.ready && dist(u, n) < bd) { bd = dist(u, n); best = n; }
  return best || s.bases[u.side];
}
// units heal near their own HQ, working buildings and forward HQs
const healSpot = (s, u) => s.nodes.some(n => n.side === u.side && n.hp > 0 && n.kind !== 'drone' && n.kind !== 'decoy' && s.t >= n.ready && dist(n, u) <= HEAL_R);

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
