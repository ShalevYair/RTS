// Marking targets (arms): soldiers and drones mark what they see; aircraft and guns hit what's marked in full, the
// rest only MARK_HIT of the time.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const fresh = () => { const s = Sim.create(9, 1400, 'normal'); s.bots = []; s.fog = false; s.noReinforce = true; s.units = []; s.squads = []; s.designate = true; s.nodes = s.nodes.filter(n => n.kind === 'hq'); return s; };
const mk = (s, side, t, n, x, y) => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
const step = (s, sec) => { for (let i = 0; i < 30 * sec; i++) Sim.step(s, 1 / 30); };
{
  const s = fresh(); mk(s, 'blue', 'inf', 1, 400, 320); const near = mk(s, 'red', 'tank', 1, 500, 320), far = mk(s, 'red', 'tank', 1, 400, 600);
  step(s, 1);
  const U = q => s.units.find(u => u.squad === q.id);
  ok(Sim.isMarked(s, 'blue', U(near)) && !Sim.isMarked(s, 'blue', U(far)), 'a soldier marks the tank near him, not the far one');
}
// aircraft on a tank, two ways: no one marking it, and a soldier marking it (the soldier can't hurt a tank much)
function dmg(spot, seed) {
  const s = fresh(); s.rand = (() => { let x = seed; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  mk(s, 'blue', 'air', 2, 300, 320); const tk = mk(s, 'red', 'tank', 4, 700, 320);
  if (spot) mk(s, 'blue', 'commando', 1, 640, 330);
  Sim.order(s, s.squads[0].id, 'attack', 700, 320, true);
  const T0 = s.units.filter(u => u.squad === tk.id).reduce((a, u) => a + u.hp, 0);
  step(s, 40);
  return T0 - s.units.filter(u => u.squad === tk.id).reduce((a, u) => a + Math.max(0, u.hp), 0);
}
let a = 0, b = 0; for (let i = 1; i <= 4; i++) { a += dmg(false, i * 7); b += dmg(true, i * 7); }
ok(b > 0 && a < b * 0.85 && a > b * 0.35, `aircraft: unmarked ${Math.round(a)} damage, marked ${Math.round(b)} (about ${Sim.MARK_HIT} of it)`);
if (bad) process.exitCode = 1;
