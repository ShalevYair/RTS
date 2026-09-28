// UI: music and explosion sounds (Web Audio, no files) and radio voice reports (Web Speech)
// ---- music: Web Audio, no files. Five pieces; each plays through once, then another is picked at random ----
// A piece is a list of sections (chords per bar + how bass, drums, pad, arpeggio, brass stabs and melody play).
// The first is the original theme (hand-written melodies); the others get melodies generated from their chords.
const Music = (() => {
  const T = '~', _ = null;
  // chord names -> [root MIDI note in 48..59, major?]; 'm' = minor
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const chordOf = name => { let pc = PC[name[0]], i = 1; if (name[1] === '#') { pc++; i++; } else if (name[1] === 'b') { pc--; i++; } return [48 + ((pc + 12) % 12), name.slice(i) !== 'm']; };
  const tones = ch => { const [r, maj] = chordOf(ch); return [r, r + (maj ? 4 : 3), r + 7]; };
  // melody generator (seeded): rhythm cells in eighths (x note, - hold, . rest), pitches walk over chord tones;
  // the second half of a section repeats the first half's rhythm, and the last bar lands on the root
  const RHY = { fast: ['x-xxx-x-', 'x-x-xxx-', 'xxx-x-x-', 'x---x-xx'], mid: ['x-x-x---', 'x---x-x-', 'x--xx---', 'x-x-x-x-'], slow: ['x-------', 'x---x---', 'x-----x-', 'x---x-x-'] };
  function gen(seed, chords, feel, lo = 62) {
    let a = seed * 9301 + 49297; const r = () => (a = (a * 9301 + 49297) % 233280) / 233280;
    const half = Math.ceil(chords.length / 2), cells = [];
    for (let b = 0; b < half; b++) cells.push(RHY[feel][Math.floor(r() * RHY[feel].length)]);
    let cur = lo + 7;
    return chords.map((ch, b) => {
      const cell = b === chords.length - 1 ? 'x---x---' : cells[b % half], tn = tones(ch);
      const pool = [...tn.map(n => n + 12), ...tn.map(n => n + 24)].filter(n => n >= lo && n <= lo + 19).sort((x, y) => x - y);
      return [...cell].map((c, e) => {
        if (c === '-') return T;
        if (c === '.') return _;
        if (b === chords.length - 1 && e === 4) return pool.find(n => n % 12 === tn[0] % 12) || pool[0];
        let i = pool.reduce((bi, n, k) => Math.abs(n - cur) < Math.abs(pool[bi] - cur) ? k : bi, 0);
        i = Math.max(0, Math.min(pool.length - 1, i + Math.floor(r() * 5) - 2)); cur = pool[i]; return cur;
      });
    });
  }
  const A_CH = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], B_CH = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'], C_CH = ['Dm', 'Am', 'Dm', 'Am', 'F', 'G', 'E', 'E'];
  // melodies in eighth notes; T extends the previous note, _ is a rest
  const A_MEL = [[69, T, 72, 76, T, 74, 72, 71], [72, T, 69, T, 65, T, 69, 72], [67, T, 72, T, 76, 79, 76, 74], [74, T, T, T, 71, T, 67, T],
                 [69, T, 72, 76, T, 81, 79, 76], [77, T, 76, 74, 72, T, 69, T], [71, 72, 74, T, 79, T, 74, T], [76, T, T, T, 68, T, 71, T]];
  const B_MEL = [[_, 77, T, 76, 77, T, 81, T], [79, T, 74, T, 71, T, 74, T], [_, 76, T, 74, 76, T, 79, T], [81, T, T, T, 76, T, _, _],
                 [_, 74, T, 77, 81, T, 77, 74], [79, T, 77, T, 74, T, 71, T], [72, T, 76, T, 79, T, 84, T], [83, T, T, T, 80, T, 76, T]];
  const C_MEL = [[74, T, T, T, T, T, T, T], [72, T, T, T, 76, T, T, T], [77, T, T, T, T, T, 76, 74], [76, T, T, T, T, T, T, T],
                 [77, T, 76, T, 77, T, 81, T], [79, T, 77, T, 79, T, 83, T], [80, T, T, T, 83, T, T, T], [88, T, T, T, _, _, _, _]];
  const sec = (chords, o) => ({ chords, ...o });
  const OST1 = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], OST2 = ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'A'];
  const ASH1 = ['Em', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B'], ASH2 = ['Am', 'Em', 'C', 'B', 'Am', 'Em', 'B', 'B'];
  const CHG1 = ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G'], CHG2 = ['Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G', 'Cm', 'G'];
  const EPC1 = ['Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Am'], EPC2 = ['F', 'G', 'Em', 'Am', 'Dm', 'E', 'Am', 'E'];
  const SONGS = [
    { name: 'theme', bpm: 112, lead: 'square', sections: [
      sec(['Am', 'Am', 'F', 'E'], { drums: 'intro', bass: 'pulse', arpFrom: 2 }),
      sec(A_CH, { mel: A_MEL, drums: 'march', bass: 'drive' }),
      sec(B_CH, { mel: B_MEL, drums: 'drive', bass: 'drive', pad: true, arpFrom: 0 }),
      sec(A_CH, { mel: A_MEL, harm: true, drums: 'march', bass: 'drive', pad: true }),
      sec(C_CH, { mel: C_MEL, drums: 'half', bass: 'long', pad: true, arpFrom: 4 }) ] },
    { name: 'iron line', bpm: 128, lead: 'brass', sections: [
      sec(['Dm', 'Dm', 'Bb', 'A'], { drums: 'taiko', bass: 'ost16' }),
      sec(OST1, { mel: gen(3, OST1, 'mid'), drums: 'taiko', bass: 'ost16', stab: true }),
      sec(OST2, { mel: gen(5, OST2, 'fast'), drums: 'drive', bass: 'ost16', pad: true, stab: true }),
      sec(OST1, { mel: gen(3, OST1, 'mid'), harm: true, drums: 'taiko', bass: 'ost16', pad: true, arpFrom: 0 }) ] },
    { name: 'ashes', bpm: 76, lead: 'bell', sections: [
      sec(['Em', 'Em', 'C', 'B'], { drums: 'heart', bass: 'drone', pad: true }),
      sec(ASH1, { mel: gen(7, ASH1, 'slow', 64), drums: 'heart', bass: 'drone', pad: true }),
      sec(ASH2, { mel: gen(11, ASH2, 'mid', 64), drums: 'half', bass: 'long', pad: true, arpFrom: 0 }),
      sec(ASH1, { mel: gen(7, ASH1, 'slow', 64), harm: true, drums: 'taiko', bass: 'drone', pad: true }) ] },
    { name: 'breakthrough', bpm: 144, lead: 'square', sections: [
      sec(['Cm', 'Cm', 'Ab', 'G'], { drums: 'roll', bass: 'pulse' }),
      sec(CHG1, { mel: gen(13, CHG1, 'fast'), drums: 'march', bass: 'drive', stab: true }),
      sec(CHG2, { mel: gen(17, CHG2, 'fast'), harm: true, drums: 'drive', bass: 'ost16', pad: true }),
      sec(CHG1, { mel: gen(13, CHG1, 'fast'), drums: 'march', bass: 'drive', pad: true, arpFrom: 0, stab: true }) ] },
    { name: 'last stand', bpm: 96, lead: 'brass', sections: [
      sec(['Am', 'Am', 'F', 'E'], { drums: 'taiko', bass: 'drone', pad: true }),
      sec(EPC1, { mel: gen(19, EPC1, 'slow'), drums: 'taiko', bass: 'long', pad: true, choir: true }),
      sec(EPC2, { mel: gen(23, EPC2, 'mid'), drums: 'drive', bass: 'ost16', pad: true, arpFrom: 0, stab: true }),
      sec(EPC1, { mel: gen(19, EPC1, 'slow'), harm: true, drums: 'taiko', bass: 'long', pad: true, choir: true, stab: true }) ] },
  ];
  for (const S of SONGS) { S.bars = []; for (const q of S.sections) q.chords.forEach((ch, b) => S.bars.push({ sec: q, b, ch, first: b === 0, last: b === q.chords.length - 1 })); }
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  let ac = null, master = null, leadBus = null, lowBus = null, delay = null, noise = null, timer = null, step = 0, nextT = 0, vol = 0.1;
  let song = SONGS[0], S16 = 60 / song.bpm / 4, started = false;
  // the next piece: any but the one just played (or piece i)
  function nextSong(i) {
    const k = i ?? (SONGS.indexOf(song) + 1 + Math.floor(Math.random() * (SONGS.length - 1))) % SONGS.length;
    song = SONGS[k]; S16 = 60 / song.bpm / 4; step = 0;
    if (delay) delay.delayTime.setValueAtTime(S16 * 3, ac.currentTime);
  }

  function osc(type, n, t, dur, g, dest, { a = 0.01, rel = 0.06, detune = 0, vib = 0 } = {}) {
    const o = ac.createOscillator(), e = ac.createGain();
    o.type = type; o.frequency.value = mtof(n); o.detune.value = detune;
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg).connect(o.detune); l.start(t); l.stop(t + dur + rel + 0.1);
    }
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a);
    e.gain.setTargetAtTime(g * 0.6, t + a, Math.max(0.02, dur / 3));
    e.gain.setTargetAtTime(0.0001, t + dur, rel / 3 + 0.005);
    o.connect(e).connect(dest || master); o.start(t); o.stop(t + dur + rel + 0.1);
  }
  function noiseHit(t, dur, g, type, freq) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq;
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(e).connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  function drumTone(t, f0, f1, dur, g) {
    const o = ac.createOscillator(), e = ac.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    o.connect(e).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const kick = (t, g = 0.55) => drumTone(t, 150, 40, 0.16, g);
  const tom = (t, f, g = 0.3) => drumTone(t, f, f * 0.55, 0.18, g);
  const taiko = (t, f, g) => { drumTone(t, f, f * 0.5, 0.5, g); noiseHit(t, 0.08, g * 0.25, 'lowpass', 600); };
  const snare = (t, g) => { noiseHit(t, 0.13, g, 'highpass', 1400); drumTone(t, 220, 160, 0.06, g * 0.8); };
  const hat = (t, g) => noiseHit(t, 0.035, g, 'highpass', 7500);
  const openHat = t => noiseHit(t, 0.16, 0.035, 'highpass', 6500);
  const crash = t => noiseHit(t, 1.3, 0.09, 'highpass', 4200);

  function drums(kind, B, i, t) {
    if (B.first && i === 0 && kind !== 'intro' && kind !== 'heart' && kind !== 'roll') crash(t);
    if (kind === 'intro') {
      if (i === 0 || i === 8) kick(t);
      if (B.b >= 1 && i % 2 === 0) hat(t, 0.04);
      if (B.last && i >= 12) snare(t, 0.07 + (i - 12) * 0.03);
      return;
    }
    // heartbeat: a soft double thump
    if (kind === 'heart') { if (i === 0) kick(t, 0.45); if (i === 3) kick(t, 0.28); if (B.last && i >= 12) tom(t, 120, 0.18); return; }
    // snare roll building through the section
    if (kind === 'roll') { if (i === 0) kick(t); snare(t, 0.03 + (B.b * 16 + i) * 0.0025); return; }
    // big low drums
    if (kind === 'taiko') {
      if (i === 0) { taiko(t, 70, 0.6); kick(t); }
      if (i === 6 || i === 10) taiko(t, 95, 0.35);
      if (i === 8) taiko(t, 70, 0.5);
      if (i === 12) { taiko(t, 120, 0.4); taiko(t, 60, 0.3); }
      if (i === 14 && B.last) taiko(t, 140, 0.4);
      if (i % 4 === 2) hat(t, 0.02);
      return;
    }
    if (kind === 'half') {
      if (i === 0) kick(t);
      if (B.b < 6) { if (i === 8) snare(t, 0.16); if (i % 4 === 0) hat(t, 0.035); }
      else if (B.b === 6) { if (i % 2 === 0) snare(t, 0.06 + i * 0.006); }
      else snare(t, 0.05 + i * 0.01);
      return;
    }
    if (B.last && i >= 12) { if (i === 12) kick(t); tom(t, 230 - (i - 12) * 35); return; }
    if (kind === 'march') {
      if (i === 0 || i === 6 || i === 8) kick(t);
      if (i === 4 || i === 12) snare(t, 0.16);
      if (i % 2 === 0) hat(t, 0.04);
    } else {
      if (i % 4 === 0) kick(t);
      if (i === 4 || i === 12) snare(t, 0.17);
      if (i % 4 === 2) openHat(t); else hat(t, 0.03);
    }
  }

  const OST = [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 0, 10, 12];
  function playStep(B, i, t) {
    const sec = B.sec, tn = tones(B.ch), root = tn[0];
    if (sec.bass === 'pulse') { if (i % 4 === 0) osc('triangle', root - 12, t, S16 * 3, 0.32); }
    else if (sec.bass === 'drive') { if (i % 2 === 0) osc('triangle', root - 12 + [0, 0, 12, 0, 7, 0, 12, 7][i / 2], t, S16 * 1.8, 0.3); }
    // string ostinato: sixteenths on the root, fifth and octave, darkened
    else if (sec.bass === 'ost16') { osc('sawtooth', root - 12 + OST[i], t, S16 * 0.8, 0.07, lowBus); if (i % 4 === 0) osc('triangle', root - 12, t, S16 * 3, 0.22); }
    // a low drone under the whole bar
    else if (sec.bass === 'drone') { if (i === 0) { osc('sawtooth', root - 24, t, S16 * 15.5, 0.06, lowBus, { a: 0.4, rel: 0.4 }); osc('triangle', root - 12, t, S16 * 15, 0.22, null, { a: 0.2 }); } }
    else if (B.b >= 6) osc('triangle', root - 12, t, S16 * 0.9, 0.26);
    else if (i === 0) osc('triangle', root - 12, t, S16 * 11, 0.32);
    else if (i === 12) osc('triangle', root, t, S16 * 3.5, 0.24);
    if (sec.pad && i === 0) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1000; f.connect(master);
      for (const n of tn) for (const d of [-7, 7]) osc('sawtooth', n + 12, t, S16 * 15, 0.016, f, { a: 0.25, rel: 0.3, detune: d });
    }
    // "choir": slow and wide, two octaves up
    if (sec.choir && i === 0) for (const n of tn) for (const d of [-12, 0, 12]) osc('sine', n + 24, t, S16 * 15, 0.012, null, { a: 0.6, rel: 0.6, detune: d });
    // brass stabs on the downbeat and the "and" of three
    if (sec.stab && (i === 0 || i === 10)) for (const n of tn) osc('sawtooth', n + 12, t, S16 * 1.6, 0.045, lowBus, { a: 0.02, rel: 0.12 });
    if (sec.arpFrom !== undefined && B.b >= sec.arpFrom) {
      const pat = [0, 1, 2, 3, 2, 1, 0, 1], chord = [...tn, tn[0] + 12];
      osc('triangle', chord[pat[i % 8]] + 12, t, S16 * 0.8, 0.035, leadBus);
    }
    if (sec.mel && i % 2 === 0) {
      const bar = sec.mel[B.b], e = i / 2, n = bar && bar[e];
      if (typeof n === 'number') {
        let len = 1; while (e + len < 8 && bar[e + len] === T) len++;
        const dur = len * 2 * S16 * 0.95;
        if (song.lead === 'bell') { osc('triangle', n + 12, t, Math.min(dur, S16 * 6), 0.06, leadBus, { rel: 0.8 }); osc('sine', n + 24, t, S16 * 2, 0.02, leadBus, { rel: 0.5 }); }
        else if (song.lead === 'brass') osc('sawtooth', n, t, dur, 0.05, lowBus, { a: 0.05, vib: 8 });
        else osc('square', n, t, dur, 0.05, leadBus, { vib: 10 });
        if (sec.harm) osc('triangle', n - 12, t, dur, 0.06);
      }
    }
    drums(sec.drums, B, i, t);
  }
  function schedule() {
    while (nextT < ac.currentTime + 0.25) {
      if (Math.floor(step / 16) >= song.bars.length) nextSong();
      playStep(song.bars[Math.floor(step / 16)], step % 16, nextT); nextT += S16; step++;
    }
  }
  let sfxBus = null, sfxVol = 0.4, voices = 0;
  const lastBoom = { s: -1, m: -1, b: -1 };
  // audio graph is created on the first user gesture and shared by music and sound effects
  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC(); graph();
    return true;
  }
  // the buses on the current context (also used to render a piece offline)
  function graph() {
    master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(ac.destination);
    // lead/arp bus with a dotted-eighth echo for space
    leadBus = ac.createGain(); leadBus.connect(master);
    // darker voices (strings, brass): a shared low-pass
    lowBus = ac.createBiquadFilter(); lowBus.type = 'lowpass'; lowBus.frequency.value = 1400; lowBus.Q.value = 0.7; lowBus.connect(master);
    delay = ac.createDelay(1); const fb = ac.createGain(), wet = ac.createGain();
    delay.delayTime.value = S16 * 3; fb.gain.value = 0.3; wet.gain.value = 0.22;
    leadBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() { if (ensure() && ac.state === 'suspended') ac.resume().catch(() => {}); }
  function start() {
    if (!ensure()) return false;
    unlock();
    // the first piece is picked at random too
    if (!timer) { if (!started) { started = true; nextSong(Math.floor(Math.random() * SONGS.length)); } nextT = ac.currentTime + 0.05; timer = setInterval(schedule, 60); }
    return true;
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function setVolume(v) { vol = v; if (master) master.gain.setTargetAtTime(v, ac.currentTime, 0.05); }
  function setSfxVolume(v) { sfxVol = v; if (sfxBus) sfxBus.gain.setTargetAtTime(v, ac.currentTime, 0.05); }

  // explosion: filtered noise burst + low "thump", panned by map position.
  // size follows the visual: 26 unit destroyed, 18 tank/air hit, 10 AA hit, 4 infantry hit.
  const BOOM = {
    d: { dur: 0.9, f0: 900, f1: 110, th: [60, 28], tg: 0.6, ng: 0.55 },
    b: { dur: 0.5, f0: 1300, f1: 180, th: [85, 35], tg: 0.45, ng: 0.45 },
    m: { dur: 0.22, f0: 2200, f1: 500, th: [150, 70], tg: 0.18, ng: 0.25 },
    s: { dur: 0.06, f0: 4000, f1: 2500, th: null, tg: 0, ng: 0.09 },
  };
  const MIN_GAP = { s: 0.045, m: 0.07, b: 0.09 }, MAX_VOICES = 20;
  function boom(size, xFrac) {
    if (!ac || ac.state !== 'running' || sfxVol <= 0) return;
    const t = ac.currentTime, cls = size >= 18 ? 'b' : size >= 10 ? 'm' : 's';
    if (t - lastBoom[cls] < MIN_GAP[cls] || voices >= MAX_VOICES) return; // avoid a wall of noise in big fights
    lastBoom[cls] = t;
    const P = size >= 26 ? BOOM.d : BOOM[cls], j = 0.9 + Math.random() * 0.2;
    let out = sfxBus;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, ((Number(xFrac) || 0.5) * 2 - 1) * 0.7));
      pan.connect(sfxBus); out = pan;
    }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain();
    src.buffer = noise; src.playbackRate.value = j;
    f.type = 'lowpass'; f.frequency.setValueAtTime(P.f0 * j, t); f.frequency.exponentialRampToValueAtTime(P.f1, t + P.dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(P.ng, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, t + P.dur);
    src.connect(f).connect(e).connect(out);
    voices++; src.onended = () => { voices--; };
    src.start(t, Math.random() * 0.5); src.stop(t + P.dur + 0.05);
    if (P.th) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(P.th[0] * j, t); o.frequency.exponentialRampToValueAtTime(P.th[1], t + P.dur * 0.6);
      g.gain.setValueAtTime(P.tg, t); g.gain.exponentialRampToValueAtTime(0.0001, t + P.dur * 0.7);
      o.connect(g).connect(out); o.start(t); o.stop(t + P.dur);
    }
  }
  // radio "click" before a voice report: a short band-passed noise burst on the effects bus
  function squelch() {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain();
    src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.5;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.25, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(f).connect(e).connect(sfxBus); src.start(t, Math.random()); src.stop(t + 0.2);
  }
  // for the tests: schedule every step of every piece (a second ahead, then stopped by the test) and count bars per piece
  function playAll() {
    if (!ensure()) return null;
    const out = {}, keep = SONGS.indexOf(song), t0 = ac.currentTime + 1;
    for (let k = 0; k < SONGS.length; k++) {
      nextSong(k); let n = 0;
      for (const B of song.bars) for (let i = 0; i < 16; i++) { playStep(B, i, t0 + n * 0.001); n++; }
      out[song.name] = song.bars.length;
    }
    nextSong(keep);
    return out;
  }
  // for listening outside the game: the first `sec` seconds of piece k, rendered offline, as mono samples
  async function render(k, sec, rate = 22050) {
    const keep = { ac, master, sfxBus, leadBus, lowBus, delay, noise, song: SONGS.indexOf(song) };
    ac = new OfflineAudioContext(1, Math.floor(rate * sec), rate); graph(); master.gain.value = 0.35;
    nextSong(k);
    for (let t = 0.05; t < sec; t += S16) { if (Math.floor(step / 16) >= song.bars.length) step = 0; playStep(song.bars[Math.floor(step / 16)], step % 16, t); step++; }
    const buf = await ac.startRendering();
    ({ ac, master, sfxBus, leadBus, lowBus, delay, noise } = keep); nextSong(keep.song);
    return { name: SONGS[k].name, rate, data: Array.from(buf.getChannelData(0), v => Math.max(-32768, Math.min(32767, Math.round(v * 32767)))) };
  }
  return { start, stop, unlock, setVolume, setSfxVolume, boom, squelch, _debug: { render, playAll, tones, song: () => song.name, next: () => { nextSong(); return song.name; }, voices: () => voices } };
})();
let musicOn = true, vol = 35, sfxOn = true, sfxVol = 60;
try { const m = JSON.parse(localStorage.getItem('irts-audio') || 'null'); if (m) { musicOn = !!m.on; vol = Math.max(0, Math.min(100, +m.vol || 0)); if ('sfxOn' in m) { sfxOn = !!m.sfxOn; sfxVol = Math.max(0, Math.min(100, +m.sfxVol || 0)); } } } catch (e) { /* storage unavailable */ }
const volEl = $('vol'), musBtn = $('music');
volEl.value = vol;
const saveAudio = () => { try { localStorage.setItem('irts-audio', JSON.stringify({ on: musicOn, vol, sfxOn, sfxVol })); } catch (e) { /* ignore */ } };
function syncMusic(play) {
  musBtn.setAttribute('aria-pressed', String(musicOn));
  Music.setVolume(Math.pow(vol / 100, 2) * 0.6);
  if (!musicOn || vol === 0) Music.stop(); else if (play) Music.start();
}
const sfxBtn = $('sfx'), sfxEl = $('sfxvol');
sfxEl.value = sfxVol;
function syncSfx() { sfxBtn.setAttribute('aria-pressed', String(sfxOn)); Music.setSfxVolume(sfxOn ? Math.pow(sfxVol / 100, 2) * 0.8 : 0); }
sfxBtn.addEventListener('click', () => { sfxOn = !sfxOn; saveAudio(); syncSfx(); });
sfxEl.addEventListener('input', () => { sfxVol = +sfxEl.value; saveAudio(); syncSfx(); });
syncSfx();
musBtn.addEventListener('click', () => { musicOn = !musicOn; saveAudio(); syncMusic(true); });
volEl.addEventListener('input', () => { vol = +volEl.value; saveAudio(); syncMusic(true); });
// browsers only allow audio after a user gesture
for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, () => { Music.unlock(); if (musicOn && vol > 0) Music.start(); });
syncMusic(false);

