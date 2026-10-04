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
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-mic', 'no'); } catch (e) { /* no storage */ } }); // (no "allow the microphone" window holding the game: micGate)
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fixedhq', '1'); } catch (e) { /* ignore */ } });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts|\[irts\] slow/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    const shown = sel => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
    const level = n => p.evaluate(n => { rate = 1; lvl = n; newGame(true); showIntro(false); setPlaying(false); }, n);
    const run = sec => p.evaluate(sec => { for (let i = 0; i < 30 * sec && !s.over; i++) Sim.step(s, 1 / 30); updateHud(); }, sec);
    // the bar: words for the orders, no posture, a manifest for installing
    const bar = await p.evaluate(() => ({ ord: [...document.querySelectorAll('#ordMode')].map(e => e.getAttribute('aria-label')).join(' '), trait: !!document.querySelector('[data-trait]'),
      manifest: !!document.querySelector('link[rel=manifest]') }));
    check(name, bar.ord === 'לתקוף' && !bar.trait && bar.manifest, `orders "${bar.ord}", no posture buttons, installable ${JSON.stringify(bar)}`);
    // level 6: medics and mechanics in the build menu, new ones pulsing
    await level(6); await p.click('[data-cat="tents"]'); await p.waitForTimeout(150);
    const menu6 = await p.evaluate(() => [...document.querySelectorAll('[data-build]')].filter(e => !e.hidden).map(e => e.dataset.build + (e.classList.contains('new') ? '*' : '')).join());
    check(name, menu6 === 'tent,clinic*,tankshop,jeepshop,garage*,depot*', `level 6 builds: ${menu6}`);
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
      return { care: !!inf.care, med: !!med, btn: [...document.querySelectorAll('[data-ty]')].length };
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
    // (a level opens zoomed in on our squads — TUT_PX — so the spot is brought on screen first)
    await p.click('#eye'); const hq = await p.evaluate(() => { const h = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue'), c = cv.getBoundingClientRect(); cam.x = h.x + 500; cam.y = h.y; applyView(); return { x: c.left + view.cox + (h.x + 500) * view.css, y: c.top + view.coy + h.y * view.css }; });
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
    // our squad out of the exact picture doesn't vanish: faint units where it probably is, and its badge
    const ghost = await p.evaluate(() => { const q = s.squads.find(x => x.side === 'blue' && !x.dead); for (const u of s.units) if (u.squad === q.id) { u.x = s.W - 300; u.y = 60; } q.cx = s.W - 300; q.cy = 60; Sim.step(s, 1); draw(); const g = guessAt(q); return { shown: sqShown(q), g: !!g && Number.isFinite(g.x) }; });
    check(name, !ghost.shown && ghost.g, `our squad out of the full-control ring shows where it probably is ${JSON.stringify(ghost)}`);
    // level 11: the quota is full; pressing 🏗 blinks the counter and 🏕; 🏕 with no jeep/tank picked blinks the squads that can
    await level(11); await p.waitForTimeout(250);
    await p.click('[data-cat="tents"]', { force: true }); await p.waitForTimeout(100);
    const h1 = await p.evaluate(() => ({ slots: document.querySelector('[data-cat="tents"]').classList.contains('blink'), fhq: document.getElementById('fhq').classList.contains('blink'), newFhq: document.getElementById('fhq').classList.contains('new'), n: document.getElementById('slotN').textContent }));
    check(name, h1.slots && h1.fhq && h1.newFhq && h1.n === '4/4', `level 11: full quota ${h1.n}; 🏗 blinks the counter and 🏕 (which pulses as new) ${JSON.stringify(h1)}`);
    // 🏕, then a spot on the map: the nearest jeep squad drives there and sets it up; building opens around it
    await p.evaluate(() => select('all'));
    await p.click('#fhq', { force: true }); await p.waitForTimeout(100);
    const armed = await p.evaluate(() => fhqArmed);
    const spot = await p.evaluate(() => { const h = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue'); let P = { x: h.x + 520, y: h.y - 150 }; if (Sim.lakeAt(s, P, 40)) P.y += 300; lookAt(P.x, P.y); const c = cv.getBoundingClientRect(); return { P, x: c.left + view.cox + P.x * view.css, y: c.top + view.coy + P.y * view.css }; });
    await p.mouse.move(spot.x, spot.y); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/${name}-st-lv11-place.png` });
    await p.mouse.click(spot.x, spot.y); await p.waitForTimeout(100);
    const trip = await p.evaluate(() => { const q = s.squads.find(k => k.fhqAt); return q ? q.type : null; });
    await run(90); await p.waitForTimeout(200);
    const built = await p.evaluate(P => { const f = s.nodes.find(n => n.kind === 'fhq' && n.side === 'blue'); return f ? { d: Math.round(Math.hypot(f.x - P.x, f.y - P.y)), build: [0, 1, 2, 3, 4, 5, 6, 7].map(i => Sim.buildCheck(s, 'blue', f.x + Math.cos(i * 0.8) * 110, f.y + Math.sin(i * 0.8) * 110)).includes('') ? '' : 'none' } : null; }, spot.P);
    check(name, armed && trip && built && built.d < 45 && built.build === '', `🏕 then a spot: the ${trip} squad drove there and set it up (${JSON.stringify(built)}), and building is allowed around it`);
    await p.screenshot({ path: `${OUT}/${name}-st-lv11.png` });
    // ★ all squads + a tap: rows toward the enemy — tanks in front, then jeeps, infantry, AA, medics and mechanics
    await p.evaluate(() => {
      lvl = 0; fog = false; newGame(true); showIntro(false); s.fog = false; setPlaying(false); s.bots = [];
      const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue');
      for (const t of ['tank', 'aa', 'med', 'mech', 'air']) { const q = Sim._makeSquad(s, 'blue', t, null, hq.x + 100, hq.y); q.size = 4; Sim._fillSquad(s, q, hq.x + 100, hq.y); }
      cam = { x: hq.x + 400, y: hq.y, z: 1.6 }; applyView(); updateHud(); select('all'); mode = 'hold'; syncButtons();
    });
    const tapAt = await p.evaluate(() => { const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue'), c = cv.getBoundingClientRect(); let P = { x: hq.x + 420, y: hq.y }; if (Sim.lakeAt(s, P, 120)) P.y -= 200; while (hitSquad(P.x, P.y) && P.x < s.W - 100) P.x += 40; /* (a tap on a squad would pick it) */ return { x: c.left + view.cox + P.x * view.css, y: c.top + view.coy + P.y * view.css }; });
    await p.mouse.click(tapAt.x, tapAt.y); await run(45); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => { const x = t => { const q = s.squads.find(k => k.side === 'blue' && k.type === t); return Math.round(q.order.x); }; return { tank: x('tank'), jeep: x('jeep'), inf: x('inf'), aa: x('aa'), med: x('med') }; });
    check(name, rows.tank > rows.jeep && rows.jeep > rows.inf && rows.inf > rows.aa && rows.aa > rows.med, `★ + tap: rows toward the enemy ${JSON.stringify(rows)}`);
    await p.screenshot({ path: `${OUT}/${name}-st-formation.png` });
    // left press, held a moment, then dragged: the same order with a facing — the front turns to where the arrow points
    // (south here); a right-drag only pans
    if (!touch) {
      const P = await p.evaluate(() => { const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue'), c = cv.getBoundingClientRect(); let W = { x: hq.x + 300, y: hq.y - 60 }; if (Sim.lakeAt(s, W, 140)) W.y += 200; return { x: c.left + view.cox + W.x * view.css, y: c.top + view.coy + W.y * view.css }; });
      const before = await p.evaluate(() => ({ cam: cam.x, n: s.outbox.length }));
      await p.mouse.move(P.x, P.y); await p.mouse.down({ button: 'right' }); await p.mouse.move(P.x - 60, P.y, { steps: 6 }); await p.mouse.up({ button: 'right' });
      const panned = await p.evaluate(() => ({ cam: cam.x, n: s.outbox.length }));
      check(name, panned.cam > before.cam + 10 && panned.n === before.n, `right-drag pans, no order ${JSON.stringify({ before, panned })}`);
      await p.mouse.move(P.x + 60, P.y); await p.mouse.down({ button: 'right' }); await p.mouse.move(P.x, P.y, { steps: 6 }); await p.mouse.up({ button: 'right' }); // (back)
      await p.mouse.move(P.x, P.y); await p.mouse.down(); await p.waitForTimeout(400); await p.mouse.move(P.x + 5, P.y + 90, { steps: 6 });
      await p.screenshot({ path: `${OUT}/${name}-st-face-drag.png` });
      await p.mouse.up(); await run(8);
      const f = await p.evaluate(() => { const y = t => Math.round(s.squads.find(k => k.side === 'blue' && k.type === t).order.y); return { tank: y('tank'), inf: y('inf'), med: y('med') }; });
      check(name, f.tank > f.inf && f.inf > f.med, `held left-drag south: the front faces south ${JSON.stringify(f)}`);
    }
    // a fight up close: the fallen stay a while, vehicles leave tracks
    // (a tank sent on, so something is surely driving — and on screen)
    const fx = await p.evaluate(() => { const u = s.units.find(x => x.side === 'blue' && x.type === 'inf'); u.hp = 0;
      const tk = s.squads.find(q => q.side === 'blue' && q.type === 'tank'); Sim.order(s, tk.id, 'hold', tk.cx + 150, tk.cy, true); cam.x = tk.cx + 75; cam.y = tk.cy; applyView(); draw();
      for (let i = 0; i < 60; i++) { Sim.step(s, 1 / 30); if (i % 3 === 0) draw(); } return { fallen: s.fallen.length, tracks: tracks.length }; });
    check(name, fx.fallen >= 1 && fx.tracks > 0, `the fallen lie there a while, vehicles leave tracks ${JSON.stringify(fx)}`);
    // full screen is in the settings (Chrome has the API; not shown when installed)
    await p.evaluate(() => openMenu()); check(name, await shown('#fs'), 'a full screen switch ⛶ in the settings'); await p.evaluate(() => closeMenu(false));
    check(name, !errs.length, `no errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  {
    // a phone held upright: the type buttons at the top fit (wrapping under the power bar), the corner holds the settings
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-mic', 'no'); } catch (e) { /* no storage */ } }); // (no "allow the microphone" window holding the game: micGate)
    await ctx.addInitScript(() => { try { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fixedhq', '1'); } catch (e) { /* ignore */ } });
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(400); await p.click('#go'); await p.waitForTimeout(300);
    const lay = await p.evaluate(() => { const r = e => document.getElementById(e).getBoundingClientRect(); return { types: document.querySelectorAll('[data-ty]').length, fits: r('gSq').right <= innerWidth && r('gSq').left >= 0, gear: innerWidth - r('gear').right < 20 && innerHeight - r('gear').bottom < 20, overlap: r('bar').right > r('corner').left && r('bar').bottom > r('corner').top }; });
    await p.screenshot({ path: `${OUT}/portrait-squads.png` });
    check('portrait', lay.types === 2 && lay.fits && lay.gear && !lay.overlap, `upright phone: ${JSON.stringify(lay)}`);
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
