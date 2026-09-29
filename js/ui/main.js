// UI: new game and the main loop
function newGame(skipIntro) {
  const seed = (Date.now() % 1e6) | 0;
  // big: 2× wide and 2× high, never narrower than 2000 (a phone held upright would get a thin strip)
  if (lvl) s = Sim.level(lvl, seed, worldWidth());
  else { s = bigMap ? Sim.create(seed, 2 * Math.max(1000, worldWidth()), diff, 2 * Sim.H) : Sim.create(seed, worldWidth(), diff); s.fog = fog; }
  // the big map opens zoomed in on our base; the small one shows it all
  cam = s.H > Sim.H ? { x: 0, y: s.H / 2, z: -1 } : { x: s.W / 2, y: s.H / 2, z: 1 };
  // in the tutorial a tap on the map attacks (hold / retreat come later)
  decor = makeDecor(s); sel = 'all'; mode = 'attack'; playing = false; logKey = ''; endShown = false; eyeArmed = false; buildArmed = null; sqKey = ''; groups = []; Radio.reset();
  $('buildm').hidden = true; if (tour) { tour = null; $('tourBg').hidden = true; } hideTip();
  $('end').hidden = true; $('share').textContent = tr('share');
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
  for (const k of s.marks) if (!k.heard) { k.heard = true; if (playing) Radio.hear(k); }
  Radio.tick();
  if (replayAuto && !$('end').hidden && !$('replayBox').hidden && now - replayAt > 180) {
    replayAt = now; const sc = $('scrub'), i = (+sc.value + 1) % (+sc.max + 1); sc.value = i; drawReplay(i);
  }
  edgeScroll(dt); draw(); drawBox(); drawMini();
  if (now - hudAt > 200) { hudAt = now; updateHud(); }
  requestAnimationFrame(frame);
}
initBuildMenu(); newGame(); requestAnimationFrame(frame);
// installable as an app (full screen from the home screen); only over http(s), not from the disk
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
