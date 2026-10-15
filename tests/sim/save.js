// A saved game (Sim.saveState / loadState): through a structured clone — as IndexedDB keeps it — and on from there,
// it goes exactly the way the game itself goes on.
const Sim = require('../load-sim.js')();
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const s = Sim.create(5, 2 * 1200, 'normal', 2 * Sim.H, { singles: true }); Sim.extras(s); Sim.openField(s); Sim.setArms(s, ['armor', 'infantry']);
s.bots = ['blue', 'red']; s.meBot = true;
while (s.t < 300) Sim.step(s, 1 / 30);
const b = Sim.loadState(structuredClone(Sim.saveState(s)));
ok(typeof s.rand === 'function' && typeof b.rand === 'function', 'the dice come back');
for (let i = 0; i < 30 * 150; i++) Sim.step(s, 1 / 30);
for (let i = 0; i < 30 * 150; i++) Sim.step(b, 1 / 30);
const sig = x => x.units.map(u => u.id + ':' + u.x.toFixed(2) + ',' + u.y.toFixed(2) + ':' + u.hp.toFixed(1)).join('|') + '/' + x.nodes.map(n => n.id + ':' + n.hp).join('|');
ok(sig(s) === sig(b), 'the loaded game goes on just as the game itself (' + s.units.length + ' units, ' + s.nodes.length + ' buildings)');
ok(s.rand() === b.rand(), 'the dice at the same place');
process.exit(fails ? 1 : 0);
