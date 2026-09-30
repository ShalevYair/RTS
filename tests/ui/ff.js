// Stage 4 UI: a friendly-fire incident shows ⚠ on the map, lands in the log, and is counted in the replay/end screen
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let bad = false;
  for (const [name, vp, touch, scheme] of [['desk', { width: 1400, height: 800 }, false, 'light'], ['phone', { width: 390, height: 844 }, true, 'dark']]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: scheme });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); } catch (e) { /* no storage */ } }); // the full game, not the tutorial
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(500);
    await p.click('#go'); await p.waitForTimeout(300);
    // stage a fight far from HQ: blue infantry shoots a red jeep with the blue jeeps right beside it, red can't shoot;
    // friendlyFire is forced to fire once so the test doesn't hang on the dice
    await p.evaluate(() => {
      const o = Sim.step, ff = Sim.friendlyFire; let forced = false;
      Sim.step = (s, dt) => {
        s.bots = [];
        const place = (id, x, y) => { for (const k of s.units) if (k.squad === id) { k.x = x + k.sx * 12; k.y = y + k.sy * 12; } };
        const red = s.squads.find(q => q.side === 'red' && q.type === 'jeep').id, x = s.W * 0.75;
        place('blue0', x - 40, 320); place('blue1', x + 5, 355); place(red, x, 310);
        for (const k of s.units) if (k.side === 'red') { k.hp = Sim.TYPES[k.type].hp; k.cd = 99; }
        if (!forced) { const r = s.rand; s.rand = () => 0; const f = s.squads[0]; const u = s.units.find(k => k.squad === f.id), t = s.units.find(k => k.squad === red);
          f.cx = x; forced = !!ff(s, u, f, t); s.rand = r; }
        o(s, dt);
      };
    });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${name}-ff.png` });
    const st = await p.evaluate(() => ({ marks: s.marks.filter(k => k.kind === 'ff').length, log: s.log.some(e => /ירי על כוחותינו/.test(e.msg)), n: s.log2.ff }));
    await p.evaluate(() => { const o = Sim.step; Sim.step = (s, dt) => { o(s, dt); if (s.t > 7) s.over = 'red'; }; });
    await p.waitForTimeout(8000); await p.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 10000 }); // (after the finale)
    const end = await p.evaluate(() => ({ box: !document.getElementById('replayBox').hidden, stats: document.getElementById('endStats').textContent }));
    await p.screenshot({ path: `${OUT}/${name}-ff-end.png` });
    const good = st.marks > 0 && st.log && st.n > 0 && end.box && /ירי על כוחותינו: [1-9]/.test(end.stats) && !errs.length;
    if (!good) bad = true;
    console.log(name, good ? 'ok' : 'FAIL', JSON.stringify({ ...st, ...end }), 'errors', errs);
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
