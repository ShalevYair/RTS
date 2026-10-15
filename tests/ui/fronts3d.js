// Fronts in 3D: 🚩, a line dragged on the map with the mouse — the army goes to it; armed again, a click on the line
// takes it off. node tests/ui/fronts3d.js → tests/ui/out/3d/fronts_{draw,after}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const line = await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
    while (s.t < 480) Sim.step(s, 1 / 30);
    s.bots = ['red'];
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'), X = n.x + (s.W / 2 - n.x) * 0.5;
    cam.x = X; cam.y = s.H / 2; cam.z = zoomMax() * 0.12; applyView();
    await new Promise(r => setTimeout(r, 600));
    // (the line on the screen: a bent one, top to bottom of the middle of the view)
    return [[X, s.H * 0.3], [X + 120, s.H * 0.5], [X, s.H * 0.7]].map(([x, y]) => worldToScr(x, y));
  });
  const r = await p.evaluate(() => { const b = cv.getBoundingClientRect(); return [b.left, b.top]; });
  await p.click('#front'); await p.waitForTimeout(200);
  const pts = [];
  for (let i = 0; i < line.length - 1; i++) for (let k = 0; k <= 12; k++) { const a = line[i], z = line[i + 1]; pts.push({ x: r[0] + a.x + (z.x - a.x) * k / 12, y: r[1] + a.y + (z.y - a.y) * k / 12 }); }
  await p.mouse.move(pts[0].x, pts[0].y); await p.mouse.down();
  for (const q of pts) await p.mouse.move(q.x, q.y, { steps: 2 });
  await p.screenshot({ path: path.join(__dirname, 'out', '3d', 'fronts_draw.png') });
  await p.mouse.up(); await p.waitForTimeout(300);
  const out = await p.evaluate(async () => {
    const F = s.fronts && s.fronts.blue || [], f0 = F[0];
    for (let i = 0; i < 30 * 150; i++) Sim.step(s, 1 / 30); cam.z = zoomMax() * 0.2; applyView();
    await new Promise(r => setTimeout(r, 1200));
    const on = s.squads.filter(q => q.side === 'blue' && !q.dead && q.front);
    return { fronts: F.length, pts: f0 && f0.pts.length, on: on.length, mate: on.filter(q => !Sim.ownSquad(s, q)).length, armed: frontArmed };
  });
  console.log('after', JSON.stringify(out));
  await p.screenshot({ path: path.join(__dirname, 'out', '3d', 'fronts_after.png') });
  // (armed again: a click on the line — off)
  await p.click('#front'); await p.waitForTimeout(200);
  const m = await p.evaluate(() => { const f = s.fronts.blue[0], q = f.pts[Math.floor(f.pts.length / 2)]; return worldToScr(q.x, q.y); }); await p.mouse.click(r[0] + m.x, r[1] + m.y); await p.waitForTimeout(300);
  console.log('removed', await p.evaluate(() => (s.fronts.blue || []).length));
  console.log('errors', errs); await b.close();
})();
