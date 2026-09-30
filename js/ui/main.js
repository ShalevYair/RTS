// UI: new game and the main loop
function newGame(skipIntro) {
  const seed = (Date.now() % 1e6) | 0;
  // big: 2× wide and 2× high, never narrower than 2000 (a phone held upright would get a thin strip)
  if (lvl) s = Sim.level(lvl, seed, worldWidth());
  else {
    const k = hugeMap ? 4 : 2; // big: 2× wide and high; huge: 4×
    s = bigMap ? Sim.create(seed, k * Math.max(1000, worldWidth()), diff, k * Sim.H) : Sim.create(seed, worldWidth(), diff); s.fog = fog;
    // the full game opens on an open field: each side picks where its HQ goes (tests may keep the fixed HQ)
    let fixed = false; try { fixed = localStorage.getItem('irts-fixedhq') === '1'; } catch (e) { /* storage unavailable */ }
    if (!fixed) Sim.openField(s);
  }
  // the big map opens zoomed in on our base; the small one shows it all
  cam = s.H > Sim.H ? { x: 0, y: s.H / 2, z: -1 } : { x: s.W / 2, y: s.H / 2, z: 1 };
  // in the tutorial a tap on the map attacks (hold / retreat come later)
  decor = makeDecor(s); sel = 'all'; selNode = null; pings = []; nodeHp.clear(); can.fhq = can.drone = true; mode = 'attack'; playing = false; logKey = ''; endShown = false; eyeArmed = false; buildArmed = null; hqArmed = !!(s.hqPending && s.hqPending.blue); hqTold = false; sqKey = ''; groups = []; Radio.reset();
  $('buildm').hidden = true; if (tour) { tour = null; $('tourBg').hidden = true; } hideTip();
  $('end').hidden = true; $('share').textContent = tr('share'); outro = null; $('outro').hidden = true; try { $('outroVid').pause(); } catch (e) { /* no video */ }
  applyUi(); resize(); syncButtons(); updateHud(); if (!skipIntro) showIntro(true);
}

const DT = 1 / 30; let last = performance.now(), acc = 0, shake = 0;
const SHAKE_MAX = 8, reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) { acc += dt * rate; while (acc >= DT) { Sim.step(s, DT); acc -= DT; } } else acc = 0;
  // one sound per new explosion (the audio side rate-limits bursts)
  const vr = viewRect(), onScreen = p => vr && p.x > vr.x - 60 && p.x < vr.x + vr.w + 60 && p.y > vr.y - 60 && p.y < vr.y + vr.h + 60;
  for (const f of s.fx) if (!f.heard && !(f.wait > 0)) {
    f.heard = true; if (sfxOn) Music.boom(f.size, f.x / s.W);
    if (f.size >= 26 && onScreen(f)) shake = Math.min(SHAKE_MAX, shake + (f.size >= 34 ? 6 : 2.5)); // a unit / building destroyed
  }
  // gunfire on screen: a crack for bullets, a thump for shells, a whoosh for missiles (the audio side limits bursts)
  for (const sh of s.shots) if (!sh.heard) { sh.heard = true; if (sfxOn && onScreen({ x: sh.x1, y: sh.y1 })) Music.shot(sh.kind, sh.x1 / s.W); }
  shake *= Math.exp(-dt * 9); if (shake < 0.2) shake = 0;
  cv.style.transform = shake && !reduceMotion ? `translate(${((Math.random() - 0.5) * 2 * shake).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * shake).toFixed(1)}px)` : '';
  for (const k of s.marks) if (!k.heard) {
    k.heard = true; if (!playing) continue;
    // the order reaching the squad: its reply (attacking, on the way…), as it was given
    Radio.hear(k.kind === 'ack' ? { kind: orderSay[k.id] || replyOf(k.type), id: k.id } : k);
  }
  // our buildings under fire: a call when one loses health — the HQ, a forward HQ, any other (the fake HQ is meant to be
  // hit)
  for (const n of s.nodes) {
    if (n.side !== 'blue' || n.kind === 'drone' || n.kind === 'decoy') continue;
    const was = nodeHp.get(n.id); nodeHp.set(n.id, n.hp);
    if (!playing || was === undefined || n.hp >= was - 0.5 || n.hp <= 0) continue;
    Radio.hear({ kind: n.kind === 'hq' ? 'hqHit' : n.kind === 'fhq' ? 'fhqHit' : 'baseHit', x: n.x, y: n.y, t: s.t }); // (the radio keeps quiet while the same place keeps being hit)
  }
  // a forward HQ that can be set up now, a drone to fly now: said once when it becomes so, a note by its button
  if (playing && !s.over) {
    const fc = uiHas('fhq') && s.cd.blue.fhq <= 0 && Sim.fhqCount(s, 'blue') < Sim.fhqMax(s) && fhqCrews().length > 0, dc = uiHas('eye') && s.fog && s.drones.blue.stock > 0;
    if (fc && !can.fhq && s.t > 3) { Radio.hear({ kind: 'fhqCan' }); noteBy('fhq', tr('fhqCan')); }
    if (dc && !can.drone && s.t > 3) { Radio.hear({ kind: 'droneCan' }); noteBy('eye', tr('droneCan')); }
    can.fhq = fc; can.drone = dc;
  }
  Radio.tick();
  if (replayAuto && !$('end').hidden && !$('replayBox').hidden && now - replayAt > 180) {
    replayAt = now; const sc = $('scrub'), i = (+sc.value + 1) % (+sc.max + 1); sc.value = i; drawReplay(i);
  }
  if (outro) outroTick(now, dt); else edgeScroll(dt);
  draw(); if (outro) drawOutro(now); drawBox(); drawMini();
  if (now - hudAt > 200) { hudAt = now; updateHud(); }
  requestAnimationFrame(frame);
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
  hideTip(); $('buildm').hidden = true; closeMenu(false); hqArmed = fhqArmed = eyeArmed = false; buildArmed = null; syncButtons();
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
