// Ammunition crates (fuel.js, s.crates — the full game): a supply depot makes crates in its yard, its trucks take them
// to the front; a unit low on ammunition goes to the nearest pile and takes a crate (a tank two); an HQ fills slowly;
// a missile on a pile blows it up; without crates (the tutorial) the trucks refill as before.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f && f()) return; } };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
const crates = s => (s.piles || []).filter(p => p.k === 'ammo');
function field(seed) {
  const s = Sim.openField(Sim.create(seed, 2400, 'normal', 1280, { singles: true })); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  s.lakes = []; s.hills = []; s.elev = null; s.posts = [];
  Sim.planHq(s, 'blue', 250, 640); step(s, 120, () => !s.hqPending.blue && s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  return s;
}
{
  const s = field(5);
  ok(s.crates === true, 'the full game has crates');
  ok(Sim.build(s, 'blue', 'depot', 330, 820), 'a supply depot laid');
  step(s, 240, () => crates(s).some(p => p.node && p.n > 0));
  ok(crates(s).some(p => p.node), 'the depot stands, with a yard of crates');
  ok(!(s.piles || []).some(p => p.k === 'fuel'), 'no barrels from a depot');
  Sim.setFront(s, 'blue', 900, 640);
  step(s, 300, () => crates(s).some(p => !p.node && p.n >= Sim.CRATE_LOAD));
  const front = crates(s).find(p => !p.node);
  ok(front && front.n >= Sim.CRATE_LOAD && Math.hypot(front.x - 900, front.y - 640) < 100, `a truck brought crates to the front (${front ? front.n : 0})`);
  // a tank and a soldier by the pile, out of ammunition: a tank takes 2 crates, a soldier 1
  const tq = mk(s, 'tank', front.x + 30, front.y), t = unitOf(s, tq), iq = mk(s, 'at', front.x - 30, front.y), i = unitOf(s, iq); step(s, 0.1);
  t.sup = 0.02; i.sup = 0.02; const n0 = front.n; step(s, 20, () => t.sup >= 0.95 && i.sup >= 0.95);
  ok(t.sup >= 0.95 && i.sup >= 0.95 && n0 - front.n === 3, `filled from the pile: a tank 2 crates, a soldier 1 (${n0} → ${front.n})`);
  // out of ammunition farther off: it goes to the pile by itself
  const fq = mk(s, 'jeep', front.x + 350, front.y + 150), f = unitOf(s, fq); step(s, 0.1); f.sup = 0.02;
  step(s, 90, () => f.sup >= 0.9);
  ok(f.sup >= 0.9, `a jeep out of ammunition went to the crates (${(f.sup * 100).toFixed(0)}% at ${s.t.toFixed(0)} s)`);
  Sim.blastPiles(s, front.x, front.y, 40);
  ok(front.n === 0, 'a missile on the pile: the crates blew up');
}
{
  // no pile, no truck: an HQ fills slowly
  const s = field(6), q = mk(s, 'tank', 420, 640), u = unitOf(s, q); step(s, 0.1); u.sup = 0.05;
  step(s, 60, () => u.sup >= 0.9);
  ok(u.sup >= 0.9, `by the HQ it refilled slowly (${(u.sup * 100).toFixed(0)}% at ${s.t.toFixed(0)} s)`);
  // and a building that isn't an HQ no longer gives ammunition
  const s2 = field(7); s2.cd = s2.cd || {};
  Sim.build(s2, 'blue', 'tent', 330, 840); step(s2, 200, () => s2.nodes.some(n => n.kind === 'tent' && n.side === 'blue' && s2.t >= n.ready));
  const tent = s2.nodes.find(n => n.kind === 'tent' && n.side === 'blue');
  const iq = mk(s2, 'tank', tent.x, tent.y + 60), v = unitOf(s2, iq); step(s2, 0.1); v.sup = 0.5; v.resup = false;
  Sim.order(s2, iq.id, 'hold', v.x, v.y, true); step(s2, 10);
  ok(v.sup <= 0.5, `by a tent: no ammunition (${(v.sup * 100).toFixed(0)}%)`);
}
{
  // the tutorial (no crates): a truck refills as before, endlessly
  const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false; s.collapseAfter = Infinity;
  ok(!s.crates, 'no crates outside the full game');
  const tq = mk(s, 'truck', 700, 300), iq = mk(s, 'inf', 720, 300), i = unitOf(s, iq); step(s, 0.1); i.sup = 0.3;
  step(s, 10);
  ok(i.sup > 0.9, `a truck refills as before (${(i.sup * 100).toFixed(0)}%)`);
}
{
  // the AI (no front): its trucks drop crates behind its leading squad
  const s = Sim.openField(Sim.create(11, 2400, 'normal', 1280)); s.bots = ['red', 'blue']; s.collapseAfter = Infinity;
  step(s, 900, () => crates(s).some(p => !p.node && p.n > 0));
  ok(crates(s).some(p => !p.node), `the AI's trucks dropped crates out in the field (at ${s.t.toFixed(0)} s)`);
}
process.exit(bad ? 1 : 0);
