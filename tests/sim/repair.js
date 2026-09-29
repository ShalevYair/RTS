// Repairs and the HQ: idle units near a damaged building of their side mend it (mechanics faster), units in a fight
// don't; a side whose HQ falls has lost at once
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
function quiet(seed) {
  const s = Sim.create(seed, 1200, 'normal'); s.bots = []; s.fog = false; s.lakes = []; s.noReinforce = true; s.collapseAfter = 1e9;
  for (const u of s.units) if (u.side === 'red') { u.x = s.W - 10; u.y = 10; }
  return s;
}
{
  const s = quiet(7), tent = s.nodes.find(n => n.side === 'blue' && n.kind === 'tent'), inf = s.squads.find(q => q.side === 'blue' && q.type === 'inf');
  Sim.order(s, inf.id, 'hold', tent.x + 30, tent.y); step(s, 8);
  tent.hp = 100; step(s, 5);
  ok(tent.hp > 130 && tent.fixing, `idle infantry beside a damaged tent mend it (${Math.round(tent.hp)} hp after 5 s)`);
  const h0 = tent.hp; for (const u of s.units) if (u.squad === inf.id) u.lastFire = s.t + 99; // busy fighting
  step(s, 3); ok(tent.hp === h0, 'units in a fight don\'t repair');
  for (const u of s.units) if (u.squad === inf.id) u.lastFire = -99;
  const far = quiet(8), t2 = far.nodes.find(n => n.side === 'blue' && n.kind === 'tent'); far.units = far.units.filter(u => u.side !== 'blue');
  t2.hp = 100; step(far, 5); ok(t2.hp === 100, 'nobody near: no repair');
  // a mechanic mends faster than a soldier
  const m = quiet(9), t3 = m.nodes.find(n => n.side === 'blue' && n.kind === 'tent'); m.units = m.units.filter(u => u.side !== 'blue');
  const mq = Sim._makeSquad(m, 'blue', 'mech', null, t3.x + 30, t3.y); mq.size = 1; Sim._fillSquad(m, mq, t3.x + 30, t3.y); Sim.order(m, mq.id, 'hold', t3.x + 30, t3.y); step(m, 4);
  t3.hp = 100; step(m, 5); ok(t3.hp - 100 > 3 * 5 * 2.5, `a mechanic mends about three times as fast (${Math.round(t3.hp - 100)} hp in 5 s)`);
}
{
  const s = quiet(10), hq = s.nodes.find(n => n.side === 'red' && n.kind === 'hq'); step(s, 1);
  ok(!s.over, 'the game goes on while both HQs stand');
  hq.hp = 0; step(s, 0.2); ok(s.over === 'blue', 'the enemy HQ falls: we have won at once');
  const t = quiet(11); t.nodes.find(n => n.side === 'blue' && n.kind === 'hq').hp = 0; step(t, 0.2); ok(t.over === 'red', 'our HQ falls: we have lost');
  const l = Sim.level(1, 1, 1000); step(l, 1); ok(!l.over, 'levels with no HQ play on');
}
