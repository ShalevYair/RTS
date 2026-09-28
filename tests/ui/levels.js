// Tutorial UI: a first visit opens on level 1 with no words; each level shows only its controls and the new ones
// pulse; winning opens the next level; the HQ and the drone are pictures
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
    const shown = sel => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
    const intro = await p.evaluate(() => ({
      levels: [...document.querySelectorAll('#levels button')].map(x => (x.disabled ? '-' : '') + x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' '),
      words: document.querySelector('#intro .card').innerText.replace(/\s+/g, ' ').trim() }));
    check(name, /^1\* -2 .* ∞$/.test(intro.levels) && intro.words.length < 60, `first visit: level 1 picked, the rest locked (${intro.levels}); on screen: "${intro.words}"`);
    await p.screenshot({ path: `${OUT}/${name}-lv-intro.png` });
    await p.click('#go'); await p.waitForTimeout(300);
    const bar1 = { sq: await shown('#gSq'), ord: await shown('#gOrd'), bld: await shown('#bld'), eye: await shown('#eye'), log: await shown('#log'), slots: await shown('#slots') };
    check(name, Object.values(bar1).every(v => !v), `level 1: no squad buttons, orders, building, drone, log ${JSON.stringify(bar1)}`);
    await p.screenshot({ path: `${OUT}/${name}-lv1.png` });
    // tap on the enemy squad: ours goes and wins
    const at = await p.evaluate(() => { const r = s.squads.find(q => q.side === 'red'), c = cv.getBoundingClientRect(); return { x: c.left + view.cox + r.cx * view.css, y: c.top + view.coy + r.cy * view.css }; });
    await p.mouse.click(at.x, at.y);
    // play it out (straight through the sim, so the test doesn't hang on the browser's frame rate)
    await p.evaluate(() => { for (let i = 0; i < 30 * 300 && !s.over; i++) Sim.step(s, 1 / 30); });
    await p.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 10000 });
    const end = await p.evaluate(() => ({ t: document.getElementById('endT').textContent, again: document.getElementById('again').textContent, done: localStorage.getItem('irts-done') }));
    check(name, end.t === '🏆' && end.again === '▶' && end.done === '1', `level 1 won by one tap: ${JSON.stringify(end)}`);
    await p.click('#again'); await p.waitForTimeout(300);
    const lv2 = await p.evaluate(() => ({ lvl, sq: !document.getElementById('gSq').hidden, isNew: document.getElementById('gSq').classList.contains('new'), ord: !document.getElementById('gOrd').hidden }));
    check(name, lv2.lvl === 2 && lv2.sq && lv2.isNew && !lv2.ord, `▶ goes on to level 2: squad buttons appear and pulse ${JSON.stringify(lv2)}`);
    await p.screenshot({ path: `${OUT}/${name}-lv2.png` });
    // level 3: our HQ, drawn as a compound (no base strip)
    await p.evaluate(() => { rate = 1; lvl = 3; newGame(true); setPlaying(true); });
    await p.waitForTimeout(400);
    check(name, await shown('#gOrd'), 'level 3: hold / attack / retreat appear');
    await p.screenshot({ path: `${OUT}/${name}-lv3.png` });
    // level 4: tents only; with every slot taken the build button is dimmed and pressing it flashes the counter
    await p.evaluate(() => { lvl = 4; newGame(true); setPlaying(false); });
    const kinds = await p.evaluate(() => [...document.querySelectorAll('[data-build]')].filter(b => !b.hidden).map(b => b.dataset.build).join());
    check(name, kinds === 'tent', `level 4: the build menu offers tents only (${kinds})`);
    const full = await p.evaluate(() => {
      const hq = s.nodes.find(n => n.kind === 'hq' && n.side === 'blue');
      for (let i = 0; i < 40 && Sim.buildCount(s, 'blue') < Sim.buildLimit(s, 'blue'); i++) Sim.build(s, 'blue', 'tent', hq.x + 60 + (i % 4) * 50, 80 + Math.floor(i / 4) * 60);
      updateHud(); return { dis: document.getElementById('bld').getAttribute('aria-disabled'), slots: document.getElementById('slotN').textContent };
    });
    await p.click('#bld', { force: true }); // dimmed, but a finger can still press it
    const after = await p.evaluate(() => ({ blink: document.getElementById('slots').classList.contains('blink'), menu: !document.getElementById('buildm').hidden }));
    check(name, full.dis === 'true' && after.blink && !after.menu, `full (${full.slots}): build button dimmed, pressing it flashes the counter, no menu ${JSON.stringify(after)}`);
    const left = await p.evaluate(() => { const a = document.getElementById('slots').getBoundingClientRect(), b = document.querySelector('.score.blue').getBoundingClientRect(); return a.right < innerWidth / 2 && Math.abs(a.top - b.top) < 4; });
    check(name, left, 'the slots counter sits on the left, beside the power bar');
    // music: five pieces, all playable
    const mus = await p.evaluate(() => { const r = Music._debug.playAll(); Music.stop(); const a = Music._debug.song(), b = Music._debug.next(); return { r, change: a !== b }; });
    check(name, mus.r && Object.keys(mus.r).length === 5 && Object.values(mus.r).every(n => n >= 20) && mus.change, `music: ${JSON.stringify(mus.r)}, the next piece is a different one`);
    // last level: fog, drone (a quadcopter, not an emoji) and forward HQ
    await p.evaluate(() => { lvl = Sim.LEVELS; newGame(true); setPlaying(true); Sim.drone(s, 'blue', s.nodes.find(n => n.kind === 'hq' && n.side === 'blue').x + 160, s.H / 2 - 60); });
    await p.waitForTimeout(600);
    const last = await p.evaluate(() => ({ fog: s.fog, big: s.H > Sim.H, svg: !!document.querySelector('#eye svg'), emoji: document.getElementById('eye').textContent.includes('🛸') }));
    check(name, last.fog && last.big && last.svg && !last.emoji && await shown('#eye') && await shown('#log'), `last level: fog, big map, drone button is a picture ${JSON.stringify(last)}`);
    await p.screenshot({ path: `${OUT}/${name}-lv-last.png` });
    await p.evaluate(() => localStorage.clear());
    check(name, !errs.length, 'no errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
