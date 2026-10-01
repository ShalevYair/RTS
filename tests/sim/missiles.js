// Surface-to-surface missiles: a truck stands, sets up and launches at a building its side knows; the missile flies a
// while and brings a building down in one hit, the HQ in four; the launch shows the enemy the truck. Arrow takes the
// missile on halfway; Iron Dome stops the short missiles (aircraft, attack helicopters, anti-tank); Trophy on tanks.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const fresh = () => { const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false; s.noReinforce = true; s.units = []; s.squads = []; return s; };
const mk = (s, side, t, n, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
const S = Sim.STRUCTS;
ok(S.ssmshop.build === 180 && S.ssmshop.every === 120 && S.ssmshop.size === 3 && S.arrowsite.build === 120 && S.domesite.build === 60, 'missile works 3 min, a truck every 2 min, 3 at most; Arrow 2 min, Iron Dome 1 min');
{
  const s = fresh(), t = mk(s, 'blue', 'ssm', 1, 200, 320), tent = s.nodes.find(n => n.side === 'red' && n.kind === 'tent'), hq = s.nodes.find(n => n.side === 'red' && n.kind === 'hq');
  ok(!Sim.launch(s, [t.id], 700, 100), 'no launch at an empty spot');
  ok(Sim.launch(s, [t.id], tent.x, tent.y), 'launch ordered at the enemy tent');
  step(s, Sim.SSM_SETUP - 1); ok(!s.missiles.length, 'nothing before it has set up');
  step(s, 2); ok(s.missiles.length === 1 && s.mem.red[t.id] && s.mem.red[t.id].type === 'ssm', 'launched — and the enemy saw where from');
  step(s, Sim.SSM_FLIGHT + 1); ok(!s.nodes.includes(tent), 'the tent is gone in one hit');
  Sim.launch(s, [t.id], hq.x, hq.y); step(s, Sim.SSM_RELOAD + Sim.SSM_FLIGHT + 2);
  ok(hq.hp > 0 && hq.hp < S.hq.hp * 0.8, `the HQ takes a quarter (${Math.round(hq.hp)} of ${S.hq.hp})`);
}
{
  // Arrow: an enemy missile over its area is taken on halfway (most of the time)
  let stopped = 0;
  for (let k = 0; k < 6; k++) {
    const s = fresh(); s.rand = (r => () => r())(Math.random);
    const t = mk(s, 'blue', 'ssm', 1, 200, 320), a = mk(s, 'red', 'arrow', 1, 1100, 320), tent = s.nodes.find(n => n.side === 'red' && n.kind === 'tent');
    Sim.launch(s, [t.id], tent.x, tent.y); step(s, Sim.SSM_SETUP + Sim.SSM_FLIGHT + 2);
    if (s.nodes.includes(tent)) stopped++;
  }
  ok(stopped >= 4, `Arrow stopped ${stopped} of 6`);
}
{
  // Iron Dome: anti-tank missiles at its side stopped, one a minute per truck; Trophy: three on the tank itself
  const s = fresh(), at = mk(s, 'blue', 'at', 1, 500, 320), tk = mk(s, 'red', 'tank', 1, 560, 320), d = mk(s, 'red', 'dome', 1, 700, 320);
  const T = s.units.find(u => u.squad === tk.id), D = s.units.find(u => u.squad === d.id), A = s.units.find(u => u.squad === at.id); A.cd = 0;
  for (let i = 0; i < 30 * 1.5 && T.hp === Sim.TYPES.tank.hp; i++) Sim.step(s, 1 / 30);
  ok(D.reload > 50 && T.hp === Sim.TYPES.tank.hp, 'Iron Dome stopped the first anti-tank missile');
  step(s, 4); ok(T.hp < Sim.TYPES.tank.hp, 'the next ones got through (one a minute)');
  const s2 = fresh(), at2 = mk(s2, 'blue', 'at', 1, 500, 320), tk2 = mk(s2, 'red', 'tank', 1, 580, 320), T2 = s2.units.find(u => u.squad === tk2.id); T2.trophy = Sim.TROPHY_MAX;
  let low = Sim.TROPHY_MAX, hpAt0 = null; for (let i = 0; i < 30 * 9; i++) { T2.cd = 99; Sim.step(s2, 1 / 30); low = Math.min(low, T2.trophy); if (low === 0 && hpAt0 === null) hpAt0 = T2.hp; }
  ok(hpAt0 === Sim.TYPES.tank.hp && T2.hp < Sim.TYPES.tank.hp, `Trophy stopped ${Sim.TROPHY_MAX - low} missiles untouched, then they got through (${Math.round(T2.hp)} hp)`);
  const s3 = fresh(), tk3 = mk(s3, 'blue', 'tank', 1, 300, 320), sh = mk(s3, 'red', 'tank', 1, 360, 320), T3 = s3.units.find(u => u.squad === tk3.id); T3.trophy = Sim.TROPHY_MAX;
  step(s3, 4); ok(T3.trophy === Sim.TROPHY_MAX && T3.hp < Sim.TYPES.tank.hp, 'shells aren\'t stopped');
}
{
  // the upgrade: three minutes with no tanks, then tanks come out with it
  const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false;
  ok(Sim.build(s, 'blue', 'tankshop', 230, 320), 'a tank workshop'); const w = s.nodes.find(n => n.kind === 'tankshop'); w.ready = 0; w.work = w.need;
  ok(Sim.upgrade(s, 'blue', w.id) && !Sim.upgrade(s, 'blue', w.id), 'Trophy ordered (once)');
  step(s, Sim.TROPHY_BUILD - 5); ok(!s.units.some(u => u.side === 'blue' && u.type === 'tank'), 'no tanks while it\'s made');
  step(s, 70); const tks = s.units.filter(u => u.side === 'blue' && u.type === 'tank');
  ok(s.trophy.blue && tks.length && tks.every(u => u.trophy === Sim.TROPHY_MAX), `then tanks with Trophy (${tks.length})`);
}
if (bad) process.exitCode = 1;
