// The fog in steps, medics and mechanics, drones in hand, control rings, the forward-HQ hint, full screen:
// level 6 offers 🏥 🛠 and hurt units go to them; level 8's fog comes down during the level (no drones, orders at once);
// level 9 has drones (a count in hand); level 10 shows the control rings and draws units as they are near HQ;
// level 11 starts with a full quota and points at 🏕; the orders read להחזיק / לתקוף / לסגת; no posture buttons
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let bad = false;
  const check = (name, c, m) => { if (!c) bad = true; console.log(name, c ? 'ok  ' : 'FAIL', m); };
  for (const [name, vp, touch, scheme] of [['desk', { width: 1400, height: 800 }, false, 'light'], ['phone', { width: 844, height: 390 }, true, 'dark']]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: scheme });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); } catch (e) { /* ignore */ } });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    const shown = sel => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
    const level = n => p.evaluate(n => { rate = 1; lvl = n; newGame(true); showIntro(false); setPlaying(false); }, n);
    const run = sec => p.evaluate(sec => { for (let i = 0; i < 30 * sec && !s.over; i++) Sim.step(s, 1 / 30); updateHud(); }, sec);
    // the bar: words for the orders, no posture, a manifest for installing
    const bar = await p.evaluate(() => ({ ord: [...document.querySelectorAll('#gOrd .lg')].map(e => e.textContent).join(' '), trait: !!document.querySelector('[data-trait]'),
      manifest: !!document.querySelector('link[rel=manifest]') }));
    check(name, bar.ord === 'להחזיק לתקוף לסגת' && !bar.trait && bar.manifest, `orders "${bar.ord}", no posture buttons, installable ${JSON.stringify(bar)}`);
    // level 6: medics and mechanics in the build menu, new ones pulsing
    await level(6); await p.click('#bld'); await p.waitForTimeout(150);
    const menu6 = await p.evaluate(() => [...document.querySelectorAll('[data-build]')].filter(e => !e.hidden).map(e => e.dataset.build + (e.classList.contains('new') ? '*' : '')).join());
    check(name, menu6 === 'tent,jeepshop,tankshop,clinic*,garage*', `level 6 builds: ${menu6}`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv6-menu.png` });
    // build a clinic, raise its medics, hurt an infantryman: he walks to them with a cross over him
    const cared = await p.evaluate(() => {
      buildArmed = null; document.getElementById('buildm').hidden = true;
      const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue');
      Sim.build(s, 'blue', 'clinic', hq.x + 120, hq.y + 60);
      for (let i = 0; i < 30 * 50; i++) Sim.step(s, 1 / 30);
      const inf = s.units.find(u => u.side === 'blue' && u.type === 'inf'); inf.hp = 12; Sim.step(s, 1 / 30);
      const med = s.units.find(u => u.type === 'med' && u.side === 'blue');
      Sim.step(s, 0.5); cam = { x: (inf.x + med.x) / 2, y: (inf.y + med.y) / 2, z: zoomMax() }; applyView(); updateHud();
      return { care: !!inf.care, med: !!med, btn: [...document.querySelectorAll('[data-sq]')].length };
    });
    await p.waitForTimeout(200);
    check(name, cared.care && cared.med, `a hurt infantryman goes for the medics ${JSON.stringify(cared)}`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv6-care.png` });
    // level 8: no fog at first, then it comes down; no drone button, no control rings, orders go at once
    await level(8);
    const f0 = await p.evaluate(() => s.fog); await run(22); await p.waitForTimeout(300);
    const f1 = await p.evaluate(() => ({ fog: s.fog, friction: Sim.friction(s), eye: !document.getElementById('eye').hidden }));
    check(name, !f0 && f1.fog && !f1.friction && !f1.eye, `level 8: the fog comes down during the level, no drones, no friction ${JSON.stringify(f1)}`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv8-fog.png` });
    // level 9: a drone in hand; using it leaves none, the count shows
    await level(9); await p.waitForTimeout(200);
    const e0 = await p.evaluate(() => document.getElementById('eyeN').textContent);
    await p.click('#eye'); const hq = await p.evaluate(() => { const h = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue'), c = cv.getBoundingClientRect(); return { x: c.left + view.cox + (h.x + 500) * view.css, y: c.top + view.coy + h.y * view.css }; });
    await p.mouse.click(hq.x, hq.y); await run(8); await p.waitForTimeout(250);
    const e1 = await p.evaluate(() => ({ n: document.getElementById('eyeN').textContent, up: Sim.dronesUp(s, 'blue'), dis: document.getElementById('eye').disabled }));
    check(name, e0 === '1' && e1.up === 1 && e1.n === '' && e1.dis, `level 9: one drone in hand ("${e0}"), sent up, none left ${JSON.stringify(e1)}`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv9-drone.png` });
    // level 10: friction, the control rings; our units drawn as they are near HQ (live), a report picture far off
    await level(10); await run(5); await p.waitForTimeout(250);
    const r10 = await p.evaluate(() => {
      const q = s.squads.find(x => x.side === 'blue' && !x.dead), r = s.rep[q.id];
      return { friction: Sim.friction(s), rings: qual.key !== '', live: Math.abs(r.t - s.t) < 0.05 };
    });
    check(name, r10.friction && r10.rings && r10.live, `level 10: command friction, control rings drawn, near HQ the picture is live ${JSON.stringify(r10)}`);
    await p.evaluate(() => { cam.z = 1; applyView(); });
    await p.screenshot({ path: `${OUT}/${name}-st-lv10-rings.png` });
    // level 11: the quota is full; pressing 🏗 blinks the counter and 🏕; 🏕 with no jeep/tank picked blinks the squads that can
    await level(11); await p.waitForTimeout(250);
    await p.click('#bld', { force: true }); await p.waitForTimeout(100);
    const h1 = await p.evaluate(() => ({ slots: document.getElementById('slots').classList.contains('blink'), fhq: document.getElementById('fhq').classList.contains('blink'), newFhq: document.getElementById('fhq').classList.contains('new'), n: document.getElementById('slotN').textContent }));
    check(name, h1.slots && h1.fhq && h1.newFhq && h1.n === '4/4', `level 11: full quota ${h1.n}; 🏗 blinks the counter and 🏕 (which pulses as new) ${JSON.stringify(h1)}`);
    await p.evaluate(() => select('all'));
    await p.click('#fhq', { force: true }); await p.waitForTimeout(100);
    const h2 = await p.evaluate(() => [...document.querySelectorAll('[data-sq]')].filter(e => e.classList.contains('blink')).map(e => s.squads.find(q => q.id === e.dataset.sq).type).join());
    check(name, h2.length && h2.split(',').every(t => t === 'jeep' || t === 'tank'), `🏕 with no jeep / tank picked blinks the ones that can: ${h2}`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv11.png` });
    // the full screen button (Chrome has the API; not shown when already full screen / installed)
    check(name, await shown('#fs'), 'a full screen button ⛶');
    check(name, !errs.length, `no errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
