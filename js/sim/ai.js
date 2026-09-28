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
const canHit = (sq, k) => k.type ? MULT[sq.type][k.type] > 0 : k.air ? sq.type === 'aa' : true;
// enemy structures this side knows about: seen ones stay remembered (they don't move); the enemy HQ's
// place is known from the start
function knownStructs(s, side) {
  const foe = foeOf(side);
  const list = s.fog ? Object.values(s.memNodes[side]) : s.nodes.filter(n => n.side === foe && n.hp > 0);
  const out = list.filter(n => n.kind !== 'drone');
  if (!out.some(n => n.kind === 'hq') && hqOf(s, foe)) out.push({ id: 'hq?', kind: 'hq', x: s.bases[foe].x, y: s.H / 2 });
  return out;
}

// put a building of the next planned kind near the most forward control node, toward the enemy
function aiBuild(s, side, D) {
  if (buildCount(s, side) >= buildLimit(s, side)) return;
  if (!D.smart && s.t - (s.lastBuild[side] || -99) < 30) return; // easy builds slowly
  // the next planned kind this game allows (tutorial levels allow only some)
  let kind = null;
  for (let i = 0; i < AI_PLAN.length && !kind; i++) { const k = AI_PLAN[(s.plan[side] + i) % AI_PLAN.length]; if (!s.builds || s.builds.includes(k)) { kind = k; s.plan[side] += i; } }
  if (!kind) return;
  const foe = foeOf(side), goal = { x: s.bases[foe].x, y: s.H / 2 };
  const anchors = controlNodes(s, side).filter(n => n.kind !== 'drone').sort((a, b) => dist(a, goal) - dist(b, goal));
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
  if (s.cd[side].fhq > 0) return;
  const nodes = controlNodes(s, side).filter(n => n.kind !== 'drone'), foe = s.bases[foeOf(side)];
  const hills = s.hills.filter(h => quality(s, side, h) < BUILD_MIN_Q && Math.abs(h.x - foe.x) > NODES.hq.r1 &&
    nodes.some(n => dist(n, h) < NODES[n.kind].r1 + AI_FHQ_REACH) && !threatAt(s, side, h, AI_NEAR));
  let best = null, bs = Infinity;
  for (const q of mine) if (FHQ_BUILDERS.includes(q.type) && q.strength >= AI_READY) for (const h of hills) {
    const sc = dist({ x: q.cx, y: q.cy }, h) + 0.5 * Math.abs(h.x - foe.x);
    if (sc < bs) { bs = sc; best = { sq: q.id, hill: h }; }
  }
  if (!best) return;
  s.aiFhq[side] = { ...best, until: s.t + AI_FHQ_TRIP };
  const h = best.hill; setOrder(s.squads.find(q => q.id === best.sq), 'hold', h.x, h.y);
}

function think(s, side, level) {
  const D = DIFFS[level] || DIFFS.normal, foe = foeOf(side), taken = new Map();
  const mine = s.squads.filter(q => q.side === side && !q.dead && !q.retreating);
  const setOrder = (sq, type, x, y) => {
    // compare with what was asked, not where the commander understood it (that would resend every time)
    const p = pending(s, sq.id, 'order'), cur = p || sq.order, w = cur.want || cur;
    if (w.x === x && w.y === y && cur.type === type) return;
    order(s, sq.id, type, x, y, true);
  };
  // what the AI may do: tutorial levels hold the enemy (red) back; the full game allows everything
  const can = s.aiCan && side === 'red' ? s.aiCan : { build: true, drone: true, fhq: true };
  if (can.build) aiBuild(s, side, D);
  if (D.smart && can.fhq) aiForward(s, side, mine, setOrder);
  const structs = knownStructs(s, side);
  const foes = s.squads.filter(q => q.side === foe).map(q => ({ q, k: intel(s, side, q) })).filter(o => o.k);
  for (const sq of mine) {
    if (s.aiFhq[side] && s.aiFhq[side].sq === sq.id) continue; // on its way to set up a forward HQ
    const c = { x: sq.cx, y: sq.cy }, fighting = s.t - sq.lastContact < CONTACT_MEMORY;
    // worn down and not in a fight: go home to heal and refill before the next push (not on easy)
    if (D.smart && sq.strength < AI_READY && !fighting) { const h = homeOf(s, sq); setOrder(sq, 'hold', h.x, h.y); continue; }
    const cands = [];
    for (const { q, k } of foes) {
      if (!canHit(sq, k)) continue; // can't hurt it (aircraft for everyone but AA), as far as we can tell
      cands.push({ x: k.x, y: k.y, w: 0, edge: true });
    }
    // structures: production and forward HQs matter most; aircraft go for them when there's nothing better
    if (sq.type !== 'aa') for (const n of structs) cands.push({ x: n.x, y: n.y, w: n.kind === 'hq' ? 120 : n.kind === 'fhq' ? -60 : -30 });
    if (!cands.length) continue;
    const score = p => {
      // massing on one target where control is poor means shooting each other (friendly fire): spread out there
      const mass = D.mass && (!s.fog || quality(s, side, p) >= FF_MASS_Q);
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
    setOrder(sq, 'attack', best.x, best.y);
  }
  // posture (hard): press when losing, play safe when winning
  if (D.traits) {
    const sh = share(s, side), tr = sh < 0.4 ? 'aggressive' : sh > 0.6 ? 'cautious' : 'balanced';
    for (const sq of s.squads) if (sq.side === side && sq.trait !== tr) setTrait(s, sq.id, tr, true);
  }
  // drones: first on a fresh track we can't make out, else where we know least — an unexplored spot on the enemy's side
  const blur = D.smart && can.drone && s.fog && s.cd[side].drone <= 0 && foes.find(o => o.k.lvl < 2 && s.t - o.k.t < 5);
  if (blur) drone(s, side, blur.k.x, blur.k.y);
  else if (D.smart && can.drone && s.fog && s.cd[side].drone <= 0) {
    const x = s.bases[foe].x + (s.bases[side].x - s.bases[foe].x) * (0.2 + 0.4 * s.rand()), y = 60 + s.rand() * (s.H - 120);
    if (!structs.some(n => n.id !== 'hq?' && Math.hypot(n.x - x, n.y - y) < NODES.drone.r0)) drone(s, side, x, y);
  }
  // no hill for it: a builder that reached its target, far from our other control nodes, sets one up there
  if (D.smart && can.fhq && s.cd[side].fhq <= 0 && !s.aiFhq[side]) {
    const b = mine.find(q => FHQ_BUILDERS.includes(q.type) && q.arrived && !pending(s, q.id, 'order') &&
      controlNodes(s, side).every(n => dist(n, { x: q.cx, y: q.cy }) > NODES.fhq.r1));
    if (b) buildFhq(s, b.id);
  }
  return D.every;
}
