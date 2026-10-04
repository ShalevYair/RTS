// Traffic: our tanks and jeeps sent off together (the jeeps, faster, arrive first and stand in the tanks' way), and
// units sent to the front one by one (all to one point) — every one gets to its spot, and they don't shove one another
// for ever once there.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < 30 * sec; i++) { Sim.step(s, 1 / 30); if (f) f(); } };
const mk = (s, t, x, y) => { const q = Sim._makeSquad(s, 'blue', t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
const report = (s, qs, from) => {
  // how far each is from its spot (an arrived one pushed aside stays where it is, within ARRIVE_LEAVE — squad.js arrivedAt), and how much they still move about (after they should have settled)
  const off = qs.map(q => { const u = unitOf(s, q); return u ? Math.hypot(u.x - q.order.x, u.y - q.order.y) : 0; });
  return { far: off.filter(d => d > Sim.ARRIVE_LEAVE).length, worst: Math.round(Math.max(...off)) };
};
const moved = (s, qs, sec) => { // the path the units drive in sec s, all together
  const last = new Map(qs.map(q => { const u = unitOf(s, q); return [q.id, { x: u.x, y: u.y }]; })); let m = 0;
  step(s, sec, () => { for (const q of qs) { const u = unitOf(s, q), p = last.get(q.id); if (!u) continue; m += Math.hypot(u.x - p.x, u.y - p.y); p.x = u.x; p.y = u.y; } });
  return Math.round(m);
};
for (const seed of [3, 8, 21]) {
  const s = Sim.create(seed, 1600, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = s.units.filter(u => u.side === 'red' && false); s.squads = s.squads.filter(q => false); // (an empty field)
  s.nodes = s.nodes.filter(n => n.kind === 'hq');
  const qs = [];
  for (let i = 0; i < 6; i++) qs.push(mk(s, 'tank', 150, 200 + i * 40));
  for (let i = 0; i < 8; i++) qs.push(mk(s, 'jeep', 220, 180 + i * 35));
  Sim.formation(s, qs.map(q => q.id), 'hold', 900, 320, true);
  step(s, 80); // (half speed: SPEED_K)
  const r = report(s, qs), m = moved(s, qs, 10);
  ok(r.far === 0 && m < 300, `seed ${seed}, 6 tanks + 8 jeeps together: all at their spots (${r.far} not, worst ${r.worst}), still moving ${m} in 10 s`);
}
for (const seed of [3, 8]) {
  // a front, and buildings sending out their units there one by one (each its own squad)
  const s = Sim.create(seed, 1600, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = s.units.filter(u => u.side === 'red'); s.squads = s.squads.filter(q => q.side === 'red'); s.nodes = s.nodes.filter(n => n.kind === 'hq');
  s.units = []; s.squads = [];
  Sim.setFront(s, 'blue', 700, 320);
  for (const [k, y] of [['tent', 200], ['jeepshop', 330], ['tankshop', 460]]) ok(Sim.build(s, 'blue', k, 260, y), 'a ' + k);
  for (const n of s.nodes) if (n.side === 'blue' && n.kind !== 'hq') { n.ready = 0; n.work = n.need; } // (up at once)
  step(s, 230); // (half speed: the last ones out take longer to get there)
  const qs = s.squads.filter(q => q.side === 'blue' && !q.dead && s.units.some(u => u.squad === q.id && Math.hypot(u.x - 700, u.y - 320) < 200));
  const m = moved(s, qs, 10);
  ok(qs.length >= 8 && m < 40 * qs.length, `seed ${seed}, ${qs.length} at the front: still moving ${m} in 10 s`);
}
{
  // a mixed group sent far together marches at the soldiers' pace: every one keeps going with its place, and all get
  // there (a place creeping on slower than 0.5 a tick never counted as moved: units stood 'arrived' on the way and went
  // on one by one, and the group stopped short)
  const s = Sim.create(5, 1600, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq');
  const qs = []; for (let i = 0; i < 12; i++) qs.push(mk(s, ['tank', 'jeep', 'inf'][i % 3], 150 + (i % 4) * 30, 220 + Math.floor(i / 4) * 40));
  Sim.formation(s, qs.map(q => q.id), 'attack', 1000, 320, true);
  let halfway = 0; step(s, 40, () => {}); for (const q of qs) if (unitOf(s, q).x > 350) halfway++; // (the soldiers' row is at the back of the march)
  step(s, 60); const r = report(s, qs);
  ok(halfway === qs.length && r.far === 0, `12 tanks, jeeps and soldiers sent far together: all on the way at 40 s (${halfway}/12), all there at 100 s (${r.far} not, worst ${r.worst})`);
}
if (bad) process.exitCode = 1;
