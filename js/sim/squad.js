// Sim: squad state, commander initiative and per-unit movement / combat
function updateSquad(s, sq, dt) {
  const m = s.units.filter(u => u.squad === sq.id);
  sq.count = m.length;
  if (!m.length) { if (!sq.dead) { sq.dead = true; sq.strength = 0; report(s, sq, 'הכוח הושמד'); sendReport(s, sq, 'lost'); } return; }
  let fresh = false;
  if (sq.dead) { sq.dead = false; fresh = true; report(s, sq, 'הכוח הוקם מחדש מהתגבורת'); }
  const T = TYPES[sq.type], tr = TRAITS[sq.trait];
  sq.strength = m.reduce((a, u) => a + u.hp, 0) / (sq.size * T.hp);
  const body = bodyCenter(m); sq.cx = body.x; sq.cy = body.y;
  const c = { x: sq.cx, y: sq.cy };
  if (fresh) sendReport(s, sq);
  if (!sq.retreating && sq.order.type !== 'retreat' && sq.strength < retreatAt(s, sq)) {
    sq.retreating = true;
    report(s, sq, `אבדות כבדות (${Math.round(sq.strength * 100)}%), נסוג להתארגנות`); sendReport(s, sq, 'hit');
  }
  if (sq.retreating && sq.strength >= 0.8 && inBase(s, sq.side, c)) {
    sq.retreating = false; sq.arrived = false; report(s, sq, 'התארגנו, חוזרים למשימה');
  }
  if (!sq.arrived && !sq.retreating && !sq.support && (sq.order.type === 'retreat' ? inBase(s, sq.side, c) : dist(c, sq.order) < sq.order.r)) {
    sq.arrived = true; report(s, sq, sq.order.type === 'retreat' ? 'הגענו לבסיס' : 'הגענו ליעד'); sendReport(s, sq, 'ok');
  }
  sq.contactCd = Math.max(0, sq.contactCd - dt);
  const contact = m.some(u => u.engaged);
  if (contact) sq.lastContact = s.t;
  if (contact && !sq.wasContact && sq.contactCd === 0) { report(s, sq, 'במגע עם האויב'); sq.contactCd = 10; sendReport(s, sq, 'contact'); }
  sq.wasContact = contact;
  const rearming = m.some(u => u.rearm);
  if (rearming && !sq.wasRearm) report(s, sq, 'נגמרה התחמושת, חוזרים לשדה התעופה לחימוש');
  sq.wasRearm = rearming;
  // routine check-in; a squad in a fight is busy and reports half as often
  const r = s.rep[sq.id];
  if (sq.side === 'blue' && (!r || s.t - r.t >= REPORT_EVERY * TEMPERS[sq.temper].report * (s.t - sq.lastContact < CONTACT_MEMORY ? 2 : 1))) sendReport(s, sq);
  // under pressure but not yet breaking: ask HQ
  const thr = retreatAt(s, sq);
  if (sq.side === 'blue' && s.fog && contact && !sq.retreating && !s.calls.length && sq.order.type !== 'retreat' &&
      s.t - sq.lastCall > CALL_COOLDOWN && sq.strength < thr + CALL_BAND && sq.strength >= thr) {
    sq.callOpen = true; sq.lastCall = s.t;
    s.calls.push({ id: s.nextCall++, sq: sq.id, t: s.t, until: s.t + CALL_TIME });
    sendReport(s, sq, 'call');
    report(s, sq, 'לחץ כבד. להחזיק או לסגת?');
  }
}

function effOrder(s, sq) {
  if (sq.support) {
    const t = s.squads.find(q => q.id === sq.support);
    if (t && !t.dead) return { type: 'support', x: t.cx, y: t.cy, r: SUPPORT_R, target: t };
  }
  return sq.order;
}

