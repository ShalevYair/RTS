// Sim: orders as messages, postures, calls from commanders, drones, reports, history
// Under fog an order is a message: it reaches the squad after orderDelay seconds, longer where control is
// poor (see control.js). A newer message of the same kind replaces one still on its way, so orders can't
// arrive out of sequence.
const hq = (s, side) => hqOf(s, side) || { x: s.bases[side].x, y: s.H / 2 };
// (longer at night; a seasoned commander is quicker)
const orderDelay = (s, sq) => (DELAY_MIN + DELAY_SPAN * (1 - qualityAt(s, sq))) * (1 + NIGHT_DELAY * nightAt(s)) * (1 - RANK_DELAY * rankOf(sq));
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
    if (m.kind === 'order') applyOrder(s, sq, garbled(s, sq, m.type), m.x, m.y, m.quiet, m.form);
    else if (m.kind === 'silent') applySilent(s, sq, m.on, m.quiet);
    else if (m.kind === 'build') setUpFhq(s, sq, m.spot); // (m.at is when it arrives)
    else applyTrait(s, sq, m.trait, m.quiet);
  }
}

// unclear orders: far from control an order may come through garbled, and the commander makes of it what his temper
// says (bold: attack; anxious: hold; steady: go on as he was). Seasoned commanders get it right more often.
// (not the bulldozer or the signals truck: they don't fight, so "attack" means nothing to them — a bulldozer that
// read its trip to a site as "attack" thought it was sent elsewhere, and stopped work)
function garbled(s, sq, type) {
  if (!friction(s) || type === 'retreat' || TYPES[sq.type].support) return type;
  const q = qualityAt(s, sq);
  if (q >= UNCLEAR_Q || s.rand() >= UNCLEAR_K * (UNCLEAR_Q - q) / UNCLEAR_Q * Math.pow(0.5, rankOf(sq))) return type;
  const read = sq.temper === 'bold' ? 'attack' : sq.temper === 'anxious' ? 'hold' : sq.order.type === 'retreat' ? 'hold' : sq.order.type;
  if (read === type) return type;
  if (sq.side === 'blue') { s.log2.unclear++; report(s, sq, 'ההודעה לא ברורה, מבין: ' + (read === 'hold' ? 'להחזיק' : 'לתקוף')); s.marks.push({ x: sq.cx, y: sq.cy, kind: 'unclear', t: s.t, who: sq.name, id: sq.id }); }
  return read;
}
// radio silence (sent like an order): the squad stops reporting, moves slower and raises no dust
function silence(s, squadId, on, quiet) {
  const sq = s.squads.find(q => q.id === squadId);
  if (!sq || s.over) return false;
  const p = pending(s, sq.id, 'silent');
  if (p ? p.on === !!on : sq.silent === !!on) return false;
  if (friction(s)) send(s, sq, { kind: 'silent', on: !!on, quiet }); else applySilent(s, sq, !!on, quiet);
  return true;
}
function applySilent(s, sq, on, quiet) {
  if (sq.silent === on) return;
  if (on && !quiet) report(s, sq, 'עוברים לשקט אלחוטי');
  sq.silent = on;
  if (!on) { if (!quiet) report(s, sq, 'חוזרים לקשר'); sendReport(s, sq); }
}
// form: this squad's place in a formation around (x, y) — { depth: behind the middle, lat: to the side }
function order(s, squadId, type, x, y, quiet, form) {
  const sq = s.squads.find(q => q.id === squadId);
  if (!sq || sq.dead || s.over || !(type in ORDER_R)) return false;
  if (type === 'retreat') { const f = homeOf(s, sq); x = f.x; y = f.y; }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  x = clamp(x, 0, s.W); y = clamp(y, 0, s.H);
  if (!TYPES[sq.type].air && lakeAt(s, { x, y })) ({ x, y } = dryOf(s, { x, y }, 10)); // ground squads stop at the shore
  if (!quiet) sq.told = true; // (the player said where: a truck no longer follows the front — setFront)
  if (friction(s)) send(s, sq, { kind: 'order', type, x, y, quiet, form }); else applyOrder(s, sq, type, x, y, quiet, form);
  return true;
}
// how far apart a squad's units stand (soldiers LINE_GAP, vehicles VEH_GAP), and how wide it is: in a line, or a block
// (packed: its own pack, else more than PACK_AT of a kind — n, the number counted with it when ordered together)
const spacing = type => TYPES[type].r * 2 + (FOOT.includes(type) ? LINE_GAP : VEH_GAP);
const packed = (sq, n = sq.count || sq.size) => sq.pack ? sq.pack === 'block' : n > PACK_AT;
const blockCols = n => Math.max(1, Math.ceil(Math.sqrt(n)));
const lineWidth = (sq, n) => (packed(sq, n) ? blockCols(sq.size) : sq.size) * spacing(sq.type);
// all these squads to (x, y) together, in rows facing the enemy: tanks in front, then jeeps, infantry, AA, and medics /
// mechanics at the back; aircraft over the middle. Squads of a kind stand side by side in their row.
// fa: the way the front should face (a drag on the map); without it, toward the enemy HQ (a seen enemy always wins)
// deep: how deep from the first row to the last (the length of the player's arrow), else ROW_GAP between rows.
// Far off (past MARCH_MIN), they go there in the formation: its middle moves from where they are at the slowest one's
// pace (MARCH_PACE of it, after MARCH_WAIT s to form up), each squad keeping its place in it — not each straight to its
// own spot, forming up only at the end.
function formation(s, ids, type, x, y, quiet, fa, deep) {
  if (type === 'retreat') { let ok = false; for (const id of ids) ok = order(s, id, type, x, y, quiet) || ok; return ok; }
  const rows = new Map(), qs = [];
  for (const id of ids) { const q = s.squads.find(k => k.id === id); if (q && !q.dead) { qs.push(q); const k = FORM_ROW[q.type]; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(q); } }
  const ks = [...rows.keys()], k0 = Math.min(...ks), k1 = Math.max(...ks), mid = (k0 + k1) / 2;
  const gap = deep > 0 && k1 > k0 ? clamp(deep / (k1 - k0), DEEP_MIN, DEEP_MAX) : ROW_GAP;
  // (the march: from the middle of their ground units, at the slowest's pace)
  const us = s.units.filter(u => qs.some(q => q.id === u.squad) && !TYPES[u.type].air);
  let march = null;
  if (us.length) {
    const sx = us.reduce((a, u) => a + u.x, 0) / us.length, sy = us.reduce((a, u) => a + u.y, 0) / us.length;
    if (Math.hypot(x - sx, y - sy) > MARCH_MIN) march = { sx, sy, v: Math.min(...us.map(u => TYPES[u.type].speed)) * MARCH_PACE, t0: s.t + MARCH_WAIT };
    // (the player's: no arrow — the front faces the way they go, and stays so; far from where they are, else the enemy HQ)
    if (!Number.isFinite(fa) && qs.length && singles(s, qs[0].side)) {
      const e = hqOf(s, qs[0].side === 'blue' ? 'red' : 'blue') || s.bases[qs[0].side === 'blue' ? 'red' : 'blue'];
      fa = Math.hypot(x - sx, y - sy) > FACE_GO ? Math.atan2(y - sy, x - sx) : Math.atan2(e.y - y, e.x - x);
    }
  }
  let ok = false;
  for (const [k, list] of rows) {
    // (many of a kind in the row — more than PACK_AT — stand in blocks, unless the player set it)
    const n = list.reduce((a, q) => a + (q.count || q.size), 0); for (const q of list) q.packN = n;
    const singles = list.filter(q => q.single), rest = list.filter(q => !q.single), sp = Math.max(...list.map(q => spacing(q.type)));
    // single units side by side, no gap between them — or, many, in a block (cols across, rows back from the front)
    const block = singles.length && packed(singles[0], n), cols = block ? blockCols(singles.length) : singles.length, rws = Math.ceil(singles.length / Math.max(1, cols));
    const sw = cols * sp, parts = (singles.length ? 1 : 0) + rest.length;
    let at = -((singles.length ? sw : 0) + rest.reduce((a, q) => a + lineWidth(q, n), 0) + SIDE_GAP * Math.max(0, parts - 1)) / 2;
    // (in an attack, those that don't fight — signals trucks, bulldozers, medics, mechanics… — hold SUPPORT_BACK behind
    // the rest, not up at what's attacked)
    // (and they stand still where they're put: their spot doesn't swing round with the front — far back, a small turn
    // moved it a lot, and they drove about all the time; only fire moves them, `underFire`)
    const back = q => type === 'attack' && TYPES[q.type].care ? SUPPORT_BACK : 0, how = q => back(q) ? 'hold' : type;
    const fixed = q => !!TYPES[q.type].care && !TYPES[q.type].air;
    singles.forEach((q, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      ok = order(s, q.id, how(q), x, y, quiet, { depth: (k - mid) * gap - (r - (rws - 1) / 2) * sp + back(q), lat: at + (c + 0.5) * sp, fa, fixed: fixed(q), march, deep }) || ok;
    });
    if (singles.length) at += sw + SIDE_GAP;
    for (const q of rest) { const w = lineWidth(q, n); ok = order(s, q.id, how(q), x, y, quiet, { depth: (k - mid) * gap + back(q), lat: at + w / 2, fa, fixed: fixed(q), march, deep }) || ok; at += w + SIDE_GAP; }
  }
  return ok;
}
// line ↔ block for these squads (the player's P): all to the other of what the first has now
function pack(s, ids) {
  const qs = ids.map(id => s.squads.find(q => q.id === id)).filter(q => q && !q.dead && !TYPES[q.type].air); if (!qs.length) return null;
  const to = packed(qs[0], qs[0].single ? qs.length : qs[0].packN) ? 'line' : 'block'; for (const q of qs) q.pack = to;
  // (standing in a formation together: formed again, the new way)
  const f = qs[0].order.form; if (f && qs.length > 1) formation(s, qs.map(q => q.id), qs[0].order.type, f.wx ?? f.x, f.wy ?? f.y, true, f.fa, f.deep);
  return to;
}
// which way to face from p: the nearest enemy seen within FACE_R, else fa (where the player pointed), else the enemy HQ
// (the nearest seen enemy is looked for once a tick per FACE_CELL square, from its middle: every squad asks, twice a
// tick, and looking through all the units each time was a big part of the game's time)
const FACE_CELL = 40;
function faceFoe(s, side, p) {
  const C = s.faceCache && s.faceCache.t === s.t && s.faceCache.n === s.units.length ? s.faceCache : (s.faceCache = { t: s.t, n: s.units.length, m: new Map() });
  const i = Math.floor(p.x / FACE_CELL), j = Math.floor(p.y / FACE_CELL), key = side + (i * 4096 + j);
  if (C.m.has(key)) return C.m.get(key);
  const c = { x: (i + 0.5) * FACE_CELL, y: (j + 0.5) * FACE_CELL };
  let best = null, bd = FACE_R;
  for (const e of around(s, c.x, c.y, FACE_R)) if (e.side !== side && Math.abs(e.x - c.x) < FACE_R && Math.abs(e.y - c.y) < FACE_R && seen(s, side, e)) { const d = dist(e, c); if (d < bd) { bd = d; best = e; } }
  C.m.set(key, best); return best;
}
// (the player's units with a way set — an arrow, or the way they went: they hold it, they don't turn to each enemy;
// turning, the whole line drove about all the time)
function faceAt(s, side, p, fa) {
  if (Number.isFinite(fa) && singles(s, side)) return fa;
  const best = faceFoe(s, side, p);
  if (!best && Number.isFinite(fa)) return fa;
  const t = best || hqOf(s, side === 'blue' ? 'red' : 'blue') || s.bases[side === 'blue' ? 'red' : 'blue'];
  return Math.atan2(t.y - p.y, t.x - p.x);
}
// turn angle a toward b by at most k
const turnTo = (a, b, k) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + clamp(d, -k, k); };
// a squad in a formation: its spot moves with the way the formation faces (it turns toward a threat)
function placeForm(s, sq, dt) {
  const o = sq.order, f = o.form;
  f.a = f.a === undefined ? faceAt(s, sq.side, f, f.fa) : turnTo(f.a, faceAt(s, sq.side, f, f.fa), FACE_TURN * dt);
  const dx = Math.cos(f.a), dy = Math.sin(f.a), at = (x, y) => ({ x: clamp(x - dx * f.depth - dy * f.lat, 10, s.W - 10), y: clamp(y - dy * f.depth + dx * f.lat, 10, s.H - 10) });
  // (marching there: the formation's middle on its way, not yet where it's going)
  const m = f.march, L = m ? Math.hypot(f.x - m.sx, f.y - m.sy) : 0, g = m ? clamp(m.v * (s.t - m.t0) / Math.max(1, L), 0, 1) : 1;
  if (m && g >= 1) f.march = null;
  let p = g < 1 ? at(m.sx + (f.x - m.sx) * g, m.sy + (f.y - m.sy) * g) : at(f.x, f.y);
  if (!TYPES[sq.type].air && lakeAt(s, p)) p = dryOf(s, p, 10);
  o.x = p.x; o.y = p.y;
  if (o.want) o.want = at(f.wx, f.wy);
}
// where the commander understood the order to point: the target plus a random offset that grows as control
// weakens (none at Q = 1); a bold commander also overshoots, past the target along the way there
function understood(s, sq, x, y) {
  const R = SPREAD * Math.pow(1 - qualityAt(s, sq), SPREAD_POW) * (1 - RANK_SPREAD * rankOf(sq));
  if (R < 1) return { x, y };
  const a = s.rand() * Math.PI * 2, m = Math.sqrt(s.rand()) * R;
  let dx = Math.cos(a) * m, dy = Math.sin(a) * m;
  if (sq.temper === 'bold') {
    let fx = x - sq.cx, fy = y - sq.cy, d = Math.hypot(fx, fy);
    if (d < 1) { fx = sq.side === 'blue' ? 1 : -1; fy = 0; d = 1; } // holding in place: "forward" is toward the enemy
    dx += fx / d * R * BOLD_STRETCH; dy += fy / d * R * BOLD_STRETCH;
  }
  return { x: clamp(x + dx, 0, s.W), y: clamp(y + dy, 0, s.H) };
}
// under fog an order is carried out "roughly" (a retreat home is always clear); `want` keeps what was asked
function applyOrder(s, sq, type, x, y, quiet, form) {
  const p = friction(s) && type !== 'retreat' ? understood(s, sq, x, y) : { x, y }, off = Math.hypot(p.x - x, p.y - y);
  sq.order = { type, x: p.x, y: p.y, r: ORDER_R[type], want: { x, y } };
  if (form && type !== 'retreat') { sq.order.form = { x: p.x, y: p.y, wx: x, wy: y, depth: form.depth || 0, lat: form.lat || 0, fa: form.fa, fixed: form.fixed, march: form.march, deep: form.deep }; placeForm(s, sq, 0); }
  sq.retreating = false; sq.arrived = false; sq.support = null;
  if (sq.side === 'blue' && friction(s) && type !== 'retreat') {
    s.log2.off += off; s.log2.offN++;
    s.marks.push({ x: p.x, y: p.y, kind: 'ack', t: s.t, who: sq.name, id: sq.id, type }); // "roger": where the squad is actually going
  }
  if (!quiet) report(s, sq, 'קיבלתי: ' + (type === 'hold' ? 'מחזיק עמדה' : type === 'attack' ? 'תוקף את האזור' : 'נסוג לבסיס') + (off > 20 ? ', בערך' : ''));
  return true;
}

