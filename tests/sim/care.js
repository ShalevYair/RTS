// Medics and mechanics: a badly hurt unit leaves the fight on its own for the nearest medic / mechanic (or home when
// there is none), holds its fire, heals there and goes back; care squads never shoot; the AI builds and uses them
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
// a quiet map: red far away, nothing produced, fog off
function quiet(seed) {
  const s = Sim.create(seed, 1200, 'normal'); s.bots = []; s.noReinforce = true; s.fog = false;
  for (const u of s.units) if (u.side === 'red') { u.x = s.W - 10; u.y = 10; }
  return s;
}
{
  const s = quiet(3), hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue');
  // a clinic out in the field, finished, with its medics
  const c = s.nodes[s.nodes.push({ ...s.nodes[0], id: 99, kind: 'clinic', side: 'blue', x: 500, y: 200, hp: 350, ready: 0, t0: 0, squad: null, prog: 0, until: Infinity }) - 1];
  s.noReinforce = false; step(s, 30); s.noReinforce = true;
  const medSq = s.squads.find(q => q.type === 'med' && q.side === 'blue');
  ok(!!medSq && s.units.some(u => u.squad === medSq.id), `a clinic raises a medic squad (${s.units.filter(u => medSq && u.squad === medSq.id).length})`);
  Sim.order(s, medSq.id, 'hold', 600, 450); step(s, 15);
  const med = s.units.find(u => u.squad === medSq.id);
  // an infantryman near the medics' spot, badly hurt, an enemy in range
  const inf = s.units.find(u => u.side === 'blue' && u.type === 'inf'), foe = s.units.find(u => u.side === 'red' && u.type === 'inf');
  inf.x = 700; inf.y = 450; inf.hp = 15; foe.x = 740; foe.y = 450; foe.cd = 1e9;
  const sq = s.squads.find(q => q.id === inf.squad); sq.order = { type: 'hold', x: 700, y: 450, r: 60 };
  let fired = false, near = false, cared = false;
  for (let i = 0; i < 30 * 8; i++) { const t0 = inf.lastFire; Sim.step(s, 1 / 30); if (inf.lastFire !== t0) fired = true; if (Math.hypot(inf.x - med.x, inf.y - med.y) < 32) near = true; if (i === 15) cared = inf.care; }
  ok(cared && !fired, 'badly hurt: it stops shooting and goes for treatment');
  ok(near, 'it goes to the nearest medic, not home (' + Math.round(Math.hypot(inf.x - hq.x, inf.y - hq.y)) + ' from the HQ)');
  step(s, 12);
  ok(!inf.care && inf.hp >= 0.9 * Sim.TYPES.inf.hp, `treated by the medics: back in the fight at ${Math.round(inf.hp)} hp`);
  // the medics shoot at nothing
  foe.x = med.x + 20; foe.y = med.y; const f0 = med.lastFire; step(s, 3);
  ok(med.lastFire === f0, 'medics never shoot');
  // no medic: home
  s.units = s.units.filter(u => u.type !== 'med');
  inf.x = 700; inf.y = 450; inf.hp = 15; foe.x = s.W - 10; step(s, 3);
  ok(inf.care && Math.hypot(inf.x - hq.x, inf.y - hq.y) < 700 - 30, 'no medic left: it heads home');
}
{
  // a tank: repaired by mechanics, not by medics
  const s = quiet(4), base = s.bases.blue;
  s.nodes.push({ ...s.nodes[0], id: 98, kind: 'garage', side: 'blue', x: 400, y: 150, hp: 400, ready: 0, t0: 0, squad: null, prog: 0, until: Infinity });
  s.noReinforce = false; step(s, 40); s.noReinforce = true;
  const mech = s.units.find(u => u.type === 'mech');
  const jeep = s.units.find(u => u.side === 'blue' && u.type === 'jeep'); jeep.type = 'tank'; jeep.hp = 30;
  jeep.x = mech.x + 60; jeep.y = mech.y;
  step(s, 2); ok(jeep.care && Math.hypot(jeep.x - mech.x, jeep.y - mech.y) < 60, 'a hurt tank drives to the mechanics');
  step(s, 15); ok(!jeep.care && jeep.hp > 0.9 * Sim.TYPES.tank.hp, `repaired: ${Math.round(jeep.hp)} hp`);
}
// full games: the AI builds clinics and garages, and games still finish
let clinics = 0, garages = 0, fin = 0;
for (let i = 0; i < 3; i++) {
  const { s } = play(500 + i, 1200, ['normal', 'hard', 'normal'][i], { limit: 1200 });
  if (s.over) fin++;
  clinics += s.squads.filter(q => q.type === 'med').length; garages += s.squads.filter(q => q.type === 'mech').length;
}
ok(clinics > 0 && garages > 0, `the AI raises medics (${clinics}) and mechanics (${garages})`);
ok(fin >= 2, `${fin}/3 bot games finished within 20 min`);
