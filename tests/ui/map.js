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
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-mic', 'no'); } catch (e) { /* no storage */ } }); // (no "allow the microphone" window holding the game: micGate)
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fixedhq', '1'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts|\[irts\] slow/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    const pressed = await p.getAttribute('[data-map="big"]', 'aria-pressed');
    await p.click('#go'); await p.waitForTimeout(400);
    const st = () => p.evaluate(() => ({ W: s.W, H: s.H, hills: s.hills.length, cam: { ...cam }, px: view.css, mini: !document.getElementById('mini').hidden, orders: s.outbox.length + s.log.filter(e => /קיבלתי|כל הכוחות/.test(e.msg)).length }));
    const a = await st();
    check(name, pressed === 'true' && a.H === 1280 && a.W >= 2000 && a.hills > 12, `big map by default: ${a.W}×${a.H}, ${a.hills} hills`);
    check(name, Math.abs(a.px - 1.5) < 0.01 && a.cam.z > 1 && a.mini, `opens zoomed in (1.5 px per unit — WORLD_K, ×${a.cam.z.toFixed(1)}) with the minimap`);
    await p.screenshot({ path: `${OUT}/${name}-big.png` });
    // middle-drag pans (no order), a tap orders
    const box = await p.locator('#cv').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height * 0.45;
    await p.evaluate(() => { setPlaying(false); });
    const a0 = await st(); // (counted once paused: the opening's messages are still being delivered until then)
    await p.mouse.move(cx, cy); await p.mouse.down({ button: 'middle' }); await p.mouse.move(cx - 150, cy - 60, { steps: 6 }); await p.mouse.up({ button: 'middle' });
    const d = await st();
    check(name, d.cam.x > a0.cam.x + 50 && d.orders === a0.orders, `middle-drag pans the camera (x ${a0.cam.x.toFixed(0)} → ${d.cam.x.toFixed(0)}) without giving an order`);
    await p.mouse.click(cx, cy); await p.waitForTimeout(100);
    const t = await st();
    check(name, t.orders > d.orders, 'a tap still gives the order');
    if (!touch) {
      await p.mouse.move(cx, cy); await p.mouse.wheel(0, 400); await p.waitForTimeout(100);
      const w = await st(); check(name, w.cam.z < t.cam.z, `wheel zooms out (×${t.cam.z.toFixed(2)} → ×${w.cam.z.toFixed(2)})`);
      await p.keyboard.press('ArrowRight'); const k = await st(); check(name, k.cam.x > w.cam.x || k.cam.x === w.cam.x && w.cam.z === 1, 'arrow keys pan');
      // a rectangle drawn round both our squads picks them both
      await p.evaluate(() => { cam.z = 1; applyView(); }); // the whole map: both squads on screen
      const rect = await p.evaluate(() => { const r = cv.getBoundingClientRect(), pts = blueSquads().map(q => pos(q)); const X = v => r.left + view.cox + v * view.css, Y = v => r.top + view.coy + v * view.css;
        return { x0: Math.min(...pts.map(q => X(q.x))) - 30, y0: Math.min(...pts.map(q => Y(q.y - 26))) - 30, x1: Math.max(...pts.map(q => X(q.x))) + 30, y1: Math.max(...pts.map(q => Y(q.y))) + 30 }; });
      await p.mouse.move(rect.x0, rect.y0); await p.mouse.down(); await p.mouse.move(rect.x1, rect.y1, { steps: 8 });
      const drawn = await p.evaluate(() => !!boxSel); await p.mouse.up();
      const picked = await p.evaluate(() => ({ all: blueSquads().length, sel: Array.isArray(sel) ? sel.length : sel, pressed: [...document.querySelectorAll('[data-ty][aria-pressed="true"]')].length, orders: s.outbox.length }));
      check(name, drawn && picked.sel === picked.all && picked.pressed === 2, `a rectangle picks all our squads (each unit its own) (${JSON.stringify(picked)})`);
      // the mouse at the right edge slides the view right
      await p.evaluate(() => { cam.z = 99; lookAt(300, s.H / 2); });
      const e0 = await st(); await p.mouse.move(vp.width - 2, vp.height / 2); await p.waitForTimeout(400); await p.mouse.move(vp.width / 2, vp.height / 2);
      const e1 = await st(); check(name, e1.cam.x > e0.cam.x + 50, `the mouse at the screen's edge moves the map (x ${e0.cam.x.toFixed(0)} → ${e1.cam.x.toFixed(0)})`);
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
    // the huge map: 4× the big one; it still runs smoothly (frames counted over 2 s of play)
    await p.evaluate(() => { setPlaying(false); newGame(); });
    await p.click('[data-map="huge"]'); await p.waitForTimeout(300);
    const t0 = await p.evaluate(() => performance.now()); await p.click('#go'); await p.waitForTimeout(400);
    const hg = await p.evaluate(async () => { let n = 0; const t = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return { W: s.W, H: s.H, fps: Math.round(n / 2), mini: !document.getElementById('mini').hidden, pressed: document.querySelector('[data-map="huge"]').getAttribute('aria-pressed') }; });
    check(name, hg.W >= 4000 && hg.H === 2560 && hg.mini && hg.fps >= 25, `huge map: ${hg.W}×${hg.H}, ${hg.fps} fps, minimap`);
    await p.screenshot({ path: `${OUT}/${name}-huge.png` });
    await p.evaluate(() => { try { localStorage.removeItem('irts-map'); } catch (e) { /* ignore */ } });
    check(name, !errs.length, 'no errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
