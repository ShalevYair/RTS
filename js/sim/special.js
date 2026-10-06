// Sim: the special forces — the transport helicopter (soldiers on board, set down elsewhere); later the missiles,
// the missile defences, the commando
// who can ride a transport helicopter: anyone on foot (commandos too)
const RIDERS = [...FOOT, 'commando'];
const liftUnit = (s, id) => { const q = s.squads.find(k => k.id === id && !k.dead && k.type === 'lift'); return q && s.units.find(u => u.squad === q.id); };
// these squads go to the transport helicopter and get on (as many as it has room for); it waits for them
function board(s, ids, liftId) {
  const L = liftUnit(s, liftId); if (!L) return false;
  let n = 0;
  for (const id of ids) {
    const q = s.squads.find(k => k.id === id && !k.dead && k.side === L.side && RIDERS.includes(k.type) && !k.aboard);
    if (!q) continue;
    q.boarding = L.id; q.order = { type: 'hold', x: L.x, y: L.y, r: ORDER_R.hold, want: { x: L.x, y: L.y } }; q.arrived = false; q.retreating = false; n++;
  }
  if (!n) return false;
  const lq = s.squads.find(k => k.id === liftId); lq.order = { type: 'hold', x: L.x, y: L.y, r: ORDER_R.hold, want: { x: L.x, y: L.y } }; lq.drop = null;
  return true;
}
// the transport helicopter flies to (x, y), lands and sets its soldiers down there
function unload(s, liftId, x, y) {
  const L = liftUnit(s, liftId); if (!L || !(L.cargo && L.cargo.length)) return false;
  x = clamp(x, 10, s.W - 10); y = clamp(y, 10, s.H - 10);
  if (lakeAt(s, { x, y })) ({ x, y } = dryOf(s, { x, y }, 20)); // (not on the water)
  const lq = s.squads.find(k => k.id === liftId);
  lq.order = { type: 'hold', x, y, r: ORDER_R.hold, want: { x, y } }; lq.arrived = false; lq.drop = { x, y }; L.landT = 0;
  return true;
}
const aboard = (s, L) => (L.cargo || []).length;
// every tick: soldiers by their helicopter get on; one that got where it was sent sets them down; one shot down
// takes them with it
function liftTick(s, dt) {
  const lifts = new Map(s.units.filter(u => u.type === 'lift').map(u => [u.id, u]));
  for (const q of s.squads) {
    if (q.aboard && !lifts.has(q.aboard)) { q.aboard = null; q.boarding = null; } // (its helicopter fell: so did they)
    if (!q.boarding) continue;
    const L = lifts.get(q.boarding); if (!L) { q.boarding = null; continue; }
    q.order.x = L.x; q.order.y = L.y; q.order.want = { x: L.x, y: L.y }; // (after it)
    for (const u of s.units.filter(m => m.squad === q.id)) {
      if (aboard(s, L) >= TYPES.lift.cap || Math.hypot(u.x - L.x, u.y - L.y) > BOARD_R) continue;
      (L.cargo || (L.cargo = [])).push(u); u.ridden = true; q.aboard = L.id;
    }
    if (q.aboard && !s.units.some(m => m.squad === q.id && !m.ridden)) q.boarding = null; // (all on)
    if (aboard(s, L) >= TYPES.lift.cap && !q.aboard) q.boarding = null; // (no room)
  }
  s.units = s.units.filter(u => !u.ridden); // (on board: off the map, inside the helicopter)
  for (const L of lifts.values()) {
    const lq = s.squads.find(k => k.id === L.squad); if (!lq || !lq.drop) continue;
    if (!aboard(s, L)) { lq.drop = null; continue; } // (nobody on: no drop — the helicopter that had them was shot down, and the new one off the pad flew the same raid empty, again and again)
    if (Math.hypot(L.x - lq.drop.x, L.y - lq.drop.y) > 12) { L.landT = 0; continue; }
    L.landT = (L.landT || 0) + dt; if (L.landT < LAND_T) continue;
    const d = lq.drop, n = L.cargo.length;
    L.cargo.forEach((u, i) => {
      const a = i / n * Math.PI * 2, r = DROP_R * (0.5 + 0.5 * ((i * 7) % 3) / 2);
      u.x = clamp(d.x + Math.cos(a) * r, 5, s.W - 5); u.y = clamp(d.y + Math.sin(a) * r, 5, s.H - 5); u.ridden = false; s.units.push(u);
      const q = s.squads.find(k => k.id === u.squad);
      if (q) { q.aboard = null; q.boarding = null; q.retreating = false; q.peak = 0; q.order = { type: 'hold', x: u.x, y: u.y, r: ORDER_R.hold, want: { x: u.x, y: u.y } }; q.arrived = false; }
    });
    L.cargo = []; lq.drop = null;
  }
}

