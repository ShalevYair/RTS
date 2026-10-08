// Sim: the AI (plays by the same fog, message and building rules). think(s, side, level) drives one side;
// the enemy uses it, and the Node tests also let it play blue.

const foeOf = side => side === 'blue' ? 'red' : 'blue';
// how much enemy force sits near p, weighed by how this squad fares against it.
// > 0: the squad has the upper hand there; < 0: it would be countered.
// (foes: what think already knows of them — [{ q, k }]; working it out again here for every target of every squad
// was most of a big battle's time, the player's units being hundreds of singles)
function edgeAt(s, sq, p, foes) {
  let e = 0;
  for (const { q, k } of foes) {
    if (!k.type || Math.hypot(k.x - p.x, k.y - p.y) > AI_NEAR) continue; // unidentified: can't weigh it
    e += (MULT[sq.type][k.type] - MULT[k.type][sq.type]) * k.strength * q.size;
  }
  return e;
}
// can this squad hurt what it knows of an enemy? unidentified: assume so; known only as aircraft: only AA
const canHit = (sq, k) => k.type ? MULT[sq.type][k.type] > 0 : k.air ? MULT[sq.type].air > 0 : true;
// enemy structures this side knows about: seen ones stay remembered (they don't move); the enemy HQ's
// place is known from the start
function knownStructs(s, side) {
  const foe = foeOf(side);
  const list = s.fog ? Object.values(s.memNodes[side]) : s.nodes.filter(n => n.side === foe && n.hp > 0);
  const out = list.filter(n => n.kind !== 'drone');
  // (open field: the HQ could be anywhere in its strip — look along it, a third at a time)
  if (!out.some(n => n.kind === 'hq') && hqOf(s, foe)) out.push({ id: 'hq?', kind: 'hq', x: s.bases[foe].x, y: s.hqPending ? s.H * [0.5, 0.2, 0.8][Math.floor(s.t / 90) % 3] : s.H / 2 });
  return out;
}

// put a building of the next planned kind near the most forward control node, toward the enemy
// a player's part of the plan, its arms in turn — one of each in its order, then the next of each: as it stood, the
// first arm's buildings (armour, infantry — early in the plan) filled the quota, and the air force hardly got any
const byTurns = plan => { const by = new Map(); for (const k of plan) { const a = ARM_OF[k] || '?'; if (!by.has(a)) by.set(a, []); by.get(a).push(k); } const L = [...by.values()], out = []; for (let i = 0; out.length < plan.length; i++) for (const l of L) if (i < l.length) out.push(l[i]); return out; };
function aiBuild(s, side, D, who) {
  const may = k => !who || (armSide(s, side, k) || 'me') === who; // (arms: only this player's buildings; none this game — all 'me')
  const pk = who ? side + who : side; // (arms: each player its own place in the plan)
  if (D.mass && !s.level && s.fog && may('decoy') && alive(s, side, ['decoy']).length < 2) { // (hard: deception — a fake HQ or two by the forward HQs)
    const f = alive(s, side, ['fhq']).find(n => s.t >= n.ready), foe = s.bases[foeOf(side)];
    if (f) for (let i = 0; i < 8; i++) { const a = Math.atan2(foe.y - f.y, foe.x - f.x) + (s.rand() - 0.5) * 2, r = roomOf(s, f.kind) + roomOf(s, 'decoy') + 5 + s.rand() * 50; if (build(s, side, 'decoy', f.x + Math.cos(a) * r, f.y + Math.sin(a) * r)) break; }
  }
  const asked = who && s.askMake && s.askMake[pk]; // (what the partner was asked for and has none of: what makes it, first — asks.js)
  if (s.logi && may('depot')) aiSupply(s, side, asked);
  if (buildCount(s, side, who) >= buildLimit(s, side)) return;
  if (!D.smart && s.t - (s.lastBuild[pk] || -99) < 30) return; // easy builds slowly
  // the next planned kind this game allows (tutorial levels allow only some)
  let kind = asked && !LOGI_KINDS.includes(asked) && buildable(s, asked) ? asked : null, counter = false;
  if (!kind) { kind = D.smart && !s.noCounter && s.style[side] === 'steady' ? aiCounter(s, side, may) : null; counter = !!kind; } // (what it has seen of the enemy first: an answer to it — the regular commander, who mixes; the others keep to their arm)
  const base = D.traits && s.style[side] === 'steady' && !s.level ? AI_PLAN_HARD : AI_STYLES[s.style[side]].plan;
  const plan = who ? byTurns(base.filter(may)) : base; // (hard, regular: everything; arms: what of it is this player's — the plan of the difficulty, as one player would, its arms in turn)
  for (let i = 0; i < plan.length && !kind; i++) { const k = plan[((s.plan[pk] || 0) + i) % plan.length]; if (buildable(s, k)) { kind = k; s.plan[pk] = (s.plan[pk] || 0) + i; } } // (a fuel station only where there's fuel; s.logi: the supply buildings apart — aiSupply)
  if (!kind) return;
  const foe = foeOf(side), goal = { x: s.bases[foe].x, y: s.H / 2 };
  const anchors = controlNodes(s, side).filter(n => n.kind === 'hq' || n.kind === 'fhq').sort((a, b) => dist(a, goal) - dist(b, goal));
  for (const a of anchors) for (let i = 0; i < 24; i++) {
    // (toward the enemy first; then all round it, a little farther — a crowded front left no room, and it stood stuck)
    const wide = i >= 12, ang = Math.atan2(goal.y - a.y, goal.x - a.x) + (s.rand() - 0.5) * (wide ? 2 * Math.PI : 2.4), r = roomOf(s, a.kind) + roomOf(s, kind) + 5 + s.rand() * (wide ? 180 : 110);
    const x = a.x + Math.cos(ang) * r, y = a.y + Math.sin(ang) * r;
    if (build(s, side, kind, x, y)) { if (kind === asked) { delete s.askMake[pk]; s.lastBuild[pk] = s.t; return; } if (counter) { s.aiCounter[side] = { kind, t: s.t }; (s.aiCounterLog = s.aiCounterLog || []).push({ side, kind, t: Math.round(s.t) }); } else s.plan[pk] = (s.plan[pk] || 0) + 1; s.lastBuild[pk] = s.t; (s.planMiss = s.planMiss || {})[side] = 0; return; }
  }
  // (no room for it — a big one, a crowded base: after a few tries the next one; it stood stuck on an airfield)
  if (!anchors.length) return; // (nowhere to build from yet: not a miss)
  if (counter) { s.aiCounter[side] = { kind, t: s.t }; return; } // (no room for the answer: the plan, and try it again later)
  s.planMiss = s.planMiss || {}; s.planMiss[pk] = (s.planMiss[pk] || 0) + 1;
  if (s.planMiss[pk] >= 3) { s.planMiss[pk] = 0; s.plan[pk] = (s.plan[pk] || 0) + 1; }
}

