// The enemy's commanders (AI_STYLES) in the full game on the big map: the air force builds airfields and a tanker base
// and flies; the commando commander sets commandos down behind our lines by helicopter; hard, regular, uses every
// ability (AI_PLAN_HARD: missiles, the air force, commando raids).
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const game = (seed, diff, style) => { let s = Sim.create(seed, 2200, diff, Sim.H * 2); Sim.extras(s); s = Sim.openField(s); s.fog = true; s.bots = ['blue', 'red']; if (style) s.style.red = style; return s; };
const run = (s, sec, f) => { while (!s.over && s.t < sec) { Sim.step(s, 1 / 30); if (f) f(); } };
const has = (s, kind) => s.nodes.some(n => n.side === 'red' && n.kind === kind && n.hp > 0);
{
  const s = game(312, 'normal', 'air'); let planes = 0, tankers = 0;
  run(s, 1200, () => { planes = Math.max(planes, s.units.filter(u => u.side === 'red' && u.type === 'air').length); tankers = Math.max(tankers, s.units.filter(u => u.side === 'red' && u.type === 'tanker').length); });
  ok(planes >= 2 && tankers >= 1, `the air force: up to ${planes} aircraft and ${tankers} tankers in the air`);
}
{
  // (the drop: a red commando set down on our side of the map — x under 40% of it — straight from a helicopter)
  const s = game(317, 'normal', 'commando'); let dropped = 0, liftAt = null;
  run(s, 1500, () => { for (const u of s.units) if (u.side === 'red' && u.type === 'commando' && u.x < s.W * 0.4 && !u.seenDrop) { u.seenDrop = true; dropped++; } if (!liftAt && s.units.some(u => u.side === 'red' && u.type === 'lift')) liftAt = s.t; });
  ok(liftAt !== null && dropped >= 1, `the commando commander: a helicopter (${liftAt ? Math.round(liftAt / 60) + ' min' : '-'}) set ${dropped} commandos down deep on our side`);
}
{
  const s = game(314, 'hard'); s.style.red = 'steady'; const seen = new Set();
  run(s, 1500, () => { if (Math.abs(s.t % 10) < 1 / 30) for (const n of s.nodes) if (n.side === 'red') seen.add(n.kind); });
  const want = ['ssmshop', 'airfield', 'commandopost', 'helilift', 'tankshop'];
  ok(want.every(k => seen.has(k)), `hard: every arm — ${want.filter(k => seen.has(k)).join(', ')}${want.some(k => !seen.has(k)) ? ' (missing ' + want.filter(k => !seen.has(k)).join(', ') + ')' : ''}`);
}
process.exit(bad ? 1 : 0);
