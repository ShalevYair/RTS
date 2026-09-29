const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch] of [['desk', { width: 1400, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/${name}-intro.png` });
    await p.click('[data-diff="hard"]'); await p.click('#go'); await p.waitForTimeout(300);
    if (!touch) { await p.keyboard.press('2'); await p.keyboard.press('KeyE'); }
    else await p.click('[data-ty="inf"]');
    await p.waitForTimeout(4000);
    const st = await p.evaluate(() => ({ intro: document.getElementById('intro').hidden, sel: [...document.querySelectorAll('[data-ty]')].map(b => b.getAttribute('aria-pressed')).join(','), diff: localStorage.getItem('irts-diff'), traits: [...document.querySelectorAll('[data-trait]')].map(b => b.getAttribute('aria-pressed')).join(','), play: playing }));
    console.log(name, JSON.stringify(st), 'errors:', errs);
    await p.screenshot({ path: `${OUT}/${name}-game.png` });
    await p.reload(); await p.waitForTimeout(500);
    console.log(name, 'reload short intro:', await p.evaluate(() => document.getElementById('intro').className), 'diff btn:', await p.getAttribute('[data-diff="hard"]', 'aria-pressed'));
  }
  await b.close();
})();
