// Sim: squad state, commander initiative and per-unit movement / combat
function updateSquad(s, sq, dt) {
  const m = s.units.filter(u => u.squad === sq.id);
  sq.count = m.length;
  if (!m.length) {
    if (!sq.dead) {
      sq.dead = true; sq.strength = 0; report(s, sq, 'הכוח הושמד'); sq.silent = false; sendReport(s, sq, 'lost');
      Object.assign(sq, newBoss(s, sq.side)); sq.xp = 0; // the commander fell with his squad; the refills bring a new one
    }
    return;
  }
  let fresh = false;
  if (sq.dead) { sq.dead = false; fresh = true; report(s, sq, sq.born ? 'הכוח הוקם מחדש מהתגבורת' : 'יצאנו לדרך'); sq.born = true; }
  const T = TYPES[sq.type], tr = TRAITS[sq.trait];
  sq.strength = m.reduce((a, u) => a + u.hp, 0) / (sq.size * T.hp);
  const body = bodyCenter(m); sq.cx = body.x; sq.cy = body.y;
  // the line: a place for each unit that isn't away for treatment, facing the enemy (turning toward a new threat)
  const line = m.filter(u => !u.care);
  line.forEach((u, i) => { u.slot = i - (line.length - 1) / 2; });
  if (sq.order.form && !sq.support) placeForm(s, sq, dt);
  const want = faceAt(s, sq.side, effOrder(s, sq), sq.order.form && sq.order.form.fa);
  sq.face = sq.face === undefined ? want : turnTo(sq.face, want, FACE_TURN * dt);
  const c = { x: sq.cx, y: sq.cy };
  if (fresh) sendReport(s, sq);
  if (!sq.retreating && sq.order.type !== 'retreat' && sq.strength < retreatAt(s, sq)) {
    sq.retreating = true;
    report(s, sq, `אבדות כבדות (${Math.round(sq.strength * 100)}%), נסוג להתארגנות`); sendReport(s, sq, 'hit');
  }
  const atHome = dist(c, homeOf(s, sq)) <= HEAL_R + 20;
  if (sq.retreating && sq.strength >= 0.8 && atHome) {
    sq.retreating = false; sq.arrived = false; report(s, sq, 'התארגנו, חוזרים למשימה');
  }
  if (!sq.arrived && !sq.retreating && !sq.support && (sq.order.type === 'retreat' ? atHome : dist(c, sq.order) < sq.order.r)) {
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
  // (in the full-control ring the picture is live: a report every tick)
  const r = s.rep[sq.id], q = qualityAt(s, sq);
  const every = q >= 1 ? 0 : (REPORT_MIN + REPORT_SPAN * (1 - q)) * TEMPERS[sq.temper].report * (s.t - sq.lastContact < CONTACT_MEMORY ? 2 : 1);
  if (sq.side === 'blue' && (!r || s.t - r.t >= every)) sendReport(s, sq);
  // a squad on the air is heard by the enemy (either side): a vague fix of where it is
  if (!sq.silent && s.t - (sq.lastTalk ?? -99) >= Math.max(every, RADIO_EVERY)) { sq.lastTalk = s.t; overheard(s, sq); }
  // under pressure but not yet breaking: the commander decides — by his temper at once, or (s.askHq) he asks HQ first
  const thr = retreatAt(s, sq);
  if (sq.side === 'blue' && friction(s) && contact && !sq.retreating && !s.calls.length && sq.order.type !== 'retreat' &&
      s.t - sq.lastCall > CALL_COOLDOWN && sq.strength < thr + CALL_BAND && sq.strength >= thr) {
    sq.callOpen = true; sq.lastCall = s.t;
    s.calls.push({ id: s.nextCall++, sq: sq.id, t: s.t, until: s.t + (s.askHq ? CALL_TIME : 0) });
    if (s.askHq) { sendReport(s, sq, 'call'); report(s, sq, 'לחץ כבד. להחזיק או לסגת?'); }
  }
}

// the enemy hears a squad talking on the radio: where it roughly is, nothing more (unless it's already seen)
function overheard(s, sq) {
  if (!friction(s)) return;
  const foe = sq.side === 'blue' ? 'red' : 'blue', m = s.mem[foe][sq.id];
  if (s.visSq[foe].has(sq.id) || (m && s.t - m.t < 2)) return;
  const a = s.rand() * Math.PI * 2, d = Math.sqrt(s.rand()) * RADIO_NOISE;
  const keep = m && s.t - m.t <= TRACK_GAP ? m : null;
  s.mem[foe][sq.id] = { x: clamp(sq.cx + Math.cos(a) * d, 0, s.W), y: clamp(sq.cy + Math.sin(a) * d, 0, s.H), t: s.t, heard: true,
    lvl: keep ? keep.lvl : 0, type: keep ? keep.type : null, air: keep ? keep.air : null, n: keep ? keep.n : null, strength: keep ? keep.strength : null };
}
// a commander's experience: enemy units his squad destroys; a new rank is reported
function gainXp(s, sq, v) {
  const r0 = rankOf(sq); sq.xp += v;
  if (rankOf(sq) > r0 && sq.side === 'blue') { report(s, sq, rankOf(sq) === 2 ? 'המפקד מנוסה מאוד עכשיו' : 'המפקד צבר ניסיון'); s.marks.push({ x: sq.cx, y: sq.cy, kind: 'promo', t: s.t, who: sq.name, id: sq.id }); }
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
  if (sq.dead || sq.retreating || sq.order.type === 'retreat' || !sq.arrived || inContact(sq) || sq.strength < 0.6 || TYPES[sq.type].care) return; // (care squads don't join fights)
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
      const f = rearmSpot(s, u), d = dist(u, f);
      if (d < AIR_ORBIT * 1.5) { u.rearmT += dt; if (u.rearmT >= REARM_TIME) { u.ammo = T.ammo; u.rearm = false; u.rearmT = 0; } }
      circle(s, u, f.x, f.y, AIR_ORBIT * 0.7, dt); // (over the field while they rearm it)
      return;
    }
  }
  // care: badly hurt, the unit leaves the fight on its own for the nearest medic / mechanic (or home), holding its fire
  if (CARER[u.type]) {
    if (!u.care && u.hp < CARE_AT * T.hp) u.care = true;
    else if (u.care && u.hp >= CARE_DONE * T.hp) u.care = false;
  }
  // and low on ammunition: off to the nearest supply truck (or home), holding fire, until refilled
  if (s.supply && SUPPLY[u.type]) {
    if (!u.resup && u.sup < SUPPLY_LOW) u.resup = true;
    else if (u.resup && u.sup >= SUPPLY_DONE) u.resup = false;
  } else u.resup = false;
  if (u.care || u.resup) { const f = careSpot(s, u, sq, u.care ? CARER[u.type] : 'truck'); if (dist(u, f) > CARE_R * 0.6) moveTo(s, u, f.x, f.y, 1.15, dt); return; }
  u.hush = sq.silent; // (radio silence: quiet driving, no dust)
  const o = effOrder(s, sq), retreat = sq.retreating || o.type === 'retreat';
  const anchor = retreat ? homeOf(s, sq) : o;
  const up = 1 + ELEV_BONUS * (u.lvl || 0), range = T.range * up, sight = T.sight * up; // higher ground: further
  const leash = o.r * TRAITS[sq.trait].leash;
  let best = null, bd = Infinity, bw = Infinity, near = null, nd = Infinity;
  for (const e of s.units) {
    if (e.side === u.side || e.hp <= 0 || !MULT[u.type][e.type]) continue; // 0 = can't hit it (only AA hits aircraft)
    // prefer targets this unit type is effective against
    // prefer what this unit hurts most, and finishing off the wounded
    const d = dist(u, e), w = d / (MULT[u.type][e.type] + 0.2) * (0.6 + 0.4 * e.hp / TYPES[e.type].hp);
    if (d <= range && w < nd) { nd = w; near = e; }
    if (!retreat && d <= sight && dist(anchor, e) <= leash + range && w < bw) { bw = w; bd = d; best = e; }
  }
  const tgt = best && bd <= range ? best : near;
  // nothing else to shoot at: hit an enemy forward HQ or (AA only) a drone in range
  if (!tgt && !retreat && u.cd === 0 && !T.care) {
    const n = s.nodes.find(n => nodeTargetable(u, n) && dist(u, n) <= range);
    if (n) {
      u.engaged = true; n.hp -= T.dmg * NODE_MULT[u.type]; u.cd = T.cd; if (T.ammo) u.ammo--; if (s.supply && SUPPLY[u.type]) u.sup -= supplyUse(s, u) / SUPPLY[u.type];
      u.aim = Math.atan2(n.y - u.y, n.x - u.x); u.lastFire = s.t;
      shot(s, u, n);
      s.fx.push({ x: n.x, y: n.y, life: IMPACT[u.type].life, max: IMPACT[u.type].life, size: IMPACT[u.type].size, wait: SHOT_TIME[u.type] });
    }
  }
  if (tgt) {
    u.engaged = true;
    if (u.cd === 0) {
      const hit = friendlyFire(s, u, sq, tgt) || tgt;
      hit.hp -= T.dmg * MULT[u.type][hit.type]; hit.by = sq.id; u.cd = T.cd; if (T.ammo) u.ammo--; if (s.supply && SUPPLY[u.type]) u.sup -= supplyUse(s, u) / SUPPLY[u.type];
      const fx = IMPACT[u.type];
      s.fx.push({ x: hit.x + (s.rand() - 0.5) * 6, y: hit.y + (s.rand() - 0.5) * 6, life: fx.life, max: fx.life, size: fx.size, wait: SHOT_TIME[u.type] });
      u.aim = Math.atan2(hit.y - u.y, hit.x - u.x); u.lastFire = s.t;
      shot(s, u, hit);
    }
  }
  let tx, ty;
  // (a tank goes for soldiers it's shooting at, to run them over)
  if (best && (bd > range * 0.9 || (u.type === 'tank' && FOOT.includes(best.type)))) { tx = best.x; ty = best.y; }
  else if (best) { if (T.air) circle(s, u, best.x, best.y, range * 0.6, dt); return; } // (aircraft wheel over what they shoot at)
  else if (retreat) { tx = anchor.x + u.sx * 18; ty = anchor.y + u.sy * 18; }
  else if (T.air) { const sr = o.r * 0.55; circle(s, u, anchor.x + u.sx * sr, anchor.y + u.sy * sr, AIR_ORBIT, dt); return; }
  else { const g = (u.slot || 0) * spacing(u.type), a = sq.face || 0; tx = anchor.x - Math.sin(a) * g; ty = anchor.y + Math.cos(a) * g; } // in the line
  moveTo(s, u, tx, ty, (retreat ? 1.15 : 1) * (sq.silent ? SILENT_SPEED : 1), dt);
}
// aircraft never stand still: they circle round a spot (heading for a point a little ahead on the ring)
function circle(s, u, cx, cy, R, dt) {
  const a = Math.atan2(u.y - cy, u.x - cx) + AIR_LEAD;
  moveTo(s, u, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1, dt, true);
}
// supply lines: a shot far from any building of the side and from its supply trucks uses more ammunition
function supplyUse(s, u) {
  if (s.nodes.some(n => n.side === u.side && n.hp > 0 && n.kind !== 'drone' && n.kind !== 'decoy' && dist(n, u) <= SUPPLY_FAR)) return 1;
  return s.units.some(m => m.type === 'truck' && m.side === u.side && dist(m, u) <= SUPPLY_NEAR) ? 1 : SUPPLY_FAR_K;
}
// a step toward (tx, ty): ground units go round lakes; uphill slower, downhill faster (by how many lines the next
// few steps climb or drop)
function moveTo(s, u, tx, ty, fast, dt, keep) {
  const T = TYPES[u.type];
  if (!T.air && s.lakes.length) ({ x: tx, y: ty } = wade(s, u, tx, ty));
  const vx = tx - u.x, vy = ty - u.y, d = Math.hypot(vx, vy);
  if (d <= 2 && !keep) return;
  let slope = 1;
  if (!T.air) { const L = 6, e0 = elevAt(s, u), e1 = elevAt(s, { x: u.x + vx / d * L, y: u.y + vy / d * L }); slope = 1 - clamp((e1 - e0) / L * SLOPE_K, -SLOPE_MAX, SLOPE_MAX); }
  const k = keep ? T.speed * fast * dt / Math.max(d, 1e-6) : Math.min(1, T.speed * slope * fast * dt / d); // (keep: at full speed, even past the point)
  u.x += vx * k; u.y += vy * k; u.hd = Math.atan2(vy, vx);
  if (!T.air && !u.hush && d * k >= DUST_FAST * T.speed * dt) u.dustAt = s.t; // (driving fast: dust the enemy can see from afar)
}
// where a hurt unit goes: the nearest medic / mechanic of its side that isn't itself being treated, else home
// (kind: who to go to — a medic / mechanic for treatment, a supply truck for ammunition)
function careSpot(s, u, sq, kind = CARER[u.type]) {
  let best = null, bd = Infinity;
  for (const m of s.units) if (m.type === kind && m.side === u.side && m !== u && !m.care) { const d = dist(u, m); if (d < bd) { bd = d; best = m; } }
  return best || homeOf(s, sq);
}

