// The minimap's heat (where the fighting of the last minute was) and a commander's report when picked, in 3D.
// node tests/ui/heat3d.js → tests/ui/out/3d/heat_{mini,hover}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error') { errs++; console.log('CON', m.text().slice(0, 300)); } });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
    while (s.t < 900) Sim.step(s, 1 / 30);
    // (the shots of the last minute, as the frame loop would have heard them)
    while (s.t < 960) { Sim.step(s, 1 / 30); for (const sh of s.shots) if (!sh.heat) { sh.heat = 1; heatShot(sh); } }
    s.bots = ['red'];
    if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
    const n = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); cam.x = n.x + 300; cam.y = n.y; cam.z = zoomMax() * 0.3; applyView();
  });
  await p.waitForTimeout(1500);
  const out = k => path.join(__dirname, 'out', '3d', `heat_${k}.png`);
  console.log('heat', await p.evaluate(() => { let us = 0, them = 0; for (const h of heat.values()) { us += h.us; them += h.them; } return JSON.stringify({ cells: heat.size, us: Math.round(us), them: Math.round(them) }); }));
  const mr = await p.evaluate(() => { const r = $('mini').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await p.screenshot({ path: out('mini'), clip: { x: mr[0] - 10, y: mr[1] - 10, width: mr[2] + 20, height: mr[3] + 20 } });
  await p.mouse.move(mr[0] + mr[2] / 2, mr[1] + mr[3] / 2); await p.waitForTimeout(1500);
  const mr2 = await p.evaluate(() => { const r = $('mini').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await p.screenshot({ path: out('hover'), clip: { x: mr2[0] - 10, y: mr2[1] - 10, width: mr2[2] + 20, height: mr2[3] + 20 } });
  // (a report: tanks with no fuel, picked)
  console.log('report', await p.evaluate(() => {
    const qs = s.squads.filter(q => q.side === 'blue' && q.type === 'tank' && !q.dead && Sim.ownSquad(s, q)).slice(0, 3);
    for (const q of qs.slice(0, 2)) for (const u of s.units) if (u.squad === q.id) u.fuel = 0.05;
    const r1 = pickReport(qs.map(q => q.id)), one = pickReport([qs[0].id]);
    const inf = s.squads.find(q => q.side === 'blue' && q.type === 'inf' && !q.dead && Sim.ownSquad(s, q)); for (const u of s.units) if (u.squad === inf.id) u.hp *= 0.4;
    const r2 = pickReport([inf.id]);
    sayPicked([qs[0].id]);
    return JSON.stringify({ tanks: r1 && r1.text, one: one && one.text, inf: r2 && r2.text, feed: [...document.querySelectorAll('#feed > *')].map(e => e.textContent).slice(0, 3) });
  }));
  console.log('errors', errs); await b.close();
})();
