// Sim: small helpers shared by every part of the simulation
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inHill = (s, p) => s.hills.some(h => dist(h, p) < h.r);
// bases are full-height strips at the map edges
const inBase = (s, side, p) => { const b = s.bases[side]; return p.x >= b.x0 - 5 && p.x <= b.x1 + 5; };

function report(s, sq, msg) {
  if (sq && sq.side !== 'blue') return;
  s.log.push({ t: s.t, who: sq ? sq.name : 'מטה', msg });
  if (s.log.length > 40) s.log.shift();
}

const note = (s, msg) => report(s, null, msg);
