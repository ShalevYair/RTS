const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch, scheme] of [['desk', { width: 1400, height: 800 }, false, 'light'], ['dark', { width: 1400, height: 800 }, false, 'dark'], ['phone', { width: 390, height: 844 }, true, 'light']]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: scheme });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const fogBtn = await p.getAttribute('[data-fog="1"]', 'aria-pressed');
    await p.screenshot({ path: `${OUT}/${name}-intro3.png` });
    await p.click('#go'); await p.click('#gear'); await p.click('[data-rate="2"]'); await p.click('#gear');
    await p.click('#all');
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
    await p.waitForTimeout(+process.env.WAIT||12000);
    await p.screenshot({ path: `${OUT}/${name}-fog.png` });
    console.log(name, 'fog default pressed', fogBtn, 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
