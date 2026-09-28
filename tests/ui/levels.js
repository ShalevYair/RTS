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
    const bar1 = { sq: await shown('#gSq'), ord: await shown('#gOrd'), bld: await shown('#bld'), tr: await shown('#gTrait'), eye: await shown('#eye'), log: await shown('#log'), slots: await shown('#slots') };
    check(name, Object.values(bar1).every(v => !v), `level 1: no squad buttons, orders, building, posture, drone, log ${JSON.stringify(bar1)}`);
    await p.screenshot({ path: `${OUT}/${name}-lv1.png` });
    // tap on the enemy squad: ours goes and wins
    const at = await p.evaluate(() => { const r = s.squads.find(q => q.side === 'red'), c = cv.getBoundingClientRect(); return { x: c.left + view.cox + r.cx * view.css, y: c.top + view.coy + r.cy * view.css }; });
    await p.mouse.click(at.x, at.y);
    await p.evaluate(() => { rate = 8; });
    await p.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 30000 });
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
