// Marching together (march.js): a formation through a gap between two lakes folds into a column and gets there whole;
// orders queued (Shift + click) are followed one after the other; 'move only' drives past an enemy without stopping.
const Sim = require('../load-sim.js')();
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mk = (s, side, t, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); const u = s.units[s.units.length - 1]; u.x = x; u.y = y; return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
function field(seed = 5) {
  const s = Sim.create(seed, 2400, 'normal', 1280, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq'); s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.collapseAfter = Infinity; s.noReinforce = true;
  return s;
}
const run = (s, T) => { for (let i = 0; i < T * 30; i++) Sim.step(s, 1 / 30); };
const K = ['tank', 'jeep', 'inf', 'jeep', 'tank', 'inf', 'ajeep'];
{ // through the gap: a column, and all of them there
  const s = field(); s.lakes = [{ x: 1000, y: 380, rx: 120, ry: 200, a: 0, w: [] }, { x: 1000, y: 900, rx: 120, ry: 200, a: 0, w: [] }];
  const qs = []; for (let i = 0; i < 24; i++) qs.push(mk(s, 'blue', K[i % 7], 300 + (i % 6) * 40, 480 + Math.floor(i / 6) * 50));
  Sim.formation(s, qs.map(q => q.id), 'hold', 1700, 250, true);
  const m = qs[0].order.form.march; let narrow = false, inLake = 0;
  for (let i = 0; i < 220 * 30; i++) { Sim.step(s, 1 / 30); if (m.narrow) narrow = true; if (s.units.some(u => Sim.lakeAt(s, u))) inLake++; }
  ok(m.lead && m.pts.length > 2, 'a route round the lakes (' + m.pts.length + ' points)');
  ok(narrow, 'folded into a column in the gap');
  ok(!!m.done, 'the march ended');
  const far = qs.filter(q => { const u = unitOf(s, q); return u && Math.hypot(u.x - 1700, u.y - 250) > 320; }).length;
  ok(far === 0, 'all of them at the far side (' + far + ' not)');
}
{ // queued: on to the second point once at the first
  const s = field(); const qs = []; for (let i = 0; i < 6; i++) qs.push(mk(s, 'blue', 'jeep', 300 + i * 30, 640));
  const ids = qs.map(q => q.id);
  Sim.formation(s, ids, 'hold', 800, 300, true); Sim.queueOrder(s, ids, 'hold', 800, 1000); Sim.queueOrder(s, ids, 'hold', 400, 1000);
  let sawSecond = false; for (let i = 0; i < 200 * 30; i++) { Sim.step(s, 1 / 30); const f = qs[0].order.form; if (f && Math.abs(f.wy - 1000) < 1 && Math.abs(f.wx - 800) < 1) sawSecond = true; }
  const u = unitOf(s, qs[0]);
  ok(sawSecond, 'went on to the second point');
  ok(Math.hypot(u.x - 400, u.y - 1000) < 160 && !(s.ways || []).length, 'ended at the third, nothing left queued');
}
{ // move only: past an enemy line, without stopping to fight it (holding, they stop and fight it out first)
  const go = move => {
    const s = field(); for (let i = 0; i < 6; i++) { const q = mk(s, 'red', 'inf', 1200, 540 + i * 40); Sim.order(s, q.id, 'hold', 1200, 540 + i * 40, true); }
    const qs = []; for (let i = 0; i < 6; i++) qs.push(mk(s, 'blue', 'jeep', 600, 540 + i * 40));
    Sim.formation(s, qs.map(q => q.id), 'hold', 1900, 640, true, undefined, undefined, { move });
    for (let i = 0; i < 240 * 30; i++) { Sim.step(s, 1 / 30); if (qs.filter(q => { const u = unitOf(s, q); return u && u.x > 1650; }).length >= 4) return s.t; }
    return Infinity;
  };
  const a = go(true), b = go(false);
  ok(a < 200, 'move only: there in ' + Math.round(a) + ' s');
  ok(a < b, 'holding (not only moving): ' + Math.round(b) + ' s — they stopped to fight on the way');
}
console.log(fails ? fails + ' failed' : 'all passed'); process.exitCode = fails ? 1 : 0;
