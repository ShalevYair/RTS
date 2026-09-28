// Sim: small helpers shared by every part of the simulation
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// hills and lakes aren't perfect circles / ellipses: each has a few waves around its rim (w = [[amp, k, phase], ...]);
// `wobble` is how far out the rim is at angle th, as a share of the plain radius
const wobble = (w, th) => { let f = 1; if (w) for (const [a, k, ph] of w) f += a * Math.cos(k * th + ph); return f; };
// height at p in contour lines (bilinear on the grid made with the map); the line a unit stands on; on a hill = line 1+
function elevAt(s, p) {
  const E = s.elev; if (!E) return 0;
  const fx = clamp(p.x / ELEV_CELL, 0, E.w - 1.001), fy = clamp(p.y / ELEV_CELL, 0, E.h - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, g = E.g, k = j * E.w + i;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + E.w] * (1 - u) + g[k + E.w + 1] * u) * v;
}
const levelAt = (s, p) => Math.floor(elevAt(s, p));
const inHill = (s, p) => elevAt(s, p) >= 1;
// lakes are rotated ellipses; `lakeK` < 1 means p is inside (grown by pad)
function lakeK(l, p, pad = 0) {
  const c = Math.cos(l.a), sn = Math.sin(l.a), dx = p.x - l.x, dy = p.y - l.y;
  const u = (dx * c + dy * sn) / (l.rx + pad), v = (-dx * sn + dy * c) / (l.ry + pad);
  return (u * u + v * v) / wobble(l.w, Math.atan2(v, u)) ** 2;
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
// how far a unit sees: ELEV_BONUS more per contour line it stands on (u.lvl is set once a tick in step(); 0 for aircraft)
const sightOf = (s, u) => TYPES[u.type].sight * (1 + ELEV_BONUS * (u.lvl || 0));

function report(s, sq, msg) {
  if (sq && sq.side !== 'blue') return;
  s.log.push({ t: s.t, who: sq ? sq.name : 'מטה', msg });
  if (s.log.length > 40) s.log.shift();
}

const note = (s, msg) => report(s, null, msg);
// command friction (orders as delayed messages, carried out "roughly", reports, calls, friendly fire): part of the fog,
// unless a game turns it off (s.c2 = false: the tutorial's first fog level has only the fog)
const friction = s => s.fog && s.c2 !== false;
