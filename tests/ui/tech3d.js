// The tech tree (techui.js) in 3D: opened from the stock under the power bar, the game stands still, built / can /
// locked, the lines, a locked one's tooltip, a click on one that can go up arms it; K closes. Hebrew and English.
// node tests/ui/tech3d.js → tests/ui/out/3d/tech_{he,en,start}.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  let errs = 0;
  for (const lang of ['he', 'en']) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    await p.addInitScript(l => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-map', 'big'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); localStorage.setItem('irts-lang', l); localStorage.setItem('irts-tips', '{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1,"asks":1}'); }, lang);
    p.on('pageerror', e => { errs++; console.log('ERR', e.message); }); p.on('console', m => { if (m.type() === 'error' && !/slow /i.test(m.text())) { errs++; console.log('CON', m.text().slice(0, 300)); } });
    await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function' && typeof TILES === 'object'); await p.waitForTimeout(1500);
    const out = n => path.join(__dirname, 'out', '3d', n);
    await p.evaluate(async start => {
      Math.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
      const dn = Date.now; Date.now = () => 7000; startGame(0); Date.now = dn; s.bots = ['blue', 'red']; s.fog = false; hqArmed = false;
      const until = start ? 60 : 600; while (s.t < until || !s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && s.t >= n.ready)) Sim.step(s, 1 / 30);
      s.bots = ['red']; if (!V3.on) v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100));
      setPlaying(true); updateHud();
    }, lang === 'en');
    await p.waitForTimeout(800);
    await p.click('#stockB'); await p.waitForTimeout(600);
    const st = await p.evaluate(() => ({ open: !$('techTree').hidden, playing, dir: getComputedStyle($('techGrid')).direction,
      nodes: [...document.querySelectorAll('#techGrid .tnode')].map(b => b.dataset.tk + ':' + b.className.split(' ')[1]), lines: document.querySelectorAll('#techSvg path').length }));
    console.log(lang, JSON.stringify(st));
    const lock = await p.$('#techGrid .tnode.lock');
    if (lock) { await lock.hover(); await p.waitForTimeout(700); console.log(lang, 'tip:', await p.evaluate(() => document.querySelector('.tip:not([hidden])')?.textContent)); }
    await p.screenshot({ path: out('tech_' + lang + '.png') });
    const can = await p.$('#techGrid .tnode.can:not(.mate)');
    if (can) { const k = await can.getAttribute('data-tk'); await can.click(); await p.waitForTimeout(300); console.log(lang, 'clicked', k, '→ armed', await p.evaluate(() => buildArmed), 'closed', await p.evaluate(() => $('techTree').hidden), 'playing', await p.evaluate(() => playing)); }
    await p.keyboard.press('Escape'); await p.keyboard.press('KeyK'); await p.waitForTimeout(300);
    console.log(lang, 'K opens', await p.evaluate(() => !$('techTree').hidden)); await p.keyboard.press('KeyK'); await p.waitForTimeout(200);
    console.log(lang, 'K closes', await p.evaluate(() => $('techTree').hidden));
    await p.close();
  }
  console.log('errors', errs); await b.close();
})();
