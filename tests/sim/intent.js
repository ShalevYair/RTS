// Radio silence, the fake HQ, dust, night, supply lines, commanders' careers and unclear orders
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const game = seed => { const s = Sim.create(seed, 1400, 'normal'); s.bots = []; return s; };
const far = (s, sq, x, y) => { for (const u of s.units) if (u.squad === sq.id) { u.x = x + (u.id % 5) * 6; u.y = y; } };
{
  // radio silence: no reports from out there; the enemy doesn't hear it either; slower, quiet
  const s = game(1), q = s.squads.find(k => k.side === 'blue' && k.type === 'jeep');
  far(s, q, 700, 320); Sim.order(s, q.id, 'hold', 700, 320, true); s.outbox = []; q.order = { type: 'hold', x: 700, y: 320, r: 60 }; step(s, 1);
  ok(Sim.silence(s, q.id, true), 'silence ordered');
  step(s, 12); const t0 = s.rep[q.id].t; s.mem.red = {}; step(s, 30);
  ok(q.silent && s.rep[q.id].t === t0, `silent: no report for 30 s (last at ${t0.toFixed(0)})`);
  ok(!s.mem.red[q.id], 'the enemy heard nothing');
  Sim.silence(s, q.id, false); step(s, 12); s.mem.red = {}; step(s, 20);
  const m = s.mem.red[q.id];
  ok(!q.silent && m && m.lvl === 0 && m.heard, 'talking again: the enemy gets a vague fix ("movement") from its radio');
  // slower
  const a = Sim.create(2, 1400, 'normal'), b = Sim.create(2, 1400, 'normal'); a.bots = b.bots = []; a.fog = b.fog = false;
  const qa = a.squads.find(k => k.side === 'blue' && k.type === 'jeep'), qb = b.squads.find(k => k.side === 'blue' && k.type === 'jeep');
  Sim.silence(a, qa.id, true); Sim.order(a, qa.id, 'hold', 600, qa.cy, true); Sim.order(b, qb.id, 'hold', 600, qb.cy, true); step(a, 4); step(b, 4);
  ok(qa.cx < qb.cx - 40, `a silent squad moves slower (${qa.cx.toFixed(0)} vs ${qb.cx.toFixed(0)})`);
}
{
  // dust: an enemy jeep squad driving fast is noticed far beyond sight, only as "movement"; a silent one isn't
  const run = silent => {
    const s = game(3); s.fog = true;
    const e = s.squads.find(k => k.side === 'red' && k.type === 'jeep'), me = s.squads.find(k => k.side === 'blue' && k.type === 'jeep');
    far(s, me, 600, 200); far(s, e, 950, 200); for (const k of s.squads) if (k !== e && k !== me) for (const u of s.units) if (u.squad === k.id) { u.x = u.side === 'blue' ? 10 : s.W - 10; }
    e.silent = !!silent; // (as if the message had arrived)
    Sim.order(s, me.id, 'hold', 600, 200, true); Sim.order(s, e.id, 'hold', 950, 500, true); s.outbox = [];
    let dust = false, saw = false; for (let i = 0; i < 30 * 5; i++) { Sim.step(s, 1 / 30); const m = s.mem.blue[e.id]; if (m && m.dust && s.t - m.t < 0.1) dust = true; if (s.vis.blue.has(s.units.find(u => u.squad === e.id).id)) saw = true; }
    return { dust, saw };
  };
  const d = run(false), q = run(true);
  ok(d.dust && !d.saw && !q.dust, `dust: a driving enemy is noticed from afar without being seen (${JSON.stringify(d)}); a silent one raises none`);
}
{
  // night: the full game has it, the tutorial doesn't; units see less, orders are slower
  const s = game(4); const u = s.units.find(k => k.side === 'blue' && k.type === 'inf'), q = s.squads.find(k => k.id === u.squad);
  const day = [Sim.nightAt(s), Sim.orderDelay(s, q)]; s.t = 270; const night = [Sim.nightAt(s), Sim.orderDelay(s, q)];
  ok(day[0] === 0 && night[0] === 1 && night[1] > day[1] * 1.4, `night at 4:30: dark ${night[0]}, orders ${day[1].toFixed(1)} → ${night[1].toFixed(1)} s`);
  ok(!Sim.level(10, 1, 1000).night, 'no night in the tutorial');
}
{
  // fake HQ: no slot, at most two, only in the full game; the enemy remembers it as the HQ unless made out closely
  const s = game(5), hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
  const n0 = Sim.buildCount(s, 'blue');
  ok(Sim.build(s, 'blue', 'decoy', hq.x + 150, hq.y + 150) && Sim.buildCount(s, 'blue') === n0, 'a fake HQ takes no slot');
  Sim.build(s, 'blue', 'decoy', hq.x + 150, hq.y - 150);
  ok(!Sim.build(s, 'blue', 'decoy', hq.x + 220, hq.y), 'at most two');
  ok(!Sim.build(Sim.level(7, 1, 1000), 'blue', 'decoy', 150, 320), 'not in the tutorial');
  const g = game(6), fake = { x: g.W / 2, y: 200 }; g.nodes.push({ id: 999, kind: 'decoy', side: 'blue', x: fake.x, y: fake.y, hp: 250, t0: 0, ready: 0, until: Infinity, prog: 0 });
  const r = g.units.find(u => u.side === 'red'); r.x = fake.x + 60; r.y = fake.y; step(g, 0.2);
  ok(g.memNodes.red[999] && g.memNodes.red[999].kind === 'hq', `the enemy sees it and takes it for the HQ (${g.memNodes.red[999] && g.memNodes.red[999].kind})`);
}
{
  // supply lines: far from any building a shot costs more ammunition
  const s = game(7); s.fog = false; s.units = s.units.filter(u => u.side === 'blue');
  const q = s.squads.find(k => k.side === 'blue' && k.type === 'inf'), e = Sim._makeSquad(s, 'red', 'tank', null, 800, 320); e.size = 1; Sim._fillSquad(s, e, 800, 320);
  const u = s.units.find(k => k.squad === q.id), use = x => { u.x = x; u.y = 320; return Sim._supplyUse(s, u); };
  const home = use(170), out = use(800);
  ok(out > home * 1.5, `a shot far from home uses more ammunition (×${home} → ×${out})`);
}
{
  // careers: kills give experience, ranks cut the report noise and the spread; the commander falls with his squad
  const s = game(8), q = s.squads.find(k => k.side === 'blue' && k.type === 'inf');
  const r0 = Sim.understood(s, q, 700, 320); q.xp = 12;
  ok(Sim.rankOf(q) === 2 && Sim.orderDelay(s, q) < (1 + 7 * (1 - Sim.quality(s, 'blue', { x: q.cx, y: q.cy }))) * 0.75, `a seasoned commander (rank ${Sim.rankOf(q)}) gets orders faster`);
  const t = s.units.find(u => u.side === 'red'); t.hp = 0; t.by = q.id; q.xp = 3.5; step(s, 0.1);
  ok(q.xp > 3.5 && Sim.rankOf(q) === 1 && s.log.some(l => /ניסיון/.test(l.msg)), `a kill counts (xp ${q.xp}) and the new rank is reported`);
  const boss = q.boss; for (const u of s.units) if (u.squad === q.id) u.hp = 0; step(s, 0.2);
  ok(q.xp === 0 && q.boss !== boss, `the squad destroyed: its commander ${boss} is gone, ${q.boss} comes with the refills`);
}
{
  // unclear orders: far out, some orders are read by the commander's temper; near HQ never; veterans less often
  const count = (x, xp) => {
    let n = 0; const s = game(9); s.fog = true; const q = s.squads.find(k => k.side === 'blue' && k.type === 'jeep'); q.temper = 'anxious'; q.xp = xp;
    for (let i = 0; i < 200; i++) { far(s, q, x, 320); q.cx = x; q.cy = 320; q.order.type = 'hold'; q.dead = false; const got = Sim._garbled ? Sim._garbled(s, q, 'attack') : null; if (got === 'hold') n++; }
    return n;
  };
  const near = count(100, 0), out = count(1000, 0), vet = count(1000, 12);
  ok(near === 0 && out > 20 && vet < out * 0.5, `garbled orders: near HQ ${near}/200, far out ${out}/200, a veteran far out ${vet}/200`);
}
if (bad) process.exitCode = 1;
{
  // open field: no HQ at first, nothing to build; the HQ only in our strip; the command tanks drive there and set it up;
  // lost before it stands = the game lost; the AI places its own
  const s = Sim.openField(Sim.create(10, 2000, 'normal', 1280)); s.bots = ['red'];
  ok(!s.nodes.some(n => n.kind === 'hq') && Sim.buildCheck(s, 'blue', 100, 640) === 'nohq', 'no HQ at the start, and no building yet');
  ok(Sim.hqCheck(s, 'blue', 1000, 640) === 'band' && !Sim.planHq(s, 'blue', 1000, 640), 'not outside our fifth of the map');
  ok(Sim.planHq(s, 'blue', 300, 150), 'a spot in the corner of our strip');
  step(s, 60);
  const h = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'), r = s.nodes.find(n => n.side === 'red' && n.kind === 'hq');
  ok(h && Math.hypot(h.x - 300, h.y - 150) < 5 && s.t >= h.ready && !s.hqPending.blue && Sim.buildCheck(s, 'blue', 440, 240) === '', `the tanks drove there and set it up; now we can build (${h && [Math.round(h.x), Math.round(h.y)]})`);
  ok(r && r.x > 2000 * 0.8, `the AI put its own in its strip (${r && [Math.round(r.x), Math.round(r.y)]})`);
  const g = Sim.openField(Sim.create(11, 2000, 'normal', 1280)); g.bots = [];
  for (const u of g.units) if (u.squad === Sim.cmdSquad(g, 'blue').id) u.hp = 0;
  step(g, 1);
  ok(g.over === 'red', 'the command tanks lost before the HQ stands: the game is lost');
}
