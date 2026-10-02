// ---- the speed recorder: always on while playing. Every frame — how long since the last one (what the eye sees), how
// long our own code took, and how much of it went to each part (the simulation's parts, each drawing); every
// PROF_WIN s one row with the averages, the worst frame, what was on screen and how many units there were; frames over
// PROF_SPIKE ms of our code are kept one by one with their worst parts; browser tasks over 50 ms outside the frames
// (PerformanceObserver 'longtask'). Kept in memory (the last PROF_ROWS rows); Ctrl+Shift+L saves it with the error log
// as one file. F8 shows the numbers live, top-left. ----
const PROF_WIN = 5, PROF_ROWS = 720, PROF_SPIKE = 40, PROF_SPIKES = 300, PROF_KEEP = 15;
const Prof = (() => {
  const t0 = performance.now(), cur = {}, calls = {}, rows = [], spikes = [], longs = [];
  let win = null, lastAt = 0, shown = false, box = null;
  const fresh = () => ({ at: performance.now(), n: 0, gaps: [], work: 0, workMax: 0, steps: 0, parts: {}, partsMax: {}, calls: {}, long: 0, longMs: 0 });
  // a global function (of any script) timed: each call adds to its part of this frame
  function wrap(name, label) {
    const f = window[name]; if (typeof f !== 'function' || f.profWrapped) return false;
    const L = label || name;
    const w = function () {
      const a = performance.now();
      try { return f.apply(this, arguments); } finally { cur[L] = (cur[L] || 0) + performance.now() - a; calls[L] = (calls[L] || 0) + 1; }
    };
    w.profWrapped = true;
    try { window[name] = w; } catch (e) { return false; }
    return window[name] === w;
  }
  const SIM = ['unitGrid', 'updateSquad', 'initiative', 'updateUnit', 'steer', 'underFire', 'separate', 'postsTick', 'updateStructs', 'dozerWork',
    'missileTick', 'visibility', 'think', 'updatePower', 'record', 'calls', 'deliver', 'controlNodes', 'weatherAt'];
  const UI = ['draw', 'drawGround', 'bgPaint', 'drawScenery', 'sceneryTick', 'drawGoneScenery', 'drawWater', 'drawScorch', 'drawTracks', 'drawFallen', 'drawDust',
    'drawUnits', 'drawGhosts', 'drawSmoke', 'drawFlashes', 'drawClouds', 'drawWeather', 'drawNightLit', 'drawFog', 'drawQuality', 'drawEnemyIntel',
    'drawMarks', 'drawPosts', 'drawNodes', 'drawDozerJobs', 'drawBuildArea', 'drawBuildZone', 'drawMissiles', 'drawPicked', 'drawPings', 'drawMini',
    'drawBox', 'updateHud', 'tickCursor', 'edgeScroll', 'coachTick', 'sunShadeTick', 'drawOutro'];
  const missing = [];
  for (const n of SIM) if (!wrap(n, 'sim.' + n)) missing.push(n);
  for (const n of UI) if (!wrap(n)) missing.push(n);
  if (typeof Sim !== 'undefined' && typeof Sim.step === 'function') { const f = Sim.step; Sim.step = function (a, b) { const t = performance.now(); try { return f(a, b); } finally { cur.SIM = (cur.SIM || 0) + performance.now() - t; calls.SIM = (calls.SIM || 0) + 1; } }; }
  if (typeof Radio !== 'undefined' && typeof Radio.tick === 'function') { const f = Radio.tick; Radio.tick = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { cur.radio = (cur.radio || 0) + performance.now() - t; } }; }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) { if (win) { win.long++; win.longMs += e.duration; } if (longs.length < 500) longs.push({ at: +((e.startTime - t0) / 1000).toFixed(1), ms: Math.round(e.duration), gt: s ? Math.round(s.t) : null }); } }).observe({ entryTypes: ['longtask'] });
  } catch (e) { /* not in this browser */ }
  const r1 = x => Math.round(x * 10) / 10;
  function close(now) {
    if (!win || !win.n) return;
    const g = win.gaps.slice().sort((a, b) => a - b), at = q => g[Math.min(g.length - 1, Math.floor(q * g.length))] || 0, secs = (now - win.at) / 1000;
    const parts = {}; for (const k of Object.keys(win.parts).sort((a, b) => win.parts[b] - win.parts[a])) { const v = win.parts[k] / win.n; if (v >= 0.05) parts[k] = [r1(v), r1(win.partsMax[k]), Math.round(win.calls[k] / win.n)]; }
    const vr = typeof viewRect === 'function' ? viewRect() : null;
    rows.push({
      at: r1((now - t0) / 1000), gt: s ? Math.round(s.t) : null, fps: r1(win.n / secs), gapAvg: r1(g.reduce((a, b) => a + b, 0) / (g.length || 1)), gap95: r1(at(0.95)), gapMax: r1(g[g.length - 1] || 0),
      work: r1(win.work / win.n), workMax: r1(win.workMax), steps: r1(win.steps / win.n), long: win.long, longMs: Math.round(win.longMs),
      units: s ? s.units.length : 0, nodes: s ? s.nodes.length : 0, fx: s ? s.fx.length : 0, shots: s ? s.shots.length : 0,
      px: r1(view.css * 100) / 100, seen: vr ? Math.round(vr.w) + 'x' + Math.round(vr.h) : '', canvas: cv.width + 'x' + cv.height,
      playing, rate, lite, fog: s && s.fog, night: s && s.nightK != null ? r1(s.nightK) : undefined, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : undefined, parts,
    });
    if (rows.length > PROF_ROWS) rows.shift();
  }
  // one frame done: took = our code's time in it
  function frame(now, took) {
    if (!win) win = fresh();
    const gap = lastAt ? now - lastAt : 0; lastAt = now;
    if (gap && gap < 5000) win.gaps.push(gap); // (a hidden tab: no frames — not a slow one)
    win.n++; win.work += took; win.workMax = Math.max(win.workMax, took); win.steps += calls.SIM || 0;
    for (const k in cur) { win.parts[k] = (win.parts[k] || 0) + cur[k]; win.partsMax[k] = Math.max(win.partsMax[k] || 0, cur[k]); win.calls[k] = (win.calls[k] || 0) + (calls[k] || 0); }
    if (took > PROF_SPIKE) {
      if (spikes.length >= PROF_SPIKES) spikes.shift();
      const top = Object.keys(cur).sort((a, b) => cur[b] - cur[a]).slice(0, 8).map(k => k + ' ' + r1(cur[k]) + (calls[k] > 1 ? '×' + calls[k] : ''));
      spikes.push({ at: r1((now - t0) / 1000), gt: s ? Math.round(s.t) : null, ms: r1(took), gap: r1(gap), top, units: s ? s.units.length : 0, px: r1(view.css * 100) / 100 });
    }
    if (shown) show(gap, took);
    for (const k in cur) delete cur[k]; for (const k in calls) delete calls[k];
    if (now - win.at >= PROF_WIN * 1000) { close(now); win = fresh(); keep(now); }
  }
  let showAt = 0, shownGap = 0;
  function show(gap, took) {
    shownGap = shownGap * 0.9 + gap * 0.1;
    const now = performance.now(); if (now - showAt < 250) return; showAt = now;
    const top = Object.keys(cur).filter(k => k !== 'draw' && k !== 'SIM').sort((a, b) => cur[b] - cur[a]).slice(0, 5).map(k => k + ' ' + r1(cur[k])).join('\n');
    box.textContent = `${Math.round(1000 / (shownGap || 16))} fps${lite ? ' · lite ' + lite : ''} · frame ${r1(shownGap)} ms\nours ${r1(took)} · sim ${r1(cur.SIM || 0)} ×${calls.SIM || 0} · draw ${r1(cur.draw || 0)}\nunits ${s ? s.units.length : 0} · ${r1(view.css * 100) / 100} px\n${top}`;
  }
  function toggle() {
    shown = !shown;
    if (!box) { box = document.createElement('pre'); box.id = 'prof'; box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#e8ffe0;background:rgb(0 0 0 / .6);border-radius:6px;pointer-events:none;direction:ltr;text-align:left;white-space:pre'; document.body.appendChild(box); }
    box.hidden = !shown;
  }
  function report() {
    close(performance.now()); win = fresh();
    let gpu = ''; try { const g = document.createElement('canvas').getContext('webgl'), x = g && g.getExtension('WEBGL_debug_renderer_info'); gpu = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { /* none */ }
    return {
      info: { when: new Date().toISOString(), ua: navigator.userAgent, cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, gpu, screen: screen.width + 'x' + screen.height, win: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio,
        map: s ? s.W + 'x' + s.H : '', lvl, diff: s && s.diff, url: location.protocol, missing, rows: 'at = wall s, gt = game s, gap = ms between frames, work = ms of our code per frame, parts = [avg ms per frame, max ms, calls per frame]' },
      rows, spikes, longs,
    };
  }
  // what's in this frame so far, the heaviest first (for the error log's slow frames)
  const top = () => Object.keys(cur).sort((a, b) => cur[b] - cur[a]).slice(0, 8).map(k => k + ' ' + r1(cur[k]) + (calls[k] > 1 ? '×' + calls[k] : '')).join(', ');
  // kept in the browser too (irts-prof), every PROF_KEEP s: the last rows and slow frames, without having to save a file
  let keptAt = 0;
  function keep(now) {
    if (now - keptAt < PROF_KEEP * 1000) return; keptAt = now;
    try { localStorage.setItem('irts-prof', JSON.stringify({ when: new Date().toISOString(), win: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, canvas: cv.width + 'x' + cv.height, url: location.protocol, rows: rows.slice(-120), spikes: spikes.slice(-150), longs: longs.slice(-100) })); } catch (e) { /* full / unavailable */ }
  }
  return { frame, toggle, report, top, keep };
})();
