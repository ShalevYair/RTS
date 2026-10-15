// The supply chain in 3D: the deposits by the base, the mines / plants the bots built, the haulers, the stock by the
// power bar, and the industry page of the build menu (locked items say what they wait for).
// node tests/ui/econ3d.js → tests/ui/out/3d/econ_{base,menu,start}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-arms', 'guns,armor'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const out = dir => path.join(__dirname, 'out', '3d', dir);
  // (the start: our HQ down, nothing else — the industry page: only the quarry open)
  const start = await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
    while (!s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)) Sim.step(s, 1 / 30);
    for (let i = 0; i < 30; i++) Sim.step(s, 1 / 30);
    s.bots = ['red'];
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 120; cam.y = n.y; cam.z = zoomMax() * 0.18; applyView();
    await new Promise(r => setTimeout(r, 800)); updateHud();
    const need = ['tent', 'tankshop', 'fuelst', 'concrete', 'quarry'].map(k => k + ':' + (Sim.needsOf(s, 'blue', k) || '-'));
    return { deps: s.deposits.length, home: s.deposits.filter(d => d.home === 'blue').map(d => d.kind), need, stock: document.getElementById('stockB').textContent };
  });
  console.log('start', JSON.stringify(start));
  await p.click('[data-cat="industry"]'); await p.waitForTimeout(400);
  console.log('menu', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#buildm [data-build].pg')].map(b => b.dataset.build + (b.classList.contains('locked') ? ' 🔒 ' : ' ') + b.querySelector('small').textContent))));
  await p.screenshot({ path: out('econ_menu.png') });
  // (the quarry armed: the lime deposits ringed)
  await p.click('#buildm [data-build="quarry"]'); await p.waitForTimeout(300);
  const d = await p.evaluate(() => { const d = s.deposits.find(d => d.home === 'blue' && d.kind === 'lime'); const q = worldToScr(d.x + 20, d.y + 10); const r = cv.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; });
  await p.mouse.move(d.x, d.y); await p.waitForTimeout(500);
  await p.screenshot({ path: out('econ_start.png') });
  await p.mouse.click(d.x, d.y); await p.waitForTimeout(300);
  console.log('quarry laid', await p.evaluate(() => s.nodes.some(n => n.side === 'blue' && n.kind === 'quarry')));
  // (eight minutes of the bots on: the chain up — the base close in)
  const mid = await p.evaluate(async () => {
    s.bots = ['blue', 'red']; while (s.t < 840) Sim.step(s, 1 / 30); s.bots = ['red'];
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 150; cam.y = n.y + 60; cam.z = zoomMax() * 0.22; applyView();
    await new Promise(r => setTimeout(r, 1500)); updateHud();
    const K = k => s.nodes.filter(n => n.side === 'blue' && n.kind === k && n.hp > 0 && s.t >= n.ready).length;
    return { t: Math.round(s.t), mines: ['quarry', 'oilwell', 'ironmine'].map(k => k + ' ' + K(k)), plants: ['concrete', 'refinery', 'steelmill', 'fuelst', 'tankshop'].map(k => k + ' ' + K(k)), haul: s.units.filter(u => u.side === 'blue' && Sim.HAUL[u.type]).map(u => u.type + ' ' + Math.round(u.cargo || 0)), stock: document.getElementById('stockB').textContent };
  });
  console.log('mid', JSON.stringify(mid));
  await p.screenshot({ path: out('econ_base.png') });
  // (close in: each industry building, and a hauler)
  for (const k of ['refinery', 'steelmill', 'concrete', 'oilwell', 'ironmine', 'quarry', 'smelter', 'farm', 'kitchen', 'chemplant', 'bauxmine']) {
    const ok = await p.evaluate(async k => { const n = s.nodes.find(n => n.side === 'blue' && n.kind === k && n.hp > 0); if (!n) return false; cam.x = n.x; cam.y = n.y; cam.z = zoomMax() * 0.6; applyView(); await new Promise(r => setTimeout(r, 900)); return true; }, k);
    if (ok) await p.screenshot({ path: out('econ_' + k + '.png'), clip: { x: 500, y: 200, width: 600, height: 500 } });
  }
  await p.evaluate(async () => { const u = s.units.find(u => u.side === 'blue' && Sim.HAUL[u.type]); s.units.filter(u => u.side === 'blue' && Sim.HAUL[u.type]).forEach((m, i) => { m.x = u.x + i * 18; m.y = u.y; }); cam.x = u.x + 18; cam.y = u.y; cam.z = zoomMax() * 0.95; applyView(); await new Promise(r => setTimeout(r, 900)); });
  await p.screenshot({ path: out('econ_haul.png'), clip: { x: 500, y: 250, width: 600, height: 400 } });
  console.log('errors', errs); await b.close();
})();
