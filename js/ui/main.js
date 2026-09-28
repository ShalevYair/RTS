// UI: new game and the main loop
function newGame(skipIntro) {
  const seed = (Date.now() % 1e6) | 0;
  // big: 2× wide and 2× high, never narrower than 2000 (a phone held upright would get a thin strip)
  if (lvl) s = Sim.level(lvl, seed, worldWidth());
  else { s = bigMap ? Sim.create(seed, 2 * Math.max(1000, worldWidth()), diff, 2 * Sim.H) : Sim.create(seed, worldWidth(), diff); s.fog = fog; }
  // the big map opens zoomed in on our base; the small one shows it all
  cam = s.H > Sim.H ? { x: 0, y: s.H / 2, z: -1 } : { x: s.W / 2, y: s.H / 2, z: 1 };
  // in the tutorial a tap on the map attacks (hold / retreat come later)
  decor = makeDecor(s); sel = 'all'; mode = lvl ? 'attack' : 'hold'; playing = false; logKey = ''; endShown = false; eyeArmed = false; buildArmed = null; sqKey = ''; Radio.reset();
  $('buildm').hidden = true;
  $('end').hidden = true; $('share').textContent = 'שתף 🔗';
  applyUi(); resize(); syncButtons(); updateHud(); if (!skipIntro) showIntro(true);
}

const DT = 1 / 30; let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) { acc += dt * rate; while (acc >= DT) { Sim.step(s, DT); acc -= DT; } } else acc = 0;
  // one sound per new explosion (the audio side rate-limits bursts)
  for (const f of s.fx) if (!f.heard && !(f.wait > 0)) { f.heard = true; if (sfxOn) Music.boom(f.size, f.x / s.W); }
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
