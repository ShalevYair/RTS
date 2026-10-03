// Fuel (the full game: s.fuel, set by openField). Every vehicle and aircraft has a tank (u.fuel 0–1): ground vehicles
// and helicopters burn it only while they move — FUEL_T s of moving on a full tank —, planes all the time they fly
// (FUEL_AIR s; under PLANE_BACK they fly back to the airfield with their ammunition, and fill up there). Empty, a
// vehicle stands where it is (u.fuel 0: `dry`) until a fuel truck reaches it. Low (under FUEL_LOW) it goes by itself to
// the nearest fuel: a pile of barrels of its side, a fuel truck with a load, or slowly at an HQ / forward HQ.
// A barrel fills a jeep (FUEL_BARRELS[type] for a tank: 2). A fuel station (fuelst) makes a barrel every FUEL_MAKE s
// into its yard (FUEL_STOCK at most) and sends out up to `keep` fuel trucks; a truck (FUEL_LOAD barrels) takes a load
// from the yard and drops it at the front mark (a pile there, PILE_MAX at most) — or drives it to a vehicle that ran
// dry first. A missile that lands on a pile blows it up (special.js). The trucks themselves never run dry.
// Ammunition crates (s.crates) go the same way: a supply depot's yard, supply trucks (`truck`) to the front, and a unit
// low on ammunition (u.resup, squad.js) goes to the nearest pile / loaded truck / HQ (ammoSpot) and takes a crate.
const needsFuel = type => type !== 'fueltruck' && (TYPES[type].air || !FOOT.includes(type));
const fuelT = type => TYPES[type].air && !TYPES[type].hover ? FUEL_AIR : FUEL_T;
const barrelsOf = type => FUEL_BARRELS[type] || 1;
// a pile: { id, side, x, y, n, node, k } — node: the station whose yard it is; k: 'fuel' (barrels) / 'ammo' (crates)
function pileAt(s, side, x, y, node, k = 'fuel') {
  s.piles = s.piles || [];
  let p = s.piles.find(p => p.side === side && p.k === k && (node ? p.node === node : !p.node && Math.hypot(p.x - x, p.y - y) < 40));
  if (!p) s.piles.push(p = { id: 'f' + s.piles.length + '_' + Math.round(s.t), side, x, y, n: 0, node: node || null, k });
  return p;
}
// what each kind of truck carries: from which station's yard, how much, every how long a unit, how much a yard holds
const CARGO = { fueltruck: { k: 'fuel', load: FUEL_LOAD, make: FUEL_MAKE, stock: FUEL_STOCK },
  truck: { k: 'ammo', load: CRATE_LOAD, make: CRATE_MAKE, stock: CRATE_STOCK } };
