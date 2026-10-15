// A lake below a hill in 3D, from the side: node tests/ui/lake3d.js <name> [seed] → tests/ui/out/3d/lake_<name>.png
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const name = process.argv[2] || 'now', seed = +process.argv[3] || 7;
  const out = path.join(__dirname, 'out', '3d'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async seed => {
    Math.random = (() => { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => seed * 1000; startGame(0); Date.now = dn; s.fog = false; s.night = false; while (s.t < 30) Sim.step(s, 1 / 30); rate = 0;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, .tip, #infoCard').forEach(e => e.style.display = 'none');
  }, seed);
  // the lake with the highest ground within 400 of its shore
  const at = await p.evaluate(() => { let best = null, bh = -1; for (const l of s.lakes) for (let a = 0; a < 6.28; a += 0.3) { const R = Math.max(l.rx, l.ry) + 250, x = l.x + Math.cos(a) * R, y = l.y + Math.sin(a) * R; const h = Sim.elevAt(s, { x, y }); if (h > bh) { bh = h; best = [l.x, l.y, x, y]; } } return best; });
  for (const [i, f] of [[0, 0.5], [1, 0.8]]) {
    await p.evaluate(([lx, ly, hx, hy, f]) => { cam.z = Math.max(1, zoomMax() * f); cam.x = lx; cam.y = ly; V3.yaw = Math.atan2(hy - ly, hx - lx) + Math.PI / 2; V3.pitch = 0.6; applyView(); }, [...at, f]);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, `lake_${name}_${i}.png`) });
  }
  console.log('done'); await b.close();
})();
