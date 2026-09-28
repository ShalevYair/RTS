// Sim: command & control — control nodes (HQ, forward HQs, drones) and the control-quality field Q.
// Q (0..1) at a point says how well a side commands there: it sets order delay and report speed/accuracy.

// every structure that currently gives control to `side`: the HQ (while it stands), working forward HQs and drones
const controlNodes = (s, side) => s.nodes.filter(n => n.side === side && n.hp > 0 && NODES[n.kind] && s.t >= n.ready);
// how much of a node's control reaches distance d: all of it inside r0, then Q_STEPS rings (0.8, 0.6, 0.4, 0.2), none past r1
// (smooth: the plain linear fall, for the picture — the map shows the rings fading into each other)
function reach(N, d, smooth) {
  if (d <= N.r0) return 1;
  if (d >= N.r1) return 0;
  const k = 1 - (d - N.r0) / (N.r1 - N.r0);
  return smooth ? k : Math.ceil(k * Q_STEPS) / (Q_STEPS + 1);
}
// control quality at p: the best node; never below Q_FLOOR. `build`: only what counts for building (no drones)
function quality(s, side, p, build, smooth) {
  let q = Q_FLOOR;
  for (const n of controlNodes(s, side)) if (!build || n.kind !== 'drone') q = Math.max(q, NODES[n.kind].q * reach(NODES[n.kind], dist(n, p), smooth));
  return q;
}
// how far a drone sees: out to its DRONE_SEE ring
const DRONE_SIGHT = NODES.drone.r0 + (NODES.drone.r1 - NODES.drone.r0) * (1 - (DRONE_SEE * (Q_STEPS + 1) - 1) / Q_STEPS);
const qualityAt = (s, sq) => quality(s, sq.side, { x: sq.cx, y: sq.cy });

// put a drone from the ones in hand over (x, y): it starts working after `warm` seconds and stays until shot down
function drone(s, side, x, y) {
  if (s.over || s.drones[side].stock < 1 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  addStruct(s, side, 'drone', clamp(x, 0, s.W), clamp(y, 0, s.H)).ready = s.t + NODES.drone.warm;
  s.drones[side].stock--;
  if (side === 'blue') note(s, 'רחפן בדרך');
  return true;
}
const dronesUp = (s, side) => s.nodes.filter(n => n.side === side && n.kind === 'drone' && n.hp > 0).length;
// a new drone every `every` seconds while those up and in hand are fewer than `max`
function droneSupply(s, dt) {
  const N = NODES.drone;
  for (const side of ['blue', 'red']) {
    const D = s.drones[side];
    if (D.stock + dronesUp(s, side) >= N.max) { D.next = N.every; continue; }
    D.next -= dt;
    if (D.next <= 0) { D.stock++; D.next = N.every; }
  }
}
// a forward HQ is set up where the squad stands when the order reaches it (sent like any order)
// at most NODES.fhq.max standing (or on their way, as a message) per side
const fhqCount = (s, side) => s.nodes.filter(n => n.side === side && n.kind === 'fhq' && n.hp > 0).length + s.outbox.filter(m => m.side === side && m.kind === 'build').length +
  s.squads.filter(q => q.side === side && q.fhqAt).length;
const canBuildFhq = (s, sq) => !!sq && !sq.dead && FHQ_BUILDERS.includes(sq.type) && s.cd[sq.side].fhq <= 0 && fhqCount(s, sq.side) < NODES.fhq.max;
function buildFhq(s, squadId) {
  const sq = s.squads.find(q => q.id === squadId);
  if (s.over || !canBuildFhq(s, sq)) return false;
  s.cd[sq.side].fhq = NODES.fhq.every; // the slot is spent when the order is given
  if (friction(s)) send(s, sq, { kind: 'build' }); else setUpFhq(s, sq);
  return true;
}
// a forward HQ where the player points: the squad drives there (an order like any other) and sets it up when it
// arrives. The slot (and the wait for the next one) is taken at once, and given back if the trip is called off.
function planFhq(s, squadId, x, y) {
  const sq = s.squads.find(q => q.id === squadId);
  if (s.over || !canBuildFhq(s, sq) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  let p = { x: clamp(x, 10, s.W - 10), y: clamp(y, 10, s.H - 10) };
  if (lakeAt(s, p)) p = dryOf(s, p, 10);
  order(s, sq.id, 'hold', p.x, p.y, true);
  sq.fhqAt = { x: p.x, y: p.y, cd: s.cd[sq.side].fhq }; s.cd[sq.side].fhq = NODES.fhq.every;
  report(s, sq, 'יוצאים להקים פיקוד קדמי');
  return true;
}
// every tick: a squad on such a trip sets up when there (it reached its order, or is close to the spot); the trip is
// off if the squad is gone, falls back, or gets another order
function fhqTrips(s) {
  for (const sq of s.squads) {
    const p = sq.fhqAt; if (!p) continue;
    const m = pending(s, sq.id, 'order'), o = m || sq.order, w = o.want || o;
    if (sq.dead || sq.retreating || o.type !== 'hold' || Math.hypot(w.x - p.x, w.y - p.y) > 1) { sq.fhqAt = null; s.cd[sq.side].fhq = p.cd; continue; }
    if (!m && (sq.arrived || Math.hypot(sq.cx - p.x, sq.cy - p.y) < 40)) { sq.fhqAt = null; const spot = { x: p.x, y: p.y }; if (friction(s)) send(s, sq, { kind: 'build', spot }); else setUpFhq(s, sq, spot); }
  }
}
// at: the spot it was sent to (else where the squad stands)
function setUpFhq(s, sq, at) {
  const p = at || { x: sq.cx, y: sq.cy };
  addStruct(s, sq.side, 'fhq', p.x, p.y).ready = s.t + NODES.fhq.warm;
  report(s, sq, 'מקימים פיקוד קדמי');
  if (sq.side === 'blue') s.marks.push({ x: p.x, y: p.y, kind: 'fhq', t: s.t, who: sq.name });
}
// a node is a target for enemy fire: drones only for AA, forward HQs for anyone
const nodeTargetable = (u, n) => n.side !== u.side && n.hp > 0 && (n.kind === 'drone' ? u.type === 'aa' : true);
// what a structure can see: drones everything under them, the HQ / forward HQs / buildings around themselves
const nodeSight = n => n.kind === 'drone' ? DRONE_SIGHT : n.kind === 'fhq' ? NODES.fhq.sight : n.kind === 'hq' ? STRUCTS.hq.sight : STRUCT_SIGHT;
const nodeSees = (s, side, e) => s.nodes.some(n => n.side === side && n.hp > 0 && s.t >= n.ready && dist(n, e) <= nodeSight(n));
