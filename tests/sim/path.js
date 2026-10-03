// Path finding: a ground unit sent past a wall of buildings or across a lake goes round it and gets there (without
// paths it pushed into the wall / slid along the shore); the straight way clear, it goes straight; and many units
// ordered at once don't slow the game.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
// an empty field (the HQs only, far off), no lakes or hills unless put there
function field(seed) {
  const s = Sim.create(seed, 1600, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq'); s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.collapseAfter = Infinity; // (no end: red has nothing)
  return s;
}
// how long until the unit is within 30 of (x, y) (or the limit)
function reach(s, q, x, y, limit) {
  Sim.order(s, q.id, 'hold', x, y, true);
  for (let i = 0; i < limit * 30; i++) { Sim.step(s, 1 / 30); const u = unitOf(s, q); if (Math.hypot(u.x - x, u.y - y) < 30) return s.t; }
  return Infinity;
}
{
  // a wall of our tents across the way, from y 120 to 520, x 700: the way round is past its top or bottom end
  const run = noPath => {
    const s = field(4); s.noPath = noPath;
    for (let y = 120; y <= 520; y += 44) s.nodes.push({ ...s.nodes[0], id: 500 + y, kind: 'tent', side: 'blue', x: 700, y, hp: 300, ready: 0, t0: 0, squad: null, prog: 0, until: Infinity });
    const q = mk(s, 'jeep', 500, 320); const t0 = s.t;
    return reach(s, q, 900, 320, 120) - t0;
  };
  const withP = run(false), without = run(true);
  ok(withP < 40, `a wall of tents in the way: round it in ${withP.toFixed(0)} s (without paths: ${Number.isFinite(without) ? without.toFixed(0) + ' s' : 'not in 120 s'})`);
}
{
  // a lake between: the jeep goes round it
  const run = noPath => {
    const s = field(5); s.noPath = noPath;
    s.lakes = [{ x: 800, y: 320, rx: 160, ry: 220, a: 0, w: [] }];
    const q = mk(s, 'jeep', 560, 330); const t0 = s.t;
    return reach(s, q, 1040, 330, 120) - t0;
  };
  const withP = run(false), without = run(true);
  ok(withP < 45, `a lake in the way: round it in ${withP.toFixed(0)} s (without paths: ${Number.isFinite(without) ? without.toFixed(0) + ' s' : 'not in 120 s'})`);
}
{
  // the way clear: straight there, no path made
  const s = field(6), q = mk(s, 'jeep', 400, 300); Sim.order(s, q.id, 'hold', 900, 300, true);
  for (let i = 0; i < 30 * 3; i++) Sim.step(s, 1 / 30);
  const u = unitOf(s, q);
  ok(!u.path && Math.abs(u.y - 300) < 5, `open ground: straight there, no path (y ${u.y.toFixed(0)})`);
}
{
  // 120 units ordered past the wall at once: the slowest tick
  const s = field(7);
  for (let y = 120; y <= 520; y += 44) s.nodes.push({ ...s.nodes[0], id: 500 + y, kind: 'tent', side: 'blue', x: 700, y, hp: 300, ready: 0, t0: 0, squad: null, prog: 0, until: Infinity });
  const qs = []; for (let i = 0; i < 120; i++) qs.push(mk(s, i % 3 ? 'inf' : 'jeep', 200 + (i % 10) * 30, 150 + Math.floor(i / 10) * 30));
  Sim.formation(s, qs.map(q => q.id), 'hold', 1000, 320, true);
  let worst = 0, all = 0; const T = 60 * 30;
  for (let i = 0; i < T; i++) { const t0 = process.hrtime.bigint(); Sim.step(s, 1 / 30); const ms = Number(process.hrtime.bigint() - t0) / 1e6; all += ms; if (ms > worst) worst = ms; }
  const past = qs.filter(q => unitOf(s, q).x > 720).length;
  ok(worst < 60, `120 units round the wall: slowest tick ${worst.toFixed(1)} ms, average ${(all / T).toFixed(2)} ms; ${past}/120 past it after 60 s`);
}
if (bad) process.exitCode = 1;
