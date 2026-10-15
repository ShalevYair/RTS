// Summoning (Sim.summon, the Alt + click wheel): the free squads go to the spot at once, together; one in a fight stays
// in it and goes when it's over; one given another order meanwhile is no longer summoned.
const Sim = require('../load-sim.js')();
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mk = (s, side, t, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); const u = s.units[s.units.length - 1]; u.x = x; u.y = y; q.cx = x; q.cy = y; return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
const s = Sim.create(5, 2400, 'normal', 1280, { singles: true }); s.bots = []; s.fog = false; s.night = false;
s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq'); s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.collapseAfter = Infinity; s.noReinforce = true;
const free = []; for (let i = 0; i < 4; i++) free.push(mk(s, 'blue', 'tank', 400 + i * 40, 300));
const fighter = mk(s, 'blue', 'tank', 600, 1000), foe = mk(s, 'red', 'inf', 700, 1000), other = mk(s, 'blue', 'tank', 300, 1000);
for (let i = 0; i < 60; i++) Sim.step(s, 1 / 30); // (the fight starts)
const r = Sim.summon(s, 'blue', [...free, fighter].map(q => q.id), 1600, 640);
ok(r.now.length === 4 && r.wait.length === 1 && r.wait[0] === fighter.id, 'the free ones go now, the one fighting waits (' + r.now.length + ' / ' + r.wait.length + ')');
Sim.summon(s, 'blue', [other.id], 1600, 640); Sim.order(s, other.id, 'hold', 300, 1100, true); // (summoned, then told otherwise)
for (let i = 0; i < 30 * 120 && unitOf(s, foe); i++) Sim.step(s, 1 / 30);
ok(!unitOf(s, foe), 'the fight is over');
for (let i = 0; i < 30 * 150; i++) Sim.step(s, 1 / 30);
const near = q => { const u = unitOf(s, q); return u && Math.hypot(u.x - 1600, u.y - 640) < 220; };
ok(free.every(near), 'the free ones are there');
ok(near(fighter), 'the one that was fighting came after');
ok(!near(other) && !(s.summons || []).some(w => w.id === other.id), 'another order: no longer summoned');
process.exit(fails ? 1 : 0);
