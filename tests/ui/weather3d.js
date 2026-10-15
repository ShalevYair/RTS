// The weather in 3D, forced on: a dust storm at noon and a lightning strike in the rain at night (its flash held at
// the peak). node tests/ui/weather3d.js [name] → tests/ui/out/3d/wx_<name>_{dust,dust_far,bolt}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const name = process.argv[2] || 'now';
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; while (s.t < 470) Sim.step(s, 1 / 30); rate = 0;
    s.wxPlan = [{ kind: 'dust', a: 0, b: 2000 }]; s.wxNow = null;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, .tip, #infoCard').forEach(e => e.style.display = 'none');
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || s.nodes.find(n => n.side === 'blue'); cam.x = n.x + 200; cam.y = n.y; cam.z = zoomMax() * 0.5; applyView();
  });
  const out = k => path.join(__dirname, 'out', '3d', `wx_${name}_${k}.png`);
  if (process.env.CLEAR) { await p.evaluate(() => { s.wxPlan = []; s.wxNow = null; cam.z = zoomMax() * 0.2; applyView(); }); await p.waitForTimeout(2500); await p.screenshot({ path: out('clear') }); await p.evaluate(() => { s.wxPlan = [{ kind: 'dust', a: 0, b: 2000 }]; s.wxNow = null; cam.z = zoomMax() * 0.5; applyView(); }); }
  await p.waitForTimeout(2500); await p.screenshot({ path: out('dust') });
  await p.evaluate(() => { cam.z = zoomMax() * 0.2; applyView(); }); await p.waitForTimeout(1500); await p.screenshot({ path: out('dust_far') });
  await p.evaluate(() => { while (s.t < 480 + 250) Sim.step(s, 1 / 30); s.wxPlan = [{ kind: 'rain', a: 0, b: 3000 }]; s.wxNow = null; cam.z = zoomMax() * 0.45; V3.pitch = 0.35; applyView();
    setInterval(() => { bolt = { x: cam.x + 150, y: cam.y - 250, t0: performance.now() - 27, seed: 5, near: 1, path: bolt && bolt.seed === 5 ? bolt.path : null }; }, 4); });
  await p.waitForTimeout(2500); await p.screenshot({ path: out('bolt') });
  if (process.env.NOBOLT) { await p.evaluate(() => { BOLT.night = 9; bolt = null; for (let i = 1; i < 99999; i++) clearInterval(i); }); await p.waitForTimeout(1500); await p.screenshot({ path: out('nobolt') }); }
  if (process.env.EXP) for (const [k, js] of [['nolift', 'V3_BOLT.flash = 0'], ['nolight', 'V3_BOLT.flash = 0.75; V3_BOLT.light = 0'], ['nonight', 'V3_BOLT.light = 9000; bolt.near = 1; window.boltFlash0 = boltFlash']]) { await p.evaluate(js); await p.waitForTimeout(800); await p.screenshot({ path: out('bolt_' + k) }); }
  console.log('night', await p.evaluate(() => Sim.nightAt(s)), 'errors', errs); await b.close();
})();
