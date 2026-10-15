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
  { k: 'supply', pic: 'fueltruck', kids: [{ k: 'fuel', pic: 'fueltruck', mark: 'fuel', types: ['fueltruck'], ask: 'fuel' }, { k: 'ammo', pic: 'truck', mark: 'shell', types: ['truck'], ask: 'ammo' }, { k: 'water', pic: 'watertruck', mark: 'water', types: ['watertruck'], ask: 'water' }] },
  { k: 'eyes', pic: 'jeep', mark: 'eye', each: ['radio', 'jeep'], drone: true }, // (eyes: a signals truck, a recon jeep and a drone — the nearest of each)
  { k: 'care', pic: 'med', mark: 'cross', each: ['med', 'mech', 'fueltruck', 'truck', 'watertruck'] }, // (care: a medic, a mechanic, and a truck of each supply)
  { k: 'fire', ask: 'fire', pic: 'mlrs', mark: 'target' },
  { k: 'build', ask: 'build', pic: 'dozer' },
];
const SUM_HOLD_MS = 450, SUM_STEP_MS = 500, SUM_GAP = 60; // (SUM_GAP: px between the buttons round the ring)
let askSeen = 0, wheel = null, wheelAt = 0, lastSum = null; // (wheelAt: when it opened, for Alt + double click — the last summons again; lastSum: what it was)
// the squads of ours and the partner's of these kinds (not the bulldozers: their sites), and how many units in them
function sumSquads(types) {
  return s.squads.filter(q => q.side === 'blue' && !q.dead && !q.aboard && types.includes(q.type) && (Sim.ownSquad(s, q) || s.mate) && s.units.some(u => u.squad === q.id));
}
const sumUnits = qs => { let n = 0; for (const q of qs) for (const u of s.units) if (u.squad === q.id) n++; return n; };
const sumTypes = n => n.types || (n.kids || []).flatMap(sumTypes);
// what a node of the tree offers now: forces / supplies by their count; an ask by whether the partner can
const sumCount = n => n.each ? sumEach(n, 0, 0).length : n.types || n.kids ? sumUnits(sumSquads(sumTypes(n))) : 0;
// (eyes / care: one of each kind, the nearest to the spot; and the drone, if there's one in hand and the drones are ours)
const sumDrone = n => !!n.drone && !!s.fog && s.drones.blue.stock > 0 && Sim.armSide(s, 'blue', 'drone') !== 'mate';
function sumEach(n, x, y) {
  const ids = [];
  for (const t of n.each) { const q = sumSquads([t]).sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y))[0]; if (q) ids.push(q.id); }
  return ids;
}
// which squads a press would send: n units of the node's kinds (whole squads, the nearest first), or one of each
function sumPick(n, want, x, y) {
  if (n.each) return sumEach(n, x, y);
  const qs = sumSquads(sumTypes(n)).sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y)), ids = [];
  let got = 0; for (const q of qs) { if (got >= want) break; ids.push(q.id); got += sumUnits([q]); }
  return ids;
}
const sumThird = n => Math.max(1, Math.ceil(sumCount(n) / 3));
// (when they'd be there: going together, the slowest to the spot at the march's pace — the aircraft at their own; those
// fighting are left out, they come when it's over)
function sumEta(ids, x, y) {
  let T = 0, any = false;
  for (const id of ids) {
    const q = s.squads.find(k => k.id === id); if (!q || Sim.summonHot(s, q)) continue;
    for (const u of s.units) if (u.squad === id) { const ty = Sim.TYPES[u.type]; any = true; T = Math.max(T, Math.hypot(u.x - x, u.y - y) / Math.max(1, ty.speed * (ty.air ? 1 : MARCH_PACE))); }
  }
  return any ? Math.round(T + (ids.length > 1 ? MARCH_WAIT : 0)) : null;
}
// the preview: the button the mouse is on — those it'd send lit on the map (drawAsks), and when they'd be there by it
function sumHover(n, b, want) {
  if (!wheel) return;
  const ids = n ? sumPick(n, want ?? sumThird(n), wheel.x, wheel.y) : [];
  wheel.hover = n ? new Set(ids) : null;
  if (!n || !b) return;
  let e = b.querySelector('.sumEta');
  const t = sumEta(ids, wheel.x, wheel.y);
  if (!e) { e = document.createElement('span'); e.className = 'sumEta'; b.appendChild(e); }
  e.textContent = t === null ? '⏳' : t < 60 ? tr('etaS', t) : tr('etaM', Math.round(t / 60));
}
function sumShown(n) {
  if (n.each) return sumEach(n, 0, 0).length > 0 || sumDrone(n);
  if (n.kids) return n.kids.some(sumShown);
  if (n.types && sumCount(n) > 0) return true;
  return !!n.ask && !!s.arms && Sim.canAsk(s, 'blue', 'me', n.ask) && (n.ask !== 'build' || !!(wheel && Sim.siteNear(s, 'blue', wheel.x, wheel.y))); // (build first: only by a site of ours)
}
// its picture: the unit itself, small, in our colour (cached)
// (the trucks look alike: a big mark over each — a blue drop (water), an orange one (fuel), a shell (ammunition);
// fire: a red sight over the guns)
const sumPics = {};
function sumPic(type, mark) {
  const key = type + mark + colors.blue; if (sumPics[key]) return sumPics[key];
  const c = document.createElement('canvas'); c.width = c.height = 64; drawSquadIcon(c, type);
  if (mark) {
    const g = c.getContext('2d'); g.save(); g.translate(14, -4); g.scale(0.72, 0.72); g.lineWidth = 3; // (up to the right, the truck still showing under it) g.strokeStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
    if (mark === 'water' || mark === 'fuel') { // (a drop: round below, a point on top)
      g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(40, 20, 50, 30, 50, 40); g.arc(32, 40, 18, 0, Math.PI); g.bezierCurveTo(14, 30, 24, 20, 32, 6); g.closePath();
      g.fillStyle = mark === 'water' ? '#2f8cff' : '#ff9a1f'; g.fill(); g.stroke();
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(25, 40, 4, 8, -0.4, 0, Math.PI * 2); g.fill();
    } else if (mark === 'shell') { // (a brass case, a dark-green head)
      g.translate(32, 33); g.rotate(-0.5);
      g.beginPath(); g.rect(-9, -2, 18, 26); g.fillStyle = '#d9a640'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-9, -2); g.lineTo(-9, -12); g.quadraticCurveTo(0, -30, 9, -12); g.lineTo(9, -2); g.closePath(); g.fillStyle = '#4b5b34'; g.fill(); g.stroke();
      g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-9, 18, 18, 4);
    } else if (mark === 'eye') { // (an eye)
      g.beginPath(); g.moveTo(6, 32); g.quadraticCurveTo(32, 6, 58, 32); g.quadraticCurveTo(32, 58, 6, 32); g.closePath(); g.fillStyle = '#f4f6f8'; g.fill(); g.stroke();
      g.shadowBlur = 0; g.fillStyle = '#2f8cff'; g.beginPath(); g.arc(32, 32, 11, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill();
    } else if (mark === 'cross') { // (a red cross on white)
      g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill(); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#e0302a'; g.fillRect(27, 16, 10, 32); g.fillRect(16, 27, 32, 10);
    } else if (mark === 'target') { // (a sight)
      g.strokeStyle = '#ff3b30'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.stroke();
      g.beginPath(); for (const [a, b, c2, d] of [[32, 6, 32, 22], [32, 42, 32, 58], [6, 32, 22, 32], [42, 32, 58, 32]]) { g.moveTo(a, b); g.lineTo(c2, d); } g.stroke();
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(32, 32, 3.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  return (sumPics[key] = c.toDataURL());
}
const sumName = n => Sim.TYPES[n.k] ? tn(n.k) : tr('sum_' + n.k);
function openAskWheel(e, x, y) {
  closeAskWheel();
  const st = $('stage').getBoundingClientRect(), w = document.createElement('div');
  w.id = 'askWheel'; w.style.left = (e.clientX - st.left) + 'px'; w.style.top = (e.clientY - st.top) + 'px';
  wheel = { el: w, x, y, path: [], cx: e.clientX, cy: e.clientY }; wheelAt = performance.now();
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
    const a = -Math.PI / 2 + i * 2 * Math.PI / l.length, b = document.createElement('button'), cnt = n.types || n.kids || n.each ? sumCount(n) : null;
    b.className = 'sumBtn' + (n.kids ? ' topic' : '');
    if (n.pic || n.types) { const im = document.createElement('img'); im.src = sumPic(n.pic || n.types[0], n.mark); im.alt = ''; b.appendChild(im); } else b.textContent = n.emoji || ASK_ICON[n.ask];
    if (cnt) { const g = document.createElement('span'); g.className = 'sumN'; g.textContent = cnt; b.appendChild(g); }
    b.dataset.tip = 'sum_' + n.k; b.tipText = () => sumName(n) + (cnt ? ' · ' + cnt + sumBusyNote(n) : '');
    b.setAttribute('aria-label', sumName(n));
    b.style.transform = `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)`;
    b.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); sumPress(n, b); });
    b.addEventListener('click', ev => ev.stopPropagation());
    if (n.types || n.kids || n.each) { b.addEventListener('pointerenter', () => sumHover(n, b)); b.addEventListener('pointerleave', () => { if (!b.classList.contains('hold')) sumHover(null); }); }
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
  const { x, y } = wheel; if (n.each) { const up = () => { removeEventListener('pointerup', up); closeAskWheel(); summonEach(n, x, y); }; addEventListener('pointerup', up); return; } // (eyes / care: one press, one of each) (the spot — taken before the wheel closes: after it, it was the middle of the screen, and a site asked for was never found)
  if (!n.types && !isTopic) { const up = () => { removeEventListener('pointerup', up); closeAskWheel(); askAt(n.ask, x, y); }; addEventListener('pointerup', up); return; } // (an ask of the partner)
  if (n.k === 'forces' || n.k === 'supply' || !total) { // (forces, supplies: only a level; a kind of supply with none here: ask the partner, who builds it)
    const up = () => { removeEventListener('pointerup', up); if (isTopic) { wheel.path.push(n); wheelShow(n.kids); } else if (n.ask) { closeAskWheel(); askAt(n.ask, x, y); } };
    addEventListener('pointerup', up); return;
  }
  const third = Math.max(1, Math.ceil(total / 3)), step = Math.max(1, Math.round(total / 7));
  let held = false, count = third;
  const tick = () => { if (!held) { held = true; count = third; } else count = Math.min(total, (Math.floor(count / step) + 1) * step); if (badge) { badge.textContent = count; badge.classList.add('on'); } b.classList.add('hold'); sumHover(n, b, count); };
  const t0 = setTimeout(() => { tick(); wheel.timer = setInterval(tick, SUM_STEP_MS); }, SUM_HOLD_MS);
  const up = () => {
    removeEventListener('pointerup', up); clearTimeout(t0); clearInterval(wheel.timer);
    if (!held && isTopic) { wheel.path.push(n); wheelShow(n.kids); return; } // (a click on a topic: in)
    closeAskWheel(); summonAt(n, held ? count : third, x, y);
  };
  addEventListener('pointerup', up);
}
// send the n nearest units of the node's kinds (whole squads, the nearest first) to (x, y)
function summonAt(n, want, x, y) {
  const ids = sumPick(n, want, x, y), got = sumUnits(ids.map(id => s.squads.find(q => q.id === id)));
  lastSum = { n, want };
  sumSend(n, ids, got, x, y);
}
// eyes / care: the nearest one of each kind (and a drone up over the spot)
function summonEach(n, x, y) {
  const ids = sumEach(n, x, y), drone = sumDrone(n) && Sim.drone(s, 'blue', x, y);
  lastSum = { n };
  if (ids.length) sumSend(n, ids, ids.length, x, y); else if (drone) { pings.push({ x, y, t: performance.now() }); updateHud(); }
}
// Alt + double click: the last summons again, here
function sumRepeat(x, y) { if (!lastSum) return false; if (lastSum.n.each) summonEach(lastSum.n, x, y); else summonAt(lastSum.n, lastSum.want, x, y); return true; }
function sumSend(n, ids, got, x, y) {
  const own = ids.filter(id => Sim.ownSquad(s, s.squads.find(q => q.id === id)));
  Sim.unqueue(s, own);
  const r = Sim.summon(s, 'blue', ids, x, y, (n.pic || sumTypes(n)[0]) + (n.mark ? ':' + n.mark : '')); if (!r) return;
  pings.push({ x, y, t: performance.now() });
  const say = replyOf('hold'); for (const id of own) orderSay[id] = say;
  if (own.length && !Sim.friction(s)) Radio.hear({ kind: say, id: own[0] }); else if (!own.length) Radio.play('ask_ok', tr('askOk'));
  feedAdd({ kind: 'ask', x, y, text: tr('sumSent', sumName(n), got) + (r.wait.length ? ' · ' + tr('sumBusy', sumUnits(r.wait.map(id => s.squads.find(q => q.id === id)))) : '') });
  updateHud();
}
function closeAskWheel() { if (wheel && wheel.timer) clearInterval(wheel.timer); const w = $('askWheel'); wheel = null; if (w) { w.remove(); hideTip(); } } // (only when it was open: every click hid any bubble — the tour's too, and the tutorial stood still)
// ask the partner: on the map, in the list, and its answer on the radio
function askAt(kind, x, y) {
  const a = Sim.ask(s, 'blue', kind, x, y); if (!a) return;
  pings.push({ x, y, t: performance.now() });
  const said = a.ok ? tr('askOk') : a.make ? tr('askMake', sn(a.make)) : tr('askNo'); // (none, but it can be made: "we're building …")
  Radio.play(a.ok ? 'ask_ok' : a.make ? 'ask_making' : 'ask_none', said);
  feedAdd({ kind: 'ask', x, y, text: tr('askMine', ASK_ICON[kind] + ' ' + tr('ask_' + kind)) + ' · ' + said });
}
// every frame: the partner's new asks of us — in the list and on the radio
function askTick() {
  if (!s || !s.asks) { askSeen = 0; return; }
  for (const a of s.asks) {
    if (a.late && !a.saidLate && a.from === 'me') { a.saidLate = true; const t = tr('askMine', ASK_ICON[a.kind] + ' ' + tr('ask_' + a.kind)) + ' · ' + tr('askOk'); feedAdd({ kind: 'ask', x: a.x, y: a.y, text: t }); Radio.play('ask_ok', tr('askOk')); } // (built, and sent now)
    if (a.id <= askSeen) continue; askSeen = a.id;
    if (a.from !== 'mate') continue;
    const t = tr('askMate', ASK_ICON[a.kind] + ' ' + tr('ask_' + a.kind));
    feedAdd({ kind: 'ask', x: a.x, y: a.y, text: t }); Radio.play('mate_' + a.kind, t);
  }
}
// (a summons whose squads are all there (or gone), none still in a fight: its mark is off the map)
const summonDone = a => s.t - a.t > 3 && !(s.summons || []).some(w => a.by.includes(w.id)) && a.by.every(id => { const q = s.squads.find(k => k.id === id); return !q || q.dead || (q.arrived && (q.orderAt ?? 0) >= a.t - 0.01) || (q.orderAt ?? 0) > a.t + 15; });
// (a summons' mark: the picture of what was summoned, made once)
const askImgs = {};
function askImg(icon) { if (!askImgs[icon]) { const [t, m] = (icon || 'tank').split(':'), im = new Image(); im.src = sumPic(t, m); askImgs[icon] = im; } return askImgs[icon]; }
// a click on a mark of ours on the map (an ask, a summons): called off — Sim.cancelAsk; the spot's within 16 px of it
function askHit(x, y) {
  if (!s.asks) return null; const r = 16 / view.css;
  return s.asks.find(a => a.side === 'blue' && s.t - a.t < (a.keep || Sim.ASK_T) && !(a.kind === 'summon' && summonDone(a)) && Math.hypot(a.x - x, a.y - y) < r) || null;
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
  // (the wheel's preview: those that'd come — a ring round each, and a faint line to the spot)
  if (wheel && wheel.hover && wheel.hover.size) {
    c.save(); c.strokeStyle = '#7fd0ff'; c.lineWidth = 2 * px; c.globalAlpha = 0.65 + 0.35 * Math.sin(now * 6);
    for (const u of s.units) if (wheel.hover.has(u.squad)) { c.beginPath(); c.arc(u.x, u.y, 14 * px, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 0.35; c.setLineDash([6 * px, 6 * px]); c.beginPath();
    for (const id of wheel.hover) { const q = s.squads.find(k => k.id === id); if (q) { c.moveTo(q.cx, q.cy); c.lineTo(wheel.x, wheel.y); } }
    c.stroke(); c.restore();
  }
  if (!s.asks || !s.asks.length) return;
  for (const a of s.asks) {
    const T = a.keep || Sim.ASK_T, age = s.t - a.t; if (age >= T || a.side !== 'blue' || (a.kind === 'summon' && summonDone(a))) continue;
    const fade = age > T - 10 ? (T - age) / 10 : 1, col = a.from === 'mate' ? '#f2c230' : '#4aa3ff', f = (now * 0.8) % 1;
    c.save(); c.globalAlpha = fade * (1 - f) * 0.9; c.strokeStyle = col; c.lineWidth = 2.5 * px;
    c.beginPath(); c.arc(a.x, a.y, (14 + 26 * f) * px, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = fade; c.fillStyle = 'rgba(15,18,24,.6)'; c.beginPath(); c.arc(a.x, a.y, 13 * px, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2 * px; c.stroke();
    if (a.kind === 'summon') { const im = askImg(a.icon); if (im.complete && im.naturalWidth) c.drawImage(im, a.x - 12 * px, a.y - 12 * px, 24 * px, 24 * px); } // (summoned: the unit's own picture)
    else { c.font = `${15 * px}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ASK_ICON[a.kind], a.x, a.y + px); }
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
