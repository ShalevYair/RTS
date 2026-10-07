// Frame times in a real Chrome (headed, the GPU on): a bot game run to N s of game time, the camera on the busiest
// place, 15 s of frames measured, and where the time goes. node tests/ui/perf.js [seconds=600] [big|huge] [3d] [zoom] [add] [still]
// (3d: the 3D view — F9; zoom: cam.z, e.g. 1 = the whole map; add: this many more units round the camera, every type; still: the game paused, ours only — only the drawing)
const { chromium } = require('playwright');
(async () => {
  const map = process.argv[3] || 'big';
  const b = await chromium.launch({ headless: false, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }) });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript((m) => { localStorage.setItem('irts-done','99'); localStorage.setItem('irts-tour','99'); localStorage.setItem('irts-map',m); localStorage.setItem('irts-fs','0'); localStorage.setItem('irts-tips','{"posts":1,"voice":1,"front":1,"groups":1,"rally":1,"care":1}'); }, map);
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForLoadState("networkidle"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async ([secs, d3, zm, add, still]) => {
    startGame(0); s.bots = ['blue', 'red']; playing = true; while (s.t < secs) Sim.step(s, 1 / 30);
    // the camera on the busiest place: the middle of all units
    const us = s.units; lookAt(us.reduce((a, u) => a + u.x, 0) / us.length, us.reduce((a, u) => a + u.y, 0) / us.length);
    if (add && still) s.collapseAt = 0;
    if (add) { const ts = ['tank', 'jeep', 'inf', 'at', 'aa', 'truck', 'ajeep', 'tjeep', 'med', 'mech', 'heli', 'air'], X = cam.x, Y = cam.y;
      for (let i = 0; i < add / 10; i++) { const t = ts[i % ts.length], sd = i % 2 && !still ? 'red' : 'blue', a = i * 2.4, r = 40 + 9 * i, x = X + Math.cos(a) * r, y = Y + Math.sin(a) * r * 0.6;
        const q = Sim._makeSquad(s, sd, t, null, x, y); q.size = 10; Sim._fillSquad(s, q, x, y); } }
    if (zm) { cam.z = zm; applyView(); }
    if (still) { for (let i = 0; i < 60; i++) Sim.step(s, 1 / 30); rate = 0; }
    if (d3) { v3Toggle(); while (!V3.on) await new Promise(r => setTimeout(r, 100)); }
    const names = 'drawBuildArea drawClouds drawDozerJobs drawDust drawEnemyIntel drawFallen drawFlashes drawFog drawFront drawGhosts drawGoneScenery drawGround drawGuess drawMarks drawMissiles drawNightLit drawNodes drawPicked drawPings drawPosts drawQuality drawScorch drawSmoke drawTracks drawUnits drawWater drawWeather sceneryTick drawMini updateHud draw drawLowFog drawRain tickCursor coachTick drawBox bgPaint drawBuildZone edgeScroll syncUpgrade feedAdd v3Draw v3Units v3Nodes v3Rings v3Fx v3Scenery v3Shade v3Deco v3Ground'.split(' ');
    window.P = {}; for (const n of names) { const f = window[n]; if (typeof f !== 'function') continue; P[n] = { t: 0, c: 0, max: 0 }; const w = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; P[n].t += d; P[n].c++; if (d > P[n].max) P[n].max = d; } }; eval(n + '=w'); }
    const st = Sim.step; P.step = { t: 0, c: 0, max: 0 }; Sim.step = function (...a) { const t = performance.now(); try { return st.apply(this, a); } finally { const d = performance.now() - t; P.step.t += d; P.step.c++; if (d > P.step.max) P.step.max = d; } };
    if (d3) { const rd = V3.r.render.bind(V3.r); P.render = { t: 0, c: 0, max: 0 }; V3.r.render = (...a) => { const t = performance.now(); rd(...a); const d = performance.now() - t; P.render.calls = V3.r.info.render.calls; P.render.tris = V3.r.info.render.triangles; P.render.objs = V3.scene.children.length; P.render.t += d; P.render.c++; if (d > P.render.max) P.render.max = d; }; }
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
    for (const k in P) P[k] = { t: 0, c: 0, max: 0 };
    const ts = []; let l = performance.now(); const st0 = l, T = 15000;
    await new Promise(res => { const g = () => { const t = performance.now(); ts.push(t - l); l = t; if (t - st0 < T) requestAnimationFrame(g); else res(); }; requestAnimationFrame(g); });
    ts.sort((a, b) => a - b);
    const top = Object.entries(P).filter(([k, v]) => v.c).map(([k, v]) => [k, +(v.t / ts.length).toFixed(2), +v.max.toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { z: +cam.z.toFixed(2), calls: P.render && P.render.calls, tris: P.render && P.render.tris, objs: P.render && P.render.objs, t: Math.round(s.t), units: s.units.length, nodes: s.nodes.length, fps: Math.round(1000 * ts.length / T), med: +ts[ts.length >> 1].toFixed(1), p95: +ts[(ts.length * .95) | 0].toFixed(1), max: +ts[ts.length - 1].toFixed(1), top };
  }, [+process.argv[2] || 600, process.argv[4] === '3d', +process.argv[5] || 0, +process.argv[6] || 0, process.argv[7] === 'still']);
  console.log(JSON.stringify(r)); await b.close();
})();
