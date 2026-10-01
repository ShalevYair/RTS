// The transport helicopter: soldiers (any on foot) get on it, up to its room; it flies them where it's sent, lands and
// sets them down; shot down, it takes them with it
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const s = Sim.create(3, 1400, 'normal'); s.bots = []; s.fog = false; s.noReinforce = true;
s.units = s.units.filter(u => u.side === 'blue' && false); s.squads = []; // (an empty map)
const mk = (t, n, x, y) => { const q = Sim._makeSquad(s, 'blue', t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
const L = mk('lift', 1, 300, 300), inf = mk('inf', 6, 360, 300), at = mk('at', 3, 360, 360), tk = mk('tank', 1, 300, 360);
const many = mk('inf', 4, 360, 240);
ok(Sim.TYPES.lift.air && Sim.TYPES.lift.hover && !Sim.TYPES.lift.dmg && Sim.TYPES.lift.cap === 10, 'a transport helicopter: flies, hovers, has no gun, carries 10');
ok(!Sim.board(s, [tk.id], L.id), 'a tank can\'t get on');
ok(Sim.board(s, [inf.id, at.id], L.id), 'soldiers and anti-tank soldiers sent to it');
step(s, 6);
const lu = s.units.find(u => u.squad === L.id);
ok(lu.cargo.length === 9 && !s.units.some(u => u.squad === inf.id || u.squad === at.id), `all nine on board`);
Sim.board(s, [many.id], L.id); step(s, 6);
ok(lu.cargo.length === 10 && s.units.filter(u => u.squad === many.id).length === 3, `room for 10: one more got on, ${s.units.filter(u => u.squad === many.id).length} stay`);
const one = lu.cargo.find(u => u.squad === many.id); lu.cargo = lu.cargo.filter(u => u !== one); one.ridden = false; s.units.push(one); many.aboard = null; // (back off)
ok(!inf.dead && !at.dead, 'squads on board are not wiped out');
// (a dry spot: no lake within 90 of it)
const dry = [...Array(40)].map((_, i) => ({ x: 700 + (i % 8) * 50, y: 150 + Math.floor(i / 8) * 80 })).find(p => [...Array(16)].every((_, k) => !Sim.lakeAt(s, { x: p.x + Math.cos(k) * 90, y: p.y + Math.sin(k) * 90 })));
ok(!Sim.unload(s, inf.id, dry.x, dry.y) && Sim.unload(s, L.id, dry.x, dry.y), 'only the helicopter is sent to set them down');
step(s, 14);
const down = s.units.filter(u => u.squad === inf.id || u.squad === at.id);
ok(down.length === 9 && down.every(u => Math.hypot(u.x - lu.x, u.y - lu.y) < 120) && Math.hypot(lu.x - dry.x, lu.y - dry.y) < 15 && lu.cargo.length === 0, `set down where it was sent, in their lines round it: ${down.length} soldiers`);
// shot down with soldiers on board: they're lost too
ok(Sim.board(s, [inf.id], L.id), 'on again');
step(s, 6);
const n = lu.cargo.length; lu.hp = 0; step(s, 1);
ok(n === 6 && inf.dead && !s.units.some(u => u.squad === inf.id), `shot down with ${n} on board: they fell with it`);
if (bad) process.exitCode = 1;
