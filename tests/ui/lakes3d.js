// The lakes in 3D from far: the water's colour at each lake's middle (white and mottled = the bug), at a few zooms,
// before and after the game runs on a minute. node tests/ui/lakes3d.js → tests/ui/out/3d/lakes_<k>.png
const { chromium } = require('playwright');
const path = require('path');
const { PNG } = (() => { try { return require('pngjs'); } catch (e) { return {}; } })();
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
    while (s.t < 120) Sim.step(s, 1 / 30);
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
  });
  const shot = async k => {
    await p.waitForTimeout(1500);
    const pts = await p.evaluate(() => s.lakes.map(l => worldToScr(l.x, l.y)).filter(q => q.x > 0 && q.y > 0 && q.x < innerWidth && q.y < innerHeight).map(q => [Math.round(q.x), Math.round(q.y)]));
    const f = path.join(__dirname, 'out', '3d', `lakes_${k}.png`), buf = await p.screenshot({ path: f });
    let cols = '';
    if (PNG) { const img = PNG.sync.read(buf); cols = pts.map(([x, y]) => { const i = (y * img.width + x) * 4; return `rgb(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]})`; }).join(' '); }
    console.log(k, cols || pts.length + ' lakes on screen');
  };
  for (const [k, z] of [['whole', 0], ['far', 0.12], ['mid', 0.3]]) { await p.evaluate(z => { cam.x = s.W / 2; cam.y = s.H / 2; cam.z = z ? zoomMax() * z : 1; applyView(); }, z); await shot(k); }
  for (const T of (process.env.TIMES || '480,540,600').split(',').map(Number)) {
    await p.evaluate(T => { while (s.t < T) Sim.step(s, 1 / 30); const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + (s.W / 2 - n.x) * 0.5; cam.y = s.H / 2; cam.z = zoomMax() * 0.12; applyView(); }, T);
    await shot('t' + T);
  }
  console.log('errors', errs); await b.close();
})();
