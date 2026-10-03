// UI: new game and the main loop
function newGame(skipIntro) {
  const seed = (Date.now() % 1e6) | 0;
  // big: 2× wide and 2× high, never narrower than 2000 (a phone held upright would get a thin strip)
  // (the player's units: each its own squad — singles)
  if (lvl) s = Sim.level(lvl, seed, worldWidth(), { singles: true });
  else {
    const k = hugeMap ? 4 : 2; // big: 2× wide and high; huge: 4×
    s = bigMap ? Sim.create(seed, k * Math.max(1000, worldWidth()), diff, k * Sim.H, { singles: true }) : Sim.create(seed, worldWidth(), diff, Sim.H, { singles: true }); s.fog = fog;
    // the big maps: posts to take, the weather, fast roads, ambushes (field.js; none on the small map)
    if (bigMap) Sim.extras(s);
    // the full game opens on an open field: each side picks where its HQ goes (tests may keep the fixed HQ)
    let fixed = false; try { fixed = localStorage.getItem('irts-fixedhq') === '1'; } catch (e) { /* storage unavailable */ }
    if (!fixed) Sim.openField(s);
  }
  // the low graphics: no day and night, no rain or morning fog in this game at all (both sides alike)
  if (gfxLow) { s.night = false; s.wxPlan = []; lite = Math.max(lite, 1); }
  // the big map opens zoomed in on our base; the small one shows it all
  cam = s.H > Sim.H ? { x: 0, y: s.H / 2, z: -1 } : { x: s.W / 2, y: s.H / 2, z: 1 };
  // the tutorial: close in on our forces (TUT_PX), a little toward the enemy — not the whole map, where the units were
  // too small to see
  if (lvl) {
    const ours = s.units.filter(u => u.side === 'blue'), hq = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq');
    const at = ours.length ? { x: ours.reduce((a, u) => a + u.x, 0) / ours.length, y: ours.reduce((a, u) => a + u.y, 0) / ours.length } : hq || { x: s.W / 4, y: s.H / 2 };
    cam = { x: at.x, y: at.y, z: -1, px: TUT_PX, ahead: TUT_AHEAD };
  }
  // in the tutorial a tap on the map attacks (hold / retreat come later)
  feedClear(); decor = makeDecor(s);
  // (no trees on the posts; the roads go to the sim, for the vehicles' speed)
  if (s.posts) for (const it of decor.rocks.items) if (s.posts.some(p => Math.hypot(p.x - it.x, p.y - it.y) < Sim.POSTS[p.kind].r * 1.5 + 18)) it.gone = 1;
  // (nor on the ground's mud, cliffs and dense woods — the woods have their own trees, ground.js)
  if (s.ground) for (const it of decor.rocks.items) if (Sim.groundAt(s, it.x, it.y)) it.gone = 1;
  if (s.extras) Sim.setRoads(s, decor.roads);
  views = {}; wxWas = { rain: false, fog: false };
  Sim.setCover(s, decor.rocks.items.filter(it => it.t === 'tree').map(it => (it.r = it.s * 0.4, it))); sel = 'all'; selNode = null; selPost = null; nag.at = nag.built = nag.fhq = 0; pings = []; nodeHp.clear(); can.fhq = can.drone = true; mode = 'attack'; playing = false; logKey = ''; endShown = false; eyeArmed = false; buildArmed = null; hqArmed = !!(s.hqPending && s.hqPending.blue); hqTold = false; sqKey = ''; groups = []; fight = []; fightAt = 0; Radio.reset();
  $('buildm').hidden = true; if (tour) { tour = null; $('tourBg').hidden = true; } hideTip();
  $('end').hidden = true; $('share').textContent = tr('share'); outro = null; $('outro').hidden = true; try { $('outroVid').pause(); } catch (e) { /* no video */ }
  applyUi(); resize(); syncButtons(); updateHud(); if (!skipIntro) showIntro(true);
}

