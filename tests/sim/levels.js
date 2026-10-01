// The tutorial levels: each adds something, the enemy is held back where it should be, and a plain bot can win them
const Sim = require('../load-sim.js')();
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const N = Sim.LEVELS;
ok(N >= 5 && Sim.level(N + 1) === null && Sim.level(0) === null, `${N} levels, nothing past the last`);
let prev = null, grows = true;
for (let n = 1; n <= N; n++) {
  const s = Sim.level(n, 7, 1100);
  if (prev && !(prev.every(k => s.ui.includes(k)) && s.ui.length > prev.length)) grows = false;
  prev = s.ui;
}
ok(grows, 'every level keeps what came before and adds something');
{
  const s = Sim.level(1, 7, 1100), sq = side => s.squads.filter(q => q.side === side);
  ok(sq('blue').length === 1 && sq('red').length === 1 && !s.nodes.length && !s.bots.length && !s.fog, 'level 1: one squad each, no buildings, the enemy just stands there, no fog');
  const L = n => Sim.level(n, 7, 1100), fogAt = [...Array(N)].map((_, i) => { const g = L(i + 1); return g.fog || !!g.fogAt; }).indexOf(true) + 1;
  ok(fogAt >= N - 4 && !L(fogAt - 1).fog, `fog comes in late (level ${fogAt})`);
  // the fog comes in steps: first only the fog (coming down during the level, orders still at once), then drones,
  // then distance (orders as messages, carried out roughly), then forward HQs
  const f = L(fogAt); let t0 = f.fog; while (f.t < f.fogAt + 1) Sim.step(f, 1 / 30);
  ok(!t0 && f.fog && !Sim.friction(f) && !L(fogAt).ui.includes('eye'), `level ${fogAt}: the fog comes down after ${f.fogAt} s, with no command friction and no drones`);
  ok(L(fogAt + 1).ui.includes('eye') && !Sim.friction(L(fogAt + 1)) && Sim.friction(L(fogAt + 2)) && L(N - 1).ui.includes('fhq') && !L(N - 2).ui.includes('fhq'), 'then drones, then distance, then forward HQs');
  const fq = L(N - 1);
  ok(Sim.buildCount(fq, 'blue') === Sim.buildLimit(fq, 'blue'), `forward-HQ level: the quota starts full (${Sim.buildCount(fq, 'blue')}/${Sim.buildLimit(fq, 'blue')}), so a forward HQ is the way to build more`);
  ok(Sim.level(N - 1, 7, 1100).H > Sim.H && Sim.level(N - 2, 7, 1100).H === Sim.H, 'the big map comes in with forward HQs');
  const last = L(N);
  ok(last.dozers && last.hqPending.blue && !last.nodes.some(n => n.kind === 'hq') && last.squads.some(q => q.side === 'blue' && q.type === 'radio'), 'last level: the open field — no HQ yet, a bulldozer and a signals truck');
  const b4 = Sim.level(4, 7, 1100);
  ok(b4.builds.join() === 'tent' && !Sim.build(b4, 'blue', 'tankshop', 220, 420) && Sim.build(b4, 'blue', 'tent', 220, 420), 'level 4 builds tents only (buildings come in one kind at a time)');
  // tapping the map with the only squad selected wins it
  const r = sq('red')[0]; Sim.order(s, sq('blue')[0].id, 'attack', r.cx, r.cy);
  while (!s.over && s.t < 120) Sim.step(s, 1 / 30);
  ok(s.over === 'blue', `level 1: sending the squad at the enemy wins (${s.t.toFixed(0)} s)`);
}
{
  const s = Sim.level(3, 8, 1100); s.bots = ['red'];
  const n0 = s.nodes.length; while (s.t < 120 && !s.over) Sim.step(s, 1 / 30);
  ok(s.nodes.filter(n => n.kind !== 'drone').length <= n0 && !s.nodes.some(n => n.kind === 'drone' || n.kind === 'fhq'), 'level 3: the enemy builds nothing, no drones, no forward HQ');
}
// a plain 'normal' bot playing blue (about what a new player does) wins every level, quickly
for (let n = 1; n <= N; n++) {
  let won = 0, T = 0; const G = n <= 3 ? 3 : 2;
  for (let i = 0; i < G; i++) {
    const s = Sim.level(n, 50 + i, [900, 1200, 1400][i]); s.bots = [...s.bots, 'blue']; s.botDiff = 'normal';
    while (!s.over && s.t < 900) Sim.step(s, 1 / 30);
    if (s.over === 'blue') won++; T += s.t;
  }
  // the tutorial is meant to be won: blue wins every level, and each is over in a few minutes
  ok(won === G && T / G < (n < N ? 300 : 480), `level ${n}: a normal bot as blue won ${won}/${G} (average ${Math.round(T / G)} s)`);
}