// Friendly fire (DESIGN.md §2): under fog, a shot at an enemy that has a unit of another friendly squad close
// to it may hit that unit instead; likelier where the shooter's control is poor. Returns the unit hit, or null.
function friendlyFire(s, u, sq, tgt) {
  if (!friction(s)) return null;
  let f = null, fd = FF_R;
  for (const o of s.units) {
    if (o.side !== u.side || o.squad === u.squad || o.hp <= 0 || !MULT[u.type][o.type]) continue;
    const d = dist(o, tgt);
    if (d <= fd) { fd = d; f = o; }
  }
  if (!f || s.rand() >= FF_CHANCE * Math.pow(1 - qualityAt(s, sq), 2)) return null;
  const v = s.squads.find(q => q.id === f.squad);
  s.ff.push({ t: s.t, x: f.x, y: f.y, side: u.side, by: sq.id, on: v.id });
  if (u.side === 'blue') {
    s.log2.ff++;
    if (s.t - (v.ffSaid ?? -99) >= FF_NOTE) {
      v.ffSaid = s.t; report(s, v, `ירי על כוחותינו! נפגענו מכוח ה${sq.name}`);
      s.marks.push({ x: f.x, y: f.y, kind: 'ff', t: s.t, who: v.name, id: v.id });
    }
  }
  return f;
}

