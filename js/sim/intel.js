// Sim: fog of war — what each side can see and remembers
// fog of war: a side only knows about enemy units it can currently see
const seen = (s, side, u) => u.side === side || !s.fog || s.vis[side].has(u.id);
// what a side believes about an enemy squad: live when seen, else its last sighting for MEMORY seconds
function intel(s, side, q) {
  if (q.side === side || !s.fog) return q.dead ? null : { x: q.cx, y: q.cy, strength: q.strength, type: q.type, air: !!TYPES[q.type].air, n: q.count, lvl: 2, t: s.t };
  const m = s.mem[side][q.id];
  return m && s.t - m.t <= MEMORY ? m : null;
}
// how well a side can make out an enemy at p: 2 type and number, 1 ground/air, 0 only "something moves"
// everything a drone or a signals truck of the side sees is made out in full (and, in the UI, drawn as it is) — not
// only its full-control ring
function clearAt(s, side, p) {
  for (const n of s.nodes) if (n.side === side && n.kind === 'drone' && n.hp > 0 && s.t >= n.ready && dist(n, p) <= DRONE_SIGHT) return true;
  for (const u of s.units) if (u.side === side && (u.type === 'radio' || u.type === 'commando') && dist(u, p) <= sightOf(s, u)) return true;
  return false;
}
// a commando is seen only up close: by a drone or a signals truck of the side, its units or buildings, or firing
function stealthSeen(s, side, e, eyes) {
  if (s.t - e.lastFire < STEALTH_FIRE) return true;
  if (s.nodes.some(n => n.side === side && n.hp > 0 && dist(n, e) <= (n.kind === 'drone' ? STEALTH_EYE : nodeR(n) + STEALTH_NEAR))) return true;
  return eyes.some(u => dist(u, e) <= (u.type === 'radio' ? STEALTH_EYE : STEALTH_NEAR));
}
function idLevel(s, side, p) {
  if (!friction(s)) return 2;
  if (clearAt(s, side, p)) return 2;
  const q = quality(s, side, p);
  return q >= ID_FULL ? 2 : q >= ID_CLASS ? 1 : 0;
}
const threatAt = (s, side, p, r) => s.units.some(u => u.side !== side && dist(u, p) <= r && seen(s, side, u));
// seen = within sight of a friendly unit or structure, or it fired in the last FIRE_REVEAL seconds (muzzle flash)
function visibility(s) {
  for (const side of ['blue', 'red']) {
    const eyes = s.units.filter(u => u.side === side);
    const v = new Set(), vq = new Set();
    for (const e of s.units) {
      if (e.side === side) continue;
      if (TYPES[e.type].stealth ? stealthSeen(s, side, e, eyes) : s.t - e.lastFire < FIRE_REVEAL || nodeSees(s, side, e) ||
          eyes.some(u => dist(u, e) <= sightOf(s, u))) { v.add(e.id); vq.add(e.squad); }
    }
    s.vis[side] = v; s.visSq[side] = vq;
    // enemy forward HQs / drones: seen when a unit or a working node of ours has them in sight
    s.visNodes[side] = new Set(s.nodes.filter(n => n.side !== side &&
      (!s.fog || nodeSees(s, side, n) || eyes.some(u => dist(u, n) <= sightOf(s, u)))).map(n => n.id));
    // structures don't move: once seen, remembered until seen destroyed
    for (const n of s.nodes) if (s.visNodes[side].has(n.id)) s.memNodes[side][n.id] = { id: n.id, x: n.x, y: n.y, kind: n.kind === 'decoy' && idLevel(s, side, n) < 2 ? 'hq' : n.kind, t: s.t };
    // remember where the seen part of each enemy squad is, not the whole squad (that would leak)
    const acc = {};
    for (const e of s.units) if (v.has(e.id)) { const a = acc[e.squad] || (acc[e.squad] = { x: 0, y: 0, n: 0 }); a.x += e.x; a.y += e.y; a.n++; }
    for (const q of s.squads) {
      const a = acc[q.id];
      if (a) {
        const p = { x: a.x / a.n, y: a.y / a.n }, prev = s.mem[side][q.id];
        let lvl = idLevel(s, side, p);
        if (prev && s.t - prev.t <= TRACK_GAP && prev.lvl > lvl) lvl = prev.lvl;
        // only what could be made out is stored: no type, count or strength below full identification
        s.mem[side][q.id] = { x: p.x, y: p.y, lvl, t: s.t, type: lvl >= 2 ? q.type : null, air: lvl >= 1 ? !!TYPES[q.type].air : null,
          n: lvl >= 2 ? a.n : null, strength: lvl >= 2 ? q.strength : null };
      }
      else if (q.dead) delete s.mem[side][q.id];
      // not seen, but its vehicles raise dust within DUST_SEE of our eyes: "something moves" there
      else if (s.fog && q.side !== side && DUSTY.includes(q.type)) {
        let x = 0, y = 0, n = 0;
        for (const e of s.units) if (e.squad === q.id && s.t - (e.dustAt ?? -9) < 0.5 && (eyes.some(u => dist(u, e) <= DUST_SEE) || s.nodes.some(k => k.side === side && k.hp > 0 && k.kind !== 'decoy' && dist(k, e) <= DUST_SEE))) { x += e.x; y += e.y; n++; }
        if (n) {
          const prev = s.mem[side][q.id], keep = prev && s.t - prev.t <= TRACK_GAP ? prev : null, j = () => (s.rand() * 2 - 1) * DUST_NOISE;
          s.mem[side][q.id] = { x: clamp(x / n + j(), 0, s.W), y: clamp(y / n + j(), 0, s.H), t: s.t, dust: true,
            lvl: keep ? keep.lvl : 0, type: keep ? keep.type : null, air: keep ? keep.air : false, n: keep ? keep.n : null, strength: keep ? keep.strength : null };
        }
      }
    }
  }
}
