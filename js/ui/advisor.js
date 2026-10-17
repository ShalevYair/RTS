// UI: explanations while playing (in place of the tutorial levels) — an advisor that speaks and never stops the game.
// One line at a time (a queue, the urgent first, ADV_GAP s between), each once ever (irts-advice-seen); a caption under
// the power bar (#advice) in the game's language, and the voice: the recording if there is one (ADVICE_REC — from
// Speak/<English|Hebrew>/Instructions/<id>.mp3 — tools/eleven_advice.py), else the browser's English voice. What it says follows
// the arms: with engineering the partner's, he puts the HQ and the chain up, and you hear that, not orders meant for him.
// ⚙ "explanations": all / only when stuck (the "why not"s, and the next step after ADV_IDLE s of building nothing) / off;
// "from the start" forgets what was said. The lines: advice.js. Only in the full game; none with irts-tour = 99 (tests).
const ADVICE = adviceLines(Sim, EN_STRUCTS);
const ADV_GAP = 2.5, ADV_IDLE = 60, ADV_HI_MS = 6000;
let advMode = 'all';
try { const m = localStorage.getItem('irts-advice'); if (['all', 'stuck', 'off'].includes(m)) advMode = m; } catch (e) { /* storage unavailable */ }
const advSeen = new Set();
try { for (const k of JSON.parse(localStorage.getItem('irts-advice-seen') || '[]')) advSeen.add(k); } catch (e) { /* storage unavailable */ }
const adv = { q: [], busy: false, end: 0, open: new Map(), of: null, built: 0, builtAt: 0, hqT: null, hi: null };
const advOn = () => advMode !== 'off' && !lvl && !coachOff() && !!s && !!s.dozers;
// put a line in the queue (o.pri: higher first; o.stuck: said in 'only when stuck' too; o.el: a button to light up;
// o.at: a spot on the map to point at)
function advise(id, o = {}) {
  if (!advOn() || !ADVICE[id] || advSeen.has(id) || adv.q.some(e => e.id === id)) return;
  if (advMode === 'stuck' && !o.stuck) return;
  adv.q.push({ id, pri: o.pri || 1, el: o.el, at: o.at });
}
function advSave() { try { localStorage.setItem('irts-advice-seen', JSON.stringify([...advSeen])); } catch (e) { /* ignore */ } }
// the next in the queue: shown, lit, spoken; the one after it ADV_GAP s after this one ends
function advNext() {
  if (adv.busy || !adv.q.length || performance.now() < adv.end + ADV_GAP * 1000 || !playing) return;
  adv.q.sort((a, b) => b.pri - a.pri);
  const e = adv.q.shift(), L = ADVICE[e.id]; advSeen.add(e.id); advSave();
  const box = $('advice'); box.textContent = lang === 'he' ? L.he : L.en; box.hidden = false; box.classList.remove('out');
  if (e.el && $(e.el)) { const b = $(e.el); b.classList.add('advHi'); setTimeout(() => b.classList.remove('advHi'), ADV_HI_MS); }
  if (e.at) pings.push({ x: e.at.x, y: e.at.y, t: performance.now(), cap: true });
  adv.busy = true;
  let over = false; const done = () => { if (over) return; over = true; adv.busy = false; adv.end = performance.now(); setTimeout(() => { if (!adv.busy) box.classList.add('out'); }, 1500); };
  advSpeak(e.id, L, done);
}
// the voice: a recording (when there are), else the browser's — English for now, whatever the game's language
function advSpeak(id, L, done) {
  const rec = typeof ADVICE_REC === 'object' && ((ADVICE_REC[lang] || {})[id] || (ADVICE_REC.en || {})[id]);
  const vol = 0.9;
  setTimeout(done, 2500 + L.en.length * 80); // (a guard: speech that never ends; the radio off — only the caption, this long)
  if (!radioOn) return;
  if (rec) { const a = new Audio(rec); a.volume = vol; a.onended = done; a.onerror = done; a.play().catch(done); return; }
  const synth = window.speechSynthesis; if (!synth) { done(); return; }
  const u = new SpeechSynthesisUtterance(L.en); u.lang = 'en-US'; u.rate = 1.02; u.volume = vol;
  const v = synth.getVoices().filter(v => /^en/i.test(v.lang)); u.voice = v.find(v => /natural|google|aria|jenny|guy/i.test(v.name)) || v[0] || null;
  u.onend = done; u.onerror = done; synth.speak(u);
}
// a refusal (hud.js, techui.js): its line the first time — what's missing, and who builds it
function advWhy(why, kind) {
  if (!advOn()) return;
  if (why === 'needs' && kind) {
    const nd = Sim.needsOf(s, 'blue', kind); if (!nd) return;
    const mate = Sim.armSide(s, 'blue', nd) === 'mate';
    if (nd === 'concrete') advise(mate ? 'why_con_mate' : 'why_con_me', { pri: 9, stuck: true });
    else advise((mate ? 'needm_' : 'need_') + kind, { pri: 9, stuck: true });
    advise('tech', { pri: 3, stuck: true });
  } else if (why === 'nohq') advise(Sim.hqPlacer(s, 'blue') === 'mate' ? 'why_nohq_mate' : 'why_nohq_me', { pri: 9, stuck: true, el: Sim.hqPlacer(s, 'blue') === 'me' ? 'hqb' : null });
  else if (ADVICE['why_' + why]) advise('why_' + why, { pri: 8, stuck: true });
}
// the nearest free deposit of a kind to our HQ (to point at)
function advDeposit(kind, hq) {
  let best = null, bd = Infinity;
  for (const d of s.deposits || []) if (d.kind === kind && Sim.freeDeposit(s, d.kind, d.x, d.y)) { const k = Math.hypot(d.x - hq.x, d.y - hq.y); if (k < bd) { bd = k; best = d; } }
  return best;
}
// the building kind's button (top left) that holds a kind
const advCat = k => { const b = [...document.querySelectorAll('[data-cat]')].find(b => pageHas(b.dataset.cat, k)); return b ? (b.id || (b.id = 'cat_' + b.dataset.cat)) : null; };
// once a second (coach.js): what's true now → the lines it calls for
function advTick() {
  if (!advOn() || s.over) { if (adv.q.length && !advOn()) adv.q = []; return; }
  if (adv.of !== s) { adv.of = s; adv.q = []; adv.open.clear(); adv.built = 0; adv.builtAt = s.t; adv.hqT = null; }
  const eng = Sim.hqPlacer(s, 'blue') === 'me', mine = k => Sim.armSide(s, 'blue', k) !== 'mate';
  const ours = s.nodes.filter(n => n.side === 'blue' && n.hp > 0 && n.kind !== 'drone');
  const hq = ours.find(n => n.kind === 'hq' && s.t >= n.ready);
  if (ours.length !== adv.built) { adv.built = ours.length; adv.builtAt = s.t; }
  const idle = s.t - adv.builtAt > ADV_IDLE;
  // the opening
  advise('intro_goal', { pri: 7 });
  if (s.arms) { advise('intro_mate', { pri: 6.6 }); const a = Object.keys(ADV_ARM).filter(k => s.arms.includes(k)); if (a.length === 2) advise(`arms_${a[0]}_${a[1]}`, { pri: 6.5 }); }
  advise('intro_supply', { pri: 5 }); advise('intro_off', { pri: 5 });
  // (the order: the goal, the partner and the arms, where the HQ goes, the supply chain, how to turn this off)
  if (!hq) { advise(eng ? 'hq_me' : 'hq_mate', { pri: 6.4, el: eng ? 'hqb' : null, stuck: eng && s.t > ADV_IDLE }); return; }
  if (adv.hqT === null) adv.hqT = s.t;
  advise('hq_ready', { pri: 4 });
  // the supply chain: the next step only — yours with engineering; else what you wait for
  if (eng) {
    const step = ADV_STEPS.find(([k]) => Sim.STRUCTS[k] && !ours.some(n => n.kind === k));
    if (step && !Sim.needsOf(s, 'blue', step[0])) { const d = step[1] && advDeposit(step[1], hq); advise('step_' + step[0], { pri: 3, stuck: idle, at: d ? { x: d.x, y: d.y } : null, el: d ? null : advCat(step[0]) }); }
  } else { const a = ['armor', 'infantry', 'air'].find(k => s.arms && s.arms.includes(k)); if (a) advise('matechain_' + a, { pri: 3 }); }
  if (ours.some(n => n.kind === 'concrete' && s.t >= n.ready)) advise('con_ready', { pri: 2 });
  // a fighting building of yours whose way just opened
  for (const k of Object.keys(ADVICE)) if (k.startsWith('open_')) {
    const kind = k.slice(5); if (!mine(kind) || (s.builds && !s.builds.includes(kind))) continue;
    const lock = !!Sim.needsOf(s, 'blue', kind), was = adv.open.get(kind); adv.open.set(kind, lock);
    if (was === true && !lock) advise(k, { pri: 2, el: advCat(kind) });
  }
  // what's new, when it's of use
  const fighters = s.squads.filter(q => q.side === 'blue' && !q.dead && !q.cmd && Sim.TYPES[q.type] && !Sim.TYPES[q.type].care);
  if (fighters.some(q => Sim.ownSquad(s, q))) advise('f_select', { pri: 2 });
  if (fighters.length >= 5 && !Sim.onFronts(s, 'blue')) advise('f_fronts', { pri: 2, el: 'front' });
  if (buildFull() && !$('fhq').hidden) advise('f_fhq', { pri: 2, el: 'fhq', stuck: true });
  if (!$('eye').hidden && s.drones && s.drones.blue && s.drones.blue.stock > 0) advise('f_drone', { pri: 1, el: 'eye' });
  if (s.units.some(u => u.side === 'blue' && ((u.fuel !== undefined && u.fuel <= 0) || (u.water !== undefined && u.water <= 0)))) advise('f_dry', { pri: 3 });
  if (s.posts && s.t - adv.hqT > 60) advise('f_post', { pri: 1 });
  if (s.t - adv.hqT > 240) advise('f_wheel', { pri: 1 });
  if (s.night && Sim.nightAt(s) > 0.35) advise('f_night', { pri: 1 });
  if (s.wxNow && (s.wxNow.rain > 0.3 || s.wxNow.fog > 0.3 || s.wxNow.dust > 0.3)) advise('f_weather', { pri: 1 });
  if (s.missiles && s.missiles.length) advise('f_missile', { pri: 4 });
  if (hq.hp < Sim.STRUCTS.hq.hp * 0.95) advise('f_hqhit', { pri: 6 });
}
// every frame (main.js, by the coach): the queue
function adviceFrame() { if (advOn()) advNext(); }
// ⚙: all / only when stuck / off; from the start
function syncAdvice() { for (const b of document.querySelectorAll('[data-adv]')) b.setAttribute('aria-pressed', String(b.dataset.adv === advMode)); }
for (const b of document.querySelectorAll('[data-adv]')) b.addEventListener('click', () => {
  advMode = b.dataset.adv; try { localStorage.setItem('irts-advice', advMode); } catch (e) { /* ignore */ }
  if (advMode === 'off') { adv.q = []; try { speechSynthesis.cancel(); } catch (e) { /* no speech */ } $('advice').hidden = true; }
  syncAdvice();
});
$('advReset').addEventListener('click', () => { advSeen.clear(); advSave(); adv.q = []; adv.open.clear(); toast(tr('advResetDone'), innerWidth / 2, 120); });
syncAdvice();
