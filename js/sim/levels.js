// Sim: the tutorial — levels that add one thing at a time, with no words. Each level is the normal opening
// (world.js), cut down: fewer structures and squads, a weaker enemy, and a list of what the player gets (`ui`).
// The UI shows only those controls; what's new in a level pulses. After the last level comes the full game.
//   ui: squads = pick a squad · orders = hold / attack / retreat · build = buildings (and the slots counter)
//       vehicles = jeep / tank workshops · care = medics and mechanics · air = aircraft and AA
//       fog = fog of war (only what you see) · eye = drones · c2 = command friction (orders take time and are carried
//       out roughly far from HQ, reports, radio log, calls) · fhq = forward HQs · support = the full game's open
//       field: the HQ placed and put up by a bulldozer, which builds everything · radio = and signals trucks
// small: the first levels, on a smaller map (SMALL_K of the width and height). redNodes: the enemy's structures,
// when not the same as ours
// wipe: won by wiping out the enemy, its buildings too (our HQ alone would put it under the line at once)
// fogAt: the fog comes down that many seconds into the level. prebuilt: our extra buildings at the start (a full quota).
const B_ALL = ['tent', 'jeepshop', 'tankshop', 'clinic', 'garage', 'depot'];
const LEVELS = [
  // 1. tap the map: your squad goes there and fights
  { ui: [], nodes: [], blue: [['inf', 0.2, 0.5, 6]], red: [['inf', 0.72, 0.5, 4]], bot: null, small: true },
  // 2. two squads each: pick one, send it
  { ui: ['squads'], nodes: [], blue: [['inf', 0.2, 0.3, 6], ['jeep', 0.2, 0.7, 4]], red: [['inf', 0.75, 0.3, 5], ['jeep', 0.75, 0.7, 3]], bot: 'easy', small: true },
  // 3. our headquarters: hold / attack / retreat (back home heals). The enemy has none yet: knocking down an HQ with
  // jeeps and riflemen was a slog — its HQ comes in with tanks (level 5)
  { ui: ['squads', 'orders'], nodes: ['hq'], redNodes: [], blue: [['inf', 0.2, 0.3, 6], ['jeep', 0.2, 0.7, 4]], red: [['inf', 0.8, 0.3, 5], ['jeep', 0.8, 0.7, 3]], bot: 'easy', small: true, wipe: true },
  // 4. building: tents only (infantry); the enemy only a tent
  { ui: ['squads', 'orders', 'build'], builds: ['tent'], nodes: ['hq', 'tent'], redNodes: ['tent'], bot: 'easy', easy: true, wipe: true },
  // 5. + vehicles: jeep and tank workshops
  { ui: ['squads', 'orders', 'build', 'vehicles'], builds: ['tent', 'jeepshop', 'tankshop'], nodes: ['hq', 'tent'], bot: 'easy', easy: true },
  // 6. + medics, mechanics and supply trucks: the hurt, and those out of ammunition, go to them on their own
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care'], builds: B_ALL, nodes: ['hq', 'tent'], bot: 'easy', easy: true },
  // 7. + aircraft and AA (only AA hits aircraft)
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air'], nodes: ['hq', 'tent'], bot: 'easy', easy: true },
  // 8. + fog, coming down during the level: only what your forces see (orders still go through at once)
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog'], nodes: ['hq', 'tent'], bot: 'easy', easy: true, fogAt: 20 },
  // 9. + drones: they lift the fog where they hover
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye'], nodes: ['hq', 'tent'], bot: 'normal', easy: true, can: { drone: true } },
  // 10. + distance: near HQ everything is as before; farther out orders take time, are carried out roughly, reports lag
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye', 'c2'], nodes: ['hq', 'tent'], bot: 'normal', easy: true, can: { drone: true } },
  // 11. + forward HQs, on the big map: the quota is full, and only a forward HQ makes room (and control out there)
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye', 'c2', 'fhq'], nodes: ['hq', 'tent'], prebuilt: ['jeepshop', 'tankshop', 'clinic'], bot: 'normal', big: true, easy: true, can: { drone: true, fhq: true } },
  // 12. + the open field, as in the full game: no HQ yet — place it, the bulldozer drives there and puts it up (and
  // every building after it, only while it stands by the site). No signals trucks yet
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye', 'c2', 'fhq', 'support'], nodes: ['hq', 'tent'], bot: 'normal', big: true, field: true, can: { drone: true, fhq: true } },
  // 13. + signals trucks: they see far and give control round them
  { ui: ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye', 'c2', 'fhq', 'support', 'radio'], nodes: ['hq', 'tent'], bot: 'normal', big: true, field: true, can: { drone: true, fhq: true } },
];
const LEVEL_UI = ['squads', 'orders', 'build', 'vehicles', 'care', 'air', 'fog', 'eye', 'c2', 'fhq', 'support', 'radio'], LEVEL_COLLAPSE = 0.25;
// the tutorial should be won: from level 4 on the enemy starts smaller, its HQ half-built, and it produces at half
// speed while we produce faster (LEVEL_PROD)
const SMALL_K = 0.65, LEVEL_PROD = { blue: 1.4, red: 0.5 }, LEVEL_FOE_HQ = 0.5, LEVEL_FOE = [['inf', 0.85, 0.3, 3]];

// replace a side's squads with the listed ones: [type, x as a share of the width, y as a share of the height, units]
function setForces(s, side, list) {
  const gone = new Set(s.squads.filter(q => q.side === side).map(q => q.id));
  s.squads = s.squads.filter(q => !gone.has(q.id)); s.units = s.units.filter(u => !gone.has(u.squad));
  for (const n of s.nodes) if (gone.has(n.squad)) { n.squad = null; n.squads = []; }
  for (const [type, fx, fy, n] of list) {
    const x = s.W * fx, y = s.H * fy;
    if (singles(s, side)) { raiseSingles(s, side, type, null, x, y, n); continue; } // (the player's: each unit its own squad)
    const sq = makeSquad(s, side, type, null, x, y); sq.size = n; fillSquad(s, sq, x, y);
  }
}

// level n (1-based) on a map W wide; null past the last level
function level(n, seed = 1, W = 1000, opts = {}) {
  const L = LEVELS[n - 1];
  if (!L) return null;
  const s = L.big ? create(seed, 2 * Math.max(1000, W), L.bot || 'easy', 2 * H, opts) : L.small ? create(seed, Math.round(W * SMALL_K), L.bot || 'easy', Math.round(H * SMALL_K), { ...opts, small: true }) : create(seed, W, L.bot || 'easy', H, opts);
  s.level = n; s.night = false; s.scale = 1; s.ui = L.ui.slice(); s.fog = L.ui.includes('fog') && !L.fogAt; s.c2 = L.ui.includes('c2');
  if (L.fogAt) s.fogAt = L.fogAt;
  s.supply = L.ui.includes('care'); // ammunition runs out from the level that brings medics, mechanics and supply trucks
  s.style.red = 'steady';
  s.bots = L.bot ? ['red'] : [];
  s.aiCan = { build: !!L.nodes.includes('tent'), drone: false, fhq: false, ...L.can };
  if (L.builds) s.builds = L.builds.slice();
  // what's left of the opening: only the listed structures; a squad whose building is gone gets no refills
  s.nodes = s.nodes.filter(k => (k.side === 'red' && L.redNodes ? L.redNodes : L.nodes).includes(k.kind));
  for (const q of s.squads) if (q.home && !s.nodes.some(k => k.id === q.home)) q.home = null;
  if (L.blue) setForces(s, 'blue', L.blue);
  if (L.red) setForces(s, 'red', L.red);
  // buildings already standing (ready): behind the HQ, one above the other
  // (each on the first free spot round the HQ, toward the enemy: none on top of another or over the map's edge —
  // units got caught in the pockets between them)
  (L.prebuilt || []).forEach(k => {
    const h = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || { x: s.bases.blue.x, y: s.H / 2 }, R = STRUCTS[k].r;
    for (let d = STRUCTS.hq.r + R + BUILD_GAP + 10; d < 600; d += 20) for (let a = -1.2; a <= 1.21; a += 0.3) {
      const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
      if (x > R + 10 && y > R + 10 && y < s.H - R - 10 && !crowded(s, k, x, y) && !lakeAt(s, { x, y }, R + 10)) { addStruct(s, 'blue', k, x, y, true); return; }
    }
  });
  if (L.easy) {
    s.prodRate = { ...LEVEL_PROD };
    setForces(s, 'red', LEVEL_FOE);
    const h = hqOf(s, 'red'); if (h) h.hp = STRUCTS.hq.hp * LEVEL_FOE_HQ;
  }
  // levels are short: a side is beaten below LEVEL_COLLAPSE (not 15%); where nothing is produced, from the start,
  // and the enemy there doesn't run
  s.collapseAt = L.wipe ? 1e-6 : LEVEL_COLLAPSE;
  if (!L.nodes.includes('tent')) { s.collapseAfter = 0; for (const q of s.squads) if (q.side === 'red') q.trait = 'aggressive'; }
  // (the open field: each side places its HQ; the enemy builds slower)
  if (L.field) { s.noRadio = !L.ui.includes('radio'); openField(s); s.fuel = false; s.prodRate = { ...LEVEL_PROD }; s.collapseAfter = 120; return s; } // (s.fuel: none in the tutorial — it doesn't teach it)
  updatePower(s); visibility(s);
  s.rep = {}; for (const q of s.squads) sendReport(s, q);
  return s;
}
