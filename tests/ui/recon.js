// Stage 3 on screen: enemy blobs at the three identification levels, and "roger" (asked vs understood)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [name, vp, touch, scheme] of [['desk', { width: 1400, height: 800 }, false, 'light'], ['dark', { width: 1400, height: 800 }, false, 'dark'], ['phone', { width: 390, height: 844 }, true, 'light']]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: scheme });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    await p.click('#go'); await p.waitForTimeout(300);
    // pause, then plant three sightings and send the jeeps far away so the order lands "roughly"
    const res = await p.evaluate(() => {
      setPlaying(false);
      const reds = s.squads.filter(q => q.side === 'red'), W = s.W;
      const j = s.squads.find(q => q.side === 'blue' && q.type === 'jeep');
      for (const u of s.units) if (u.squad === j.id) { u.x = W * 0.7; u.y = 150 + u.sy * 10; }
      j.order = { type: 'hold', x: W * 0.7, y: 150, r: 60 }; // stay out there while the order travels
      Sim.step(s, 1 / 30);
      Sim.order(s, j.id, 'attack', W * 0.6, 200);
      for (let i = 0; i < 30 * 9 && s.outbox.length; i++) Sim.step(s, 1 / 30);
      s.squads.push({ ...reds[0], id: 'ghost', dead: true }); // a squad id for the planted "movement" blob
      s.mem.blue[reds[0].id] = { x: W * 0.3, y: 200, lvl: 2, t: s.t, type: reds[0].type, air: false, n: 5, strength: 1 };
      s.mem.blue[reds[1].id] = { x: W * 0.55, y: 320, lvl: 1, t: s.t, type: null, air: false, n: null, strength: null };
      s.mem.blue.ghost = { x: W * 0.75, y: 450, lvl: 0, t: s.t, type: null, air: null, n: null, strength: null };
      const o = j.order; return { want: o.want, x: Math.round(o.x), y: Math.round(o.y) };
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${name}-recon.png` });
    await p.evaluate(() => setPlaying(true)); await p.waitForTimeout(4000); // running on with the planted state must not throw
    const stats = await p.evaluate(() => s.log2.offN);
    console.log(name, 'order asked', JSON.stringify(res.want), 'understood', res.x, res.y, 'counted', stats, 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
