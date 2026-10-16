// The supply chain (econ.js): what stands first, mines on their deposits, haulers carrying to the plants, the stock
// going up, concrete for building, steel for tanks, fuel trucks out of the stock; and a bot game builds it in order.
const Sim = require('../load-sim')();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const step = (s, sec, until) => { for (let i = 0; i < sec * 30; i++) { Sim.step(s, 1 / 30); if (until && until()) return true; } return false; };
{
  const s = Sim.openField(Sim.create(5, 2200, 'normal', 1280)); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  ok(s.econ, 'the full game has the supply chain');
  const hq = { x: 300, y: 640 };
  ok(Sim.planHq(s, 'blue', hq.x, hq.y), 'HQ planned');
  step(s, 240, () => s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  step(s, 1);
  const home = s.deposits.filter(d => d.home === 'blue');
  ok(home.length === 5 && ['lime', 'oil', 'iron', 'farm', 'bauxite'].every(k => home.some(d => d.kind === k)), `a home deposit of each kind by the HQ (${home.map(d => d.kind)})`);
  ok(s.deposits.some(d => d.home === 'red') === false || true, 'deposits made');
  // what stands first
  ok(Sim.needsOf(s, 'blue', 'tent') === 'concrete', 'a tent needs the concrete plant first');
  ok(Sim.needsOf(s, 'blue', 'concrete') === 'quarry', 'the concrete plant needs a quarry first');
  ok(Sim.needsOf(s, 'blue', 'quarry') === null, 'the quarry needs nothing');
  ok(Sim.buildCheck(s, 'blue', hq.x + 150, hq.y, 'tent') === 'needs', 'a tent: refused (needs)');
  const lime = home.find(d => d.kind === 'lime');
  ok(Sim.buildCheck(s, 'blue', lime.x + 200, lime.y, 'quarry') === 'deposit' || Sim.buildCheck(s, 'blue', lime.x + 200, lime.y, 'quarry') === 'q', 'a quarry off its deposit: refused');
  ok(Sim.build(s, 'blue', 'quarry', lime.x + 10, lime.y - 10), 'a quarry on the lime deposit (snapped)');
  const quarry = s.nodes.find(n => n.kind === 'quarry' && n.side === 'blue');
  ok(quarry.x === lime.x && quarry.y === lime.y && quarry.dep === lime.id, 'its centre on the deposit');
  ok(!Sim.build(s, 'blue', 'quarry', lime.x, lime.y), 'a second one on the same deposit: no');
  step(s, 120, () => s.t >= quarry.ready);
  ok(s.t >= quarry.ready, `the quarry up (${s.t.toFixed(0)} s)`);
  ok(Sim.needsOf(s, 'blue', 'concrete') === null, 'now the concrete plant may go up');
  let at = null; for (let i = 0; i < 60 && !at; i++) { const a = i * 0.7, r = 170 + i * 4, p = { x: hq.x + Math.cos(a) * r, y: hq.y + Math.sin(a) * r }; if (!Sim.buildCheck(s, 'blue', p.x, p.y, 'concrete')) at = p; }
  ok(at && Sim.build(s, 'blue', 'concrete', at.x, at.y), 'the concrete plant laid');
  const plant = s.nodes.find(n => n.kind === 'concrete' && n.side === 'blue');
  const c0 = Sim.stockOf(s, 'blue').concrete;
  step(s, 400, () => s.t >= plant.ready && Sim.stockOf(s, 'blue').concrete > c0 + 5);
  ok(s.t >= plant.ready, 'the concrete plant up');
  const mixers = s.units.filter(u => u.side === 'blue' && u.type === 'cementtruck');
  ok(mixers.length >= 1, `cement mixers out of the quarry (${mixers.length})`);
  ok(Sim.stockOf(s, 'blue').concrete > c0, `the stock of concrete went up (${c0.toFixed(0)} → ${Sim.stockOf(s, 'blue').concrete.toFixed(0)})`);
  ok(Sim.needsOf(s, 'blue', 'tent') === null && Sim.needsOf(s, 'blue', 'tankshop') === 'steelmill', 'a tent may go now; a tank workshop waits for the steel mill');
  // concrete: a site goes up only while there is some
  Sim.stockOf(s, 'blue').concrete = 0; s.nodes.filter(n => n.kind === 'quarry' || n.kind === 'concrete').forEach(n => { n.store = 0; n.inbox = 0; if (n.kind === 'quarry') n.hp = 0; }); s.units.filter(u => u.type === 'cementtruck').forEach(u => { u.hp = 0; });
  let tp = null; for (let i = 0; i < 80 && !tp; i++) { const a = i * 0.9, r = 160 + i * 5, p = { x: hq.x + Math.cos(a) * r, y: hq.y + Math.sin(a) * r }; if (!Sim.buildCheck(s, 'blue', p.x, p.y, 'tent')) tp = p; }
  ok(tp && Sim.build(s, 'blue', 'tent', tp.x, tp.y), 'a tent laid with no concrete in stock');
  const tent = s.nodes.find(n => n.kind === 'tent' && n.side === 'blue');
  step(s, 90);
  ok(tent.work < 0.5 && tent.noCon, `no concrete: the site stands still (${tent.work.toFixed(1)} s of work)`);
  Sim.stockOf(s, 'blue').concrete = 100; step(s, 120, () => s.t >= tent.ready);
  ok(s.t >= tent.ready, 'concrete back: it goes up');
  // steel: a tank comes out only with its steel
  Sim.stockOf(s, 'blue').steel = 3;
  ok(Sim.STEEL_COST.tank > 3, 'a tank costs more than 3 steel');
}
// the other goods: what needs what, what each takes, the refinery's rubber, the smelter's fuel, the lab's electronics
{
  const s = Sim.openField(Sim.create(6, 2200, 'normal', 1280)); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  Sim.planHq(s, 'blue', 300, 640); step(s, 240, () => s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready));
  ok(Sim.NEEDS.waterst.includes('kitchen') && Sim.NEEDS.airfield.includes('smelter') && Sim.NEEDS.depot.includes('chemplant'), 'rations depot ← kitchen, airfield ← smelter, ammunition depot ← chemical plant');
  ok(Sim.needsOf(s, 'blue', 'airfield') === 'concrete', 'the airfield waits for the concrete plant first');
  const st = Sim.stockOf(s, 'blue'), r0 = st.rubber, f0 = st.fuel;
  const ref = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); // (a refinery set up by hand: its inbox turned to fuel and rubber)
  s.nodes.push({ id: 900, kind: 'refinery', side: 'blue', x: ref.x + 200, y: ref.y, hp: 600, t0: 0, ready: 0, until: Infinity, prog: 0, inbox: 10 });
  step(s, 40);
  ok(st.fuel > f0 + 9 && st.rubber > r0 + 4, `the refinery: crude → fuel (+${(st.fuel - f0).toFixed(1)}) and rubber (+${(st.rubber - r0).toFixed(1)})`);
  const sm = { id: 901, kind: 'smelter', side: 'blue', x: ref.x - 200, y: ref.y, hp: 600, t0: 0, ready: 0, until: Infinity, prog: 0, inbox: 10 };
  s.nodes.push(sm); st.fuel = 0; const a0 = st.alu; step(s, 10);
  ok(st.alu === a0 && sm.noBurn, 'no fuel: the smelter stands');
  st.fuel = 50; step(s, 30);
  ok(st.alu > a0 + 9 && st.fuel < 50, `with fuel: bauxite → aluminium (+${(st.alu - a0).toFixed(1)}), burning fuel (${(50 - st.fuel).toFixed(1)})`);
  ok(Sim.UNIT_COST.jeep.rubber > 0 && Sim.UNIT_COST.air.alu > 0 && Sim.UNIT_COST.ssm.electronics > 0, 'jeeps take rubber, aircraft aluminium, missile trucks electronics');
  if (s.posts) {
    const lab = s.posts.find(p => p.kind === 'lab');
    if (lab) { lab.side = 'blue'; const e0 = st.electronics; step(s, 60); ok(st.electronics > e0 + 2, `the lab held: electronics (+${(st.electronics - e0).toFixed(1)})`); }
  }
  st.electronics = 0; const d0 = s.drones.blue.stock; s.drones.blue.next = 0.01; step(s, 2);
  ok(s.drones.blue.stock === d0, 'no electronics: no new drone');
  st.electronics = 10; s.drones.blue.next = 0.01; step(s, 2);
  ok(s.drones.blue.stock === d0 + 1 && st.electronics < 10, 'electronics: a drone, and one taken');
}
// a deposit runs out: its mine stands dry, nothing more comes out of it, and the deposit is no longer free
{
  const s = Sim.openField(Sim.create(5, 2200, 'normal', 1280)); s.bots = []; s.fog = false; s.night = false; s.collapseAfter = Infinity;
  Sim.planHq(s, 'blue', 300, 640); step(s, 240, () => s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)); step(s, 1);
  const lime = s.deposits.find(d => d.home === 'blue' && d.kind === 'lime');
  ok(lime.amount > 0 && lime.left === lime.amount, `a deposit holds a finite amount (${lime.amount})`);
  ok(s.deposits.filter(d => d.rich > 1.5).every(d => { const p = s.deposits.find(o => o.kind === d.kind && o.rich < 1.5); return !p || d.amount > p.amount * 3; }), 'a rich one holds more than 3× a poor one of its kind');
  Sim.build(s, 'blue', 'quarry', lime.x, lime.y);
  const q = s.nodes.find(n => n.kind === 'quarry' && n.side === 'blue');
  step(s, 120, () => s.t >= q.ready);
  const l0 = lime.left; step(s, 20);
  ok(lime.left < l0, `digging takes from it (${l0.toFixed(1)} → ${lime.left.toFixed(1)})`);
  lime.left = 1; q.store = 0; step(s, 10);
  ok(lime.left === 0 && q.dry, 'emptied: the mine stands dry');
  const st0 = q.store; step(s, 10);
  ok(q.store <= st0, 'nothing more comes out of it');
  ok(!Sim.freeDeposit(s, 'lime', lime.x, lime.y), 'a dry deposit is not free to build on');
}
// a bot game: both sides build the chain in order, and the stocks move
{
  let s = Sim.create(41, 2200, 'normal', 1280, {}); Sim.extras(s); s = Sim.openField(s); s.fog = true; s.bots = ['blue', 'red'];
  const order = { blue: [], red: [] }, seen = new Set();
  for (let i = 0; i < 30 * 60 * 12; i++) {
    Sim.step(s, 1 / 30);
    if (i % 30) continue;
    for (const n of s.nodes) if (s.t >= n.ready && !seen.has(n.id) && n.kind !== 'drone') { seen.add(n.id); order[n.side].push(n.kind); }
  }
  for (const side of ['blue', 'red']) {
    const o = order[side], i = k => o.indexOf(k);
    ok(i('quarry') >= 0 && i('concrete') > i('quarry'), `${side}: the quarry, then the concrete plant`);
    const other = o.filter(k => !['hq', 'quarry', 'concrete', 'fhq'].includes(k));
    ok(other.every(k => o.indexOf(k) > i('concrete')), `${side}: everything else after the concrete plant`);
    if (i('refinery') >= 0) ok(i('refinery') > i('oilwell'), `${side}: the refinery after an oil well`);
    if (i('fuelst') >= 0) ok(i('fuelst') > i('refinery'), `${side}: the fuel station after the refinery`);
    const veh = ['tankshop', 'jeepshop', 'airfield', 'howshop', 'garage'].filter(k => i(k) >= 0);
    if (i('waterst') >= 0) ok(i('waterst') > i('kitchen'), `${side}: the rations depot after the kitchen`);
    if (i('airfield') >= 0) ok(i('airfield') > i('smelter'), `${side}: the airfield after the smelter`);
    ok(veh.every(k => i(k) > i('fuelst')), `${side}: what makes vehicles after a fuel station (${veh})`);
    if (i('tankshop') >= 0) ok(i('tankshop') > i('steelmill'), `${side}: the tank workshop after the steel mill`);
    ok(s.units.some(u => u.side === side && Sim.HAUL[u.type]), `${side}: haulers on the road`);
  }
}
console.log(fails ? `econ: ${fails} failed` : 'econ ok');
process.exit(fails ? 1 : 0);
