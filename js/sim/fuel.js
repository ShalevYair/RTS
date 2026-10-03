// Fuel (the full game: s.fuel, set by openField). Every vehicle and aircraft has a tank (u.fuel 0–1): ground vehicles
// and helicopters burn it only while they move — FUEL_T s of moving on a full tank —, planes all the time they fly
// (FUEL_AIR s; under PLANE_BACK they fly back to the airfield with their ammunition, and fill up there). Empty, a
// vehicle stands where it is (u.fuel 0: `dry`) until a fuel truck reaches it. Low (under FUEL_LOW) it goes by itself to
// the nearest fuel: a pile of barrels of its side, a fuel truck with a load, or slowly at an HQ / forward HQ.
// A barrel fills a jeep (FUEL_BARRELS[type] for a tank: 2). A fuel station (fuelst) makes a barrel every FUEL_MAKE s
// into its yard (FUEL_STOCK at most) and sends out up to `keep` fuel trucks; a truck (FUEL_LOAD barrels) takes a load
// from the yard and drops it at the front mark (a pile there, PILE_MAX at most) — or drives it to a vehicle that ran
// dry first. A missile that lands on a pile blows it up (special.js). The trucks themselves never run dry.
const needsFuel = type => type !== 'fueltruck' && (TYPES[type].air || !FOOT.includes(type));
const fuelT = type => TYPES[type].air && !TYPES[type].hover ? FUEL_AIR : FUEL_T;
const barrelsOf = type => FUEL_BARRELS[type] || 1;
// a pile of barrels: { id, side, x, y, n, node } — node: the station whose yard it is
function pileAt(s, side, x, y, node) {
  s.piles = s.piles || [];
  let p = s.piles.find(p => p.side === side && (node ? p.node === node : !p.node && Math.hypot(p.x - x, p.y - y) < 40));
  if (!p) s.piles.push(p = { id: 'f' + s.piles.length + '_' + Math.round(s.t), side, x, y, n: 0, node: node || null });
  return p;
}
// where a unit low on fuel goes: the nearest pile with barrels, truck with a load, or HQ / forward HQ of its side
function fuelSpot(s, u) {
  let best = null, bd = Infinity;
  const look = (p, d = dist(u, p)) => { if (d < bd) { bd = d; best = p; } };
  for (const p of s.piles || []) if (p.side === u.side && p.n > 0) look(p);
  for (const m of s.units) if (m.type === 'fueltruck' && m.side === u.side && (m.load || 0) > 0) look(m);
  for (const n of s.nodes) if (n.side === u.side && (n.kind === 'hq' || n.kind === 'fhq') && n.hp > 0 && s.t >= n.ready) look(n, dist(u, n) + FUEL_HQ_FAR); // (an HQ: slow — a pile a little farther still wins)
  return best;
}
// fill u from what's at p: barrels from a pile or a truck (a whole barrel at a time), or slowly at an HQ
function fillFrom(s, u, p, dt) {
  const per = barrelsOf(u.type);
  if (p.kind === 'hq' || p.kind === 'fhq') { u.fuel = Math.min(1, u.fuel + FUEL_HQ_RATE * dt); return; }
  const have = p.type === 'fueltruck' ? p.load || 0 : p.n;
  if (have <= 0 || u.fuel >= 0.999) return;
  const take = Math.min(have, Math.ceil((1 - u.fuel) * per - 1e-6));
  if (p.type === 'fueltruck') p.load -= take; else p.n -= take;
  u.fuel = Math.min(1, u.fuel + take / per);
}
// a unit's own fuel this tick (from updateUnit): planes turn back; one low goes to fill up (true = it's busy with that)
function fuelUnit(s, u, sq, dt) {
  if (!s.fuel || u.fuel === undefined) return false;
  const T = TYPES[u.type];
  if (T.air && !T.hover) { if (u.fuel < PLANE_BACK) u.rearm = true; return false; } // (planes: back to the airfield, see updateUnit)
  // (the nearest fuel, looked for every FUEL_LOOK s; it turns back in time to get there — FUEL_SPARE more than the
  // drive needs, at least FUEL_LOW: going by the bare quarter, units far out ran dry on the way back and stood)
  if (!(u.fuelAt > s.t)) { u.fuelAt = s.t + FUEL_LOOK; u.fuelTo = fuelSpot(s, u); }
  const p0 = u.fuelTo, need = p0 ? dist(u, p0) / Math.max(1, TYPES[u.type].speed) / fuelT(u.type) : 0;
  if (!u.refuel && u.fuel < Math.max(FUEL_LOW, need * FUEL_SPARE + 0.05)) u.refuel = true;
  else if (u.refuel && u.fuel >= FUEL_DONE) u.refuel = false;
  if (!u.refuel) return false;
  const live = q => q && (q.kind ? q.hp > 0 : q.type ? q.hp > 0 && q.load > 0 : q.n > 0); // (still there: a building up, a truck with a load, a pile not empty)
  const p = live(u.fuelTo) ? u.fuelTo : (u.fuelTo = fuelSpot(s, u));
  if (!p) return false; // (nowhere to go: on with what it was doing)
  const reach = p.kind ? nodeR(p) + FUEL_HQ_R : FUEL_R; // (an HQ: anywhere round it — its crowd of buildings kept some from its edge)
  if (dist(u, p) <= reach) fillFrom(s, u, p, dt); else moveTo(s, u, p.x, p.y, 1, dt);
  return true;
}
// every tick: burn what was burnt, the stations' barrels, the trucks
function fuelTick(s, dt) {
  if (!s.fuel) return;
  for (const u of s.units) {
    if (u.fuel === undefined) { if (needsFuel(u.type)) u.fuel = 1; else continue; }
    // (burnt by the way it actually went: a full tank is FUEL_T s of driving at its speed — pushing against a jam, or
    // standing, burns nothing; planes all the time they fly)
    const T = TYPES[u.type], flying = T.air && !T.hover, went = u.fx === undefined ? 0 : Math.hypot(u.x - u.fx, u.y - u.fy); u.fx = u.x; u.fy = u.y;
    if (flying) u.fuel = Math.max(0, u.fuel - dt / fuelT(u.type));
    else if (went > 0.01) u.fuel = Math.max(0, u.fuel - went / (Math.max(1, T.speed) * fuelT(u.type)));
    if (!u.fuel && !u.drySaid && u.side === 'blue' && !T.air) { u.drySaid = true; const q = s.squads.find(q => q.id === u.squad); if (q) report(s, q, 'נגמר הדלק'); }
    if (u.fuel > 0.05) u.drySaid = false;
  }
  // (stations: a barrel every FUEL_MAKE s into the yard)
  for (const n of s.nodes) {
    if (n.kind !== 'fuelst' || n.hp <= 0 || s.t < n.ready) continue;
    const dir = n.side === 'blue' ? -1 : 1, p = pileAt(s, n.side, n.x + dir * (nodeR(n) + 16), n.y + nodeR(n) * 0.6, n.id);
    n.fuelT = (n.fuelT || 0) + dt * (s.prodRate ? s.prodRate[n.side] : 1);
    if (n.fuelT >= FUEL_MAKE) { n.fuelT = 0; if (p.n < FUEL_STOCK) p.n++; }
  }
  // (a yard whose station is gone: its barrels with it)
  if (s.piles) s.piles = s.piles.filter(p => !p.node || s.nodes.some(n => n.id === p.node && n.hp > 0));
  // (trucks: who goes to which vehicle that ran dry — once a second, the nearest free truck with a load)
  if (Math.floor(s.t) !== Math.floor(s.t - dt)) for (const side of ['blue', 'red']) {
    const trucks = s.units.filter(m => m.type === 'fueltruck' && m.side === side);
    for (const m of trucks) if (m.job && !s.units.some(u => u.id === m.job && u.fuel < FUEL_LOW)) m.job = null;
    const dry = s.units.filter(u => u.side === side && u.fuel !== undefined && u.fuel <= 0.01 && !TYPES[u.type].air && !trucks.some(m => m.job === u.id));
    for (const u of dry) {
      const free = trucks.filter(m => !m.job && (m.load || 0) > 0);
      if (!free.length) break;
      free.reduce((a, m) => dist(m, u) < dist(a, u) ? m : a).job = u.id;
    }
  }
}
// a fuel truck's tick (from updateUnit, instead of its squad's order): a vehicle that ran dry first, then fill up at a
// station's yard, then the front; else wait by its station
function truckTick(s, u, sq, dt) {
  u.load = u.load || 0;
  const go = (p, r, then) => { if (dist(u, p) <= r) then(); else moveTo(s, u, p.x, p.y, 1, dt); };
  const v = u.job && s.units.find(m => m.id === u.job);
  if (v && u.load > 0) { go(v, FUEL_R, () => { fillFrom(s, v, u, dt); if (v.fuel >= FUEL_DONE || !u.load) u.job = null; }); return; }
  const yards = (s.piles || []).filter(p => p.side === u.side && p.node);
  const home = yards.find(p => p.node === (sq && sq.home)) || yards.reduce((a, p) => !a || dist(p, u) < dist(a, u) ? p : a, null);
  const f = s.front && s.front[u.side];
  if (u.load < FUEL_LOAD && home && (home.n > 0 || !u.load)) {
    if (home.n > 0) go(home, FUEL_R, () => { const k = Math.min(home.n, FUEL_LOAD - u.load); home.n -= k; u.load += k; });
    else go(home, FUEL_R + 20, () => {}); // (an empty yard: wait there for barrels)
    return;
  }
  if (f && u.load > 0) {
    // (the pile: a little behind the front mark, toward home — not in the line's way)
    const h = hqOf(s, u.side) || s.bases[u.side], d = Math.hypot(h.x - f.x, h.y - f.y) || 1, at = { x: f.x + (h.x - f.x) / d * PILE_BACK, y: f.y + (h.y - f.y) / d * PILE_BACK };
    const p = pileAt(s, u.side, at.x, at.y);
    if (p.n < PILE_MAX) { go(p, FUEL_R, () => { const k = Math.min(u.load, PILE_MAX - p.n); p.n += k; u.load -= k; }); return; }
  }
  if (home) go(home, FUEL_R + 30, () => {});
}
// a missile's blast at (x, y) within R: the piles there go up
function blastPiles(s, x, y, R) {
  for (const p of s.piles || []) if (p.n > 0 && Math.hypot(p.x - x, p.y - y) <= R) { p.n = 0; s.fx.push({ x: p.x, y: p.y, life: 1.1, max: 1.1, size: 30 }); if (p.side === 'blue') note(s, 'חביות הדלק התפוצצו'); }
}
