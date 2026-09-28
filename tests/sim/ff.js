// Stage 4: friendly fire — chance by control, who can be hit, reports, and full games
const { Sim, play } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
// blue infantry (blue0) shoots at a red jeep; the blue jeeps (blue1) stand next to the target
function setup(x, fog = true) {
  const s = Sim.create(21, 1000, 'normal'); s.bots = []; s.fog = fog;
  const inf = s.squads.find(q => q.id === 'blue0'), jeep = s.squads.find(q => q.id === 'blue1');
  inf.cx = x; inf.cy = 320; // Q is read at the shooter's squad
  const u = s.units.find(k => k.squad === inf.id), tgt = s.units.find(k => k.side === 'red' && k.type === 'jeep');
  const f = s.units.find(k => k.squad === jeep.id);
  tgt.x = x + 40; tgt.y = 320; f.x = x + 70; f.y = 320;
  return { s, inf, jeep, u, tgt, f };
}
const rate = (x, n = 20000, fog = true) => {
  const { s, inf, u, tgt } = setup(x, fog); let hits = 0;
  for (let i = 0; i < n; i++) if (Sim.friendlyFire(s, u, inf, tgt)) hits++;
  return { r: hits / n, s };
};
// Q around blue's HQ (x = 30): 1 up to x = 310, rings of 80/60/40/20% every 50, floor 0.15 from x = 510
const far = rate(800), want = 0.08 * 0.85 * 0.85;
ok(Math.abs(far.r - want) < 0.008, `at the control floor: ${(far.r * 100).toFixed(1)}% (formula ${(want * 100).toFixed(1)}%)`);
ok(rate(200).r === 0, 'full control: never');
const mid = rate(385).r; // Q = 0.6 -> 1.28%
ok(Math.abs(mid - 0.0128) < 0.004, `60% control: ${(mid * 100).toFixed(1)}% (formula 1.3%)`);
ok(rate(800, 2000, false).r === 0, 'without fog: never');
ok(far.s.log2.ff > 0 && far.s.ff.length === far.s.log2.ff, 'incidents logged for the replay and the end screen');
ok(far.s.marks.filter(k => k.kind === 'ff').length === 1 && far.s.log.filter(e => /ירי על כוחותינו/.test(e.msg)).length === 1, 'one report per squad per few seconds, not per shot');
{ const { s, inf, u, tgt, f } = setup(800); f.x = tgt.x + 61; let h = 0; for (let i = 0; i < 3000; i++) if (Sim.friendlyFire(s, u, inf, tgt)) h++; ok(h === 0, 'a friendly more than 60 from the target is safe'); }
{ const { s, inf, u, tgt } = setup(800); for (const k of s.units) if (k.squad === 'blue1') k.x = 10; let h = 0; for (let i = 0; i < 3000; i++) if (Sim.friendlyFire(s, u, inf, tgt)) h++; ok(h === 0, 'the shooter\'s own squad mates are not counted'); }
{ const { s, inf, u, tgt, f } = setup(800); f.type = 'air'; let h = 0; for (let i = 0; i < 3000; i++) if (Sim.friendlyFire(s, u, inf, tgt)) h++; ok(h === 0, 'infantry cannot hit a friendly aircraft (only AA can)'); }
// through step(): the hit really lands on the friendly unit and the radio mark appears
{
  const s = Sim.create(22, 1000, 'normal'); s.bots = []; s.noReinforce = true;
  const place = (id, x, y) => { for (const k of s.units) if (k.squad === id) { k.x = x + k.sx * 12; k.y = y + k.sy * 12; } };
  let jeepDmg = 0, before = 0;
  for (let t = 0; t < 20 && !s.ff.length; t += 1 / 30) {
    place('blue0', 790, 320); place('blue1', 835, 355); place('red3', 830, 310);
    for (const k of s.units) if (k.side === 'red') { k.hp = TYPESHP(k); k.cd = 99; } // red can't shoot: blue damage is only friendly fire
    before = s.units.filter(k => k.side === 'blue').reduce((a, k) => a + k.hp, 0);
    Sim.step(s, 1 / 30);
  }
  function TYPESHP(k) { return Sim.TYPES[k.type].hp; }
  jeepDmg = before - s.units.filter(k => k.side === 'blue').reduce((a, k) => a + k.hp, 0);
  ok(s.ff.length > 0 && s.ff[0].on !== s.ff[0].by && s.ff[0].side === 'blue', `in a real fight far from HQ, a squad was hit by its own side (${s.ff.length}, t=${s.t.toFixed(1)})`);
  ok(s.marks.some(k => k.kind === 'ff'), 'the ✖ mark is on the map');
  ok(jeepDmg > 0, 'the friendly unit lost health (red could not shoot)');
}
// full games: friendly fire happens, and games still finish
let fin = 0, ff = 0;
for (let i = 0; i < 4; i++) { const { s } = play(140 + i, [800, 1100, 1400][i % 3], i % 2 ? 'hard' : 'normal'); if (s.over) fin++; ff += s.ff.length; }
ok(fin >= 3, `${fin}/4 fogged bot games finished within 15 min`);
ok(ff > 0, `friendly fire in bot games: ${ff} hits over 4 games`);
