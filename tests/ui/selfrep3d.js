// A commander reports unasked: units of ours newly low on fuel / hurt — one line, not again until recovered, in 3D.
// node tests/ui/selfrep3d.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow frame/i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
    while (s.t < 600) Sim.step(s, 1 / 30);
    s.bots = ['red'];
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    const feed = () => [...document.querySelectorAll('#feed > *')].map(e => e.textContent);
    const step = sec => { const e = s.t + sec; while (s.t < e) { Sim.step(s, 1 / 30); reportTick(); } };
    const out = {}; step(3); out.natural = feed().slice(0, 3);
    const full = () => { for (const u of s.units) if (u.side === 'blue') { u.fuel = 1; u.water = 1; if (u.sup !== undefined) u.sup = 1; u.hp = Sim.TYPES[u.type].hp; } };
    s.bots = []; full(); step(3); selfLast = {}; const q0 = feed().length; full(); step(5); out.quiet = feed().length - q0;
    const tanks = s.units.filter(u => u.side === 'blue' && Sim.needsFuel(u.type) && !Sim.TYPES[u.type].support && Sim.ownSquad(s, s.squads.find(q => q.id === u.squad))).slice(0, 3);
     out.types = tanks.map(u => u.type);
    full(); for (const u of tanks) { u.fuel = 0.05; u.x = tanks[0].x + 20; u.y = tanks[0].y; }
    step(3); out.fuel = feed().slice(0, 1);
    full(); for (const u of tanks) u.fuel = 0.05; const n0 = feed().length; step(30); out.again = feed().length - n0;
    full(); step(3); for (const u of tanks) u.fuel = 0.05; step(25); out.after = feed().slice(0, 1);
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('errors', errs); await b.close();
})();
