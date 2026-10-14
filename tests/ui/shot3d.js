// Pictures of the 3D view, to compare looks: a bot game (big map) run to N s, then the camera on our HQ and on the
// highest hill: close (the most zoom), middle and far. node tests/ui/shot3d.js [name=now] [seconds=50 — noon] [seed]
// → tests/ui/out/3d/<name>_<place>_<zoom>.png. Needs the server (play.bat / python -m http.server 8765).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const name = process.argv[2] || 'now', secs = +process.argv[3] || 50, seed = +process.argv[4] || 7;
  const out = path.join(__dirname, 'out', '3d'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: false, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }) });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async ([secs, seed]) => {
    Math.random = (() => { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => seed * 1000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; playing = true; while (s.t < secs) Sim.step(s, 1 / 30); rate = 0;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, .tip, #infoCard').forEach(e => e.style.display = 'none');
  }, [secs, seed]);
  const hq = await p.evaluate(() => { const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || s.nodes.find(n => n.side === 'blue'); return n ? [n.x, n.y] : [s.W / 4, s.H / 2]; });
  const hill = await p.evaluate(() => { const E = s.elev; let b = 0, bi = 0; for (let i = 0; i < E.g.length; i++) if (E.g[i] > b && (i % E.w) * ELEV_CELL < s.W / 2) { b = E.g[i]; bi = i; } return [(bi % E.w) * ELEV_CELL, Math.floor(bi / E.w) * ELEV_CELL]; });
  for (const [place, [x, y], zn, f] of [['hq', hq, 'close', 1], ['hq', hq, 'mid', 0.45], ['hill', hill, 'mid', 0.45], ['hq', hq, 'far', 0.18]]) {
    await p.evaluate(([x, y, f]) => { cam.z = Math.max(1, zoomMax() * f); cam.x = x; cam.y = y; applyView(); }, [x, y, f]);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(out, `${name}_${place}_${zn}.png`) });
  }
  console.log('done', out); await b.close();
})();
