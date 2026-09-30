// Control groups, as in other RTS games: Ctrl + a number makes what's picked that group; the number picks it; pressed
// again it brings the camera to the middle of its squads
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
let bad = false; const check = (name, c, m) => { console.log(name, c ? 'ok  ' : 'FAIL', m); if (!c) bad = true; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1400, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fixedhq', '1'); } catch (e) { /* no storage */ } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(500); await p.click('#go'); await p.waitForTimeout(300);
  const name = 'desk';
  const ids = await p.evaluate(() => { setPlaying(false); const l = s.squads.filter(q => q.side === 'blue' && !q.dead).map(q => q.id); select(l.slice(0, 2)); return l; });
  await p.keyboard.press('Control+Digit3'); await p.waitForTimeout(100);
  const g = await p.evaluate(() => ({ n: groups.length, key: groups[0] && groups[0].key, ids: groups[0] && groups[0].ids.length, kbd: !!document.querySelector('[data-gr] kbd[data-k="3"]') }));
  check(name, g.n === 1 && g.key === 3 && g.ids === 2 && g.kbd, `Ctrl+3: the two picked are group 3 ${JSON.stringify(g)}`);
  await p.evaluate(() => select(null));
  await p.keyboard.press('Digit3'); await p.waitForTimeout(100);
  const picked = await p.evaluate(() => Array.isArray(sel) ? sel.length : sel);
  check(name, picked === 2, `3 picks the group (${picked})`);
  const cam0 = await p.evaluate(() => { cam.z = 3; cam.x = s.W; cam.y = 0; applyView(); return { x: cam.x, y: cam.y }; });
  await p.keyboard.press('Digit3'); await p.waitForTimeout(100);
  const cam1 = await p.evaluate(() => { const ps = groups[0].ids.map(id => pos(s.squads.find(q => q.id === id))); const mx = ps.reduce((a, q) => a + q.x, 0) / ps.length; return { x: cam.x, mx }; });
  check(name, Math.abs(cam1.x - cam0.x) > 20, `3 again: the camera goes to the group (x ${Math.round(cam0.x)} → ${Math.round(cam1.x)}, middle ${Math.round(cam1.mx)})`);
  // a single squad can be a group too (it leaves group 3, which keeps the other); the type buttons number around them
  await p.evaluate(ids => { const q = Sim._makeSquad(s, 'blue', 'tank', null, 200, 200); q.size = 2; Sim._fillSquad(s, q, 200, 200); Sim.step(s, 1 / 30); select(ids[0]); }, ids);
  await p.keyboard.press('Control+Digit1'); await p.waitForTimeout(100);
  const g2 = await p.evaluate(() => { renderSquadButtons(); return { n: groups.length, keys: groups.map(x => x.key + ':' + x.ids.length).join(), types: [...document.querySelectorAll('[data-ty] kbd')].map(k => k.dataset.k).join() }; });
  check(name, g2.n === 2 && g2.keys === '1:1,3:1' && g2.types === '2', `Ctrl+1 on one squad: groups ${g2.keys}, the other type is number ${g2.types}`);
  check(name, !errs.length, `no errors ${JSON.stringify(errs)}`);
  await b.close();
  if (bad) process.exitCode = 1;
})();
