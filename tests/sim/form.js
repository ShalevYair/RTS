// Formations and forward-HQ limits: a squad stands in a line across the way to the enemy; all squads ordered together
// line up in rows (tanks in front … medics and mechanics at the back, aircraft over the middle), facing the enemy HQ,
// and turn to face an enemy that shows up; a forward HQ every 3 minutes, at most 3
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
// a quiet map, no fog: one squad of each kind for blue, red far off
function setup(seed) {
  // (the size of the small map — level 1's is smaller now — with nothing built)
  const s = Sim.level(5, seed, 1400); s.nodes = []; s.supply = false; s.prodRate = null; s.bots = []; s.fog = false; s.noReinforce = true; s.collapseAfter = 1e9;
  s.squads = []; s.units = []; s.lakes = []; // no lakes in the way
  const add = (side, type, n, x, y) => { const q = Sim._makeSquad(s, side, type, null, x, y); q.size = n; Sim._fillSquad(s, q, x, y); return q; };
  const mine = ['inf', 'tank', 'jeep', 'aa', 'med', 'mech', 'air'].map((t, i) => add('blue', t, 4, 150 + (i % 2) * 70, 100 + 70 * i)); // (staggered: side by side, a soldier could be boxed in by the tanks)
  const foe = add('red', 'inf', 3, s.W - 40, s.H / 2);
  return { s, mine, foe, add };
}
// spread of a squad's units along / across the way it faces
function spread(s, q) {
  const m = s.units.filter(u => u.squad === q.id), a = q.face, ux = Math.cos(a), uy = Math.sin(a);
  const along = m.map(u => u.x * ux + u.y * uy), across = m.map(u => -u.x * uy + u.y * ux);
  const r = v => Math.max(...v) - Math.min(...v);
  return { along: r(along), across: r(across) };
}
{
  const { s, mine } = setup(3), inf = mine[0];
  Sim.order(s, inf.id, 'hold', 500, 320); step(s, 25);
  const sp = spread(s, inf);
  ok(sp.across > 40 && sp.across > 3 * sp.along, `one squad stands in a line across the way to the enemy (across ${sp.across.toFixed(0)}, deep ${sp.along.toFixed(0)})`);
}
{
  const { s, mine, foe } = setup(4);
  const P = { x: 500, y: 320 };
  ok(Sim.formation(s, mine.map(q => q.id), 'hold', P.x, P.y), 'all squads ordered together');
  step(s, 40);
  // depth toward the enemy HQ (east): tanks furthest forward, care at the back
  const at = t => mine.find(q => q.type === t), x = t => at(t).order.x;
  ok(x('tank') > x('jeep') && x('jeep') > x('inf') && x('inf') > x('aa') && x('aa') > x('med') && Math.abs(x('med') - x('mech')) < 25, `rows front to back: tanks ${x('tank').toFixed(0)}, jeeps ${x('jeep').toFixed(0)}, infantry ${x('inf').toFixed(0)}, AA ${x('aa').toFixed(0)}, medics / mechanics ${x('med').toFixed(0)}`);
  ok(x('air') < x('jeep') && x('air') > x('inf'), `aircraft over the middle (${x('air').toFixed(0)})`);
  ok(Math.abs(at('med').order.y - at('mech').order.y) > 30, 'medics and mechanics side by side in the back row');
  const body = q => { const m = s.units.filter(u => u.squad === q.id); return m.reduce((a, u) => a + u.x, 0) / m.length; };
  ok(body(at('tank')) > body(at('inf')) && body(at('inf')) > body(at('med')), 'the squads themselves stand that way');
  // an enemy shows up to the north: the formation turns to face it (tanks toward it)
  const medAt = { x: at('med').order.x, y: at('med').order.y };
  for (const u of s.units) if (u.squad === foe.id) { u.x = P.x + (u.x % 7); u.y = Math.max(20, P.y - 250); u.cd = 1e9; }
  foe.order = { type: 'hold', x: P.x, y: Math.max(20, P.y - 250), r: 60 }; step(s, 4); // (before they're shot down: the rows stand wider now, so closer to them)
  const y = t => at(t).order.y;
  ok(y('tank') < y('inf') && y('inf') < y('aa'), `an enemy to the north: the rows turn to it (tanks y ${y('tank').toFixed(0)}, infantry ${y('inf').toFixed(0)}, AA ${y('aa').toFixed(0)})`);
  // (medics and mechanics stay where they were put: their far-back spot swinging with the front kept them driving about)
  ok(Math.abs(at('med').order.x - medAt.x) < 1 && Math.abs(at('med').order.y - medAt.y) < 1, 'medics stand still where they were put');
}
{
  // forward HQs: one every 3 minutes, never more than 3 standing
  const s = Sim.create(5, 1000, 'normal'); s.bots = []; s.fog = false;
  s.units = s.units.filter(u => u.side === 'blue'); s.noReinforce = true;
  const j = s.squads.find(q => q.type === 'jeep' && q.side === 'blue');
  let made = 0;
  for (let k = 0; k < 5; k++) {
    for (const u of s.units) if (u.squad === j.id) { u.x = 300 + 120 * k; u.y = 150 + 80 * k; }
    Sim.step(s, 1 / 30);
    if (Sim.buildFhq(s, j.id)) made++;
    if (k === 0) ok(!Sim.buildFhq(s, j.id) && Math.round(s.cd.blue.fhq) === 180, 'the next forward HQ only 3 minutes later');
    step(s, 181);
  }
  ok(made === 3 && Sim.fhqCount(s, 'blue') === 3, `at most 3 forward HQs (${made} of 5 tries)`);
  s.nodes.find(n => n.kind === 'fhq').hp = 0; Sim.step(s, 1 / 30);
  ok(Sim.buildFhq(s, j.id), 'one destroyed: room for another');
}
{
  // placing a forward HQ: the squad drives to the spot and sets it up there; another order calls the trip off (slot back)
  const s = Sim.create(6, 1200, 'normal'); s.bots = []; s.fog = false; s.lakes = [];
  s.units = s.units.filter(u => u.side === 'blue'); s.noReinforce = true;
  const j = s.squads.find(q => q.type === 'jeep' && q.side === 'blue'), spot = { x: 560, y: 250 };
  ok(Sim.planFhq(s, j.id, spot.x, spot.y) && Sim.fhqCount(s, 'blue') === 1 && !Sim.planFhq(s, j.id, 300, 300), 'placing one: the slot is taken at once (no second while waiting)');
  step(s, 20);
  const f = s.nodes.find(n => n.kind === 'fhq' && n.side === 'blue');
  ok(f && Math.hypot(f.x - spot.x, f.y - spot.y) < 45, `the jeeps drove there and set it up (${f ? Math.round(Math.hypot(f.x - spot.x, f.y - spot.y)) : '-'} from the spot)`);
  s.cd.blue.fhq = 0;
  Sim.planFhq(s, j.id, 900, 500); step(s, 1); Sim.order(s, j.id, 'attack', 300, 100); step(s, 1);
  ok(!j.fhqAt && s.cd.blue.fhq === 0 && Sim.fhqCount(s, 'blue') === 1, 'another order calls the trip off, and the slot comes back');
}