// ---- surface-to-surface missiles ----
// a building the side knows of near (x, y): seen now, or remembered
function knownFoeNode(s, side, x, y, R = 70) {
  let best = null, bd = R;
  for (const n of s.nodes) {
    if (n.side === side || n.hp <= 0 || n.kind === 'drone' || n.kind === 'hq' || n.kind === 'decoy') continue; // (not at the HQ — nor a fake one: that would tell them apart)
    if (s.fog && !s.visNodes[side].has(n.id) && !s.memNodes[side][n.id]) continue;
    const p = s.fog && !s.visNodes[side].has(n.id) ? s.memNodes[side][n.id] : n, d = Math.hypot(p.x - x, p.y - y) - nodeR(n);
    if (d < bd) { bd = d; best = { id: n.id, x: p.x, y: p.y }; }
  }
  return best;
}
// these missile trucks stop, set up and launch at the known building at (x, y) (again each time they're loaded, while
// it stands)
function launch(s, ids, x, y) {
  let ok = false;
  for (const id of ids) {
    const q = s.squads.find(k => k.id === id && !k.dead && k.type === 'ssm'); if (!q) continue;
    const tg = knownFoeNode(s, q.side, x, y); if (!tg) continue;
    q.fire = tg; q.order = { type: 'hold', x: q.cx, y: q.cy, r: ORDER_R.hold, want: { x: q.cx, y: q.cy } }; q.arrived = true; ok = true;
  }
  return ok;
}
function missileTick(s, dt) {
  s.missiles = s.missiles || [];
  for (const u of s.units) if (u.reload > 0) u.reload = Math.max(0, u.reload - dt);
  // the trucks: standing still, set up, launch
  for (const u of s.units) {
    if (u.type !== 'ssm') continue;
    const q = s.squads.find(k => k.id === u.squad), still = u.at && Math.hypot(u.x - u.at.x, u.y - u.at.y) < 0.5; u.at = { x: u.x, y: u.y };
    if (!q || !q.fire) { u.setup = 0; continue; }
    if (!s.nodes.some(n => n.id === q.fire.id && n.hp > 0)) { q.fire = null; u.setup = 0; continue; } // (gone: done)
    u.setup = still ? (u.setup || 0) + dt : 0;
    if (u.setup < SSM_SETUP || u.reload > 0) continue;
    s.missiles.push({ id: s.nextId++, side: u.side, x0: u.x, y0: u.y, x: q.fire.x, y: q.fire.y, node: q.fire.id, t0: s.t, by: q.id });
    u.reload = SSM_RELOAD; u.launchedAt = s.t;
    // (the launch is seen: the enemy now knows where the truck stands)
    s.mem[foeOf(u.side)][q.id] = { x: u.x, y: u.y, lvl: 2, t: s.t, type: 'ssm', air: false, n: 1, strength: q.strength };
    if (u.side === 'red') { note(s, 'שיגור טיל לעברנו!'); s.marks.push({ x: u.x, y: u.y, kind: 'missile', t: s.t }); }
    else { report(s, q, 'טיל שוגר'); s.marks.push({ x: u.x, y: u.y, kind: 'launch', t: s.t }); }
  }
  // in flight: Arrow takes it on halfway; landing, it brings the building down
  for (const m of s.missiles) {
    const f = (s.t - m.t0) / SSM_FLIGHT, at = { x: m.x0 + (m.x - m.x0) * Math.min(1, f), y: m.y0 + (m.y - m.y0) * Math.min(1, f) };
    if (f >= 0.5 && !m.met) {
      m.met = true;
      const R = ARROW_R_K * s.H, def = s.units.filter(u => u.type === 'arrow' && u.side !== m.side && !(u.reload > 0) && dist(u, at) <= R).sort((a, b) => dist(a, at) - dist(b, at))[0];
      if (def) {
        def.reload = ARROW_RELOAD; s.shots.push({ x1: def.x, y1: def.y, x2: at.x, y2: at.y, dur: 0.6, life: 0.72, side: def.side, kind: 'arrow' });
        if (s.rand() < ARROW_P) {
          m.gone = true; s.fx.push({ x: at.x, y: at.y, life: 0.8, max: 0.8, size: 30, wait: 0.6, air: true });
          (s.downed = s.downed || { blue: 0, red: 0 })[m.side]++; // (the AI's missile style gives up after a few)
          if (def.side === 'blue') note(s, 'חץ יירט טיל'); else note(s, 'הטיל שלנו יורט');
          s.marks.push({ x: at.x, y: at.y, kind: 'intercept', t: s.t, side: def.side });
        }
      }
    }
    if (m.gone || f < 1) continue;
    m.gone = true;
    const n = s.nodes.find(k => k.id === m.node && k.hp > 0 && Math.hypot(k.x - m.x, k.y - m.y) <= nodeR(k) + 20);
    if (n && n.kind !== 'hq') { n.hp = 0; n.by = m.by; }
    for (const u of s.units) if (!TYPES[u.type].air && Math.hypot(u.x - m.x, u.y - m.y) <= SSM_SPLASH) { u.hp -= SSM_SPLASH_DMG; u.by = m.by; }
    blastPiles(s, m.x, m.y, SSM_SPLASH); // (fuel barrels there: up they go — fuel.js)
    s.fx.push({ x: m.x, y: m.y, life: 1.2, max: 1.2, size: 60 });
  }
  s.missiles = s.missiles.filter(m => !m.gone);
}

