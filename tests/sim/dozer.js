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
ok(Sim.build(s, 'blue', 'tent', 330, 560) && Sim.build(s, 'blue', 'jeepshop', 330, 730), 'two buildings laid');
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
