// Sim: the enemy AI (plays by the same fog and message rules)
// how much blue force sits near p, weighed by how the red squad fares against it.
// > 0: the red squad has the upper hand there; < 0: it would be countered.
function edgeAt(s, sq, p) {
  let e = 0;
  for (const q of s.squads) {
    const k = q.side === 'blue' && intel(s, 'red', q);
    if (!k || Math.hypot(k.x - p.x, k.y - p.y) > AI_NEAR) continue;
    e += (MULT[sq.type][q.type] - MULT[q.type][sq.type]) * k.strength * q.size;
  }
  return e;
}

function enemyAI(s) {
  const D = DIFFS[s.diff] || DIFFS.normal, taken = new Map();
  const red = s.squads.filter(q => q.side === 'red' && !q.dead && !q.retreating);
  const setOrder = (sq, type, x, y) => {
    const p = pending(s, sq.id, 'order'), cur = p || sq.order;
    if (cur.x === x && cur.y === y && cur.type === type) return;
    if (s.fog) send(s, sq, { kind: 'order', type, x, y, quiet: true });
    else { sq.order = { type, x, y, r: ORDER_R[type] }; sq.arrived = false; }
  };
  for (const sq of red.filter(q => q.type !== 'air')) {
    const score = p => {
      let sc = dist({ x: sq.cx, y: sq.cy }, p);
      const held = p.owner === 'red' && !p.contested;
      if (held) sc += 350;
      sc += 200 * (taken.get(p) || 0);
      if (D.smart) {
        // go where this force counters what's there; hold a point the enemy is about to hit
        sc -= 60 * edgeAt(s, sq, p);
        if (held && threatAt(s, 'red', p, AI_NEAR)) sc -= 250;
        if (p.type === sq.type && !held) sc -= 60; // a matching point speeds up its own reinforcements
      }
      return sc;
    };
    let best = null, bs = Infinity;
    for (const p of s.points) { const sc = score(p); if (sc < bs) { bs = sc; best = p; } }
    if (!best) continue;
    // don't flip-flop between two points that score about the same
    const cur = D.smart && s.points.find(p => p.x === sq.order.x && p.y === sq.order.y);
    if (cur && cur !== best && score(cur) < bs + AI_KEEP) best = cur;
    taken.set(best, (taken.get(best) || 0) + 1);
    setOrder(sq, best.owner === 'red' && !best.contested ? 'hold' : 'attack', best.x, best.y);
  }
  // aircraft: hunt what they beat (tanks first), keep away from enemy AA
  for (const sq of red.filter(q => q.type === 'air')) {
    let tgt = null, bs = Infinity;
    for (const q of s.squads) {
      const k = q.side === 'blue' && q.type !== 'air' && intel(s, 'red', q);
      if (!k || (!D.smart && q.type !== 'tank')) continue;
      let sc = Math.hypot(k.x - sq.cx, k.y - sq.cy) - 250 * MULT.air[q.type];
      if (D.smart) for (const a of s.squads) {
        const ka = a.side === 'blue' && a.type === 'aa' && intel(s, 'red', a);
        if (ka && Math.hypot(ka.x - k.x, ka.y - k.y) < 150) sc += 300 * ka.strength;
      }
      if (sc < bs) { bs = sc; tgt = { x: k.x, y: k.y }; }
    }
    if (!tgt || (D.smart && bs > 450)) {
      bs = Infinity;
      for (const p of s.points) {
        if (p.owner === 'red' && !p.contested) continue;
        const d = dist({ x: sq.cx, y: sq.cy }, p) + (D.smart ? 300 * Math.max(0, -edgeAt(s, sq, p)) : 0);
        if (d < bs) { bs = d; tgt = p; }
      }
    }
    if (tgt) setOrder(sq, 'attack', tgt.x, tgt.y);
  }
  // posture: press when behind, play safe when ahead
  if (D.traits) {
    const lead = s.score.red - s.score.blue;
    const tr = lead > 30 ? 'cautious' : lead < -30 ? 'aggressive' : 'balanced';
    for (const sq of s.squads) if (sq.side === 'red') sq.trait = tr;
  }
  if (D.smart && s.fog && s.eyes.red.charges >= 1) {
    const known = p => s.squads.some(q => { const k = q.side === 'blue' && intel(s, 'red', q); return k && Math.hypot(k.x - p.x, k.y - p.y) < AI_NEAR; });
    const p = s.points.filter(p => p.owner !== 'red' || p.contested).find(p => !known(p));
    if (p) eye(s, 'red', p.x, p.y);
  }
  return D.every;
}
