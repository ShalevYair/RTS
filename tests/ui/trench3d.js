// Dug-in units in 3D up close: soldiers in their foxholes and a tank in its scrape. node tests/ui/trench3d.js [name]
// → tests/ui/out/3d/trench_<name>_{close,mid}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const name = process.argv[2] || 'now';
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-fixedhq', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.fog = false; s.night = false; s.wxPlan = []; s.wxNow = null; rate = 0; setPlaying(false);
    const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'), cx = hq.x + 260, cy = hq.y;
    const mk = (t, x, y, a) => { const q = Sim._makeSquad(s, 'blue', t, null, x, y); q.size = 1; Sim._fillSquad(s, q, x, y); const u = s.units[s.units.length - 1]; u.x = x; u.y = y; u.hd = a; q.cx = x; q.cy = y; return u; };
    for (let i = 0; i < 4; i++) { const u = mk('inf', cx + i * 22, cy - 40 + (i % 2) * 10, 0); u.dug = true; u.dig = 1; s.trenches = s.trenches || []; s.trenches.push({ x: u.x, y: u.y, k: 'foot', a: 0, t: s.t, side: 'blue' }); }
    const tk = mk('tank', cx + 30, cy + 40, 0); tk.dug = true; tk.dig = 1; s.trenches.push({ x: tk.x, y: tk.y, k: 'tank', a: 0, t: s.t, side: 'blue' });
    s.trenches.push({ x: cx + 110, y: cy + 40, k: 'tank', a: 0.4, t: s.t, side: 'blue' }); s.trenches.push({ x: cx + 110, y: cy - 40, k: 'foot', a: 0.4, t: s.t, side: 'blue' });
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, #infoCard').forEach(e => e.style.display = 'none');
    cam.x = cx + 50; cam.y = cy; cam.z = zoomMax(); V3.pitch = 0.55; V3.yaw = 0.5; applyView(); window.__c = [cx, cy];
  });
  const out = k => path.join(__dirname, 'out', '3d', `trench_${name}_${k}.png`);
  await p.waitForTimeout(2500); await p.screenshot({ path: out('close') });
  await p.evaluate(() => { cam.z = zoomMax() * 0.6; V3.pitch = 0.9; applyView(); }); await p.waitForTimeout(1500); await p.screenshot({ path: out('mid') });
  console.log('errors', errs); await b.close();
})();
