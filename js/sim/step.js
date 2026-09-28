// Sim: one simulation tick, and the public API object
function step(s, dt) {
  if (s.over || !(dt > 0)) return;
  s.t += dt;
  for (const sq of s.squads) updateSquad(s, sq, dt);
  for (const sq of s.squads) initiative(s, sq, dt);
  for (const u of s.units) u.hill = !TYPES[u.type].air && inHill(s, u);
  const bySquad = new Map(s.squads.map(q => [q.id, q]));
  for (const u of s.units) updateUnit(s, u, bySquad.get(u.squad), dt);
  separate(s);
  for (const u of s.units) if (u.hp <= 0) s.fx.push({ x: u.x, y: u.y, life: 0.7, max: 0.7, size: 26 });
  s.units = s.units.filter(u => u.hp > 0);
  for (const u of s.units) if (!TYPES[u.type].air && healSpot(s, u)) u.hp = Math.min(TYPES[u.type].hp, u.hp + BASE_HEAL * dt);
  for (const f of s.fx) f.life -= dt;
  s.fx = s.fx.filter(f => f.life > 0);
  s.marks = s.marks.filter(k => s.t - k.t < MARK_LIFE);
  updateStructs(s, dt);
  deliver(s);
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

const Sim = { create, lakeAt, level, LEVELS: LEVELS.length, LEVEL_UI, levelUi: n => (LEVELS[n - 1] || { ui: LEVEL_UI }).ui, step, order, answer, orderDelay, quality, idLevel, understood, friendlyFire, drone, buildFhq, canBuildFhq, build, buildCheck, buildLimit, buildCount, share, boost, think, homeOf, UNIT_VALUE, NODES, STRUCTS, PRODUCERS, TEMPERS, setTrait, seen, note, MARK_LIFE, effOrder, TYPES, TRAITS, MULT, ORDER_NAME, H, DIFFS };
