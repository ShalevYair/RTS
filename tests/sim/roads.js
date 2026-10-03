// Roads (roads.js): the player lays a road, a bulldozer paves it square by square (on mud 3× as long); on a road
// everyone goes ROAD_K faster whatever is under it — a jeep, which can't go into mud, drives a road laid over it.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f && f()) return; } };
// the full game's open field, our HQ up (by our bulldozer), fog off, no enemy moves
function field(seed) {
  const s = Sim.openField(Sim.create(seed, 2400, 'normal', 1280, { singles: true })); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  s.lakes = []; s.hills = []; s.elev = null; s.posts = [];
  Sim.planHq(s, 'blue', 250, 640); step(s, 120, () => !s.hqPending.blue && s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  return s;
}
const fill = (s, x0, y0, x1, y1, kind) => { const G = Sim.ensureGround(s); for (let j = Math.floor(y0 / G.C); j <= Math.floor(y1 / G.C); j++) for (let i = Math.floor(x0 / G.C); i <= Math.floor(x1 / G.C); i++) G.k[j * G.w + i] = kind; };
const mk = (s, t, x, y) => { const q = Sim._makeSquad(s, 'blue', t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
{
  const s = field(5);
  ok(s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready), 'our HQ is up');
  ok(Sim.roadCheck(s, 'blue', { x: 300, y: 700 }, { x: 320, y: 700 }) === 'short', 'too short: no road');
  const r = Sim.planRoad(s, 'blue', { x: 300, y: 760 }, { x: 600, y: 760 }), t0 = s.t;
  ok(!!r && s.squads.some(q => q.type === 'dozer' && q.side === 'blue' && (q.jobs || []).includes(r.id)), `laid: on a bulldozer's list (${r && r.cells.length} squares)`);
  step(s, 120, () => r.done);
  const paved = r.cells.every(c => s.ground.k[c] === Sim.GR_ROAD), T = s.t - t0;
  ok(r.done && paved && T > r.cells.length * Sim.ROAD_T, `paved, every square, in ${T.toFixed(0)} s (${r.cells.length} × ${Sim.ROAD_T} s of work, and the drive)`);
  // a jeep on it: ROAD_K as fast
  const run = road => { const q = mk(s, 'jeep', 320, road ? 760 : 840), u = s.units.find(u => u.squad === q.id); u.x = 320; u.y = road ? 760 : 840; s.noPath = true; Sim.order(s, q.id, 'hold', 1000, u.y, true); step(s, 1); const x0 = u.x; step(s, 5); const d = u.x - x0; s.units = s.units.filter(v => v !== u); s.noPath = false; return d; };
  const k = run(true) / run(false);
  ok(Math.abs(k - Sim.ROAD_K) < 0.03, `a jeep on the road goes ${k.toFixed(2)}× as far`);
}
{
  // across mud: 3× the work a square there; and then a jeep — no way into mud — drives it
  const s = field(6); fill(s, 400, 600, 520, 900, Sim.GR_MUD);
  const r = Sim.planRoad(s, 'blue', { x: 300, y: 760 }, { x: 620, y: 760 });
  const need = r.cells.map(c => s.ground.k[c] === Sim.GR_MUD ? Sim.ROAD_T * Sim.ROAD_MUD_K : Sim.ROAD_T);
  ok(need.some(n => n === Sim.ROAD_T * 3), 'paving a square of mud takes 3× as long');
  step(s, 200, () => r.done);
  const q = mk(s, 'jeep', 320, 760), u = s.units.find(u => u.squad === q.id); u.x = 320; u.y = 760; s.noPath = true; Sim.order(s, q.id, 'hold', 600, 760, true); step(s, 15);
  ok(r.done && u.x > 560, `the road over the mud is a road: a jeep drove across it (x ${u.x.toFixed(0)})`);
}
{
  // not across a lake
  const s = field(7); s.lakes = [{ x: 500, y: 760, rx: 60, ry: 60, a: 0, w: [] }];
  ok(Sim.roadCheck(s, 'blue', { x: 300, y: 760 }, { x: 700, y: 760 }) === 'bad', 'no road across a lake');
}
if (bad) process.exitCode = 1;
