// UI: toolbar, selection, HUD, intro / end screens and the replay
// ---- selection & commands ----
const blueIds = () => blueSquads().map(q => q.id);
const selIds = () => sel === 'all' ? blueIds() : [sel];
function select(id) { sel = id; syncButtons(); updateHud(); }
function issue(type, x, y) {
  const all = sel === 'all';
  const ids = all ? s.squads.filter(q => q.side === 'blue' && !q.dead).map(q => q.id) : [sel];
  let ok = false;
  for (const id of ids) ok = Sim.order(s, id, type, x, y, all) || ok;
  if (ok && all) Sim.note(s, 'כל הכוחות: ' + (type === 'hold' ? 'מחזיקים עמדה' : type === 'attack' ? 'תוקפים את האזור' : 'נסוגים הביתה'));
  updateHud();
}
function setPlaying(p) { if (s.over) p = false; playing = p; syncButtons(); }

function syncButtons() {
  $('all').setAttribute('aria-pressed', String(sel === 'all'));
  document.querySelectorAll('[data-sq]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sq === sel)));
  document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === diff)));
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  const traitOf = id => (s.outbox.find(m => m.id === id && m.kind === 'trait') || s.squads.find(q => q.id === id)).trait;
  const traits = new Set(selIds().map(traitOf));
  document.querySelectorAll('[data-trait]').forEach(b => b.setAttribute('aria-pressed', String(traits.size === 1 && traits.has(b.dataset.trait))));
  document.querySelectorAll('[data-rate]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rate === rate)));
  const pb = $('play'); pb.textContent = playing ? '⏸' : '▶'; pb.setAttribute('aria-label', playing ? 'עצור' : 'התחל');
  document.querySelectorAll('[data-fog]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.fog === '1') === fog)));
  document.querySelectorAll('[data-map]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.map === 'big') === bigMap)));
  $('eye').setAttribute('aria-pressed', String(eyeArmed)); $('eye').hidden = !s.fog || !uiHas('eye'); $('fhq').hidden = !s.fog || !uiHas('fhq');
  $('bld').setAttribute('aria-expanded', String(!$('buildm').hidden || !!buildArmed));
  cv.style.cursor = eyeArmed ? 'zoom-in' : buildArmed ? 'copy' : '';
}

let replayAuto = false, replayAt = 0;
function drawReplay(i) {
  const cvR = $('replay'), h = s.hist[i]; if (!h) return;
  const w = cvR.clientWidth || 300, dpr = window.devicePixelRatio || 1, k = w / s.W;
  cvR.width = Math.round(w * dpr); cvR.height = Math.round(s.H * k * dpr);
  const c = cvR.getContext('2d'); c.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
  c.fillStyle = colors.ground; c.fillRect(0, 0, s.W, s.H);
  const g = s.H / Sim.H; // symbols keep their size on screen on a bigger map
  for (const q of h.sq) {
    const col = colors[q.side];
    if (q.truth && q.belief) { c.strokeStyle = hexA(col, 0.6); c.lineWidth = 2 * g; c.setLineDash([6 * g, 6 * g]); c.beginPath(); c.moveTo(q.truth[0], q.truth[1]); c.lineTo(q.belief[0], q.belief[1]); c.stroke(); c.setLineDash([]); }
    if (q.belief) { c.strokeStyle = col; c.lineWidth = 4 * g; c.beginPath(); c.arc(q.belief[0], q.belief[1], 16 * g, 0, Math.PI * 2); c.stroke(); }
    if (q.truth) { c.fillStyle = col; c.beginPath(); c.arc(q.truth[0], q.truth[1], 11 * g, 0, Math.PI * 2); c.fill(); }
  }
  // friendly fire since the previous snapshot
  const t0 = i ? s.hist[i - 1].t : -1;
  c.font = `${Math.round(30 * g)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = colors.red;
  for (const f of s.ff) if (f.side === 'blue' && f.t > t0 && f.t <= h.t) c.fillText('⚠', f.x, f.y - 24 * g);
  $('replayT').textContent = fmtTime(h.t);
}
$('scrub').addEventListener('input', () => { replayAuto = false; drawReplay(+$('scrub').value); });
function showEnd() {
  $('endT').textContent = s.over === 'blue' ? '🏆' : '✖';
  if (lvl && s.over === 'blue' && lvl > done) { done = lvl; try { localStorage.setItem('irts-done', String(done)); } catch (e) { /* ignore */ } }
  $('again').textContent = lvl && s.over === 'blue' ? '▶' : '↻';
  const b = Math.round(Sim.share(s, 'blue') * 100);
  $('endMe').textContent = b + '%'; $('endFoe').textContent = (100 - b) + '%';
  $('endInfo').textContent = `${fmtTime(s.t)} · ${lvl ? lvl + ' / ' + Sim.LEVELS : Sim.DIFFS[s.diff].name}`;
  $('end').hidden = false; $('again').focus();
  const H = s.hist, show = s.fog && H.length > 1;
  $('replayBox').hidden = !show;
  if (show) {
    $('scrub').max = H.length - 1; $('scrub').value = 0; replayAuto = true; replayAt = 0;
    $('replay').style.setProperty('--ar', (s.W / s.H).toFixed(3));
    // how far off the picture was, on average, over the whole game
    let err = 0, n = 0;
    for (const h of H) for (const q of h.sq) if (q.truth && q.belief) { err += Math.hypot(q.truth[0] - q.belief[0], q.truth[1] - q.belief[1]); n++; }
    const L = s.log2;
    $('endStats').textContent = `טעות ממוצעת בתמונה: ${n ? Math.round(err / n) : 0} · פקודות: ${L.orders}, בדרך בממוצע ${L.orders ? (L.delay / L.orders).toFixed(1) : 0} ש׳, סטייה בביצוע ${L.offN ? Math.round(L.off / L.offN) : 0} · שיחות: ענית ${L.answered}, החליטו לבד ${L.missed} · ⚠ ירי על כוחותינו: ${L.ff}`;
    drawReplay(0);
  }
}
function updateHud() {
  // power share: the truth without fog; under fog the enemy side is only what we know of it
  const b = Math.round(100 * (s.fog ? believedShare() : Sim.share(s, 'blue')));
  $('pwN').textContent = (s.fog ? '≈' : '') + b + '%'; $('pwB').style.width = b + '%';
  $('slotN').textContent = Sim.buildCount(s, 'blue') + '/' + Sim.buildLimit(s, 'blue');
  $('bld').setAttribute('aria-disabled', String(buildFull() && !buildArmed));
  renderSquadButtons();
  // drone / forward HQ buttons: seconds until ready, and a refill bar
  const cd = s.cd.blue, N = Sim.NODES;
  $('eyeN').textContent = cd.drone > 0 ? Math.ceil(cd.drone) : ''; $('eye').disabled = cd.drone > 0 && !eyeArmed;
  $('eye').style.setProperty('--p', (1 - cd.drone / N.drone.every).toFixed(2));
  const bsq = sel !== 'all' && s.squads.find(q => q.id === sel);
  $('fhqN').textContent = cd.fhq > 0 ? Math.ceil(cd.fhq) : ''; $('fhq').disabled = !Sim.canBuildFhq(s, bsq);
  $('fhq').style.setProperty('--p', (1 - cd.fhq / N.fhq.every).toFixed(2));
  $('bb').hidden = Sim.boost(s, 'blue') < 0.05;
  const key = s.log.length + ':' + (s.log.at(-1)?.t ?? '') + ':' + Math.floor(s.t / 2);
  if (key !== logKey) {
    logKey = key; const ol = $('log'); ol.textContent = '';
    for (const e of s.log.slice(s.fog ? -1 : -2)) {
      const li = document.createElement('li'); li.className = 'glass';
      li.style.opacity = s.t - e.t > 10 ? '0.45' : '1';
      li.innerHTML = '<b></b>: <span></span>';
      li.querySelector('b').textContent = e.who; li.querySelector('span').textContent = e.msg;
      ol.appendChild(li);
    }
  }
  for (const b of document.querySelectorAll('[data-sq]')) {
    const q = s.squads.find(x => x.id === b.dataset.sq);
    b.style.setProperty('--st', q.dead ? 0 : Math.min(1, pos(q).strength).toFixed(2)); b.classList.toggle('dead', q.dead);
  }
  const call = s.calls[0], cq = call && s.squads.find(q => q.id === call.sq);
  $('call').hidden = !cq || s.over;
  if (cq) {
    const T = Sim.TEMPERS[cq.temper];
    $('callTxt').textContent = `📞 סרן ${cq.boss} (${cq.name}, ${T.icon} ${T.name}): לחץ כבד. להחזיק או לסגת?`;
    $('callT').textContent = Math.ceil(call.until - s.t); $('call').dataset.id = call.id;
  }
  for (const b of document.querySelectorAll('[data-sq]')) {
    const q = s.squads.find(x => x.id === b.dataset.sq), T = Sim.TEMPERS[q.temper];
    b.title = `${q.name} · סרן ${q.boss} ${T.icon} ${T.name}${q.home ? '' : ' · בלי מבנה, בלי תגבורת'} (${b.querySelector('kbd').textContent})`;
  }
  if (s.over && !endShown) { endShown = true; setPlaying(false); showEnd(); }
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; syncButtons(); }));
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => { rate = +b.dataset.rate; syncButtons(); }));
document.querySelectorAll('[data-trait]').forEach(b => b.addEventListener('click', () => {
  const all = sel === 'all'; let ok = false;
  for (const id of selIds()) ok = Sim.setTrait(s, id, b.dataset.trait, all) || ok;
  if (ok && all) Sim.note(s, `כל הכוחות: מצב ${Sim.TRAITS[b.dataset.trait].name}`);
  syncButtons(); updateHud();
}));
$('all').addEventListener('click', () => select('all'));
// squad buttons: one per blue squad (they come and go with buildings); icon drawn with the map glyphs
let sqKey = '';
function renderSquadButtons() {
  const list = blueSquads(), key = list.map(q => q.id).join();
  if (key === sqKey) return;
  sqKey = key; const box = $('sqs'); box.textContent = '';
  list.forEach((q, i) => {
    const b = document.createElement('button'); b.className = 'sqb'; b.dataset.sq = q.id;
    b.innerHTML = '<canvas width="52" height="52"></canvas><kbd></kbd><i></i>';
    b.querySelector('kbd').textContent = i < 9 ? i + 1 : '';
    b.setAttribute('aria-label', q.name + (i < 9 ? ` (${i + 1})` : ''));
    const c = b.querySelector('canvas').getContext('2d');
    c.fillStyle = tcol(q.type); c.beginPath(); c.arc(26, 26, 24, 0, Math.PI * 2); c.fill();
    glyph(c, q.type, 26 - (q.type === 'tank' ? 3 : 0), 26, q.type === 'air' ? 17 : 13, '#fff', null, 0, q.type === 'aa' ? -Math.PI / 2 : 0);
    // a second tap on the selected squad centres the camera on it
    b.addEventListener('click', () => { if (sel === q.id && !q.dead) { const p = pos(q); if (p) lookAt(p.x, p.y); } select(q.id); });
    box.appendChild(b);
  });
  if (sel !== 'all' && !list.some(q => q.id === sel)) sel = 'all';
  syncButtons();
}
const FOE_GUESS = 6;
// what blue believes the power balance is: its own power vs what it has seen of the enemy
function believedShare() {
  let foe = 0;
  // unidentified sightings count as a typical squad (FOE_GUESS): the estimate is only as good as the identification
  for (const q of s.squads) { const m = q.side === 'red' && s.mem.blue[q.id]; if (m && s.t - m.t < 60) foe += m.type ? m.n * Sim.UNIT_VALUE[m.type] : FOE_GUESS; }
  for (const id in s.memNodes.blue) foe += Sim.STRUCTS[s.memNodes.blue[id].kind].value;
  // the enemy HQ's place is known from the start, even before anyone has seen it
  if (!Object.values(s.memNodes.blue).some(n => n.kind === 'hq') && s.nodes.some(n => n.side === 'red' && n.kind === 'hq' && n.hp > 0)) foe += Sim.STRUCTS.hq.value;
  const me = s.power.blue; return me + foe > 0 ? me / (me + foe) : 0.5;
}
// build menu: pick a building, then a spot on the map where control is strong enough
const BUILD_WHY = { q: 'השליטה כאן חלשה מדי לבנייה', limit: 'אין מקום פנוי במכסה — הקם פיקוד קדמי', gap: 'קרוב מדי למבנה אחר', bad: 'מחוץ למפה' };
function initBuildMenu() {
  const m = $('buildm');
  for (const k of Sim.PRODUCERS) {
    const S = Sim.STRUCTS[k], b = document.createElement('button');
    b.dataset.build = k; b.innerHTML = '<span></span><b></b><small></small>';
    b.querySelector('span').textContent = S.icon; b.querySelector('b').textContent = S.name;
    b.querySelector('small').textContent = `${S.build} ש׳ · ${Sim.TYPES[S.unit].name}`;
    b.addEventListener('click', () => { buildArmed = k; m.hidden = true; syncButtons(); });
    m.appendChild(b);
  }
}
// the menu offers what this game allows (the tutorial adds kinds level by level)
function syncBuildMenu(fresh) {
  for (const b of document.querySelectorAll('[data-build]')) {
    b.hidden = !!s.builds && !s.builds.includes(b.dataset.build);
    b.classList.toggle('new', fresh.includes(b.dataset.build));
  }
}
const buildFull = () => Sim.buildCount(s, 'blue') >= Sim.buildLimit(s, 'blue');
// no free slot: the button is dimmed, and pressing it anyway flashes the slots counter
function toggleBuild() {
  const m = $('buildm');
  if (!buildArmed && m.hidden && buildFull()) { const k = $('slots'); k.classList.remove('blink'); void k.offsetWidth; k.classList.add('blink'); return; }
  if (buildArmed) { buildArmed = null; m.hidden = true; } else m.hidden = !m.hidden;
  syncButtons();
}
$('bld').addEventListener('click', toggleBuild);
function placeBuilding(x, y) {
  const why = Sim.buildCheck(s, 'blue', x, y);
  if (why) Sim.note(s, BUILD_WHY[why]); else Sim.build(s, 'blue', buildArmed, x, y);
  if (!why) buildArmed = null;
  syncButtons(); updateHud();
}
document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
  diff = b.dataset.diff; s.diff = diff; try { localStorage.setItem('irts-diff', diff); } catch (e) { /* ignore */ }
  syncButtons();
}));
// the intro has no words: the level path and ▶. The full game (∞) adds its settings; ❔ shows the written rules.
function showIntro(on, full) {
  $('intro').hidden = !on; if (!on) return;
  $('rules').hidden = !full; $('freeOpts').hidden = !!lvl; renderLevels(); setPlaying(false); $('go').focus();
}
function renderLevels() {
  const box = $('levels'); box.textContent = '';
  for (let n = 1; n <= Sim.LEVELS + 1; n++) {
    const k = n > Sim.LEVELS ? 0 : n, b = document.createElement('button');
    b.textContent = k ? String(k) : '∞'; b.setAttribute('aria-label', k ? `שלב ${k}` : 'משחק מלא');
    b.setAttribute('aria-pressed', String(k === lvl)); b.classList.toggle('won', !!k && k <= done);
    b.disabled = !!k && k > done + 1; // a level opens when the one before it is won; the full game is always open
    b.addEventListener('click', () => { if (k === lvl) return; lvl = k; newGame(); });
    box.appendChild(b);
  }
}
$('go').addEventListener('click', () => { showIntro(false); setPlaying(true); });
// only the controls this level has; the ones it adds pulse until first used
const UI_EL = { squads: ['gSq'], orders: ['gOrd'], build: ['bld', 'slots'], vehicles: ['bld'], air: ['bld'], traits: ['gTrait'], fog: ['log'] };
// building kinds each level step brings
const UI_BUILDS = { build: ['tent'], vehicles: ['jeepshop', 'tankshop'], air: ['aapost', 'airfield'] };
// an element shows when any of the level steps that bring it is there
const UI_EL_ANY = id => Object.keys(UI_EL).some(k => UI_EL[k].includes(id) && uiHas(k));
function applyUi() {
  const fresh = lvl > 1 ? Sim.levelUi(lvl).filter(k => !Sim.levelUi(lvl - 1).includes(k)) : [];
  document.querySelectorAll('.new').forEach(e => e.classList.remove('new'));
  for (const k in UI_EL) for (const id of UI_EL[k]) $(id).hidden = !UI_EL_ANY(id);
  syncBuildMenu(fresh.flatMap(k => UI_BUILDS[k] || []));
  for (const k of fresh) for (const id of UI_EL[k] || [k]) $(id).classList.add('new');
  bar.classList.toggle('tut', !!s.ui && s.ui.length < 4);
}
document.addEventListener('pointerdown', e => { const n = e.target.closest && e.target.closest('.new'); if (n) n.classList.remove('new'); }, true);
// map size: a new map is made at once (the intro is still up, nothing has happened yet)
document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
  const big = b.dataset.map === 'big'; if (big === bigMap) return;
  bigMap = big; try { localStorage.setItem('irts-map', big ? 'big' : 'small'); } catch (e) { /* ignore */ }
  newGame(true); showIntro(true);
}));
document.querySelectorAll('[data-fog]').forEach(b => b.addEventListener('click', () => {
  fog = b.dataset.fog === '1'; s.fog = fog; try { localStorage.setItem('irts-fog', fog ? '1' : '0'); } catch (e) { /* ignore */ }
  syncButtons();
}));
let eyeArmed = false;
function toggleEye() { eyeArmed = !eyeArmed && s.fog && s.cd.blue.drone <= 0; syncButtons(); }
$('eye').addEventListener('click', toggleEye);
// forward HQ: the selected tank/jeep squad sets one up where it stands (the order travels like any other)
function buildHere() { if (sel !== 'all' && Sim.buildFhq(s, sel)) updateHud(); }
$('fhq').addEventListener('click', buildHere);
const answerCall = choice => { if (Sim.answer(s, +$('call').dataset.id, choice)) updateHud(); };
$('callHold').addEventListener('click', () => answerCall('hold'));
$('callBack').addEventListener('click', () => answerCall('retreat'));
$('again').addEventListener('click', () => {
  if (lvl && s.over === 'blue') lvl = lvl < Sim.LEVELS ? lvl + 1 : 0;
  newGame(true); setPlaying(true);
});
$('settings').addEventListener('click', () => newGame());
$('share').addEventListener('click', async () => {
  const url = location.href.split('#')[0];
  const text = (s.over === 'blue' ? 'ניצחתי' : 'הפסדתי') + ` אחרי ${fmtTime(s.t)} ברמה ${Sim.DIFFS[s.diff].name} ב"פיקוד על כוונה". נסה לנצח:`;
  try {
    if (navigator.share) await navigator.share({ title: 'פיקוד על כוונה', text, url });
    else { await navigator.clipboard.writeText(text + ' ' + url); $('share').textContent = 'הועתק ✓'; }
  } catch (e) { /* share cancelled or clipboard blocked */ }
});
$('help').addEventListener('click', () => { menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); showIntro(true, true); });
$('retreat').addEventListener('click', () => issue('retreat'));
$('play').addEventListener('click', () => setPlaying(!playing));
$('gear').addEventListener('click', () => {
  menu.hidden = !menu.hidden; $('gear').setAttribute('aria-expanded', String(!menu.hidden)); placeFloating();
});
$('restart').addEventListener('click', () => { menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); newGame(); });
