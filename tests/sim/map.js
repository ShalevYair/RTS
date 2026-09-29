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
    const m = map(f), t = list.find(o => o.x > cx && Math.abs(o.x - m.x) <= J && Math.abs(o.y - m.y) <= J && Math.abs(Math.log(o[R] / f[R])) <= -Math.log(0.88) + 1e-9); // a twin is up to 12% smaller or larger
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
ok(s.hills.length >= 16, `many hills: ${s.hills.length}`);
{
  // the bases stand on flat ground; basins: a lake in a hollow ringed by ridges; heights 1 to 10 lines
  let flat = true, ringed = 0, lakesN = 0; const lv = new Set();
  for (let seed = 1; seed <= 12; seed++) for (const [W, h] of [[900, 640], [2400, 1280]]) {
    const g = Sim.create(seed, W, 'normal', h);
    for (let y = 0; y <= g.H; y += 20) for (const x of [0, 40, 70, g.W - 70, g.W - 40, g.W]) if (Sim.elevAt(g, { x, y }) > 0) flat = false;
    for (const f of g.hills) lv.add(f.lv);
    for (const l of g.lakes) {
      lakesN++; const sides = new Set();
      for (const f of g.hills) { const d = Math.hypot(f.x - l.x, f.y - l.y); if (d < l.rx * 3.2) sides.add(Math.floor((Math.atan2(f.y - l.y, f.x - l.x) + Math.PI) / (Math.PI / 3))); }
      if (sides.size >= 3) ringed++;
    }
  }
  ok(flat, 'no hill in either base area: the ground is flat near both edges');
  ok(ringed >= lakesN * 0.7, `lakes lie in basins: ${ringed} of ${lakesN} have ridges on at least three sides`);
  ok(lv.has(1) && lv.has(10), `hills stand 1 to 10 contour lines high (${[...lv].sort((a, b) => a - b).join(',')})`);
}
const s2 = Sim.create(5, 2400, 'normal', 1280), s3 = Sim.create(6, 2400, 'normal', 1280);
ok(JSON.stringify(s2.hills) === JSON.stringify(s.hills) && JSON.stringify(s3.hills) !== JSON.stringify(s.hills), 'the same seed gives the same map, another seed another');
ok(Sim.create(1, 99999, 'normal', 99999).W === 6000 && Sim.create(1, 99999, 'normal', 99999).H === 2800, 'size is capped (6000×2800)');
{ // the huge map: 4× the big one, with 4× as much going on
  const t0 = Date.now(), g = Sim.create(3, 4000, 'normal', 2560), b = Sim.create(3, 2000, 'normal', 1280), ms = Date.now() - t0;
  ok(g.W === 4000 && g.H === 2560 && g.hills.length > 2.5 * b.hills.length && g.lakes.length > b.lakes.length && ms < 3000, `huge map 4000×2560: ${g.hills.length} hills (big: ${b.hills.length}), ${g.lakes.length} lakes (big: ${b.lakes.length}), made in ${ms} ms`);
}
// the whole height is in play: orders, drones and building below the old edge
s.bots = []; s.fog = false;
Sim.order(s, 'blue1', 'hold', 300, 1100);
ok(s.squads.find(q => q.id === 'blue1').order.y === 1100, 'an order to y 1100 is kept (not cut at 640)');
for (let i = 0; i < 30 * 20; i++) Sim.step(s, 1 / 30);
ok(s.squads.find(q => q.id === 'blue1').cy > 900, `the squad went there (y ${s.squads.find(q => q.id === 'blue1').cy.toFixed(0)})`);
ok(Sim.buildCheck(s, 'blue', 150, 900) === '', 'building near the HQ, below the old edge');
// height: +10% sight (and range) per contour line; uphill slower, downhill faster
{
  const g = Sim.create(7, 2400, 'normal', 1280); g.bots = []; g.noReinforce = true; g.fog = true;
  // the highest point on our half
  let top = { x: 0, y: 0, e: 0 };
  for (let y = 40; y < g.H - 40; y += 8) for (let x = 300; x < g.W / 2; x += 8) { const e = Sim.elevAt(g, { x, y }); if (e > top.e) top = { x, y, e }; }
  const L = Math.floor(top.e), me = g.units.find(u => u.squad === 'blue0'), foe = g.units.find(u => u.side === 'red'), T = Sim.TYPES[me.type];
  for (const u of g.units) if (u !== me && u !== foe) u.x = u.side === 'blue' ? 5 : g.W - 5; // out of the way
  const far = T.sight * (1 + 0.1 * L) - 4;
  const look = (x, y) => { me.x = x; me.y = y; foe.x = x + far; foe.y = y; foe.lastFire = -99; me.cd = 99; foe.cd = 99; Sim.step(g, 1 / 30); return g.vis.blue.has(foe.id); };
  const plain = { x: 150, y: 80 }; // near the base: flat
  ok(L >= 4 && look(top.x, top.y) && !look(plain.x, plain.y), `from ${L} lines up infantry sees ${Math.round(far)} away (+${L * 10}%); on the plain, not`);
  // walk: a jeep squad from the top down the slope, then back up the same way
  const q = g.squads.find(k => k.id === 'blue1'), J = g.units.filter(u => u.squad === q.id).slice(0, 1); // one jeep (no crowding)
  g.units = g.units.filter(u => u.squad !== q.id || u === J[0]);
  let dir = null;
  for (let R = 60; R <= 200 && !dir; R += 20) for (let a = 0; a < 6.28 && !dir; a += 0.2) { const p = { x: top.x + Math.cos(a) * R, y: top.y + Math.sin(a) * R }; if (Sim.elevAt(g, p) < top.e - 2 && !Sim.lakeAt(g, p, 10)) dir = p; }
  const walk = (from, to) => {
    for (const u of J) { u.x = from.x; u.y = from.y; } Sim.step(g, 1 / 30);
    Sim.order(g, q.id, 'hold', to.x, to.y, true); g.outbox = []; q.order = { type: 'hold', x: to.x, y: to.y, r: 5 };
    const u = J[0], x0 = u.x, y0 = u.y; for (let i = 0; i < 15; i++) Sim.step(g, 1 / 30); return Math.hypot(u.x - x0, u.y - y0);
  };
  const down = walk(top, dir), up = walk(dir, top);
  const flat = Sim.TYPES.jeep.speed;
  ok(dir && down * 2 > flat * 1.1 && up * 2 < flat * 0.85, `a jeep (${flat}/s on the flat) goes down a slope at ${(down * 2).toFixed(0)}/s and up it at ${(up * 2).toFixed(0)}/s`);
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
{ // bigger maps allow more: the big one 2× the buildings and forward HQs, the huge one 4×; the tutorial keeps 1×
  const sm = Sim.create(1, 1000), bg = Sim.create(1, 2400, 'normal', 1280), hg = Sim.create(1, 4000, 'normal', 2560);
  const L = [sm, bg, hg].map(g => Sim.buildLimit(g, 'blue')), F = [sm, bg, hg].map(g => Sim.fhqMax(g));
  ok(L[1] === 2 * L[0] && L[2] === 4 * L[0] && F[1] === 2 * F[0] && F[2] === 4 * F[0] && Sim.level(11, 1, 1000).scale === 1, `building limit ${L.join(' / ')}, forward HQs ${F.join(' / ')} (small / big / huge)`);
}
