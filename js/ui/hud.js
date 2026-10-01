// UI: toolbar, selection, HUD, intro / end screens and the replay
// ---- selection & commands ----
const blueIds = () => blueSquads().map(q => q.id);
const selIds = () => sel === 'all' ? blueIds() : Array.isArray(sel) ? sel : sel ? [sel] : [];
function select(id) { sel = id; selNode = null; syncButtons(); updateHud(); }
// "yes, sir" from one of the picked squads
const sayPicked = ids => { if (ids.length) Radio.hear({ kind: 'selected', id: ids[Math.floor(Math.random() * ids.length)] }); };
// a squad picked on the map (or by its building): its whole group, if it's in one
function pickSquad(id) { const g = groupOf(id); select(g ? g.ids.slice() : id); sayPicked([id]); }
// what the squads say back to an order: attacking (at an enemy), holding, falling back, else on the way. Under command
// friction they say it when the message reaches them (the 'ack' report), else at once.
const orderSay = {};
const replyOf = (type, foe) => foe ? 'attacking' : type === 'retreat' ? 'retreating' : type === 'hold' ? 'holding' : 'go';
// fa: the way the front should face (a drag), else toward the enemy; foe: the order is at an enemy (a red mark)
function issue(type, x, y, fa, foe) {
  const all = sel === 'all';
  // (everyone: not the bulldozers — they'd leave their sites for the front)
  const ids = all ? s.squads.filter(q => q.side === 'blue' && !q.dead && q.type !== 'dozer').map(q => q.id) : selIds();
  if (!ids.length) return; // nothing picked: nothing to order
  // several together (all, a group, a type, a rectangle): rows facing the enemy (tanks in front … medics and mechanics
  // at the back); one alone: its own line
  let ok = false;
  if (ids.length > 1) ok = Sim.formation(s, ids, type, x, y, true, fa);
  else for (const id of ids) ok = Sim.order(s, id, type, x, y, false, Number.isFinite(fa) ? { fa } : undefined) || ok;
  if (ok && all) Sim.note(s, 'כל הכוחות: ' + (type === 'hold' ? 'מחזיקים עמדה' : type === 'attack' ? 'תוקפים את האזור' : 'נסוגים הביתה'));
  if (ok) {
    if (type !== 'retreat') pings.push({ x, y, t: performance.now(), foe: !!foe }); // four arrows closing on the spot
    const say = replyOf(type, foe); for (const id of ids) orderSay[id] = say;
    if (!Sim.friction(s)) Radio.hear({ kind: say, id: ids[Math.floor(Math.random() * ids.length)] });
  }
  updateHud();
}
function setPlaying(p) { if (s.over) p = false; playing = p; syncButtons(); }
// the settings stop the game while they're open, and closing them goes on
function openMenu() { if (!menu.hidden) return; menu.hidden = false; $('homeSure').hidden = true; $('gear').setAttribute('aria-expanded', 'true'); hideTip(); setPlaying(false); placeFloating(); syncButtons(); }
function closeMenu(go = true) {
  if (menu.hidden) return;
  menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false');
  if (go && $('intro').hidden && $('end').hidden) setPlaying(true); else syncButtons();
}

