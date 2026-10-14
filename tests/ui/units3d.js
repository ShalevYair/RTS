// A line-up of every unit type in the 3D view (noon, the game paused), to look at the models up close:
// node tests/ui/units3d.js [name=now] [zoom factor=1] → tests/ui/out/3d/units_<name>.png
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const name = process.argv[2] || 'now', f = +process.argv[3] || 1;
  const out = path.join(__dirname, 'out', '3d'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: false, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }) });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async (f) => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; playing = true; while (s.t < 30) Sim.step(s, 1 / 30); rate = 0;
    // a flat, open spot in our half
    let x0 = s.W * 0.22, y0 = s.H * 0.5, best = 1e9;
    for (let i = 0; i < 400; i++) { const x = s.W * (0.1 + 0.3 * Math.random()), y = s.H * (0.2 + 0.6 * Math.random()); let c = 0;
      for (let dx = -200; dx <= 200; dx += 50) for (let dy = -120; dy <= 120; dy += 40) { c += Math.abs(elevAt(s, x + dx, y + dy) - elevAt(s, x, y)) * 5; if (lakeAt(s, { x: x + dx, y: y + dy })) c += 100; }
      for (const n of s.nodes) if (Math.hypot(n.x - x, n.y - y) < 260) c += 100; if (c < best) { best = c; x0 = x; y0 = y; } }
    if (s.scen) for (const it of (decor.rocks.items || [])) if (Math.abs(it.x - x0) < 260 && Math.abs(it.y - y0) < 160) scenKill && scenKill(it);
    s.units = s.units.filter(u => Math.hypot(u.x - x0, u.y - y0) > 300);
    const rows = [['inf', 'at', 'aa', 'med', 'commando'], ['tank', 'jeep', 'ajeep', 'tjeep', 'how', 'mlrs', 'dozer'], ['truck', 'fueltruck', 'watertruck', 'radio', 'mech', 'ssm', 'arrow', 'dome']];
    rows.forEach((row, j) => row.forEach((t, i) => { if (!TYPES[t]) return; for (const [sd, dy] of [['blue', 0], ['red', 70]]) {
      const x = x0 + (i - (row.length - 1) / 2) * (j === 0 ? 22 : 34), y = y0 - 170 + j * 120 + dy * (j === 0 ? 0.4 : 0.8);
      const q = Sim._makeSquad(s, sd, t, null, x, y); q.size = 1; spawn(s, q, x, y); const u = s.units[s.units.length - 1]; u.x = x; u.y = y; u.hd = u.aim = -0.5; } }));
    window.__c = [x0, y0];
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, .tip, #infoCard').forEach(e => e.style.display = 'none');
    cam.x = x0; cam.y = y0; cam.z = zoomMax() * f; applyView();
  }, f);
  await p.waitForTimeout(3000);
  if (process.env.EXPR) { console.log(JSON.stringify(await p.evaluate(e => eval(e), process.env.EXPR))); await p.waitForTimeout(800); } // (EXPR=…: run in the page before the picture)
  await p.screenshot({ path: path.join(out, `units_${name}.png`) });
  console.log('done'); await b.close();
})();
