// UI: toolbar, selection, HUD, intro / end screens and the replay
// ---- selection & commands ----
const blueIds = () => blueSquads().map(q => q.id);
const selIds = () => sel === 'all' ? blueIds() : Array.isArray(sel) ? sel : sel ? [sel] : [];
function select(id) { sel = id; syncButtons(); updateHud(); }
// a squad picked on the map (or by its building): its whole group, if it's in one
function pickSquad(id) { const g = groupOf(id); select(g ? g.ids.slice() : id); }
// fa: the way the front should face (a drag), else toward the enemy
function issue(type, x, y, fa) {
  const all = sel === 'all';
  const ids = all ? s.squads.filter(q => q.side === 'blue' && !q.dead).map(q => q.id) : selIds();
  if (!ids.length) return; // nothing picked: nothing to order
  // several together (all, a group, a type, a rectangle): rows facing the enemy (tanks in front … medics and mechanics
  // at the back); one alone: its own line
  let ok = false;
  if (ids.length > 1) ok = Sim.formation(s, ids, type, x, y, true, fa);
  else for (const id of ids) ok = Sim.order(s, id, type, x, y, false, Number.isFinite(fa) ? { fa } : undefined) || ok;
  if (ok && all) Sim.note(s, 'כל הכוחות: ' + (type === 'hold' ? 'מחזיקים עמדה' : type === 'attack' ? 'תוקפים את האזור' : 'נסוגים הביתה'));
  updateHud();
}
function setPlaying(p) { if (s.over) p = false; playing = p; syncButtons(); }
// the settings stop the game while they're open, and closing them goes on
function openMenu() { if (!menu.hidden) return; menu.hidden = false; $('gear').setAttribute('aria-expanded', 'true'); hideTip(); setPlaying(false); placeFloating(); syncButtons(); }
function closeMenu(go = true) {
  if (menu.hidden) return;
  menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false');
  if (go && $('intro').hidden && $('end').hidden) setPlaying(true); else syncButtons();
}