function syncButtons() {
  syncCats();
  $('all').setAttribute('aria-pressed', String(sel === 'all'));
  // a type is pressed when all its squads are picked (★: all of them)
  document.querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-pressed', String(typeIds(b.dataset.ty).every(isSel))));
  document.querySelectorAll('[data-gr]').forEach(b => { const g = groups.find(x => x.id === +b.dataset.gr); b.setAttribute('aria-pressed', String(!!g && g.ids.every(isSel))); });
  // 🔗 ties the picked squads into a group; ✂ breaks the picked group up
  const gb = $('grp'), sg = selGroup(), many = sel !== 'all' && selIds().length > 1;
  gb.hidden = !uiHas('squads') || (!sg && !many); gb.textContent = sg ? '✂' : '🔗'; gb.dataset.tip = sg ? 'tipUngroup' : 'tipGroup'; gb.setAttribute('aria-label', tr(gb.dataset.tip));
  // the orders show only while something is picked
  $('gOrd').hidden = !uiHas('orders') || !selIds().length;
  document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === diff)));
  // the one order button shows the order a tap on the map gives (attack: a sword, hold: a shield)
  const ob = $('ordMode'); if (ob.dataset.m !== mode) { ob.dataset.m = mode; ob.innerHTML = orderSvg(mode); } ob.setAttribute('aria-label', tr(mode));
  // radio silence for the picked squads (where orders travel as messages): 📻 on the air, 🤫 silent
  const sb = $('silent'), hush = selSilent(); sb.hidden = !Sim.friction(s) || !selIds().length; sb.textContent = hush ? '🤫' : '📻'; sb.setAttribute('aria-pressed', String(hush)); sb.setAttribute('aria-label', tr(hush ? 'silentOn' : 'silentOff'));
  document.querySelectorAll('[data-rate]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rate === rate)));
  $('paused').hidden = playing || !s || s.over || !menu.hidden || !!tour || !$('intro').hidden || !$('end').hidden;
  $('fs').setAttribute('aria-pressed', String(fsOn()));
  document.querySelectorAll('[data-fog]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.fog === '1') === fog)));
  document.querySelectorAll('[data-map]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.map === (hugeMap ? 'huge' : bigMap ? 'big' : 'small'))));
  $('eye').setAttribute('aria-pressed', String(eyeArmed)); $('fhq').setAttribute('aria-pressed', String(fhqArmed)); $('eye').hidden = !s.fog || !uiHas('eye'); $('fhq').hidden = !uiHas('fhq');
  $('fsRow').hidden = !fsCan() && !fsOn();
  $('bld').setAttribute('aria-expanded', String(!$('buildm').hidden || !!buildArmed));
  if (eyeArmed || buildArmed || fhqArmed || hqArmed) cv.style.cursor = eyeArmed ? DRONE_CUR : 'copy'; // (else the hover sets it)
  $('hqb').hidden = !hqToPlace(); $('hqb').setAttribute('aria-pressed', String(hqArmed));
  bar.classList.toggle('empty', ![...bar.children].some(c => !c.hidden)); // (the early levels have none of its buttons)
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
  const St = Sim.AI_STYLES[s.style.red];
  $('endInfo').textContent = `${fmtTime(s.t)} · ${lvl ? lvl + ' / ' + Sim.LEVELS : diffName(s.diff) + ' · ' + St.icon + ' ' + styleName(s.style.red)}`;
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
    $('endStats').textContent = tr('endStats', n ? Math.round(err / n) : 0, L.orders, L.orders ? (L.delay / L.orders).toFixed(1) : 0, L.offN ? Math.round(L.off / L.offN) : 0, L.answered, L.missed, L.ff, L.unclear || 0);
    drawReplay(0);
  }
}
function updateHud() {
  // power share: the truth without fog; under fog the enemy side is only what we know of it
  const b = Math.round(100 * (s.fog ? believedShare() : Sim.share(s, 'blue')));
  $('pwB').style.width = b + '%'; $('power').classList.toggle('est', !!s.fog); $('power').style.setProperty('--lose', pctLose() + '%');
  $('slotN').textContent = Sim.buildCount(s, 'blue') + '/' + Sim.buildLimit(s, 'blue'); syncCats();
  $('bld').setAttribute('aria-disabled', String(buildFull() && !buildArmed));
  // while there's room for another building, 🏗️ pulses: build more
  $('bld').classList.toggle('nudge', !!s.t && !buildFull() && !buildArmed && $('buildm').hidden && !s.over && playing && !(s.hqPending && s.hqPending.blue));
  // open field: 🏰 pulses until a spot is picked; the first time, a note on the map says so
  $('hqb').hidden = !hqToPlace(); $('hqb').classList.toggle('nudge', hqToPlace() && !hqPlanned() && !hqArmed);
  if (hqToPlace() && !hqPlanned() && playing && !hqTold && fit) { hqTold = true; const [a, b] = Sim.hqBand(s, 'blue'), p = onScreen((a + b) / 2, s.H / 2); Radio.hear({ kind: 'placeHq' }); toast(tr('placeHq'), Math.max(120, p.x), Math.min(fit.top + fit.h - 60, Math.max(fit.top + 60, p.y))); }
  // and 🏕️ pulses whenever a forward HQ can be set up
  $('fhq').classList.toggle('nudge', uiHas('fhq') && !!s.t && playing && !fhqArmed && s.cd.blue.fhq <= 0 && Sim.fhqCount(s, 'blue') < Sim.fhqMax(s) && fhqCrews().length > 0);
  renderSquadButtons();
  // drones: how many in hand, and a bar until the next one; forward HQ: seconds until the next, and a refill bar
  const cd = s.cd.blue, N = Sim.NODES, D = s.drones.blue;
  $('eyeN').textContent = D.stock || ''; $('eye').disabled = D.stock < 1 && !eyeArmed;
  $('eye').style.setProperty('--p', D.stock + Sim.dronesUp(s, 'blue') >= N.drone.max ? '1' : (1 - D.next / N.drone.every).toFixed(2));
  const bsq = oneSel() && s.squads.find(q => q.id === oneSel());
  $('fhqN').textContent = Sim.fhqCount(s, 'blue') >= Sim.fhqMax(s) ? Sim.fhqMax(s) + '/' + Sim.fhqMax(s) : cd.fhq > 0 ? Math.ceil(cd.fhq) : ''; $('fhq').setAttribute('aria-disabled', String(!Sim.canBuildFhq(s, bsq)));
  // a green halo, pulsing, round whatever can be used now (a drone to send, a forward HQ to place; the building
  // kinds: syncCats); the two buttons show what they'd put down then: the drone, the forward HQ
  const canEye = D.stock >= 1 && !$('eye').hidden, canFhq = uiHas('fhq') && !!s.t && !fhqArmed && Sim.canBuildFhq(s, bsq) && Sim.fhqCount(s, 'blue') < Sim.fhqMax(s);
  $('eye').classList.toggle('can', canEye && !eyeArmed); $('fhq').classList.toggle('can', canFhq);
  btnPic('eye', canEye ? 'drone' : null); btnPic('fhq', canFhq ? 'fhq' : null);
  if (s.fog !== fogWas) { fogWas = s.fog; syncButtons(); } // the tutorial's fog comes down mid-level
  $('fhq').style.setProperty('--p', (1 - cd.fhq / N.fhq.every).toFixed(2));
  $('moon').hidden = Sim.nightAt(s) < 0.5;
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
  // each type's strength: the average of its squads (as reported)
  for (const b of document.querySelectorAll('[data-ty],[data-gr]')) {
    const l = btnIds(b).map(id => s.squads.find(q => q.id === id)), st = l.length ? l.reduce((a, q) => a + Math.min(1, pos(q).strength), 0) / l.length : 0;
    b.style.setProperty('--st', st.toFixed(2));
  }
  const call = s.calls[0], cq = call && s.squads.find(q => q.id === call.sq);
  $('call').hidden = !cq || s.over || !s.askHq; // (commanders decide for themselves unless s.askHq)
  if (cq) {
    $('callTxt').textContent = tr('call', bossName(cq.boss), tn(cq.type));
    $('callT').textContent = Math.ceil(call.until - s.t); $('call').dataset.id = call.id;
  }
  if (s.over && !endShown) { endShown = true; setPlaying(false); startOutro(); }
}

$('ordMode').addEventListener('click', () => { mode = mode === 'attack' ? 'hold' : 'attack'; hideTip(); syncButtons(); });
// the picked squads are silent (or have that order on its way)
const wantSilent = q => { const m = s.outbox.find(k => k.id === q.id && k.kind === 'silent'); return m ? m.on : q.silent; };
const selSilent = () => { const l = selIds().map(id => s.squads.find(q => q.id === id)).filter(Boolean); return !!l.length && l.every(wantSilent); };
function toggleSilent() { const on = !selSilent(); for (const id of selIds()) Sim.silence(s, id, on); hideTip(); syncButtons(); }
$('silent').addEventListener('click', toggleSilent);
$('ordMode').dataset.tip = 'ord'; $('ordMode').tipText = () => tr(mode === 'attack' ? 'tipAttack' : 'tipHold') + ' · ' + tr('tipSwitch');
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => { rate = +b.dataset.rate; syncButtons(); }));
$('all').addEventListener('click', () => select('all'));
// The buttons at the top: first the groups the player made, then one per kind of unit for the squads in no group.
// They're numbered 1–9 left to right (the keys; more than nine are picked by a tap). A tap picks all of them, a second
// tap brings the camera there.
// Groups (this game only, in the UI): squads tied together act as one — picked together (also by tapping any of them
// on the map), ordered together, in rows facing the enemy. As in other RTS games: Ctrl (or Alt) + a number makes what's
// picked group <number> (g.key); the number picks it, and pressed again brings the camera to the middle of its squads.
// 🔗 (L) ties what's picked into a group on the first free number; ✂ unties it. A squad is in one group at most; a group
// with no squads left is gone (one made with 🔗 once it's down to one squad).
const TYPE_KEYS = ['tank', 'inf', 'at', 'jeep', 'tjeep', 'ajeep', 'aa', 'air', 'med', 'mech', 'truck', 'dozer', 'radio'];
let groups = [], nextGroup = 1;
const groupOf = id => groups.find(g => g.ids.includes(id));
const aliveBlue = () => new Set(s.squads.filter(q => q.side === 'blue' && !q.dead).map(q => q.id));
const typeIds = ty => s.squads.filter(q => q.side === 'blue' && !q.dead && q.type === ty && !groupOf(q.id)).map(q => q.id);
const btnIds = b => b.dataset.ty ? typeIds(b.dataset.ty) : (groups.find(g => g.id === +b.dataset.gr) || { ids: [] }).ids;
// the picked squads are exactly one group
const selGroup = () => { if (sel === 'all') return null; const l = selIds(); return groups.find(g => g.ids.length === l.length && g.ids.every(isSel)) || null; };
function pickIds(ids) {
  if (!ids.length) return;
  if (sel !== 'all' && ids.every(isSel) && selIds().length === ids.length) {
    const ps = ids.map(id => pos(s.squads.find(q => q.id === id))).filter(Boolean);
    if (ps.length) lookAt(ps.reduce((a, p) => a + p.x, 0) / ps.length, ps.reduce((a, p) => a + p.y, 0) / ps.length);
  }
  select(ids.length === 1 ? ids[0] : ids.slice()); sayPicked(ids);
}
function toggleGroup() {
  const g = selGroup();
  if (g) groups = groups.filter(x => x !== g);
  else {
    const alive = aliveBlue(), ids = selIds().filter(id => alive.has(id)); if (sel === 'all' || ids.length < 2) return;
    const used = new Set(groups.map(x => x.key)), key = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(k => !used.has(k));
    setGroup(ids, key, false);
  }
  renderSquadButtons(); syncButtons();
}
// what's picked becomes group `key` (Ctrl + the number): any group on that number is replaced, and its squads leave
// the groups they were in
function setGroup(ids, key, hard = true) {
  const alive = aliveBlue(); ids = ids.filter(id => alive.has(id) && (sel !== 'all' || s.squads.find(q => q.id === id).type !== 'dozer')); // (everyone: not the bulldozers)
  if (!ids.length) return false;
  groups = groups.filter(x => x.key !== key || !key);
  for (const x of groups) x.ids = x.ids.filter(id => !ids.includes(id));
  groups.push({ id: nextGroup++, ids: ids.slice(), key, hard });
  renderSquadButtons(); syncButtons(); return true;
}
function keyGroup(key) { if (setGroup(selIds(), key)) { const b = document.querySelector(`[data-gr] kbd[data-k="${key}"]`); if (b) blink(b.parentElement); } }
$('grp').addEventListener('click', toggleGroup);
let sqKey = '';
function renderSquadButtons() {
  // what's picked, and the groups, stay among the living
  const alive = aliveBlue();
  if (Array.isArray(sel)) { const l = sel.filter(id => alive.has(id)); if (l.length !== sel.length) sel = l.length > 1 ? l : l[0] || null; }
  else if (sel && sel !== 'all' && !alive.has(sel)) sel = null;
  for (const g of groups) g.ids = g.ids.filter(id => alive.has(id));
  groups = groups.filter(g => g.ids.length > (g.hard ? 0 : 1)); // (a numbered group stays while it has a squad)
  groups.sort((a, b) => (a.key || 99) - (b.key || 99));
  const types = TYPE_KEYS.filter(ty => typeIds(ty).length);
  const key = groups.map(g => g.id + ':' + g.key + ':' + g.ids.join('.')).join() + '|' + types.join() + lang;
  if (key === sqKey) return;
  sqKey = key; const box = $('sqs'); box.textContent = '';
  const typeOf = id => s.squads.find(q => q.id === id).type;
  // (each button's number key: a group's own; the kinds of unit get the numbers left over, in order)
  const add = (b, n, name, icon, ids) => {
    b.classList.add('sqb'); b.innerHTML = '<canvas width="64" height="64"></canvas><kbd></kbd><i></i>';
    const kb = b.querySelector('kbd'); kb.textContent = n && n <= 9 ? n : ''; if (n) kb.dataset.k = n;
    b.setAttribute('aria-label', name() + (n && n <= 9 ? ` (${n})` : ''));
    b.dataset.tip = 'sq'; b.tipText = () => name() + (n && n <= 9 ? ` (${n})` : '') + (b.dataset.gr ? '' : ' · ' + tr('tipCtrlGroup'));
    icon(b.querySelector('canvas')); b.addEventListener('click', () => pickIds(ids()));
    box.appendChild(b);
  };
  const used = new Set(groups.map(g => g.key).filter(Boolean)); let free = 0;
  const nextFree = () => { do free++; while (used.has(free)); return free; };
  for (const g of groups) {
    const b = document.createElement('button'); b.dataset.gr = g.id; b.classList.add('grb');
    const kinds = () => TYPE_KEYS.filter(ty => g.ids.some(id => typeOf(id) === ty));
    add(b, g.key || nextFree(), () => tr('group') + ': ' + kinds().map(ty => `${tn(ty)} ×${g.ids.filter(id => typeOf(id) === ty).length}`).join(', '), c => drawGroupIcon(c, kinds()), () => g.ids);
  }
  for (const ty of types) {
    const b = document.createElement('button'); b.dataset.ty = ty;
    add(b, nextFree(), () => `${tn(ty)} ×${typeIds(ty).length}`, c => drawSquadIcon(c, ty), () => typeIds(ty));
  }
  syncButtons();
}
// a group's button: up to three of its kinds of unit, small, side by side
function drawGroupIcon(cvs, kinds) {
  const c = cvs.getContext('2d'); c.clearRect(0, 0, 64, 64);
  const l = kinds.slice(0, 3), at = [[[32, 34]], [[20, 34], [44, 34]], [[16, 42], [48, 42], [32, 22]]][l.length - 1];
  l.forEach((ty, i) => glyph(c, ty, at[i][0], at[i][1], ty === 'air' ? 15 : 12, colors.blue, colors.outline, ty === 'air' ? -Math.PI / 4 : 0, ty === 'aa' ? -Math.PI / 4 : 0, 1.6));
}
// a squad's button: the unit as it looks on the map (our colour, outlined), big
function drawSquadIcon(cvs, type) {
  const c = cvs.getContext('2d'), k = { air: 28, tank: 21, jeep: 23, ajeep: 23, tjeep: 23, mech: 19, truck: 21, dozer: 22, radio: 20 }[type] || 28;
  c.clearRect(0, 0, 64, 64);
  const x = type === 'tank' ? 25 : type === 'mech' ? 40 : type === 'inf' || type === 'aa' || type === 'at' ? 29 : 32, y = type === 'inf' || type === 'med' || type === 'aa' || type === 'at' ? 35 : 32;
  if (hasSprite(type)) { const a = type === 'air' ? -Math.PI / 4 : 0; drawUnitPic(c, type, 32, 32, k * (type === 'air' ? 0.85 : 0.95), colors.blue, a, a); }
  else glyph(c, type, x, y, k, colors.blue, colors.outline, type === 'air' ? -Math.PI / 4 : 0, type === 'aa' ? -Math.PI / 4 : 0, 2.2);
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
// build menu: first what kind (tents, workshops, the airfield, services), then which one, then a spot on the map where
// control is strong enough. The pages: BUILD_PAGES (a page's entries: buildings, or 'page:<name>' for a sub-page);
// BUILD_UP: where ‹ goes back to.
const BUILD_PAGES = {
  root: ['page:tents', 'page:shops', 'airfield', 'page:service'],
  tents: ['tent', 'atpost', 'aapost', 'clinic'],
  shops: ['tankshop', 'page:jeeps'],
  jeeps: ['jeepshop', 'jeepat', 'jeepaa'],
  service: ['garage', 'depot', 'decoy'],
};
const BUILD_UP = { tents: 'root', shops: 'root', service: 'root', jeeps: 'shops' };
// the column top left: the root page's kinds (the airfield on its own)
const BUILD_CATS = ['tents', 'shops', 'airfield', 'service'];
// (the picture on a page's button)
const PAGE_PIC = { tents: 'tent', shops: 'tankshop', jeeps: 'jeepshop', service: 'garage' };
let buildPage = 'root';
// the drone and forward-HQ buttons: their icons from art/ (ICONS, white on clear) instead of the drawn ones
for (const [id, k] of [['eye', 'drone'], ['fhq', 'fhq']]) {
  const src = typeof ICONS === 'object' && ICONS[k], b = $(id); if (!src || !b) continue;
  const im = document.createElement('img'); im.className = 'ico pic'; im.src = src; im.alt = ''; im.setAttribute('aria-hidden', 'true');
  b.querySelector('svg')?.remove(); if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.remove(); b.prepend(im);
}
// the picture on the drone / forward-HQ button: the thing itself when it can be put down, else the plain icon
const btnPics = {};
function btnPic(id, what) {
  const im = $(id).querySelector('img.pic'); if (!im) return;
  let src = ICONS[id === 'eye' ? 'drone' : 'fhq'];
  if (what) {
    const key = what + colors.blue;
    if (!btnPics[key]) {
      const p = what === 'drone' ? sprite.img.drone && spritePic('drone', colors.blue) : hasBuildingPic('fhq') && buildingPic('fhq', colors.blue, 40);
      if (p) btnPics[key] = p.toDataURL();
    }
    src = btnPics[key] || src;
  }
  if (im.getAttribute('src') !== src) { im.src = src; im.classList.toggle('real', src !== ICONS[id === 'eye' ? 'drone' : 'fhq']); }
}
function initBuildMenu() {
  const m = $('buildm'), back = document.createElement('button');
  back.className = 'bback'; back.dataset.al = 'back'; back.textContent = '‹';
  back.addEventListener('click', () => showBuildPage(BUILD_UP[buildPage] || 'root'));
  m.appendChild(back);
  const pic = b => { const p = document.createElement('canvas'); p.width = p.height = 84; p.className = 'bpic'; b.querySelector('span').appendChild(p); }; // (drawn in nameBuildMenu, in our colour)
  for (const g in PAGE_PIC) {
    const b = document.createElement('button');
    b.dataset.page = g; b.innerHTML = '<span></span><b></b><small></small>'; pic(b);
    b.addEventListener('click', () => showBuildPage(g));
    m.appendChild(b);
  }
  for (const k of Sim.BUILDABLE) {
    const b = document.createElement('button');
    b.dataset.build = k; b.dataset.tip = 'b_' + k; b.innerHTML = '<span></span><b></b><small></small>'; pic(b);
    if (k === 'decoy') { const i = document.createElement('i'); i.textContent = Sim.STRUCTS[k].badge; b.querySelector('span').appendChild(i); }
    b.addEventListener('click', () => { buildArmed = k; m.hidden = true; hideTip(); syncButtons(); });
    m.appendChild(b);
  }
  // the kinds of building, top left, one under the other
  const cats = $('bcats');
  for (const g of BUILD_CATS) {
    const b = document.createElement('button');
    b.dataset.cat = g; b.dataset.tip = 'bcat'; b.innerHTML = '<canvas width="96" height="96"></canvas><span></span>';
    b.tipText = () => (g === 'airfield' ? sn(g) : tr('bp_' + g) + ' · ' + tr('bpn_' + g)) + ' · ' + tr('slotsLeft', Math.max(0, Sim.buildLimit(s, 'blue') - Sim.buildCount(s, 'blue')));
    b.addEventListener('click', () => pickCat(g, b));
    cats.appendChild(b);
  }
  nameBuildMenu();
}
// a kind of building picked (top left): its page opens beside it (the airfield, one of a kind, is armed at once);
// with no free slot the button is dimmed, and pressing it flashes it and the way out: 🏕️
function pickCat(g, b) {
  const m = $('buildm');
  if (s.hqPending && s.hqPending.blue) { blink($('hqb')); const r = b.getBoundingClientRect(), st = $('stage').getBoundingClientRect(); toast(tr('why').nohq, r.right - st.left + 60, r.top - st.top + 20); return; }
  if (buildFull()) { blink(b); if (!$('fhq').hidden) blink($('fhq')); return; }
  const open = !m.hidden && m.dataset.open === g;
  buildArmed = null; m.hidden = true; m.classList.remove('side');
  if (!open) {
    if (g === 'airfield') buildArmed = 'airfield';
    else { m.dataset.open = g; m.classList.add('side'); m.style.setProperty('--bmTop', (b.getBoundingClientRect().top - $('stage').getBoundingClientRect().top) + 'px'); m.hidden = false; showBuildPage(g); }
  }
  hideTip(); syncButtons();
}
// what the column shows: the kinds this game allows; all dimmed with no free slot (or before the HQ stands)
function syncCats() {
  const root = new Set(pageItems('root')), full = buildFull() || !!(s.hqPending && s.hqPending.blue), m = $('buildm');
  for (const b of document.querySelectorAll('[data-cat]')) {
    const g = b.dataset.cat;
    b.hidden = !root.has(g === 'airfield' ? g : 'page:' + g);
    b.setAttribute('aria-disabled', String(full && !buildArmed));
    b.classList.toggle('can', !full && !buildArmed && m.hidden && !b.hidden && !!s.t); // (room to build: the halo)
    b.setAttribute('aria-expanded', String(g === 'airfield' ? buildArmed === 'airfield' : !m.hidden && m.dataset.open === g || !!buildArmed && pageHas(g, buildArmed)));
  }
}
const pageHas = (g, k) => BUILD_PAGES[g].some(e => e.startsWith('page:') ? pageHas(e.slice(5), k) : e === k);
function drawPic(cv, kind) { const g = cv.getContext('2d'); g.clearRect(0, 0, 84, 84); const src = buildingPic(kind, colors.blue, kind === 'decoy' ? 34 : 40); const m = src.width * 0.17; g.drawImage(src, m, m, src.width - 2 * m, src.width - 2 * m, 0, 0, 84, 84); }
function nameBuildMenu() {
  for (const b of document.querySelectorAll('[data-build]')) {
    const S = Sim.STRUCTS[b.dataset.build];
    b.querySelector('b').textContent = sn(b.dataset.build);
    const pic = b.querySelector('canvas'); if (pic) drawPic(pic, b.dataset.build);
    b.querySelector('small').textContent = S.unit ? tr('buildItem', S.every, tn(S.unit)) : tr('decoyItem', Sim.DECOY_MAX);
  }
  for (const b of document.querySelectorAll('[data-cat]')) {
    const g = b.dataset.cat; b.querySelector('span').textContent = g === 'airfield' ? sn(g) : tr('bp_' + g);
    const c = b.querySelector('canvas'), x = c.getContext('2d'), src = buildingPic(PAGE_PIC[g] || g, colors.blue, 40), mm = src.width * 0.17;
    x.clearRect(0, 0, 96, 96); x.drawImage(src, mm, mm, src.width - 2 * mm, src.width - 2 * mm, 0, 0, 96, 96);
  }
  for (const b of document.querySelectorAll('[data-page]')) {
    const g = b.dataset.page; b.querySelector('b').textContent = tr('bp_' + g);
    b.querySelector('small').textContent = tr('bpn_' + g);
    const pic = b.querySelector('canvas'); if (pic) drawPic(pic, PAGE_PIC[g]);
  }
}
// what this game allows on a page (buildings, and sub-pages with anything allowed in them)
const buildOk = k => !(k === 'decoy' ? !!s.level : !!s.builds && !s.builds.includes(k));
const pageItems = g => BUILD_PAGES[g].filter(e => e.startsWith('page:') ? pageItems(e.slice(5)).length > 0 : buildOk(e));
// open a page (one with a single sub-page in it opens that one instead)
function showBuildPage(g) {
  let l = pageItems(g);
  while (l.length === 1 && l[0].startsWith('page:')) { g = l[0].slice(5); l = pageItems(g); }
  buildPage = g;
  const on = new Set(l);
  for (const b of $('buildm').querySelectorAll('[data-build],[data-page]')) b.classList.toggle('pg', on.has(b.dataset.build || 'page:' + b.dataset.page));
  const back = $('buildm').querySelector('.bback'); back.hidden = g === 'root' || !BUILD_UP[g] || pageItems(BUILD_UP[g]).length < 2;
  hideTip();
}
// the menu offers what this game allows (the tutorial adds kinds level by level; a page with something new pulses)
function syncBuildMenu(fresh) {
  for (const b of document.querySelectorAll('[data-build]')) {
    b.hidden = !buildOk(b.dataset.build);
    b.classList.toggle('new', fresh.includes(b.dataset.build));
  }
  const has = g => BUILD_PAGES[g].some(e => e.startsWith('page:') ? has(e.slice(5)) : fresh.includes(e));
  for (const b of document.querySelectorAll('[data-page]')) b.classList.toggle('new', has(b.dataset.page));
  for (const b of document.querySelectorAll('[data-cat]')) b.classList.toggle('new', b.dataset.cat === 'airfield' ? fresh.includes('airfield') : has(b.dataset.cat));
}
const buildFull = () => Sim.buildCount(s, 'blue') >= Sim.buildLimit(s, 'blue');
const blink = el => { el.classList.remove('blink'); void el.offsetWidth; el.classList.add('blink'); };
// no free slot: the button is dimmed, and pressing it anyway flashes it and the way out: 🏕️
function toggleBuild() {
  const m = $('buildm');
  if (!buildArmed && m.hidden && s.hqPending && s.hqPending.blue) { blink($('hqb')); const r = $('bld').getBoundingClientRect(), st = $('stage').getBoundingClientRect(); toast(tr('why').nohq, r.left - st.left + r.width / 2, r.top - st.top - 30); return; }
  if (!buildArmed && m.hidden && buildFull()) { blink($('bld')); if (!$('fhq').hidden) blink($('fhq')); return; }
  if (buildArmed) { buildArmed = null; m.hidden = true; } else m.hidden = !m.hidden;
  m.classList.add('side'); m.dataset.open = 'root'; m.style.setProperty('--bmTop', '8px');
  if (!m.hidden) showBuildPage('root');
  syncButtons();
}
$('bld').addEventListener('click', toggleBuild);
// a world point on the screen (stage pixels)
const onScreen = (x, y) => ({ x: view.cox + x * view.css, y: view.coy + y * view.css });
// (with Shift: another of the same right after, while there's room for one)
function placeBuilding(x, y, again) {
  const why = Sim.buildCheck(s, 'blue', x, y, buildArmed);
  if (why) { const p = onScreen(x, y); toast(tr('why')[why], p.x, p.y); } else Sim.build(s, 'blue', buildArmed, x, y, pickedDozer());
  const room = buildArmed === 'decoy' ? s.nodes.filter(n => n.side === 'blue' && n.kind === 'decoy' && n.hp > 0).length < Sim.DECOY_MAX : Sim.buildCount(s, 'blue') < Sim.buildLimit(s, 'blue');
  if (!why && !(again && room)) buildArmed = null;
  syncButtons(); updateHud();
}
document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
  diff = b.dataset.diff; s.diff = diff; try { localStorage.setItem('irts-diff', diff); } catch (e) { /* ignore */ }
  syncButtons();
}));
// the intro has no words: the level path and ▶ (and the language). The full game (∞) adds its settings.
// the menu's pictures (when tools/tiles.py found them)
if (typeof MENU_ART === 'object') for (const [k, v] of [['--menuArt', MENU_ART.wide], ['--menuArtTall', MENU_ART.tall]]) if (v) $('intro').style.setProperty(k, `url("${new URL(v, location.href).href}")`); // (in full: a url() in a variable is read relative to the stylesheet)
// the moving one: plays only while the menu shows (and not for reduced motion); fades in once it's running
const menuVid = $('menuVid'), vidOk = typeof MENU_ART === 'object' && MENU_ART.video && !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (vidOk) { menuVid.src = MENU_ART.video; menuVid.addEventListener('playing', () => menuVid.classList.add('on')); }
function menuVideo(on) { if (!vidOk) return; if (on) menuVid.play().catch(() => { /* not allowed yet: the still picture stays */ }); else menuVid.pause(); }
// music, radio, explosions and full screen live in the in-game settings; on the main menu, under "more settings"
const SHARED_ROWS = ['music', 'radio', 'sfx', 'fs'].map(id => $(id).closest('.mrow'));
function moveShared(toMenu) { const box = toMenu ? $('moreBox') : $('menu'), before = toMenu ? null : $('menu').querySelector('[data-lang]').closest('.mrow'); for (const r of SHARED_ROWS) box.insertBefore(r, before); }
function showIntro(on) {
  $('intro').hidden = !on; Tracks.setMode(on ? 'menu' : 'game'); menuVideo(on); moveShared(on); if (!on) return;
  hideTip(); sidePage('main'); renderLevels(); setPlaying(false); $('go').focus();
}
// the side panel's pages: the settings, or the tutorial's levels
function sidePage(p) { $('sideMain').hidden = p !== 'main'; $('sideLevels').hidden = p !== 'levels'; }
$('learn').addEventListener('click', () => { renderLevels(); sidePage('levels'); });
$('lvBack').addEventListener('click', () => sidePage('main'));
$('moreBtn').addEventListener('click', () => { const b = $('moreBox'); b.hidden = !b.hidden; $('moreBtn').setAttribute('aria-expanded', String(!b.hidden)); });
// a game starts: the full one (no tutorial: as if it were skipped), or a tutorial level with its tour
function startGame(level) {
  if (fsWant && fsCan()) fullScreen(true);
  lvl = level; newGame(true); showIntro(false);
  // a tutorial level, once per visit: the goal in a few words and what's new, one by one, then the fight
  // (irts-tour = 99: never — the UI tests)
  if (lvl && toured !== 99 && !tourSeen.has(lvl)) { tourSeen.add(lvl); toured = Math.max(toured, lvl); try { localStorage.setItem('irts-tour', String(toured)); } catch (e) { /* ignore */ } runTour(levelTour(lvl), () => setPlaying(true)); }
  else setPlaying(true);
}
function renderLevels() {
  const box = $('levels'); box.textContent = ''; box.setAttribute('aria-label', tr('level', ''));
  for (let n = 1; n <= Sim.LEVELS + 1; n++) {
    if (n > Sim.LEVELS) break; // (the tutorial's levels only: the full game is "start")
    const k = n, b = document.createElement('button');
    b.textContent = k ? String(k) : '∞'; b.setAttribute('aria-label', k ? tr('level', k) : tr('full'));
    b.setAttribute('aria-pressed', String(k === lvl)); b.classList.toggle('won', !!k && k <= done);
    b.disabled = !!k && k > done + 1; // a level opens when the one before it is won; the full game is always open
    b.addEventListener('click', () => startGame(k));
    box.appendChild(b);
  }
}
$('go').addEventListener('click', () => startGame(0));
// the tour: what each level step brings, pointing at its control (or at a spot on the map for what has none)
let toured = 0; const tourSeen = new Set();
try { toured = +localStorage.getItem('irts-tour') || 0; } catch (e) { /* storage unavailable */ }
const pctLose = () => Math.round((s.collapseAt ?? 0.15) * 100);
// a spot on the map, on the screen (for the tour's bubble)
const mapSpot = f => () => { const w = f(); if (!w) return null; const p = onScreen(w.x, w.y); return { x: p.x, y: p.y, w: 30, h: 30 }; };
const ourSquad = mapSpot(() => { const q = s.squads.find(q => q.side === 'blue' && !q.dead); return q && { x: q.cx, y: q.cy - 10 }; });
const foeSquad = mapSpot(() => { const q = s.squads.find(q => q.side === 'red' && !q.dead); return q && { x: q.cx, y: q.cy }; });
const ourType = type => mapSpot(() => { const q = s.squads.find(q => q.side === 'blue' && !q.dead && q.type === type); return q && { x: q.cx, y: q.cy }; });
const ourHq = mapSpot(() => s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'));
const midMap = () => fit && { x: fit.w / 2, y: fit.top + fit.h / 2, w: 0, h: 0 };
const TOUR = {
  squads: () => [{ el: 'gSq', t: tr('t_squads') }],
  orders: () => [{ el: ourHq, t: tr('t_hq') }], // (no order button: H/A/R on the keys)
  build: () => [{ el: 'bcats', t: tr('t_build') + ' ' + tr('t_slots') }],
  vehicles: () => [{ el: 'bcats', t: tr('t_vehicles') }],
  care: () => [{ el: 'bcats', t: tr('t_care') }],
  air: () => [{ el: 'bcats', t: tr('t_air') }],
  fog: () => [{ el: midMap, t: tr('t_fog', !!s.fogAt && s.t < s.fogAt) }],
  eye: () => [{ el: 'eye', t: tr('t_eye') }],
  c2: () => [{ el: ourHq, t: tr('t_c2') }],
  fhq: () => [{ el: 'fhq', t: tr(s.dozers ? 't_fhqDz' : 't_fhq') }],
  support: () => [{ el: 'hqb', t: tr('t_placeDz') }, { el: ourType('dozer'), t: tr('t_dozer') }, { el: ourType('radio'), t: tr('t_radio') }],
};
function levelTour(n) {
  // level 1: the goal, your force and the enemy's, the power bar, a tap on the map, pausing
  if (n === 1) return [{ el: midMap, t: tr('t_goal1') }, { el: ourSquad, t: tr('t_you') }, { el: 'power', t: tr('t_power', pctLose()) }, { el: foeSquad, t: tr('t_click') }, { el: 'gear', t: tr('t_play') }];
  const fresh = Sim.levelUi(n).filter(k => !Sim.levelUi(n - 1).includes(k));
  // every other level opens with its number, the goal and what it adds, then points at each new thing
  const out = [{ el: midMap, t: tr('t_level', n, Sim.LEVELS, !!s.nodes.some(k => k.side === 'red' && k.kind === 'hq'), pctLose()) }, ...fresh.flatMap(k => TOUR[k] ? TOUR[k]() : [])];
  if (fresh.includes('squads')) out.push({ el: ourSquad, t: tr('t_face') });
  return out;
}
// ❔: everything this game has, in one tour (paused meanwhile)
// the full game: the goal, placing the HQ, what's new (fake HQ, radio silence, night), the bigger maps
function freeTour() {
  const out = [{ el: midMap, t: tr('t_free', pctLose()) }];
  if (hqToPlace()) out.push({ el: 'hqb', t: tr('t_placeHq') });
  out.push({ el: 'bcats', t: tr('t_decoy') }, { el: 'power', t: tr('t_night') });
  if (s.scale > 1) out.push({ el: 'fhq', t: tr('t_scale', s.scale) });
  out.push({ el: 'gear', t: tr('t_play') });
  return out;
}
function fullTour() {
  setPlaying(false);
  const steps = [{ el: 'power', t: tr('t_power', pctLose()) }, { el: ourSquad, t: tr('t_click') }];
  for (const k of Object.keys(TOUR)) if (uiHas(k) && (k !== 'fog' || s.fog || s.fogAt)) steps.push(...TOUR[k]());
  if (uiHas('squads')) steps.push({ el: ourSquad, t: tr('t_face') });
  steps.push({ el: 'gear', t: tr('t_play') });
  runTour(steps, () => setPlaying(true));
}
// only the controls this level has; the ones it adds pulse until first used
// (the radio log #log stays hidden for now: the map says it)
const UI_EL = { squads: ['gSq'], orders: ['gOrd'], build: ['bld', 'bcats'], vehicles: ['bld', 'bcats'], care: ['bld', 'bcats'], air: ['bld', 'bcats'], fog: [], eye: ['eye'], c2: [], fhq: ['fhq'], support: [] };
// building kinds each level step brings
const UI_BUILDS = { build: ['tent'], vehicles: ['jeepshop', 'tankshop'], care: ['clinic', 'garage', 'depot'], air: ['aapost', 'atpost', 'jeepaa', 'jeepat', 'airfield'] };
// an element shows when any of the level steps that bring it is there
const UI_EL_ANY = id => Object.keys(UI_EL).some(k => UI_EL[k].includes(id) && uiHas(k));
function applyUi() {
  const fresh = lvl > 1 ? Sim.levelUi(lvl).filter(k => !Sim.levelUi(lvl - 1).includes(k)) : [];
  document.querySelectorAll('.new').forEach(e => e.classList.remove('new'));
  for (const k in UI_EL) for (const id of UI_EL[k]) if (id !== 'eye' && id !== 'fhq') $(id).hidden = !UI_EL_ANY(id);
  syncBuildMenu(fresh.flatMap(k => UI_BUILDS[k] || []));
  for (const k of fresh) for (const id of UI_EL[k] || [k]) $(id).classList.add('new');
  bar.classList.toggle('tut', !!s.ui && s.ui.length < 4);
  document.body.classList.toggle('fullgame', !lvl); // (no squad or order buttons in the full game)
}
document.addEventListener('pointerdown', e => { const n = e.target.closest && e.target.closest('.new'); if (n) n.classList.remove('new'); }, true);
// map size: a new map is made at once (the intro is still up, nothing has happened yet)
document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
  const m = b.dataset.map; if (m === (hugeMap ? 'huge' : bigMap ? 'big' : 'small')) return;
  bigMap = m !== 'small'; hugeMap = m === 'huge'; try { localStorage.setItem('irts-map', m); } catch (e) { /* ignore */ }
  newGame(true); showIntro(true);
}));
document.querySelectorAll('[data-fog]').forEach(b => b.addEventListener('click', () => {
  fog = b.dataset.fog === '1'; s.fog = fog; try { localStorage.setItem('irts-fog', fog ? '1' : '0'); } catch (e) { /* ignore */ }
  syncButtons();
}));
let eyeArmed = false, fogWas = null;
function toggleEye() { eyeArmed = !eyeArmed && s.fog && s.drones.blue.stock > 0; syncButtons(); }
$('eye').addEventListener('click', toggleEye);
// forward HQ: 🏕️, then a spot on the map; the selected jeep / tank squad (or the nearest one) drives there and sets it
// up. With none that can, the squads that could blink (or nothing happens while waiting for the next one).
let fhqArmed = false;
// open field: 🏰, then a spot in our strip; the command tanks drive there and set the HQ up (armed at the start)
let hqArmed = false, hqTold = false;
const hqToPlace = () => !!(s.hqPending && s.hqPending.blue && !s.nodes.some(n => n.side === 'blue' && n.kind === 'hq') && Sim.cmdSquad(s, 'blue'));
const hqPlanned = () => s.squads.some(q => q.side === 'blue' && q.hqAt && !q.dead);
function armHq() { hqArmed = !hqArmed && hqToPlace(); if (hqArmed) { eyeArmed = false; buildArmed = null; fhqArmed = false; $('buildm').hidden = true; } syncButtons(); }
$('hqb').addEventListener('click', armHq);
function placeHq(x, y) {
  const why = Sim.hqCheck(s, 'blue', x, y);
  if (why) { const p = onScreen(x, y); toast(tr('hqWhy')[why] || tr('hqWhy').bad, p.x, p.y); return; }
  Sim.planHq(s, 'blue', x, y, pickedDozer()); hqArmed = false; syncButtons(); updateHud();
}
// the bulldozer picked (one squad of them), if any: it's the one that goes to build
const pickedDozer = () => { const id = oneSel(); const q = id && s.squads.find(q => q.id === id); return q && q.type === 'dozer' ? q.id : undefined; };
const fhqCrews = () => s.squads.filter(q => q.side === 'blue' && Sim.canBuildFhq(s, q));
function buildHere() {
  if (fhqArmed) { fhqArmed = false; syncButtons(); return; }
  if (s.cd.blue.fhq > 0 || Sim.fhqCount(s, 'blue') >= Sim.fhqMax(s)) return;
  if (!fhqCrews().length) { for (const b of document.querySelectorAll('#sqs button')) if (btnIds(b).some(id => Sim.fhqBuilders(s).includes(s.squads.find(q => q.id === id).type))) blink(b); return; }
  fhqArmed = true; eyeArmed = false; buildArmed = null; $('buildm').hidden = true; syncButtons();
}
function placeFhq(x, y) {
  const list = fhqCrews(), picked = list.find(q => isSel(q.id) && sel !== 'all');
  const q = picked || list.sort((a, b) => Math.hypot(pos(a).x - x, pos(a).y - y) - Math.hypot(pos(b).x - x, pos(b).y - y))[0];
  const why = Sim.fhqCheck(s, x, y);
  if (why) { const p = onScreen(x, y); toast(tr('why')[why] || tr('why').bad, p.x, p.y); return; } // (still armed: pick again)
  if (q) Sim.planFhq(s, q.id, x, y);
  fhqArmed = false; syncButtons(); updateHud();
}
// full screen (and landscape, where the phone allows it); a tap on ▶ on a phone goes full screen by itself
const fsEl = document.documentElement;
const fsCan = () => !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function fullScreen(on = !fsOn()) {
  try {
    if (on && !fsOn()) {
      const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' });
      // (full screen: the keys for groups — Ctrl + a number — go to the game, not the browser's tabs)
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not on this device */ } try { navigator.keyboard && navigator.keyboard.lock(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']).catch(() => {}); } catch (e) { /* no keyboard lock */ } }).catch(() => {});
    } else if (!on && fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } catch (e) { /* not allowed here */ }
}
// full screen is on by default; the switch in the settings remembers the choice
let fsWant = true;
try { fsWant = localStorage.getItem('irts-fs') !== '0'; } catch (e) { /* storage unavailable */ }
$('fs').addEventListener('click', () => { const on = !fsOn(); fsWant = on; try { localStorage.setItem('irts-fs', on ? '1' : '0'); } catch (e) { /* ignore */ } fullScreen(on); });
document.addEventListener('fullscreenchange', () => syncButtons());
$('paused').addEventListener('click', () => setPlaying(true));
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
  const text = tr('shareText', s.over === 'blue', fmtTime(s.t), diffName(s.diff));
  try {
    if (navigator.share) await navigator.share({ title: tr('title'), text, url });
    else { await navigator.clipboard.writeText(text + ' ' + url); $('share').textContent = tr('copied'); }
  } catch (e) { /* share cancelled or clipboard blocked */ }
});
$('help').addEventListener('click', () => { closeMenu(false); fullTour(); });
// the main screen, from a game: asked first (the game is left)
$('home').addEventListener('click', () => { $('homeSure').hidden = false; });
$('homeNo').addEventListener('click', () => { $('homeSure').hidden = true; });
$('homeYes').addEventListener('click', () => { $('homeSure').hidden = true; closeMenu(false); newGame(); });
$('gear').addEventListener('click', () => { if (menu.hidden) openMenu(); else closeMenu(); });
// the order symbols (the same as on the map)
$('callHold').innerHTML = orderSvg('hold'); $('callBack').innerHTML = orderSvg('retreat');
$('power').dataset.tip = 'power'; $('power').tipText = () => tr('power', pctLose());
// a new language: the words made by the scripts too
function onLang() {
  nameBuildMenu(); sqKey = ''; renderLevels(); syncRadio(); syncButtons(); updateHud();
  document.querySelectorAll('[data-diff]').forEach(b => { b.textContent = diffName(b.dataset.diff); });
  if (!$('end').hidden) showEnd();
}
document.querySelectorAll('[data-diff]').forEach(b => { b.textContent = diffName(b.dataset.diff); });
