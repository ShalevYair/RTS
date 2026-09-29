// orders as messages, postures, calls from commanders
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
let s = Sim.create(4, 1000, 'normal'); s.bots = [];
const q = s.squads.find(x => x.id === 'blue0');
ok(Sim.order(s, 'blue0', 'attack', 500, 300) && q.order.x !== 500 && s.outbox.length === 1, 'order queued as a message');
Sim.order(s, 'blue0', 'hold', 520, 320); ok(s.outbox.length === 1 && s.outbox[0].x === 520, 'a newer order replaces the one on its way');
let t0 = s.t; while (q.order.x !== 520 && s.t < 20) Sim.step(s, 1 / 30);
ok(q.order.x === 520 && s.t - t0 < 3, `arrived after ${(s.t - t0).toFixed(1)}s (near the HQ)`);
ok(Sim.setTrait(s, 'blue0', 'cautious') && !Sim.setTrait(s, 'blue0', 'cautious') && q.trait !== 'cautious', 'posture travels too; duplicates refused');
for (let i = 0; i < 30 * 4; i++) Sim.step(s, 1 / 30); ok(q.trait === 'cautious', 'posture arrived');
s = Sim.create(4, 1000, 'normal'); s.fog = false; Sim.order(s, 'blue0', 'attack', 500, 300); ok(s.squads[0].order.x === 500, 'without fog orders are immediate');
s = Sim.create(4, 1000, 'normal'); Sim.order(s, 'blue1', 'attack', 500, 300); s.units = s.units.filter(u => u.squad !== 'blue1');
for (let i = 0; i < 30 * 9; i++) Sim.step(s, 1 / 30); ok(s.outbox.every(m => m.id !== 'blue1'), 'message to a destroyed squad is lost');
ok(!Sim.answer(s, 999, 'hold') && !Sim.answer(s, 1, 'dance'), 'bad call answers refused');
// calls happen in real games and get answered / decided
let calls = 0, answered = 0, auto = 0;
for (let i = 0; i < 4; i++) {
  const g = Sim.create(50 + i, 1100, 'normal'); g.bots = ['red']; g.askHq = true; const seen = new Set();
  // blue: everything attacks the enemy HQ area every 20s, answers every other call
  let t = 0;
  while (!g.over && g.t < 400) { Sim.step(g, 1 / 30); if ((t -= 1 / 30) <= 0) { t = 20; for (const x of g.squads) if (x.side === 'blue') Sim.order(g, x.id, 'attack', g.W - 120, 320, true); }
    for (const c of g.calls) if (!seen.has(c.id)) { seen.add(c.id); calls++; if (calls % 2) Sim.answer(g, c.id, 'hold'); } }
  answered += g.log2.answered; auto += g.log2.missed;
}
ok(calls > 0 && answered > 0, `calls ${calls}, answered ${answered}, decided by the commander ${auto}`);
{ // by default commanders don't call: they decide for themselves
  const g = Sim.create(50, 1100, 'normal'); g.bots = ['red']; let n = 0, t = 0;
  while (!g.over && g.t < 400) { Sim.step(g, 1 / 30); n += g.calls.filter(c => c.until > c.t).length; if ((t -= 1 / 30) <= 0) { t = 20; for (const x of g.squads) if (x.side === 'blue') Sim.order(g, x.id, 'attack', g.W - 120, 320, true); } }
  ok(n === 0, 'commanders no longer wait on HQ: they decide by their temper at once');
}
