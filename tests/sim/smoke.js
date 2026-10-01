// Edge cases and a couple of quick full games (stage 2: structures, production, collapse)
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
let s = Sim.create(1, 1000, 'bogus');
ok(s.diff === 'normal', 'unknown difficulty falls back to normal');
ok(s.nodes.filter(n => n.side === 'blue').map(n => n.kind).join() === 'hq,tent', 'blue opens with HQ + tent');
ok(s.squads.filter(q => q.side === 'blue').map(q => q.type).join() === 'inf,jeep', 'blue opens with infantry + jeeps');
Sim.step(s, 0); Sim.step(s, -1); Sim.step(s, NaN); ok(s.t === 0, 'zero / negative / NaN dt ignored');
ok(!Sim.order(s, 'nope', 'attack', 1, 1) && !Sim.order(s, 'blue0', 'dance', 1, 1) && !Sim.order(s, 'blue0', 'attack', NaN, 1), 'bad orders refused');
// building rules
ok(Sim.buildLimit(s, 'blue') === 4 && Sim.buildCount(s, 'blue') === 1, 'limit 2+2 with the HQ, one building (the tent)');
ok(Sim.buildCheck(s, 'blue', 900, 320) === 'q', 'no building where control is weak');
ok(Sim.buildCheck(s, 'blue', 105, 190) === 'gap', 'no building on top of another');
ok(!Sim.build(s, 'blue', 'hq', 150, 320) && !Sim.build(s, 'blue', 'fhq', 150, 320), 'only production buildings can be built');
ok(Sim.build(s, 'blue', 'tankshop', 230, 320), 'tank workshop placed');
for (let i = 0; i < 30 * 49; i++) Sim.step(s, 1 / 30);
ok(!s.squads.some(q => q.side === 'blue' && q.type === 'tank'), 'no tank squad before the 50s build');
for (let i = 0; i < 30 * 2; i++) Sim.step(s, 1 / 30);
const tk = s.squads.find(q => q.side === 'blue' && q.type === 'tank');
ok(!!tk && tk.home, 'workshop raised a tank squad with a home');
ok(Sim.build(s, 'blue', 'aapost', 150, 420) && Sim.build(s, 'blue', 'jeepshop', 230, 170), 'fill the slots');
ok(Sim.buildCheck(s, 'blue', 120, 560) === 'limit', 'then the limit stops more');
// only AA hits aircraft
ok(Sim.MULT.inf.air === 0 && Sim.MULT.tank.air === 0 && Sim.MULT.jeep.air === 0 && Sim.MULT.aa.air > 0, 'only AA can hit aircraft');
// destroying a building leaves its squad without refills
const shop = s.nodes.find(n => n.kind === 'tankshop'); shop.hp = 0; Sim.step(s, 1 / 30);
ok(!s.nodes.includes(shop) && tk.home === null, 'destroyed workshop: squad keeps fighting without a home');
// collapse
s = Sim.create(2, 1000, 'normal'); s.bots = [];
s.units = s.units.filter(u => u.side === 'blue'); s.nodes = s.nodes.filter(n => n.side === 'blue' || n.kind === 'hq');
for (let i = 0; i < 30 * 61; i++) Sim.step(s, 1 / 30);
ok(!s.over, 'a lone HQ (10) is still above 15% of blue\'s opening power (~25): no collapse yet');
s.nodes.find(n => n.side === 'red').hp = 0; Sim.step(s, 1 / 30); Sim.step(s, 1 / 30);
ok(s.over === 'blue', 'with the HQ gone too, red collapses');
const s2 = Sim.create(3, 1000); s2.bots = []; s2.units = s2.units.filter(u => u.side === 'blue'); s2.nodes = s2.nodes.filter(n => n.side === 'blue');
for (let i = 0; i < 30 * 59; i++) Sim.step(s2, 1 / 30);
ok(!s2.over, 'no collapse before the first minute');
// full games run to the end without throwing
for (const fog of [true, false]) { const { s: g } = play(7, 1100, 'normal', { fog }); ok(g.t > 60, `full game (fog ${fog}) ran ${Math.round(g.t)}s, result ${g.over || 'none'}`); }
