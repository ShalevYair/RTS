// Artillery (special.js artyTick): the 200 mm gun destroys one unit a shell — a tank too; the MLRS clears soldiers and
// jeeps in an area and only scratches tanks; both fire only at what their side sees, within ARTY_R, after standing
// ARTY_SETUP s; firing shows the enemy where they are; the AI builds them and keeps them behind its squads.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f && f()) return; } };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
const field = (fog = false) => { const s = Sim.create(4, 2400, 'normal', 1280, { singles: true }); s.bots = []; s.fog = fog; s.night = false; s.collapseAfter = Infinity; s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.noReinforce = true; s.units = s.units.filter(u => false); s.squads = []; return s; };
ok(Sim.ARTY_R >= 2 * Sim.TYPES.aa.range - 1, `twice the longest direct range (${Sim.ARTY_R})`);
{
  // the gun: a tank far off, seen (no fog) — one shell, gone; not before ARTY_SETUP
  const s = field(), g = mk(s, 'how', 600, 600), t = mk(s, 'tank', 600 + Sim.ARTY_R - 20, 600, 'red'); const tu = unitOf(s, t);
  Sim.order(s, t.id, 'hold', tu.x, tu.y, true);
  step(s, Sim.ARTY_SETUP - 1); ok(tu.hp > 0, 'not before it has stood ARTY_SETUP s');
  step(s, 3); ok(tu.hp <= 0 || !s.units.includes(tu), 'one shell: the tank is gone');
  ok(s.mem.red[g.id] && s.mem.red[g.id].type === 'how', 'the firing showed the enemy where the gun is');
}
{
  // out of reach: nothing
  const s = field(), g = mk(s, 'how', 600, 600), t = mk(s, 'tank', 600 + Sim.ARTY_R + 40, 600, 'red'); const tu = unitOf(s, t);
  Sim.order(s, t.id, 'hold', tu.x, tu.y, true); step(s, 15); ok(tu.hp === Sim.TYPES.tank.hp, 'out of reach: untouched');
}
{
  // the fog: unseen — nothing; a drone over it — fire
  const s = field(true), g = mk(s, 'how', 600, 600), t = mk(s, 'jeep', 900, 600, 'red'); const tu = unitOf(s, t);
  Sim.order(s, t.id, 'hold', tu.x, tu.y, true); step(s, 15); ok(tu.hp > 0, 'in the fog, unseen: no fire');
  s.drones.blue.stock = 1; Sim.drone(s, 'blue', 900, 600); step(s, 12, () => tu.hp <= 0); ok(tu.hp <= 0, 'a drone sees it: fire');
}
{
  // the MLRS: soldiers and a jeep in the area gone, a tank only scratched
  const s = field(), m = mk(s, 'mlrs', 600, 600), foes = [mk(s, 'inf', 880, 600, 'red'), mk(s, 'inf', 900, 620, 'red'), mk(s, 'jeep', 890, 580, 'red'), mk(s, 'tank', 910, 600, 'red')].map(q => { const u = unitOf(s, q); Sim.order(s, q.id, 'hold', u.x, u.y, true); return u; });
  step(s, Sim.ARTY_SETUP + 1);
  const [a, b, j, t] = foes;
  ok(a.hp <= 0 && b.hp <= 0 && j.hp <= 0, 'one salvo: the soldiers and the jeep are gone');
  ok(t.hp > Sim.TYPES.tank.hp * 0.8, `the tank only scratched (${Math.round(t.hp / Sim.TYPES.tank.hp * 100)}%)`);
}
{
  // the AI builds by what it sees: many enemy tanks made out — an anti-tank answer; aircraft — AA; unseen (fog) — nothing
  const s = Sim.create(6, 1600, 'normal'); s.bots = []; s.fog = false;
  for (let i = 0; i < 6; i++) mk(s, 'tank', 300, 100 + i * 60);
  const k = Sim.aiCounter(s, 'red');
  ok(Sim.AI_THREATS.armour.build.includes(k), `6 enemy tanks seen: it answers with ${k}`);
  const a = Sim.create(6, 1600, 'normal'); a.bots = []; a.fog = false;
  for (let i = 0; i < 5; i++) mk(a, 'air', 300, 100 + i * 60);
  const k2 = Sim.aiCounter(a, 'red'); ok(Sim.AI_THREATS.air.build.includes(k2), `5 enemy aircraft: ${k2}`);
  const f = Sim.create(6, 1600, 'normal'); f.bots = []; f.fog = true;
  for (let i = 0; i < 6; i++) mk(f, 'tank', 200, 100 + i * 60);
  ok(!Sim.aiCounter(f, 'red'), 'the same tanks unseen (fog, at home): no answer — no cheating');
}
{
  // a bot game on the big map: the AI builds artillery and it fires
  let s = Sim.create(316, 2200, 'normal', Sim.H * 2); Sim.extras(s); s = Sim.openField(s); s.fog = true; s.bots = ['blue', 'red'];
  s.style.red = s.style.blue = 'steady'; // (armour-only games end in 10 min — before the guns come into it)
  let fired = 0, guns = 0; const seen = new Set();
  while (!s.over && s.t < 2000) { Sim.step(s, 1 / 30); for (const u of s.units) if (Sim.TYPES[u.type].arty) { guns = Math.max(guns, s.units.filter(k => Sim.TYPES[k.type].arty).length); if (u.lastFire === s.t && !seen.has(u.id + ':' + s.t)) { seen.add(u.id + ':' + s.t); fired++; } } }
  ok(guns > 0, `the AI made artillery (${guns} at most)`);
  ok(fired > 0, `and it fired (${fired} times in ${Math.round(s.t / 60)} min)`);
}
process.exitCode = bad ? 1 : 0;
