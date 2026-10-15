// Fronts (fronts.js): two lines drawn on the map — the whole army (the player's and the partner's) goes to them, split
// evenly by strength, each squad its own place; the supply trucks stay behind the fighters; a squad sent by hand leaves
// its front. node tests/sim/fronts.js [seed]
const assert = require('assert');
const Sim = require('../load-sim.js')();
const seed = +process.argv[2] || 41;
let s = Sim.create(seed, 2200, 'normal', Sim.H * 2, { singles: true });
Sim.extras(s); s = Sim.openField(s); s.fog = true; Sim.setArms(s, ['armor', 'infantry']); s.meBot = true;
while (!s.over && s.t < 480) Sim.step(s, 1 / 30);
const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'), X = hq.x + (s.W / 2 - hq.x) * 0.55;
// (two lines across the map, ahead of the HQ: the top half and the bottom half — the bottom one bent)
Sim.addFront(s, 'blue', [{ x: X, y: 80 }, { x: X + 40, y: s.H * 0.45 }]);
Sim.addFront(s, 'blue', [{ x: X, y: s.H * 0.55 }, { x: X + 80, y: s.H * 0.75 }, { x: X, y: s.H - 80 }]);
assert.ok(!Sim.addFront(s, 'blue', [{ x: 10, y: 10 }]), 'one point is no line');
const geo = s.fronts.blue.map(f => Sim.frontGeo(s, 'blue', f));
// how far behind its line (along the normal) a unit stands
const behind = (g, u) => { let best = { e: Infinity, d: 0 }; for (let i = 1; i < g.P.length; i++) { const A = g.P[i - 1], B = g.P[i], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy, k = Math.max(0, Math.min(1, ((u.x - A.x) * dx + (u.y - A.y) * dy) / L2)), qx = A.x + dx * k, qy = A.y + dy * k, e = Math.hypot(u.x - qx, u.y - qy); if (e < best.e) best = { e, d: (u.x - qx) * g.nx[i - 1] + (u.y - qy) * g.ny[i - 1] }; } return best.d; };
let stuck = 0, ahead = 0, samples = 0; const last = new Map();
const t0 = s.t;
while (!s.over && s.t < t0 + 180) {
  Sim.step(s, 1 / 30);
  if (Math.abs(s.t % 2) < 1 / 30) {
    for (const [i, f] of s.fronts.blue.entries()) {
      const us = s.units.filter(u => u.side === 'blue' && (s.squads.find(q => q.id === u.squad) || {}).front === f.id);
      const fight = us.filter(u => !Sim.TYPES[u.type].care && !Sim.TYPES[u.type].air), trucks = us.filter(u => /truck$/.test(u.type) || u.type === 'truck');
      if (!fight.length) continue;
      const fd = fight.reduce((a, u) => a + behind(geo[i], u), 0) / fight.length;
      for (const t of trucks) { samples++; if (behind(geo[i], t) < fd - 20) ahead++; }
    }
    // (a ground unit with somewhere to go that hasn't moved in 2 s)
    for (const u of s.units) if (u.side === 'blue' && !Sim.TYPES[u.type].air) {
      const q = s.squads.find(q => q.id === u.squad); if (!q || !q.front) continue;
      const o = q.order, far = o && Math.hypot(o.x - u.x, o.y - u.y) > 60, p = last.get(u.id);
      if (far && p && Math.hypot(p.x - u.x, p.y - u.y) < 2) stuck += 2;
      last.set(u.id, { x: u.x, y: u.y });
    }
  }
}
const on = s.squads.filter(q => q.side === 'blue' && !q.dead && q.front), pw = {};
for (const q of on) pw[q.front] = (pw[q.front] || 0) + s.units.filter(u => u.squad === q.id && !Sim.TYPES[u.type].care).reduce((a, u) => a + (Sim.UNIT_VALUE[u.type] || 1), 0);
const mate = on.filter(q => !Sim.ownSquad(s, q)).length;
const P = Object.values(pw), split = Math.min(...P) / Math.max(...P);
console.log('on fronts', on.length, 'of which partner', mate, ' power by front', JSON.stringify(pw), ' split', split.toFixed(2));
console.log('trucks ahead of the fighters', ahead, '/', samples, ' stuck unit-seconds', stuck);
assert.ok(on.length > 10, 'squads on the fronts');
assert.ok(mate > 0, "the partner's squads on the fronts too");
assert.ok(split > 0.6, 'split evenly by strength');
assert.ok(ahead <= samples * 0.1, 'trucks behind the fighters');
// (sent by hand: off its front, and the front gives it no orders)
const q = on.find(q => Sim.ownSquad(s, q) && !Sim.TYPES[q.type].care);
Sim.order(s, q.id, 'attack', 100, 100); Sim.step(s, 1 / 30);
for (let i = 0; i < 90; i++) Sim.step(s, 1 / 30);
assert.ok(!q.front, 'sent by hand: off the front');
const ow = (s.outbox.find(m => m.id === q.id && m.kind === 'order') || q.order);
assert.ok(Math.hypot((ow.want || ow).x - 100, (ow.want || ow).y - 100) < 30, 'its own order stands');
// (drawn again near the first, 150 on: the same front moved — its number and its squads)
{ const f0 = s.fronts.blue[0], n0 = on.filter(q => q.front === f0.id).length;
  const f = Sim.addFront(s, 'blue', [{ x: X + 150, y: 80 }, { x: X + 190, y: s.H * 0.45 }]);
  assert.equal(f, f0, 'near: the same front'); assert.equal(s.fronts.blue.length, 2); assert.equal(f.pts[0].x, Math.round(X + 150));
  Sim.step(s, 1 / 30); assert.ok(s.squads.filter(q => q.front === f0.id).length >= n0 - 2, 'its squads stay with it');
  // (a third far off: a new one; a fourth: takes the nearest one's place)
  Sim.addFront(s, 'blue', [{ x: X - 400, y: 200 }, { x: X - 400, y: s.H - 200 }]); assert.equal(s.fronts.blue.length, 3);
  const g = Sim.addFront(s, 'blue', [{ x: X - 300, y: 300 }, { x: X - 300, y: s.H - 300 }]); assert.equal(s.fronts.blue.length, 3); assert.equal(g, s.fronts.blue[2], 'a fourth: the nearest replaced');
  Sim.removeFront(s, 'blue', g.id); }
Sim.removeFront(s, 'blue', s.fronts.blue[0].id); assert.equal(s.fronts.blue.length, 1);
for (let i = 0; i < 60; i++) Sim.step(s, 1 / 30);
assert.ok(s.squads.filter(q => q.side === 'blue' && !q.dead && q.front).every(q => q.front === s.fronts.blue[0].id), 'one front left: all on it');
console.log('fronts ok');
