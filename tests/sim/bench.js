// Full games driven by the AI on both sides. play() returns the finished state; run directly for a
// balance table: each red difficulty vs a 'normal' blue bot, with and without fog.
const Sim = require('../load-sim.js')();
function play(seed, W, diff, opts = {}) {
  const s = Sim.create(seed, W, diff);
  s.fog = opts.fog ?? true; s.bots = ['blue', 'red']; s.botDiff = opts.blue || 'normal';
  const shares = [];
  while (!s.over && s.t < (opts.limit || 900)) { Sim.step(s, 1 / 30); if (Math.abs(s.t % 60) < 1 / 30) shares.push(Sim.share(s, 'blue')); }
  return { s, shares };
}
module.exports = { Sim, play };
if (require.main === module) {
  const N = +process.argv[2] || 10;
  for (const fog of [true, false]) for (const diff of ['easy', 'normal', 'hard']) {
    const r = { blue: 0, red: 0, none: 0 }; let T = 0, t0 = Date.now();
    for (let i = 0; i < N; i++) { const { s } = play(300 + i, [800, 1100, 1400][i % 3], diff, { fog }); r[s.over || 'none']++; T += s.t; }
    console.log(`fog ${fog ? 'on ' : 'off'} red ${diff.padEnd(6)} red wins ${r.red}/${N}  blue ${r.blue}  unfinished ${r.none}  avg ${Math.round(T / N)}s  (${Date.now() - t0}ms)`);
  }
}
