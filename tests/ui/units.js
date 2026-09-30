// New units on the map: anti-tank soldiers, AA / AT jeeps, the armed-jeep workshops with their badge, and the bar
// that shows when a building's next unit comes out; the build menu lists them
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let bad = false;
  const check = (name, c, m) => { if (!c) bad = true; console.log(name, c ? 'ok  ' : 'FAIL', m); };
  for (const [name, vp, scheme] of [['desk', { width: 1400, height: 800 }, 'light'], ['dark', { width: 1400, height: 800 }, 'dark']]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme });
    await ctx.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fixedhq', '1'); });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      lvl = 0; fog = false; bigMap = false; newGame(true); showIntro(false); s.bots = [];
      const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
      const put = (kind, dx, dy) => { const n = s.nodes.find(k => k.side === 'blue' && k.kind === kind) || { kind }; return Sim.build(s, 'blue', kind, hq.x + dx, hq.y + dy); };
      const made = [put('jeepaa', 110, -60), put('atpost', 110, 60), put('jeepat', 60, 150)];
      for (const n of s.nodes) if (n.side === 'blue') n.ready = s.t; // up at once
      for (let i = 0; i < 30 * 12; i++) Sim.step(s, 1 / 30);
      for (const [t, y] of [['at', -120], ['ajeep', 0], ['tjeep', 120]]) { const q = Sim._makeSquad(s, 'blue', t, null, hq.x + 260, hq.y + y); q.size = 3; Sim._fillSquad(s, q, hq.x + 260, hq.y + y); }
      cam = { x: hq.x + 150, y: hq.y, z: 2.2 }; applyView(); updateHud(); renderSquadButtons && renderSquadButtons();
      const prog = s.nodes.filter(n => n.side === 'blue' && n.prog > 0).length;
      return { made, prog };
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${name}-units.png` });
    check(name, r.made.every(Boolean) && r.prog >= 1, `built the new kinds ${JSON.stringify(r)}`);
    const menu = await p.evaluate(() => ['atpost', 'jeepaa', 'jeepat'].map(k => { const e = document.querySelector(`[data-build="${k}"]`); return e && !e.hidden && e.textContent; }));
    check(name, menu.every(Boolean), `the build menu lists them: ${menu.join(' | ')}`);
    await p.evaluate(() => toggleBuild()); await p.waitForTimeout(100); await p.screenshot({ path: `${OUT}/${name}-buildmenu.png` });
    await p.evaluate(() => { toggleBuild(); });
    // the full game under fog: radio silence for the picked squad, a fake HQ, night
    const f = await p.evaluate(() => {
      lvl = 0; fog = true; bigMap = false; newGame(true); showIntro(false); s.bots = [];
      const q = blueSquads().find(k => k.type === 'jeep'); select(q.id); syncButtons();
      const btn = document.getElementById('silent'), shown = !btn.hidden, before = btn.textContent; btn.click(); const after = btn.textContent;
      for (let i = 0; i < 30 * 10; i++) Sim.step(s, 1 / 30);
      const hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); buildArmed = 'decoy'; placeBuilding(hq.x + 120, hq.y + 140);
      const decoy = s.nodes.some(n => n.kind === 'decoy');
      s.t = 330; updateHud(); cam = { x: hq.x + 150, y: hq.y, z: 2 }; applyView();
      return { shown, before, after, silent: q.silent, decoy, moon: !document.getElementById('moon').hidden, item: document.querySelector('[data-build="decoy"]').textContent };
    });
    await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-night.png` });
    check(name, f.shown && f.before === '📻' && f.after === '🤫' && f.silent && f.decoy && f.moon, `silence button, fake HQ, night ${JSON.stringify(f)}`);
    // open field: no HQ at first; building waits; 🏰 is armed, the strip shows; a tap outside it is refused, inside the
    // bulldozer drives there and puts the HQ up
    const h0 = await p.evaluate(() => { localStorage.removeItem('irts-fixedhq'); lvl = 0; fog = true; bigMap = true; newGame(true); showIntro(false); setPlaying(true); updateHud();
      return { hq: s.nodes.some(n => n.kind === 'hq'), armed: hqArmed, btn: !document.getElementById('hqb').hidden, build: Sim.buildCheck(s, 'blue', 100, s.H / 2) }; });
    await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${name}-placehq.png` });
    const h1 = await p.evaluate(() => { const carrier = () => s.squads.find(q => q.side === 'blue' && q.hqAt); // (the full game: the bulldozer goes to put it up)
      placeHq(s.W * 0.5, 300); const refused = !carrier(); placeHq(s.W * 0.1, s.H * 0.2); const going = !!carrier() && carrier().type === 'dozer';
      setPlaying(false); for (let i = 0; i < 30 * 90 && s.hqPending.blue; i++) Sim.step(s, 1 / 30);
      const h = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'); updateHud(); syncButtons();
      return { refused, going, at: h && [Math.round(h.x), Math.round(h.y)], t: Math.round(s.t), pending: s.hqPending.blue, btn: !document.getElementById('hqb').hidden, red: s.nodes.some(n => n.side === 'red' && n.kind === 'hq') }; });
    check(name, !h0.hq && h0.armed && h0.btn && h0.build === 'nohq' && h1.refused && h1.going && h1.at && !h1.pending && !h1.btn && h1.red, `the HQ where we pick it ${JSON.stringify({ h0, h1 })}`);
    check(name, !errs.length, `no errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await b.close();
  if (bad) process.exitCode = 1;
})();
