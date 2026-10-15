// The wheel's second round in 3D: hovering a kind lights those that'd come on the map with when they'd be there;
// Alt + double click repeats the last summons at a new spot; eyes and care send one of each.
// node tests/ui/wheel2_3d.js → tests/ui/out/3d/wheel2_{top,hover,care}.png
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
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 300; cam.y = n.y; cam.z = zoomMax() * 0.3; applyView();
  });
  await p.waitForTimeout(2000);
  const out = k => path.join(__dirname, 'out', '3d', `wheel2_${k}.png`), C = [800, 450];
  const labels = () => p.evaluate(() => [...document.querySelectorAll('#askWheel button')].map(b => b.getAttribute('aria-label') + ':' + (b.querySelector('.sumN') || {}).textContent).join(' | '));
  const btn = async label => p.evaluate(l => { const b = [...document.querySelectorAll('#askWheel button')].find(b => b.getAttribute('aria-label') === l); if (!b) return null; const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, label);
  const alt = async xy => { await p.keyboard.down('Alt'); await p.mouse.click(...xy); await p.keyboard.up('Alt'); await p.waitForTimeout(300); };
  await alt(C); console.log('top', await labels()); await p.screenshot({ path: out('top'), clip: { x: 600, y: 250, width: 400, height: 400 } });
  const f = await btn(await p.evaluate(() => tr('sum_forces'))); await p.mouse.move(...f); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
  const tk = await btn(await p.evaluate(() => tn('tank'))) || await btn(await p.evaluate(() => tr('sum_foot')));
  await p.mouse.move(...tk); await p.waitForTimeout(600);
  console.log('hover', await p.evaluate(() => JSON.stringify({ lit: wheel && wheel.hover ? [...wheel.hover] : null, eta: (document.querySelector('#askWheel .sumEta') || {}).textContent })));
  await p.screenshot({ path: out('hover') });
  await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
  const n0 = await p.evaluate(() => s.asks.filter(a => a.kind === 'summon').length);
  // (Alt + double click elsewhere: the same again)
  await p.keyboard.down('Alt'); await p.mouse.dblclick(1000, 600); await p.keyboard.up('Alt'); await p.waitForTimeout(300);
  console.log('repeat', await p.evaluate(n0 => { const a = s.asks.filter(a => a.kind === 'summon'); const w = scrToWorld(1000, 600); return JSON.stringify({ before: n0, now: a.length, last: a.length && [a[a.length - 1].x, a[a.length - 1].y], want: [Math.round(w.x), Math.round(w.y)], wheel: !!$('askWheel') }); }, n0));
  // (care: one of each)
  await alt([700, 380]);
  const c = await btn(await p.evaluate(() => tr('sum_care')));
  if (c) { await p.mouse.move(...c); await p.waitForTimeout(400); await p.screenshot({ path: out('care') }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    console.log('care', await p.evaluate(() => { const a = s.asks[s.asks.length - 1]; return JSON.stringify(a.by.map(id => s.squads.find(q => q.id === id).type)); })); } else console.log('no care button');
  await alt([900, 380]);
  const e = await btn(await p.evaluate(() => tr('sum_eyes')));
  if (e) { const d0 = await p.evaluate(() => Sim.dronesUp(s, 'blue')); await p.mouse.move(...e); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    console.log('eyes', await p.evaluate(d0 => { const a = s.asks[s.asks.length - 1]; return JSON.stringify({ types: a.by.map(id => s.squads.find(q => q.id === id).type), drones: [d0, Sim.dronesUp(s, 'blue')] }); }, d0)); } else console.log('no eyes button');
  console.log('errors', errs); await b.close();
})();
