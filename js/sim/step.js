// Sim: one simulation tick, and the public API object
function step(s, dt) {
  if (s.over || !(dt > 0)) return;
  s.t += dt; s.tk = (s.tk || 0) + 1; // (ticks: the units' turns to look round, see SCAN_EVERY)
  if (s.fogAt && !s.fog && s.t >= s.fogAt) s.fog = true; // the tutorial's fog comes down during the level
  // (a fallen single — a squad of one unit — is dropped after a while: there are many of them over a game)
  s.squads = s.squads.filter(q => !(q.single && q.dead && s.t - (q.deadAt ?? s.t) > 30));
  unitGrid(s);
  const of = new Map(); for (const u of s.units) { let l = of.get(u.squad); if (!l) of.set(u.squad, l = []); l.push(u); }
  for (const sq of s.squads) updateSquad(s, sq, dt, of);
  for (const sq of s.squads) initiative(s, sq, dt);
  for (const u of s.units) { u.lvl = TYPES[u.type].air ? 0 : levelAt(s, u); u.hill = u.lvl >= 1; }
  const bySquad = new Map(s.squads.map(q => [q.id, q]));
  for (const u of s.units) updateUnit(s, u, bySquad.get(u.squad), dt);
  underFire(s);
  separate(s, dt);
  postsTick(s); // (soldiers walking into posts)
  for (const u of s.units) if (u.hp <= 0) { const k = u.by && s.squads.find(q => q.id === u.by); if (k && k.side !== u.side) { gainXp(s, k, UNIT_VALUE[u.type]); scoreUp(s, k.side, SCORE[u.type] || SCORE_UNIT); } s.fx.push({ x: u.x, y: u.y, life: 0.7, max: 0.7, size: 26 }); s.fallen.push({ x: u.x, y: u.y, type: u.type, side: u.side, hd: u.hd, t: s.t }); }
  if (s.fallen.length && s.t - s.fallen[0].t > FALLEN_T) s.fallen = s.fallen.filter(f => s.t - f.t <= FALLEN_T); // for the picture
  s.units = s.units.filter(u => u.hp > 0);
  for (const u of s.units) if (!TYPES[u.type].air && healSpot(s, u)) u.hp = Math.min(TYPES[u.type].hp, u.hp + BASE_HEAL * dt);
  // refilling ammunition: by a supply truck or one of the side's buildings
  if (s.logi) { for (const u of s.units) if (SUPPLY[u.type] && u.sup < 1 && postNear(s, u, 'supply')) u.sup = Math.min(1, u.sup + SUPPLY_FILL * dt); } // (s.logi: trucks, fuel.js; a held supply post as before)
  else if (s.supply) {
    // (the trucks near it only, from the tick's grid: all of them for every unit was slow in a big battle)
    const truck = u => around(s, u.x, u.y, SUPPLY_R).some(m => m.type === 'truck' && !m.care && m.hp > 0 && m.side === u.side && dist(m, u) <= SUPPLY_R);
    for (const u of s.units) if (SUPPLY[u.type] && u.sup < 1 && (truck(u) || healSpot(s, u) || postNear(s, u, 'supply'))) u.sup = Math.min(1, u.sup + SUPPLY_FILL * dt);
  }
  // medics and mechanics treat their kinds close to them
  // (those near it only, from the tick's grid)
  if (s.units.some(u => TYPES[u.type].care && !u.care)) for (const u of s.units) {
    const kind = CARER[u.type], max = TYPES[u.type].hp;
    if (kind && u.hp < max && around(s, u.x, u.y, CARE_R).some(m => m !== u && m.type === kind && !m.care && m.hp > 0 && m.side === u.side && dist(m, u) <= CARE_R)) u.hp = Math.min(max, u.hp + CARE_HEAL * dt);
  }
  // held posts: a hospital heals soldiers, a garage vehicles, round them
  if (s.posts) for (const u of s.units) {
    const kind = CARER[u.type] === 'med' ? 'hospital' : CARER[u.type] === 'mech' && !TYPES[u.type].air ? 'motorpool' : null, max = TYPES[u.type].hp;
    if (kind && u.hp < max && postNear(s, u, kind)) u.hp = Math.min(max, u.hp + POST_HEAL * dt);
  }
  for (const f of s.fx) if (f.wait > 0) f.wait -= dt; else f.life -= dt; // a blast waits for its shot to land
  s.fx = s.fx.filter(f => f.life > 0);
  s.marks = s.marks.filter(k => s.t - k.t < MARK_LIFE);
  updateStructs(s, dt);
  liftTick(s, dt); missileTick(s, dt); artyTick(s, dt); trophyTick(s, dt); commandoTick(s, dt);
  deliver(s);
  fhqTrips(s);
  hqTrips(s);
  dozerWork(s, dt); roadWork(s, dt); fuelTick(s, dt);
  supportSpawn(s, dt);
  calls(s);
  record(s, dt);
  for (const sh of s.shots) sh.life -= dt;
  s.shots = s.shots.filter(sh => sh.life > 0);
  visibility(s);
  for (const side of s.bots) { s.aiIn[side] -= dt; if (s.aiIn[side] <= 0) s.aiIn[side] = think(s, side, side === 'red' ? s.diff : s.botDiff); }
  // collapse (DESIGN.md §4): below COLLAPSE of the total power, a side is beaten
  updatePower(s);
  if (s.t >= (s.collapseAfter ?? COLLAPSE_AFTER)) {
    const b = share(s, 'blue'), k = s.collapseAt ?? COLLAPSE;
    if (b < k) s.over = 'red'; else if (1 - b < k) s.over = 'blue';
  }
  // the HQ falls: that side has lost, at once (where there are HQs: the first levels have none)
  if (!s.over && s.hqDown) s.over = s.hqDown === 'blue' ? 'red' : 'blue';
}

