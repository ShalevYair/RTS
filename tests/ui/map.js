// Stage 5 UI: the big map — camera (drag, wheel, keys), a tap still gives an order, the minimap, the small map option
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let bad = false;
  const check = (name, c, m) => { if (!c) bad = true; console.log(name, c ? 'ok  ' : 'FAIL', m); };
  for (const [name, vp, touch, scheme] of [['desk', { width: 1400, height: 800 }, false, 'light'], ['phone', { width: 390, height: 844 }, true, 'dark']]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: scheme });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const pressed = await p.getAttribute('[data-map="big"]', 'aria-pressed');
    await p.click('#go'); await p.waitForTimeout(400);
    const st = () => p.evaluate(() => ({ W: s.W, H: s.H, hills: s.hills.length, cam: { ...cam }, px: view.css, mini: !document.getElementById('mini').hidden, orders: s.outbox.length + s.log.filter(e => /קיבלתי|כל הכוחות/.test(e.msg)).length }));
    const a = await st();
    check(name, pressed === 'true' && a.H === 1280 && a.W >= 2000 && a.hills > 12, `big map by default: ${a.W}×${a.H}, ${a.hills} hills`);
    check(name, Math.abs(a.px - 1) < 0.01 && a.cam.z > 1 && a.mini, `opens zoomed in (1 px per unit, ×${a.cam.z.toFixed(1)}) with the minimap`);
    await p.screenshot({ path: `${OUT}/${name}-big.png` });
    // drag pans (no order), a tap orders
    const box = await p.locator('#cv').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height * 0.45;
    await p.evaluate(() => { setPlaying(false); });
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx - 150, cy - 60, { steps: 6 }); await p.mouse.up();
    const d = await st();
    check(name, d.cam.x > a.cam.x + 50 && d.orders === a.orders, `drag pans the camera (x ${a.cam.x.toFixed(0)} → ${d.cam.x.toFixed(0)}) without giving an order`);
    await p.click('[data-mode="attack"]'); await p.mouse.click(cx, cy); await p.waitForTimeout(100);
    const t = await st();
    check(name, t.orders > d.orders, 'a tap still gives the order');
    if (!touch) {
      await p.mouse.move(cx, cy); await p.mouse.wheel(0, 400); await p.waitForTimeout(100);
      const w = await st(); check(name, w.cam.z < t.cam.z, `wheel zooms out (×${t.cam.z.toFixed(2)} → ×${w.cam.z.toFixed(2)})`);
      await p.keyboard.press('ArrowRight'); const k = await st(); check(name, k.cam.x > w.cam.x || k.cam.x === w.cam.x && w.cam.z === 1, 'arrow keys pan');
    }
    await p.evaluate(() => { cam.z = 99; applyView(); }); // back in (to the zoom limit)
    // minimap: tap its right edge -> the camera goes to the enemy side
    const mb = await p.locator('#mini').boundingBox();
    await p.mouse.click(mb.x + mb.width * 0.95, mb.y + mb.height * 0.5); await p.waitForTimeout(100);
    const m = await st(); check(name, m.cam.x > m.W * 0.6, `minimap tap looks there (x ${m.cam.x.toFixed(0)} of ${m.W})`);
    await p.evaluate(() => { setPlaying(true); }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-big-enemy.png` });
    // the small map is still there, fully on screen, no minimap
    await p.evaluate(() => { setPlaying(false); newGame(); });
    await p.click('[data-map="small"]'); await p.waitForTimeout(300);
    await p.click('#go'); await p.waitForTimeout(400);
    const sm = await st();
    check(name, sm.H === 640 && sm.cam.z === 1 && !sm.mini, `small map: ${sm.W}×${sm.H}, whole map on screen, no minimap`);
    await p.screenshot({ path: `${OUT}/${name}-small.png` });
    await p.evaluate(() => { try { localStorage.removeItem('irts-map'); } catch (e) { /* ignore */ } });
    check(name, !errs.length, 'no errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
