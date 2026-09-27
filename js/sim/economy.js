// Sim: control points, reinforcements, reserves and the comeback bonus
function capture(s, dt) {
  for (const p of s.points) {
    let b = 0, r = 0;
    for (const u of s.units) if (!TYPES[u.type].air && dist(u, p) <= p.r) (u.side === 'blue' ? b++ : r++);
    if (b && !r) p.prog = Math.min(1, p.prog + dt * CAPTURE_RATE * Math.min(b, 5) * (1 + s.tune.capture * catchup(s, 'blue')));
    else if (r && !b) p.prog = Math.max(-1, p.prog - dt * CAPTURE_RATE * Math.min(r, 5) * (1 + s.tune.capture * catchup(s, 'red')));
    p.contested = !!(b && r);
    const prev = p.owner;
    if (p.prog >= 1) p.owner = 'blue';
    else if (p.prog <= -1) p.owner = 'red';
    else if (p.owner === 'blue' && p.prog <= 0) p.owner = null;
    else if (p.owner === 'red' && p.prog >= 0) p.owner = null;
    if (prev !== p.owner && (prev === 'blue' || p.owner === 'blue')) s.marks.push({ x: p.x, y: p.y - p.r, kind: p.owner === 'blue' ? 'flag' : 'flagLost', t: s.t, who: p.name });
    if (prev !== p.owner) report(s, null, p.owner === 'blue' ? `כבשנו את ${p.name}` : p.owner === 'red' ? `האויב כבש את ${p.name}` : `${p.name} ניטרלית`);
    if (p.owner) s.score[p.owner] += dt;
  }
}

// comeback: the side behind on score reinforces faster, up to +CATCHUP_MAX at CATCHUP_GAP of the target
const catchup = (s, side) => {
  const gap = s.score[side === 'blue' ? 'red' : 'blue'] - s.score[side];
  return s.tune.catchup * clamp(gap / (CATCHUP_GAP * s.WIN), 0, 1);
};
function reinRate(s, sq) {
  const held = s.points.filter(p => p.owner === sq.side);
  return (1 + s.tune.point * held.length + s.tune.match * held.filter(p => p.type === sq.type).length) * (1 + catchup(s, sq.side));
}

// each squad refills one unit at a time from its own facility
function reinforce(s, dt) {
  if (s.noReinforce) return;
  for (const side of ['blue', 'red']) s.reserve[side] = Math.min(s.tune.resMax, s.reserve[side] + dt / s.tune.resEvery);
  for (const sq of s.squads) {
    const n = s.units.filter(u => u.squad === sq.id).length;
    if (n >= sq.size) { sq.reinProg = 0; continue; }
    sq.reinProg = Math.min(1, sq.reinProg + dt * reinRate(s, sq) / TYPES[sq.type].rein);
    if (sq.reinProg >= 1) {
      // each new unit is paid for from the side's reserves; an empty pool stalls the refill
      const cost = TYPES[sq.type].cost;
      if (s.reserve[sq.side] < cost) continue;
      s.reserve[sq.side] -= cost; sq.reinProg = 0;
      if (sq.side === 'blue' && s.reserve.blue < 1) note(s, 'המילואים נגמרו, התגבורת תחכה');
      const f = s.bases[sq.side].fac[sq.type];
      spawn(s, sq, f.x, f.y); s.stats.rein[sq.side]++;
      if (n + 1 === sq.size) report(s, sq, 'הכוח מאויש במלואו');
    }
  }
}
