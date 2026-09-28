// Lakes: ground units never stand in one and find their way round; aircraft fly over; nothing is built in one
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
// inside a (rotated) lake ellipse
const wet = (l, p) => { const c = Math.cos(l.a), s = Math.sin(l.a), dx = p.x - l.x, dy = p.y - l.y, u = (dx * c + dy * s) / l.rx, v = (-dx * s + dy * c) / l.ry; return u * u + v * v < Sim.wobble(l.w, Math.atan2(v, u)) ** 2; }; // the lake's real (uneven) outline
const small = Sim.create(3, 1000, 'normal'), big = Sim.create(3, 2400, 'normal', 1280);
{
  let n = 0, maps = 0, wetHill = 0;
  for (let seed = 1; seed <= 20; seed++) for (const [W, h] of [[1000, 640], [2400, 1280]]) {
    const g = Sim.create(seed, W, 'normal', h); maps++; if (g.lakes.length >= 2) n++;
    for (const l of g.lakes) for (let a = 0; a < 6.28; a += 0.5) for (const k of [0, 0.4, 0.6]) { const p = { x: l.x + Math.cos(a) * l.rx * k, y: l.y + Math.sin(a) * l.ry * k }; if (Sim.lakeAt(g, p, -12) && Sim.elevAt(g, p) > 0.2) wetHill++; } // (only well inside the water)
  }
  ok(n === maps, `every map has lakes (at least a pair): ${n}/${maps}`);
  ok(wetHill === 0, 'no hill in a lake: the water is flat');
}
// round the lake: infantry left of it, ordered straight through it to the far side
{
  const s = Sim.create(4, 1000, 'normal'); s.bots = []; s.fog = false;
  const l = s.lakes[0], sq = s.squads.find(q => q.id === 'blue0');
  for (const u of s.units) if (u.squad === sq.id) { u.x = l.x - l.rx - 40 + u.sx * 10; u.y = l.y + u.sy * 6; }
  Sim.step(s, 1 / 30);
  Sim.order(s, sq.id, 'hold', l.x + l.rx + 60, l.y);
  let inLake = 0;
  while (s.t < 60 && !sq.arrived) { Sim.step(s, 1 / 30); for (const u of s.units) if (u.squad === sq.id && wet(l, u)) inLake++; }
  ok(sq.arrived && inLake === 0, `ordered through a lake, the squad went round it (arrived after ${s.t.toFixed(0)} s, ${inLake} unit-ticks in the water)`);
  // an order into the lake stops at the shore
  Sim.order(s, sq.id, 'hold', l.x, l.y);
  ok(!wet(l, sq.order), `an order into the lake points at the shore (${sq.order.x.toFixed(0)}, ${sq.order.y.toFixed(0)})`);
  s.lakes.push({ x: 180, y: 200, rx: 40, ry: 20, a: 0 }); // a pond right by the HQ, where building is otherwise fine
  ok(Sim.buildCheck(s, 'blue', 180, 200) === 'bad' && Sim.buildCheck(s, 'blue', 180, 260) === '', 'no building in a lake (or on its shore)');
}
// aircraft fly over
{
  const s = Sim.create(5, 1000, 'normal'); s.bots = []; s.fog = false;
  const l = s.lakes[0], sq = { type: 'air' }, a = { id: 9999, side: 'blue', squad: 'blue0', type: 'air', x: l.x, y: l.y, hp: 90, hd: 0, aim: 0, lastFire: -99, ammo: 10, rearm: false, rearmT: 0, cd: 0, sx: 0, sy: 0 };
  s.units.push(a); Sim.step(s, 1 / 30);
  ok(wet(l, a) || Math.hypot(a.x - l.x, a.y - l.y) < 10, 'an aircraft over a lake is not pushed out');
  void sq;
}
// full bot games: no ground unit is ever in a lake
let wetTicks = 0, fin = 0;
for (let i = 0; i < 3; i++) {
  const s = Sim.create(60 + i, [900, 1200, 1400][i], 'normal'); s.bots = ['blue', 'red'];
  while (!s.over && s.t < 900) { Sim.step(s, 1 / 30); for (const u of s.units) if (!Sim.TYPES[u.type].air && s.lakes.some(l => wet(l, u))) wetTicks++; }
  if (s.over) fin++;
}
ok(wetTicks === 0 && fin >= 2, `3 bot games: ground units in the water ${wetTicks} times; ${fin}/3 finished`);