// ---- artillery: the 200 mm gun and the MLRS (ARTY_* in config.js) ----
const TRACKED = ['tank', 'dozer']; // (an MLRS salvo only scratches these; everything else on the ground in it is gone)
function artyTick(s, dt) {
  for (const u of s.units) {
    const T = TYPES[u.type]; if (!T.arty || u.hp <= 0) continue;
    const still = u.aAt && Math.hypot(u.x - u.aAt.x, u.y - u.aAt.y) < 0.5; u.aAt = { x: u.x, y: u.y };
    u.setup = still ? (u.setup || 0) + dt : 0; u.acd = Math.max(0, (u.acd || 0) - dt);
    if (u.setup < ARTY_SETUP || u.acd > 0 || (s.logi && SUPPLY[u.type] && u.sup <= 0)) continue;
    const q = s.squads.find(k => k.id === u.squad); if (!q) continue;
    const R = ARTY_R * (1 + ELEV_RANGE * (u.lvl || 0)) * envRange(s, u), foe = foeOf(u.side), how = u.type === 'how';
    // what its side sees now, on the ground, in reach
    const foes = around(s, u.x, u.y, R).filter(e => e.side === foe && e.hp > 0 && !TYPES[e.type].air && dist(u, e) <= R && seen(s, u.side, e));
    const worth = e => (UNIT_VALUE[e.type] || 1) * (TRACKED.includes(e.type) && !how ? MLRS_TANK : 1);
    let at = null, best = 0;
    if (how) { for (const e of foes) { const w = worth(e) - dist(u, e) / (10 * R); if (w > best) { best = w; at = e; } } }
    else for (const e of foes) { let w = 0; for (const f of foes) if (Math.hypot(f.x - e.x, f.y - e.y) <= ARTY_AREA) w += worth(f); if (w > best) { best = w; at = e; } }
    let node = null;
    if (!at) node = s.nodes.find(n => n.side === foe && n.hp > 0 && n.kind !== 'drone' && dist(u, n) <= R + nodeR(n) && (!s.fog || s.visNodes[u.side].has(n.id)));
    if (!at && !node) continue;
    const tg = at || node;
    u.acd = how ? HOW_CD : MLRS_CD; u.lastFire = s.t; u.aim = Math.atan2(tg.y - u.y, tg.x - u.x);
    if (s.supply && SUPPLY[u.type]) u.sup = Math.max(0, u.sup - 1 / SUPPLY[u.type]);
    const hitU = e => { e.by = q.id; e.shotAt = s.t; e.shotBy = u.id; };
    if (node) node.hp -= how ? HOW_NODE : MLRS_NODE;
    else if (how) { at.hp = 0; hitU(at); }
    else for (const e of foes) if (Math.hypot(e.x - at.x, e.y - at.y) <= ARTY_AREA) { e.hp -= TRACKED.includes(e.type) ? MLRS_TANK * TYPES[e.type].hp : e.hp; hitU(e); }
    // (on the map: one big shell, or a salvo of rockets scattered over the area)
    const n = how ? 1 : MLRS_ROCKETS, fx = IMPACT[u.type];
    for (let i = 0; i < n; i++) {
      const a = s.rand() * 2 * Math.PI, r = how ? 0 : Math.sqrt(s.rand()) * ARTY_AREA * (node ? 0.5 : 1), p = { x: tg.x + Math.cos(a) * r, y: tg.y + Math.sin(a) * r };
      shot(s, u, p, u.type); s.fx.push({ x: p.x, y: p.y, life: fx.life, max: fx.life, size: fx.size, wait: SHOT_TIME[u.type] + i * 0.12 });
    }
    // (the firing is seen: the enemy now knows where it stands)
    s.mem[foe][q.id] = { x: u.x, y: u.y, lvl: 2, t: s.t, type: u.type, air: false, n: 1, strength: q.strength };
  }
}

