// Arms balance (not in npm test): blue split between a bot in the player's arms (s.meBot) and the computer partner,
// against red (one AI, all arms) — each split of the four arms, and blue whole as the baseline, on the same seeds.
// Per game: who won and when, and how much each arm of blue destroyed (its squads' xp = the value of what they killed).
// `node tests/sim/armsbench.js 4` (games per split).
const Sim = require('../load-sim.js')();
const N = +process.argv[2] || 3;
const SPLITS = process.argv[3] === 'base' ? [null] : [null, ['armor', 'infantry'], ['armor', 'air'], ['armor', 'guns']];
const armOf = q => q.cmd ? 'cmd' : Sim.ARM_OF[q.type] || '?';
for (const split of SPLITS) {
  const r = { blue: 0, red: 0, none: 0 }, xp = {}, T = []; const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    let s = Sim.create(700 + i, 2200, 'normal', Sim.H * 2, { singles: true }); Sim.extras(s); s = Sim.openField(s); s.fog = true;
    Sim.setArms(s, split); s.meBot = true;
    while (!s.over && s.t < 1800) Sim.step(s, 1 / 30);
    r[s.over || 'none']++; T.push(Math.round(s.t / 60));
    for (const q of s.squads) if (q.side === 'blue' && q.xp) xp[armOf(q)] = (xp[armOf(q)] || 0) + q.xp;
  }
  const tot = Object.values(xp).reduce((a, b) => a + b, 0) || 1;
  console.log((split ? split.join('+') + ' | mate rest' : 'whole side').padEnd(28), `blue ${r.blue} red ${r.red} unfinished ${r.none}`, ' min:', T.join(','), ' kills by arm:', Object.entries(xp).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(100 * v / tot)}%`).join(' '), `(${Math.round((Date.now() - t0) / 1000)}s)`);
}
