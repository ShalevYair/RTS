// Supplies (the full game: s.logi, set by openField with s.fuel and s.water). No unit goes back for anything: supply
// trucks come to it. Every vehicle and aircraft has a tank (u.fuel 0–1): ground vehicles and helicopters burn it only
// while they move — FUEL_T s of moving on a full tank —, planes all the time they fly (FUEL_AIR s; under PLANE_BACK
// they fly back to the airfield, and fill up there). Empty, a vehicle stands where it is until a fuel truck is by it.
// Out of ammunition (u.sup 0), a unit holds its fire until an ammunition truck (`truck`) is by it. Soldiers drink
// (u.water: WATER_T s on a full canteen); dry, they lose THIRST of their health a second until they die; a water truck
// or a water building (waterst, on a lake's bank) fills them. Hurt units stay where they are: a medic / mechanic
// nearby (MED_SEEK) goes to them.
// The trucks (TRUCK_CAP fulls each; a tank's fuel and ammunition count 2) serve what's within TRUCK_R of them, and go
// where they're told — new ones to the front. Empty, a truck drives to its building, fills up there (TRUCK_REFILL s)
// and goes back to its place (its order). Fuel stations, ammunition depots and water buildings: at most 2 of each,
// past the building allowance; 2 trucks each (config.js).
const needsFuel = type => !CARGO[type] && type !== 'dozer' && (TYPES[type].air || !FOOT.includes(type)); // (not the bulldozer: it builds everything — dry, out by a far site, a side stood still)
const needsWater = type => FOOT.includes(type);
const fuelT = type => TYPES[type].air && !TYPES[type].hover ? FUEL_AIR : FUEL_T;
const barrelsOf = type => FUEL_BARRELS[type] || 1;
const cratesOf = type => AMMO_CRATES[type] || 1;
// what each kind of truck carries: from which building; on whom, how much of a full one a second, and how many of the
// truck's fulls one full of theirs takes
const CARGO = {
  fueltruck: { station: 'fuelst', key: 'fuel', who: u => needsFuel(u.type) && !(TYPES[u.type].air && !TYPES[u.type].hover), rate: FUEL_FILL, per: barrelsOf },
  truck: { station: 'depot', key: 'sup', who: u => !!SUPPLY[u.type], rate: AMMO_FILL, per: cratesOf },
  watertruck: { station: 'waterst', key: 'water', who: u => needsWater(u.type), rate: WATER_FILL, per: () => 1 },
};
const cargoOn = (s, type) => !!s.logi && !!CARGO[type];
// (piles of barrels / crates: gone with the trucks that serve on the spot — kept so a missile's blast finds none)
function blastPiles(s, x, y, R) {}
// a unit's own fuel this tick (from updateUnit): planes turn back for the airfield. Nothing else goes anywhere for it
function fuelUnit(s, u, sq, dt) {
  if (!s.fuel || u.fuel === undefined) return false;
  const T = TYPES[u.type];
  if (T.air && !T.hover && u.fuel < PLANE_BACK) u.rearm = true; // (planes: back to the airfield, see updateUnit)
  return false;
}
// a truck's tick (from updateUnit): empty (or filling up) — to its building and back; true = busy with that, else it
// goes where its squad's order says
function truckTick(s, u, sq, dt) {
  const C = CARGO[u.type], cap = TRUCK_CAP[u.type];
  if (u.load === undefined) u.load = cap;
  if (u.load <= 0.05) u.refill = true;
  if (!u.refill) return false;
  let st = null, bd = Infinity;
  for (const n of s.nodes) if (n.kind === C.station && n.side === u.side && n.hp > 0 && s.t >= n.ready) { const d = dist(u, n); if (d < bd) { bd = d; st = n; } }
  if (!st) return false; // (no building: it stays where it was told)
  if (bd > nodeR(st) + FUEL_R) { moveTo(s, u, st.x, st.y, 1, dt); return true; }
  u.load = Math.min(cap, u.load + cap / TRUCK_REFILL * dt);
  if (u.load >= cap) u.refill = false; // (full: back to its place — its order)
  return true;
}
// every tick: fuel burnt, soldiers' water, the trucks serving round them, the buildings' and HQs' slow fills
function fuelTick(s, dt) {
  if (!s.fuel && !s.logi) return;
  for (const u of s.units) {
    const T = TYPES[u.type];
    if (s.fuel) {
      if (u.fuel === undefined && needsFuel(u.type)) u.fuel = 1;
      if (u.fuel !== undefined) {
        // (burnt by the way it actually went: pushed in a jam, or standing, burns nothing; planes all the time they fly)
        const flying = T.air && !T.hover, went = u.fx === undefined ? 0 : Math.hypot(u.x - u.fx, u.y - u.fy); u.fx = u.x; u.fy = u.y;
        if (flying) u.fuel = Math.max(0, u.fuel - dt / fuelT(u.type));
        else if (went > 0.01) u.fuel = Math.max(0, u.fuel - went / (Math.max(1, T.speed) * fuelT(u.type)));
        if (!u.fuel && !u.drySaid && u.side === 'blue' && !T.air) { u.drySaid = true; const q = s.squads.find(q => q.id === u.squad); if (q) report(s, q, 'נגמר הדלק'); }
        if (u.fuel > 0.05) u.drySaid = false;
        // (by an HQ / forward HQ of its side: a slow fill)
        if (u.fuel < 1 && !flying && hqNear(s, u)) u.fuel = Math.min(1, u.fuel + FUEL_HQ_RATE * dt);
      }
    }
    if (s.water && needsWater(u.type)) {
      if (u.water === undefined) u.water = 1;
      u.water = Math.max(0, u.water - dt / WATER_T);
      if (!u.water) { u.hp -= THIRST * T.hp * dt; if (!u.thirstSaid && u.side === 'blue') { u.thirstSaid = true; const q = s.squads.find(q => q.id === u.squad); if (q) report(s, q, 'נגמרו המים'); } }
      else if (u.water > 0.05) u.thirstSaid = false;
      if (s.nodes.some(n => n.kind === 'waterst' && n.side === u.side && n.hp > 0 && s.t >= n.ready && dist(n, u) <= nodeR(n) + WATER_NEAR)) u.water = Math.min(1, u.water + WATER_FILL * dt);
    }
    if (s.logi && SUPPLY[u.type] && u.sup < 1 && hqNear(s, u)) u.sup = Math.min(1, u.sup + AMMO_HQ_RATE * dt); // (ammunition: slowly by an HQ)
  }
  if (!s.logi) return;
  // (the trucks: each fills what's round it, out of its load)
  for (const m of s.units) {
    const C = CARGO[m.type]; if (!C) continue;
    if (m.load === undefined) m.load = TRUCK_CAP[m.type];
    if (m.load <= 0 || m.refill) continue;
    for (const u of around(s, m.x, m.y, TRUCK_R)) {
      if (u === m || u.side !== m.side || u.hp <= 0 || !C.who(u) || dist(u, m) > TRUCK_R) continue;
      const have = u[C.key] ?? 1; if (have >= 1) continue;
      const add = Math.min(1 - have, C.rate * dt, m.load / C.per(u.type));
      u[C.key] = have + add; m.load -= add * C.per(u.type);
      if (m.load <= 0) { m.load = 0; break; }
    }
  }
}
const hqNear = (s, u) => s.nodes.some(n => n.side === u.side && (n.kind === 'hq' || n.kind === 'fhq') && n.hp > 0 && s.t >= n.ready && dist(n, u) <= nodeR(n) + FUEL_HQ_R);
// a medic / mechanic (s.logi): the nearest hurt one of the kind it treats, within MED_SEEK — it goes to it (the hurt
// don't go anywhere). Returns the spot, or null
function medSeek(s, u) {
  if (!(u.seekAt > s.t)) {
    u.seekAt = s.t + 1; u.seek = null;
    let bd = MED_SEEK;
    for (const m of around(s, u.x, u.y, MED_SEEK)) if (m !== u && m.side === u.side && m.hp > 0 && CARER[m.type] === u.type && m.hp < 0.9 * TYPES[m.type].hp) { const d = dist(u, m); if (d < bd) { bd = d; u.seek = m.id; } }
  }
  const m = u.seek != null && s.units.find(m => m.id === u.seek);
  if (!m || m.hp <= 0 || m.hp >= 0.97 * TYPES[m.type].hp) { u.seek = null; return null; }
  return m;
}
// a water building stands on a lake's bank: some of the ring just past its edge is in a lake
function onShore(s, x, y, r) {
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, R = r + SHORE_R; if (lakeAt(s, { x: x + Math.cos(a) * R, y: y + Math.sin(a) * R })) return true; }
  return false;
}
// spots on the bank of every lake, just clear of the water (for the AI's water building), nearest to p first
function shoreSpots(s, p, r) {
  const out = [];
  for (const l of s.lakes) for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    let d = 0; while (d < 600 && lakeAt(s, { x: l.x + c * d, y: l.y + sn * d })) d += 6;
    const q = { x: l.x + c * (d + r + LAKE_PAD + 6), y: l.y + sn * (d + r + LAKE_PAD + 6) };
    if (!lakeAt(s, q, LAKE_PAD) && onShore(s, q.x, q.y, r)) out.push(q);
  }
  return out.sort((a, b) => dist(a, p) - dist(b, p));
}
