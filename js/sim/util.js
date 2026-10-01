// Sim: small helpers shared by every part of the simulation
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// a building's footprint radius (0 for anything else): distances to a building count from its edge
const nodeR = n => (n && n.kind && STRUCTS[n.kind] ? STRUCTS[n.kind].r : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// the units in a grid of GRID_CELL, made once a tick (unitGrid, in step): `around` = the units that may be within R of
// (x, y) — those in the cells R reaches, a square, not yet a circle. Without this tick's grid (outside step): all of them.
// (Each unit looking through every other one, several times a tick, was most of the game's time with big armies)
const GRID_CELL = 96, MAX_R = Math.max(...Object.values(TYPES).map(T => T.r)); // (MAX_R: the biggest unit's body)
function unitGrid(s) {
  const g = new Map();
  for (const u of s.units) { const k = Math.floor(u.x / GRID_CELL) * 4096 + Math.floor(u.y / GRID_CELL); let l = g.get(k); if (!l) g.set(k, l = []); l.push(u); }
  s.grid = { t: s.t, g };
}
function around(s, x, y, R) {
  const G = s.grid; if (!G || G.t !== s.t) return s.units;
  R += 8; // (units move a little during the tick, after the grid was made)
  const i0 = Math.floor((x - R) / GRID_CELL), i1 = Math.floor((x + R) / GRID_CELL), j0 = Math.floor((y - R) / GRID_CELL), j1 = Math.floor((y + R) / GRID_CELL), out = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = G.g.get(i * 4096 + j); if (l) for (const u of l) out.push(u); }
  return out;
}
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
// how dark it is: 0 by day, 1 in the full night, in quarter steps eased into each other; only where s.night is on
function nightAt(s) {
  if (!s.night) return 0;
  const L = NIGHT_LEVELS, i = Math.floor(s.t / NIGHT_STEP), f = (s.t - i * NIGHT_STEP) / NIGHT_FADE;
  const now = L[i % L.length], was = L[(i + L.length - 1) % L.length];
  if (f >= 1 || i === 0) return now;
  return was + (now - was) * f * f * (3 - 2 * f);
}
// (and what the dark, the weather and a held radar make of it: envSight)
const sightOf = (s, u) => TYPES[u.type].sight * (1 + ELEV_BONUS * (u.lvl || 0)) * envSight(s, u);
// a commander's rank (0, 1, 2) from his experience
const rankOf = sq => sq.xp >= RANK_XP[2] ? 2 : sq.xp >= RANK_XP[1] ? 1 : 0;

function report(s, sq, msg) {
  if (sq && sq.side !== 'blue') return;
  s.log.push({ t: s.t, who: sq ? sq.name : 'מטה', msg });
  if (s.log.length > 40) s.log.shift();
}

const note = (s, msg) => report(s, null, msg);
// command friction (orders as delayed messages, carried out "roughly", reports, calls, friendly fire): part of the fog,
// unless a game turns it off (s.c2 = false: the tutorial's first fog level has only the fog)
const friction = s => s.fog && s.c2 !== false;
// how much of its speed and firepower a hurt unit keeps (HURT_AT / HURT_K)
const hurtK = u => { const f = u.hp / TYPES[u.type].hp; let i = 0; while (i < HURT_AT.length && f < HURT_AT[i]) i++; return HURT_K[i]; };
