// Sim: fog of war — what each side can see and remembers
// fog of war: a side only knows about enemy units it can currently see
const seen = (s, side, u) => u.side === side || !s.fog || s.vis[side].has(u.id);
// what a side believes about an enemy squad: live when seen, else its last sighting for MEMORY seconds
function intel(s, side, q) {
  if (q.side === side || !s.fog) return q.dead ? null : { x: q.cx, y: q.cy, strength: q.strength };
  const m = s.mem[side][q.id];
  return m && s.t - m.t <= MEMORY ? m : null;
}
const threatAt = (s, side, p, r) => s.units.some(u => u.side !== side && dist(u, p) <= r && seen(s, side, u));
// seen = within sight of a friendly unit or structure, or it fired in the last FIRE_REVEAL seconds (muzzle flash)
function visibility(s) {
  for (const side of ['blue', 'red']) {
    const eyes = s.units.filter(u => u.side === side);
    const v = new Set(), vq = new Set();
    for (const e of s.units) {
      if (e.side === side) continue;
      if (s.t - e.lastFire < FIRE_REVEAL || nodeSees(s, side, e) ||
          eyes.some(u => dist(u, e) <= TYPES[u.type].sight)) { v.add(e.id); vq.add(e.squad); }
    }
    s.vis[side] = v; s.visSq[side] = vq;
    // enemy forward HQs / drones: seen when a unit or a working node of ours has them in sight
    s.visNodes[side] = new Set(s.nodes.filter(n => n.side !== side &&
      (!s.fog || nodeSees(s, side, n) || eyes.some(u => dist(u, n) <= TYPES[u.type].sight))).map(n => n.id));
    // structures don't move: once seen, remembered until seen destroyed
    for (const n of s.nodes) if (s.visNodes[side].has(n.id)) s.memNodes[side][n.id] = { id: n.id, x: n.x, y: n.y, kind: n.kind, t: s.t };
    // remember where the seen part of each enemy squad is, not the whole squad (that would leak)
    const acc = {};
    for (const e of s.units) if (v.has(e.id)) { const a = acc[e.squad] || (acc[e.squad] = { x: 0, y: 0, n: 0 }); a.x += e.x; a.y += e.y; a.n++; }
    for (const q of s.squads) {
      const a = acc[q.id];
      if (a) s.mem[side][q.id] = { x: a.x / a.n, y: a.y / a.n, n: a.n, strength: q.strength, type: q.type, t: s.t };
      else if (q.dead) delete s.mem[side][q.id];
    }
  }
}
