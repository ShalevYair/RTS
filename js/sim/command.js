// Sim: orders as messages, postures, calls from commanders, drones, reports, history
// Under fog an order is a message: it reaches the squad after orderDelay seconds. A newer message of
// the same kind replaces one still on its way, so orders can't arrive out of sequence.
const hq = (s, side) => ({ x: s.bases[side].x, y: H / 2 });
const orderDelay = (s, sq) => Math.min(ORDER_DELAY_MAX, ORDER_DELAY_BASE + dist({ x: sq.cx, y: sq.cy }, hq(s, sq.side)) / ORDER_SPEED);
function send(s, sq, msg) {
  s.outbox = s.outbox.filter(m => !(m.id === sq.id && m.kind === msg.kind));
  const d = orderDelay(s, sq);
  s.outbox.push({ ...msg, id: sq.id, side: sq.side, sent: s.t, at: s.t + d });
  if (sq.side === 'blue' && msg.kind === 'order') { s.log2.orders++; s.log2.delay += d; }
}
const pending = (s, id, kind) => s.outbox.find(m => m.id === id && m.kind === kind);
function deliver(s) {
  const due = s.outbox.filter(m => m.at <= s.t);
  if (!due.length) return;
  s.outbox = s.outbox.filter(m => m.at > s.t);
  for (const m of due) {
    const sq = s.squads.find(q => q.id === m.id);
    if (!sq || sq.dead) continue; // the squad is gone; the message is lost
    if (m.kind === 'order') applyOrder(s, sq, m.type, m.x, m.y, m.quiet);
    else applyTrait(s, sq, m.trait, m.quiet);
  }
}

function order(s, squadId, type, x, y, quiet) {
  const sq = s.squads.find(q => q.id === squadId);
  if (!sq || sq.dead || s.over || !(type in ORDER_R)) return false;
  if (type === 'retreat') { const f = s.bases[sq.side].fac[sq.type]; x = f.x; y = f.y; }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  x = clamp(x, 0, s.W); y = clamp(y, 0, H);
  if (s.fog) send(s, sq, { kind: 'order', type, x, y, quiet }); else applyOrder(s, sq, type, x, y, quiet);
  return true;
}
function applyOrder(s, sq, type, x, y, quiet) {
  sq.order = { type, x, y, r: ORDER_R[type] };
  sq.retreating = false; sq.arrived = false; sq.support = null;
  if (!quiet) report(s, sq, 'קיבלתי: ' + (type === 'hold' ? 'מחזיק עמדה' : type === 'attack' ? 'תוקף את האזור' : 'נסוג לבסיס'));
  return true;
}

function setTrait(s, squadId, trait, quiet) {
  const sq = s.squads.find(q => q.id === squadId);
  if (!sq || s.over || !(trait in TRAITS)) return false;
  const p = pending(s, sq.id, 'trait');
  if (p ? p.trait === trait : sq.trait === trait) return false;
  if (s.fog) send(s, sq, { kind: 'trait', trait, quiet }); else applyTrait(s, sq, trait, quiet);
  return true;
}
function applyTrait(s, sq, trait, quiet) {
  if (sq.trait === trait) return;
  sq.trait = trait;
  if (!quiet) report(s, sq, `עובר למצב ${TRAITS[trait].name} (נסוג ב-${Math.round(TRAITS[trait].retreatAt * 100)}%)`);
  // a bolder posture can cancel an ongoing retreat
  if (sq.retreating && sq.order.type !== 'retreat' && sq.strength >= retreatAt(s, sq) + 0.05) {
    sq.retreating = false; sq.arrived = false;
    if (!quiet) report(s, sq, 'מבטל נסיגה, חוזר למשימה');
  }
}
// the strength at which a squad falls back: posture, the commander's temper, and a "hold on" from HQ
const retreatAt = (s, sq) => Math.max(0.05, TRAITS[sq.trait].retreatAt + TEMPERS[sq.temper].retreat - (s.t < sq.firmUntil ? FIRM_BONUS : 0));