// what this game lets a side build of kind (tutorial levels: only some; fuel only where there's fuel; s.logi: the supply
// buildings apart — aiSupply)
const buildable = (s, k) => (!s.builds || s.builds.includes(k)) && (k !== 'fuelst' || s.fuel) && (!STRUCTS[k].fuel || s.fuel) && !(s.logi && LOGI_KINDS.includes(k));
// building by what it sees (normal and hard; no cheating — only what it has made out, by type, over the last
// AI_SEEN_T s): for each kind of enemy force (AI_THREATS) how many it has seen against how many of ours answer it; the
// worst gap past AI_COUNTER_MIN units, and our answer under AI_COUNTER_K of theirs — one of its answering buildings
// (in turn), at most every AI_COUNTER_EVERY s; between them, the plan
function aiCounter(s, side, may = () => true) {
  s.aiCounter = s.aiCounter || {}; s.aiSeen = s.aiSeen || {};
  const seen = s.aiSeen[side] = s.aiSeen[side] || {}, last = s.aiCounter[side];
  for (const q of s.squads) if (q.side !== side && !q.dead) { const k = intel(s, side, q); if (k && k.lvl === 2 && k.type) seen[q.id] = { type: k.type, n: k.n || 1, t: s.t }; }
  if (last && s.t - last.t < AI_COUNTER_EVERY) return null;
  const theirs = {}, ours = {};
  for (const id in seen) { const m = seen[id]; if (s.t - m.t > AI_SEEN_T) { delete seen[id]; continue; } for (const c in AI_THREATS) if (AI_THREATS[c].is.includes(m.type)) theirs[c] = (theirs[c] || 0) + m.n; }
  for (const u of s.units) if (u.side === side) for (const c in AI_THREATS) if (AI_THREATS[c].by.includes(u.type)) ours[c] = (ours[c] || 0) + 1;
  let worst = null, gap = 0;
  for (const c in theirs) { const g = theirs[c] - (ours[c] || 0) / AI_COUNTER_K; if (theirs[c] >= AI_COUNTER_MIN && g > gap) { gap = g; worst = c; } }
  if (!worst) return null;
  const opts = AI_THREATS[worst].build.filter(k => may(k) && buildable(s, k) && (!STRUCTS[k].max || alive(s, side, [k]).length < STRUCTS[k].max));
  if (!opts.length) return null;
  const n = (s.aiCounterN = s.aiCounterN || {})[side + worst] = ((s.aiCounterN[side + worst] || 0) + 1);
  return opts[n % opts.length];
}
// the supply buildings (s.logi; past the allowance): one of each as soon as there's an HQ — a water building on a lake's
// bank in our control — then a second of each after AI_SUPPLY2 s
function aiSupply(s, side, asked) {
  if (s.t - (s.aiSupAt && s.aiSupAt[side] || -99) < 10) return;
  (s.aiSupAt = s.aiSupAt || {})[side] = s.t;
  const hq = hqOf(s, side); if (!hq || s.t < hq.ready) return;
  for (const kind of ['waterst', 'depot', 'fuelst']) {
    const want = Math.min(STRUCTS[kind].max || 2, (s.t - hq.ready > AI_SUPPLY2 ? 2 : 1) + (kind === asked ? 1 : 0)); // (asked for and none to send: one more)
    if (alive(s, side, [kind]).length >= want || (s.builds && !s.builds.includes(kind))) continue;
    const done = () => { if (kind === asked && s.askMake) for (const k in s.askMake) if (s.askMake[k] === kind && k.startsWith(side)) delete s.askMake[k]; };
    if (kind === 'waterst') for (const p of shoreSpots(s, hq, STRUCTS.waterst.r).slice(0, 30)) if (build(s, side, kind, p.x, p.y)) return done(); // (a lake's bank first; none in reach — a well by the HQ, as the rest)
    for (let i = 0; i < 12; i++) { const a = s.rand() * Math.PI * 2, r = roomOf(s, 'hq') + roomOf(s, kind) + 5 + s.rand() * 90; if (build(s, side, kind, hq.x + Math.cos(a) * r, hq.y + Math.sin(a) * r)) return done(); }
  }
}
// forward HQ on a hill (DESIGN.md §6): a hill just past the edge of our control, clear of known enemies and
// short of the enemy HQ; the nearest fit jeep/tank squad goes there (the rest of think leaves it alone) and sets up
function aiForward(s, side, mine, setOrder) {
  const job = s.aiFhq[side], sq = job && s.squads.find(q => q.id === job.sq);
  if (job) {
    if (!sq || sq.dead || sq.retreating || s.t > job.until) s.aiFhq[side] = null;
    else if (sq.arrived && !pending(s, sq.id, 'order') && buildFhq(s, sq.id)) s.aiFhq[side] = null;
    return;
  }
  if (s.cd[side].fhq > 0 || fhqCount(s, side) >= fhqMax(s)) return;
  const nodes = controlNodes(s, side).filter(n => n.kind === 'hq' || n.kind === 'fhq'), foe = s.bases[foeOf(side)];
  const hills = s.hills.filter(h => quality(s, side, h, true) < BUILD_MIN_Q && Math.abs(h.x - foe.x) > NODES.hq.r1 &&
    nodes.some(n => dist(n, h) < nodeSpec(n.kind).r1 + AI_FHQ_REACH) && !threatAt(s, side, h, AI_NEAR));
  let best = null, bs = Infinity;
  for (const q of mine) if (fhqBuilders(s).includes(q.type) && q.strength >= AI_READY && !(q.type === 'dozer' && (jobOf(s, q) || q.hqAt))) for (const h of hills) {
    const sc = dist({ x: q.cx, y: q.cy }, h) + 0.5 * Math.abs(h.x - foe.x);
    if (sc < bs) { bs = sc; best = { sq: q.id, hill: h }; }
  }
  if (!best) return;
  // (with support: a site on that bulldozer's list; it gets there on its own)
  if (s.dozers) { planFhq(s, best.sq, best.hill.x, best.hill.y); return; }
  s.aiFhq[side] = { ...best, until: s.t + AI_FHQ_TRIP };
  const h = best.hill; setOrder(s.squads.find(q => q.id === best.sq), 'hold', h.x, h.y);
}

