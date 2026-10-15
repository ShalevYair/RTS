// UI: the Alt + click wheel (the full game) round a spot on the map — one wheel, a topic inside a topic: forces (by
// kind — tanks, jeeps ▸ light / AT / AA, soldiers ▸ …), supplies (fuel, ammunition, water), and what's asked of the
// partner (fire, a site built first). Each the unit itself, small, with how many there are (ours and the partner's
// alike); what there's none of isn't there. On a kind: a click brings a third of them, the nearest; held, the number
// counts up every SUM_STEP_MS (a third, then on in steps of a seventh, to all of them) and letting go sends that many.
// On a topic of several kinds: a click opens it, held — the same count over all its kinds. Those in a fight go when
// it's over (Sim.summon). Every ask on the map: its icon with a ring that pulses (blue ours, yellow the partner's),
// fading over Sim.ASK_T. The partner's asks of us: in the message list (a click takes the camera there), and said on
// the radio.
const ASK_ICON = { fuel: '⛽', ammo: '📦', water: '💧', fire: '🎯', lift: '🚁', guard: '🛡️', build: '🏗️', radio: '📡' }, ASK_WHEEL_R = 62;
const SUM_TREE = [
  { k: 'forces', pic: 'tank', kids: [
    { k: 'tank', types: ['tank'] },
    { k: 'jeeps', pic: 'jeep', kids: [{ k: 'jeep', types: ['jeep'] }, { k: 'tjeep', types: ['tjeep'] }, { k: 'ajeep', types: ['ajeep'] }] },
    { k: 'foot', pic: 'inf', kids: [{ k: 'inf', types: ['inf'] }, { k: 'at', types: ['at'] }, { k: 'aa', types: ['aa'] }, { k: 'commando', types: ['commando'] }] },
    { k: 'planes', pic: 'air', kids: [{ k: 'air', types: ['air'] }, { k: 'tanker', types: ['tanker'] }] },
    { k: 'helis', pic: 'heli', kids: [{ k: 'heli', types: ['heli'] }, { k: 'gunship', types: ['gunship'] }, { k: 'lift', types: ['lift'] }] },
    { k: 'guns', pic: 'how', kids: [{ k: 'how', types: ['how'] }, { k: 'mlrs', types: ['mlrs'] }] },
    { k: 'rockets', pic: 'ssm', kids: [{ k: 'ssm', types: ['ssm'] }, { k: 'arrow', types: ['arrow'] }, { k: 'dome', types: ['dome'] }] },
    { k: 'carers', pic: 'med', kids: [{ k: 'med', types: ['med'] }, { k: 'mech', types: ['mech'] }] },
    { k: 'radio', types: ['radio'] },
  ] },
  { k: 'supply', pic: 'fueltruck', kids: [{ k: 'fuel', pic: 'fueltruck', types: ['fueltruck'], ask: 'fuel' }, { k: 'ammo', pic: 'truck', types: ['truck'], ask: 'ammo' }, { k: 'water', pic: 'watertruck', types: ['watertruck'], ask: 'water' }] },
  { k: 'fire', ask: 'fire', emoji: '🎯' },
  { k: 'build', ask: 'build', pic: 'dozer' },
];
const SUM_HOLD_MS = 450, SUM_STEP_MS = 500, SUM_GAP = 60; // (SUM_GAP: px between the buttons round the ring)
let askSeen = 0, wheel = null;
// the squads of ours and the partner's of these kinds (not the bulldozers: their sites), and how many units in them
function sumSquads(types) {
  return s.squads.filter(q => q.side === 'blue' && !q.dead && !q.aboard && types.includes(q.type) && (Sim.ownSquad(s, q) || s.mate) && s.units.some(u => u.squad === q.id));
}
const sumUnits = qs => { let n = 0; for (const q of qs) for (const u of s.units) if (u.squad === q.id) n++; return n; };
const sumTypes = n => n.types || (n.kids || []).flatMap(sumTypes);
// what a node of the tree offers now: forces / supplies by their count; an ask by whether the partner can
const sumCount = n => n.types || n.kids ? sumUnits(sumSquads(sumTypes(n))) : 0;
function sumShown(n) {
  if (n.kids) return n.kids.some(sumShown);
  if (n.types && sumCount(n) > 0) return true;
  return !!n.ask && !!s.arms && Sim.canAsk(s, 'blue', 'me', n.ask) && (n.ask !== 'build' || !!(wheel && Sim.siteNear(s, 'blue', wheel.x, wheel.y))); // (build first: only by a site of ours)
}
// its picture: the unit itself, small, in our colour (cached)
const sumPics = {};
function sumPic(type) {
  const key = type + colors.blue; if (sumPics[key]) return sumPics[key];
  const c = document.createElement('canvas'); c.width = c.height = 64; drawSquadIcon(c, type); return (sumPics[key] = c.toDataURL());
}
const sumName = n => Sim.TYPES[n.k] ? tn(n.k) : tr('sum_' + n.k);
function openAskWheel(e, x, y) {
  closeAskWheel();
  const st = $('stage').getBoundingClientRect(), w = document.createElement('div');
  w.id = 'askWheel'; w.style.left = (e.clientX - st.left) + 'px'; w.style.top = (e.clientY - st.top) + 'px';
  wheel = { el: w, x, y, path: [], cx: e.clientX, cy: e.clientY };
  $('stage').appendChild(w);
  if (!wheelShow(SUM_TREE)) { closeAskWheel(); toast(tr('askNone'), e.clientX, e.clientY); }
}
// a level of the wheel: what's in it round the spot (and, inside a topic, ‹ in the middle — back up)
function wheelShow(nodes) {
  const w = wheel.el; w.textContent = '';
  const l = nodes.filter(sumShown); if (!l.length) return false;
  if (l.length === 1 && l[0].kids && wheel.path.length === 0 && l[0].k !== 'forces' && l[0].k !== 'supply') return wheelShow(l[0].kids);
  const R = Math.max(ASK_WHEEL_R, SUM_GAP * l.length / (2 * Math.PI)); // (more of them: a wider ring — never on top of each other)
  l.forEach((n, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / l.length, b = document.createElement('button'), cnt = n.types || n.kids ? sumCount(n) : null;
    b.className = 'sumBtn' + (n.kids ? ' topic' : '');
    if (n.pic || n.types) { const im = document.createElement('img'); im.src = sumPic(n.pic || n.types[0]); im.alt = ''; b.appendChild(im); } else b.textContent = n.emoji || ASK_ICON[n.ask];
    if (cnt) { const g = document.createElement('span'); g.className = 'sumN'; g.textContent = cnt; b.appendChild(g); }
    b.dataset.tip = 'sum_' + n.k; b.tipText = () => sumName(n) + (cnt ? ' · ' + cnt + sumBusyNote(n) : '');
    b.setAttribute('aria-label', sumName(n));
    b.style.transform = `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)`;
    b.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); sumPress(n, b); });
    b.addEventListener('click', ev => ev.stopPropagation());
    w.appendChild(b);
  });
  if (wheel.path.length) {
    const b = document.createElement('button'); b.className = 'sumBack'; b.textContent = '‹'; b.setAttribute('aria-label', tr('back'));
    b.addEventListener('pointerdown', ev => { ev.stopPropagation(); wheel.path.pop(); wheelShow(wheel.path.length ? wheel.path[wheel.path.length - 1].kids : SUM_TREE); });
    w.appendChild(b);
  }
  return true;
}
// (in the tooltip: how many of them are fighting now — they come when it's over)
function sumBusyNote(n) { const k = sumSquads(sumTypes(n)).filter(q => Sim.summonHot(s, q)); return k.length ? ' · ' + tr('sumBusy', sumUnits(k)) : ''; }
// a press on one: a topic — a click opens it; a kind — a click sends a third; held, either counts up and letting go sends
function sumPress(n, b) {
  const shown = n.kids ? n.kids.filter(sumShown) : null;
  if (shown && shown.length === 1 && !shown[0].kids && n.k !== 'forces' && n.k !== 'supply') n = Object.assign({}, shown[0], { pic: shown[0].pic || n.pic }); // (a topic with one kind there: as that kind)
  const isTopic = !!(n.kids && n.kids.some(sumShown)), total = n.types || isTopic ? sumCount(n) : 0, badge = b.querySelector('.sumN');
  if (!n.types && !isTopic) { const up = () => { removeEventListener('pointerup', up); closeAskWheel(); askAt(n.ask, wheel0().x, wheel0().y); }; addEventListener('pointerup', up); return; } // (an ask of the partner)
  if (n.k === 'forces' || n.k === 'supply' || !total) { // (forces, supplies: only a level; a kind of supply with none here: ask the partner, who builds it)
    const up = () => { removeEventListener('pointerup', up); if (isTopic) { wheel.path.push(n); wheelShow(n.kids); } else if (n.ask) { closeAskWheel(); askAt(n.ask, wheel0().x, wheel0().y); } };
    addEventListener('pointerup', up); return;
  }
  const third = Math.max(1, Math.ceil(total / 3)), step = Math.max(1, Math.round(total / 7));
  let held = false, count = third;
  const tick = () => { if (!held) { held = true; count = third; } else count = Math.min(total, (Math.floor(count / step) + 1) * step); if (badge) { badge.textContent = count; badge.classList.add('on'); } b.classList.add('hold'); };
  const t0 = setTimeout(() => { tick(); wheel.timer = setInterval(tick, SUM_STEP_MS); }, SUM_HOLD_MS);
  const up = () => {
    removeEventListener('pointerup', up); clearTimeout(t0); clearInterval(wheel.timer);
    if (!held && isTopic) { wheel.path.push(n); wheelShow(n.kids); return; } // (a click on a topic: in)
    const { x, y } = wheel0(); closeAskWheel(); summonAt(n, held ? count : third, x, y);
  };
  addEventListener('pointerup', up);
}
const wheel0 = () => wheel || { x: cam.x, y: cam.y };
// send the n nearest units of the node's kinds (whole squads, the nearest first) to (x, y)
function summonAt(n, want, x, y) {
  const qs = sumSquads(sumTypes(n)).sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y)), ids = [];
  let got = 0; for (const q of qs) { if (got >= want) break; ids.push(q.id); got += sumUnits([q]); }
  const own = ids.filter(id => Sim.ownSquad(s, s.squads.find(q => q.id === id)));
  Sim.unqueue(s, own);
  const r = Sim.summon(s, 'blue', ids, x, y); if (!r) return;
  pings.push({ x, y, t: performance.now() });
  const say = replyOf('hold'); for (const id of own) orderSay[id] = say;
  if (own.length && !Sim.friction(s)) Radio.hear({ kind: say, id: own[0] }); else if (!own.length) Radio.say(tr('askOk'));
  feedAdd({ kind: 'ask', x, y, text: tr('sumSent', sumName(n), got) + (r.wait.length ? ' · ' + tr('sumBusy', sumUnits(r.wait.map(id => s.squads.find(q => q.id === id)))) : '') });
  updateHud();
}
function closeAskWheel() { if (wheel && wheel.timer) clearInterval(wheel.timer); const w = $('askWheel'); wheel = null; if (w) { w.remove(); hideTip(); } } // (only when it was open: every click hid any bubble — the tour's too, and the tutorial stood still)
// ask the partner: on the map, in the list, and its answer on the radio
function askAt(kind, x, y) {
  const a = Sim.ask(s, 'blue', kind, x, y); if (!a) return;
  pings.push({ x, y, t: performance.now() });
  const said = a.ok ? tr('askOk') : a.make ? tr('askMake', sn(a.make)) : tr('askNo'); // (none, but it can be made: "we're building …")
  Radio.say(said);
  feedAdd({ kind: 'ask', x, y, text: tr('askMine', ASK_ICON[kind] + ' ' + tr('ask_' + kind)) + ' · ' + said });
}
// every frame: the partner's new asks of us — in the list and on the radio
function askTick() {
  if (!s || !s.asks) { askSeen = 0; return; }
  for (const a of s.asks) {
    if (a.late && !a.saidLate && a.from === 'me') { a.saidLate = true; const t = tr('askMine', ASK_ICON[a.kind] + ' ' + tr('ask_' + a.kind)) + ' · ' + tr('askOk'); feedAdd({ kind: 'ask', x: a.x, y: a.y, text: t }); Radio.say(tr('askOk')); } // (built, and sent now)
    if (a.id <= askSeen) continue; askSeen = a.id;
    if (a.from !== 'mate') continue;
    const t = tr('askMate', ASK_ICON[a.kind] + ' ' + tr('ask_' + a.kind));
    feedAdd({ kind: 'ask', x: a.x, y: a.y, text: t }); Radio.say(t);
  }
}
// the asks still standing, on the ground: icon and a pulsing ring (blue ours, yellow the partner's)
function drawAsks(c) {
  const px = 1 / view.css, now = performance.now() / 1000;
  // (summoned, still in their fight: an hourglass over them — they come when it's over)
  if (s.summons && s.summons.length) {
    c.save(); c.font = `${13 * px}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.6 + 0.4 * Math.sin(now * 4);
    for (const w of s.summons) { const q = s.squads.find(k => k.id === w.id), p = q && pos(q); if (p) c.fillText('⏳', p.x, p.y - 22 * px); }
    c.restore();
  }
  if (!s.asks || !s.asks.length) return;
  for (const a of s.asks) {
    const age = s.t - a.t; if (age >= Sim.ASK_T || a.side !== 'blue' || a.kind === 'summon') continue;
    const fade = age > Sim.ASK_T - 10 ? (Sim.ASK_T - age) / 10 : 1, col = a.from === 'mate' ? '#f2c230' : '#4aa3ff', f = (now * 0.8) % 1;
    c.save(); c.globalAlpha = fade * (1 - f) * 0.9; c.strokeStyle = col; c.lineWidth = 2.5 * px;
    c.beginPath(); c.arc(a.x, a.y, (14 + 26 * f) * px, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = fade; c.fillStyle = 'rgba(15,18,24,.6)'; c.beginPath(); c.arc(a.x, a.y, 13 * px, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2 * px; c.stroke();
    c.font = `${15 * px}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ASK_ICON[a.kind], a.x, a.y + px);
    c.restore();
  }
}
addEventListener('keydown', e => { if (e.key === 'Escape') closeAskWheel(); });
addEventListener('pointerdown', () => closeAskWheel());
// marking (arms): a small red triangle over each enemy unit / building marked for us — where the air force and the guns
// hit in full (Sim.isMarked)
function drawDesignated(c) {
  if (!s.designate || !s.marked) return;
  const px = 1 / view.css, k = 5 * px, v = viewRect(), M = s.marked.blue;
  const tri = (x, y) => { c.moveTo(x - k, y - k * 1.6); c.lineTo(x + k, y - k * 1.6); c.lineTo(x, y); c.closePath(); };
  c.save(); c.beginPath();
  for (const u of s.units) {
    if (u.side !== 'red' || u.hp <= 0 || !M.has(u.id) || (s.fog && !s.vis.blue.has(u.id))) continue;
    if (v && (u.x < v.x - 40 || u.x > v.x + v.w + 40 || u.y < v.y - 40 || u.y > v.y + v.h + 40)) continue;
    tri(u.x, u.y - (SIZE[u.type] || 10) * 0.6 - 3 * px);
  }
  for (const n of s.nodes) if (n.side === 'red' && n.hp > 0 && M.has('n' + n.id)) tri(n.x, n.y - Sim.STRUCTS[n.kind].r * 1.1);
  c.fillStyle = '#ff3b30'; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.2 * px; c.fill(); c.stroke(); c.restore();
}
