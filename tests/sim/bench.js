// Full games driven by the AI on both sides. play() returns the finished state; run directly for a
// balance table: each red difficulty vs a 'normal' blue bot, with and without fog. `node bench.js 10 big`: on the big map
// (2× wide, 2× high); `node bench.js 10 big field`: the full game as played (open field: the HQ placed by a bulldozer,
// support squads); add `extras` for the posts and the weather.
const Sim = require('../load-sim.js')();
function play(seed, W, diff, opts = {}) {
  let s = opts.big ? Sim.create(seed, W * 2, diff, Sim.H * 2) : Sim.create(seed, W, diff);
  if (opts.extras) Sim.extras(s); // (posts, weather, roads: the full game on the big maps)
  if (opts.field) s = Sim.openField(s);
  s.fog = opts.fog ?? true; s.bots = ['blue', 'red']; s.botDiff = opts.blue || 'normal'; if (opts.style) s.style.red = opts.style;
  const shares = [];
  while (!s.over && s.t < (opts.limit || 900)) { Sim.step(s, 1 / 30); if (Math.abs(s.t % 60) < 1 / 30) shares.push(Sim.share(s, 'blue')); }
  return { s, shares };
}
module.exports = { Sim, play };
if (require.main === module) {
  const N = +process.argv[2] || 10, big = process.argv.includes('big'), field = process.argv.includes('field'), extras = process.argv.includes('extras');
  for (const fog of [true, false]) for (const diff of ['easy', 'normal', 'hard']) {
    const r = { blue: 0, red: 0, none: 0 }; let T = 0, t0 = Date.now();
    for (let i = 0; i < N; i++) { const { s } = play(300 + i, [800, 1100, 1400][i % 3], diff, { fog, big, field, extras, limit: big ? 1500 : 900 }); r[s.over || 'none']++; T += s.t; }
    console.log(`fog ${fog ? 'on ' : 'off'} red ${diff.padEnd(6)} red wins ${r.red}/${N}  blue ${r.blue}  unfinished ${r.none}  avg ${Math.round(T / N)}s  (${Date.now() - t0}ms)`);
  }
}