// HQ's answer to a call: 'hold' stiffens the squad for FIRM_TIME, 'retreat' pulls it back at once (direct line)
function answer(s, callId, choice, auto) {
  const c = s.calls.find(k => k.id === callId), sq = c && s.squads.find(q => q.id === c.sq);
  if (!c || !sq || !(choice === 'hold' || choice === 'retreat')) return false;
  s.calls = s.calls.filter(k => k !== c); sq.callOpen = false;
  if (auto) s.log2.missed++; else s.log2.answered++;
  if (sq.dead) return true;
  const pre = auto ? `אין תשובה, ${TEMPERS[sq.temper].name}: ` : '';
  if (choice === 'hold') { sq.firmUntil = s.t + FIRM_TIME; report(s, sq, pre + 'מחזיקים!'); }
  else { const f = s.bases[sq.side].fac[sq.type]; applyOrder(s, sq, 'retreat', f.x, f.y, true); report(s, sq, pre + 'נסוגים'); }
  return true;
}
function calls(s) {
  for (const c of s.calls.slice()) {
    const sq = s.squads.find(q => q.id === c.sq);
    // the squad already broke off or is gone: the question is moot
    if (!sq || sq.dead || sq.retreating || sq.order.type === 'retreat') { s.calls = s.calls.filter(k => k !== c); if (sq) sq.callOpen = false; continue; }
    if (s.t >= c.until) {
      const T = sq.temper, decide = T === 'bold' ? 'hold' : T === 'anxious' ? 'retreat' : sq.strength > retreatAt(s, sq) + 0.1 ? 'hold' : 'retreat';
      answer(s, c.id, decide, true);
    }
  }
}
// history for the end-of-game comparison: truth vs what blue believed
function record(s, dt) {
  s.histIn -= dt;
  if (s.histIn > 0) return;
  s.histIn = HIST_EVERY;
  s.hist.push({ t: s.t, sq: s.squads.map(q => {
    const r = s.rep[q.id], m = s.mem.blue[q.id];
    const belief = q.side === 'blue' ? (r && [r.x, r.y]) : (m && s.t - m.t <= 40 ? [m.x, m.y] : null);
    return { id: q.id, side: q.side, type: q.type, truth: q.dead ? null : [q.cx, q.cy], belief };
  }) });
}

// "eyes": a drone gives a live look at a small area for a few seconds; charges refill slowly
function eye(s, side, x, y) {
  const E = s.eyes[side];
  if (!E || s.over || E.charges < 1 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  E.charges--; E.active.push({ x: clamp(x, 0, s.W), y: clamp(y, 0, H), r: EYE_R, until: s.t + EYE_TIME });
  if (side === 'blue') note(s, 'רחפן באוויר');
  return true;
}
function updateEyes(s, dt) {
  for (const side of ['blue', 'red']) {
    const E = s.eyes[side];
    E.active = E.active.filter(d => d.until > s.t);
    if (E.charges >= EYE_MAX) { E.prog = 0; continue; }
    E.prog += dt / EYE_EVERY;
    if (E.prog >= 1) { E.prog -= 1; E.charges++; }
  }
}

// Situation picture: blue sees its own squads only as their commanders report them.
// A report snapshots the squad (position, strength); an event report also drops a mark on the map.
function sendReport(s, sq, kind) {
  if (sq.side !== 'blue') return;
  const r = s.rep[sq.id];
  const said = sq.strength < 1 ? clamp(sq.strength + TEMPERS[sq.temper].rosy, 0.05, 1) : 1; // bold ones play losses down
  s.rep[sq.id] = { x: sq.cx, y: sq.cy, strength: said, t: s.t, prev: r ? { x: r.x, y: r.y } : null };
  if (kind) s.marks.push({ x: sq.cx, y: sq.cy, kind, t: s.t, who: sq.name });
}
