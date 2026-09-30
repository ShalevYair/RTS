const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch] of [['desk', { width: 1400, height: 800 }, false], ['phone', { width: 390, height: 844 }, true], ['phoneL', { width: 844, height: 390 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch }); await ctx.grantPermissions(['clipboard-read','clipboard-write']);
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    // no system share sheet (on Windows Chrome it opens a native dialog that crashes headless): test the clipboard path
    await ctx.addInitScript(() => { delete Navigator.prototype.share; });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(600);
    const goal = await p.textContent('#slotN');
    await p.click('#go'); await p.waitForTimeout(1500);
    const barH = await p.evaluate(() => document.getElementById('bar').offsetHeight);
    await p.screenshot({ path: `${OUT}/${name}-bar.png` });
    // force a win on the next step
    await p.evaluate(() => { const o = Sim.step; Sim.step = (s, dt) => { o(s, dt); s.over = 'blue'; }; });
    await p.waitForTimeout(800); await p.waitForFunction(() => { skipOutro(); return !document.getElementById('end').hidden; }, null, { timeout: 10000 }); // (the finale skipped)
    const end = await p.evaluate(() => ({ hidden: document.getElementById('end').hidden, t: document.getElementById('endT').textContent, info: document.querySelector('.stats').textContent }));
    await p.screenshot({ path: `${OUT}/${name}-end.png` });
    if (!touch) { await p.click('#share'); await p.waitForTimeout(200); }
    const share = await p.textContent('#share');
    await p.evaluate(() => { delete Sim.step; }).catch(()=>{});
    console.log(name, 'slots', goal, 'barH', barH, JSON.stringify(end), 'share:', share, 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
