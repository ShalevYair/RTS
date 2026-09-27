// Sim: one simulation tick, and the public API object
function step(s, dt) {
  if (s.over || !(dt > 0)) return;
  s.t += dt;
  for (const sq of s.squads) updateSquad(s, sq, dt);
  for (const sq of s.squads) initiative(s, sq, dt);
  const bySquad = new Map(s.squads.map(q => [q.id, q]));
  for (const u of s.units) updateUnit(s, u, bySquad.get(u.squad), dt);
  separate(s);
  for (const u of s.units) if (u.hp <= 0) s.fx.push({ x: u.x, y: u.y, life: 0.7, max: 0.7, size: 26 });
  s.units = s.units.filter(u => u.hp > 0);
  for (const u of s.units) if (inBase(s, u.side, u)) {
    u.hp = Math.min(TYPES[u.type].hp, u.hp + BASE_HEAL * dt);
    if (TYPES[u.type].ammo && !u.rearm && dist(u, s.bases[u.side].fac.air) < 25) u.ammo = TYPES[u.type].ammo;
  }
  for (const f of s.fx) f.life -= dt;
  s.fx = s.fx.filter(f => f.life > 0);
  s.marks = s.marks.filter(k => s.t - k.t < MARK_LIFE);
  updateEyes(s, dt);
  deliver(s);
  calls(s);
  record(s, dt);
  for (const sh of s.shots) sh.life -= dt;
  s.shots = s.shots.filter(sh => sh.life > 0);
  capture(s, dt);
  reinforce(s, dt);
  visibility(s);
  s.aiIn -= dt;
  if (s.aiIn <= 0) s.aiIn = enemyAI(s);
  if (s.score.blue >= s.WIN) s.over = 'blue'; else if (s.score.red >= s.WIN) s.over = 'red';
}

const Sim = { create, step, order, answer, orderDelay, TEMPERS, eye, EYE_TIME, setTrait, reinRate, catchup, seen, note, MARK_LIFE, WIN, effOrder, TYPES, TRAITS, MULT, ORDER_NAME, H, DIFFS };
