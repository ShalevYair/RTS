// A bunker's garrison (posts.js): the soldier who takes a neutral bunker stays in it; soldiers sent to our bunker go in
// (no more than BUNKER_MAX); in it they stay put (not to a front, not summoned), need no food, take half the damage,
// and the bunker sees as far as a signals truck; an order by hand takes them out; an enemy bunker with men in it can't
// be taken. node tests/sim/bunker.js [seed]
const assert = require('assert');
const Sim = require('../load-sim.js')();
const seed = +process.argv[2] || 7;
const s = Sim.create(seed, 2200, 'normal', Sim.H * 2, { singles: true });
Sim.extras(s); s.water = true; s.fuel = true; s.bots = []; s.fog = false;
const b = s.posts.find(p => p.kind === 'bunker'); assert.ok(b, 'a bunker on the map');
const inf = s.squads.filter(q => q.side === 'blue' && !q.dead && q.type === 'inf');
assert.ok(inf.length >= 6, 'soldiers to send: ' + inf.length);
const run = sec => { const t = s.t + sec; while (s.t < t) Sim.step(s, 1 / 30); };
const unitOf = q => s.units.find(u => u.squad === q.id);
// (1) the first takes it — and stays in it
Sim.order(s, inf[0].id, 'attack', b.x, b.y); run(120);
assert.strictEqual(b.side, 'blue', 'the bunker taken');
assert.ok(unitOf(inf[0]), 'the one who took it is still there');
assert.strictEqual(inf[0].bunker, b.id, 'and in its garrison');
// (2) five more sent: four in all
const sent = Sim.garrison(s, 'blue', inf.slice(1, 6).map(q => q.id), b.id); assert.ok(sent, 'sent in');
run(120);
const men = Sim.bunkerMen(s, b); console.log('in the bunker', men.length);
assert.strictEqual(men.length, Sim.BUNKER_MAX, 'four in it');
assert.ok(men.every(u => Math.hypot(u.x - b.x, u.y - b.y) < Sim.POSTS.bunker.r + Sim.BUNKER_R), 'at its walls');
// (3) a front and a summons don't take them out; no food used; sheltered
Sim.addFront(s, 'blue', [{ x: b.x + 500, y: b.y - 200 }, { x: b.x + 500, y: b.y + 200 }]);
Sim.summon(s, 'blue', men.map(u => u.squad), b.x + 600, b.y);
for (const u of men) u.water = 0.5;
run(60);
assert.strictEqual(Sim.bunkerMen(s, b).length, Sim.BUNKER_MAX, 'still four in it');
assert.ok(Sim.bunkerMen(s, b).every(u => u.water === 1), 'fed in the bunker');
assert.ok(Sim.bunkerMen(s, b).every(u => s.bunkered.has(u.id)), 'sheltered');
// (4) the bunker sees far — a unit of theirs 450 off is seen
const foe = s.units.find(u => u.side === 'red' && !Sim.TYPES[u.type].air);
foe.x = b.x + 420; foe.y = b.y; run(1);
assert.ok(s.vis.blue.has(foe.id), 'seen from the bunker');
// (5) an order by hand takes one out
const out = Sim.bunkerMen(s, b)[0].squad; Sim.order(s, out, 'attack', b.x - 300, b.y); run(30);
const qo = s.squads.find(q => q.id === out);
assert.ok(!qo.bunker && Math.hypot(unitOf(qo).x - b.x, unitOf(qo).y - b.y) > 100, 'out by hand');
console.log('bunker ok');
