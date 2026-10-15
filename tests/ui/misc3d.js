// A few UI checks in 3D: rain zoomed far out (streaks over the whole screen), a post's card with "take it", a squad's
// card on picking it, the summon wheel's supply marks. node tests/ui/misc3d.js → tests/ui/out/3d/misc_*.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof newGame === 'function' && typeof TILES === 'object', null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; while (s.t < 600) Sim.step(s, 1 / 30); s.bots = ['red']; hqArmed = false; s.night = false;
    s.wxPlan = [{ kind: 'rain', a: 0, b: 3000 }]; s.wxNow = null;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed').forEach(e => e.style.display = 'none');
    cam.x = s.W / 3; cam.y = s.H / 2; cam.z = zoomMax() * 0.12; applyView();
  });
  const out = k => path.join(__dirname, 'out', '3d', `misc_${k}.png`);
  await p.waitForTimeout(2500); await p.screenshot({ path: out('rainfar') });
  console.log('rainFar', await p.evaluate(() => V3.rainFar));
  // a post's card
  await p.evaluate(() => { s.wxPlan = []; s.wxNow = null; const pt = s.posts.find(q => q.side !== 'blue'); cam.x = pt.x; cam.y = pt.y; cam.z = zoomMax() * 0.5; applyView(); window.__pt = pt; });
  await p.waitForTimeout(1500);
  const sp = await p.evaluate(() => { const q = worldToScr(__pt.x, __pt.y); const r = cv.getBoundingClientRect(); return [q.x + r.left, q.y + r.top]; });
  await p.mouse.click(...sp); await p.waitForTimeout(700);
  console.log('post card', await p.evaluate(() => ({ shown: !$('infoCard').hidden, take: !$('icTake').hidden, dis: $('icTake').getAttribute('aria-disabled'), text: $('icTake').textContent })));
  await p.screenshot({ path: out('postcard') });
  await p.click('#icTake'); await p.waitForTimeout(300);
  console.log('sent to take', await p.evaluate(() => s.squads.filter(q => q.side === 'blue' && Sim.CAPTURERS.includes(q.type) && q.order.type === 'attack' && Math.hypot(q.order.x - __pt.x, q.order.y - __pt.y) < 60).length));
  // a squad picked by key: its card
  await p.evaluate(() => { const q = s.squads.find(q => q.side === 'blue' && !q.dead && q.type === 'tank' && Sim.ownSquad(s, q)); select(q.id); });
  await p.waitForTimeout(600); console.log('squad card', await p.evaluate(() => !$('infoCard').hidden && $('infoCard').querySelector('b').textContent));
  await p.evaluate(() => { cam.x = 100; cam.y = 100; applyView(); }); await p.click('#infoCard canvas'); await p.waitForTimeout(300);
  console.log('jumped', await p.evaluate(() => { const q = s.squads.find(q => q.id === card.id); return Math.round(Math.hypot(cam.x - q.cx, cam.y - q.cy)); }));
  // the wheel's supply marks
  await p.evaluate(() => { select(null); closeCard(); }); await p.keyboard.down('Alt'); await p.mouse.click(800, 450); await p.keyboard.up('Alt'); await p.waitForTimeout(300);
  const sb = await p.evaluate(() => { const b = [...document.querySelectorAll('#askWheel button')].find(b => b.getAttribute('aria-label') === tr('sum_supply')); if (!b) return null; const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; });
  if (sb) { await p.mouse.move(...sb); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300); await p.mouse.move(820, 300); await p.screenshot({ path: out('supply'), clip: { x: 600, y: 250, width: 400, height: 400 } }); }
  // a long left press with nothing picked: the wheel
  await p.keyboard.press('Escape'); await p.mouse.click(10, 450, { button: 'right' }).catch(() => {}); await p.evaluate(() => { closeAskWheel(); select(null); });
  await p.mouse.move(700, 500); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(200);
  console.log('long press wheel', await p.evaluate(() => !!$('askWheel')));
  console.log('errors', errs); await b.close();
})();
