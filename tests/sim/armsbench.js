// Arms balance (not in npm test): blue split between a bot in the player's arms (s.meBot) and the computer partner,
// against red (one AI, all arms) — each split of the four arms, and blue whole as the baseline, on the same seeds.
// Per game: who won and when, and how much damage each arm of blue dealt (hp off red units and buildings, by the
// squad that hit them — not kills: artillery kills in one hit and took the credit for what aircraft had worn down).
// `node tests/sim/armsbench.js 4 [split] [min] [nomark]` — split: base | armor+infantry | armor+air | armor+guns | all.
const Sim = require('../load-sim.js')();
const N = +process.argv[2] || 3, PICK = process.argv[3] || 'all', MIN = +process.argv[4] || 30;
const ALL = { base: null, 'armor+infantry': ['armor', 'infantry'], 'armor+air': ['armor', 'air'], 'armor+guns': ['armor', 'guns'] };
const SPLITS = PICK === 'all' ? Object.keys(ALL) : [PICK];
const armOf = q => !q ? '?' : q.cmd ? 'cmd' : Sim.ARM_OF[q.type] || '?';
for (const name of SPLITS) {
  const split = ALL[name], r = { blue: 0, red: 0, none: 0 }, dmg = {}, T = []; const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    let s = Sim.create(700 + i, 2200, 'normal', Sim.H * 2, { singles: true }); Sim.extras(s); s = Sim.openField(s); s.fog = true;
    Sim.setArms(s, split); s.meBot = true; if (process.argv.includes('nomark')) s.designate = false;
    const sq = new Map(), hp = new Map();
    while (!s.over && s.t < MIN * 60) {
      for (const e of s.units) if (e.side === 'red') hp.set(e, e.hp);
      for (const n of s.nodes) if (n.side === 'red') hp.set(n, n.hp);
      Sim.step(s, 1 / 30);
      for (const q of s.squads) sq.set(q.id, q);
      for (const [e, h] of hp) { const d = h - Math.max(0, e.hp), q = sq.get(e.by); if (d > 0 && q && q.side === 'blue') dmg[armOf(q)] = (dmg[armOf(q)] || 0) + d; }
      hp.clear();
    }
    r[s.over || 'none']++; T.push(Math.round(s.t / 60));
  }
  const tot = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
  console.log(name.padEnd(16), `blue ${r.blue} red ${r.red} unfinished ${r.none}`, ' min:', T.join(','), ' damage by arm:', Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(100 * v / tot)}%`).join(' '), `(${Math.round((Date.now() - t0) / 1000)}s)`);
}
