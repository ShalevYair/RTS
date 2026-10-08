// Asks between partners (arms): the player marks a spot with what's needed; the computer partner sends what it has,
// and keeps it there a while; it asks the player in turn.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
let s = Sim.create(41, 2200, 'normal', Sim.H * 2, { singles: true }); Sim.extras(s); s = Sim.openField(s); s.fog = true;
Sim.setArms(s, ['armor', 'infantry']); s.meBot = true;
step(s, 600);
const spot = { x: Math.round(s.W * 0.3), y: Math.round(s.H * 0.5) };
const kinds = Sim.ASK_KINDS.filter(k => Sim.canAsk(s, 'blue', 'me', k));
ok(!kinds.includes('guard') && kinds.length >= 2, `the partner (air + guns) can answer: ${kinds.join(', ')}`);
for (const k of kinds.filter(k => k !== 'build')) {
  const a = Sim.ask(s, 'blue', k, spot.x, spot.y);
  ok(a && (a.ok && a.by.length || a.make), `${k}: ${a && a.make ? 'building a ' + a.make + ' first' : 'sent ' + (a && a.by.map(id => s.squads.find(q => q.id === id).type).join(', '))}`);
}
const sent = s.asks.flatMap(a => a.by);
step(s, 40);
const there = sent.filter(id => { const q = s.squads.find(q => q.id === id); return q && !q.dead && Math.hypot(q.cx - spot.x, q.cy - spot.y) < Sim.ARTY_R + 60; });
ok(there.length >= Math.ceil(sent.length / 2), `on their way / there after 40 s: ${there.length} of ${sent.length}`);
ok(sent.every(id => { const q = s.squads.find(q => q.id === id); return !q || q.dead || (q.order.want || q.order).x !== undefined; }), 'think left them be');
// the partner asks too
const seen = new Set(); for (let i = 0; i < 30 * 600 && !s.over; i++) { Sim.step(s, 1 / 30); for (const a of s.asks || []) if (a.from === 'mate') seen.add(a.id + a.kind); }
const mates = seen.size;
ok(mates > 0, `the partner asked the player (${mates})`);
// anything may be asked: with no water trucks and no water point the partner builds one (a well, with no lake in
// reach — there were none here, and the soldiers had no water all game), then sends the truck
{
  for (const n of s.nodes) if (n.side === 'blue' && n.kind === 'waterst') n.hp = 0;
  s.units = s.units.filter(u => !(u.side === 'blue' && u.type === 'watertruck'));
  const a = Sim.ask(s, 'blue', 'water', spot.x, spot.y);
  ok(a && !a.ok && a.make === 'waterst' && a.wait, `water with none: the partner builds a ${a && a.make} first`);
  let t = 0; while (a && !a.ok && t < Sim.ASK_WAIT && !s.over) { step(s, 5); t += 5; }
  ok(a && a.ok, `…and sends the truck once there is one (after ${t} s)`);
}
if (bad) process.exitCode = 1;
