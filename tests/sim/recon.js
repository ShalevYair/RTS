// Stage 3: identifying the enemy in three levels, orders carried out "roughly", and the AI under both
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
// Q around blue's HQ (x = 30): 1 up to x = 310, then rings of 80% (to 360), 60%, 40%, 20% (to 510)
let s = Sim.create(11, 1000, 'normal');
const dx = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq').x - 30; // (the HQ stands a little in from x = 30, all of it on the map)
ok(Sim.idLevel(s, 'blue', { x: 200 + dx, y: 320 }) === 2 && Sim.idLevel(s, 'blue', { x: 400 + dx, y: 320 }) === 1 && Sim.idLevel(s, 'blue', { x: 700 + dx, y: 320 }) === 0, 'levels by Q: 2 / 1 / 0');
ok(Sim.idLevel(s, 'blue', { x: 359 + dx, y: 320 }) === 2 && Sim.idLevel(s, 'blue', { x: 361 + dx, y: 320 }) === 1, 'the 80% ring still identifies, the 60% ring only ground / air');
s.fog = false; ok(Sim.idLevel(s, 'blue', { x: 900, y: 320 }) === 2, 'without fog everything is identified');
// sightings: put the red infantry somewhere and make it visible (muzzle flash)
s = Sim.create(11, 1000, 'normal'); s.bots = []; s.noReinforce = true;
const red = s.squads.find(q => q.side === 'red' && q.type === 'inf');
const show = x => { for (const u of s.units) if (u.squad === red.id) { u.x = x + u.sx * 15; u.y = 320 + u.sy * 15; u.lastFire = s.t; } Sim.step(s, 1 / 30); return s.mem.blue[red.id]; };
let m = show(700);
ok(m && m.lvl === 0 && m.type === null && m.air === null && m.n === null && m.strength === null, 'far away: only "movement", nothing else stored');
delete s.mem.blue[red.id]; m = show(400);
ok(m.lvl === 1 && m.air === false && m.type === null && m.n === null, 'mid control: ground, no type or count');
delete s.mem.blue[red.id]; m = show(200);
ok(m.lvl === 2 && m.type === 'inf' && m.n > 0 && m.strength > 0, 'good control: type, count and strength');
m = show(700); ok(m.lvl === 2 && m.type === 'inf', 'a track followed without a break keeps its identification');
for (const u of s.units) if (u.squad === red.id) u.lastFire = -99;
for (let i = 0; i < 30 * 4; i++) Sim.step(s, 1 / 30);
m = show(700); ok(m.lvl === 0 && m.type === null, 'after losing the track, a new sighting starts over');
// executing "roughly"
s = Sim.create(12, 1000, 'normal'); s.bots = [];
const sq = s.squads.find(q => q.id === 'blue0'), T = { x: 600, y: 320 };
ok(JSON.stringify(Sim.understood(s, sq, T.x, T.y)) === JSON.stringify(T), 'full control (at the HQ): no offset');
sq.cx = 900; sq.cy = 320; const R = 120 * Math.pow(1 - 0.15, 1.5);
const offs = (temper, n = 400) => { sq.temper = temper; const o = []; for (let i = 0; i < n; i++) { const p = Sim.understood(s, sq, T.x, T.y); o.push({ d: Math.hypot(p.x - T.x, p.y - T.y), fwd: (T.x - p.x) }); } return o; };
let o = offs('steady');
ok(o.every(k => k.d <= R + 1e-9) && o.reduce((a, k) => a + k.d, 0) / o.length > R * 0.5, `at the floor: offset within ${R.toFixed(0)}, mean ${(o.reduce((a, k) => a + k.d, 0) / o.length).toFixed(0)}`);
o = offs('bold');
const fwd = o.reduce((a, k) => a + k.fwd, 0) / o.length; // the squad (x 900) goes toward x 600: forward = smaller x
ok(fwd > R * 0.4 && o.every(k => k.d <= R * 1.6 + 1e-9), `bold overshoots forward by ${fwd.toFixed(0)} on average`);
sq.temper = 'steady'; for (const u of s.units) if (u.side === 'red') u.cd = 1e9; // red holds fire: this is about orders, not a fight
Sim.step(s, 1 / 30); // back to its real position
for (const u of s.units) if (u.squad === 'blue0') { u.x = 880 + u.sx * 10; u.y = 320 + u.sy * 10; }
Sim.step(s, 1 / 30);
Sim.order(s, 'blue0', 'attack', 600, 300); while (s.outbox.length && s.t < 20) Sim.step(s, 1 / 30);
ok(sq.order.want.x === 600 && sq.order.want.y === 300 && (sq.order.x !== 600 || sq.order.y !== 300), `far order: asked (600,300), understood (${sq.order.x.toFixed(0)},${sq.order.y.toFixed(0)})`);
ok(s.log2.offN === 1 && s.log2.off > 0, 'deviation counted for the end screen');
Sim.order(s, 'blue0', 'retreat'); while (s.outbox.length && s.t < 40) Sim.step(s, 1 / 30);
const h = Sim.homeOf(s, sq); ok(sq.order.type === 'retreat' && sq.order.x === h.x && sq.order.y === h.y, 'a retreat home is never off');
s = Sim.create(12, 1000, 'normal'); s.fog = false; for (const u of s.units) if (u.squad === 'blue0') u.x = 880; Sim.step(s, 1 / 30);
Sim.order(s, 'blue0', 'attack', 600, 300); ok(s.squads[0].order.x === 600 && s.squads[0].order.y === 300, 'without fog orders are exact');
// the AI compares with what it asked, not where the commander went: no resending the same order
s = Sim.create(13, 1100, 'normal'); s.bots = ['blue', 'red'];
while (s.t < 150) Sim.step(s, 1 / 30);
Sim.think(s, 'red', 'normal'); const box = s.outbox.filter(x => x.side === 'red' && x.kind === 'order');
Sim.think(s, 'red', 'normal'); const box2 = s.outbox.filter(x => x.side === 'red' && x.kind === 'order');
ok(box.length === box2.length && box.every((x, i) => x === box2[i]), `second think with nothing new sends nothing (${box.length} on the way)`);
// (over the game, not at one moment: near its own HQ a squad's orders land exactly)
let off = 0;
for (; s.t < 420 && !s.over && !off; Sim.step(s, 1 / 30)) off = s.squads.filter(q => q.side === 'red' && q.order.want && Math.hypot(q.order.x - q.order.want.x, q.order.y - q.order.want.y) > 1).length;
ok(off > 0, `red orders are also carried out roughly (${off} squads off target, by ${s.t.toFixed(0)} s)`);
// full games: the AI still finishes games under the new uncertainty, and uses drones on blurry tracks
let fin = 0, ids = { 0: 0, 1: 0, 2: 0 };
for (let i = 0; i < 4; i++) {
  const g = Sim.create(90 + i, [800, 1100, 1400][i % 3], 'normal'); g.bots = ['blue', 'red'];
  while (!g.over && g.t < 3600) { Sim.step(g, 1 / 30); if (Math.abs(g.t % 5) < 1 / 30) for (const k in g.mem.red) ids[g.mem.red[k].lvl]++; }
  if (g.over) fin++;
}
ok(fin >= 3, `${fin}/4 fogged bot games finished within 60 min (half speed: some drag on past 30)`);
ok(ids[0] > 0 && ids[1] > 0 && ids[2] > 0, `red saw all three levels (movement ${ids[0]}, class ${ids[1]}, identified ${ids[2]})`);
