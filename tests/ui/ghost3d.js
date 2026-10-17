// Ours out of the exact picture, in 3D: the model itself see-through and faded where it was last reported, with a ring
// of doubt that grows with the time since. A tank and a few soldiers sent far out, then looked at.
// node tests/ui/ghost3d.js → tests/ui/out/3d/ghost_{near,far}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-arms', 'armor,infantry'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const out = n => path.join(__dirname, 'out', '3d', n);
  const r = await p.evaluate(async () => {
    startGame(0); s.night = false; s.wxPlan = []; setPlaying(false);
    while (!s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)) Sim.step(s, 1 / 30);
    const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
    const go = s.squads.filter(q => q.side === 'blue' && !q.dead && (q.type === 'tank' || q.type === 'inf' || q.type === 'jeep')).slice(0, 5);
    go.forEach((q, i) => Sim.order(s, q.id, 'attack', hq.x + 900, hq.y + (i - 2) * 40));
    for (let i = 0; i < 30 * 50; i++) Sim.step(s, 1 / 30);
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    const hid = go.filter(q => !sqShown(q)), at = hid.length ? guessAt(hid[0]) : null;
    if (at) { cam.x = at.x; cam.y = at.y; cam.z = zoomMax() * 0.85; applyView(); }
    await new Promise(r => setTimeout(r, 1500));
    return { sent: go.map(q => q.type), hidden: hid.length, at: at && [Math.round(at.x), Math.round(at.y)] };
  });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: out('ghost_near.png') });
  await p.evaluate(async () => { cam.z = zoomMax() * 0.45; applyView(); await new Promise(r => setTimeout(r, 1200)); });
  await p.screenshot({ path: out('ghost_far.png') });
  console.log('errors', errs); await b.close();
})();
