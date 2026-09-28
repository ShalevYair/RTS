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
  ok(Sim.level(6, 7, 1100).fog && !Sim.level(5, 7, 1100).fog, 'fog comes in at level 6');
  ok(Sim.level(7, 7, 1100).H > Sim.H && Sim.level(6, 7, 1100).H === Sim.H, 'the big map comes in at the last level');
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
// a plain 'normal' bot playing blue wins levels 1-3 (they should be easy); from 4 on they are real games (reported only)
for (let n = 1; n <= N; n++) {
  let won = 0, T = 0; const G = n <= 3 ? 3 : 2;
  for (let i = 0; i < G; i++) {
    const s = Sim.level(n, 50 + i, [900, 1200, 1400][i]); s.bots = [...s.bots, 'blue']; s.botDiff = 'normal';
    while (!s.over && s.t < 900) Sim.step(s, 1 / 30);
    if (s.over === 'blue') won++; T += s.t;
  }
  ok(n > 3 || won === G, `level ${n}: a normal bot as blue won ${won}/${G} (average ${Math.round(T / G)} s)`);
}
