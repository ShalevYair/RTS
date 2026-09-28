// Sim: command & control — control nodes (HQ, forward HQs, drones) and the control-quality field Q.
// Q (0..1) at a point says how well a side commands there: it sets order delay and report speed/accuracy.

// every structure that currently gives control to `side`: the HQ (while it stands), working forward HQs and drones
const controlNodes = (s, side) => s.nodes.filter(n => n.side === side && n.hp > 0 && NODES[n.kind] && s.t >= n.ready);
// how much of a node's control reaches distance d: all of it inside r0, then Q_STEPS rings (0.8, 0.6, 0.4, 0.2), none past r1
function reach(N, d) {
  if (d <= N.r0) return 1;
  if (d >= N.r1) return 0;
  return Math.ceil((1 - (d - N.r0) / (N.r1 - N.r0)) * Q_STEPS) / (Q_STEPS + 1);
}
// control quality at p: the best node; never below Q_FLOOR. `build`: only what counts for building (no drones)
function quality(s, side, p, build) {
  let q = Q_FLOOR;
  for (const n of controlNodes(s, side)) if (!build || n.kind !== 'drone') q = Math.max(q, NODES[n.kind].q * reach(NODES[n.kind], dist(n, p)));
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
const fhqCount = (s, side) => s.nodes.filter(n => n.side === side && n.kind === 'fhq' && n.hp > 0).length + s.outbox.filter(m => m.side === side && m.kind === 'build').length;
const canBuildFhq = (s, sq) => !!sq && !sq.dead && FHQ_BUILDERS.includes(sq.type) && s.cd[sq.side].fhq <= 0 && fhqCount(s, sq.side) < NODES.fhq.max;
function buildFhq(s, squadId) {
  const sq = s.squads.find(q => q.id === squadId);
  if (s.over || !canBuildFhq(s, sq)) return false;
  s.cd[sq.side].fhq = NODES.fhq.every; // the slot is spent when the order is given
  if (friction(s)) send(s, sq, { kind: 'build' }); else setUpFhq(s, sq);
  return true;
}
function setUpFhq(s, sq) {
  addStruct(s, sq.side, 'fhq', sq.cx, sq.cy).ready = s.t + NODES.fhq.warm;
  report(s, sq, 'מקימים פיקוד קדמי');
  if (sq.side === 'blue') s.marks.push({ x: sq.cx, y: sq.cy, kind: 'fhq', t: s.t, who: sq.name });
}
// a node is a target for enemy fire: drones only for AA, forward HQs for anyone
const nodeTargetable = (u, n) => n.side !== u.side && n.hp > 0 && (n.kind === 'drone' ? u.type === 'aa' : true);
// what a structure can see: drones everything under them, the HQ / forward HQs / buildings around themselves
const nodeSight = n => n.kind === 'drone' ? DRONE_SIGHT : n.kind === 'fhq' ? NODES.fhq.sight : n.kind === 'hq' ? STRUCTS.hq.sight : STRUCT_SIGHT;
const nodeSees = (s, side, e) => s.nodes.some(n => n.side === side && n.hp > 0 && s.t >= n.ready && dist(n, e) <= nodeSight(n));