// where a supply truck goes (s.logi): AI_TRUCK_BACK behind one of our squads — first one short of what it carries
// (under AI_NEED, the neediest), else the k-th furthest forward (k: this truck among those of its kind)
function truckStation(s, sq, mine, k) {
  const C = CARGO[sq.type], home = homeOf(s, sq), foe = s.bases[foeOf(sq.side)];
  const front = mine.filter(q => !TYPES[q.type].care && !TYPES[q.type].air && s.units.some(u => u.squad === q.id && C.who(u)));
  if (!front.length) return careStation(s, sq, mine);
  const want = q => { const m = s.units.filter(u => u.squad === q.id && C.who(u)); return m.reduce((a, u) => a + (u[C.key] ?? 1), 0) / (m.length || 1); };
  const needy = front.map(q => ({ q, w: want(q) })).filter(o => o.w < AI_NEED).sort((a, b) => a.w - b.w);
  front.sort((a, b) => Math.abs(a.cx - foe.x) - Math.abs(b.cx - foe.x));
  const q = needy.length ? needy[k % needy.length].q : front[k % front.length], c = { x: q.cx, y: q.cy }, d = dist(c, home) || 1, back = Math.min(d, AI_TRUCK_BACK), G = 40;
  return { x: Math.round((c.x + (home.x - c.x) / d * back) / G) * G, y: Math.round((c.y + (home.y - c.y) / d * back) / G) * G };
}
// a squad's supply leash (s.logi): what keeps it going — fuel for vehicles, water for soldiers — comes from a loaded
// truck or an HQ / forward HQ; null = nothing needed
function leashFrom(s, sq) {
  const T = TYPES[sq.type], kind = needsWater(sq.type) ? 'watertruck' : needsFuel(sq.type) && !T.air ? 'fueltruck' : null;
  if (!kind) return null;
  const c = { x: sq.cx, y: sq.cy }, out = s.nodes.filter(n => n.side === sq.side && n.hp > 0 && s.t >= n.ready && (n.kind === 'hq' || n.kind === 'fhq' || (kind === 'watertruck' && n.kind === 'waterst')));
  for (const u of s.units) if (u.type === kind && u.side === sq.side && u.hp > 0 && u.load > 0.5 && !u.refill) out.push(u);
  return out.sort((a, b) => dist(a, c) - dist(b, c));
}
// how short of it the squad is (0–1, the mean of its units)
function shortOf(s, sq) {
  const key = needsWater(sq.type) ? 'water' : 'fuel', m = s.units.filter(u => u.squad === sq.id);
  return m.reduce((a, u) => a + (u[key] ?? 1), 0) / (m.length || 1);
}
// where a tanker circles: its place over the middle (or nearer home, enemy AA known about there)
function tankerStation(s, sq, foes) {
  const p = tankerSpot(s, sq.side), h = hqOf(s, sq.side) || s.bases[sq.side];
  if (!foes.some(({ k }) => (k.type === 'aa' || k.type === 'ajeep') && Math.hypot(k.x - p.x, k.y - p.y) < 220)) return p;
  return { x: Math.round((p.x + h.x) / 2), y: p.y };
}
// the knockout blow (see AI_PUSH_*): where every fighting squad goes now — the gathering spot, then the enemy HQ as
// far as we know it; null = no blow under way (each squad its own target). Only on the big maps: on the small one the
// games end anyway, and with the blow fewer of them did (the side ahead lost it)
function aiPush(s, side, fighters, structs, St) {
  const P = (s.aiPush = s.aiPush || {})[side] = (s.aiPush[side] || { phase: null, rest: 0 });
  const sh = share(s, side), ground = fighters.filter(q => !TYPES[q.type].air);
  const stop = () => { P.phase = null; P.rest = s.t + AI_PUSH_REST; return null; };
  if (P.phase && (sh < AI_PUSH_STOP || ground.length < 2)) return stop();
  if (!P.phase) {
    if (St.home || s.level || s.H <= H || s.t < P.rest || sh < AI_PUSH_SHARE || ground.length < AI_PUSH_MIN) return null;
    const G = 40, n = ground.length;
    P.at = { x: Math.round(ground.reduce((a, q) => a + q.cx, 0) / n / G) * G, y: Math.round(ground.reduce((a, q) => a + q.cy, 0) / n / G) * G };
    P.phase = 'gather'; P.t0 = s.t;
  }
  if (P.phase === 'gather') {
    const inn = ground.filter(q => dist({ x: q.cx, y: q.cy }, P.at) < AI_PUSH_R).length;
    if (inn < AI_PUSH_IN * ground.length && s.t - P.t0 < AI_PUSH_GATHER) return P.at;
    P.phase = 'strike'; P.t1 = s.t;
  }
  const hq = structs.find(n => n.kind === 'hq');
  if (!hq || s.t - P.t1 > AI_PUSH_T) return stop();
  return { x: Math.round(hq.x / 20) * 20, y: Math.round(hq.y / 20) * 20 };
}
// commando raids (hard, and the commando commander): each transport helicopter takes the commandos at home on board
// (AI_RAID_MIN, or what's there after AI_RAID_WAIT s), flies them to AI_RAID_BEHIND past an enemy building it knows of —
// the far side, from home — and sets them down; from there they go for the buildings (think). Returns the squads busy
// with it (think leaves them be)
function aiLift(s, side, mine, structs) {
  const busy = new Set(), home = hqOf(s, side) || s.bases[side];
  const known = structs.filter(n => n.id !== 'hq?');
  for (const lq of mine) {
    if (lq.type !== 'lift') continue;
    const L = s.units.find(u => u.squad === lq.id); if (!L) continue;
    let n = (L.cargo || []).length;
    // (boarding AI_RAID_BOARD s and some aren't on — one stuck far off: off with those that are; none — called off)
    const late = lq.boardAt != null && s.t - lq.boardAt > AI_RAID_BOARD;
    if (late) { lq.boardAt = null; for (const q of s.squads) if (q.boarding === L.id) q.boarding = null; }
    if (n && !lq.drop && (late || !s.squads.some(q => q.boarding === L.id))) {
      // (loaded: the HQ if we know it, else the nearest building we do)
      const tg = known.find(k => k.kind === 'hq') || known.sort((a, b) => dist(a, L) - dist(b, L))[0];
      if (tg) { const d = dist(tg, home) || 1, R = (STRUCTS[tg.kind] ? STRUCTS[tg.kind].r : 30) + AI_RAID_BEHIND; unload(s, lq.id, tg.x + (tg.x - home.x) / d * R, tg.y + (tg.y - home.y) / d * R); }
    }
    if (lq.drop) lq.boardAt = null;
    if (n || lq.drop) { busy.add(lq.id); for (const q of s.squads) if (q.boarding === L.id) busy.add(q.id); continue; }
    // (empty: the commandos at home, not out on a raid already, get on)
    const waiting = mine.filter(q => q.type === 'commando' && !q.aboard && s.units.some(u => u.squad === q.id) && s.units.every(u => u.squad !== q.id || dist(u, home) < 500)); // (all of it home: not out on a raid)
    const boarding = waiting.filter(q => q.boarding === L.id);
    if (boarding.length) { busy.add(lq.id); for (const q of boarding) busy.add(q.id); continue; }
    const men = waiting.reduce((a, q) => a + s.units.filter(u => u.squad === q.id).length, 0);
    lq.raidAt = lq.raidAt ?? s.t;
    if (men && known.length && (men >= AI_RAID_MIN || s.t - lq.raidAt > AI_RAID_WAIT)) {
      board(s, waiting.map(q => q.id), lq.id); lq.raidAt = s.t; lq.boardAt = s.t;
      for (const q of waiting) busy.add(q.id); busy.add(lq.id);
    }
  }
  return busy;
}
// where a medic / mechanic squad waits: a little behind the squads it treats (or all of ours), toward home;
// on a coarse grid so the order isn't resent for every step they take
function careStation(s, sq, mine) {
  const home = homeOf(s, sq);
  let list = mine.filter(q => CARER[q.type] === sq.type && q.type !== sq.type);
  if (!list.length) list = mine.filter(q => !TYPES[q.type].care && !TYPES[q.type].air);
  if (!list.length) return home;
  const c = { x: list.reduce((a, q) => a + q.cx, 0) / list.length, y: list.reduce((a, q) => a + q.cy, 0) / list.length };
  const d = dist(c, home) || 1, back = Math.min(d, 110), G = 40;
  return { x: Math.round((c.x + (home.x - c.x) / d * back) / G) * G, y: Math.round((c.y + (home.y - c.y) / d * back) / G) * G };
}
// where a signals truck goes: a little behind one of our leading squads (the k-th truck behind the k-th furthest
// forward), so it sees far ahead and gives control out there; back to the middle of our squads if enemies are close
function radioStation(s, sq, mine, k, B = AI_RADIO_BACK) {
  const foe = s.bases[foeOf(sq.side)], home = homeOf(s, sq);
  const front = mine.filter(q => !TYPES[q.type].care && !TYPES[q.type].air).sort((a, b) => Math.abs(a.cx - foe.x) - Math.abs(b.cx - foe.x));
  if (!front.length) return careStation(s, sq, mine);
  const q = front[k % front.length], c = { x: q.cx, y: q.cy }, d = dist(c, home) || 1, back = Math.min(d, B), G = 40;
  const p = { x: Math.round((c.x + (home.x - c.x) / d * back) / G) * G, y: Math.round((c.y + (home.y - c.y) / d * back) / G) * G };
  return threatAt(s, sq.side, p, AI_NEAR) ? careStation(s, sq, mine) : p;
}
// a signals truck (unless asked somewhere — asks.js): where most of the side's fighting units are — the k-th truck
// at the k-th crowd, AI_CROWD_SEP from the others' — AI_RADIO_BACK back from it toward home; with none, as before
function crowdStation(s, sq, team, k) {
  const ids = new Set(team.filter(q => !TYPES[q.type].care && !TYPES[q.type].air).map(q => q.id)), C = AI_CROWD_CELL, cells = new Map();
  for (const u of s.units) if (u.hp > 0 && ids.has(u.squad)) { const key = Math.floor(u.x / C) * 4096 + Math.floor(u.y / C); let c = cells.get(key); if (!c) cells.set(key, c = { n: 0, x: 0, y: 0, i: Math.floor(u.x / C), j: Math.floor(u.y / C) }); c.n++; c.x += u.x; c.y += u.y; }
  if (!cells.size) return radioStation(s, sq, team, k);
  // (each cell with the 8 round it: the crowd there, and its middle)
  const spots = [...cells.values()].map(c => { let n = 0, x = 0, y = 0; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const o = cells.get((c.i + di) * 4096 + c.j + dj); if (o) { n += o.n; x += o.x; y += o.y; } } return { n, x: x / n, y: y / n }; }).sort((a, b) => b.n - a.n);
  const picked = [];
  for (const p of spots) if (picked.every(o => dist(o, p) >= AI_CROWD_SEP)) picked.push(p);
  const c = picked[k % picked.length], home = homeOf(s, sq), d = dist(c, home) || 1, back = Math.min(d, AI_RADIO_BACK), G = 40;
  const p = { x: Math.round((c.x + (home.x - c.x) / d * back) / G) * G, y: Math.round((c.y + (home.y - c.y) / d * back) / G) * G };
  return threatAt(s, sq.side, p, AI_NEAR) ? careStation(s, sq, team) : p;
}

