// Logistics, the AI's styles and facing: ammunition runs down with each shot; low, a unit goes on its own to a supply
// truck (or home), holding fire, refills and comes back; the enemy plays one of several styles; an order can set
// which way the front faces
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
function quiet(seed) {
  const s = Sim.create(seed, 1200, 'normal'); s.bots = []; s.fog = false; s.lakes = []; s.noReinforce = true; s.collapseAfter = 1e9;
  for (const u of s.units) if (u.side === 'red') { u.x = s.W - 10; u.y = 10; }
  return s;
}
{
  const s = quiet(3), inf = s.units.find(u => u.side === 'blue' && u.type === 'inf'), foe = s.units.find(u => u.side === 'red' && u.type === 'inf');
  const sq = s.squads.find(q => q.id === inf.squad);
  // a truck out in the field
  const tq = Sim._makeSquad(s, 'blue', 'truck', null, 520, 250); tq.size = 1; Sim._fillSquad(s, tq, 520, 250);
  const truck = s.units.find(u => u.squad === tq.id);
  inf.x = 650; inf.y = 250; sq.order = { type: 'hold', x: 650, y: 250, r: 60 };
  foe.x = 690; foe.y = 250; foe.cd = 1e9; foe.hp = 1e6; // a target that won't die
  const s0 = inf.sup; step(s, 3);
  ok(inf.sup < s0, `each shot uses ammunition (${s0} → ${inf.sup.toFixed(2)})`);
  inf.sup = 0.05; let fired = false, near = false;
  for (let i = 0; i < 30 * 6; i++) { const t0 = inf.lastFire; Sim.step(s, 1 / 30); if (inf.lastFire !== t0 && inf.resup) fired = true; if (Math.hypot(inf.x - truck.x, inf.y - truck.y) < 40) near = true; }
  ok(near && !fired, 'nearly out: it holds fire and goes to the supply truck');
  step(s, 10);
  ok(!inf.resup && inf.sup >= 0.9, `refilled at the truck (${inf.sup.toFixed(2)}), back in the fight`);
  s.units = s.units.filter(u => u.type !== 'truck'); inf.x = 650; inf.sup = 0.05; step(s, 3);
  ok(inf.resup && inf.x < 650 - 40, 'no truck: it heads home for ammunition');
}
{
  const s = quiet(4); s.supply = false;
  const inf = s.units.find(u => u.side === 'blue' && u.type === 'inf'), foe = s.units.find(u => u.side === 'red' && u.type === 'inf');
  inf.x = 650; inf.y = 250; s.squads.find(q => q.id === inf.squad).order = { type: 'hold', x: 650, y: 250, r: 60 };
  foe.x = 690; foe.y = 250; foe.cd = 1e9; foe.hp = 1e6; step(s, 5);
  ok(inf.sup === 1, 'without logistics (early tutorial levels) ammunition never runs out');
  ok(!Sim.level(5, 1, 1000).supply && Sim.level(6, 1, 1000).supply && Sim.create(1, 1000).supply, 'logistics from the tutorial level with medics and trucks on, and in the full game');
}
{
  // facing: no enemy seen, the front faces where the player pointed (south here), tanks first
  const s = quiet(5); s.units = s.units.filter(u => u.side === 'blue');
  const tq = Sim._makeSquad(s, 'blue', 'tank', null, 200, 300); tq.size = 3; Sim._fillSquad(s, tq, 200, 300);
  const ids = s.squads.filter(q => q.side === 'blue').map(q => q.id);
  Sim.formation(s, ids, 'hold', 500, 300, true, Math.PI / 2); step(s, 3);
  const at = t => s.squads.find(q => q.side === 'blue' && q.type === t).order;
  ok(at('tank').y > at('jeep').y && at('jeep').y > at('inf').y && Math.abs(at('tank').x - 500) < 15, `pointing south: tanks ${at('tank').y.toFixed(0)}, jeeps ${at('jeep').y.toFixed(0)}, infantry ${at('inf').y.toFixed(0)} (y grows southward)`);
}
{
  // styles: each game the enemy plays one; the turtle stays home early; the flanker goes round by an edge
  const seen = new Set(); for (let seed = 1; seed <= 30; seed++) seen.add(Sim.create(seed, 1000).style.red);
  ok(seen.size === 4 && Object.keys(Sim.AI_STYLES).every(k => seen.has(k)), `the enemy's style varies by game: ${[...seen].join(', ')}`);
  // how far from its HQ any of its fighting squads got in the first 100 s
  const far = style => { const s = Sim.create(21, 1200, 'normal'); s.fog = false; s.bots = ['blue', 'red']; s.style.red = style; const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'red'); let m = 0;
    for (let i = 0; i < 30 * 100; i++) { Sim.step(s, 1 / 30); for (const q of s.squads) if (q.side === 'red' && !q.dead && !Sim.TYPES[q.type].care) m = Math.max(m, Math.hypot(q.cx - hq.x, q.cy - hq.y)); } return m; };
  const t = far('turtle'), r = far('rush');
  ok(t < 550 && r > t + 100, `the turtle keeps near home early (at most ${t.toFixed(0)} from its HQ) where the rusher goes out (${r.toFixed(0)})`);
  const f = Sim.create(22, 1400, 'normal'); f.fog = false; f.bots = ['red']; f.style.red = 'flank';
  let edge = false; for (let i = 0; i < 30 * 200 && !edge; i++) { Sim.step(f, 1 / 30); edge = f.squads.some(q => q.side === 'red' && !q.dead && !Sim.TYPES[q.type].air && (q.cy < f.H * 0.2 || q.cy > f.H * 0.8) && q.cx < f.W * 0.75); }
  ok(edge, 'the flanker goes round by the top or bottom edge');
}