// ---- radio: event reports read aloud (Web Speech), most urgent first, never a backlog ----
const Radio = (() => {
  const synth = window.speechSynthesis, SAY = { 'חי"ר': 'חיל רגלים', 'נ"מ': 'נגד מטוסים', 'מכ"ם': 'מכם' };
  const PRI = { lost: 3, hit: 3, flagLost: 3, call: 3, nodeLost: 3, ff: 3, contact: 2, flag: 2, fhq: 1, ok: 1 };
  const TEXT = { fhq: w => `${w}, מקימים פיקוד קדמי`, nodeLost: w => w === 'drone' ? 'הרחפן הופל' : `${Sim.STRUCTS[w].name} הושמד`, call: w => `${w}, לחץ כבד. להחזיק או לסגת?`, contact: w => `${w}, מגע`, hit: w => `${w}, אבדות כבדות, נסוגים`, lost: w => `${w}, הכוח הושמד`, ff: w => `${w}, ירי על כוחותינו!`,
    ok: w => `${w}, הגענו`, flag: w => `כבשנו את ${w}`, flagLost: w => `איבדנו את ${w}` };
  let on = true, voice = null, pending = null;
  const pickVoice = () => { try { voice = synth.getVoices().find(v => /^he/i.test(v.lang)) || null; } catch (e) { voice = null; } };
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { /* old browsers */ } }
  function hear(k) {
    if (!on || !TEXT[k.kind]) return;
    if (!pending || PRI[k.kind] >= pending.pri) pending = { pri: PRI[k.kind], text: TEXT[k.kind](SAY[k.who] || k.who || ''), at: performance.now() };
  }
  // called every frame: say the pending report when the channel is free; stale ones are dropped
  function tick() {
    if (!pending || !on) return;
    if (performance.now() - pending.at > 4000) { pending = null; return; }
    if (synth && synth.speaking) return;
    Music.squelch();
    if (synth && voice) {
      const u = new SpeechSynthesisUtterance(pending.text); u.voice = voice; u.lang = voice.lang; u.rate = 1.15;
      try { synth.speak(u); } catch (e) { /* speech unavailable */ }
    }
    pending = null;
  }
  const reset = () => { pending = null; try { synth && synth.cancel(); } catch (e) { /* ignore */ } };
  return { hear, tick, reset, set: v => { on = v; if (!v) reset(); }, hasVoice: () => !!voice };
})();
let radioOn = true;
try { radioOn = localStorage.getItem('irts-radio') !== '0'; } catch (e) { /* storage unavailable */ }
function syncRadio() {
  Radio.set(radioOn); $('radio').setAttribute('aria-pressed', String(radioOn));
  $('radioNote').textContent = Radio.hasVoice() ? '' : 'אין קול עברי במכשיר, רק צליל קשר';
}
$('radio').addEventListener('click', () => { radioOn = !radioOn; try { localStorage.setItem('irts-radio', radioOn ? '1' : '0'); } catch (e) { /* ignore */ } syncRadio(); });
syncRadio(); try { speechSynthesis.addEventListener('voiceschanged', syncRadio); } catch (e) { /* no speech */ }