// ---- Iron Dome and Trophy: a short missile (MISSILE_SHOTS) at `hit` stopped? (a unit or a building) ----
function shield(s, kind, hit, side) {
  if (!MISSILE_SHOTS.includes(kind)) return false;
  // Trophy on the tank itself
  if (hit.type === 'tank' && hit.trophy > 0) { hit.trophy--; s.fx.push({ x: hit.x, y: hit.y - 4, life: 0.3, max: 0.3, size: 8 }); return true; }
  // Iron Dome: a truck of the target's side with a missile ready, close enough
  const R = DOME_R_K * s.H, tside = hit.side;
  const d = s.units.find(u => u.type === 'dome' && u.side === tside && !(u.reload > 0) && dist(u, hit) <= R);
  if (!d) return false;
  d.reload = DOME_RELOAD; s.shots.push({ x1: d.x, y1: d.y, x2: hit.x, y2: hit.y, dur: 0.35, life: 0.47, side: d.side, kind: 'dome' });
  s.fx.push({ x: hit.x, y: hit.y - 14, life: 0.5, max: 0.5, size: 12, wait: 0.35, air: true });
  return true;
}
// Trophy: the tank workshop's upgrade (TROPHY_BUILD s, no tanks meanwhile), then on every tank out after it — or back
// by a workshop — refilling one every TROPHY_EVERY s
function upgrade(s, side, id) {
  const n = s.nodes.find(k => k.id === id && k.side === side && k.hp > 0 && s.t >= k.ready && STRUCTS[k.kind].upgrade);
  if (!n || n.upg || (s.trophy && s.trophy[side])) return false;
  n.upg = { kind: STRUCTS[n.kind].upgrade, until: s.t + TROPHY_BUILD }; return true;
}
function trophyTick(s, dt) {
  s.trophy = s.trophy || { blue: false, red: false };
  for (const n of s.nodes) if (n.upg && s.t >= n.upg.until && n.hp > 0) { s.trophy[n.side] = true; n.upg = null; if (n.side === 'blue') note(s, 'מעיל רוח מוכן: הטנקים יוצאים איתו'); }
  for (const u of s.units) {
    if (u.type !== 'tank' || !s.trophy[u.side]) continue;
    if (u.trophy === undefined) { // (out before it: gets it by a workshop)
      if (s.nodes.some(n => n.kind === 'tankshop' && n.side === u.side && n.hp > 0 && dist(n, u) <= nodeR(n) + 40)) u.trophy = TROPHY_MAX;
      continue;
    }
    if (u.trophy < TROPHY_MAX) { u.trophyT = (u.trophyT || 0) + dt; if (u.trophyT >= TROPHY_EVERY) { u.trophyT = 0; u.trophy++; } }
  }
}

// ---- the commando: a charge on an enemy building — standing still by it PLANT_T s (not firing), then it goes up ----
function commandoTick(s, dt) {
  for (const u of s.units) {
    if (u.type !== 'commando') continue;
    const still = u.at2 && Math.hypot(u.x - u.at2.x, u.y - u.at2.y) < 0.5; u.at2 = { x: u.x, y: u.y };
    const n = s.nodes.find(k => k.side !== u.side && k.hp > 0 && k.kind !== 'drone' && dist(k, u) <= nodeR(k) + PLANT_R);
    const hurt = u.was2 !== undefined && u.hp < u.was2; u.was2 = u.hp;
    if (!n || !still || hurt || s.t - u.lastFire < 1) { u.plant = 0; u.plantOn = null; continue; }
    if (u.plantOn !== n.id) { u.plantOn = n.id; u.plant = 0; }
    u.plant += dt;
    if (u.plant < PLANT_T) continue;
    u.plant = 0; n.hp = n.kind === 'hq' ? n.hp - (STRUCTS.hq.hp / 4 + 1) : 0; n.by = u.squad;
    s.fx.push({ x: n.x, y: n.y, life: 1.1, max: 1.1, size: 50 });
    const q = s.squads.find(k => k.id === u.squad); if (q && u.side === 'blue') report(s, q, `פוצצנו את ה${STRUCTS[n.kind].name}`);
  }
}
