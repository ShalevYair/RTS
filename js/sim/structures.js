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
// (a bigger map: a bigger base allowance, but each HQ / forward HQ still adds the same)
const buildLimit = (s, side) => BUILD_BASE * (s.scale || 1) + BUILD_PER_NODE * alive(s, side, ['hq', 'fhq']).filter(n => s.t >= n.ready).length;
const buildCount = (s, side) => alive(s, side, PRODUCERS).length;
// why a building can't go at (x, y): '' when it can; 'q' poor control, 'limit' no free slot, 'gap' too close, 'bad' bad input
// (kind 'decoy': no slot, but at most DECOY_MAX of them)
function buildCheck(s, side, x, y, kind) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 20 || y < 20 || x > s.W - 20 || y > s.H - 20) return 'bad';
  if (s.hqPending && s.hqPending[side]) return 'nohq'; // (open field: the HQ first)
  if (kind === 'decoy' ? alive(s, side, ['decoy']).length >= DECOY_MAX : buildCount(s, side) >= buildLimit(s, side)) return 'limit';
  if (quality(s, side, { x, y }, true) < BUILD_MIN_Q) return 'q'; // drones don't count
  if (lakeAt(s, { x, y }, LAKE_PAD)) return 'bad';
  if (crowded(s, kind, x, y)) return 'gap';
  if (s.dozers && !dozers(s, side).length) return 'nodozer'; // (the full game: no bulldozer, no building)
  return '';
}
// a building of this kind at (x, y) would stand on another one (footprints closer than BUILD_GAP)
const crowded = (s, kind, x, y) => s.nodes.some(n => n.kind !== 'drone' && n.hp > 0 && dist(n, { x, y }) < STRUCTS[n.kind].r + (STRUCTS[kind] || STRUCTS.tent).r + BUILD_GAP);
// want: the bulldozer asked to build it (else the nearest free one)
function build(s, side, kind, x, y, want) {
  if (s.over || !BUILDABLE.includes(kind) || (s.builds && !s.builds.includes(kind)) || (kind === 'decoy' && s.level) || buildCheck(s, side, x, y, kind)) return false;
  if (s.dozers) addSite(s, side, kind, x, y, STRUCTS[kind].build || 10, want); else addStruct(s, side, kind, x, y);
  if (side === 'blue') note(s, `מתחילים לבנות ${STRUCTS[kind].name}`);
  return true;
}

