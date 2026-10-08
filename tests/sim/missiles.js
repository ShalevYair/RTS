// Surface-to-surface missiles: a truck stands, sets up and launches at a building its side knows; the missile flies a
// while and brings a building down in one hit (never at the HQ, and never on its own); the launch shows the enemy the truck. Arrow takes the
// missile on halfway; Iron Dome stops the short missiles (aircraft, attack helicopters, anti-tank); Trophy on tanks.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const fresh = () => { const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false; s.noReinforce = true; s.units = []; s.squads = []; return s; };
const mk = (s, side, t, n, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
const S = Sim.STRUCTS;
ok(S.ssmshop.build === 180 && S.ssmshop.every === 120 && S.ssmshop.size === 1 && S.ssmshop.keep === 1 && Sim.SSM_RELOAD === 120 && S.arrowsite.build === 120 && S.domesite.build === 60, 'missile works 3 min, one truck (every 2 min after a loss), a missile every 2 min; Arrow 2 min, Iron Dome 1 min');
{
  // at most 3 missile works a side
  const s = fresh(); s.builds = null; let n = 0;
  for (let i = 0; i < 5; i++) if (Sim.build(s, 'blue', 'ssmshop', 150 + (i % 2) * 90, 150 + i * 90)) n++;
  ok(n === 3 && Sim.buildCheck(s, 'blue', 400, 500, 'ssmshop') === 'max', `3 missile works at most (${n} put up; then: ${Sim.buildCheck(s, 'blue', 400, 500, 'ssmshop')})`);
}
{
  const s = fresh(), t = mk(s, 'blue', 'ssm', 1, 200, 320), tent = s.nodes.find(n => n.side === 'red' && n.kind === 'tent'), hq = s.nodes.find(n => n.side === 'red' && n.kind === 'hq');
  ok(!Sim.launch(s, [t.id], 700, 100), 'no launch at an empty spot');
  ok(Sim.launch(s, [t.id], tent.x, tent.y), 'launch ordered at the enemy tent');
  step(s, Sim.SSM_SETUP - 1); ok(!s.missiles.length, 'nothing before it has set up');
  step(s, 2); ok(s.missiles.length === 1 && s.mem.red[t.id] && s.mem.red[t.id].type === 'ssm', 'launched — and the enemy saw where from');
  step(s, Sim.SSM_FLIGHT + 1); ok(!s.nodes.includes(tent), 'the tent is gone in one hit');
  ok(!Sim.launch(s, [t.id], hq.x, hq.y), 'no launch at the HQ');
  const camp = s.nodes.find(n => n.side === 'red' && n.kind !== 'hq'); step(s, Sim.SSM_RELOAD + Sim.SSM_FLIGHT + 2);
  ok(!s.missiles.some(m => !m.gone) && hq.hp === S.hq.hp && (!camp || s.nodes.includes(camp)), 'loaded again, it does not launch on its own');
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
  // (the tank held where it is: it would drive over the soldier, and this is about the missiles)
  const pin = () => { T.x = 560; T.y = 320; Sim.step(s, 1 / 30); };
  for (let i = 0; i < 30 * 1.5 && T.hp === Sim.TYPES.tank.hp; i++) pin();
  ok(D.reload > 50 && T.hp === Sim.TYPES.tank.hp, 'Iron Dome stopped the first anti-tank missile');
  for (let i = 0; i < 30 * 4; i++) pin(); ok(T.hp < Sim.TYPES.tank.hp, 'the next ones got through (one a minute)');
  // (the tank out of crushing reach — CRUSH_GO — and in the soldier's range: this is about the missiles)
  const s2 = fresh(), at2 = mk(s2, 'blue', 'at', 1, 500, 320), tk2 = mk(s2, 'red', 'tank', 1, 630, 320), T2 = s2.units.find(u => u.squad === tk2.id); T2.trophy = Sim.TROPHY_MAX;
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
{
  // the AI's missile style (the full game): few squads, kept home; missile works; the trucks fire at buildings, never
  // the HQ. Shot down AI_MISSILE_MISS times (Arrow) — it turns steady
  let s = Sim.create(311, 2200, 'normal', Sim.H * 2); Sim.extras(s); s = Sim.openField(s); s.fog = true; s.bots = ['blue', 'red']; s.style.red = 'missile';
  let far = 0, n = 0, works = 0; const shots = new Set();
  while (!s.over && s.t < 900) {
    Sim.step(s, 1 / 30);
    if (Math.abs(s.t % 30) < 1 / 30) { const hq = s.nodes.find(k => k.side === 'red' && k.kind === 'hq'); if (hq) for (const u of s.units) if (u.side === 'red' && !Sim.TYPES[u.type].care && !Sim.TYPES[u.type].air) { n++; if (Math.abs(u.x - hq.x) > 450) far++; } }
    works = Math.max(works, s.nodes.filter(k => k.side === 'red' && k.kind === 'ssmshop').length);
    for (const u of s.units) if (u.side === 'red' && u.type === 'ssm' && u.launchedAt != null) shots.add(u.id + ':' + u.launchedAt);
  }
  ok(works >= 2, `it builds missile works (${works})`);
  ok(far / Math.max(1, n) < 0.15, `its squads keep home (${(far / Math.max(1, n) * 100).toFixed(0)}% far out)`);
  ok(shots.size >= 2, `its trucks launch (${shots.size})`);
  const s2 = Sim.create(3, 1400, 'normal'); s2.style.red = 'missile'; s2.downed = { blue: 0, red: Sim.AI_MISSILE_MISS }; Sim.think(s2, 'red', 'normal');
  ok(s2.style.red === 'steady', 'shot down too often: it plays steady');
}
if (bad) process.exitCode = 1;