// Commander initiative: act on intent, not only on explicit orders.
function initiative(s, sq, dt) {
  sq.checkIn -= dt;
  if (sq.checkIn > 0) return;
  sq.checkIn = INITIATIVE_EVERY;
  const tr = TRAITS[sq.trait], inContact = q => s.t - q.lastContact < CONTACT_MEMORY;
  if (sq.support) {
    const t = s.squads.find(q => q.id === sq.support);
    let why = null;
    if (sq.dead || sq.retreating || sq.order.type === 'retreat') why = '';
    else if (!t || t.dead) why = 'הכוח שסייעתי לו אבד, חוזר לעמדה';
    else if (!inContact(t) && !inContact(sq)) why = 'האיום הוסר, חוזר לעמדה';
    else if (s.t - sq.supportSince > SUPPORT_MAX) why = 'מסיים סיוע, חוזר לעמדה';
    else if (threatAt(s, sq.side, sq.order, sq.order.r * 1.5)) why = 'הגזרה שלי מאוימת, חוזר';
    if (why !== null) { sq.support = null; sq.arrived = false; if (why) report(s, sq, why); }
    return;
  }
  if (sq.dead || sq.retreating || sq.order.type === 'retreat' || !sq.arrived || inContact(sq) || sq.strength < 0.6) return;
  if (threatAt(s, sq.side, sq.order, sq.order.r * 2)) return;
  let best = null, bd = Infinity;
  for (const t of s.squads) {
    if (t === sq || t.side !== sq.side || t.dead || t.retreating || t.support || !inContact(t)) continue;
    const d = Math.hypot(t.cx - sq.cx, t.cy - sq.cy);
    if (d <= tr.support && d < bd) { bd = d; best = t; }
  }
  if (best) { sq.support = best.id; sq.supportSince = s.t; report(s, sq, `יוזם: יוצא לסייע לכוח ה${best.name}`); }
}

function updateUnit(s, u, sq, dt) {
  const T = TYPES[u.type];
  u.cd = Math.max(0, u.cd - dt); u.engaged = false;
  if (T.ammo) {
    // aircraft fly sorties: out of ammo -> back to the airfield, rearm, then return
    if (u.ammo <= 0) u.rearm = true;
    if (u.rearm) {
      const f = s.bases[u.side].fac.air, d = dist(u, f);
      if (d < 20) { u.rearmT += dt; if (u.rearmT >= REARM_TIME) { u.ammo = T.ammo; u.rearm = false; u.rearmT = 0; } }
      else { const k = Math.min(1, T.speed * dt / d); u.hd = Math.atan2(f.y - u.y, f.x - u.x); u.x += (f.x - u.x) * k; u.y += (f.y - u.y) * k; }
      return;
    }
  }
  const o = effOrder(s, sq), retreat = sq.retreating || o.type === 'retreat';
  const anchor = retreat ? s.bases[u.side].fac[u.type] : o;
  const onHill = !T.air && inHill(s, u), range = T.range * (onHill ? 1.2 : 1);
  const leash = o.r * TRAITS[sq.trait].leash;
  let best = null, bd = Infinity, bw = Infinity, near = null, nd = Infinity;
  for (const e of s.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    // prefer targets this unit type is effective against
    const d = dist(u, e), w = d / (MULT[u.type][e.type] + 0.2);
    if (d <= range && w < nd) { nd = w; near = e; }
    if (!retreat && d <= T.sight && dist(anchor, e) <= leash + range && w < bw) { bw = w; bd = d; best = e; }
  }
  const tgt = best && bd <= range ? best : near;
  if (tgt) {
    u.engaged = true;
    if (u.cd === 0) {
      tgt.hp -= T.dmg * MULT[u.type][tgt.type] * (!TYPES[tgt.type].air && inHill(s, tgt) ? 0.7 : 1); u.cd = T.cd; if (T.ammo) u.ammo--;
      const fx = IMPACT[u.type];
      s.fx.push({ x: tgt.x + (s.rand() - 0.5) * 6, y: tgt.y + (s.rand() - 0.5) * 6, life: fx.life, max: fx.life, size: fx.size });
      u.aim = Math.atan2(tgt.y - u.y, tgt.x - u.x); u.lastFire = s.t;
      s.shots.push({ x1: u.x, y1: u.y, x2: tgt.x, y2: tgt.y, life: 0.15, side: u.side, kind: u.type });
    }
  }
  let tx, ty;
  if (best && bd > range * 0.9) { tx = best.x; ty = best.y; }
  else if (best) return;
  else if (retreat) { tx = anchor.x + u.sx * 18; ty = anchor.y + u.sy * 18; }
  else { const sr = o.r * 0.55; tx = anchor.x + u.sx * sr; ty = anchor.y + u.sy * sr; }
  const vx = tx - u.x, vy = ty - u.y, d = Math.hypot(vx, vy);
  if (d > 2) {
    const sp = T.speed * (onHill ? 0.8 : 1) * (retreat ? 1.15 : 1) * dt, k = Math.min(1, sp / d);
    u.x += vx * k; u.y += vy * k; u.hd = Math.atan2(vy, vx);
  }
}
