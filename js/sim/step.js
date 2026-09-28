// Sim: one simulation tick, and the public API object
function step(s, dt) {
  if (s.over || !(dt > 0)) return;
  s.t += dt;
  if (s.fogAt && !s.fog && s.t >= s.fogAt) s.fog = true; // the tutorial's fog comes down during the level
  for (const sq of s.squads) updateSquad(s, sq, dt);
  for (const sq of s.squads) initiative(s, sq, dt);
  for (const u of s.units) { u.lvl = TYPES[u.type].air ? 0 : levelAt(s, u); u.hill = u.lvl >= 1; }
  const bySquad = new Map(s.squads.map(q => [q.id, q]));
  for (const u of s.units) updateUnit(s, u, bySquad.get(u.squad), dt);
  separate(s);
  for (const u of s.units) if (u.hp <= 0) { s.fx.push({ x: u.x, y: u.y, life: 0.7, max: 0.7, size: 26 }); s.fallen.push({ x: u.x, y: u.y, type: u.type, side: u.side, hd: u.hd, t: s.t }); }
  if (s.fallen.length && s.t - s.fallen[0].t > FALLEN_T) s.fallen = s.fallen.filter(f => s.t - f.t <= FALLEN_T); // for the picture
  s.units = s.units.filter(u => u.hp > 0);
  for (const u of s.units) if (!TYPES[u.type].air && healSpot(s, u)) u.hp = Math.min(TYPES[u.type].hp, u.hp + BASE_HEAL * dt);
  // refilling ammunition: by a supply truck or one of the side's buildings
  if (s.supply) {
    const trucks = s.units.filter(u => u.type === 'truck' && !u.care);
    for (const u of s.units) if (SUPPLY[u.type] && u.sup < 1 && (trucks.some(m => m.side === u.side && dist(m, u) <= SUPPLY_R) || healSpot(s, u))) u.sup = Math.min(1, u.sup + SUPPLY_FILL * dt);
  }
  // medics and mechanics treat their kinds close to them
  const carers = s.units.filter(u => TYPES[u.type].care && !u.care);
  if (carers.length) for (const u of s.units) {
    const kind = CARER[u.type], max = TYPES[u.type].hp;
    if (kind && u.hp < max && carers.some(m => m !== u && m.type === kind && m.side === u.side && dist(m, u) <= CARE_R)) u.hp = Math.min(max, u.hp + CARE_HEAL * dt);
  }
  for (const f of s.fx) if (f.wait > 0) f.wait -= dt; else f.life -= dt; // a blast waits for its shot to land
  s.fx = s.fx.filter(f => f.life > 0);
  s.marks = s.marks.filter(k => s.t - k.t < MARK_LIFE);
  updateStructs(s, dt);
  deliver(s);
  fhqTrips(s);
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
}

const Sim = { SUPPLY, AI_STYLES, planFhq, _makeSquad: makeSquad, _fillSquad: fillSquad, formation, fhqCount, friction, dronesUp, DRONE_SIGHT, CARER, create, lakeAt, wobble, inHill, elevAt, levelAt, hillHeight, level, LEVELS: LEVELS.length, LEVEL_UI, levelUi: n => (LEVELS[n - 1] || { ui: LEVEL_UI }).ui, step, order, answer, orderDelay, quality, idLevel, understood, friendlyFire, drone, buildFhq, canBuildFhq, build, buildCheck, buildLimit, buildCount, share, boost, think, homeOf, UNIT_VALUE, NODES, STRUCTS, PRODUCERS, TEMPERS, setTrait, seen, note, MARK_LIFE, effOrder, TYPES, TRAITS, MULT, ORDER_NAME, H, DIFFS };