const cargoOn = (s, type) => type === 'fueltruck' ? s.fuel : type === 'truck' ? s.crates : false;
// where a side's trucks drop their load: the front mark; the AI (no front) — behind its leading squad, looked at
// every AI_DROP_T s (null near home: the yard is as good)
function dropAt(s, side) {
  const f = s.front && s.front[side];
  if (f) return f;
  if (!(s.bots || ['red']).includes(side)) return null;
  s.aiDrop = s.aiDrop || {};
  const c = s.aiDrop[side];
  if (c && s.t < c.t) return c.p;
  const home = hqOf(s, side) || s.bases[side], foe = hqOf(s, foeOf(side)) || s.bases[foeOf(side)];
  let best = null, bd = Infinity;
  for (const q of s.squads) if (q.side === side && !q.dead && q.count > 0 && !TYPES[q.type].care && !TYPES[q.type].air && !FRONT_NOT.includes(q.type)) { const d = Math.hypot(q.cx - foe.x, q.cy - foe.y); if (d < bd) { bd = d; best = q; } }
  let p = null;
  // (no farther than halfway to the enemy: past that the trucks drove into its fire)
  if (best) { const d = Math.hypot(best.cx - home.x, best.cy - home.y), k = Math.min(d - PILE_BACK * 2, Math.hypot(foe.x - home.x, foe.y - home.y) / 2) / (d || 1); if (d > 300) p = { x: home.x + (best.cx - home.x) * k, y: home.y + (best.cy - home.y) * k }; }
  s.aiDrop[side] = { t: s.t + AI_DROP_T, p };
  return p;
}
// where a unit low on fuel goes: the nearest pile with barrels, truck with a load, or HQ / forward HQ of its side
function fuelSpot(s, u) {
  let best = null, bd = Infinity;
  const look = (p, d = dist(u, p)) => { if (d < bd) { bd = d; best = p; } };
  for (const p of s.piles || []) if (p.side === u.side && p.k === 'fuel' && p.n > 0) look(p);
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
  if (!s.fuel && !s.crates) return;
  if (s.crates) ammoTick(s, dt);
  if (s.fuel) for (const u of s.units) {
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
    const C = n.kind === 'fuelst' && s.fuel ? CARGO.fueltruck : n.kind === 'depot' && s.crates ? CARGO.truck : null;
    if (!C || n.hp <= 0 || s.t < n.ready) continue;
    const dir = n.side === 'blue' ? -1 : 1, p = pileAt(s, n.side, n.x + dir * (nodeR(n) + 16), n.y + nodeR(n) * 0.6, n.id, C.k);
    n.fuelT = (n.fuelT || 0) + dt * (s.prodRate ? s.prodRate[n.side] : 1);
    if (n.fuelT >= C.make) { n.fuelT = 0; if (p.n < C.stock) p.n++; }
  }
  // (a yard whose station is gone: its barrels with it)
  // (and one at the front that's been used up: gone)
  if (s.piles) s.piles = s.piles.filter(p => p.node ? s.nodes.some(n => n.id === p.node && n.hp > 0) : p.n > 0 || s.units.some(m => CARGO[m.type] && CARGO[m.type].k === p.k && m.side === p.side && m.load > 0 && dist(m, p) < 300)); // (one a truck is on its way to drop at: kept)
  // (trucks: who goes to which vehicle that ran dry — once a second, the nearest free truck with a load)
  if (s.fuel && Math.floor(s.t) !== Math.floor(s.t - dt)) for (const side of ['blue', 'red']) {
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
// a fuel / supply truck's tick (from updateUnit, instead of its squad's order — fuel trucks with s.fuel, supply trucks
// with s.crates): a vehicle that ran dry first (fuel), then fill up at a station's yard, then the front; else wait by
// its station
function truckTick(s, u, sq, dt) {
  u.load = u.load || 0;
  const C = CARGO[u.type], go = (p, r, then) => { if (dist(u, p) <= r) then(); else moveTo(s, u, p.x, p.y, 1, dt); };
  const v = C.k === 'fuel' && u.job && s.units.find(m => m.id === u.job);
  if (v && u.load > 0) { go(v, FUEL_R, () => { fillFrom(s, v, u, dt); if (v.fuel >= FUEL_DONE || !u.load) u.job = null; }); return; }
  const yards = (s.piles || []).filter(p => p.side === u.side && p.node && p.k === C.k);
  const home = yards.find(p => p.node === (sq && sq.home)) || yards.reduce((a, p) => !a || dist(p, u) < dist(a, u) ? p : a, null);
  const f = dropAt(s, u.side);
  if (u.load < C.load && home && (home.n > 0 || !u.load)) {
    if (home.n > 0) go(home, FUEL_R, () => { const k = Math.min(home.n, C.load - u.load); home.n -= k; u.load += k; });
    else go(home, FUEL_R + 20, () => {}); // (an empty yard: wait there for more)
    return;
  }
  if (f && u.load > 0) {
    // (the pile: a little behind the front mark, toward home — not in the line's way; the crates beside the barrels)
    const h = hqOf(s, u.side) || s.bases[u.side], d = Math.hypot(h.x - f.x, h.y - f.y) || 1, ux = (h.x - f.x) / d, uy = (h.y - f.y) / d, off = C.k === 'ammo' ? AMMO_SIDE : 0;
    const p = pileAt(s, u.side, f.x + ux * PILE_BACK - uy * off, f.y + uy * PILE_BACK + ux * off, null, C.k);
    if (p.n < PILE_MAX) { go(p, FUEL_R, () => { const k = Math.min(u.load, PILE_MAX - p.n); p.n += k; u.load -= k; }); return; }
  }
  if (home) go(home, FUEL_R + 30, () => {});
}
// a missile's blast at (x, y) within R: the piles there go up
function blastPiles(s, x, y, R) {
  for (const p of s.piles || []) if (p.n > 0 && Math.hypot(p.x - x, p.y - y) <= R) { p.n = 0; s.fx.push({ x: p.x, y: p.y, life: 1.1, max: 1.1, size: 30 }); if (p.side === 'blue') note(s, p.k === 'ammo' ? 'ארגזי התחמושת התפוצצו' : 'חביות הדלק התפוצצו'); }
}
// ammunition (s.crates): where a unit low on it goes — the nearest pile of crates, supply truck with a load, held supply
// post (by its edge), or an HQ / forward HQ (by its edge; slow there, counted FUEL_HQ_FAR farther)
const cratesOf = type => AMMO_CRATES[type] || 1;
function ammoSpot(s, u) {
  let best = null, bd = Infinity;
  const look = (p, d) => { if (d < bd) { bd = d; best = p; } };
  const edge = (n, e) => { const d = dist(u, n); return d > 1 ? { x: n.x + (u.x - n.x) / d * e, y: n.y + (u.y - n.y) / d * e } : n; };
  for (const p of s.piles || []) if (p.side === u.side && p.k === 'ammo' && p.n > 0) look(p, dist(u, p));
  for (const m of s.units) if (m.type === 'truck' && m.side === u.side && (m.load || 0) > 0) look(m, dist(u, m));
  for (const n of s.nodes) if (n.side === u.side && (n.kind === 'hq' || n.kind === 'fhq') && n.hp > 0 && s.t >= n.ready) { const e = nodeR(n) + TYPES[u.type].r + 8; look(edge(n, e), dist(u, n) - e + FUEL_HQ_FAR); }
  if (s.posts) for (const n of s.posts) if (n.kind === 'supply' && n.side === u.side) { const e = POSTS.supply.r + TYPES[u.type].r + 8; look(edge(n, e), dist(u, n) - e); }
  return best;
}
// every tick, a unit short of ammunition (s.crates): a whole crate from a pile / loaded truck by it — when it's out for
// more (u.resup) or under half (by a pile in a fight it would take one at every shot) —, slowly by an HQ / forward HQ,
// and as before at a held supply post
function ammoTick(s, dt) {
  const take = (u, src) => {
    const have = src.type ? src.load || 0 : src.n; if (have <= 0) return false;
    const per = cratesOf(u.type), k = Math.min(have, Math.ceil((1 - u.sup) * per - 1e-6));
    if (src.type) src.load -= k; else src.n -= k;
    u.sup = Math.min(1, u.sup + k / per); return true;
  };
  for (const u of s.units) {
    if (!SUPPLY[u.type] || u.sup >= 1) continue;
    if (u.resup || u.sup < 0.5) {
      const p = (s.piles || []).find(p => p.side === u.side && p.k === 'ammo' && p.n > 0 && dist(p, u) <= FUEL_R);
      if (p && take(u, p)) continue;
      const m = around(s, u.x, u.y, SUPPLY_R).find(m => m.type === 'truck' && m.side === u.side && m.hp > 0 && (m.load || 0) > 0 && dist(m, u) <= SUPPLY_R);
      if (m && take(u, m)) continue;
    }
    if (s.nodes.some(n => n.side === u.side && (n.kind === 'hq' || n.kind === 'fhq') && n.hp > 0 && s.t >= n.ready && dist(n, u) <= nodeR(n) + FUEL_HQ_R)) u.sup = Math.min(1, u.sup + AMMO_HQ_RATE * dt);
    else if (postNear(s, u, 'supply')) u.sup = Math.min(1, u.sup + SUPPLY_FILL * dt);
  }
}
