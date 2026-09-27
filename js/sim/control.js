// Sim: command & control — control nodes (HQ, forward HQs, drones) and the control-quality field Q.
// Q (0..1) at a point says how well a side commands there: it sets order delay and report speed/accuracy.

// every structure that currently gives control to `side`: the HQ (while it stands), working forward HQs and drones
const controlNodes = (s, side) => s.nodes.filter(n => n.side === side && n.hp > 0 && NODES[n.kind] && s.t >= n.ready);
// control quality at p: the best node, full inside r0 and falling linearly to nothing at r1; never below Q_FLOOR
function quality(s, side, p) {
  let q = Q_FLOOR;
  for (const n of controlNodes(s, side)) {
    const N = NODES[n.kind], d = dist(n, p);
    const k = d <= N.r0 ? 1 : d >= N.r1 ? 0 : 1 - (d - N.r0) / (N.r1 - N.r0);
    q = Math.max(q, N.q * k);
  }
  return q;
}
const qualityAt = (s, sq) => quality(s, sq.side, { x: sq.cx, y: sq.cy });

// launch a drone over (x, y): it starts working after `warm` seconds and flies for `life`; one every `every`
function drone(s, side, x, y) {
  if (s.over || s.cd[side].drone > 0 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const N = NODES.drone;
  const d = addStruct(s, side, 'drone', clamp(x, 0, s.W), clamp(y, 0, H)); d.ready = s.t + N.warm; d.until = s.t + N.warm + N.life;
  s.cd[side].drone = N.every;
  if (side === 'blue') note(s, 'רחפן בדרך');
  return true;
}
// a forward HQ is set up where the squad stands when the order reaches it (sent like any order)
const canBuildFhq = (s, sq) => !!sq && !sq.dead && FHQ_BUILDERS.includes(sq.type) && s.cd[sq.side].fhq <= 0;
function buildFhq(s, squadId) {
  const sq = s.squads.find(q => q.id === squadId);
  if (s.over || !canBuildFhq(s, sq)) return false;
  s.cd[sq.side].fhq = NODES.fhq.every; // the slot is spent when the order is given
  if (s.fog) send(s, sq, { kind: 'build' }); else setUpFhq(s, sq);
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
const nodeSight = n => n.kind === 'drone' ? NODES.drone.r0 : n.kind === 'fhq' ? NODES.fhq.sight : n.kind === 'hq' ? STRUCTS.hq.sight : STRUCT_SIGHT;
const nodeSees = (s, side, e) => s.nodes.some(n => n.side === side && n.hp > 0 && s.t >= n.ready && dist(n, e) <= nodeSight(n));
