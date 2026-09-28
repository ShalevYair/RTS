// Stage 5: the big map — size, a new map every game (a near-twin for each side, clear of the bases), hill bonuses, the whole height in
// play, the AI's forward HQ on a hill, and full games
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const small = Sim.create(5, 1000, 'normal');
ok(small.H === 640 && small.hills.length >= 5 && small.lakes.length >= 2, `the small map: 640 high, ${small.hills.length} hills, ${small.lakes.length} lakes`);
// every game a new map, the same seed the same map
{
  const key = g => JSON.stringify([g.hills, g.lakes]), maps = new Set();
  for (let seed = 1; seed <= 20; seed++) maps.add(key(Sim.create(seed, 1000, 'normal')));
  ok(maps.size === 20 && key(Sim.create(7, 1000, 'normal')) === key(Sim.create(7, 1000, 'normal')), '20 seeds, 20 different maps; the same seed, the same map');
}
// near-symmetric: every feature on our half has a twin on theirs (mirrored or turned half a circle), a little
// moved and resized, never exactly the same; centre-line hills have none
function twins(g) {
  const cx = g.W / 2, J = (g.H > Sim.H ? 45 : 30) + 1e-9, map = f => ({ x: g.W - f.x, y: g.turn ? g.H - f.y : f.y });
  let paired = 0, exact = 0;
  for (const [list, R] of [[g.hills, 'r'], [g.lakes, 'rx']]) for (const f of list) {
    if (Math.abs(f.x - cx) < 40) continue; // on the centre line
    if (f.x > cx) continue;
    const m = map(f), t = list.find(o => o.x > cx && Math.abs(o.x - m.x) <= J && Math.abs(o.y - m.y) <= J && Math.abs(o[R] / f[R] - 1) <= 0.12 + 1e-9);
    if (t) { paired++; if (t.x === m.x && t.y === m.y && t[R] === f[R]) exact++; }
    else return { ok: false };
  }
  return { ok: true, paired, exact };
}
let allTwin = true, turned = 0, exacts = 0, pairs = 0;
for (let seed = 1; seed <= 30; seed++) for (const [W, h] of [[800, 640], [1300, 640], [2400, 1280]]) {
  const g = Sim.create(seed, W, 'normal', h), r = twins(g);
  if (!r.ok) allTwin = false; else { exacts += r.exact; pairs += r.paired; }
  if (g.turn) turned++;
}
ok(allTwin && exacts === 0 && pairs > 200, `every feature has a near twin on the other side (${pairs} pairs, none identical)`);
ok(turned > 20 && turned < 70, `both kinds of twin occur: turned half a circle in ${turned} of 90 maps, mirrored in the rest`);
const s = Sim.create(5, 2400, 'normal', 1280);
ok(s.W === 2400 && s.H === 1280 && s.bases.blue.y === 640 && s.nodes.find(n => n.kind === 'hq').y === 640, 'big map: 2400×1280, bases in the middle of the height');
ok(s.hills.length >= 20, `many hills: ${s.hills.length}`);
ok(s.hills.every(h => h.x - h.r >= 240 - 1e-9 && h.x + h.r <= s.W - 240 + 1e-9), 'no hill in either base area');
ok(s.hills.every((h, i) => s.hills.every((o, j) => i === j || Math.hypot(h.x - o.x, h.y - o.y) >= h.r + o.r)), 'hills don\'t overlap');
ok(s.hills.every(h => h.y - h.r >= 0 && h.y + h.r <= s.H), 'hills are on the map');
const s2 = Sim.create(5, 2400, 'normal', 1280), s3 = Sim.create(6, 2400, 'normal', 1280);
ok(JSON.stringify(s2.hills) === JSON.stringify(s.hills) && JSON.stringify(s3.hills) !== JSON.stringify(s.hills), 'the same seed gives the same map, another seed another');
ok(Sim.create(1, 99999, 'normal', 99999).W === 3000 && Sim.create(1, 99999, 'normal', 99999).H === 1400, 'size is capped (3000×1400)');
// the whole height is in play: orders, drones and building below the old edge
s.bots = []; s.fog = false;
Sim.order(s, 'blue1', 'hold', 300, 1100);
ok(s.squads.find(q => q.id === 'blue1').order.y === 1100, 'an order to y 1100 is kept (not cut at 640)');
for (let i = 0; i < 30 * 20; i++) Sim.step(s, 1 / 30);
ok(s.squads.find(q => q.id === 'blue1').cy > 900, `the squad went there (y ${s.squads.find(q => q.id === 'blue1').cy.toFixed(0)})`);
ok(Sim.buildCheck(s, 'blue', 150, 900) === '', 'building near the HQ, below the old edge');
// hills: sight +30% (range +20%, damage taken -30% were there already)
{
  const g = Sim.create(7, 2400, 'normal', 1280); g.bots = []; g.noReinforce = true;
  const hill = g.hills.find(h => h.x < g.W / 2), me = g.units.find(u => u.squad === 'blue0'), foe = g.units.find(u => u.side === 'red');
  const T = Sim.TYPES[me.type];
  for (const u of g.units) if (u !== me && u !== foe) u.x = u.side === 'blue' ? 5 : g.W - 5; // out of the way
  const look = onHill => {
    me.x = hill.x; me.y = onHill ? hill.y : hill.y - hill.r - 5 - T.sight * 0.3; // just off the hill
    foe.x = me.x + T.sight * 1.2; foe.y = me.y; foe.lastFire = -99;
    me.cd = 99; foe.cd = 99; Sim.step(g, 1 / 30); return g.vis.blue.has(foe.id);
  };
  ok(look(true) && !look(false), `from a hill infantry sees ${Math.round(T.sight * 1.2)} away; off it, not`);
}
// the AI: a forward HQ on a hill
let onHill = 0, fhqs = 0;
for (const seed of [31, 32]) {
  const g = Sim.create(seed, 2400, 'normal', 1280); g.bots = ['blue', 'red'];
  while (g.t < 420) Sim.step(g, 1 / 30);
  for (const n of g.nodes.filter(n => n.kind === 'fhq')) { fhqs++; if (g.hills.some(h => Math.hypot(h.x - n.x, h.y - n.y) < h.r + 60)) onHill++; }
}
ok(fhqs > 0 && onHill >= fhqs / 2, `the AI sets up forward HQs on hills (${onHill} of ${fhqs} within reach of a hill)`);
// full games on the big map finish
let fin = 0, T = 0;
for (let i = 0; i < 3; i++) { const { s: g } = play(400 + i, [1000, 1200, 1400][i], ['normal', 'hard', 'easy'][i], { big: true, limit: 1500 }); if (g.over) fin++; T += g.t; }
ok(fin >= 2, `${fin}/3 fogged bot games on the big map finished within 25 min (average ${Math.round(T / 3)} s)`);
