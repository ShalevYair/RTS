// Sim: squad state, commander initiative and per-unit movement / combat
function updateSquad(s, sq, dt, of) {
  const m = of ? of.get(sq.id) || [] : s.units.filter(u => u.squad === sq.id); // (of: each squad's units, worked out once a tick)
  sq.count = m.length;
  if (!m.length) {
    if (sq.aboard) { sq.count = 0; return; } // (all on board a helicopter: not gone)
    if (!sq.dead) {
      sq.dead = true; sq.deadAt = s.t; sq.strength = 0; report(s, sq, 'הכוח הושמד'); sq.silent = false; sendReport(s, sq, 'lost');
      Object.assign(sq, newBoss(s, sq.side)); sq.xp = 0; // the commander fell with his squad; the refills bring a new one
    }
    return;
  }
  let fresh = false;
  if (sq.dead) { sq.dead = false; fresh = true; report(s, sq, sq.born ? 'הכוח הוקם מחדש מהתגבורת' : 'יצאנו לדרך'); sq.born = true; }
  const T = TYPES[sq.type], tr = TRAITS[sq.trait];
  sq.strength = m.reduce((a, u) => a + u.hp, 0) / (sq.size * T.hp);
  sq.peak = fresh ? sq.strength : Math.max(sq.peak ?? 0, sq.strength); // (the strongest it's been since it was raised)
  const body = bodyCenter(m); sq.cx = body.x; sq.cy = body.y;
  // the line: a place for each unit that isn't away for treatment, facing the enemy (turning toward a new threat)
  const line = m.filter(u => !u.care);
  // (or a block: rows of blockCols across, front to back)
  if (packed(sq, sq.order.form ? sq.packN : m.length)) {
    const cols = blockCols(line.length), rows = Math.ceil(line.length / cols);
    line.forEach((u, i) => { const c = i % cols, r = Math.floor(i / cols), inRow = r < rows - 1 ? cols : line.length - r * cols; u.slot = c - (inRow - 1) / 2; u.row = r - (rows - 1) / 2; });
  } else line.forEach((u, i) => { u.slot = i - (line.length - 1) / 2; u.row = 0; });
  if (sq.order.form && !sq.support && !sq.order.form.fixed) placeForm(s, sq, dt); // (fixed: placed once, when the order came)
  const want = faceAt(s, sq.side, effOrder(s, sq), sq.order.form && sq.order.form.fa);
  sq.face = sq.face === undefined ? want : turnTo(sq.face, want, FACE_TURN * dt);
  const c = { x: sq.cx, y: sq.cy };
  if (fresh) sendReport(s, sq);
  // heavy losses: under the line after being above it (a squad still filling up hasn't lost anything)
  // (part of it on board a helicopter isn't a loss)
  if (!sq.retreating && !sq.boarding && !sq.aboard && sq.order.type !== 'retreat' && sq.strength < retreatAt(s, sq) && sq.peak >= retreatAt(s, sq)) {
    sq.retreating = true;
    report(s, sq, `אבדות כבדות (${Math.round(sq.strength * 100)}%), נסוג להתארגנות`); sendReport(s, sq, 'hit');
  }
  const home = homeOf(s, sq), atHome = dist(c, home) <= HEAL_R + 20 + nodeR(home);
  if (sq.retreating && sq.strength >= 0.8 && atHome) {
    sq.retreating = false; sq.arrived = false; report(s, sq, 'התארגנו, חוזרים למשימה');
  }
  if (!sq.arrived && !sq.retreating && !sq.support && (sq.order.type === 'retreat' ? atHome : dist(c, sq.order) < sq.order.r)) {
    // (a bulldozer at its site says nothing: it just gets to work)
    sq.arrived = true; if (!(sq.type === 'dozer' && sq.jobAt)) { report(s, sq, sq.order.type === 'retreat' ? 'הגענו לבסיס' : 'הגענו ליעד'); sendReport(s, sq, 'ok'); }
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

// under fire (the player's squads, standing where they were sent): a fighting one that can hit the shooter and isn't
// already firing goes at it; one that doesn't fight falls back toward the HQ, FLEE_D (not all the way). Once per
// REACT_EVERY s a squad
// (the squad's own doing: exactly where it means, nothing said on the radio)
const selfOrder = (sq, type, x, y) => { sq.order = { type, x, y, r: ORDER_R[type], want: { x, y } }; sq.arrived = false; sq.support = null; };
function underFire(s) {
  const byId = new Map(s.units.map(u => [u.id, u]));
  for (const u of s.units) {
    if (!(s.t - (u.shotAt ?? -99) < 1) || TYPES[u.type].air || !singles(s, u.side)) continue;
    const sq = s.squads.find(q => q.id === u.squad), a = byId.get(u.shotBy);
    if (!sq || sq.dead || !a || a.side === u.side || s.t - (sq.reactAt ?? -99) < REACT_EVERY || sq.retreating || sq.boarding || u.care || u.resup) continue;
    if (TYPES[u.type].care) {
      const h = hqOf(s, u.side); if (!h) continue;
      const d = dist(u, h), go = Math.min(FLEE_D, d - nodeR(h) - 30); if (go < 20) continue;
      sq.reactAt = s.t; selfOrder(sq, 'hold', u.x + (h.x - u.x) / d * go, u.y + (h.y - u.y) / d * go);
    } else if (sq.arrived && MULT[u.type][a.type] > 0 && s.t - u.lastFire > 1.5) { sq.reactAt = s.t; selfOrder(sq, 'attack', a.x, a.y); }
  }
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
      if (T.hover) { if (d > 6) moveTo(s, u, f.x + u.sx * 14, f.y + u.sy * 14, 1, dt); } // (a helicopter sets down by its pad)
      else circle(s, u, f.x, f.y, AIR_ORBIT * 0.7, dt); // (over the field while they rearm it)
      return;
    }
  }
  // care: badly hurt, the unit leaves the fight on its own for the nearest medic / mechanic (or home), holding its fire
  if (CARER[u.type]) {
    if (!u.care && u.hp < CARE_AT * T.hp) u.care = true;
    else if (u.care && u.hp >= (u.careFull ? 0.995 : CARE_DONE) * T.hp) { u.care = false; u.careFull = false; const f = sq.single && !FRONT_NOT.includes(u.type) && s.front && s.front[u.side]; if (f) selfOrder(sq, 'attack', f.x, f.y); } // (sent by the player: until whole; treated: off to the front, if there is one)
  }
  // and low on ammunition: off to the nearest supply truck (or home), holding fire, until refilled
  if (s.supply && SUPPLY[u.type]) {
    if (!u.resup && u.sup < SUPPLY_LOW) u.resup = true;
    else if (u.resup && u.sup >= SUPPLY_DONE) u.resup = false;
  } else u.resup = false;
  if (u.care || u.resup) { const f = careSpot(s, u, sq, u.care ? CARER[u.type] : 'truck'); if (dist(u, f) > CARE_R * 0.6) moveTo(s, u, f.x, f.y, 1.15, dt); return; }
  // (on its way to get on a helicopter: straight to it, not to a place in a line)
  if (sq.boarding) { const L = s.units.find(m => m.id === sq.boarding); if (L) { moveTo(s, u, L.x, L.y, 1.1, dt); return; } }
  u.hush = sq.silent; // (radio silence: quiet driving, no dust)
  const o = effOrder(s, sq), retreat = sq.retreating || o.type === 'retreat';
  const anchor = retreat ? homeOf(s, sq) : o;
  const up = 1 + ELEV_BONUS * (u.lvl || 0), range = T.range * up, sight = T.sight * up; // higher ground: further
  const leash = o.r * TRAITS[sq.trait].leash;
  // (AA soldiers at something on the ground: their rifle — gun — not their missiles)
  const gunAt = e => T.gun && !(e.kind ? false : TYPES[e.type].air) ? T.gun : null, reach = e => { const G = gunAt(e); return G ? G.range * up : range; };
  const hk = hurtK(u); // (hurt: weaker and slower)
  let best = null, bd = Infinity, bw = Infinity, near = null, nd = Infinity;
  const lim = Math.max(sight, range, T.gun ? T.gun.range * up : 0); // (nothing further than this counts: a quick square test first)
  for (const e of around(s, u.x, u.y, lim)) {
    if (e.side === u.side || e.hp <= 0 || e.x - u.x > lim || u.x - e.x > lim || e.y - u.y > lim || u.y - e.y > lim || !MULT[u.type][e.type]) continue; // 0 = can't hit it (only AA hits aircraft)
    // prefer targets this unit type is effective against
    // prefer what this unit hurts most, and finishing off the wounded
    const d = dist(u, e), w = d / (MULT[u.type][e.type] + 0.2) * (0.6 + 0.4 * e.hp / TYPES[e.type].hp), rg = reach(e);
    if (d <= rg && w < nd) { nd = w; near = e; }
    if (!retreat && d <= sight && dist(anchor, e) <= leash + rg && w < bw) { bw = w; bd = d; best = e; }
  }
  const bestR = best ? reach(best) : range, tgt = best && bd <= bestR ? best : near;
  // nothing else to shoot at: hit an enemy forward HQ or (AA only) a drone in range
  if (!tgt && !retreat && u.cd === 0 && !T.care && !T.stealth) { // (a commando doesn't shoot at buildings: he blows them up)
    const G = n => n.kind !== 'drone' && T.gun ? T.gun : null; // (a building: the rifle too; a drone: a missile)
    const n = s.nodes.find(n => nodeTargetable(u, n) && dist(u, n) <= (G(n) ? G(n).range * up : range) + nodeR(n));
    if (n) {
      const g = G(n), as = g ? g.as : u.type;
      u.engaged = true; if (!shield(s, as, n)) n.hp -= (g ? g.dmg * NODE_MULT[as] : T.dmg * NODE_MULT[u.type]) * hk; u.cd = g ? g.cd : T.cd; if (T.ammo) u.ammo--; if (s.supply && SUPPLY[u.type]) u.sup -= supplyUse(s, u) / SUPPLY[u.type];
      u.aim = Math.atan2(n.y - u.y, n.x - u.x); u.lastFire = s.t;
      shot(s, u, n, as);
      s.fx.push({ x: n.x, y: n.y, life: IMPACT[as].life, max: IMPACT[as].life, size: IMPACT[as].size, wait: SHOT_TIME[as] });
    }
  }
  if (tgt) {
    u.engaged = true;
    if (u.cd === 0) {
      const hit = friendlyFire(s, u, sq, tgt) || tgt, g = gunAt(hit), as = g ? g.as : u.type;
      // (a missile may be stopped: Iron Dome, Trophy)
      if (!shield(s, as, hit) && !(inCover(s, hit) && s.rand() < COVER_MISS)) hit.hp -= (g ? g.dmg * MULT[as][hit.type] : T.dmg * MULT[u.type][hit.type]) * hk; hit.by = sq.id; hit.shotAt = s.t; hit.shotBy = u.id; u.cd = g ? g.cd : T.cd; if (T.ammo) u.ammo--; if (s.supply && SUPPLY[u.type]) u.sup -= supplyUse(s, u) / SUPPLY[u.type];
      const fx = IMPACT[as];
      s.fx.push({ x: hit.x + (s.rand() - 0.5) * 6, y: hit.y + (s.rand() - 0.5) * 6, life: fx.life, max: fx.life, size: fx.size, wait: SHOT_TIME[as] });
      u.aim = Math.atan2(hit.y - u.y, hit.x - u.x); u.lastFire = s.t;
      shot(s, u, hit, as);
    }
  }
  let tx, ty;
  // (a tank goes for soldiers it's shooting at, to run them over)
  if (best && (bd > bestR * 0.9 || (u.type === 'tank' && FOOT.includes(best.type)))) { tx = best.x; ty = best.y; }
  else if (best) { if (T.air && !T.hover) circle(s, u, best.x, best.y, range * 0.6, dt); return; } // (aircraft wheel over what they shoot at; helicopters hover)
  else if (retreat) { tx = anchor.x + u.sx * 18; ty = anchor.y + u.sy * 18; }
  else if (T.air && !T.hover) { const sr = o.r * 0.55; circle(s, u, anchor.x + u.sx * sr, anchor.y + u.sy * sr, AIR_ORBIT, dt); return; }
  else { const sp = spacing(u.type), g = (u.slot || 0) * sp, b = (u.row || 0) * sp, a = sq.face || 0; tx = anchor.x - Math.sin(a) * g - Math.cos(a) * b; ty = anchor.y + Math.cos(a) * g - Math.sin(a) * b; } // in the line (or block)
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
  if (!T.air && !keep && !s.noGiveUp && singles(s, u.side) && giveUp(s, u, tx, ty)) return; // (the player's units: the AI's squads waited on them, and bot games stalled)
  if (!T.air && s.lakes.length) ({ x: tx, y: ty } = wade(s, u, tx, ty));
  if (!T.air) ({ x: tx, y: ty } = skirt(s, u, tx, ty));
  if (!T.air && !s.noSteer) ({ x: tx, y: ty } = steer(s, u, tx, ty, dt)); // (s.noSteer: off, to compare)
  const vx = tx - u.x, vy = ty - u.y, d = Math.hypot(vx, vy);
  if (d <= 2 && !keep) { u.stuck = 0; return; }
  let slope = 1;
  if (!T.air) { const L = 6, e0 = elevAt(s, u), e1 = elevAt(s, { x: u.x + vx / d * L, y: u.y + vy / d * L }); slope = 1 - clamp((e1 - e0) / L * SLOPE_K, -SLOPE_MAX, SLOPE_MAX); }
  const sp = T.speed * hurtK(u); // (hurt: slower)
  const k = keep ? sp * fast * dt / Math.max(d, 1e-6) : Math.min(1, sp * slope * fast * dt / d); // (keep: at full speed, even past the point)
  u.x += vx * k; u.y += vy * k; u.hd = Math.atan2(vy, vx);
  if (!T.air && !u.hush && d * k >= DUST_FAST * T.speed * dt) u.dustAt = s.t; // (driving fast: dust the enemy can see from afar)
}
// the trees (each { x, y, r }; one run over or cleared by a building has .gone), in a grid of COVER_CELL
function setCover(s, trees) {
  const G = new Map();
  for (const t of trees) { const k = Math.floor(t.x / COVER_CELL) + ',' + Math.floor(t.y / COVER_CELL); let l = G.get(k); if (!l) G.set(k, l = []); l.push(t); }
  s.cover = G;
}
// a soldier or jeep under a tree's crown
function inCover(s, u) {
  if (!s.cover || !COVER.includes(u.type)) return false;
  const i0 = Math.floor(u.x / COVER_CELL), j0 = Math.floor(u.y / COVER_CELL);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const l = s.cover.get(i + ',' + j); if (l) for (const t of l) if (!t.gone && (t.x - u.x) ** 2 + (t.y - u.y) ** 2 < t.r * t.r) return true;
  }
  return false;
}
// a ground unit that hasn't got any nearer to its spot (within GIVEUP_R of it) for GIVEUP_T s stops trying, stands
// GIVEUP_REST–GIVEUP_REST + GIVEUP_JIT s, and tries again (a new spot: at once). true = stand this tick
function giveUp(s, u, tx, ty) {
  const gd = Math.hypot(tx - u.x, ty - u.y);
  if (!u.goal || Math.hypot(u.goal.x - tx, u.goal.y - ty) > 20 || gd > GIVEUP_R || gd <= 2) { u.goal = { x: tx, y: ty, best: gd, t: s.t }; u.rest = 0; return false; }
  if (u.rest > s.t) return true;
  if (gd < u.goal.best - 4) { u.goal.best = gd; u.goal.t = s.t; return false; }
  if (s.t - u.goal.t < GIVEUP_T) return false;
  // (only when it's our own units in the way, and not in a fight: chasing, or blocked by the enemy, it keeps going)
  const ru = TYPES[u.type].r;
  if (s.t - u.lastFire < 3 || !s.units.some(b => b !== u && b.side === u.side && !TYPES[b.type].air && Math.hypot(b.x - u.x, b.y - u.y) < ru + TYPES[b.type].r + UNIT_GAP + 6)) { u.goal.t = s.t; u.goal.best = gd; return false; }
  const h = Math.sin(u.id * 12.9898 + s.t * 78.233) * 43758.5453; // (how long: by the unit and the moment, not the game's dice)
  u.rest = s.t + GIVEUP_REST + GIVEUP_JIT * (h - Math.floor(h)); u.goal.t = u.rest; u.goal.best = gd; u.stuck = 0;
  return true;
}
// a ground unit about to run into another of its side turns aside (STEER_*): both moving — 90° to its right (the other does
// the same: they pass); the other standing — 45°, away from it. One that means to move but hasn't got anywhere for
// STUCK_T s (a lake's corner, between buildings) takes a detour to its right for DETOUR_T s.
const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
function steer(s, u, tx, ty, dt) {
  const vx = tx - u.x, vy = ty - u.y, d = Math.hypot(vx, vy), ru = TYPES[u.type].r;
  const at = u.was ? Math.hypot(u.x - u.was.x, u.y - u.was.y) : 0; u.was = { x: u.x, y: u.y };
  if (d < 8) { u.stuck = 0; return { x: tx, y: ty }; }
  u.moving = s.t; // (it means to move this tick)
  u.stuck = at < TYPES[u.type].speed * dt * 0.15 ? (u.stuck || 0) + dt : 0;
  if (u.stuck > STUCK_T) { u.detour = s.t + DETOUR_T; u.stuck = 0; }
  const ux = vx / d, uy = vy / d, step = Math.min(d, 30);
  if (u.detour > s.t) { const r = rot(ux, uy, Math.PI / 2); return { x: u.x + r.x * step, y: u.y + r.y * step }; }
  let o = null, oa = Infinity, oc = 0;
  for (const b of around(s, u.x, u.y, ru + MAX_R + UNIT_GAP + STEER_LOOK)) {
    if (b === u || TYPES[b.type].air) continue;
    const ox = b.x - u.x, oy = b.y - u.y, rr = ru + TYPES[b.type].r + UNIT_GAP, look = rr + STEER_LOOK;
    if (ox > look || ox < -look || oy > look || oy < -look) continue;
    const along = ox * ux + oy * uy, cross = ox * uy - oy * ux; // (cross > 0: it's on our left)
    if (along <= 0 || along > look || Math.abs(cross) >= rr * 0.8 || along >= d) continue; // (behind, beside, or past the goal)
    if (u.side !== b.side || Math.hypot(tx - b.x, ty - b.y) < rr * 1.5) continue; // (only our own: an enemy is what it goes for; nor one at the goal)
    if (along < oa) { oa = along; o = b; oc = cross; }
  }
  if (!o) return { x: tx, y: ty };
  const moving = o.moving !== undefined && s.t - o.moving < 0.25;
  if (moving && Math.cos(o.hd - Math.atan2(uy, ux)) > 0.3) return { x: tx, y: ty }; // (going our way, ahead of us: no collision)
  const r = rot(ux, uy, moving ? Math.PI / 2 : (oc > 0 ? Math.PI / 4 : -Math.PI / 4));
  return { x: u.x + r.x * step, y: u.y + r.y * step };
}
// ground units go round their own side's buildings: with one close ahead in the straight way (and the goal not the building itself or
// right by it), the step is along its edge, on the side toward the goal. (Else a unit behind a building — pushed
// there by it, or on the map's edge side — drove into it forever.)
function skirt(s, u, tx, ty) {
  const vx = tx - u.x, vy = ty - u.y, d = Math.hypot(vx, vy); if (d < 1) return { x: tx, y: ty };
  for (const n of s.nodes) {
    if (n.kind === 'drone' || n.hp <= 0 || n.side !== u.side) continue; // (its own side's: the enemy's are what it goes for)
    const R = STRUCTS[n.kind].r + TYPES[u.type].r + 4, ox = n.x - u.x, oy = n.y - u.y, od = Math.hypot(ox, oy);
    if (od > R + SKIRT_AHEAD || Math.hypot(tx - n.x, ty - n.y) < R + 15) continue;
    const along = (ox * vx + oy * vy) / d; if (along <= 0 || along > d) continue; // (behind, or past the goal)
    if (Math.abs(ox * vy - oy * vx) / d >= R) continue; // (the way passes it by)
    // (the way round: a right angle off the line to its middle, on the side the goal is)
    const side = (ox * vy - oy * vx) > 0 ? 1 : -1, px = -oy / od * side, py = ox / od * side;
    return { x: u.x + px * SKIRT_STEP + ox / od * Math.max(0, od - R) * 0.5, y: u.y + py * SKIRT_STEP + oy / od * Math.max(0, od - R) * 0.5 };
  }
  return { x: tx, y: ty };
}
// where a hurt unit goes: the nearest medic / mechanic of its side that isn't itself being treated, else home
// (kind: who to go to — a medic / mechanic for treatment, a supply truck for ammunition)
// — or the building that raises them (a medics' tent, a garage: by its edge), when that is nearer
function careSpot(s, u, sq, kind = CARER[u.type]) {
  let best = null, bd = Infinity;
  for (const m of s.units) if (m.type === kind && m.side === u.side && m !== u && !m.care) { const d = dist(u, m); if (d < bd) { bd = d; best = m; } }
  if (kind !== 'truck') for (const n of s.nodes) {
    if (n.side !== u.side || n.hp <= 0 || s.t < n.ready || !STRUCTS[n.kind] || STRUCTS[n.kind].unit !== kind) continue;
    const d = dist(u, n), e = nodeR(n) + TYPES[u.type].r + 8;
    if (d - e < bd) { bd = d - e; best = d > 1 ? { x: n.x + (u.x - n.x) / d * e, y: n.y + (u.y - n.y) / d * e } : n; }
  }
  return best || homeOf(s, sq);
}
// the player sends hurt units of these squads to be treated (the nearest medic / mechanic, or their building) until
// whole; returns how many went
function sendCare(s, ids) {
  let n = 0;
  for (const u of s.units) if (ids.includes(u.squad) && CARER[u.type] && u.hp < 0.97 * TYPES[u.type].hp) { u.care = true; u.careFull = true; n++; }
  return n;
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
// (kind: what it looks like — an AA soldier's rifle shot looks like an infantryman's)
const shot = (s, u, to, kind = u.type) => s.shots.push({ x1: u.x, y1: u.y, x2: to.x, y2: to.y, dur: SHOT_TIME[kind], life: SHOT_TIME[kind] + 0.12, side: u.side, kind });
