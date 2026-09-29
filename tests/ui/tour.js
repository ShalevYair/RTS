// Words and help: a level's first time opens a tour of what's new (one bubble after another, the game waiting), the
// settings are short rows with a tooltip each and a way back to the levels, the language switches the whole page
// (right-to-left ⇄ left-to-right), a right click clears the pick, 🏗 pulses while there's room to build, the order
// buttons are symbols, the squad buttons show the unit itself
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
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    // level 1, first time: ▶ opens the tour; the game waits until it's done
    await p.click('#go'); await p.waitForTimeout(200);
    const t1 = await p.evaluate(() => ({ tip: !document.getElementById('tip').hidden, text: document.getElementById('tipT').textContent, n: document.getElementById('tipN').textContent, playing }));
    check(name, t1.tip && !t1.playing && /1\/4/.test(t1.n), `level 1 tour: "${t1.text}" ${t1.n}, paused`);
    await p.screenshot({ path: `${OUT}/${name}-tour1.png` });
    for (let i = 0; i < 2; i++) await p.click('#tipNext');
    await p.screenshot({ path: `${OUT}/${name}-tour3.png` });
    await p.click('#tipNext'); await p.click('#tipNext'); await p.waitForTimeout(100);
    const t2 = await p.evaluate(() => ({ tip: !document.getElementById('tip').hidden, playing, seen: localStorage.getItem('irts-tour') }));
    check(name, !t2.tip && t2.playing && t2.seen === '1', `after the tour the fight starts ${JSON.stringify(t2)}`);
    // a later level: its new things
    const tour = await p.evaluate(() => [3, 9, 10, 11].map(n => { lvl = n; newGame(true); return n + ':' + levelTour(n).length; }).join(' '));
    check(name, /3:2 9:1 10:1 11:1/.test(tour), `tours per level: ${tour}`);
    // the full game: settings, language, right click, the build nudge, symbols, lines that fade
    await p.evaluate(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); lvl = 0; toured = 99; newGame(true); showIntro(false); setPlaying(true); });
    await p.click('#gear'); await p.waitForTimeout(100);
    const paused = await p.evaluate(() => playing);
    check(name, !paused, 'the settings pause the game');
    const menu = await p.evaluate(() => ({ words: document.getElementById('menu').innerText.replace(/\s+/g, ' ').trim(), home: !!document.getElementById('home') }));
    check(name, menu.words.length < 120 && menu.home, `settings are short (${menu.words.length} chars): "${menu.words}"`);
    await p.screenshot({ path: `${OUT}/${name}-menu.png` });
    if (!touch) {
      await p.hover('#music'); await p.waitForTimeout(600);
      const tip = await p.evaluate(() => !document.getElementById('tip').hidden && document.getElementById('tipT').textContent);
      check(name, tip === 'מוזיקה', `hovering a control shows its line: "${tip}"`);
    }
    await p.click('[data-lang="en"]'); await p.waitForTimeout(100);
    const en = await p.evaluate(() => ({ dir: document.documentElement.dir, speed: document.querySelector('[data-t="speed"]').textContent, hold: document.getElementById('ordMode').getAttribute('aria-label'), build: document.querySelector('[data-build="tent"] b').textContent }));
    check(name, en.dir === 'ltr' && en.speed === 'Speed' && en.hold === 'Attack' && en.build === 'Tent', `English: ${JSON.stringify(en)}`);
    await p.screenshot({ path: `${OUT}/${name}-menu-en.png` });
    await p.click('[data-lang="he"]'); await p.click('#gear');
    check(name, await p.evaluate(() => playing), 'closing the settings goes on');
    await p.click('#gear'); await p.click('#home'); await p.waitForTimeout(100);
    check(name, await p.isVisible('#intro') && await p.isVisible('#levels'), '🏠 goes back to the level screen');
    await p.click('#go');
    const bar = await p.evaluate(() => ({ svg: document.querySelectorAll('#gOrd svg').length, words: document.getElementById('gOrd').innerText.trim(), nudge: (updateHud(), document.getElementById('bld').classList.contains('nudge')) }));
    check(name, bar.svg === 1 && !bar.words && bar.nudge, `orders are symbols, 🏗 pulses with room to build ${JSON.stringify(bar)}`);
    const tog = await p.evaluate(() => { const b = document.getElementById('ordMode'), m0 = mode; b.click(); const m1 = mode, l1 = b.getAttribute('aria-label'); b.click(); return [m0, m1, l1, mode].join(); });
    check(name, tog === 'attack,hold,להחזיק,attack', `one order button: sword by default, a tap switches to the shield and back (${tog})`);
    if (!touch) {
      await p.evaluate(() => select(blueSquads()[0].id));
      const box = await p.locator('#cv').boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
      const none = await p.evaluate(() => ({ sel, ord: !document.getElementById('gOrd').hidden }));
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
      const all = await p.evaluate(() => ({ sel, ord: !document.getElementById('gOrd').hidden, types: [...document.querySelectorAll('[data-ty]')].every(b => b.getAttribute('aria-pressed') === 'true') }));
      check(name, none.sel === null && !none.ord && all.sel === 'all' && all.ord && all.types, `right click: none picked, no orders ${JSON.stringify(none)}; again: all, every type lit ${JSON.stringify(all)}`);
      // a number picks every squad of its type
      await p.keyboard.press('1'); const inf = await p.evaluate(() => selIds().map(id => s.squads.find(q => q.id === id).type).join());
      check(name, inf === 'inf', `1 (the first button) picks the infantry (${inf})`);
      // groups: pick both squads, 🔗 ties them; one button for the group, first; tapping one of them on the map picks
      // the group; an order moves them in rows; ✂ breaks it up
      await p.evaluate(() => select('all')); await p.evaluate(() => select(blueSquads().filter(q => !q.dead).map(q => q.id)));
      await p.click('#grp');
      const g1 = await p.evaluate(() => ({ groups: groups.length, btns: [...document.querySelectorAll('#sqs button')].map(b => b.dataset.gr ? 'G' : b.dataset.ty).join(), icon: document.getElementById('grp').textContent }));
      await p.evaluate(() => { select(null); const q = blueSquads()[0], r = cv.getBoundingClientRect(); tap({ clientX: r.left + view.cox + q.cx * view.css, clientY: r.top + view.coy + q.cy * view.css }); });
      const g2 = await p.evaluate(() => ({ n: selIds().length, pressed: document.querySelector('[data-gr]').getAttribute('aria-pressed') }));
      await p.screenshot({ path: `${OUT}/${name}-group.png` });
      await p.click('#grp'); const g3 = await p.evaluate(() => ({ groups: groups.length, btns: [...document.querySelectorAll('#sqs button')].length }));
      check(name, g1.groups === 1 && g1.btns === 'G' && g1.icon === '✂' && g2.n === 2 && g2.pressed === 'true' && g3.groups === 0 && g3.btns === 2, `groups: tied ${JSON.stringify(g1)}, one tap on the map picks the group ${JSON.stringify(g2)}, broken up ${JSON.stringify(g3)}`);
    }
    await p.screenshot({ path: `${OUT}/${name}-bar.png` });
    // level 10: our squads out of the exact picture show faintly where they probably are
    await p.evaluate(() => { lvl = 10; newGame(true); showIntro(false); const q = blueSquads()[0]; Sim.order(s, q.id, 'attack', s.W * 0.7, s.H * 0.5); for (let i = 0; i < 30 * 30; i++) Sim.step(s, 1 / 30); cam = { x: s.W / 2, y: s.H / 2, z: 1 }; applyView(); });
    await p.waitForTimeout(300);
    const g = await p.evaluate(() => { const q = blueSquads()[0], p = guessAt(q); return { shown: sqShown(q), off: Math.round(Math.hypot(p.x - q.cx, p.y - q.cy)) }; });
    check(name, !g.shown && g.off < 150, `out of the exact picture: a guess ${g.off} from the truth`);
    await p.screenshot({ path: `${OUT}/${name}-guess.png` });
    check(name, !errs.length, `no errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
