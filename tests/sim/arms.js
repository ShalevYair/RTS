// Arms (DESIGN.md, "זרועות"): blue split between the player's arms and the computer partner's — each builds and moves
// only its own. Here a bot stands in for the player (s.meBot); blue's units are singles, as in the game.
const assert = require('assert');
const Sim = require('../load-sim.js')();
function game(seed, arms, opts = {}) {
  let s = Sim.create(seed, 2200, 'normal', Sim.H * 2, { singles: true });
  Sim.extras(s); s = Sim.openField(s); s.fog = true; Sim.setArms(s, arms); s.meBot = true;
  while (!s.over && s.t < (opts.limit || 1200)) Sim.step(s, 1 / 30);
  return s;
}
let wins = { blue: 0, red: 0, none: 0 };
for (const [i, arms] of [['armor', 'infantry'], ['air', 'guns'], ['armor', 'air'], ['infantry', 'guns']].entries()) {
  const s = game(500 + i, arms), blue = s.nodes.filter(n => n.side === 'blue' && Sim.PRODUCERS.includes(n.kind));
  const by = { me: [], mate: [] }; for (const n of blue) by[Sim.armSide(s, 'blue', n.kind) || 'me'].push(n.kind);
  console.log(arms.join('+').padEnd(16), 'over', s.over || '-', Math.round(s.t) + 's', ' me:', by.me.join(','), ' | mate:', by.mate.join(','));
  // (each built only its own; the partner something)
  for (const k of by.me) assert.ok(arms.includes(Sim.ARM_OF[k]), 'player built ' + k);
  for (const k of by.mate) assert.ok(!arms.includes(Sim.ARM_OF[k]), 'partner built ' + k);
  wins[s.over || 'none']++;
}
console.log('arms ok', wins);
