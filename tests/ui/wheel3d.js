// The Alt + click wheel in 3D: a full game played a while, Alt + click near our base — the wheel (forces, supplies…);
// into forces; a click on a topic of several kinds opens it; tanks held — the number counts up, let go — that many sent.
// node tests/ui/wheel3d.js → tests/ui/out/3d/wheel_{top,forces,hold,jeeps}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; while (s.t < 600) Sim.step(s, 1 / 30); s.bots = ['red']; hqArmed = false;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('.feed, #feed, #infoCard').forEach(e => e.style.display = 'none');
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 300; cam.y = n.y; cam.z = zoomMax() * 0.45; applyView();
  });
  await p.waitForTimeout(2000);
  const out = k => path.join(__dirname, 'out', '3d', `wheel_${k}.png`), C = [800, 450];
  await p.keyboard.down('Alt'); await p.mouse.click(...C); await p.keyboard.up('Alt'); await p.waitForTimeout(400);
  console.log('state', await p.evaluate(() => JSON.stringify({ hqArmed, buildArmed, fhqArmed, frontArmed, eyeArmed, roadArmed, menu: menu.hidden, bm: $('buildm').hidden, over: !!s.over, wheel: !!$('askWheel') })));
  console.log('top', await p.evaluate(() => [...document.querySelectorAll('#askWheel button')].map(b => b.getAttribute('aria-label') + ':' + (b.querySelector('.sumN') || {}).textContent).join(' | ')));
  await p.screenshot({ path: out('top'), clip: { x: 600, y: 250, width: 400, height: 400 } });
  const btn = async label => { const r = await p.evaluate(l => { const b = [...document.querySelectorAll('#askWheel button')].find(b => b.getAttribute('aria-label') === l); if (!b) return null; const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, label); return r; };
  const f = await btn(await p.evaluate(() => tr('sum_forces'))); await p.mouse.move(...f); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400);
  console.log('forces', await p.evaluate(() => [...document.querySelectorAll('#askWheel button')].map(b => b.getAttribute('aria-label') + ':' + (b.querySelector('.sumN') || {}).textContent).join(' | ')));
  await p.mouse.move(820, 300); await p.waitForTimeout(200); await p.screenshot({ path: out('forces'), clip: { x: 600, y: 250, width: 400, height: 400 } });
  const tk = await btn(await p.evaluate(() => tn('tank')));
  if (tk) {
    const before = await p.evaluate(() => s.squads.filter(q => q.side === 'blue' && q.type === 'tank' && !q.dead).length);
    await p.mouse.move(...tk); await p.mouse.down(); await p.waitForTimeout(1500); await p.screenshot({ path: out('hold'), clip: { x: 600, y: 250, width: 400, height: 400 } });
    const shown = await p.evaluate(() => (document.querySelector('#askWheel .sumN.on') || {}).textContent);
    await p.mouse.up(); await p.waitForTimeout(300);
    console.log('tanks', before, 'held count', shown, 'summoned', await p.evaluate(() => { const at = scrToWorld(800, 450); return JSON.stringify({ at, ping: pings[pings.length - 1], tanks: s.squads.filter(q => q.type === 'tank' && q.side === 'blue' && !q.dead).map(q => [q.id, Math.round(q.order.x), Math.round(q.order.y), q.orderAt, Sim.ownSquad(s, q)]), t: s.t, waiting: (s.summons || []).length }); }));
  }
  await p.keyboard.down('Alt'); await p.mouse.click(...C); await p.keyboard.up('Alt'); await p.waitForTimeout(300);
  const f2 = await btn(await p.evaluate(() => tr('sum_forces'))); await p.mouse.move(...f2); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
  console.log('wheel2', await p.evaluate(() => [...document.querySelectorAll('#askWheel button')].map(b => b.getAttribute('aria-label')).join(' | ')));
  const j = await btn(await p.evaluate(() => tr('sum_guns'))) || await btn(await p.evaluate(() => tr('sum_helis')));
  if (j) { await p.mouse.move(...j); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300); console.log('sub', await p.evaluate(() => [...document.querySelectorAll('#askWheel button')].map(b => b.getAttribute('aria-label') + ':' + (b.querySelector('.sumN') || {}).textContent).join(' | '))); await p.mouse.move(820, 300); await p.screenshot({ path: out('jeeps'), clip: { x: 600, y: 250, width: 400, height: 400 } }); }
  console.log('errors', errs); await b.close();
})();
