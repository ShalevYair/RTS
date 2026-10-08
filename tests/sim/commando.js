// The commando: under fog the enemy doesn't see him — only right by its drone or signals truck, close by its units or
// buildings, or just after he fires; one shot kills a soldier; standing by an enemy building PLANT_T s, he blows it
// up (the HQ: four of them at once); he can ride the transport helicopter
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const fresh = () => { const s = Sim.create(12, 1400, 'normal'); s.bots = []; s.fog = true; s.noReinforce = true; s.units = []; s.squads = []; return s; };
const mk = (s, side, t, n, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
ok(Sim.STRUCTS.commandopost.build === 180 && Sim.STRUCTS.commandopost.every === 120 && Sim.RIDERS.includes('commando'), 'a commando base: 3 minutes, one every 2; commandos ride helicopters');
{
  const s = fresh(), c = mk(s, 'blue', 'commando', 1, 600, 300), e = mk(s, 'red', 'inf', 1, 700, 300);
  const C = s.units.find(u => u.squad === c.id), E = s.units.find(u => u.squad === e.id); C.cd = 99; E.cd = 99;
  Sim.order(s, c.id, 'hold', 600, 300, true); Sim.order(s, e.id, 'hold', 700, 300, true); s.outbox = [];
  step(s, 0.5); ok(!s.vis.red.has(C.id), 'a soldier 100 away doesn\'t see him');
  ok(s.vis.blue.has(E.id), 'he sees the soldier');
  C.x = E.x - 20; C.y = E.y; step(s, 0.2); ok(s.vis.red.has(C.id), 'right by it, he is seen');
}
{
  const s = fresh(), c = mk(s, 'blue', 'commando', 1, 600, 300), e = mk(s, 'red', 'inf', 1, 660, 300);
  const C = s.units.find(u => u.squad === c.id), E = s.units.find(u => u.squad === e.id); E.cd = 99; C.cd = 0;
  step(s, 0.2); ok(E.hp <= 0 || !s.units.includes(E), 'one shot kills a soldier');
  ok(s.vis.red.size === 0 || s.t - C.lastFire < Sim.TYPES.commando.cd, 'and the shot gives him away for a moment');
}
{
  // a charge: by the enemy tent, standing PLANT_T s
  const s = fresh(), tent = s.nodes.find(n => n.side === 'red' && n.kind === 'tent'), hq = s.nodes.find(n => n.side === 'red' && n.kind === 'hq');
  const c = mk(s, 'blue', 'commando', 1, tent.x - Sim.STRUCTS.tent.r - 8, tent.y); Sim.order(s, c.id, 'hold', tent.x - Sim.STRUCTS.tent.r - 8, tent.y, true); s.outbox = [];
  step(s, Sim.PLANT_T - 2); ok(s.nodes.includes(tent), 'not yet');
  step(s, 4); ok(!s.nodes.includes(tent), `the tent blown up after ${Sim.PLANT_T} s by it`);
  const R = Sim.STRUCTS.hq.r + 8, four = [0, 1, 2, 3].map(i => { const a = Math.PI + (i - 1.5) * 0.35; return mk(s, 'blue', 'commando', 1, hq.x + Math.cos(a) * R, hq.y + Math.sin(a) * R); });
  // (+5: four side by side settle a second or two before they stand still)
  for (const q of four) { const u = s.units.find(m => m.squad === q.id); Sim.order(s, q.id, 'hold', u.x, u.y, true); } s.outbox = [];
  step(s, Sim.PLANT_T + 5); ok(!s.nodes.includes(hq) || hq.hp <= 0 || s.hqDown === 'red', 'four together bring the HQ down');
}
if (bad) process.exitCode = 1;
