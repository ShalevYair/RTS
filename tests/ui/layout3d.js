// The HUD in a real game (3D): the fronts' flag top left over the building kinds, the stock bottom left, the partner's
// kinds hidden; a soldier out of rations shows the food light. node tests/ui/layout3d.js → tests/ui/out/3d/layout.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-arms', 'armor,infantry'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  console.log(JSON.stringify(await p.evaluate(async () => {
    startGame(0); s.fog = false; s.night = false; setPlaying(false);
    while (!s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)) Sim.step(s, 1 / 30);
    for (let i = 0; i < 30 * 40; i++) Sim.step(s, 1 / 30);
    const inf = s.units.find(u => u.side === 'blue' && u.water !== undefined); if (inf) inf.water = 0;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    if (inf) { cam.x = inf.x; cam.y = inf.y; cam.z = zoomMax() * 0.7; applyView(); }
    setPlaying(true); await new Promise(r => setTimeout(r, 2500)); setPlaying(false);
    const vis = el => el && !el.hidden && el.offsetParent !== null;
    return { cats: [...document.querySelectorAll('[data-cat]')].filter(vis).map(b => b.dataset.cat), front: vis(document.getElementById('front')), stock: vis(document.getElementById('stockB')) };
  })));
  await p.screenshot({ path: path.join(__dirname, 'out', '3d', 'layout.png') });
  console.log('errors', errs); await b.close();
})();
