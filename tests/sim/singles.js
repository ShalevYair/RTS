// The player's units are each their own squad (singles; games made with { singles: true }, as the UI does): the
// opening, a building's units (all at once the first time, then one at a time), standing together when ordered
// together (in a line, or a block when many), a rally point, fallen ones dropped. The AI keeps its squads.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
{
  const s = Sim.create(4, 1200, 'normal', Sim.H, { singles: true }); s.fog = false;
  const blue = s.squads.filter(q => q.side === 'blue'), red = s.squads.filter(q => q.side === 'red');
  ok(blue.length === 10 && blue.every(q => q.single && s.units.filter(u => u.squad === q.id).length === 1), `ours: ${blue.length} squads of one unit each`);
  ok(red.length === 2 && red.every(q => !q.single), 'the AI keeps its squads (infantry, jeeps)');
  const tent = s.nodes.find(n => n.side === 'blue' && n.kind === 'tent');
  ok(tent.squads.length === Sim.STRUCTS.tent.size && blue.filter(q => q.home === tent.id).length === tent.squads.length, 'the tent counts its soldiers as its own');
  // a building: its first units all at once, then one at a time after a loss
  s.bots = []; ok(Sim.build(s, 'blue', 'jeepshop', 230, 420), 'a jeep workshop');
  const shop = s.nodes.find(n => n.kind === 'jeepshop'); shop.rally = { x: 600, y: 420 };
  step(s, Sim.STRUCTS.jeepshop.build + Sim.STRUCTS.jeepshop.every + 1);
  const jeeps = () => s.squads.filter(q => q.home === shop.id && !q.dead);
  ok(jeeps().length === 1, `the workshop's first jeep came out alone (${jeeps().length})`);
  ok(jeeps().every(q => Math.hypot(q.order.want.x - 600, q.order.want.y - 420) < 1), 'and went for its rally point');
  step(s, Sim.STRUCTS.jeepshop.every * 5);
  ok(jeeps().length === Sim.BUILD_UNITS, `then one at a time, up to ${jeeps().length}/${Sim.BUILD_UNITS}`);
  const lost = jeeps()[0]; s.units = s.units.filter(u => u.squad !== lost.id); step(s, 1);
  ok(jeeps().length === Sim.BUILD_UNITS - 1, 'one lost');
  step(s, Sim.STRUCTS.jeepshop.every + 1);
  ok(jeeps().length === Sim.BUILD_UNITS, 'and made again on its own');
  step(s, 31);
  ok(!s.squads.includes(lost), 'a fallen single is dropped after a while');
}
{
  // twenty soldiers ordered together: a block; five tanks: a line, side by side with no gap between squads
  const s = Sim.create(6, 1400, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false;
  const mk = (t, n, x, y) => Array.from({ length: n }, (_, i) => { const q = Sim._makeSquad(s, 'blue', t, null, x, y + i * 12); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y + i * 12); return q.id; });
  const inf = mk('inf', 20, 300, 100), tk = mk('tank', 5, 300, 400);
  Sim.formation(s, [...inf, ...tk], 'hold', 700, 320, true, 0); // (facing east: the player's front faces the way it's given)
  const at = ids => ids.map(id => { const o = s.squads.find(q => q.id === id).order; return { x: o.x, y: o.y }; });
  const ext = l => ({ w: Math.max(...l.map(p => p.y)) - Math.min(...l.map(p => p.y)), d: Math.max(...l.map(p => p.x)) - Math.min(...l.map(p => p.x)) });
  const a = ext(at(inf)), b = ext(at(tk)), sp = Sim.TYPES.tank.r * 2 + 18;
  ok(a.d > 40 && a.w < 160, `20 soldiers: a block (${Math.round(a.w)} across, ${Math.round(a.d)} deep)`);
  const tl = at(tk), span = Math.max(...tl.flatMap(p => tl.map(q => Math.hypot(p.x - q.x, p.y - q.y))));
  ok(Math.abs(span - 4 * sp) < 2, `5 tanks: a line ${Math.round(span)} long (4 gaps of ${sp})`);
  const to = Sim.pack(s, inf); const c = ext(at(inf));
  ok(to === 'line' && c.d < 1, 'P: the soldiers in a line instead');
}
{
  // the player's line faces the way it went and holds it: an enemy showing up beside it doesn't swing it round
  const s = Sim.create(7, 1400, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = [];
  const tk = Array.from({ length: 5 }, (_, i) => { const q = Sim._makeSquad(s, 'blue', 'tank', null, 300, 200 + i * 40); q.size = 1; q.single = true; Sim._fillSquad(s, q, 300, 200 + i * 40); return q; });
  Sim.formation(s, tk.map(q => q.id), 'hold', 700, 280, true);
  for (let i = 0; i < 30 * 60; i++) Sim.step(s, 1 / 30); // (there: the march over)
  const spots = () => tk.map(q => ({ x: q.order.x, y: q.order.y }));
  const ys = spots().map(p => p.y), xs = spots().map(p => p.x);
  ok(Math.max(...xs) - Math.min(...xs) < 8 && Math.max(...ys) - Math.min(...ys) > 100, 'sent east: the line stands across the way, north to south');
  const e = Sim._makeSquad(s, 'red', 'inf', null, 700, 120); e.size = 3; Sim._fillSquad(s, e, 700, 120);
  for (const u of s.units) if (u.side === 'red') u.cd = 1e9;
  const a0 = spots(); for (let i = 0; i < 30 * 10; i++) Sim.step(s, 1 / 30);
  const moved = Math.max(...spots().map((p, i) => Math.hypot(p.x - a0[i].x, p.y - a0[i].y)));
  ok(moved < 1, `an enemy close by to the north: the line doesn't turn to it (spots moved ${moved.toFixed(1)})`);
}
if (bad) process.exitCode = 1;
