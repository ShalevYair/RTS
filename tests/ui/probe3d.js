// A quick look inside the 3D view: a bot game (big map) to N s, the camera on our HQ up close, then an expression
// evaluated in the page and printed, and a picture (PRE="<js>": run before the first 3D frame). node tests/ui/probe3d.js "<js expression>" [seconds=480] [shot.png]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const expr = process.argv[2] || '1', secs = +process.argv[3] || 480, shot = process.argv[4];
  const b = await chromium.launch({ headless: false, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }) });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.text().slice(0, 600)); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function'); await p.waitForTimeout(1500);
  await p.evaluate(async ([secs, pre]) => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; playing = true; while (s.t < secs) Sim.step(s, 1 / 30); rate = 0;
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    if (pre) eval(pre); // (PRE=…: before the first frame — e.g. a setting the shaders read)
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq') || s.nodes[0]; cam.x = n.x; cam.y = n.y; cam.z = zoomMax(); applyView();
  }, [secs, process.env.PRE || '']);
  await p.waitForTimeout(2000);
  console.log(JSON.stringify(await p.evaluate(e => eval(e), expr)));
  if (shot) await p.screenshot({ path: path.resolve(shot) });
  await b.close();
})();
