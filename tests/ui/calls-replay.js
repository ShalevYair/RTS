const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch] of [['desk', { width: 1400, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    await p.click('#go'); await p.click('#gear'); await p.click('[data-rate="2"]'); await p.click('#gear');
    await p.click('#all');
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${name}-mail.png` });
    // inject a call through the real sim state
    await p.evaluate(() => { const o = Sim.step; let done = false; Sim.step = (s, dt) => { if (!done) { done = true; s.askHq = true; s.calls.push({ id: 999, sq: 'blue1', t: s.t, until: s.t + 10 }); } o(s, dt); }; });
    await p.waitForTimeout(600);
    const callVisible = await p.isVisible('#call'); const callTxt = await p.textContent('#callTxt');
    await p.screenshot({ path: `${OUT}/${name}-call.png` });
    await p.click('#callHold'); await p.waitForTimeout(400);
    const callGone = await p.isHidden('#call');
    await p.waitForTimeout(12000);
    await p.evaluate(() => { const o = Sim.step; Sim.step = (s, dt) => { o(s, dt); s.over = 'blue'; }; });
    await p.waitForTimeout(1500); await p.waitForFunction(() => { skipOutro(); return !document.getElementById('end').hidden; }, null, { timeout: 10000 }); // (the finale skipped)
    const rep = await p.evaluate(() => ({ box: !document.getElementById('replayBox').hidden, max: document.getElementById('scrub').max, stats: document.getElementById('endStats').textContent }));
    await p.screenshot({ path: `${OUT}/${name}-replay.png` });
    console.log(name, JSON.stringify({ callVisible, callTxt, callGone, ...rep }), 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