// missiles: each truck not yet launching goes for the nearest building we know (never the HQ — knownFoeNode); and
// Trophy on the tanks, a few minutes in
function aiSpecial(s, side, own = () => true) {
  for (const q of s.squads) {
    if (q.side !== side || q.dead || q.type !== 'ssm' || q.fire || !own(q)) continue;
    const t = knownFoeNode(s, side, q.cx, q.cy, Infinity);
    if (t) launch(s, [q.id], t.x, t.y);
  }
  if (s.t > 360 && !(s.trophy && s.trophy[side]) && own({ side, type: 'tank' })) for (const n of s.nodes) if (n.side === side && n.kind === 'tankshop' && s.t >= n.ready && !n.upg) { upgrade(s, side, n.id); break; }
}
// who (arms, s.arms — DESIGN.md): 'mate' — the computer partner, only the arms the player hasn't; 'me' — only the
// player's (a bot in their place, tests); none — the whole side
function think(s, side, level, who) {
  const D = DIFFS[level] || DIFFS.normal, foe = foeOf(side), taken = new Map();
  const own = q => !who || (q.cmd ? who === 'me' : (armSide(s, side, q.type) || 'me') === who);
  // open field: first the HQ — a spot in our strip (away from the middle of it now and then), the command tanks go
  const cmd = s.hqPending && s.hqPending[side] && cmdSquad(s, side);
  if (cmd && who !== 'mate' && !s.squads.some(q => q.side === side && q.hqAt) && !s.nodes.some(n => n.side === side && n.kind === 'hq')) {
    const [a, b] = hqBand(s, side);
    for (let i = 0; i < 30; i++) if (planHq(s, side, a + s.rand() * (b - a), 60 + s.rand() * (s.H - 120))) break;
  }
  const mine = s.squads.filter(q => q.side === side && !q.dead && !q.retreating && !(q.cmd && s.hqPending && s.hqPending[side]) && own(q));
  // (arms: the whole side's squads — the support (signals trucks, guns, supply trucks) stands behind the partner's
  // front too: a partner in air and artillery has no ground squads of its own, and its guns and trucks stayed home)
  const team = who ? s.squads.filter(q => q.side === side && !q.dead && !q.retreating && !(q.cmd && s.hqPending && s.hqPending[side])) : mine;
  const setOrder = (sq, type, x, y) => {
    // compare with what was asked, not where the commander understood it (that would resend every time)
    const p = pending(s, sq.id, 'order'), cur = p || sq.order, w = cur.want || cur, k = sq.aiAsk;
    if (w.x === x && w.y === y && cur.type === type) return;
    // (a target in a lake is moved to the shore: compare with what the AI itself last asked, too)
    if (k && k.x === x && k.y === y && k.type === type && cur.type === type) return;
    sq.aiAsk = { type, x, y };
    order(s, sq.id, type, x, y, true);
  };
  // what the AI may do: tutorial levels hold the enemy (red) back; the full game allows everything
  const can = s.aiCan && side === 'red' ? s.aiCan : { build: true, drone: true, fhq: true };
  if (can.build) aiBuild(s, side, D, who);
  if (D.smart && can.fhq) aiForward(s, side, mine, setOrder);
  const structs = knownStructs(s, side);
  const foes = s.squads.filter(q => q.side === foe).map(q => ({ q, k: intel(s, side, q) })).filter(o => o.k);
  // the commander: missiles keep a few squads home
  // (missiles: shot down too often — Arrow over there — it plays steady from now on)
  if (AI_STYLES[s.style[side]] && AI_STYLES[s.style[side]].missiles && s.downed && s.downed[side] >= AI_MISSILE_MISS) s.style[side] = 'steady';
  const St = AI_STYLES[s.style[side]] || AI_STYLES.steady, home = hqOf(s, side) || s.bases[side];
  const fighters = mine.filter(q => !TYPES[q.type].care);
  const stayHome = !!St.home; // (missiles: a few squads keep home)
  if (can.build) aiSpecial(s, side, own);
  const push = D.smart && !s.noAiPush && aiPush(s, side, fighters, structs, St); // (ahead: all together, one blow — not on easy)
  // posts: a squad of soldiers to each one we don't hold (they go on their own; the rest of think leaves them be)
  const toPost = stayHome ? new Set() : aiPosts(s, side, mine, setOrder); // (staying home: no soldiers off to the posts)
  const raid = (D.traits || St.raids) && can.build ? aiLift(s, side, mine, structs) : new Set(); // (commando raids by helicopter)
  let nth = 0, radios = 0, arty = 0; const trucks = {};
  const asked = askBusy(s, side); // (arms: sent to answer a partner's ask — on it for a while — asks.js)
  if (who === 'mate') mateAsks(s, side, mine, foes);
  for (const sq of mine) {
    if (toPost.has(sq.id) || asked.has(sq.id)) continue;
    if (sq.type === 'ssm' && sq.fire) continue; // (setting up to launch: it stays put)
    if (raid.has(sq.id) || sq.boarding || sq.aboard) continue; // (a raid: the helicopter and its commandos — aiLift)
    if (s.aiFhq[side] && s.aiFhq[side].sq === sq.id) continue; // on its way to set up a forward HQ
    // support: bulldozers go where their sites are (on their own); signals trucks stay a little behind the squads
    if (TYPES[sq.type].support) { if (sq.type === 'radio') { const p = crowdStation(s, sq, team, radios++); setOrder(sq, 'hold', p.x, p.y); } continue; }
    if (sq.type === 'lift') { const h = homeOf(s, sq), off = (h.kind && STRUCTS[h.kind] ? STRUCTS[h.kind].r : 50) + 45; setOrder(sq, 'hold', Math.round(h.x), Math.round(h.y + (h.y < s.H / 2 ? off : -off))); continue; } // (a transport helicopter not on a raid: waits at home, beside its pad / the HQ, toward the middle — over it, the commandos couldn't reach it — aiLift)
    if (sq.type === 'tanker') { const p = tankerStation(s, sq, foes); setOrder(sq, 'hold', p.x, p.y); continue; }
    if (s.logi && CARGO[sq.type] && !s.noAiSupply) { const k = trucks[sq.type] = (trucks[sq.type] || 0) + 1, p = truckStation(s, sq, team, k - 1); setOrder(sq, 'hold', p.x, p.y); continue; }
    if (TYPES[sq.type].arty) { const p = radioStation(s, sq, team, arty++, ARTY_BACK); setOrder(sq, 'hold', p.x, p.y); continue; } // (artillery: behind the leading squads — it fires over them on its own, artyTick)
    if (TYPES[sq.type].care) { const p = careStation(s, sq, mine); setOrder(sq, 'hold', p.x, p.y); continue; }
    const c = { x: sq.cx, y: sq.cy }, fighting = s.t - sq.lastContact < CONTACT_MEMORY;
    // worn down and not in a fight: go home to heal and refill before the next push (not on easy)
    if (D.smart && sq.strength < St.ready && !fighting) { const h = homeOf(s, sq); setOrder(sq, 'hold', h.x, h.y); continue; }
    if (push) { setOrder(sq, 'attack', push.x, push.y); if (D.mass && friction(s)) silence(s, sq.id, dist(c, push) > AI_SILENT_R, true); continue; } // (the blow: gathering, then the enemy HQ)
    const cands = [], seen = new Set();
    for (const { q, k } of foes) {
      if (!canHit(sq, k)) continue; // can't hurt it (aircraft for everyone but AA), as far as we can tell
      // (one target for those close together: the player's units are singles — hundreds of targets, each weighed
      // against all the rest)
      const key = Math.floor(k.x / AI_CLUSTER) * 4096 + Math.floor(k.y / AI_CLUSTER); if (seen.has(key)) continue; seen.add(key);
      if (sq.type === 'commando') continue; // (commandos: buildings only — their charges)
      cands.push({ x: k.x, y: k.y, w: D.traits && CARGO[k.type] ? -AI_HUNT_W : 0, edge: true }); // (hard: the supply trucks first — no fuel, water or shells, the rest stands)
    }
    // structures: production and forward HQs matter most; aircraft go for them when there's nothing better
    if (!(MULT[sq.type].air > 0) || TYPES[sq.type].hover) for (const n of structs) cands.push({ x: n.x, y: n.y, w: n.kind === 'hq' ? 120 : n.kind === 'fhq' ? -60 : -30 });
    // staying home: only what comes close; else a guard spot a little out from the HQ, toward the enemy
    if (stayHome) {
      for (let i = cands.length - 1; i >= 0; i--) if (dist(cands[i], home) > AI_HOME_R) cands.splice(i, 1);
      if (!cands.length) { const g = s.bases[foe], d = dist(g, home) || 1; setOrder(sq, 'hold', Math.round(home.x + (g.x - home.x) / d * 160), Math.round(home.y + (g.y - home.y) / d * 160 + (nth++ % 3 - 1) * 70)); continue; }
    }
    if (!cands.length) continue;
    const score = p => {
      // massing on one target where control is poor means shooting each other (friendly fire): spread out there
      const mass = D.mass && (!friction(s) || quality(s, side, p) >= FF_MASS_Q);
      let sc = dist(c, p) + p.w + (mass ? -150 : 200) * (taken.get(p.x + ',' + p.y) || 0);
      if (D.smart && p.edge) sc -= 60 * edgeAt(s, sq, p, foes);
      if (D.smart && TYPES[sq.type].air) for (const { q, k } of foes) if (k.type === 'aa' && Math.hypot(k.x - p.x, k.y - p.y) < 150) sc += 300 * k.strength;
      return sc;
    };
    let best = null, bs = Infinity;
    for (const p of cands) { const sc = score(p); if (sc < bs) { bs = sc; best = p; } }
    // don't flip-flop between two targets that score about the same
    const aim = sq.order.want || sq.order, cur = D.smart && cands.find(p => Math.hypot(p.x - aim.x, p.y - aim.y) < 40);
    if (cur && cur !== best && score(cur) < bs + AI_KEEP) best = cur;
    taken.set(best.x + ',' + best.y, (taken.get(best.x + ',' + best.y) || 0) + 1);
    // supply (s.logi): short of fuel / water and no truck by it — it waits where it is for one; else no more than
    // AI_HOP past the nearest that keeps it going
    const from = s.logi && !s.noAiSupply && leashFrom(s, sq);
    if (from && from.length) {
      const f = from[0], df = dist(f, c);
      if (shortOf(s, sq) < AI_NEED && df > TRUCK_R && !fighting) { setOrder(sq, 'hold', Math.round(c.x / 40) * 40, Math.round(c.y / 40) * 40); continue; }
      const db = dist(f, best);
      if (db > AI_HOP) { const k = AI_HOP / db; best = { x: Math.round((f.x + (best.x - f.x) * k) / 40) * 40, y: Math.round((f.y + (best.y - f.y) * k) / 40) * 40 }; }
    }
    setOrder(sq, 'attack', best.x, best.y);
    // hard: a squad going far keeps radio silence on the way; near home it talks
    if (D.mass && friction(s)) silence(s, sq.id, dist(c, best) > AI_SILENT_R, true);
  }
  // posture (hard): press when losing, play safe when winning
  if (D.traits) {
    const sh = share(s, side), tr = sh < 0.4 ? 'aggressive' : sh > 0.6 ? 'cautious' : 'balanced';
    for (const sq of s.squads) if (sq.side === side && sq.trait !== tr && own(sq)) setTrait(s, sq.id, tr, true);
  }
  // drones: first on a fresh track we can't make out, else where we know least — an unexplored spot on the enemy's side
  // (one drone per think, never where one of ours already looks)
  const hand = D.smart && can.drone && s.fog && s.drones[side].stock > 0 && own({ side, type: 'drone' });
  const free = (x, y) => !s.nodes.some(n => n.side === side && n.kind === 'drone' && Math.hypot(n.x - x, n.y - y) < NODES.drone.r0 * 1.5);
  const blur = hand && foes.find(o => o.k.lvl < 2 && s.t - o.k.t < 5 && free(o.k.x, o.k.y));
  if (blur) drone(s, side, blur.k.x, blur.k.y);
  else if (hand) {
    const x = s.bases[foe].x + (s.bases[side].x - s.bases[foe].x) * (0.2 + 0.4 * s.rand()), y = 60 + s.rand() * (s.H - 120);
    if (free(x, y) && !structs.some(n => n.id !== 'hq?' && Math.hypot(n.x - x, n.y - y) < NODES.drone.r0)) drone(s, side, x, y);
  }
  // no hill for it: a builder that reached its target, far from our other control nodes, sets one up there
  if (D.smart && can.fhq && s.cd[side].fhq <= 0 && !s.aiFhq[side]) {
    const b = mine.find(q => fhqBuilders(s).includes(q.type) && q.arrived && !pending(s, q.id, 'order') &&
      controlNodes(s, side).every(n => dist(n, { x: q.cx, y: q.cy }) > NODES.fhq.r1));
    if (b) buildFhq(s, b.id);
  }
  return D.every;
}
