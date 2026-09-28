// control quality, forward HQs and drones
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
let s = Sim.create(4, 1000, 'normal');
const hq = { x: s.bases.blue.x, y: 320 };
ok(Sim.quality(s, 'blue', hq) === 1, 'Q = 1 at the HQ');
const N = Sim.NODES.hq, at = f => Sim.quality(s, 'blue', { x: hq.x + N.r0 + (N.r1 - N.r0) * f, y: 320 });
ok([0.1, 0.4, 0.6, 0.9].map(at).join() === '0.8,0.6,0.4,0.2', 'past r0, control drops in rings: 80%, 60%, 40%, 20% (' + [0.1, 0.4, 0.6, 0.9].map(at).join() + ')');
ok(s.squads.filter(q => q.side === 'blue').every(q => Sim.quality(s, 'blue', { x: q.cx, y: q.cy }) === 1), 'whole base under full control');
ok(Sim.quality(s, 'blue', { x: 990, y: 320 }) === 0.15, 'Q floor far away');
const near = s.squads.find(q => q.id === 'blue0');
ok(Math.abs(Sim.orderDelay(s, near) - 1) < 0.5, 'order delay near HQ ~1s: ' + Sim.orderDelay(s, near).toFixed(2));
near.cx = 950; ok(Math.abs(Sim.orderDelay(s, near) - (1 + 7 * 0.85)) < 1e-9, 'order delay at floor = 1+7*0.85');
// drones: one in hand at the start, one more a minute (up to 10), warm-up, reveals, stays up, invalid input
s = Sim.create(9, 1000, 'normal'); s.bots = [];
for (let i = 0; i < 30 * 15; i++) Sim.step(s, 1 / 30);
const tu = s.units.find(u => u.side === 'red' && !s.vis.blue.has(u.id)), target = { x: tu.x, y: tu.y };
ok(Sim.drone(s, 'blue', target.x, target.y), 'drone launched');
ok(!Sim.drone(s, 'blue', 100, 100), 'no second drone in hand yet');
ok(!Sim.drone(s, 'red', NaN, 1), 'NaN refused');
const q0 = Sim.quality(s, 'blue', target);
for (let i = 0; i < 30 * 3; i++) Sim.step(s, 1 / 30);
ok(Sim.quality(s, 'blue', target) === q0, 'not working during warm-up');
for (let i = 0; i < 30 * 3; i++) Sim.step(s, 1 / 30);
const d = s.nodes.find(n => n.kind === 'drone' && n.side === 'blue');
ok(d && Sim.quality(s, 'blue', d) === 1, 'working drone gives Q = 1 under it');
ok(s.units.filter(u => u.side === 'red' && Math.hypot(u.x - d.x, u.y - d.y) <= Sim.DRONE_SIGHT).every(u => s.vis.blue.has(u.id)), 'drone reveals enemies out to its 60% ring (' + Math.round(Sim.DRONE_SIGHT) + ')');
ok(Sim.buildCheck(s, 'blue', d.x, d.y) === 'q', 'a drone gives no right to build');
for (let i = 0; i < 30 * 50; i++) Sim.step(s, 1 / 30);
ok(s.drones.blue.stock === 1 && Sim.drone(s, 'blue', 500, 100), 'a minute later: one more drone');
d.x = d.y = 300; for (let i = 0; i < 30 * 120; i++) Sim.step(s, 1 / 30);
ok(s.nodes.some(n => n.id === d.id), 'a drone stays up (none of their AA near it)');
s.drones.blue.stock = 8; for (let i = 0; i < 30 * 130; i++) Sim.step(s, 1 / 30);
ok(s.drones.blue.stock + Sim.dronesUp(s, 'blue') === 10, 'never more than 10 in the air and in hand');
const aa = s.units.find(u => u.side === 'red' && u.type === 'inf'); aa.type = 'aa';
const d2 = s.nodes.find(n => n.kind === 'drone' && n.side === 'blue'); aa.x = d2.x + 30; aa.y = d2.y; aa.cd = 0;
for (let i = 0; i < 30 * 8; i++) { aa.x = d2.x + 30; aa.y = d2.y; Sim.step(s, 1 / 30); }
ok(!s.nodes.includes(d2), 'AA shoots a drone down');
// forward HQ: only tanks/jeeps, cooldown, message delay, warm-up, destructible
s = Sim.create(5, 1000, 'normal');
s.units = s.units.filter(u => u.side === 'blue'); s.noReinforce = true; // a quiet map: nothing shoots the forward HQ
ok(!Sim.buildFhq(s, 'blue0'), 'infantry cannot build a forward HQ');
// put the tanks mid-map, holding there (set directly, so no order delay is involved)
const tk = s.squads.find(q => q.id === 'blue1');
for (const u of s.units) if (u.squad === 'blue1') { u.x = 480 + (u.x % 10); u.y = 400 + (u.y % 10); }
tk.order = { type: 'hold', x: 480, y: 400, r: 60 }; tk.arrived = false; Sim.step(s, 1 / 30);
ok(Sim.buildFhq(s, 'blue1'), 'jeeps can');
ok(!Sim.buildFhq(s, 'blue1'), 'cooldown blocks a second one');
ok(!s.nodes.some(n => n.side === 'blue' && n.kind === 'fhq') && s.outbox.some(m => m.kind === 'build'), 'build order travels as a message');
for (let i = 0; i < 30 * 9; i++) Sim.step(s, 1 / 30);
const f = s.nodes.find(n => n.kind === 'fhq' && n.side === 'blue');
ok(!!f, 'forward HQ set up when the message arrives');
const p = { x: f.x + 100, y: f.y };
const qBefore = Sim.quality(s, 'blue', p);
for (let i = 0; i < 30 * 31; i++) Sim.step(s, 1 / 30);
ok(Sim.quality(s, 'blue', p) > qBefore, 'after warm-up it raises Q around it');
f.hp = 0; Sim.step(s, 1 / 30); ok(!s.nodes.includes(f), 'destroyed forward HQ is removed');
// full games: the AI uses forward HQs and drones
let built = 0, drones = 0;
for (let i = 0; i < 4; i++) {
  const g = Sim.create(70 + i, 1100, 'hard'); g.bots = ['blue', 'red']; const seen = new Set();
  while (!g.over && g.t < 600) { Sim.step(g, 1 / 30); for (const n of g.nodes) if (n.side === 'red' && !seen.has(n.id)) { seen.add(n.id); if (n.kind === 'fhq') built++; if (n.kind === 'drone') drones++; } }
}
ok(built > 0 && drones > 0, `AI used forward HQs (${built}) and drones (${drones}) in 4 games`);
