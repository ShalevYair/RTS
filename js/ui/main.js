// UI: new game and the main loop
function newGame(skipIntro) {
  s = Sim.create((Date.now() % 1e6) | 0, worldWidth(), diff, win); s.fog = fog;
  decor = makeDecor(s.W); sel = 'blue0'; mode = 'hold'; playing = false; logKey = ''; endShown = false; eyeArmed = false; Radio.reset();
  $('end').hidden = true; $('share').textContent = 'שתף 🔗';
  document.querySelectorAll('.goal').forEach(g => g.textContent = '/' + s.WIN);
  resize(); syncButtons(); updateHud(); if (!skipIntro) showIntro(true);
}

const DT = 1 / 30; let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) { acc += dt * rate; while (acc >= DT) { Sim.step(s, DT); acc -= DT; } } else acc = 0;
  // one sound per new explosion (the audio side rate-limits bursts)
  for (const f of s.fx) if (!f.heard) { f.heard = true; if (sfxOn) Music.boom(f.size, f.x / s.W); }
  for (const k of s.marks) if (!k.heard) { k.heard = true; if (playing) Radio.hear(k); }
  Radio.tick();
  if (replayAuto && !$('end').hidden && !$('replayBox').hidden && now - replayAt > 180) {
    replayAt = now; const sc = $('scrub'), i = (+sc.value + 1) % (+sc.max + 1); sc.value = i; drawReplay(i);
  }
  draw();
  if (now - hudAt > 200) { hudAt = now; updateHud(); }
  requestAnimationFrame(frame);
}
initSquadButtons(); newGame(); requestAnimationFrame(frame);
