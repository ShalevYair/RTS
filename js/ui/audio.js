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
  // a shot: bullets crack (high, short), shells thump (low), missiles whoosh (a rising hiss). Quieter than blasts.
  const SHOT = { inf: 'crack', jeep: 'crack', tank: 'thump', air: 'whoosh', aa: 'whoosh', at: 'whoosh', ajeep: 'whoosh', tjeep: 'whoosh' }, SHOT_GAP = { crack: 0.05, thump: 0.12, whoosh: 0.18 }, lastShot = {};
  function shot(kind, xFrac) {
    const cls = SHOT[kind];
    if (!cls || !ac || ac.state !== 'running' || sfxVol <= 0 || voices >= MAX_VOICES) return;
    const t = ac.currentTime; if (t - (lastShot[cls] || 0) < SHOT_GAP[cls]) return;
    lastShot[cls] = t;
    let out = sfxBus;
    if (ac.createStereoPanner) { const pan = ac.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, ((Number(xFrac) || 0.5) * 2 - 1) * 0.7)); pan.connect(sfxBus); out = pan; }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain(), j = 0.85 + Math.random() * 0.3;
    src.buffer = noise; voices++; src.onended = () => { voices--; };
    if (cls === 'crack') {
      f.type = 'highpass'; f.frequency.value = 2200 * j;
      e.gain.setValueAtTime(0.14, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f).connect(e).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + 0.07);
    } else if (cls === 'thump') {
      f.type = 'lowpass'; f.frequency.setValueAtTime(1400 * j, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.25);
      e.gain.setValueAtTime(0.3, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      src.connect(f).connect(e).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + 0.32);
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(110 * j, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g).connect(out); o.start(t); o.stop(t + 0.25);
    } else {
      f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(600 * j, t); f.frequency.exponentialRampToValueAtTime(3200 * j, t + 0.4);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.12, t + 0.08); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      src.connect(f).connect(e).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + 0.47);
    }
  }
  // an air-raid siren: rising and falling, SIREN_UPS times over SIREN_T s (a missile launched)
  const SIREN_T = 5, SIREN_UPS = 2; let sirenAt = -99;
  function siren() {
    if (!ac || ac.state !== 'running' || sfxVol <= 0) return;
    const t = ac.currentTime; if (t - sirenAt < SIREN_T) return; sirenAt = t;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 2200;
    const per = SIREN_T / SIREN_UPS;
    for (const [osc, k] of [[o, 1], [o2, 1.005]]) {
      osc.frequency.setValueAtTime(260 * k, t);
      for (let i = 0; i < SIREN_UPS; i++) { osc.frequency.linearRampToValueAtTime(820 * k, t + i * per + per * 0.55); osc.frequency.linearRampToValueAtTime(260 * k, t + (i + 1) * per); }
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.4); g.gain.setValueAtTime(0.09, t + SIREN_T - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + SIREN_T);
    o.connect(f); o2.connect(f); f.connect(g).connect(sfxBus); o.start(t); o2.start(t); o.stop(t + SIREN_T + 0.05); o2.stop(t + SIREN_T + 0.05);
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
  return { start, stop, unlock, setVolume, setSfxVolume, boom, shot, squelch, siren, _debug: { render, playAll, tones, song: () => song.name, next: () => { nextSong(); return song.name; }, voices: () => voices } };
})();
// ---- the soundtrack: recorded pieces (music/) — last stand on the main menu (at once, a quick fade in; tried as the page
// loads, else at the first tap); in the game calm pieces while it's quiet
// and battle pieces once there's fighting (setMood), in random order, one after another with a crossfade. Only ever
// one piece: a piece still starting when another takes over is stopped, not faded back in. If they can't be played,
// the generated music above instead ----
const Tracks = (() => {
  const MENU = 'music/last_stand.mp3', CALM = ['music/planning.mp3', 'music/ashes.mp3'], BATTLE = ['music/iron_line.mp3', 'music/breakthrough.mp3', 'music/last_stand.mp3'];
  const FADE = 3; // seconds
  let mode = 'menu', mood = 'calm', vol = 0.3, on = false, cur = null, last = '', failed = false;
  const all = new Set(); // (every piece made: whatever isn't cur is faded out and stopped)
  const fade = (a, to, sec, then) => {
    clearInterval(a.fadeT); const v0 = a.volume, t0 = performance.now();
    a.fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); a.volume = Math.max(0, Math.min(1, v0 + (to - v0) * k)); if (k >= 1) { clearInterval(a.fadeT); a.fadeT = 0; then && then(); } }, 50);
  };
  const quiet = a => fade(a, 0, a.volume > 0 ? FADE : 0.05, () => { a.pause(); all.delete(a); });
  const pick = () => { if (mode === 'menu') return MENU; const pool = (mood === 'battle' ? BATTLE : CALM).filter(f => f !== last); return (last = pool[Math.floor(Math.random() * pool.length)]); };
  function play(src) {
    const a = new Audio(src); cur = a; all.add(a); a.starting = true;
    a.volume = 0; a.loop = mode === 'menu';
    a.onerror = () => { all.delete(a); if (a === cur) { failed = true; cur = null; if (on) Music.start(); } };
    // (a few seconds before a piece ends, the next one fades in over it)
    a.ontimeupdate = () => { if (a === cur && !a.loop && on && a.duration && a.currentTime > a.duration - FADE) play(pick()); };
    a.play().then(() => { a.starting = false; if (a === cur && on) fade(a, vol, mode === 'menu' ? 0.3 : FADE); else quiet(a); })
      .catch(() => { a.starting = false; all.delete(a); if (a === cur) cur = null; }); // (not allowed before a tap: tried again then)
    for (const o of all) if (o !== a && !o.starting) quiet(o);
  }
  return {
    ok: () => !failed,
    start() { on = true; if (failed) return; if (!cur || (cur.paused && !cur.starting)) play(pick()); },
    stop() { on = false; cur = null; for (const a of all) if (!a.starting) quiet(a); },
    setVolume(v) { vol = Math.min(1, v); if (cur && !cur.fadeT && !cur.starting) cur.volume = vol; },
    // the menu's piece or the game's: a change fades from one to the other
    setMode(m) { if (m === mode) return; mode = m; mood = 'calm'; if (on && !failed) play(pick()); },
    // calm or battle (in the game): a change fades to a piece of the other kind
    setMood(m) { if (m === mood) return; mood = m; if (mode === 'game' && on && !failed) play(pick()); },
    _debug: () => ({ mode, mood, src: cur && cur.src, vol: cur && cur.volume, failed, playing: [...all].filter(a => !a.paused).length })
  };
})();
// what plays: the recorded pieces, or the generated music if they can't
const Soundtrack = {
  start() { if (Tracks.ok()) Tracks.start(); else Music.start(); },
  stop() { Tracks.stop(); Music.stop(); },
  setVolume(v) { Tracks.setVolume(v * 1.6); Music.setVolume(v); },
};
let musicOn = true, vol = 35, sfxOn = true, sfxVol = 60;
try { const m = JSON.parse(localStorage.getItem('irts-audio') || 'null'); if (m) { musicOn = !!m.on; vol = Math.max(0, Math.min(100, +m.vol || 0)); if ('sfxOn' in m) { sfxOn = !!m.sfxOn; sfxVol = Math.max(0, Math.min(100, +m.sfxVol || 0)); } } } catch (e) { /* storage unavailable */ }
const volEl = $('vol'), musBtn = $('music');
volEl.value = vol;
const saveAudio = () => { try { localStorage.setItem('irts-audio', JSON.stringify({ on: musicOn, vol, sfxOn, sfxVol })); } catch (e) { /* ignore */ } };
function syncMusic(play) {
  musBtn.setAttribute('aria-pressed', String(musicOn));
  Soundtrack.setVolume(Math.pow(vol / 100, 2) * 0.6);
  if (!musicOn || vol === 0) Soundtrack.stop(); else if (play) Soundtrack.start();
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
for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, () => { Music.unlock(); if (musicOn && vol > 0) Soundtrack.start(); });
if (musicOn && vol > 0) Tracks.start(); // (the menu's music right away, where the browser allows it before a tap)
syncMusic(false);

