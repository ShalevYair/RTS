const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch] of [['desk', { width: 1400, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    await p.click('#go'); await p.click('#gear'); await p.click('[data-rate="2"]');
    const note = await p.textContent('#radioNote'); await p.click('#gear');
    await p.click('[data-mode="attack"]'); await p.click('#all');
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
    await p.waitForTimeout(9000);
    const before = await p.textContent('#eyeN');
    if (touch) await p.click('#eye'); else await p.keyboard.press('KeyD');
    const armed = await p.getAttribute('#eye', 'aria-pressed');
    await p.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.5);
    await p.waitForTimeout(1500);
    const after = await p.evaluate(() => document.getElementById('eyeN').textContent);
    await p.screenshot({ path: `${OUT}/${name}-eye.png` });
    // fog off hides the drone button
    console.log(name, 'charges', JSON.stringify(before), '->', JSON.stringify(after), 'armed', armed, 'radioNote', JSON.stringify(note), 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
