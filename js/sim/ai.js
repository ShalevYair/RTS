// Sim: the AI (plays by the same fog, message and building rules). think(s, side, level) drives one side;
// the enemy uses it, and the Node tests also let it play blue.

const foeOf = side => side === 'blue' ? 'red' : 'blue';
// how much enemy force sits near p, weighed by how this squad fares against it.
// > 0: the squad has the upper hand there; < 0: it would be countered.
function edgeAt(s, sq, p) {
  let e = 0;
  for (const q of s.squads) {
    const k = q.side !== sq.side && intel(s, sq.side, q);
    if (!k || !k.type || Math.hypot(k.x - p.x, k.y - p.y) > AI_NEAR) continue; // unidentified: can't weigh it
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
function aiBuild(s, side, D) {
  if (D.mass && !s.level && s.fog && !alive(s, side, ['decoy']).length) {
    const f = alive(s, side, ['fhq']).find(n => s.t >= n.ready), foe = s.bases[foeOf(side)];
    if (f) for (let i = 0; i < 8; i++) { const a = Math.atan2(foe.y - f.y, foe.x - f.x) + (s.rand() - 0.5) * 2, r = 60 + s.rand() * 50; if (build(s, side, 'decoy', f.x + Math.cos(a) * r, f.y + Math.sin(a) * r)) break; }
  }
  if (buildCount(s, side) >= buildLimit(s, side)) return;
  if (!D.smart && s.t - (s.lastBuild[side] || -99) < 30) return; // easy builds slowly
  // the next planned kind this game allows (tutorial levels allow only some)
  let kind = null;
  const plan = AI_STYLES[s.style[side]].plan;
  for (let i = 0; i < plan.length && !kind; i++) { const k = plan[(s.plan[side] + i) % plan.length]; if (!s.builds || s.builds.includes(k)) { kind = k; s.plan[side] += i; } }
  if (!kind) return;
  const foe = foeOf(side), goal = { x: s.bases[foe].x, y: s.H / 2 };
  const anchors = controlNodes(s, side).filter(n => n.kind === 'hq' || n.kind === 'fhq').sort((a, b) => dist(a, goal) - dist(b, goal));
  for (const a of anchors) for (let i = 0; i < 12; i++) {
    const ang = Math.atan2(goal.y - a.y, goal.x - a.x) + (s.rand() - 0.5) * 2.4, r = 55 + s.rand() * 110;
    const x = a.x + Math.cos(ang) * r, y = a.y + Math.sin(ang) * r;
    if (build(s, side, kind, x, y)) { s.plan[side]++; s.lastBuild[side] = s.t; return; }
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
  s.aiFhq[side] = { ...best, until: s.t + AI_FHQ_TRIP };
  const h = best.hill; setOrder(s.squads.find(q => q.id === best.sq), 'hold', h.x, h.y);
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

function think(s, side, level) {
  const D = DIFFS[level] || DIFFS.normal, foe = foeOf(side), taken = new Map();
  // open field: first the HQ — a spot in our strip (away from the middle of it now and then), the command tanks go
  const cmd = s.hqPending && s.hqPending[side] && cmdSquad(s, side);
  if (cmd && !s.squads.some(q => q.side === side && q.hqAt) && !s.nodes.some(n => n.side === side && n.kind === 'hq')) {
    const [a, b] = hqBand(s, side);
    for (let i = 0; i < 30; i++) if (planHq(s, side, a + s.rand() * (b - a), 60 + s.rand() * (s.H - 120))) break;
  }
  const mine = s.squads.filter(q => q.side === side && !q.dead && !q.retreating && !(q.cmd && s.hqPending && s.hqPending[side]));
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
  if (can.build) aiBuild(s, side, D);
  if (D.smart && can.fhq) aiForward(s, side, mine, setOrder);
  const structs = knownStructs(s, side);
  const foes = s.squads.filter(q => q.side === foe).map(q => ({ q, k: intel(s, side, q) })).filter(o => o.k);
  // style: the turtle stays home until it has enough squads (or the upper hand); the flanker goes round by an edge
  const St = AI_STYLES[s.style[side]] || AI_STYLES.steady, home = hqOf(s, side) || s.bases[side];
  const fighters = mine.filter(q => !TYPES[q.type].care);
  const stayHome = St.wait && s.t < 300 && !(fighters.length >= St.wait && s.t > 150) && share(s, side) < 0.55; // (never past 5 minutes)
  let nth = 0;
  for (const sq of mine) {
    if (s.aiFhq[side] && s.aiFhq[side].sq === sq.id) continue; // on its way to set up a forward HQ
    // support: bulldozers go where their sites are (on their own); signals trucks stay a little behind the squads
    if (TYPES[sq.type].support) { if (sq.type === 'radio') { const p = careStation(s, sq, mine); setOrder(sq, 'hold', p.x, p.y); } continue; }
    if (TYPES[sq.type].care) { const p = careStation(s, sq, mine); setOrder(sq, 'hold', p.x, p.y); continue; }
    const c = { x: sq.cx, y: sq.cy }, fighting = s.t - sq.lastContact < CONTACT_MEMORY;
    // worn down and not in a fight: go home to heal and refill before the next push (not on easy)
    if (D.smart && sq.strength < St.ready && !fighting) { const h = homeOf(s, sq); setOrder(sq, 'hold', h.x, h.y); continue; }
    const cands = [];
    for (const { q, k } of foes) {
      if (!canHit(sq, k)) continue; // can't hurt it (aircraft for everyone but AA), as far as we can tell
      cands.push({ x: k.x, y: k.y, w: 0, edge: true });
    }
    // structures: production and forward HQs matter most; aircraft go for them when there's nothing better
    if (!(MULT[sq.type].air > 0)) for (const n of structs) cands.push({ x: n.x, y: n.y, w: n.kind === 'hq' ? 120 : n.kind === 'fhq' ? -60 : -30 });
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
      if (D.smart && p.edge) sc -= 60 * edgeAt(s, sq, p);
      if (D.smart && sq.type === 'air') for (const { q, k } of foes) if (k.type === 'aa' && Math.hypot(k.x - p.x, k.y - p.y) < 150) sc += 300 * k.strength;
      return sc;
    };
    let best = null, bs = Infinity;
    for (const p of cands) { const sc = score(p); if (sc < bs) { bs = sc; best = p; } }
    // don't flip-flop between two targets that score about the same
    const aim = sq.order.want || sq.order, cur = D.smart && cands.find(p => Math.hypot(p.x - aim.x, p.y - aim.y) < 40);
    if (cur && cur !== best && score(cur) < bs + AI_KEEP) best = cur;
    taken.set(best.x + ',' + best.y, (taken.get(best.x + ',' + best.y) || 0) + 1);
    // flanking: a far target is reached by way of a point near the top or bottom edge (squads take turns), halfway there
    if (St.flank && !TYPES[sq.type].air && dist(c, best) > AI_FLANK_R) {
      const key = Math.round(best.x / 50) + ',' + Math.round(best.y / 50);
      if (sq.flankKey !== key) { sq.flankKey = key; sq.flanked = false; sq.flankY = (nth++ % 2 ? 0.12 : 0.88) * s.H; }
      const wp = { x: Math.round((c.x + best.x) / 2), y: Math.round(sq.flankY) };
      if (!sq.flanked && dist(c, wp) < 120) sq.flanked = true;
      if (!sq.flanked) { setOrder(sq, 'attack', wp.x, wp.y); if (D.mass && friction(s)) silence(s, sq.id, true, true); continue; }
    }
    setOrder(sq, 'attack', best.x, best.y);
    // hard: a squad going far (or round a flank) keeps radio silence on the way; near home it talks
    if (D.mass && friction(s)) silence(s, sq.id, dist(c, best) > AI_SILENT_R, true);
  }
  // posture (hard): press when losing, play safe when winning
  if (D.traits) {
    const sh = share(s, side), tr = sh < 0.4 ? 'aggressive' : sh > 0.6 ? 'cautious' : 'balanced';
    for (const sq of s.squads) if (sq.side === side && sq.trait !== tr) setTrait(s, sq.id, tr, true);
  }
  // drones: first on a fresh track we can't make out, else where we know least — an unexplored spot on the enemy's side
  // (one drone per think, never where one of ours already looks)
  const hand = D.smart && can.drone && s.fog && s.drones[side].stock > 0;
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
