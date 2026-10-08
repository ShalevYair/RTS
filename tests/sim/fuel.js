// Supplies (fuel.js, s.logi — the full game): nobody goes back for anything. A vehicle burns fuel moving and stands
// when it's out until a fuel truck is by it; a unit out of ammunition holds its fire until an ammunition truck comes;
// soldiers drink, and dry they lose health; trucks serve round them, go where they're told (new ones to the front),
// and empty drive to their building and back; supply buildings: 2 of each past the allowance, a truck at once and
// another 2 minutes on; a water building only on a lake's bank; a medic goes to the hurt; planes fly back to fill up.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f && f()) return; } };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
// the full game's open field with our HQ up; fog off, the enemy idle and far; one lake (for water)
function field(seed, lake) {
  const s = Sim.openField(Sim.create(seed, 2400, 'normal', 1280, { singles: true })); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  s.lakes = lake ? [{ x: 420, y: 900, rx: 90, ry: 60, a: 0 }] : []; s.hills = []; s.elev = null; s.posts = [];
  Sim.planHq(s, 'blue', 250, 640); step(s, 120, () => !s.hqPending.blue && s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  return s;
}
const built = (s, kind) => s.nodes.find(n => n.side === 'blue' && n.kind === kind && s.t >= n.ready);
ok(Sim.needsFuel('jeep') && Sim.needsFuel('tank') && Sim.needsFuel('heli') && !Sim.needsFuel('inf') && !Sim.needsFuel('fueltruck') && !Sim.needsFuel('watertruck'), 'vehicles and aircraft need fuel; soldiers and supply trucks don\'t');
ok(Sim.needsWater('inf') && Sim.needsWater('commando') && Sim.needsWater('med') && !Sim.needsWater('jeep'), 'every soldier drinks, the commando too');
{
  // a jeep driving burns 1/FUEL_T a second; empty, it stands — and doesn't drive off anywhere for fuel
  const s = field(3), q = mk(s, 'jeep', 900, 300), u = unitOf(s, q); step(s, 0.1);
  Sim.order(s, q.id, 'hold', 2000, 300, true); step(s, 20);
  ok(Math.abs(1 - u.fuel - 20 / Sim.FUEL_T) < 0.02, `20 s of driving used ${((1 - u.fuel) * 100).toFixed(0)}%`);
  Sim.order(s, q.id, 'hold', u.x, u.y, true); step(s, 3);
  u.fuel = 0.1; const x0 = u.x, y0 = u.y; step(s, 15);
  ok(Math.hypot(u.x - x0, u.y - y0) < 5, 'low on fuel: it stays where it is');
  u.fuel = 0; Sim.order(s, q.id, 'hold', 1800, 300, true); step(s, 3); const x1 = u.x; step(s, 8);
  ok(Math.abs(u.x - x1) < 1, 'out of fuel: it stands');
  // a fuel truck sent to it fills it
  const fq = mk(s, 'fueltruck', 700, 300); step(s, 0.1); Sim.order(s, fq.id, 'hold', u.x - 30, u.y, false);
  step(s, 150, () => u.fuel >= 0.95);
  ok(u.fuel >= 0.95, `a fuel truck came and filled it (${(u.fuel * 100).toFixed(0)}% at ${s.t.toFixed(0)} s)`);
}
{
  // supply buildings: past the allowance, at most 2 of each; a truck at once, a second 2 minutes on, then no more
  const s = field(5); s.cd = s.cd || {};
  const lim = Sim.buildLimit(s, 'blue');
  ok(Sim.build(s, 'blue', 'fuelst', 330, 820) && Sim.build(s, 'blue', 'fuelst', 330, 460) && Sim.build(s, 'blue', 'depot', 450, 820), 'two fuel stations and a depot laid');
  ok(Sim.buildCount(s, 'blue') === 0 && Sim.buildLimit(s, 'blue') === lim, 'they don\'t take from the building allowance');
  ok(Sim.buildCheck(s, 'blue', 450, 460, 'fuelst') === 'max', 'a third fuel station: no');
  step(s, 400, () => s.nodes.filter(n => n.side === 'blue' && n.kind === 'fuelst' && s.t >= n.ready).length === 2);
  const t0 = s.t; step(s, 5);
  const trucks = () => s.units.filter(u => u.side === 'blue' && u.type === 'fueltruck').length;
  ok(trucks() >= 2, `a truck at once from each (${trucks()})`);
  step(s, 125); ok(trucks() === 4, `2 minutes on, a second each: ${trucks()}`);
  step(s, 130); ok(trucks() === 4, 'and no more than 4');
  // trucks follow the front, unless the player sent them somewhere
  const tr = s.units.filter(u => u.side === 'blue' && u.type === 'fueltruck'), told = s.squads.find(q => q.id === tr[0].squad);
  Sim.order(s, told.id, 'hold', 500, 300, false);
  Sim.setFront(s, 'blue', 1000, 640); step(s, 90);
  const atFront = tr.slice(1).filter(u => Math.hypot(u.x - 1000, u.y - 640) < 160).length;
  ok(atFront === 3 && Math.hypot(tr[0].x - 500, tr[0].y - 300) < 60, `the others went to the front (${atFront}/3); the one we sent stayed`);
  // an empty truck drives to its station, fills, and comes back
  const e = tr[1]; e.load = 0; let went = false;
  step(s, 150, () => { const st = s.nodes.find(n => n.kind === 'fuelst' && n.side === 'blue' && Math.hypot(n.x - e.x, n.y - e.y) < 80); if (st) went = true; return went && e.load >= Sim.TRUCK_CAP.fueltruck && Math.hypot(e.x - 1000, e.y - 640) < 160; });
  ok(went && e.load >= Sim.TRUCK_CAP.fueltruck && Math.hypot(e.x - 1000, e.y - 640) < 160, `empty: to the station, filled, back at the front (${s.t.toFixed(0)} s)`);
}
{
  // ammunition: out of it, a unit holds its fire and stays; an ammunition truck by it fills it (the jeep: in the tank's range, out of its own)
  const s = field(6), q = mk(s, 'tank', 900, 640), u = unitOf(s, q), e = mk(s, 'jeep', 1005, 640, 'red'); step(s, 0.1);
  const foe = unitOf(s, e); Sim.order(s, e.id, 'hold', foe.x, foe.y, true); Sim.order(s, q.id, 'hold', u.x, u.y, true); step(s, 1); u.sup = 0; const h0 = foe.hp, x0 = u.x; step(s, 6);
  ok(foe.hp === h0 && Math.abs(u.x - x0) < 20, 'out of ammunition: no shots, and it doesn\'t go back');
  foe.hp = 0; step(s, 0.1);
  const aq = mk(s, 'truck', u.x - 40, u.y); step(s, 20, () => u.sup >= 0.95);
  ok(u.sup >= 0.95, `an ammunition truck by it filled it (${(u.sup * 100).toFixed(0)}%)`);
}
{
  // water: a soldier drinks his canteen in WATER_T s; dry, he loses health; by a water truck or a water building he drinks
  const s = field(7, true), q = mk(s, 'inf', 900, 300), u = unitOf(s, q); step(s, 30);
  ok(Math.abs(1 - u.water - 30 / Sim.WATER_T) < 0.01, `30 s: ${((1 - u.water) * 100).toFixed(0)}% of his water`);
  u.water = 0; const h0 = u.hp; step(s, 10);
  ok(u.hp < h0 - 0.08 * Sim.TYPES.inf.hp, `dry: 10 s cost ${((h0 - u.hp) / Sim.TYPES.inf.hp * 100).toFixed(0)}% of his health`);
  mk(s, 'watertruck', 930, 300); step(s, 12);
  ok(u.water > 0.9, `a water truck by him: ${(u.water * 100).toFixed(0)}%`);
  ok(Sim.buildCheck(s, 'blue', 330, 460, 'waterst') !== 'shore', 'a water building away from a lake: yes too (a well — with no lake in reach there was no water at all)');
  const p = Sim.shoreSpots(s, { x: 250, y: 640 }, Sim.STRUCTS.waterst.r)[0];
  ok(p && Sim.build(s, 'blue', 'waterst', p.x, p.y), 'on the bank: yes');
}
{
  // a hurt soldier stays; a medic near goes to him
  const s = field(8), q = mk(s, 'inf', 900, 640), u = unitOf(s, q), mq = mk(s, 'med', 1000, 760); step(s, 0.1);
  u.hp = 0.3 * Sim.TYPES.inf.hp; const x0 = u.x;
  step(s, 40, () => u.hp >= 0.9 * Sim.TYPES.inf.hp);
  ok(u.hp >= 0.9 * Sim.TYPES.inf.hp && Math.abs(u.x - x0) < 60, `the medic came to him and treated him where he was (${(u.hp / Sim.TYPES.inf.hp * 100).toFixed(0)}%)`);
}
{
  // a plane: flies FUEL_AIR s, turns back under PLANE_BACK and fills up at the airfield
  const s = field(9); Sim.build(s, 'blue', 'airfield', 330, 820);
  step(s, 400, () => built(s, 'airfield'));
  const pq = mk(s, 'air', 900, 640), p = unitOf(s, pq); step(s, 0.1);
  Sim.order(s, pq.id, 'hold', 1400, 640, true); p.fuel = Sim.FUEL_AIR ? 0.25 : 0.25;
  step(s, 30, () => p.rearm);
  ok(p.rearm, 'low on fuel: the plane turns back');
  step(s, 90, () => !p.rearm);
  ok(!p.rearm && p.fuel > 0.95, `filled up at the airfield (${(p.fuel * 100).toFixed(0)}%)`);
}
{
  // the tanker: out of its base to its place over the middle; a plane sent far fills up by it on the way, and never
  // runs dry; without one, a plane turns back when what's left takes it home
  const s = field(11); Sim.build(s, 'blue', 'airfield', 330, 820); Sim.build(s, 'blue', 'tankerbase', 330, 460);
  step(s, 400, () => built(s, 'airfield') && built(s, 'tankerbase'));
  step(s, 60, () => s.units.some(u => u.side === 'blue' && u.type === 'tanker'));
  const tk = s.units.find(u => u.side === 'blue' && u.type === 'tanker');
  ok(!!tk, 'the tanker base sends out a tanker at once');
  step(s, 60);
  const spot = { x: 250 + (1200 - 250) * 0.8, y: 640 };
  ok(tk && Math.hypot(tk.x - spot.x, tk.y - spot.y) < 160, `it circles over the middle (${tk && Math.round(tk.x)}, ${tk && Math.round(tk.y)})`);
  const pq = mk(s, 'air', 400, 640), p = unitOf(s, pq); step(s, 0.1);
  Sim.order(s, pq.id, 'hold', 2100, 200, true); // (far out, clear of the enemy's tanks)
  let low = 1, tanked = 0, wasT = false, home = false; tk.fuel = 1;
  step(s, 280, () => { low = Math.min(low, p.fuel); if (p.tank != null && !wasT) tanked++; wasT = p.tank != null; if (p.rearm) home = true; return p.hp <= 0; });
  ok(tanked >= 2 && low > 0.02 && !home, `a plane far out filled up by the tanker ${tanked} times, never under ${(low * 100).toFixed(0)}%, never back home`);
  const given = s.units.filter(u => u.side === 'blue' && u.type === 'tanker').reduce((a, u) => a + Sim.TANKER_CAP - u.load, 0);
  ok(given > 1, `the tankers gave of their fuel (${given.toFixed(1)} fulls)`);
  // no tanker: back home, with what the way takes left
}
{
  const s = field(12); Sim.build(s, 'blue', 'airfield', 330, 820); step(s, 400, () => built(s, 'airfield'));
  const q2 = mk(s, 'air', 400, 640), p2 = unitOf(s, q2); step(s, 0.1);
  Sim.order(s, q2.id, 'hold', 2300, 640, true); let at = null;
  step(s, 200, () => { if (p2.rearm && at === null) at = p2.fuel; return p2.rearm; })
  ok(at !== null && at > 0.2, `without a tanker it turns for home in time (${at !== null ? (at * 100).toFixed(0) : '-'}% left)`);
  step(s, 120, () => !p2.rearm); ok(!p2.rearm && p2.fuel > 0.95, 'and fills up there');
}
{
  // the tutorial (no s.logi): trucks and medics as before
  const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false; s.collapseAfter = Infinity;
  ok(!s.logi && !s.water, 'no supply rules outside the full game');
  mk(s, 'truck', 700, 300); const iq = mk(s, 'inf', 720, 300), i = unitOf(s, iq); step(s, 0.1); i.sup = 0.3;
  step(s, 10); ok(i.sup > 0.9 && i.water === undefined, `a truck refills as before, no water (${(i.sup * 100).toFixed(0)}%)`);
}
process.exit(bad ? 1 : 0);
