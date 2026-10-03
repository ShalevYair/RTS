// The battlefield's extras (the full game on the big maps): posts taken by soldiers and what each one gives, the night
// in one peak, rain and the morning fog, fast roads and ambushes in the trees; and a whole bot game with all of it on
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
const big = (seed, k = 2) => Sim.extras(Sim.create(seed, k * 1000, 'normal', k * Sim.H));
// a quiet game: no bots, no fog, the enemy out of the way
function quiet(seed) {
  const s = big(seed); s.bots = []; s.fog = false; s.noReinforce = true; s.collapseAfter = 1e9; s.night = false; s.wxPlan = [];
  for (const u of s.units) if (u.side === 'red') { u.x = s.W - 10; u.y = 10; }
  return s;
}
const soldier = (s, side, type, x, y) => { const q = Sim._makeSquad(s, side, type, null, x, y); q.size = 1; Sim._fillSquad(s, q, x, y); return q; };
{
  const s = big(1), want = Object.fromEntries(Object.keys(Sim.POSTS).map(k => [k, Sim.POSTS[k].n[0]]));
  const got = {}; for (const p of s.posts) got[p.kind] = (got[p.kind] || 0) + 1;
  ok(Object.keys(want).every(k => got[k] === want[k]), `the big map: one radar, power and fuel station, two of the rest (${JSON.stringify(got)})`);
  ok(s.posts.every(p => !p.side) && s.posts.every(p => !Sim.lakeAt(s, p, 10)), 'all of no side, none in a lake');
  const r = s.posts.find(p => p.kind === 'radar');
  ok(Math.abs(r.x - s.W / 2) < 30, 'the radar on the centre line');
  const h = big(2, 4), n = {}; for (const p of h.posts) n[p.kind] = (n[p.kind] || 0) + 1;
  ok(n.radar === 1 && n.power === 1 && n.tower === 4 && n.bunker === 4 && n.hospital === 4, `the huge map: four of the pairs (${JSON.stringify(n)})`);
  const small = Sim.create(3, 1000, 'normal'); ok(!small.posts && !small.extras, 'the small map: none of it (no extras)');
}
{
  // taking a post: a soldier goes in (and is gone), the enemy's first one makes it no one's, the second takes it
  const s = quiet(4), p = s.posts.find(k => k.kind === 'radar');
  const q = soldier(s, 'blue', 'inf', p.x - 120, p.y); Sim.order(s, q.id, 'attack', p.x, p.y, true);
  const n0 = s.units.length, lost = s.log.length;
  step(s, 12);
  ok(p.side === 'blue', 'our soldier walked in: the radar is ours');
  ok(s.units.length === n0 - 1 && q.dead, 'and he is gone into it');
  ok(!s.log.slice(lost).some(e => /הושמד/.test(e.msg)) && s.log.slice(lost).some(e => /כבשנו את רדאר/.test(e.msg)), 'not "destroyed": "we took the radar"');
  const a = soldier(s, 'red', 'inf', p.x + 120, p.y); Sim.order(s, a.id, 'attack', p.x, p.y, true); step(s, 12);
  ok(p.side === null, "the enemy's first soldier: no one's now");
  ok(s.log.some(e => /איבדנו את רדאר/.test(e.msg)), 'and we hear we lost it');
  const b = soldier(s, 'red', 'inf', p.x + 120, p.y); Sim.order(s, b.id, 'attack', p.x, p.y, true); step(s, 12);
  ok(p.side === 'red', 'the second: theirs');
  // a commando takes it whole and walks out
  const c = soldier(s, 'blue', 'commando', p.x - 120, p.y); Sim.order(s, c.id, 'attack', p.x, p.y, true); step(s, 12);
  const cu = s.units.find(u => u.squad === c.id);
  ok(p.side === 'blue' && cu, 'a commando takes it whole, and is still there');
  // vehicles don't take posts
  const fuel = s.posts.find(k => k.kind === 'fuel'), j = soldier(s, 'blue', 'jeep', fuel.x - 120, fuel.y); Sim.order(s, j.id, 'attack', fuel.x, fuel.y, true); step(s, 10);
  ok(fuel.side === null && s.units.some(u => u.squad === j.id), 'a jeep drives up to the fuel station: nothing (only soldiers)');
}
{
  // what posts give
  const s = quiet(5), u = s.units.find(k => k.side === 'blue' && k.type === 'inf'), s0 = Sim.envSight(s, u), r0 = Sim.envRange(s, u);
  s.posts.find(p => p.kind === 'radar').side = 'blue'; step(s, 0.1);
  ok(Math.abs(Sim.envSight(s, u) / s0 - 1.1) < 1e-6 && Math.abs(Sim.envRange(s, u) / r0 - 1.1) < 1e-6, 'the radar: 10% more sight and range for all our units');
  ok(Sim.envSight(s, s.units.find(k => k.side === 'red')) === 1, "the enemy's: as they were");
  const h = s.posts.find(p => p.kind === 'hospital'); h.side = 'blue';
  const m = soldier(s, 'blue', 'inf', h.x + Sim.POSTS.hospital.r + 30, h.y), mu = s.units.find(k => k.squad === m.id); mu.hp = 30; step(s, 1);
  ok(mu.hp > 45, `by our hospital a soldier heals fast (30 → ${mu.hp.toFixed(0)} in 1 s)`);
  const an = s.posts.find(p => p.kind === 'antenna'), q0 = Sim.quality(s, 'blue', an); an.side = 'blue'; step(s, 0.1);
  ok(q0 < 0.5 && Sim.quality(s, 'blue', an) === 1 && Sim.quality(s, 'blue', an, true) === q0, `the antenna: full control round it (${q0} → 1), not for building`);
  const tw = s.posts.find(p => p.kind === 'tower'), e = s.units.find(k => k.side === 'red'); e.x = tw.x + 400; e.y = tw.y; s.fog = true; step(s, 0.1);
  const before = s.vis.blue.has(e.id); tw.side = 'blue'; step(s, 0.1);
  ok(!before && s.vis.blue.has(e.id), 'the observation tower sees far round it');
  const bk = s.posts.find(p => p.kind === 'bunker'); bk.side = 'blue';
  const g = soldier(s, 'blue', 'inf', bk.x + Sim.POSTS.bunker.r + 10, bk.y); step(s, 0.1);
  ok(s.bunkered.has(s.units.find(k => k.squad === g.id).id), 'a soldier by our bunker is sheltered (half the damage)');
}
{
  // the power station: buildings produce faster
  const prod = power => { const s = quiet(6); if (power) s.posts.find(p => p.kind === 'power').side = 'red'; const t = s.nodes.find(n => n.side === 'red' && n.kind === 'tent'); t.prog = 0;
    s.units = s.units.filter(u => u.squad !== t.squad); s.noReinforce = false; Sim.step(s, 1 / 30); const p0 = t.prog; step(s, 1); return t.prog - p0; };
  const a = prod(false), b = prod(true);
  ok(Math.abs(b / a - 1.1) < 0.02, `the power station: production 10% faster (${(b / a).toFixed(3)})`);
}
{
  // the night: noon at the start, the full dark at minute 4, back at minute 8; less sight, range and hits
  const s = Sim.create(7, 1000, 'normal'), u = s.units[0];
  const at = t => { s.t = t; return Sim.nightAt(s); };
  ok(at(0) === 0 && at(70) === 0.25 && at(250) === 1 && at(310) === 0.75 && at(490) === 0, 'one peak: 0, ¼ … the full dark at 4:00, day again at 8:00');
  s.t = 250; s.wxNow = null;
  ok(Math.abs(Sim.envSight(s, u) - 0.6) < 1e-6 && Math.abs(Sim.envRange(s, u) - 0.8) < 1e-6 && Math.abs(Sim.envHit(s, u) - 0.75) < 1e-6, 'in the full dark: sight 60%, range 80%, hits 75%');
  ok(Math.abs(Sim.skySight(s, 'blue') - 0.6) < 1e-6, 'drones and buildings see less too');
}
{
  // rain everywhere, the morning fog only on the plain
  const s = big(8); s.wxPlan = [{ kind: 'rain', a: 0, b: 100 }]; s.night = false; s.t = 50;
  const u = s.units.find(k => k.side === 'blue');
  ok(Math.abs(Sim.envSight(s, u) - 0.8) < 1e-6 && Math.abs(Sim.envHit(s, u) - 0.8) < 1e-6, 'rain: sight, range and hits 80%');
  s.wxPlan = [{ kind: 'fog', a: 0, b: 100 }]; s.wxNow = null; s.t = 51;
  const hill = s.hills.slice().sort((a, b) => b.lv - a.lv)[0];
  ok(Math.abs(Sim.envRange(s, { ...u, lvl: 0 }) - 0.8) < 1e-6 && Sim.envRange(s, { ...u, x: hill.x, y: hill.y, lvl: 3 }) === 1, 'the fog: 80% on the plain, nothing on a hill');
  s.night = true; s.t = 250; s.wxPlan = [{ kind: 'rain', a: 0, b: 1000 }, { kind: 'fog', a: 0, b: 1000 }]; s.wxNow = null;
  ok(Math.abs(Sim.envSight(s, { ...u, lvl: 0 }) - 0.6 * 0.8 * 0.8) < 1e-6, 'night, rain and fog add up (sight 38%)');
  const p = big(9); let rain = 0, fog = 0; for (const w of p.wxPlan) { if (w.kind === 'rain') rain++; else fog++; }
  ok(rain > 10 && fog > 10, `the weather comes and goes (${rain} rains, ${fog} morning fogs in the plan)`);
}
{
  // the dirt roads aren't faster any more (ROAD_FAST 1: the dozer's roads will be)
  const s = quiet(10), j = s.units.find(u => u.side === 'blue' && u.type === 'jeep'), q = s.squads.find(k => k.id === j.squad);
  s.squads = s.squads.filter(k => k === q); s.units = [j]; s.lakes = []; s.hills = []; s.elev = null; s.posts = [];
  const run = road => { j.x = 300; j.y = 300; Sim.setRoads(s, road ? [[{ x: 0, y: 300, w: 5 }, { x: 2000, y: 300, w: 5 }]] : []); Sim.order(s, q.id, 'hold', 1500, 300, true); step(s, 4); return j.x - 300; };
  const off = run(false), on = run(true);
  ok(Math.abs(on / off - 1) < 0.02, `a jeep on a dirt road goes ${(on / off).toFixed(2)}× as far (no faster)`);
}
{
  // ambush: a soldier standing still under a tree, not firing, is seen only up close
  const s = quiet(11); s.fog = true;
  const u = s.units.find(k => k.side === 'blue' && k.type === 'inf'), e = s.units.find(k => k.side === 'red' && k.type === 'inf');
  Sim.setCover(s, [{ x: 600, y: 300, r: 30 }]);
  s.units = s.units.filter(k => k.side !== 'blue' || k === u); // (alone in its squad: no line to stand in)
  // (short leashes: each stays where it's put — with the height's smaller range they walked at each other, to 50 apart)
  const q = s.squads.find(k => k.id === u.squad); q.size = 1; u.x = 600; u.y = 300; q.order = { type: 'hold', x: 600, y: 300, r: 5 };
  e.x = 700; e.y = 300; e.cd = 1e9; const eq = s.squads.find(k => k.id === e.squad); eq.order = { type: 'hold', x: 700, y: 300, r: 5 }; u.cd = 1e9;
  step(s, 1); const moving = s.vis.red.has(u.id);
  step(s, 6);
  ok(moving && !s.vis.red.has(u.id), 'seen while it moved in; still in the trees, it is gone from sight');
  e.x = 640; e.y = 300; step(s, 0.2);
  ok(s.vis.red.has(u.id), 'close up: seen');
}
{
  // a whole game with all of it: bots on both sides, fog, the open field, the posts taken
  const s = Sim.openField(big(12)); s.bots = ['blue', 'red']; s.botDiff = 'normal';
  let err = null; try { for (let i = 0; i < 30 * 900 && !s.over; i++) Sim.step(s, 1 / 30); } catch (x) { err = x; }
  const taken = s.posts.filter(p => p.side).length;
  ok(!err, 'a 15-minute bot game runs' + (err ? ': ' + err.stack : ''));
  ok(taken >= 4, `the bots take posts (${taken} of ${s.posts.length})`);
}