// ground units don't swim: a spot in a lake becomes its shore, and when the way ahead is wet the unit slides along
// the shore, on the side that turns it less from where it's going (lakes are convex, so this gets it round)
function wade(s, u, tx, ty) {
  let t = { x: tx, y: ty };
  if (lakeAt(s, t, 4)) t = dryOf(s, t, 6);
  const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy);
  if (d < 1) return t;
  const ahead = { x: u.x + dx / d * Math.min(LAKE_LOOK, d), y: u.y + dy / d * Math.min(LAKE_LOOK, d) }, l = lakeAt(s, ahead, 6);
  if (!l) return t;
  const ox = u.x - l.x, oy = u.y - l.y, o = Math.hypot(ox, oy) || 1, k = dx * -oy + dy * ox > 0 ? 1 : -1;
  const sx = -oy / o * k * 0.85 + ox / o * 0.15, sy = ox / o * k * 0.85 + oy / o * 0.15;
  return { x: u.x + sx * LAKE_LOOK, y: u.y + sy * LAKE_LOOK };
}

// a shot in flight, for the picture: from the shooter to where it lands, SHOT_TIME[kind] long (then a brief fade)
const shot = (s, u, to) => s.shots.push({ x1: u.x, y1: u.y, x2: to.x, y2: to.y, dur: SHOT_TIME[u.type], life: SHOT_TIME[u.type] + 0.12, side: u.side, kind: u.type });