// ---- support (the full game, s.dozers): bulldozers put up every building — only while one stands by the site —
// and signals trucks see far and give control around them; the HQ sends out another of each now and then ----
const dozers = (s, side) => s.squads.filter(q => q.side === side && q.type === 'dozer' && !q.dead);
const isSite = n => Number.isFinite(n.work); // (a building the bulldozers put up: n.work of n.need seconds done)
// a bulldozer's job now: the first building on its list still going up
const jobOf = (s, sq) => (sq.jobs || []).map(id => s.nodes.find(n => n.id === id)).find(n => n && n.hp > 0 && isSite(n) && s.t < n.ready) || null;
// the bulldozer for a new site: the one asked for, else the nearest one with nothing to do, else the nearest
function pickDozer(s, side, p, want) {
  const l = dozers(s, side); if (!l.length) return null;
  const w = want && l.find(q => q.id === want); if (w) return w;
  const free = l.filter(q => !jobOf(s, q) && !q.hqAt && !q.fhqAt), work = l.filter(q => !q.paused), pool = free.length ? free : work.length ? work : l;
  return pool.reduce((a, q) => Math.hypot(q.cx - p.x, q.cy - p.y) < Math.hypot(a.cx - p.x, a.cy - p.y) ? q : a);
}
// a site: the building stands there, not yet up, and a bulldozer has it on its list
function addSite(s, side, kind, x, y, work, want) {
  const n = addStruct(s, side, kind, x, y); n.ready = Infinity; n.work = 0; n.need = work;
  const d = pickDozer(s, side, n, want); if (d) assignSite(s, d, n);
  return n;
}
// put a site on a bulldozer's list and send it when it's next. The list goes in the order the sites were laid
// (buildings and forward HQs alike); `first` (the player tapping a site with this bulldozer picked): that one now —
// and a bulldozer the player had sent elsewhere goes back to work — then on down the list.
function assignSite(s, sq, n, first) {
  if (!sq || sq.type !== 'dozer' || !n || !isSite(n) || s.t >= n.ready) return false;
  const idle = !jobOf(s, sq);
  sq.jobs = (sq.jobs || []).filter(id => id !== n.id); if (first) sq.jobs.unshift(n.id); else sq.jobs.push(n.id);
  if (first || idle) sq.paused = false;
  if (!sq.paused && jobOf(s, sq) === n) goBuild(s, sq, n);
  return true;
}
// where the bulldozer works from: the site's back corner, clear of the building (it can't stand on it)
const dozerR = n => STRUCTS[n.kind].r + DOZER_R;
function dozerSpot(s, n) {
  const dir = n.side === 'blue' ? -1 : 1, k = STRUCTS[n.kind].r;
  return { x: clamp(n.x + dir * (k + 16), 10, s.W - 10), y: clamp(n.y + k + 12, 10, s.H - 10) };
}
function goBuild(s, sq, n) { const p = dozerSpot(s, n); order(s, sq.id, 'hold', p.x, p.y, true); sq.jobAt = n.id; }
// every tick: sites go up while a bulldozer of theirs stands still by them; a bulldozer done with one goes on to its next
function dozerWork(s, dt) {
  if (!s.dozers) return;
  for (const u of s.units) if (u.type === 'dozer') { u.still = !!u.at && Math.hypot(u.x - u.at.x, u.y - u.at.y) < 0.4; u.at = { x: u.x, y: u.y }; }
  for (const n of s.nodes) {
    if (!isSite(n) || n.hp <= 0 || s.t >= n.ready) continue;
    n.working = s.units.some(u => u.type === 'dozer' && u.side === n.side && u.still && dist(u, n) <= dozerR(n));
    if (!n.working) continue;
    n.work += dt * (s.prodRate ? s.prodRate[n.side] : 1);
    if (n.work >= n.need) { n.ready = s.t; if (n.side === 'blue' && n.kind !== 'hq') note(s, `${STRUCTS[n.kind].name} מוכן`); }
  }
  for (const sq of s.squads) {
    if (sq.type !== 'dozer' || sq.dead) continue;
    const n = jobOf(s, sq);
    if (!n) { sq.jobAt = null; continue; }
    if (sq.paused) continue;
    if (sq.jobAt !== n.id) { goBuild(s, sq, n); continue; }
    // sent elsewhere by the player (another order): it stops work until given a site again, then goes on in order
    const m = pending(s, sq.id, 'order'), o = m || sq.order, w = o.want || o, p = dozerSpot(s, n);
    if (o.type !== 'hold' || Math.hypot(w.x - p.x, w.y - p.y) > 2) { sq.paused = true; sq.jobAt = null; continue; }
    // (there, but stopped short of the site — orders are carried out roughly in the fog: the crew sees the site)
    const d = Math.hypot(sq.cx - n.x, sq.cy - n.y);
    if (sq.arrived && !m && d > dozerR(n) - 6 && d < 140 + STRUCTS[n.kind].r) { sq.order.x = p.x; sq.order.y = p.y; sq.arrived = false; }
  }
}
// a support squad of one, out of the HQ
function supportSquad(s, side, type, x, y) { const q = makeSquad(s, side, type, null, x, y); q.size = 1; fillSquad(s, q, x, y); return q; }
// every SUPPORT_EVERY s a working HQ sends out a bulldozer and a signals truck (while it has fewer than SUPPORT_CAP)
function supportSpawn(s, dt) {
  if (!s.dozers) return;
  for (const side of ['blue', 'red']) {
    const h = hqOf(s, side); if (!h || s.t < h.ready) continue;
    s.supNext[side] = (s.supNext[side] ?? SUPPORT_EVERY) - dt;
    if (s.supNext[side] > 0) continue;
    s.supNext[side] = SUPPORT_EVERY;
    const dir = side === 'blue' ? 1 : -1;
    for (const [type, dy, kind] of [['dozer', 30, 'dozerReady'], ['radio', -30, 'radioReady']]) {
      if (s.squads.filter(q => q.side === side && q.type === type && !q.dead).length >= SUPPORT_CAP) continue;
      const q = supportSquad(s, side, type, h.x + dir * 45, h.y + dy);
      if (side === 'blue') { report(s, q, type === 'dozer' ? 'טרקטור מוכן' : 'משאית קשר מוכנה'); s.marks.push({ x: q.cx, y: q.cy, kind, t: s.t, who: q.name, id: q.id }); }
    }
  }
}

