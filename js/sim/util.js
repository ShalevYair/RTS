// Sim: small helpers shared by every part of the simulation
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inHill = (s, p) => s.hills.some(h => dist(h, p) < h.r);
// lakes are rotated ellipses; `lakeK` < 1 means p is inside (grown by pad)
function lakeK(l, p, pad = 0) {
  const c = Math.cos(l.a), sn = Math.sin(l.a), dx = p.x - l.x, dy = p.y - l.y;
  const u = dx * c + dy * sn, v = -dx * sn + dy * c;
  return (u / (l.rx + pad)) ** 2 + (v / (l.ry + pad)) ** 2;
}
const lakeAt = (s, p, pad = 0) => s.lakes.find(l => lakeK(l, p, pad) < 1);
// the nearest dry spot: p pushed straight out from the lake's centre to its (padded) shore
function dryOf(s, p, pad = 0) {
  let q = { x: p.x, y: p.y };
  for (const l of s.lakes) {
    const k = lakeK(l, q, pad);
    if (k >= 1) continue;
    if (k < 1e-6) q = { x: l.x + Math.cos(l.a) * (l.rx + pad + 1), y: l.y + Math.sin(l.a) * (l.rx + pad + 1) };
    else { const f = 1.001 / Math.sqrt(k); q = { x: l.x + (q.x - l.x) * f, y: l.y + (q.y - l.y) * f }; }
  }
  return q;
}
// how far a unit sees: more from a hill (aircraft don't care)
// (u.hill is set once a tick in step(); aircraft are never "on" a hill)
const sightOf = (s, u) => TYPES[u.type].sight * (u.hill ? HILL_SIGHT : 1);

function report(s, sq, msg) {
  if (sq && sq.side !== 'blue') return;
  s.log.push({ t: s.t, who: sq ? sq.name : 'מטה', msg });
  if (s.log.length > 40) s.log.shift();
}

const note = (s, msg) => report(s, null, msg);