const Sim = { SCORE, SCORE_NODE, SCORE_NODES, specOf, aiCounter, AI_THREATS, ARTY_R, ARTY_SETUP, HOW_CD, MLRS_CD, ARTY_AREA, MLRS_TANK, HOW_NODE, MLRS_NODE, AI_MISSILE_MISS, TANKER_CAP, TANKER_T, tankerSpot, ARRIVE_LEAVE, needsWater, TRUCK_CAP, TRUCK_R, WATER_T, LIGHT_AT, onShore, shoreSpots, LOGI_KINDS, needsFuel, FUEL_T, FUEL_AIR, FUEL_LOW, FUEL_LOAD, FUEL_BARRELS, FUEL_MAKE, PILE_MAX, blastPiles, ensureGround, GR_ROAD, ROAD_K, ROAD_T, ROAD_MUD_K, planRoad, roadCheck, roadCells, roadOf, GR_WOOD, GR_MUD, GR_CLIFF, GR_CUT, GROUND_CLIFF_W, groundAt, groundOk, moveClass, GROUND_K, groundBad, BUNKER_R, extras, setRoads, onRoad, weatherAt, fogAt, envSight, envRange, envHit, skySight, ambushed, POSTS, POST_R, TOWER_SIGHT, POST_SIGHT, RADAR_K, POWER_K, FUEL_K, BUNKER_K, CAPTURERS, ROAD_FAST, NIGHT_SIGHT, NIGHT_RANGE, NIGHT_MISS, WX_K, setFront, setCover, inCover, sendCare, BUILD_UNITS, PLANT_T, STEALTH_EYE, launch, upgrade, knownFoeNode, SSM_SETUP, SSM_FLIGHT, SSM_RELOAD, TROPHY_MAX, TROPHY_BUILD, ARROW_R_K, DOME_R_K, board, unload, RIDERS, demolish, NIGHT_LEVELS, NIGHT_STEP, NIGHT_FADE, rally, pack, PACK_AT, clearAt, fhqCheck, FHQ_AFTER_HQ, fhqBuilders, assignSite, jobOf, isSite, dozers, SUPPORT_EVERY, SUPPORT_CAP, DOZER_R, fhqMax, openField, planHq, hqCheck, hqBand, cmdSquad, HQ_BAND, HQ_WARM, _garbled: garbled, _supplyUse: supplyUse, BUILDABLE, DECOY_MAX, silence, nightAt, rankOf, RANK_XP, SILENT_SPEED, SUPPLY, AI_STYLES, planFhq, _makeSquad: makeSquad, _fillSquad: fillSquad, formation, fhqCount, friction, dronesUp, DRONE_SIGHT, CARER, nodeSpec, create, lakeAt, wobble, inHill, elevAt, levelAt, hillHeight, level, LEVELS: LEVELS.length, LEVEL_UI, levelUi: n => (LEVELS[n - 1] || { ui: LEVEL_UI }).ui, step, order, answer, orderDelay, quality, idLevel, understood, friendlyFire, drone, buildFhq, canBuildFhq, build, buildCheck, buildLimit, buildCount, share, boost, think, homeOf, UNIT_VALUE, NODES, STRUCTS, PRODUCERS, TEMPERS, setTrait, seen, note, MARK_LIFE, effOrder, TYPES, TRAITS, MULT, ORDER_NAME, H, DIFFS };
