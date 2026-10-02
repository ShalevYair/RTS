// Bulldozers (the full game): sites go on a bulldozer's list in the order they're laid, forward HQs among them; sent
// elsewhere it stops, and a site given to it again comes first, then the rest in order. No forward HQ before the HQ
// stands and a minute after, and never on another building.
const { Sim } = require('./bench.js');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const step = (s, sec) => { for (let i = 0; i < sec * 30; i++) Sim.step(s, 1 / 30); };
const s = Sim.openField(Sim.create(10, 2000, 'normal', 1280)); s.bots = []; s.fog = false;
const dz = s.squads.find(q => q.side === 'blue' && q.type === 'dozer');
ok(!Sim.canBuildFhq(s, dz), 'no forward HQ before the HQ');
Sim.planHq(s, 'blue', 250, 640); step(s, 50);
const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
ok(hq && s.t >= hq.ready, 'the bulldozer put the HQ up');
ok(!Sim.canBuildFhq(s, dz) && s.cd.blue.fhq > 20, `a minute to wait for the first forward HQ (${Math.round(s.cd.blue.fhq)} s)`);
ok(Sim.build(s, 'blue', 'tent', 380, 540) && Sim.build(s, 'blue', 'jeepshop', 380, 760), 'two buildings laid');
step(s, 61);
ok(Sim.canBuildFhq(s, dz), 'now a forward HQ may go up');
ok(Sim.fhqCheck(s, 330, 560) === 'gap' && !Sim.planFhq(s, dz.id, 330, 565), 'not on a building');
const [a, b] = s.nodes.filter(n => n.side === 'blue' && (n.kind === 'tent' || n.kind === 'jeepshop'));
const aDone = s.t >= a.ready;
ok(Sim.planFhq(s, dz.id, 420, 640), 'a forward HQ laid');
const f = s.nodes.find(n => n.side === 'blue' && n.kind === 'fhq');
ok(f && dz.jobs[dz.jobs.length - 1] === f.id, `it goes at the end of the list (${dz.jobs})`);
ok(Sim.jobOf(s, dz) === (aDone ? b : a), 'the bulldozer keeps to the building it was on');
// sent away: it stops; given the forward HQ: that first, then on with the list
Sim.order(s, dz.id, 'hold', 150, 300); step(s, 3);
ok(dz.paused, 'sent elsewhere, it stops work');
const w0 = (Sim.jobOf(s, dz) || {}).work; step(s, 5);
ok((Sim.jobOf(s, dz) || {}).work === w0, 'and the site waits');
Sim.assignSite(s, dz, f, true);
ok(!dz.paused && Sim.jobOf(s, dz) === f, 'given a site: back to work, that one first');
step(s, 70);
ok(s.t >= f.ready, 'the forward HQ is up');
step(s, 80);
ok([a, b].every(n => s.t >= n.ready), 'then the rest, in order');
{
  // the HQ hit: the nearest bulldozer (ours and the enemy's) leaves its work, mends it, and goes back to its list
  const g = Sim.openField(Sim.create(11, 2000, 'normal', 1280)); g.bots = []; g.fog = false;
  Sim.planHq(g, 'blue', 250, 640); Sim.planHq(g, 'red', 1750, 640); step(g, 60);
  const hs = ['blue', 'red'].map(side => g.nodes.find(n => n.side === side && n.kind === 'hq'));
  ok(hs.every(h => h && g.t >= h.ready), 'both HQs up');
  ok(Sim.build(g, 'blue', 'tent', 420, 500), 'a site for our bulldozer');
  // (theirs has nothing to build: it goes at 60%; ours is at work: only once the HQ is badly hurt)
  hs[0].hp = Sim.STRUCTS.hq.hp * 0.6; hs[1].hp = Sim.STRUCTS.hq.hp * 0.6; step(g, 8);
  const busy = () => g.squads.find(q => q.side === 'blue' && q.type === 'dozer' && q.fixHq);
  ok(!busy() && g.squads.some(q => q.side === 'red' && q.type === 'dozer' && q.fixHq), 'hit to 60%: their idle bulldozer goes to mend it, ours stays at its site');
  hs[0].hp = Sim.STRUCTS.hq.hp * 0.4; step(g, 2);
  ok(!busy(), 'not while the HQ is still being hit');
  step(g, 8);
  const fixers = ['blue', 'red'].map(side => g.squads.find(q => q.side === side && q.type === 'dozer' && q.fixHq));
  ok(fixers.every(Boolean), 'under half, once the attack is over: ours leaves its site for it too');
  step(g, 130);
  ok(hs.every(h => h.hp >= Sim.STRUCTS.hq.hp * 0.99), `and the HQs are whole again (${hs.map(h => Math.round(h.hp)).join(', ')})`);
  ok(fixers.every(q => !q.fixHq), 'the bulldozers are done with them');
  const site = g.nodes.find(n => n.side === 'blue' && n.kind === 'tent');
  step(g, 60);
  ok(g.t >= site.ready, 'ours went back and put the tent up');
}