function setTrait(s, squadId, trait, quiet) {
  const sq = s.squads.find(q => q.id === squadId);
  if (!sq || s.over || !(trait in TRAITS)) return false;
  const p = pending(s, sq.id, 'trait');
  if (p ? p.trait === trait : sq.trait === trait) return false;
  if (friction(s)) send(s, sq, { kind: 'trait', trait, quiet }); else applyTrait(s, sq, trait, quiet);
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
  else { const f = homeOf(s, sq); applyOrder(s, sq, 'retreat', f.x, f.y, true); report(s, sq, pre + 'נסוגים'); }
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

// Situation picture: blue sees its own squads only as their commanders report them.
// A report snapshots the squad (position, strength); an event report also drops a mark on the map.
// Where control is poor the report is off: position by up to NOISE_POS·(1−Q), strength by NOISE_STR·(1−Q).
function sendReport(s, sq, kind) {
  if (sq.side !== 'blue') return;
  if (sq.silent && qualityAt(s, sq) < 1) return; // radio silence: nothing on the air (the full-control ring still sees it)
  const r = s.rep[sq.id], miss = (1 - qualityAt(s, sq)) * (1 - RANK_NOISE * rankOf(sq)), jit = () => (s.rand() * 2 - 1) * miss;
  let said = sq.strength < 1 ? clamp(sq.strength + TEMPERS[sq.temper].rosy, 0.05, 1) : 1; // bold ones play losses down
  said = clamp(said + NOISE_STR * jit(), 0.05, 1);
  s.rep[sq.id] = { x: clamp(sq.cx + NOISE_POS * jit(), 0, s.W), y: clamp(sq.cy + NOISE_POS * jit(), 0, s.H), strength: said, t: s.t, q: 1 - miss, prev: r ? { x: r.x, y: r.y } : null };
  if (kind) s.marks.push({ x: sq.cx, y: sq.cy, kind, t: s.t, who: sq.name, id: sq.id });
}