function syncButtons() {
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
  cv.style.cursor = eyeArmed ? 'zoom-in' : buildArmed || fhqArmed || hqArmed ? 'copy' : '';
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
  $('slotN').textContent = Sim.buildCount(s, 'blue') + '/' + Sim.buildLimit(s, 'blue');
  $('bld').setAttribute('aria-disabled', String(buildFull() && !buildArmed));
  // while there's room for another building, 🏗️ pulses: build more
  $('bld').classList.toggle('nudge', !!s.t && !buildFull() && !buildArmed && $('buildm').hidden && !s.over && playing && !(s.hqPending && s.hqPending.blue));
  // open field: 🏰 pulses until a spot is picked; the first time, a note on the map says so
  $('hqb').hidden = !hqToPlace(); $('hqb').classList.toggle('nudge', hqToPlace() && !hqPlanned() && !hqArmed);
  if (hqToPlace() && !hqPlanned() && playing && !hqTold && fit) { hqTold = true; const [a, b] = Sim.hqBand(s, 'blue'), p = onScreen((a + b) / 2, s.H / 2); toast(tr('placeHq'), Math.max(120, p.x), Math.min(fit.top + fit.h - 60, Math.max(fit.top + 60, p.y))); }
  // and 🏕️ pulses whenever a forward HQ can be set up
  $('fhq').classList.toggle('nudge', uiHas('fhq') && !!s.t && playing && !fhqArmed && s.cd.blue.fhq <= 0 && Sim.fhqCount(s, 'blue') < Sim.fhqMax(s) && fhqBuilders().length > 0);
  renderSquadButtons();
  // drones: how many in hand, and a bar until the next one; forward HQ: seconds until the next, and a refill bar
  const cd = s.cd.blue, N = Sim.NODES, D = s.drones.blue;
  $('eyeN').textContent = D.stock || ''; $('eye').disabled = D.stock < 1 && !eyeArmed;
  $('eye').style.setProperty('--p', D.stock + Sim.dronesUp(s, 'blue') >= N.drone.max ? '1' : (1 - D.next / N.drone.every).toFixed(2));
  const bsq = oneSel() && s.squads.find(q => q.id === oneSel());
  $('fhqN').textContent = Sim.fhqCount(s, 'blue') >= Sim.fhqMax(s) ? Sim.fhqMax(s) + '/' + Sim.fhqMax(s) : cd.fhq > 0 ? Math.ceil(cd.fhq) : ''; $('fhq').setAttribute('aria-disabled', String(!Sim.canBuildFhq(s, bsq)));
  if (s.fog !== fogWas) { fogWas = s.fog; syncButtons(); } // the tutorial's fog comes down mid-level
  $('fhq').style.setProperty('--p', (1 - cd.fhq / N.fhq.every).toFixed(2));
  $('bb').hidden = Sim.boost(s, 'blue') < 0.05; $('moon').hidden = Sim.nightAt(s) < 0.5;
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
  if (s.over && !endShown) { endShown = true; setPlaying(false); showEnd(); }
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
// Groups (this game only, in the UI): squads tied together with 🔗 act as one — picked together (also by tapping any
// of them on the map), ordered together, in rows facing the enemy; ✂ unties them. A squad is in one group at most;
// a group down to one squad is gone.
const TYPE_KEYS = ['tank', 'inf', 'at', 'jeep', 'tjeep', 'ajeep', 'aa', 'air', 'med', 'mech', 'truck'];
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
  select(ids.length === 1 ? ids[0] : ids.slice());
}
function toggleGroup() {
  const g = selGroup();
  if (g) groups = groups.filter(x => x !== g);
  else {
    const alive = aliveBlue(), ids = selIds().filter(id => alive.has(id)); if (sel === 'all' || ids.length < 2) return;
    for (const x of groups) x.ids = x.ids.filter(id => !ids.includes(id)); // out of any group they were in
    groups.push({ id: nextGroup++, ids });
  }
  renderSquadButtons(); syncButtons();
}
$('grp').addEventListener('click', toggleGroup);
let sqKey = '';
function renderSquadButtons() {
  // what's picked, and the groups, stay among the living
  const alive = aliveBlue();
  if (Array.isArray(sel)) { const l = sel.filter(id => alive.has(id)); if (l.length !== sel.length) sel = l.length > 1 ? l : l[0] || null; }
  else if (sel && sel !== 'all' && !alive.has(sel)) sel = null;
  for (const g of groups) g.ids = g.ids.filter(id => alive.has(id));
  groups = groups.filter(g => g.ids.length > 1);
  const types = TYPE_KEYS.filter(ty => typeIds(ty).length);
  const key = groups.map(g => g.id + ':' + g.ids.join('.')).join() + '|' + types.join() + lang;
  if (key === sqKey) return;
  sqKey = key; const box = $('sqs'); box.textContent = '';
  const typeOf = id => s.squads.find(q => q.id === id).type;
  const add = (b, n, name, icon, ids) => {
    b.classList.add('sqb'); b.innerHTML = '<canvas width="64" height="64"></canvas><kbd></kbd><i></i>';
    b.querySelector('kbd').textContent = n <= 9 ? n : ''; b.setAttribute('aria-label', name() + (n <= 9 ? ` (${n})` : ''));
    b.dataset.tip = 'sq'; b.tipText = () => name() + (n <= 9 ? ` (${n})` : '');
    icon(b.querySelector('canvas')); b.addEventListener('click', () => pickIds(ids()));
    box.appendChild(b);
  };
  let n = 0;
  for (const g of groups) {
    const b = document.createElement('button'); b.dataset.gr = g.id; b.classList.add('grb');
    const kinds = () => TYPE_KEYS.filter(ty => g.ids.some(id => typeOf(id) === ty));
    add(b, ++n, () => tr('group') + ': ' + kinds().map(ty => `${tn(ty)} ×${g.ids.filter(id => typeOf(id) === ty).length}`).join(', '), c => drawGroupIcon(c, kinds()), () => g.ids);
  }
  for (const ty of types) {
    const b = document.createElement('button'); b.dataset.ty = ty;
    add(b, ++n, () => `${tn(ty)} ×${typeIds(ty).length}`, c => drawSquadIcon(c, ty), () => typeIds(ty));
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
  const c = cvs.getContext('2d'), k = { air: 28, tank: 21, jeep: 23, ajeep: 23, tjeep: 23, mech: 19, truck: 21 }[type] || 28;
  c.clearRect(0, 0, 64, 64);
  const x = type === 'tank' ? 25 : type === 'mech' ? 40 : type === 'inf' || type === 'aa' || type === 'at' ? 29 : 32, y = type === 'inf' || type === 'med' || type === 'aa' || type === 'at' ? 35 : 32;
  glyph(c, type, x, y, k, colors.blue, colors.outline, type === 'air' ? -Math.PI / 4 : 0, type === 'aa' ? -Math.PI / 4 : 0, 2.2);
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
function initBuildMenu() {
  const m = $('buildm');
  for (const k of Sim.BUILDABLE) {
    const b = document.createElement('button');
    b.dataset.build = k; b.dataset.tip = 'b_' + k; b.innerHTML = '<span></span><b></b><small></small>';
    const pic = document.createElement('canvas'); pic.width = pic.height = 84; pic.className = 'bpic'; b.querySelector('span').appendChild(pic); // (drawn in nameBuildMenu, in our colour)
    if (k === 'decoy') { const i = document.createElement('i'); i.textContent = Sim.STRUCTS[k].badge; b.querySelector('span').appendChild(i); }
    b.addEventListener('click', () => { buildArmed = k; m.hidden = true; hideTip(); syncButtons(); });
    m.appendChild(b);
  }
  nameBuildMenu();
}
function nameBuildMenu() {
  for (const b of document.querySelectorAll('[data-build]')) {
    const S = Sim.STRUCTS[b.dataset.build];
    b.querySelector('b').textContent = sn(b.dataset.build);
    const pic = b.querySelector('canvas'); if (pic) { const g = pic.getContext('2d'); g.clearRect(0, 0, 84, 84); const src = buildingPic(b.dataset.build, colors.blue, b.dataset.build === 'decoy' ? 34 : 40); const m = src.width * 0.17; g.drawImage(src, m, m, src.width - 2 * m, src.width - 2 * m, 0, 0, 84, 84); } b.querySelector('small').textContent = S.unit ? tr('buildItem', S.every, tn(S.unit)) : tr('decoyItem', Sim.DECOY_MAX);
  }
}
// the menu offers what this game allows (the tutorial adds kinds level by level)
function syncBuildMenu(fresh) {
  for (const b of document.querySelectorAll('[data-build]')) {
    b.hidden = b.dataset.build === 'decoy' ? !!s.level : !!s.builds && !s.builds.includes(b.dataset.build);
    b.classList.toggle('new', fresh.includes(b.dataset.build));
  }
}
const buildFull = () => Sim.buildCount(s, 'blue') >= Sim.buildLimit(s, 'blue');
const blink = el => { el.classList.remove('blink'); void el.offsetWidth; el.classList.add('blink'); };
// no free slot: the button is dimmed, and pressing it anyway flashes it and the way out: 🏕️
function toggleBuild() {
  const m = $('buildm');
  if (!buildArmed && m.hidden && s.hqPending && s.hqPending.blue) { blink($('hqb')); const r = $('bld').getBoundingClientRect(), st = $('stage').getBoundingClientRect(); toast(tr('why').nohq, r.left - st.left + r.width / 2, r.top - st.top - 30); return; }
  if (!buildArmed && m.hidden && buildFull()) { blink($('bld')); if (!$('fhq').hidden) blink($('fhq')); return; }
  if (buildArmed) { buildArmed = null; m.hidden = true; } else m.hidden = !m.hidden;
  syncButtons();
}
$('bld').addEventListener('click', toggleBuild);
// a world point on the screen (stage pixels)
const onScreen = (x, y) => ({ x: view.cox + x * view.css, y: view.coy + y * view.css });
function placeBuilding(x, y) {
  const why = Sim.buildCheck(s, 'blue', x, y, buildArmed);
  if (why) { const p = onScreen(x, y); toast(tr('why')[why], p.x, p.y); } else Sim.build(s, 'blue', buildArmed, x, y);
  if (!why) buildArmed = null;
  syncButtons(); updateHud();
}
document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
  diff = b.dataset.diff; s.diff = diff; try { localStorage.setItem('irts-diff', diff); } catch (e) { /* ignore */ }
  syncButtons();
}));
// the intro has no words: the level path and ▶ (and the language). The full game (∞) adds its settings.
function showIntro(on) {
  $('intro').hidden = !on; if (!on) return;
  hideTip(); $('freeOpts').hidden = !!lvl; renderLevels(); setPlaying(false); $('go').focus();
}
function renderLevels() {
  const box = $('levels'); box.textContent = ''; box.setAttribute('aria-label', tr('level', ''));
  for (let n = 1; n <= Sim.LEVELS + 1; n++) {
    const k = n > Sim.LEVELS ? 0 : n, b = document.createElement('button');
    b.textContent = k ? String(k) : '∞'; b.setAttribute('aria-label', k ? tr('level', k) : tr('full'));
    b.setAttribute('aria-pressed', String(k === lvl)); b.classList.toggle('won', !!k && k <= done);
    b.disabled = !!k && k > done + 1; // a level opens when the one before it is won; the full game is always open
    b.addEventListener('click', () => { if (k === lvl) return; lvl = k; newGame(); });
    box.appendChild(b);
  }
}
$('go').addEventListener('click', () => {
  if (fsWant && fsCan()) fullScreen(true);
  showIntro(false);
  // each level (and the full game), once per visit: the goal in a few words and what's new, one by one, then the fight
  // (irts-tour = 99: never — the UI tests)
  if (toured !== 99 && !s.t && !tourSeen.has(lvl)) { tourSeen.add(lvl); toured = Math.max(toured, lvl); try { localStorage.setItem('irts-tour', String(toured)); } catch (e) { /* ignore */ } runTour(lvl ? levelTour(lvl) : freeTour(), () => setPlaying(true)); }
  else setPlaying(true);
});
// the tour: what each level step brings, pointing at its control (or at a spot on the map for what has none)
let toured = 0; const tourSeen = new Set();
try { toured = +localStorage.getItem('irts-tour') || 0; } catch (e) { /* storage unavailable */ }
const pctLose = () => Math.round((s.collapseAt ?? 0.15) * 100);
// a spot on the map, on the screen (for the tour's bubble)
const mapSpot = f => () => { const w = f(); if (!w) return null; const p = onScreen(w.x, w.y); return { x: p.x, y: p.y, w: 30, h: 30 }; };
const ourSquad = mapSpot(() => { const q = s.squads.find(q => q.side === 'blue' && !q.dead); return q && { x: q.cx, y: q.cy - 10 }; });
const foeSquad = mapSpot(() => { const q = s.squads.find(q => q.side === 'red' && !q.dead); return q && { x: q.cx, y: q.cy }; });
const ourHq = mapSpot(() => s.nodes.find(n => n.side === 'blue' && n.kind === 'hq'));
const midMap = () => fit && { x: fit.w / 2, y: fit.top + fit.h / 2, w: 0, h: 0 };
const TOUR = {
  squads: () => [{ el: 'gSq', t: tr('t_squads') }],
  orders: () => [{ el: 'ordMode', t: tr('t_order') }, { el: ourHq, t: tr('t_hq') }],
  build: () => [{ el: 'bld', t: tr('t_build') + ' ' + tr('t_slots') }],
  vehicles: () => [{ el: 'bld', t: tr('t_vehicles') }],
  care: () => [{ el: 'bld', t: tr('t_care') }],
  air: () => [{ el: 'bld', t: tr('t_air') }],
  fog: () => [{ el: midMap, t: tr('t_fog', !!s.fogAt && s.t < s.fogAt) }],
  eye: () => [{ el: 'eye', t: tr('t_eye') }],
  c2: () => [{ el: ourHq, t: tr('t_c2') }],
  fhq: () => [{ el: 'fhq', t: tr('t_fhq') }],
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
  out.push({ el: 'bld', t: tr('t_decoy') }, { el: 'silent', t: tr('t_silent') }, { el: 'power', t: tr('t_night') });
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
const UI_EL = { squads: ['gSq'], orders: ['gOrd'], build: ['bld'], vehicles: ['bld'], care: ['bld'], air: ['bld'], fog: [], eye: ['eye'], c2: [], fhq: ['fhq'] };
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
const hqPlanned = () => { const c = Sim.cmdSquad(s, 'blue'); return !!(c && c.hqAt); };
function armHq() { hqArmed = !hqArmed && hqToPlace(); if (hqArmed) { eyeArmed = false; buildArmed = null; fhqArmed = false; $('buildm').hidden = true; } syncButtons(); }
$('hqb').addEventListener('click', armHq);
function placeHq(x, y) {
  const why = Sim.hqCheck(s, 'blue', x, y);
  if (why) { const p = onScreen(x, y); toast(tr('hqWhy')[why] || tr('hqWhy').bad, p.x, p.y); return; }
  Sim.planHq(s, 'blue', x, y); hqArmed = false; syncButtons(); updateHud();
}
const fhqBuilders = () => s.squads.filter(q => q.side === 'blue' && Sim.canBuildFhq(s, q));
function buildHere() {
  if (fhqArmed) { fhqArmed = false; syncButtons(); return; }
  if (s.cd.blue.fhq > 0 || Sim.fhqCount(s, 'blue') >= Sim.fhqMax(s)) return;
  if (!fhqBuilders().length) { for (const b of document.querySelectorAll('#sqs button')) if (btnIds(b).some(id => ['jeep', 'ajeep', 'tjeep', 'tank'].includes(s.squads.find(q => q.id === id).type))) blink(b); return; }
  fhqArmed = true; eyeArmed = false; buildArmed = null; $('buildm').hidden = true; syncButtons();
}
function placeFhq(x, y) {
  const list = fhqBuilders(), picked = list.find(q => isSel(q.id) && sel !== 'all');
  const q = picked || list.sort((a, b) => Math.hypot(pos(a).x - x, pos(a).y - y) - Math.hypot(pos(b).x - x, pos(b).y - y))[0];
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
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not on this device */ } }).catch(() => {});
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
// 🏠: back to the level screen (▶ there goes on with this game; a level starts a new one)
$('home').addEventListener('click', () => { closeMenu(false); showIntro(true); });
$('gear').addEventListener('click', () => { if (menu.hidden) openMenu(); else closeMenu(); });
$('restart').addEventListener('click', () => { closeMenu(false); newGame(); });
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
