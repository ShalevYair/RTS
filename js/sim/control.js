// Sim: command & control — control nodes (HQ, forward HQs, drones) and the control-quality field Q.
// Q (0..1) at a point says how well a side commands there: it sets order delay and report speed/accuracy.

// every node that currently gives control to `side` (the HQ always; forward HQs and drones once working)
function controlNodes(s, side) {
  const out = [{ kind: 'hq', side, ...hq(s, side) }];
  for (const n of s.nodes) if (n.side === side && s.t >= n.ready) out.push(n);
  return out;
}
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
  s.nodes.push({ id: s.nextNode++, kind: 'drone', side, x: clamp(x, 0, s.W), y: clamp(y, 0, H), hp: N.hp, t0: s.t, ready: s.t + N.warm, until: s.t + N.warm + N.life });
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
  const N = NODES.fhq;
  s.nodes.push({ id: s.nextNode++, kind: 'fhq', side: sq.side, x: sq.cx, y: sq.cy, hp: N.hp, t0: s.t, ready: s.t + N.warm, until: Infinity });
  report(s, sq, 'מקימים פיקוד קדמי');
  if (sq.side === 'blue') s.marks.push({ x: sq.cx, y: sq.cy, kind: 'fhq', t: s.t, who: sq.name });
}
function updateNodes(s, dt) {
  for (const side of ['blue', 'red']) for (const k in s.cd[side]) s.cd[side][k] = Math.max(0, s.cd[side][k] - dt);
  for (const n of s.nodes) {
    if (n.hp <= 0 && !n.gone) {
      n.gone = true; s.fx.push({ x: n.x, y: n.y, life: 0.9, max: 0.9, size: n.kind === 'fhq' ? 34 : 18 });
      if (n.side === 'blue') { note(s, n.kind === 'fhq' ? 'הפיקוד הקדמי נפל' : 'הרחפן הופל'); s.marks.push({ x: n.x, y: n.y, kind: 'nodeLost', t: s.t, who: n.kind }); }
    }
    if (n.kind === 'fhq' && n.side === 'blue' && !n.said && s.t >= n.ready && !n.gone) { n.said = true; note(s, 'הפיקוד הקדמי פועל'); }
  }
  s.nodes = s.nodes.filter(n => !n.gone && n.until > s.t);
}
// a node is a target for enemy fire: drones only for AA, forward HQs for anyone
const nodeTargetable = (u, n) => n.side !== u.side && n.hp > 0 && (n.kind === 'drone' ? u.type === 'aa' : true);
// working drones see everything under them; working forward HQs see around themselves
const nodeSees = (s, side, e) => s.nodes.some(n => n.side === side && s.t >= n.ready &&
  dist(n, e) <= (n.kind === 'drone' ? NODES.drone.r0 : NODES.fhq.sight));