// ---- open field: each side places its own HQ ----
const cmdSquad = (s, side) => s.squads.find(q => q.side === side && q.cmd && !q.dead);
// where a side may put its HQ: the first HQ_BAND of the width on its side, any height
const hqBand = (s, side) => side === 'blue' ? [30, s.W * HQ_BAND] : [s.W * (1 - HQ_BAND), s.W - 30];
// why the HQ can't go at (x, y): '' when it can; 'band' outside the allowed strip, 'bad' otherwise
function hqCheck(s, side, x, y) {
  if (!s.hqPending || !s.hqPending[side] || !cmdSquad(s, side) || s.nodes.some(n => n.side === side && n.kind === 'hq')) return 'bad';
  if (s.dozers && !dozers(s, side).length) return 'nodozer';
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
    supportSquad(s, side, 'dozer', b.x + dir * 30, s.H / 2 + 40); supportSquad(s, side, 'radio', b.x + dir * 30, s.H / 2 - 40);
  }
  s.dozers = true; s.supNext = { blue: SUPPORT_EVERY, red: SUPPORT_EVERY };
  s.hqPending = { blue: true, red: true }; s.memNodes = { blue: {}, red: {} };
  updatePower(s); visibility(s); s.rep = {}; for (const q of s.squads) sendReport(s, q);
  return s;
}
// the command tanks (with support: a bulldozer) drive to (x, y) and set the HQ up there (another order calls it off: pick again)
function planHq(s, side, x, y, want) {
  if (s.over || hqCheck(s, side, x, y)) return false;
  const sq = s.dozers ? pickDozer(s, side, { x, y }, want) : cmdSquad(s, side);
  for (const q of s.squads) if (q.side === side) q.hqAt = null;
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
    // (the HQ up: the first forward HQ a minute later)
    if (h) { if (s.t >= h.ready) { s.hqPending[side] = false; if (sq) sq.cmd = false; s.cd[side].fhq = Math.max(s.cd[side].fhq, FHQ_AFTER_HQ); note(s, side === 'blue' ? 'המפקדה פועלת' : ''); } continue; }
    if (!sq) { s.hqDown = side; continue; }
    // (who sets it up: the command tanks, or with support the bulldozer sent)
    const b = s.dozers ? s.squads.find(q => q.side === side && q.hqAt && !q.dead) : sq;
    const p = b && b.hqAt; if (!p) continue;
    const m = pending(s, b.id, 'order'), o = m || b.order, w = o.want || o;
    if (b.retreating || o.type !== 'hold' || Math.hypot(w.x - p.x, w.y - p.y) > 1) { b.hqAt = null; continue; }
    if (!m && (b.arrived || Math.hypot(b.cx - p.x, b.cy - p.y) < 40)) {
      b.hqAt = null;
      if (s.dozers) addSite(s, side, 'hq', p.x, p.y, HQ_WARM, b.id); else addStruct(s, side, 'hq', p.x, p.y).ready = s.t + HQ_WARM;
      report(s, b, 'מקימים את המפקדה');
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
      // a new squad (the first, or one raised again after it was wiped out) comes out whole; after losses it's
      // refilled one unit at a time
      n.prog = 0; const k = have || sq.born ? 1 : sq.size;
      for (let i = 0; i < k; i++) { spawn(s, sq, n.x, n.y); s.stats.rein[n.side]++; }
      if (have && have + 1 === sq.size) report(s, sq, 'הכוח מאויש במלואו');
    }
  }
  for (const n of s.nodes) if (n.gone) for (const side of ['blue', 'red']) delete s.memNodes[side][n.id];
  s.nodes = s.nodes.filter(n => !n.gone && n.until > s.t);
}
