// The deposits in 3D (v3Deposits): one of each kind close in — the patch of its ground, the stones / oil pools / wheat
// — then one half dug and one dry, and the base from the usual height. node tests/ui/deps3d.js → tests/ui/out/3d/dep_*.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const out = n => path.join(__dirname, 'out', '3d', n);
  console.log(JSON.stringify(await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false; s.night = false;
    while (!s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)) Sim.step(s, 1 / 30);
    s.bots = []; setPlaying(false);
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 1500));
    return { deps: s.deposits.map(d => d.kind + (d.rich > 1.5 ? '★' : '') + (d.home ? '@' + d.home : '')) };
  })));
  const at = async (d, z, name) => { await p.evaluate(async ([x, y, z]) => { cam.x = x; cam.y = y; cam.z = zoomMax() * z; applyView(); await new Promise(r => setTimeout(r, 900)); }, [d.x, d.y, z]); await p.screenshot({ path: out(name), clip: { x: 450, y: 180, width: 700, height: 540 } }); };
  for (const k of ['oil', 'iron', 'lime', 'bauxite', 'farm']) {
    const d = await p.evaluate(k => { const d = s.deposits.find(d => d.kind === k && Sim.freeDeposit(s, d.kind, d.x, d.y)); return d && { x: d.x, y: d.y }; }, k);
    if (d) await at(d, 0.75, 'dep_' + k + '.png');
  }
  // (half dug, and dry)
  const two = await p.evaluate(() => { const L = s.deposits.filter(d => d.kind === 'iron'); L[0].left = L[0].amount * 0.4; L[1].left = 0; return L.slice(0, 2).map(d => ({ x: d.x, y: d.y })); });
  await at(two[0], 0.75, 'dep_half.png'); await at(two[1], 0.75, 'dep_dry.png');
  await p.evaluate(async () => { const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 120; cam.y = n.y; cam.z = zoomMax() * 0.25; applyView(); await new Promise(r => setTimeout(r, 900)); });
  await p.screenshot({ path: out('dep_base.png') });
  console.log('errors', errs); await b.close();
})();