const DT = 1 / 30; let last = performance.now(), acc = 0, shake = 0;
const NAG_T = 60, nag = { at: 0, built: 0, fhq: 0 }; // (the reminders to build: see frameBody)
const FIGHT_T = 6, FIGHT_SHOTS = 8, CALM_T = 40; let fight = [], fightAt = 0;
const SHAKE_MAX = 8, reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// an error in a frame never stops the game: it's written to the log (errLog) and the next frame goes on
function frame(now) {
  const t0 = performance.now();
  try { frameBody(now); } catch (e) { errLog('frame', e); }
  const took = performance.now() - t0; if (took > SLOW_FRAME) errLog('slow', null, Math.round(took) + ' ms' + (typeof Prof !== 'undefined' ? ' | ' + Prof.top() : ''));
  if (typeof Prof !== 'undefined') Prof.frame(now, took); // (the speed recorder: prof.js, loaded after this)
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // (at most STEP_CAP steps a frame for each 1× of speed: slow frames made more steps, the frames slower still, down
  // to 2 a second — the game goes a little slower instead)
  if (playing) { acc = Math.min(acc + dt * rate, DT * STEP_CAP * Math.max(1, rate)); s.lite = lite > 0; while (acc >= DT) { Sim.step(s, DT); acc -= DT; } } else acc = 0;
  liteTick(now, dt);
  // one sound per new explosion (the audio side rate-limits bursts)
  const vr = viewRect(), onScreen = p => vr && p.x > vr.x - 60 && p.x < vr.x + vr.w + 60 && p.y > vr.y - 60 && p.y < vr.y + vr.h + 60;
  for (const f of s.fx) if (!f.heard && !(f.wait > 0)) {
    f.heard = true; if (sfxOn) Music.boom(f.size, f.x / s.W);
    if (f.size >= 26 && onScreen(f)) shake = Math.min(SHAKE_MAX, shake + (f.size >= 34 ? 6 : 2.5)); // a unit / building destroyed
  }
  // gunfire on screen: a crack for bullets, a thump for shells, a whoosh for missiles (the audio side limits bursts)
  for (const sh of s.shots) if (!sh.heard) {
    sh.heard = true; if (sfxOn && onScreen({ x: sh.x1, y: sh.y1 })) Music.shot(sh.kind, sh.x1 / s.W);
    fight.push(s.t); // (two sides: every shot is ours or at us)
  }
  // the music's mood: battle pieces once we're fighting (FIGHT_SHOTS shots in FIGHT_T s of game time),
  // calm again only after CALM_T s with none of that
  while (fight.length && fight[0] < s.t - FIGHT_T) fight.shift();
  if (fight.length >= FIGHT_SHOTS) fightAt = s.t;
  coachTick(); // (the tutorial's nudges, first-time tips)
  if (playing) Tracks.setMood(s.t - fightAt < CALM_T && fightAt > 0 ? 'battle' : 'calm');
  shake *= Math.exp(-dt * 9); if (shake < 0.2) shake = 0;
  cv.style.transform = shake && !reduceMotion ? `translate(${((Math.random() - 0.5) * 2 * shake).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * shake).toFixed(1)}px)` : '';
  for (const k of s.marks) if (!k.heard) {
    k.heard = true; if (!playing) continue;
    feedAdd(k);
    if ((k.kind === 'missile' || k.kind === 'launch') && sfxOn) Music.siren(); // (a missile launch, theirs or ours: the siren)
    if (k.kind === 'hqReady') toast(tr('hqReadyNote'), innerWidth / 2, 90, 5000); // written as well as said
    // the order reaching the squad: its reply (attacking, on the way…), as it was given
    Radio.hear(k.kind === 'ack' ? { kind: orderSay[k.id] || replyOf(k.type), id: k.id } : k);
  }
  // our buildings under fire: a call when one loses health — the HQ, a forward HQ, any other (the fake HQ is meant to be
  // hit)
  for (const n of s.nodes) {
    if (n.side !== 'blue' || n.kind === 'drone' || n.kind === 'decoy') continue;
    const was = nodeHp.get(n.id); nodeHp.set(n.id, n.hp);
    if (!playing || was === undefined || n.hp >= was - 0.5 || n.hp <= 0) continue;
    const hk = { kind: n.kind === 'hq' ? 'hqHit' : n.kind === 'fhq' ? 'fhqHit' : 'baseHit', x: n.x, y: n.y, t: s.t };
    Radio.hear(hk); feedAdd(hk); // (the radio keeps quiet while the same place keeps being hit)
  }
  // a forward HQ that can be set up now, a drone to fly now: said once when it becomes so, a note by its button
  if (playing && !s.over) {
    const fc = uiHas('fhq') && s.cd.blue.fhq <= 0 && Sim.fhqCount(s, 'blue') < Sim.fhqMax(s) && fhqCrews().length > 0, dc = uiHas('eye') && s.fog && s.drones.blue.stock > 0;
    if (fc && !can.fhq && s.t > 3) { Radio.hear({ kind: 'fhqCan' }); noteBy('fhq', tr('fhqCan')); }
    if (dc && !can.drone && s.t > 3) { Radio.hear({ kind: 'droneCan' }); noteBy('eye', tr('droneCan')); }
    can.fhq = fc; can.drone = dc;
    // (a minute of game time — NAG_T — with room to build and nothing laid: said again; else a forward HQ that could go)
    if (s.t - nag.at >= NAG_T) {
      nag.at = s.t;
      const hqUp = !(s.hqPending && s.hqPending.blue) && s.nodes.some(n => n.side === 'blue' && n.kind === 'hq' && n.hp > 0 && s.t >= n.ready);
      const room = uiHas('build') && hqUp && Sim.buildLimit(s, 'blue') - Sim.buildCount(s, 'blue') > 0;
      if (room && s.t - nag.built >= NAG_T) { Radio.hear({ kind: 'canBuild' }); feedAdd({ kind: 'canBuild', t: s.t }); }
      else if (fc && s.t - nag.fhq >= NAG_T) { Radio.hear({ kind: 'fhqCan' }); noteBy('fhq', tr('fhqCan')); }
    }
  }
  Radio.tick();
  if (replayAuto && !$('end').hidden && !$('replayBox').hidden && now - replayAt > 180) {
    replayAt = now; const sc = $('scrub'), i = (+sc.value + 1) % (+sc.max + 1); sc.value = i; drawReplay(i);
  }
  if (outro) outroTick(now, dt); else { edgeScroll(dt); tickCursor(); syncUpgrade(); }
  draw(); if (outro) drawOutro(now); drawBox(); drawMini();
  if (now - hudAt > 200) { hudAt = now; updateHud(); }
}
// ---- the light mode (lite, core.js): on by itself while the frames are slow — under LITE_ON fps over two LITE_WIN s
// running a step down, back up a step after LITE_BACK s over LITE_OFF fps ----
const STEP_CAP = 2, LITE_WIN = 2, LITE_ON = 20, LITE_OFF = 45, LITE_BACK = 20;
const liteW = { at: 0, n: 0, sum: 0, good: 0, told: false };
function liteTick(now, dt) {
  if (!playing || !$('intro').hidden) { liteW.at = now; liteW.n = liteW.sum = 0; return; }
  liteW.n++; liteW.sum += dt;
  if (now - liteW.at < LITE_WIN * 1000) return;
  const fps = liteW.n / Math.max(0.001, liteW.sum); liteW.at = now; liteW.n = liteW.sum = 0;
  // (two slow windows running: not the moment a game is being made)
  liteW.bad = fps < LITE_ON ? (liteW.bad || 0) + 1 : 0;
  if (liteW.bad >= 2 && lite < 2) { lite++; liteW.bad = 0; liteW.good = 0; resize(); if (!liteW.told) { liteW.told = true; toast(tr('liteOn'), innerWidth / 2, 80, 4000); } }
  else if (fps > LITE_OFF && lite > (gfxLow ? 1 : 0)) { liteW.good += LITE_WIN; if (liteW.good >= LITE_BACK) { lite--; liteW.good = 0; resize(); } }
  else liteW.good = 0;
}
// ---- the log: errors (and very slow frames) with where the game stood, kept in the browser (irts-log, the last
// LOG_MAX); a note on screen at the first one; Ctrl+Shift+L saves it as a file ----
const LOG_MAX = 40, SLOW_FRAME = 700; let logTold = false, slowAt = 0;
function errLog(where, e, note) {
  if (where === 'slow') { if (performance.now() - slowAt < 5000) return; slowAt = performance.now(); }
  const at = s ? { t: Math.round(s.t), units: s.units.length, nodes: s.nodes.length, sel: Array.isArray(sel) ? sel.length : sel, lvl, playing } : {};
  const row = { when: new Date().toISOString(), where, msg: e ? String(e.message || e) : note, stack: e && e.stack ? String(e.stack).split('\n').slice(0, 6).join('\n') : '', ...at };
  console.error('[irts]', row.where, row.msg, row.stack);
  let l = []; try { l = JSON.parse(localStorage.getItem('irts-log') || '[]'); } catch (x) { /* storage unavailable */ }
  l.push(row); try { localStorage.setItem('irts-log', JSON.stringify(l.slice(-LOG_MAX))); } catch (x) { /* full / unavailable */ }
  if (where !== 'slow' && !logTold) { logTold = true; try { toast(tr('errLogged'), innerWidth / 2, 80, 5000); } catch (x) { /* before the UI is up */ } }
}
window.addEventListener('error', e => errLog('error', e.error || e.message));
window.addEventListener('unhandledrejection', e => { if (e.reason && /play\(\)|NotAllowed|AbortError|media/i.test(String(e.reason))) return; errLog('promise', e.reason); });
function saveLog() {
  let l = []; try { l = JSON.parse(localStorage.getItem('irts-log') || '[]'); } catch (x) { /* storage unavailable */ }
  const out = JSON.stringify({ errors: l, speed: Prof.report() });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/json' })); a.download = 'commander-log.json'; a.click();
  toast(tr('logSaved'), innerWidth / 2, 80, 4000);
}
// ---- the end of a game: the camera goes to where it was decided (the HQ that fell, else the beaten side), blasts
// there if it's the enemy's, the word over the map; then, in the full game, the victory / defeat video if there is
// one (a tap skips); then the end card ----
let outro = null; const OUTRO_MS = 3200;
function startOutro() {
  const win = s.over === 'blue', loser = win ? 'red' : 'blue';
  const h = s.hqDownAt || s.nodes.find(n => n.side === loser && n.kind === 'hq' && n.hp > 0);
  const us = s.units.filter(u => u.side === loser);
  const at = h ? { x: h.x, y: h.y } : us.length ? { x: us.reduce((a, u) => a + u.x, 0) / us.length, y: us.reduce((a, u) => a + u.y, 0) / us.length } : { x: s.W / 2, y: s.H / 2 };
  outro = { t0: performance.now(), at, win, from: { x: cam.x, y: cam.y, z: cam.z }, boom: 0 };
  hideTip(); $('buildm').hidden = true; closeMenu(false); hqArmed = fhqArmed = eyeArmed = frontArmed = false; buildArmed = null; syncButtons();
}
function outroTick(now, dt) {
  const o = outro, k = Math.min(1, (now - o.t0) / 1400), e = k * k * (3 - 2 * k);
  // (the camera: over there, a little closer)
  cam.x = o.from.x + (o.at.x - o.from.x) * e; cam.y = o.from.y + (o.at.y - o.from.y) * e; cam.z = o.from.z * (1 + 0.25 * e); applyView();
  // (the picture goes on a little: blasts fade, smoke drifts; a string of blasts where the HQ fell)
  s.t += dt * 0.5; for (const f of s.fx) if (f.wait > 0) f.wait -= dt; else f.life -= dt * 0.6; s.fx = s.fx.filter(f => f.life > 0);
  if (now - o.t0 < 2200 && now - o.boom > 260) {
    o.boom = now; const r = 30 * Math.random(), a = Math.random() * 6.28;
    s.fx.push({ x: o.at.x + Math.cos(a) * r, y: o.at.y + Math.sin(a) * r, life: 0.9, max: 0.9, size: 26 + Math.random() * 14, heard: false });
  }
  if (now - o.t0 >= OUTRO_MS) endOutro();
}
function drawOutro(now) {
  const o = outro, k = Math.min(1, Math.max(0, (now - o.t0 - 700) / 900)), c = ctx;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgba(0,0,0,${0.35 * k})`; c.fillRect(0, 0, cv.width, cv.height);
  const px = Math.min(cv.width / 7, cv.height / 4.5), y = cv.height * 0.44;
  c.globalAlpha = k; c.textAlign = 'center'; c.font = `900 ${Math.round(px)}px Rubik, sans-serif`;
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = px * 0.25;
  c.fillStyle = o.win ? '#e3c77f' : '#ff6b5b'; c.fillText(tr(o.win ? 'victory' : 'defeat'), cv.width / 2, y + px * 0.35 * (1 - k * 0.2));
  c.restore();
}
// the video after the finale (the full game only, when it's there), else the end card at once
function endOutro() {
  outro = null;
  const src = !lvl && typeof MENU_ART === 'object' && MENU_ART[s.over === 'blue' ? 'win' : 'lose'];
  if (!src) { showEnd(); return; }
  const box = $('outro'), v = $('outroVid');
  box.hidden = false; v.src = src; v.currentTime = 0; Soundtrack.stop();
  // (the word over the video too: the picture alone doesn't say who won)
  const w = $('outroWord'); w.textContent = tr(s.over === 'blue' ? 'victory' : 'defeat'); w.className = s.over === 'blue' ? 'win' : 'lose';
  let over = false;
  const done = () => { if (over) return; over = true; clearTimeout(guard); v.onended = v.onerror = null; v.pause(); box.hidden = true; if (musicOn) Soundtrack.start(); showEnd(); };
  // (a video that won't start — not allowed, or a format this browser can't play — doesn't hold up the end card)
  const guard = setTimeout(() => { if (v.paused || v.readyState < 2) done(); }, 3000);
  v.onended = done; v.onerror = done; $('outroSkip').onclick = done; box.onclick = e => { if (e.target === v) done(); };
  v.play().catch(done);
}
// (a tap on the map during the finale: straight on)
cv.addEventListener('pointerdown', () => { if (outro) endOutro(); }, true);
const skipOutro = () => { if (outro) endOutro(); else if (!$('outro').hidden) $('outroSkip').click(); };
initBuildMenu(); newGame(); requestAnimationFrame(frame);
// installable as an app (full screen from the home screen); only over http(s), not from the disk
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
