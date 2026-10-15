// A saved game in the browser: a full game played a while, 💾, the page loaded again, "continue" — the same game
// (time, units, buildings), in 3D, without errors. node tests/ui/save3d.js → tests/ui/out/3d/save.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const sig = () => p.evaluate(() => ({ t: Math.round(s.t), units: s.units.length, nodes: s.nodes.length, hp: Math.round(s.units.reduce((a, u) => a + u.hp, 0)) }));
  await p.evaluate(async () => { startGame(0); s.bots = ['blue', 'red']; while (s.t < 240) Sim.step(s, 1 / 30); setPlaying(false); });
  await p.waitForTimeout(1500);
  const before = await sig();
  console.log('saved', await p.evaluate(() => saveGame(true)), JSON.stringify(before));
  await p.waitForTimeout(1500);
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(2500);
  console.log('resume shown', await p.evaluate(() => !$('resume').hidden), await p.evaluate(() => $('resume').textContent));
  await p.click('#resume'); await p.waitForTimeout(500);
  await p.evaluate(async () => { while (!V3.on) await new Promise(r => setTimeout(r, 100)); setPlaying(false); });
  const after = await sig(); console.log('loaded', JSON.stringify(after), 'same', JSON.stringify(before) === JSON.stringify(after));
  await p.evaluate(() => { s.bots = ['blue', 'red']; setPlaying(true); }); await p.waitForTimeout(4000);
  console.log('runs on', JSON.stringify(await sig()), 'errors', errs);
  await p.screenshot({ path: path.join(__dirname, 'out', '3d', 'save.png') });
  await b.close();
})();
