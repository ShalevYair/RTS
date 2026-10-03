// Ground (terrain.js): dense woods, mud and cliffs. Made on the big maps (twin halves, off the HQ strip, not under the
// posts); jeeps don't go into woods or mud (round them), soldiers do (mud at half speed); a tank pushes through woods
// at a tenth of its speed and cuts a lane; a cliff stops all but the commando; nothing is built on mud.
const Sim = require('../load-sim.js')();
let bad = false;
const ok = (c, m) => { if (!c) bad = true; console.log(c ? 'ok  ' : 'FAIL', m); };
const step = (s, sec, f) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (f) f(); } };
const mk = (s, t, x, y, side = 'blue') => { const q = Sim._makeSquad(s, side, t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
{
  // made with the map: both halves alike, none in the HQ strip, none under a post
  let twins = true, strip = 0, under = 0, any = 0;
  for (const seed of [1, 2, 3]) {
    const W = 2400, H = 1280, s = Sim.extras(Sim.openField(Sim.create(seed, W, 'normal', H))), G = s.ground;
    for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
      const v = G.k[j * G.w + i]; if (!v) continue; any++;
      const x = (i + 0.5) * G.C, y = (j + 0.5) * G.C;
      if (Sim.groundAt(s, W - x, s.turn ? H - y : y) !== v) twins = false;
      if (x < W * Sim.HQ_BAND || x > W * (1 - Sim.HQ_BAND)) strip++;
      if (s.posts.some(p => Math.hypot(p.x - x, p.y - y) < Sim.POSTS[p.kind].r)) under++;
    }
  }
  ok(any > 500 && twins && !strip && !under, `the ground: ${any} squares in 3 maps, the halves twins, none in the HQ strips or under posts`);
}
// an empty field with ground drawn by hand (C = 16): a wood, a mud patch, a cliff line
function field(seed) {
  const s = Sim.create(seed, 1600, 'normal', Sim.H, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq'); s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.collapseAfter = Infinity;
  const C = 16, w = Math.ceil(s.W / C), h = Math.ceil(s.H / C);
  s.ground = { C, w, h, k: new Uint8Array(w * h), cliffs: [], cut: [] };
  return s;
}
const fill = (s, x0, y0, x1, y1, kind) => { const G = s.ground; for (let j = Math.floor(y0 / G.C); j <= Math.floor(y1 / G.C); j++) for (let i = Math.floor(x0 / G.C); i <= Math.floor(x1 / G.C); i++) G.k[j * G.w + i] = kind; };
const count = (s, kind) => s.ground.k.reduce((a, v) => a + (v === kind), 0);
{
  // a wood across the way (x 600–760, y 150–490): the jeep goes round it, never in
  const s = field(3); fill(s, 600, 150, 760, 490, Sim.GR_WOOD);
  const q = mk(s, 'jeep', 450, 320); Sim.order(s, q.id, 'hold', 950, 320, true);
  let inWood = 0, at = Infinity; step(s, 90, () => { const u = unitOf(s, q); if (Sim.groundAt(s, u.x, u.y) === Sim.GR_WOOD) inWood++; if (at === Infinity && Math.hypot(u.x - 950, u.y - 320) < 30) at = s.t; });
  ok(!inWood && at < 90, `a jeep round a wood: never in it, there in ${at.toFixed(0)} s`);
}
{
  // the same wood: a soldier walks through it, a little slower
  const s = field(3); fill(s, 600, 150, 760, 490, Sim.GR_WOOD);
  const q = mk(s, 'inf', 560, 320); Sim.order(s, q.id, 'hold', 800, 320, true);
  let inWood = 0; step(s, 25, () => { const u = unitOf(s, q); if (Sim.groundAt(s, u.x, u.y) === Sim.GR_WOOD) inWood++; });
  const u = unitOf(s, q);
  ok(inWood > 0 && Math.hypot(u.x - 800, u.y - 320) < 30, `a soldier through the wood (in it ${(inWood / 30).toFixed(0)} s), and there`);
}
{
  // mud: a soldier at half speed, a tank at a tenth; a jeep not at all
  const run = (t, kind) => { const s = field(4); if (kind) fill(s, 300, 100, 1300, 540, kind); const q = mk(s, t, 400, 320); Sim.order(s, q.id, 'hold', 1200, 320, true); s.noPath = true; const u = unitOf(s, q), x0 = u.x; step(s, 10); return u.x - x0; };
  const inf = run('inf', Sim.GR_MUD) / run('inf', 0), tank = run('tank', Sim.GR_MUD) / run('tank', 0);
  ok(Math.abs(inf - 0.5) < 0.08 && Math.abs(tank - 0.1) < 0.04, `in mud: a soldier ${inf.toFixed(2)}×, a tank ${tank.toFixed(2)}× as far`);
  const s = field(4); fill(s, 500, 100, 700, 540, Sim.GR_MUD); s.noPath = true;
  const q = mk(s, 'jeep', 450, 320); Sim.order(s, q.id, 'hold', 900, 320, true); step(s, 20);
  ok(unitOf(s, q).x < 500, `a jeep stops at the mud's edge (x ${unitOf(s, q).x.toFixed(0)})`);
}
{
  // a tank into a wood: a tenth of its speed, and the squares it went through are cut — a lane a jeep can take
  const s = field(5); fill(s, 600, 150, 760, 490, Sim.GR_WOOD); s.noPath = true;
  const w0 = count(s, Sim.GR_WOOD), q = mk(s, 'tank', 560, 320); Sim.order(s, q.id, 'hold', 900, 320, true);
  const u = unitOf(s, q); let tIn = 0; step(s, 120, () => { if (u.x > 590 && u.x < 770) tIn += 1 / 30; });
  const cut = count(s, Sim.GR_CUT);
  ok(u.x > 880 && tIn > 5 * 180 / Sim.TYPES.tank.speed && cut >= 8 && count(s, Sim.GR_WOOD) === w0 - cut, `a tank through the wood: ${tIn.toFixed(0)} s in it (flat: ${(180 / Sim.TYPES.tank.speed).toFixed(0)}), ${cut} squares cut`);
  ok(Sim.groundOk(s, 'wheel', 680, 320), 'a jeep may drive its lane');
}
{
  // a cliff line (x 700, y 0–640): a tank sent across goes round its end; a commando climbs it
  const s = field(6); fill(s, 696, 0, 712, 560, Sim.GR_CLIFF);
  const q = mk(s, 'tank', 600, 300), c = mk(s, 'commando', 600, 360);
  Sim.order(s, q.id, 'hold', 800, 300, true); Sim.order(s, c.id, 'hold', 800, 360, true);
  let tankOn = 0; step(s, 120, () => { const u = unitOf(s, q); if (Sim.groundAt(s, u.x, u.y) === Sim.GR_CLIFF) tankOn++; });
  const tu = unitOf(s, q), cu = unitOf(s, c);
  ok(!tankOn && Math.hypot(tu.x - 800, tu.y - 300) < 30 && tu.x > 712, `a tank never on the cliff, round its end and there (${tu.x.toFixed(0)}, ${tu.y.toFixed(0)})`);
  ok(Math.hypot(cu.x - 800, cu.y - 360) < 30, 'the commando climbed over it');
}
{
  // building: not on mud, and a building on a wood clears it
  const s = Sim.extras(Sim.openField(Sim.create(2, 2400, 'normal', 1280)));
  const G = s.ground; let mud = null, wood = null;
  for (let c = 0; c < G.k.length && (!mud || !wood); c++) { const p = { x: (c % G.w + 0.5) * G.C, y: (Math.floor(c / G.w) + 0.5) * G.C }; if (G.k[c] === Sim.GR_MUD && !mud) mud = p; if (G.k[c] === Sim.GR_WOOD && !wood) wood = p; }
  ok(mud && Sim.groundBad(s, mud.x, mud.y, 21) && !Sim.groundBad(s, wood.x, wood.y, 5), 'mud is no place to build; a wood is');
}
if (bad) process.exitCode = 1;