// ---- radio: event reports, most urgent first, never a backlog. Recorded lines when there are some (Speak/, listed
// in js/ui/voices.js by tools/voices.py: many takes per event, in many voices), else read aloud (Web Speech) ----
const Radio = (() => {
  const synth = window.speechSynthesis, SAY = { 'חי"ר': 'חיל רגלים', 'נ"מ': 'נגד מטוסים', 'מכ"ם': 'מכם' };
  const PRI = { missile: 3, intercept: 2, promo: 1, unclear: 2, lost: 3, hit: 3, flagLost: 3, call: 3, nodeLost: 3, ff: 3, contact: 2, flag: 2, fhq: 1, ok: 1, hqHit: 3, fhqHit: 3, baseHit: 2, droneLost: 2, dozerReady: 1, dozerIdle: 1, radioReady: 1, fhqCan: 1, droneCan: 1, canBuild: 1, placeHq: 2, hqReady: 2, selected: 0, go: 1, attacking: 1, holding: 1, retreating: 1 };
  // an event's folder of recorded lines
  const EVENT = { selected: 'selected', go: 'on_the_way', attacking: 'attacking', holding: 'holding', retreating: 'retreating', ok: 'in_position', contact: 'under_attack',
    hit: 'heavy_losses', lost: 'squad_lost', ff: 'friendly_fire', promo: 'promoted', unclear: 'say_again', fhq: 'forward_hq', nodeLost: 'building_lost', hqHit: 'hq_attack', fhqHit: 'fhq_attack', baseHit: 'base_attack', droneLost: 'drone_lost', dozerReady: 'dozer_ready', dozerIdle: 'dozer_idle', radioReady: 'radio_ready', fhqCan: 'fhq_ready', droneCan: 'drone_ready', placeHq: 'place_hq', hqReady: 'hq_ready', flagLost: 'lost_post', canBuild: 'can_build' };
  // (a post taken: the radar, the power and fuel stations their own lines, the rest one)
  const TOOK = { radar: 'took_radar', power: 'took_power', fuel: 'took_fuel' };
  const REC = typeof VOICES === 'object' ? VOICES : {}, recs = () => REC[lang === 'en' ? 'English' : 'Hebrew'] || null;
  const lastTake = {};
  // a take of the event: any of its lines (each recorded once, in one of several voices), not the same one twice running
  function take(ev) {
    let pool = (recs() || {})[ev]; if (!pool || !pool.length) return null;
    if (pool.length > 1) pool = pool.filter(f => f !== lastTake[ev]);
    return (lastTake[ev] = pool[Math.floor(Math.random() * pool.length)]);
  }
  let clip = null; // (the take playing now)
  const TEXT = { missile: () => 'שיגור טיל לעברנו!', intercept: () => 'יירוט', placeHq: () => 'יש למקם את המפקדה הראשית', hqReady: () => 'המפקדה מוכנה! אפשר להתחיל לבנות.', dozerReady: () => 'טרקטור מוכן', dozerIdle: () => 'הטרקטור ממתין, יש עבודה', radioReady: () => 'משאית קשר מוכנה', fhqCan: () => 'ניתן לבנות פיקוד קדמי', canBuild: () => 'אפשר להתחיל לבנות', droneCan: () => 'ניתן למקם רחפן', droneLost: () => 'הרחפן הופל', hqHit: () => 'המפקדה תחת התקפה!', fhqHit: () => 'הפיקוד הקדמי תחת התקפה!', baseHit: () => 'הבסיס תחת התקפה!', fhq: w => `${w}, מקימים פיקוד קדמי`, nodeLost: w => w === 'drone' ? 'הרחפן הופל' : `${Sim.STRUCTS[w].name} הושמד`, call: w => `${w}, לחץ כבד. להחזיק או לסגת?`, contact: w => `${w}, מגע`, hit: w => `${w}, אבדות כבדות, נסוגים`, lost: w => `${w}, הכוח הושמד`, ff: w => `${w}, ירי על כוחותינו!`,
    ok: w => `${w}, הגענו`, promo: w => `${w}, המפקד צבר ניסיון`, unclear: w => `${w}, ההודעה לא ברורה`, flag: w => `כבשנו את ${w}`, flagLost: w => `איבדנו את ${w}` };
  const TEXT_EN = { missile: () => 'Missile launch, incoming!', intercept: () => 'Intercepted', placeHq: () => 'Place the main headquarters', hqReady: () => 'Headquarters is ready! You can start building.', dozerReady: () => 'Bulldozer ready', dozerIdle: () => 'Bulldozer idle, work waiting', radioReady: () => 'Signals truck ready', fhqCan: () => 'Forward HQ available', canBuild: () => 'We can build', droneCan: () => 'Drone ready', droneLost: () => 'Drone down', hqHit: () => 'Our HQ is under attack!', fhqHit: () => 'Forward HQ under attack!', baseHit: () => 'Our base is under attack!', fhq: w => `${w}, setting up forward HQ`, nodeLost: w => w === 'drone' ? 'Drone down' : `${EN_STRUCTS[w]} destroyed`, call: w => `${w}, heavy pressure. Hold or retreat?`, contact: w => `${w}, contact`, hit: w => `${w}, heavy losses, falling back`, lost: w => `${w}, squad destroyed`, ff: w => `${w}, friendly fire!`,
    ok: w => `${w}, in position`, promo: w => `${w}, the commander has gained experience`, unclear: w => `${w}, message unclear`, flag: w => `We took ${w}`, flagLost: w => `We lost ${w}` };
  // the sim names squads by their type, in Hebrew
  const typeOf = n => Object.keys(Sim.TYPES).find(k => Sim.TYPES[k].name === n);
  let on = true, voice = null, pending = null;
  const pickVoice = () => { try { voice = synth.getVoices().find(v => lang === 'he' ? /^he/i.test(v.lang) : /^en/i.test(v.lang)) || null; } catch (e) { voice = null; } };
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { /* old browsers */ } }
  // what was heard lately, where: the same thing again in the same area while it keeps happening (each time less
  // than HEARD_T apart) is not said again — only somewhere else, or once it has been quiet there a while
  const heard = [], HEARD_T = 10, HEARD_R = 260, replied = {}, REPLY_MS = 10000;
  function fresh(k) {
    // replies to our own clicks (and other calls with no place): each at most once every REPLY_MS
    if (!Number.isFinite(k.x) || !Number.isFinite(k.t)) { const now = performance.now(); if (now - (replied[k.kind] ?? -Infinity) < REPLY_MS) return false; replied[k.kind] = now; return true; }
    const h = heard.find(h => h.kind === k.kind && Math.hypot(h.x - k.x, h.y - k.y) < HEARD_R && k.t - h.t < HEARD_T && k.t >= h.t);
    if (h) { h.t = k.t; return false; }
    for (let i = heard.length - 1; i >= 0; i--) if (k.t - heard[i].t >= HEARD_T || k.t < heard[i].t) heard.splice(i, 1);
    heard.push({ kind: k.kind, x: k.x, y: k.y, t: k.t }); return true;
  }
  function hear(k) {
    if (!on) return;
    if (k.kind === 'nodeLost' && k.who === 'drone') k = { ...k, kind: 'droneLost' }; // (a drone shot down is not a building)
    if (!fresh(k)) return;
    // a recorded line when the event has some; else the report read aloud (the order replies and "yes, sir" only recorded)
    const ev = k.kind === 'flag' ? TOOK[k.post] || 'took_post' : EVENT[k.kind], f = ev && take(ev);
    if (f) { if (!pending || PRI[k.kind] >= pending.pri) pending = { pri: PRI[k.kind], file: f, at: performance.now() }; return; }
    if (!TEXT[k.kind]) return;
    const en = lang === 'en', ty = typeOf(k.who), who = k.post ? pn(k.post) : en ? (ty ? EN_TYPES[ty] : k.who) : SAY[k.who] || k.who;
    if (!pending || PRI[k.kind] >= pending.pri) pending = { pri: PRI[k.kind], text: (en ? TEXT_EN : TEXT)[k.kind](who || ''), at: performance.now() };
  }
  // called every frame: say the pending report when the channel is free; stale ones are dropped
  function tick() {
    if (!pending || !on) return;
    if (performance.now() - pending.at > 4000) { pending = null; return; }
    if ((synth && synth.speaking) || (clip && !clip.ended && !clip.paused)) return;
    Music.squelch();
    if (pending.file) { clip = new Audio(pending.file); clip.volume = 0.9; clip.play().catch(() => { /* not allowed yet */ }); }
    else if (synth && voice) {
      const u = new SpeechSynthesisUtterance(pending.text); u.voice = voice; u.lang = voice.lang; u.rate = 1.15;
      try { synth.speak(u); } catch (e) { /* speech unavailable */ }
    }
    pending = null;
  }
  const reset = () => { pending = null; heard.length = 0; try { synth && synth.cancel(); } catch (e) { /* ignore */ } if (clip) { clip.pause(); clip = null; } };
  // what an event says, written (the message list): as it would be read aloud
  function textOf(k) {
    if (k.kind === 'nodeLost' && k.who === 'drone') k = { ...k, kind: 'droneLost' };
    if (!TEXT[k.kind]) return '';
    const en = lang === 'en', ty = typeOf(k.who), who = k.post ? pn(k.post) : en ? (ty ? EN_TYPES[ty] : k.who) : SAY[k.who] || k.who;
    return (en ? TEXT_EN : TEXT)[k.kind](who || '');
  }
  // a line said now, over whatever was waiting (the answer to a spoken order)
  const say = text => { if (on && text) pending = { pri: 9, text, at: performance.now() }; };
  return { hear, say, textOf, tick, reset, pickVoice, set: v => { on = v; if (!v) reset(); }, hasVoice: () => !!voice || !!recs(), recorded: () => !!recs() };
})();
let radioOn = true;
try { radioOn = localStorage.getItem('irts-radio') !== '0'; } catch (e) { /* storage unavailable */ }
function syncRadio() {
  Radio.pickVoice(); Radio.set(radioOn); $('radio').setAttribute('aria-pressed', String(radioOn));
  // no voice for the language: a mark, the reason in its tooltip
  const rn = $('radioNote'); rn.textContent = Radio.hasVoice() ? '' : '🔇'; rn.dataset.tip = 'noVoice';
}
$('radio').addEventListener('click', () => { radioOn = !radioOn; try { localStorage.setItem('irts-radio', radioOn ? '1' : '0'); } catch (e) { /* ignore */ } syncRadio(); });
syncRadio(); try { speechSynthesis.addEventListener('voiceschanged', syncRadio); } catch (e) { /* no speech */ }
