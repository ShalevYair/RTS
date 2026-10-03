// Fuel (fuel.js): vehicles burn it moving (FUEL_T s on a full tank), stop when it's gone, go to fill up when low; a
// fuel station makes barrels and its trucks carry them to the front, and to a vehicle that ran dry; a barrel fills a
// jeep, a tank takes two; planes fly back to the airfield to fill up; a missile on a pile blows it up.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f && f()) return; } };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
// the full game's open field with our HQ up; fog off, the enemy idle and far
function field(seed) {
  const s = Sim.openField(Sim.create(seed, 2400, 'normal', 1280, { singles: true })); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  s.lakes = []; s.hills = []; s.elev = null; s.posts = [];
  Sim.planHq(s, 'blue', 250, 640); step(s, 120, () => !s.hqPending.blue && s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  return s;
}
ok(Sim.needsFuel('jeep') && Sim.needsFuel('tank') && Sim.needsFuel('heli') && !Sim.needsFuel('inf') && !Sim.needsFuel('fueltruck'), 'vehicles and aircraft need fuel; soldiers and fuel trucks don\'t');
{
  // a jeep driving burns 1/FUEL_T a second; standing, none; empty, it stops
  const s = field(3), q = mk(s, 'jeep', 700, 300), u = unitOf(s, q); step(s, 0.1);
  Sim.order(s, q.id, 'hold', 2000, 300, true); step(s, 20);
  const used = 1 - u.fuel;
  ok(Math.abs(used - 20 / Sim.FUEL_T) < 0.02, `20 s of driving used ${(used * 100).toFixed(0)}% (${(100 * 20 / Sim.FUEL_T).toFixed(0)}% expected)`);
  Sim.order(s, q.id, 'hold', u.x, u.y, true); step(s, 3); const f0 = u.fuel; step(s, 10);
  ok(Math.abs(u.fuel - f0) < 0.002, 'standing still: no fuel used');
  u.fuel = 0.001; u.refuel = false; s.units.filter(m => m.side === 'blue' && m !== u).forEach(m => { m.x = 100; });
  Sim.order(s, q.id, 'hold', 1800, 300, true); step(s, 3); const x0 = u.x; step(s, 8);
  ok(u.fuel === 0 && Math.abs(u.x - x0) < 1, `out of fuel: it stands (moved ${Math.abs(u.x - x0).toFixed(1)})`);
}
{
  // low on fuel: off to the nearest fuel by itself — here our HQ — and fills up there
  const s = field(4), q = mk(s, 'jeep', 700, 640), u = unitOf(s, q); step(s, 0.1); u.fuel = 0.2;
  step(s, 60, () => u.fuel >= 0.95);
  ok(u.fuel >= 0.95, `low: it went to the HQ and filled up (${(u.fuel * 100).toFixed(0)}% at ${s.t.toFixed(0)} s)`);
}
{
  // a station: barrels in its yard; a truck takes a load to the front and drops a pile there
  const s = field(5); s.cd = s.cd || {};
  ok(Sim.build(s, 'blue', 'fuelst', 330, 820), 'a fuel station laid');
  step(s, 240, () => (s.piles || []).some(p => p.node));
  const yard = (s.piles || []).find(p => p.node);
  ok(!!yard, 'the station stands, with a yard');
  Sim.setFront(s, 'blue', 900, 640);
  step(s, 240, () => (s.piles || []).some(p => !p.node && p.n >= Sim.FUEL_LOAD));
  const front = (s.piles || []).find(p => !p.node);
  ok(front && front.n >= Sim.FUEL_LOAD && Math.hypot(front.x - 900, front.y - 640) < 80, `a truck brought barrels to the front (${front ? front.n : 0})`);
  // a tank by the pile, nearly empty: it takes two barrels; a jeep one
  const tq = mk(s, 'tank', front.x + 40, front.y), t = unitOf(s, tq), jq = mk(s, 'jeep', front.x - 40, front.y), j = unitOf(s, jq); step(s, 0.1);
  t.fuel = 0.05; j.fuel = 0.05; const n0 = front.n; step(s, 20, () => t.fuel >= 0.95 && j.fuel >= 0.95);
  ok(t.fuel >= 0.95 && j.fuel >= 0.95 && n0 - front.n === 3, `filled from the pile: a tank 2 barrels, a jeep 1 (${n0} → ${front.n})`);
  // a jeep run dry far off: a truck drives out to it
  const dq = mk(s, 'jeep', 1300, 300), d = unitOf(s, dq); step(s, 0.1); d.fuel = 0;
  step(s, 200, () => d.fuel > 0.5);
  ok(d.fuel > 0.5, `a jeep dry far off: a truck came and filled it (${(d.fuel * 100).toFixed(0)}% at ${s.t.toFixed(0)} s)`);
  // a missile on the pile: gone
  Sim.blastPiles(s, front.x, front.y, 40);
  ok(front.n === 0, 'a missile on the pile: the barrels blew up');
}
{
  // a plane: flies FUEL_AIR s, turns back under PLANE_BACK and fills up at the airfield
  const s = field(6);
  const q = mk(s, 'air', 600, 640), a = unitOf(s, q); step(s, 0.1); Sim.order(s, q.id, 'hold', 900, 640, true);
  a.fuel = 0.25; let back = false; step(s, 60, () => { if (a.rearm) back = true; return back && a.fuel >= 0.99; });
  ok(back && a.fuel >= 0.99, `a plane low on fuel flew back and filled up (${(a.fuel * 100).toFixed(0)}%)`);
}
if (bad) process.exitCode = 1;
