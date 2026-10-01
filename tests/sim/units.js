// New units and buildings: anti-tank soldiers and armed jeeps (AA / AT, twice as long to make); every building is a
// small control node (it sees round itself, the picture is exact close by, building reaches a bit past it); nothing
// drives through a building or through another unit; a tank runs over enemy soldiers
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const quiet = seed => { const s = Sim.create(seed, 1200, 'normal'); s.bots = []; s.fog = false; return s; };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
const M = Sim.MULT, S = Sim.STRUCTS;
ok(M.at.tank > 2 * M.at.inf && M.at.tank > M.inf.tank * 4 && M.at.air === 0, `anti-tank: ×${M.at.tank} on tanks, ×${M.at.inf} on infantry, nothing on aircraft`);
ok(M.ajeep.air > 1 && M.tjeep.tank > 1.5 && M.jeep.air === 0 && M.jeep.tank < 0.5, 'AA jeeps hit aircraft, AT jeeps tanks; the plain jeep neither');
ok(S.jeepaa.every === 2 * S.jeepshop.every && S.jeepat.every === 2 * S.jeepshop.every, `armed jeeps take twice as long: ${S.jeepshop.every} → ${S.jeepaa.every} s`);
ok(S.tankshop.every / S.tent.every >= 4, `tanks come slower next to soldiers: a tank every ${S.tankshop.every} s, a soldier every ${S.tent.every} s`);
{
  // AT soldiers against tanks: 5 of them see off 3 tanks (the tanks can't just run them over)
  let win = 0;
  for (const seed of [1, 2, 3, 4]) {
    const s = quiet(seed); s.units = []; s.squads = [];
    const a = Sim._makeSquad(s, 'blue', 'at', null, 500, 320); a.size = 5; Sim._fillSquad(s, a, 500, 320);
    const t = Sim._makeSquad(s, 'red', 'tank', null, 680, 320); t.size = 3; Sim._fillSquad(s, t, 680, 320);
    Sim.order(s, a.id, 'hold', 500, 320, true); Sim.order(s, t.id, 'attack', 500, 320, true); s.outbox = [];
    step(s, 60); const us = s.units.filter(u => u.side === 'blue').length, them = s.units.filter(u => u.side === 'red').length;
    if (us > them) win++;
  }
  ok(win >= 3, `5 anti-tank soldiers beat 3 tanks in ${win} of 4 fights`);
}
{
  // a building: sees round itself and gives full control close by; building reaches a little past it
  const s = quiet(5), hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
  // a row out from the HQ with no lake on it
  let y = hq.y, x = hq.x;
  for (const yy of [hq.y, hq.y - 80, hq.y + 80, hq.y - 160, hq.y + 160]) {
    x = hq.x; while (Sim.buildCheck(s, 'blue', x + 10, yy) === '' || Sim.buildCheck(s, 'blue', x + 10, yy) === 'gap') x += 10;
    if (Sim.buildCheck(s, 'blue', x + 10, yy) === 'q' && !Sim.lakeAt(s, { x: x + 80, y: yy }, 30) && !Sim.lakeAt(s, { x: x + 150, y: yy }, 30)) { y = yy; break; }
  }
  const edge = x, far = { x: edge + 80, y };
  ok(Sim.buildCheck(s, 'blue', far.x, far.y) === 'q', `past the HQ's building area (${Math.round(edge - hq.x)} from it) nothing goes`);
  ok(Sim.build(s, 'blue', 'tent', edge, y), 'a tent at the edge');
  step(s, 21);
  ok(Sim.buildCheck(s, 'blue', far.x, far.y) === '' && Sim.quality(s, 'blue', { x: edge + 60, y }) >= 1, 'once up, it opens a bit more ground, and the picture is exact round it');
  s.fog = true; const foe = s.units.find(u => u.side === 'red'); foe.x = edge + 150; foe.y = y; foe.lastFire = -99;
  for (const u of s.units) if (u.side === 'blue') { u.x = 20; u.y = 20; }
  Sim.step(s, 1 / 30);
  ok(s.vis.blue.has(foe.id), 'it sees an enemy 150 away');
}
{
  // nobody stands on a building; units don't stand on each other
  const s = quiet(6), tent = s.nodes.find(n => n.side === 'blue' && n.kind === 'tent');
  const q = s.squads.find(k => k.side === 'blue' && k.type === 'jeep');
  Sim.order(s, q.id, 'hold', tent.x, tent.y, true); s.outbox = []; step(s, 20);
  const js = s.units.filter(u => u.squad === q.id), inside = js.filter(u => Math.hypot(u.x - tent.x, u.y - tent.y) < 17).length;
  let close = 0; for (const a of js) for (const b of js) if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 8) close++;
  ok(js.length && !inside && !close, `jeeps sent onto the tent stand round it (${inside} on it, ${close / 2} pairs on top of each other)`);
}
{
  // a tank drives over enemy soldiers and kills them; over its own it doesn't (they step aside)
  const s = quiet(7); s.units = []; s.squads = [];
  const t = Sim._makeSquad(s, 'blue', 'tank', null, 400, 320); t.size = 1; Sim._fillSquad(s, t, 400, 320);
  const e = Sim._makeSquad(s, 'red', 'med', null, 470, 320); e.size = 3; Sim._fillSquad(s, e, 470, 320); // medics: can't shoot back
  const f = Sim._makeSquad(s, 'blue', 'med', null, 440, 330); f.size = 2; Sim._fillSquad(s, f, 440, 330);
  const tk = s.units.find(u => u.type === 'tank'); tk.cd = 999; // (no shooting: only the tracks)
  Sim.order(s, t.id, 'hold', 540, 320, true); Sim.order(s, e.id, 'hold', 470, 320, true); Sim.order(s, f.id, 'hold', 440, 330, true); s.outbox = [];
  for (let i = 0; i < 30 * 5; i++) { tk.cd = 999; Sim.step(s, 1 / 30); }
  const theirs = s.units.filter(u => u.squad === e.id), ours = s.units.filter(u => u.squad === f.id);
  ok(theirs.length < 3 && ours.length === 2, `the tank ran over ${3 - theirs.length} of 3 enemy soldiers, none of ours`);
}
{
  // the AI builds the new kinds too
  const s = Sim.create(8, 1200, 'normal'); s.fog = false; s.bots = ['blue', 'red']; step(s, 400);
  const kinds = new Set(s.nodes.map(n => n.kind));
  ok(['atpost', 'jeepat', 'jeepaa'].some(k => kinds.has(k)), `the AI builds anti-tank / armed jeeps: ${[...kinds].join(', ')}`);
}
{
  // helicopters: AA hits them hard, soldiers and jeeps a little, tanks and planes not at all; they hover over what they
  // shoot (planes circle); the attack one's missiles take on aircraft and vehicles, the gunship's gun soldiers
  ok(M.aa.heli > 2 && M.inf.heli > 0 && M.inf.heli < 0.5 && M.jeep.heli > 0 && !M.tank.heli && !M.air.heli && !M.inf.air, `helicopters: AA ×${M.aa.heli}, soldiers ×${M.inf.heli}, tanks and planes 0`);
  ok(M.heli.air > 0 && M.heli.heli > 0 && M.heli.tank > 1.5 && M.gunship.inf > 1.4 && M.gunship.tank < 0.3 && !M.gunship.air, 'attack helicopters hit aircraft, helicopters and tanks; gunships soldiers');
  const s = quiet(5), mk = (side, t, x, y, n) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
  const h = mk('blue', 'heli', 500, 320, 1), e = mk('red', 'tank', 560, 320, 1);
  Sim.order(s, h.id, 'attack', 560, 320, true); Sim.order(s, e.id, 'hold', 560, 320, true); s.outbox = [];
  const u = s.units.find(k => k.squad === h.id), tk = s.units.find(k => k.squad === e.id); let far = 0;
  for (let i = 0; i < 30 * 6; i++) { Sim.step(s, 1 / 30); if (tk.hp > 0) far = Math.max(far, Math.hypot(u.x - 500, u.y - 320)); } // (while the tank stands)
  ok(tk.hp < Sim.TYPES.tank.hp * 0.8 && far < 30, `an attack helicopter hovers where it is (moved at most ${Math.round(far)}) and hits the tank (${Math.round(tk.hp)} hp left)`);
  ok(['heliatk', 'heligun'].every(k => S[k] && S[k].unit && S[k].cat === 'helis'), 'two helipads, on the helicopter page of the aviation menu');
}
if (bad) process.exitCode = 1;
