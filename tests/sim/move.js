// Moving groups (the player's units, each its own squad): how they get where they're sent, in six cases — scattered
// over the map; a dense block sent forward; through a gap between two lakes; through a gap in a wall of buildings; two
// groups crossing; past a line of ours standing in the way. For each: when all were at their spots, how long units
// stood stuck on the way, how far they drove away from their spots (back), and the way driven against the straight one.
// node tests/sim/move.js [case…]   (a measure, not pass/fail; MOVE_T: seconds a case, default 200; OLD=1: the old march)
// (stuck: far from its spot, not 'arrived' there by the game's own rule — squad.js arrivedAt — and hardly moving)
const Sim = require('../load-sim.js')();
let JIT = 0, rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647; // (each seed: every unit put up to JIT off its place)
const mk = (s, t, x, y) => { x += (rnd() - 0.5) * 2 * JIT; y += (rnd() - 0.5) * 2 * JIT; const q = Sim._makeSquad(s, 'blue', t, null, x, y); q.size = 1; q.single = true; Sim._fillSquad(s, q, x, y); const u = s.units[s.units.length - 1]; u.x = x; u.y = y; return q; };
const unitOf = (s, q) => s.units.find(u => u.squad === q.id);
function field(seed) {
  const s = Sim.create(seed, 2400, 'normal', 1280, { singles: true }); s.bots = []; s.fog = false; s.night = false;
  s.units = []; s.squads = []; s.nodes = s.nodes.filter(n => n.kind === 'hq'); s.lakes = []; s.hills = []; s.elev = null; s.posts = []; s.collapseAfter = Infinity; s.noReinforce = true;
  return s;
}
const tent = (s, x, y) => s.nodes.push({ ...s.nodes[0], id: 900 + s.nodes.length, kind: 'tent', side: 'blue', x, y, hp: 300, ready: 0, t0: 0, squad: null, prog: 0, until: Infinity });
const KINDS = ['tank', 'jeep', 'inf', 'jeep', 'tank', 'inf', 'ajeep'];
// (where a squad of a formation will stand at the end: its place round the target, the way the formation faces)
function slot(q) {
  const o = q.order, f = o.form; if (!f) return { x: o.x, y: o.y };
  const a = f.a ?? 0, dx = Math.cos(a), dy = Math.sin(a);
  return { x: f.x - dx * f.depth - dy * f.lat, y: f.y - dy * f.depth + dx * f.lat };
}
const CASES = {
  scatter: s => { let k = 0; const qs = [];
    for (let i = 0; i < 14; i++) { const x = 200 + ((i * 337) % 700), y = 180 + ((i * 523) % 920); qs.push(mk(s, KINDS[k++ % KINDS.length], x, y)); }
    return [[qs, 1900, 640]]; },
  block: s => { const qs = []; for (let i = 0; i < 24; i++) qs.push(mk(s, i < 12 ? 'tank' : 'jeep', 300 + (i % 4) * 40, 520 + Math.floor(i / 4) * 34)); return [[qs, 1500, 640]]; },
  lakes: s => { s.lakes = [{ x: 1000, y: 380, rx: 120, ry: 200, a: 0, w: [] }, { x: 1000, y: 900, rx: 120, ry: 200, a: 0, w: [] }]; // (the gap: y 580–700)
    const qs = []; for (let i = 0; i < 16; i++) qs.push(mk(s, KINDS[i % KINDS.length], 380 + (i % 4) * 40, 500 + Math.floor(i / 4) * 60)); return [[qs, 1700, 640]]; },
  wall: s => { for (let y = 90; y <= 1200; y += 44) if (y < 590 || y > 700) tent(s, 1000, y);
    const qs = []; for (let i = 0; i < 16; i++) qs.push(mk(s, KINDS[i % KINDS.length], 380 + (i % 4) * 40, 500 + Math.floor(i / 4) * 60)); return [[qs, 1700, 640]]; },
  cross: s => { const a = [], b = [];
    for (let i = 0; i < 10; i++) { a.push(mk(s, KINDS[i % KINDS.length], 400 + (i % 5) * 40, 260 + Math.floor(i / 5) * 50)); b.push(mk(s, KINDS[(i + 3) % KINDS.length], 400 + (i % 5) * 40, 960 + Math.floor(i / 5) * 50)); }
    return [[a, 1600, 1000], [b, 1600, 300]]; },
  // a real map (hills, woods, mud, cliffs, lakes, posts): 28 of ours in our part, sent together across to the middle
  real: s => { const r = Sim.create(s.seed, 2600, 'normal', 1280, { singles: true }); Sim.extras(r); r.bots = []; r.fog = false; r.night = false; r.units = []; r.squads = []; r.collapseAfter = Infinity; r.noReinforce = true; r.wxPlan = [];
    Object.assign(s, r); const qs = [];
    for (let i = 0; i < 28; i++) { let x = 260 + (i % 7) * 45, y = 420 + Math.floor(i / 7) * 110; for (let k = 0; k < 40 && (Sim.lakeAt ? Sim.lakeAt(s, { x, y }) : false); k++) y += 20; qs.push(mk(s, KINDS[i % KINDS.length], x, y)); }
    return [[qs, 1300, 640]]; },
  gap40: s => { s.lakes = [{ x: 1000, y: 380, rx: 120, ry: 200, a: 0, w: [] }, { x: 1000, y: 900, rx: 120, ry: 200, a: 0, w: [] }];
    const qs = []; for (let i = 0; i < 40; i++) qs.push(mk(s, KINDS[i % KINDS.length], 300 + (i % 5) * 40, 430 + Math.floor(i / 5) * 55)); return [[qs, 1700, 640]]; },
  real60: s => { const r = Sim.create(s.seed, 2600, 'normal', 1280, { singles: true }); Sim.extras(r); r.bots = []; r.fog = false; r.night = false; r.units = []; r.squads = []; r.collapseAfter = Infinity; r.noReinforce = true; r.wxPlan = [];
    Object.assign(s, r); const qs = [];
    for (let i = 0; i < 60; i++) { let x = 220 + (i % 10) * 40, y = 300 + Math.floor(i / 10) * 120; for (let k = 0; k < 40 && Sim.lakeAt(s, { x, y }); k++) y += 20; qs.push(mk(s, KINDS[i % KINDS.length], x, y)); }
    return [[qs, 1300, 640]]; },
  blocker: s => { const st = []; for (let i = 0; i < 12; i++) st.push(mk(s, 'tank', 1000, 470 + i * 30)); // (ours, standing in a line across the way)
    for (const q of st) Sim.order(s, q.id, 'hold', unitOf(s, q).x, unitOf(s, q).y, true);
    const qs = []; for (let i = 0; i < 14; i++) qs.push(mk(s, KINDS[i % KINDS.length], 380 + (i % 4) * 40, 520 + Math.floor(i / 4) * 50)); return [[qs, 1600, 640]]; },
};
function run(name, seed = 3, T = +process.env.MOVE_T || 200) {
  rs = seed * 7919 + 1; JIT = 25;
  const s = field(seed); s.seed = seed; const groups = CASES[name](s);
  if (process.env.OLD) s.oldMarch = s.oldSlots = true;
  if (process.env.ARRIVE) s.arriveMarch = true; // (ARRIVE=1: each straight for its place, getting there together — the march before the route) // (OLD=1: the way it was — the march from their middle, places by the order they were made)
  for (const [qs, x, y] of groups) Sim.formation(s, qs.map(q => q.id), 'hold', x, y, true);
  const all = groups.flatMap(g => g[0]), last = new Map(), still = new Map();
  for (const q of all) { const u = unitOf(s, q); last.set(q.id, { x: u.x, y: u.y, d: Math.hypot(u.x - slot(q).x, u.y - slot(q).y) }); }
  const straight = all.reduce((a, q) => a + last.get(q.id).d, 0);
  let driven = 0, back = 0, stuck = 0, done = Infinity, worstStep = 0;
  for (let i = 0; i < T * 30; i++) {
    const t0 = process.hrtime.bigint(); Sim.step(s, 1 / 30); worstStep = Math.max(worstStep, Number(process.hrtime.bigint() - t0) / 1e6);
    let there = 0;
    for (const q of all) {
      const u = unitOf(s, q); if (!u) continue; const p = last.get(q.id), sl = slot(q), d = Math.hypot(u.x - sl.x, u.y - sl.y), m = Math.hypot(u.x - p.x, u.y - p.y);
      driven += m; if (d > p.d) back += d - p.d;
      // (stuck: far from its spot and hardly moving, a second on end)
      const st = still.get(q.id) || { t: 0 }; if (d > Sim.ARRIVE_LEAVE + 10 && m < 0.1 && !u.arr) st.t += 1 / 30; else st.t = 0; still.set(q.id, st);
      if (st.t > 1) stuck += 1 / 30;
      if (d <= Sim.ARRIVE_LEAVE + 10 || u.arr) there++;
      p.x = u.x; p.y = u.y; p.d = d;
    }
    if (there === all.length && done === Infinity) done = s.t;
    if (process.env.TRACE && i % 30 === 0) { const [tx, ty] = process.env.TRACE.split(',').map(Number); const u = s.units.filter(v => !Sim.TYPES[v.type].air).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0]; if (Math.hypot(u.x - tx, u.y - ty) < 60) { const P = u.path; console.log(Math.round(s.t), u.id, u.type, Math.round(u.x), Math.round(u.y), 'g', Sim.groundAt(s, u.x, u.y), 'gk', u.gk, 'tgt', P ? JSON.stringify(P.pts[P.i]) + ' i' + P.i + '/' + P.pts.length : '-', 'ord', Math.round(u.ox ?? 0), 'stuck', u.stuck && u.stuck.toFixed?.(1), 'det', u.detour && Math.round(u.detour - s.t), 'yield', u.yield && u.yield.until > s.t ? 1 : 0, 'dodge', JSON.stringify(u.dodge || null), 'give', JSON.stringify(u.give || u.giveUp || null), 'ahead', [4, 8, 12, 16].map(k => Sim.groundAt(s, u.x + k, u.y - k * 0.22)).join(''), 'near', s.units.filter(v => v !== u && Math.hypot(v.x - u.x, v.y - u.y) < 30).map(v => v.type + '@' + Math.round(v.x) + ',' + Math.round(v.y)).join(' '), 'nodes', s.nodes.filter(n => Math.hypot(n.x - u.x, n.y - u.y) < 60).map(n => n.kind).join(','), 'posts', (s.posts || []).filter(n => Math.hypot(n.x - u.x, n.y - u.y) < 80).map(n => n.kind).join(',')); } }
  }
  if (process.env.WHO) for (const q of all) { const u = unitOf(s, q); if (!u) continue; const sl = slot(q), d = Math.hypot(u.x - sl.x, u.y - sl.y); if (d > Sim.ARRIVE_LEAVE) console.log('  far', u.type, Math.round(u.x), Math.round(u.y), '→', Math.round(sl.x), Math.round(sl.y), 'd', Math.round(d), 'ground', s.ground ? Sim.groundAt(s, u.x, u.y) : '-', 'lake', Sim.lakeAt(s, sl) ? 'slot in lake' : '', 'path', u.path ? u.path.length : 0, 'arr', !!u.arr, 'gk', u.gk, JSON.stringify(Object.fromEntries(Object.entries(u).filter(([k, v]) => /path|fail|stuck|detour|dodge|give|yield/i.test(k))))); }
  const lost = all.filter(q => !unitOf(s, q)).length, far = all.filter(q => { const u = unitOf(s, q), sl = slot(q); return u && !u.arr && Math.hypot(u.x - sl.x, u.y - sl.y) > Sim.ARRIVE_LEAVE + 10; }).length;
  return { name, n: all.length, lost, done: Number.isFinite(done) ? Math.round(done) : '-', far, stuck: Math.round(stuck), back: Math.round(back), ratio: +(driven / straight).toFixed(2), worstMs: +worstStep.toFixed(1) };
}
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
const rows = [];
for (const n of names) for (const seed of [3, 8]) { const r = run(n, seed); r.seed = seed; rows.push(r); console.log(JSON.stringify(r)); }
const sum = k => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);
console.log(`total: not there ${sum('far')}, stuck ${sum('stuck')} unit-s, back ${sum('back')}, never all there ${rows.filter(r => r.done === '-').length}/${rows.length}`);
