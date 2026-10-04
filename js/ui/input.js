// UI: pointer and keyboard input
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.cox) / view.css, y: (e.clientY - r.top - view.coy) / view.css };
}

// tap targets stay finger-sized when zoomed out
const tapR = r => Math.max(r, 14 / view.css);
// a squad is picked by its units where they're drawn, else by its badge (over where it probably is)
function hitSquad(x, y) {
  for (const q of s.squads) { const p = q.side === 'blue' && !q.dead && !sqShown(q) && guessAt(q); if (p && Math.hypot(p.x - x, p.y - y) < tapR(24)) return q.id; }
  const tol = Math.max(12, 22 / view.css); let best = null, bd = tol;
  // (a long vehicle — a truck, a tank — is hit anywhere on its picture, not only near its middle)
  for (const u of s.units) { if (u.side !== 'blue' || (Sim.friction(s) && !sqShown(s.squads.find(q => q.id === u.squad) || {}))) continue; const d = Math.hypot(u.x - x, u.y - y) - Math.max(0, (SIZE[u.type] || 0) * 0.9 - tol * 0.5); if (d < bd) { bd = d; best = u.squad; } }
  return best;
}
// the enemy under a spot, as blue knows it: a unit or building in sight, a remembered building, a sighting under fog
function hitFoe(x, y) {
  const r = tapR(Math.max(14, 20 / view.css));
  for (const u of s.units) if (u.side === 'red' && (!s.fog || (s.vis.blue.has(u.id) && shownAt(u))) && Math.hypot(u.x - x, u.y - y) < r) return { x: u.x, y: u.y };
  const n = hitNode(x, y, 'red'); if (n) return { x: n.x, y: n.y };
  if (s.fog) for (const m of Object.values(s.mem.blue)) if (m && Number.isFinite(m.x) && Math.hypot(m.x - x, m.y - y) < r * 1.3) return { x: m.x, y: m.y };
  return null;
}
// a building under a spot (side's own, or the enemy's as seen or remembered): the node, or its memory
function hitNode(x, y, side) {
  const near = n => Math.hypot(n.x - x, n.y - y) < tapR(Sim.STRUCTS[n.kind].r + 6);
  const n = s.nodes.find(n => n.side === side && n.hp > 0 && n.kind !== 'drone' && nodeShown(n) && near(n));
  if (n || side === 'blue' || !s.fog) return n || null;
  const m = Object.values(s.memNodes.blue).find(m => !s.visNodes.blue.has(m.id) && near(m));
  return m ? { ...m, side: 'red', mem: true } : null;
}
// a building's line: its name, its state, and (ours) what it makes and when the next one comes out
function nodeInfo(n) {
  const S = Sim.STRUCTS[n.kind], kind = n.side === 'red' && n.kind === 'decoy' ? 'hq' : n.kind;
  const out = [sn(kind) + (n.side === 'blue' && n.kind === 'decoy' ? ' 🎭' : '')];
  if (n.mem) { out.push(tr('ni_seen', Math.round(s.t - n.t))); return out.join(' · '); }
  if (n.side === 'blue' || !s.fog || Sim.idLevel(s, 'blue', n) >= 2) out.push(Math.max(1, Math.round(100 * n.hp / S.hp)) + '%');
  if (n.side !== 'blue') return out.join(' · ');
  if (Sim.isSite(n) && s.t < n.ready) out.push(tr(n.working ? 'ni_site' : 'ni_wait', Math.round(100 * n.work / n.need)));
  else if (s.t < n.ready) out.push(tr('ni_build', Math.ceil(n.ready - s.t)));
  else if (S.upgrade && n.upg) out.push(tr('trophyOn', Math.ceil(n.upg.until - s.t)));
  else if (n.kind === 'hq' && hqNext()) { const h = hqNext(); out.push(tr('ni_sup', h.types.map(k => tr('one_' + k)).join(' + '), Math.max(1, Math.ceil(h.left)))); }
  else if (S.unit) {
    if (S.upgrade && s.trophy && s.trophy.blue) out.push(tr('trophyHas'));
    const have = s.units.filter(u => { const q = s.squads.find(k => k.id === u.squad); return q && (q.home === n.id); }).length;
    out.push(have >= (s.singles ? Sim.BUILD_UNITS : S.size) ? tr('ni_full') : tr('ni_next', tn(S.unit), Math.max(1, Math.ceil((1 - (n.prog || 0)) * S.every))));
  }
  return out.join(' · ');
}
// a squad tapped: Shift adds it to what's picked, or takes it out (with its group); a double click picks every squad
// of its kind on the screen; else it alone (its group)
let lastPick = { id: null, t: 0 };
// a hurt unit of ours that can be sent to be treated (not on its way already)
const CARE_SHOW = 0.97, hurtUnit = u => u.side === 'blue' && Sim.CARER[u.type] && u.hp < CARE_SHOW * Sim.TYPES[u.type].hp && !u.care;
const careable = id => s.units.some(u => u.squad === id && hurtUnit(u));
const DBL_MS = 380;
function pickAt(id, e) {
  const q = s.squads.find(k => k.id === id), now = performance.now(), dbl = lastPick.id === id && now - lastPick.t < DBL_MS;
  lastPick = { id, t: now };
  if (e.shiftKey) {
    const g = groupOf(id), mine = g ? g.ids : [id], have = sel === 'all' ? [] : selIds().slice(), on = mine.every(k => have.includes(k));
    const ids = on ? have.filter(k => !mine.includes(k)) : [...have, ...mine.filter(k => !have.includes(k))];
    select(ids.length === 0 ? null : ids.length === 1 ? ids[0] : ids); if (!on) sayPicked([id]); return;
  }
  if (dbl && q) {
    const v = viewRect(), ids = blueSquads().filter(k => !k.dead && k.type === q.type).filter(k => { const p = guessAt(k); return p && (!v || (p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h)); }).map(k => k.id);
    if (ids.length) { select(ids.length === 1 ? ids[0] : ids); return; }
  }
  pickSquad(id);
}
// an enemy squad under the mouse, if we see it as it is (identified: its kind)
function hitFoeSquad(x, y) {
  const r = tapR(Math.max(14, 20 / view.css));
  for (const u of s.units) if (u.side === 'red' && (!s.fog || (s.vis.blue.has(u.id) && shownAt(u))) && Math.hypot(u.x - x, u.y - y) < r) return u.squad;
  return null;
}
// a squad's line: its kind and size, how strong, what it's doing (ours), and what it's for
// the mouse over a squad: what it is, its health, its ammunition (where it has any), what it's for — a line each
// (the enemy's: marked so)
function squadInfo(q) {
  const us = s.units.filter(u => u.squad === q.id), T = Sim.TYPES[q.type], n = Math.max(1, us.length);
  const hp = us.reduce((a, u) => a + u.hp, 0) / (n * T.hp);
  const am = T.ammo ? us.reduce((a, u) => a + u.ammo / T.ammo, 0) / n : s.supply && Sim.SUPPLY[q.type] ? us.reduce((a, u) => a + (u.sup ?? 1), 0) / n : null;
  const out = [(q.side === 'blue' ? '' : tr('foe') + ' · ') + tn(q.type) + (us.length > 1 ? ' ×' + us.length : ''), tr('ti_hp', Math.round(hp * 100))];
  if (am !== null && q.side === 'blue') out.push(tr('ti_ammo', Math.round(am * 100)));
  // (fuel: the full game's vehicles and aircraft — fuel.js; a truck: the barrels it carries)
  const fu = us.filter(u => u.fuel !== undefined); if (fu.length && q.side === 'blue') out.push(tr('ti_fuel', Math.round(fu.reduce((a, u) => a + u.fuel, 0) / fu.length * 100)));
  const wu = us.filter(u => u.water !== undefined); if (wu.length && q.side === 'blue') out.push(tr('ti_water', Math.round(wu.reduce((a, u) => a + u.water, 0) / wu.length * 100)));
  if (Sim.TRUCK_CAP[q.type] && q.side === 'blue') out.push(tr('ti_load', Math.round(us.reduce((a, u) => a + (u.load ?? Sim.TRUCK_CAP[q.type]) / Sim.TRUCK_CAP[q.type], 0) / Math.max(1, us.length) * 100)));
  const role = (ROLE[lang] || ROLE.he)[q.type]; if (role) out.push(role);
  return out.join('\n');
}
// a tap on the map: select, place, or give the order
function tap(e) {
  if (!menu.hidden) { closeMenu(); return; }
  if (s.over) return;
  const { x, y } = toWorld(e);
  if (x < 0 || y < 0 || x > s.W || y > s.H) return;
  // (a drone sent up: the next one stays ready to place while there are more in hand)
  if (eyeArmed) { Sim.drone(s, 'blue', x, y); eyeArmed = s.drones.blue.stock > 0; syncButtons(); updateHud(); return; }
  if (buildArmed) { placeBuilding(x, y, e.shiftKey); return; }
  if (fhqArmed) { placeFhq(x, y); return; }
  if (frontArmed) { placeFront(x, y); return; }
  if (hqArmed) { placeHq(x, y); return; }
  if (roadArmed) { placeRoad(x, y, e.shiftKey); return; } // (roadui.js)
  if (!$('buildm').hidden) { $('buildm').hidden = true; syncButtons(); return; }
  selPost = hitPost(x, y); // (a post clicked: the ring of where it works, until the next click — field.js)
  const hit = hitSquad(x, y);
  // a transport helicopter of ours clicked with soldiers picked: they go to it and get on
  const hq_ = hit && s.squads.find(q => q.id === hit);
  if (hq_ && hq_.type === 'lift') {
    const riders = (sel === 'all' ? [] : selIds()).filter(id => { const q = s.squads.find(k => k.id === id); return q && Sim.RIDERS.includes(q.type); });
    if (riders.length) {
      const L = s.units.find(u => u.squad === hit), room = Sim.TYPES.lift.cap - ((L && L.cargo) || []).length;
      if (room <= 0) { const p = onScreen(x, y); toast(tr('noRoom'), p.x, p.y); return; }
      if (Sim.board(s, riders, hit)) { pings.push({ x, y, t: performance.now() }); Radio.hear({ kind: 'go', id: riders[0] }); }
      return;
    }
  }
  // a hurt unit of ours already picked (its ✡ pulsing over it), clicked again: the picked hurt ones go to be treated
  if (hit && !e.shiftKey && sel !== 'all' && isSel(hit) && careable(hit) && !(lastPick.id === hit && performance.now() - lastPick.t < DBL_MS)) {
    if (Sim.sendCare(s, selIds())) { pings.push({ x, y, t: performance.now() }); Radio.hear({ kind: 'go', id: hit }); }
    return;
  }
  if (hit) { pickAt(hit, e); return; }
  // our transport helicopters picked, soldiers on board: a click on the map sets them down there
  const lifts = (sel === 'all' ? [] : selIds()).filter(id => { const q = s.squads.find(k => k.id === id); const L = q && q.type === 'lift' && s.units.find(u => u.squad === id); return L && L.cargo && L.cargo.length; });
  if (lifts.length && lifts.length === selIds().length) {
    lifts.forEach((id, i) => Sim.unload(s, id, x + (i - (lifts.length - 1) / 2) * 50, y));
    pings.push({ x, y, t: performance.now() }); Radio.hear({ kind: 'go', id: lifts[0] }); return;
  }
  // tapping one of our buildings picks it (and the squad it raises), its line shown by it
  const home = hitNode(x, y, 'blue');
  // (a site of ours with a bulldozer picked: it goes to build there, first thing)
  const dz = home && pickedDozer();
  if (dz && Sim.isSite(home) && s.t < home.ready && Sim.assignSite(s, s.squads.find(q => q.id === dz), home, true)) { pings.push({ x: home.x, y: home.y, t: performance.now() }); return; }
  if (home) {
    // (its units — each its own squad now — all picked)
    const mine = s.squads.filter(q => !q.dead && (q.home === home.id || q.id === home.squad)).map(q => q.id);
    if (mine.length > 1) pickIds(mine); else if (mine.length) pickSquad(mine[0]); else select(null);
    selNode = home.id; const r = cv.getBoundingClientRect();
    toast(nodeInfo(home), home.x * view.css + view.cox + r.left, (home.y - 26) * view.css + view.coy + r.top, 2600);
    return;
  }
  // a building of ours picked: where its squads go once out (and its squad now, if it's out), "on our way"
  const rn = rallyNode();
  if (rn) {
    Sim.rally(s, rn.id, x, y); const qs = rn.kind === 'hq' ? [] : s.squads.filter(k => !k.dead && (k.home === rn.id || k.id === rn.squad)).map(k => k.id);
    if (qs.length > 1) Sim.formation(s, qs, 'attack', x, y, true); else if (qs.length) Sim.order(s, qs[0], 'attack', x, y, true);
    pings.push({ x, y, t: performance.now() }); Radio.hear({ kind: 'go', id: qs[0] }); return;
  }
  // missile trucks picked and a known enemy building clicked: they set up and launch at it (the others attack it)
  const ssm = (sel === 'all' ? [] : selIds()).filter(id => { const q = s.squads.find(k => k.id === id); return q && q.type === 'ssm'; });
  if (ssm.length && Sim.knownFoeNode(s, 'blue', x, y, 30)) {
    Sim.launch(s, ssm, x, y); pings.push({ x, y, t: performance.now(), foe: true }); Radio.hear({ kind: 'attacking', id: ssm[0] });
    const rest = selIds().filter(id => !ssm.includes(id)); if (rest.length) { const keep = sel; sel = rest.length === 1 ? rest[0] : rest; issue('attack', x, y, undefined, true); sel = keep; }
    return;
  }
  // a post not ours, with soldiers picked: in to take it (yellow arrows)
  if (sendCapture(hitPost(x, y))) return;
  // at an enemy: an attack on it, whatever the order button says
  const foe = selIds().length || sel === 'all' ? hitFoe(x, y) : null;
  if (foe) { issue('attack', foe.x, foe.y, undefined, true); return; }
  issue(mode, x, y);
}
// hover (mouse): the cursor says what a click would do, and a building's line shows by it after a moment
const svgCur = (svg, hx, hy) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, crosshair`;
const DRONE_CUR = (() => {
  const arms = "<path d='M9 9L23 23M23 9L9 23'/><circle cx='8' cy='8' r='5'/><circle cx='24' cy='8' r='5'/><circle cx='8' cy='24' r='5'/><circle cx='24' cy='24' r='5'/>";
  return svgCur(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round'>${arms}</g><g fill='none' stroke='#223' stroke-width='2' stroke-linecap='round'>${arms}</g><rect x='12.5' y='12.5' width='7' height='7' rx='2' fill='#4a90e2' stroke='#223' stroke-width='1.5'/></svg>`, 16, 16);
})();
// placing the front (🚩 armed): the flag itself, as it stands on the map — a pole, its foot where it goes
const FLAG_CUR = svgCur(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='48' viewBox='0 0 40 48'><filter id='f' x='-30%' y='-30%' width='160%' height='160%'><feDropShadow dx='1.2' dy='1.6' stdDeviation='1.3' flood-opacity='.5'/></filter><g filter='url(#f)'><path d='M7 45V4' stroke='#1b2430' stroke-width='5' stroke-linecap='round'/><path d='M7 45V4' stroke='#fff' stroke-width='2.6' stroke-linecap='round'/><path d='M7 4Q20 2 33 10L7 20Z' fill='#3b7dd8' stroke='#fff' stroke-width='2' stroke-linejoin='round'/><ellipse cx='7' cy='45' rx='4' ry='1.8' fill='#3b7dd8' stroke='#fff' stroke-width='1'/></g></svg>`, 7, 45);
// the plain pointer: an arrow twice the system one's size, white with a dark edge and a soft shadow
const ARROW_CUR = svgCur(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='46' viewBox='0 0 34 46'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#d9e2ec'/></linearGradient><filter id='f' x='-20%' y='-20%' width='160%' height='160%'><feDropShadow dx='1.5' dy='2' stdDeviation='1.6' flood-opacity='.45'/></filter></defs><path filter='url(#f)' d='M3 2L3 36L11.5 28.5L17.5 42L23.5 39.2L17.6 26L29 26Z' fill='url(#g)' stroke='#1b2430' stroke-width='2.2' stroke-linejoin='round'/></svg>`, 3, 2).replace(', crosshair', ', default');
// with something picked: a sight — a ring and four arrows pointing at the middle, breathing in and out (AIM_FRAMES
// pictures, one every AIM_MS; tickCursor swaps them); green for an order, red at an enemy, yellow over a post to take
const AIM_FRAMES = 8, AIM_MS = 85;
const aimCur = col => Array.from({ length: AIM_FRAMES }, (_, i) => {
  const d = 15 + 5 * (0.5 + 0.5 * Math.cos(i / AIM_FRAMES * Math.PI * 2)), arrow = a => `<g transform='rotate(${a} 28 28)'><path d='M28 ${28 - d}l-6 -8h4v-6h4v6h4z'/></g>`;
  const g = `<circle cx='28' cy='28' r='9'/>${[0, 90, 180, 270].map(arrow).join('')}`;
  return svgCur(`<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g stroke='#fff' stroke-width='4' stroke-linejoin='round' fill='#fff'>${g}</g><g stroke='${col}' stroke-width='1.6' stroke-linejoin='round' fill='${col}'><circle cx='28' cy='28' r='9' fill='none' stroke-width='2.4'/>${[0, 90, 180, 270].map(arrow).join('')}</g><circle cx='28' cy='28' r='2' fill='${col}'/></svg>`, 28, 28);
});
const AIM_GO = aimCur('#2e9e4f'), AIM_FOE = aimCur('#d8342c'), AIM_CAP = aimCur('#e0a800'); // (yellow: soldiers into a post, to take it)
// the cursor for where the mouse is (an array: an animated one)
function cursorAt(x, y) {
  const picked = sel === 'all' || selIds().length > 0;
  if (eyeArmed) return DRONE_CUR;
  if (frontArmed) return FLAG_CUR;
  if (buildArmed || fhqArmed || hqArmed || roadArmed) return 'copy';
  if (hitSquad(x, y) || hitNode(x, y, 'blue')) return rallyNode() && !hitNode(x, y, 'blue') ? AIM_GO : 'pointer';
  if (rallyNode()) return AIM_GO; // (a building of ours picked: a click says where its squads go)
  if (!picked) return ARROW_CUR;
  return hitFoe(x, y) ? AIM_FOE : canTake(hitPost(x, y)) ? AIM_CAP : AIM_GO;
}
let curNow = null, lastMouse = null;
// a production building of ours picked: a click on the map is its rally point
const rallyNode = () => { const n = selNode != null && s.nodes.find(k => k.id === selNode && k.hp > 0 && k.side === 'blue'); return n && (Sim.STRUCTS[n.kind].unit || n.kind === 'hq') ? n : null; }; // (also while it goes up; the HQ: its bulldozers and signals trucks)
function setCursor(cur) {
  curNow = cur; const c = Array.isArray(cur) ? cur[Math.floor(performance.now() / AIM_MS) % cur.length] : cur;
  if (cv.style.cursor !== c) cv.style.cursor = c;
}
// every frame (main.js): the cursor follows what changed — a pick, a right click, a key — not only a move of the mouse
function tickCursor() {
  if (!s || drag || !lastMouse) return;
  const { x, y } = toWorld(lastMouse); setCursor(cursorAt(x, y));
}
let hoverNode = null, hoverT = 0;
function hover(e) {
  if (!s || drag || e.pointerType !== 'mouse') return;
  const { x, y } = toWorld(e); lastMouse = { clientX: e.clientX, clientY: e.clientY };
  const n = hitSquad(x, y) ? null : hitNode(x, y, 'blue') || hitNode(x, y, 'red');
  setCursor(cursorAt(x, y));
  // the line of what's under the mouse — a squad (ours, or the enemy's in sight), else a building: after 400 ms on the
  // same one, gone when the mouse leaves it
  const q = !n && !eyeArmed && !buildArmed && !fhqArmed && !hqArmed ? hitSquad(x, y) || hitFoeSquad(x, y) : null;
  const pt = !n && !q ? hitPost(x, y) : null; // (a post: who holds it, what it gives)
  const key = q ? 'q' + q : n ? (n.mem ? 'm' : '') + n.id : pt ? 'p' + pt.id : null;
  if (key === hoverNode) return;
  hoverNode = key; clearTimeout(hoverT); if (tipFor === 'node') hideTip();
  if (n || q || pt) hoverT = setTimeout(() => {
    if (hoverNode !== key || tour || tipFor === 'toast') return;
    const r = cv.getBoundingClientRect(), sq = q && s.squads.find(k => k.id === q), at = sq ? guessAt(sq) || { x: sq.cx, y: sq.cy } : n || pt;
    if (!at) return;
    showTip(sq ? squadInfo(sq) : n ? nodeInfo(n) : postInfo(pt), { left: at.x * view.css + view.cox + r.left, top: (at.y - 26) * view.css + view.coy + r.top, width: 0, height: 0 }); tipFor = 'node';
  }, 400);
}
cv.addEventListener('pointermove', hover);
cv.addEventListener('pointerleave', () => { lastMouse = null; hoverNode = null; clearTimeout(hoverT); if (tipFor === 'node') hideTip(); });
// Mouse: a left click gives the order (or picks the squad under it); left-drag draws a rectangle that picks every squad
// in it; the left button held still a moment (MOUSE_HOLD_MS), then dragged: the order with a facing and a depth (an
// arrow from where it starts: the front toward where it's dragged, the rows spread over its length); a right click
// clears the pick; right- or middle-drag pans; the wheel zooms;
// the view also slides when the pointer rests at a screen edge. Touch: one finger pans, two pinch; press and hold, then
// drag, is the order with a facing.
// A press that moves more than DRAG_PX is not a tap.
const DRAG_PX = 8, touches = new Map();
let drag = null, boxSel = null, faceDrag = null;
const HOLD_MS = 450, MOUSE_HOLD_MS = 260;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  const box = e.pointerType === 'mouse' && e.button === 0 && !eyeArmed && !buildArmed && !fhqArmed && !hqArmed && !frontArmed && !roadArmed;
  const free = !eyeArmed && !buildArmed && !fhqArmed && !hqArmed && !roadArmed;
  drag = touches.size === 1 ? { x: e.clientX, y: e.clientY, moved: false, box, tapOk: e.button === 0, face: false, right: e.pointerType === 'mouse' && e.button === 2 } : { moved: true };
  // touch, or the left button with something picked: held still for a moment, the drag that follows sets a facing
  const mouseHold = e.pointerType === 'mouse' && e.button === 0 && free && sel !== null;
  if ((e.pointerType !== 'mouse' || mouseHold) && touches.size === 1 && free) {
    const d = drag; d.hold = setTimeout(() => {
      if (drag !== d || d.moved || touches.size !== 1) return;
      const r = cv.getBoundingClientRect(); d.face = true; faceDrag = { x0: d.x - r.left, y0: d.y - r.top, x1: d.x - r.left, y1: d.y - r.top };
      try { navigator.vibrate && navigator.vibrate(15); } catch (err) { /* no vibration */ }
    }, e.pointerType === 'mouse' ? MOUSE_HOLD_MS : HOLD_MS);
  }
});
cv.addEventListener('pointermove', e => {
  const p = touches.get(e.pointerId); if (!p) return;
  if (touches.size === 2) {
    const [a, b] = [...touches.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y), m0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    p.x = e.clientX; p.y = e.clientY;
    const d1 = Math.hypot(a.x - b.x, a.y - b.y), m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r = cv.getBoundingClientRect();
    panBy(m1.x - m0.x, m1.y - m0.y);
    if (d0 > 10) zoomAt(m1.x - r.left, m1.y - r.top, d1 / d0);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!drag) return;
  if (drag.face) { const r = cv.getBoundingClientRect(); faceDrag.x1 = e.clientX - r.left; faceDrag.y1 = e.clientY - r.top; return; }
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > DRAG_PX) { drag.moved = true; clearTimeout(drag.hold); if (!drag.box) panBy(e.clientX - drag.x - dx, e.clientY - drag.y - dy); }
  if (!drag.moved) return;
  if (drag.box) { const r = cv.getBoundingClientRect(); boxSel = { x0: drag.x - r.left, y0: drag.y - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top }; }
  else panBy(dx, dy);
});
// the squads inside the rectangle (by their badge or their body): one becomes the selection, several a group
function pickBox(b, shift) {
  const w0 = { x: (Math.min(b.x0, b.x1) - view.cox) / view.css, y: (Math.min(b.y0, b.y1) - view.coy) / view.css };
  const w1 = { x: (Math.max(b.x0, b.x1) - view.cox) / view.css, y: (Math.max(b.y0, b.y1) - view.coy) / view.css };
  const inside = (x, y) => x >= w0.x && x <= w1.x && y >= w0.y && y <= w1.y;
  const ids = blueSquads().filter(q => { if (q.dead) return false; const p = guessAt(q); return p && (inside(p.x, p.y) || inside(p.x, p.y - 26)); }).map(q => q.id);
  // a squad in a group brings its whole group along
  for (const id of ids.slice()) { const g = groupOf(id); if (g) for (const x of g.ids) if (!ids.includes(x)) ids.push(x); }
  // (Shift: added to what's already picked)
  if (shift && sel !== 'all') for (const id of selIds()) if (!ids.includes(id)) ids.push(id);
  if (ids.length) select(ids.length === 1 ? ids[0] : ids);
}
const lift = e => { touches.delete(e.pointerId); if (drag) clearTimeout(drag.hold); if (!touches.size) drag = null; };
cv.addEventListener('pointerup', e => {
  const d = drag, b = boxSel, f = faceDrag; lift(e); boxSel = null; faceDrag = null;
  if (d && d.face) {
    if (!menu.hidden || s.over) return;
    if (Math.hypot(f.x1 - f.x0, f.y1 - f.y0) < DRAG_PX * 2) { if (d.right) unpick(); else tap(e); return; } // a plain right click: clear the pick; a hold: the order
    const w = p => ({ x: (p.x - view.cox) / view.css, y: (p.y - view.coy) / view.css }), a = w({ x: f.x0, y: f.y0 }), z = w({ x: f.x1, y: f.y1 });
    // (the forces between the arrow's tail — the last row — and its head — the first, facing on that way): short = close
    // together, long = spread deep
    const L = Math.hypot(z.x - a.x, z.y - a.y), fa = Math.atan2(z.y - a.y, z.x - a.x);
    issue(mode, (a.x + z.x) / 2, (a.y + z.y) / 2, fa, false, false, L); return;
  }
  if (d && d.box && d.moved && b) { if (!menu.hidden || s.over) return; pickBox(b, e.shiftKey); return; }
  if (d && d.right && !d.moved) { unpick(); return; }
  if (d && !d.moved && d.tapOk && e.isPrimary !== false) tap(e);
});
cv.addEventListener('pointercancel', e => { lift(e); boxSel = null; faceDrag = null; });
// right click: whatever was armed is dropped; else nothing is picked any more, and a second one picks them all
// (in level 1, with no picking yet, it only drops)
function unpick() {
  if (!menu.hidden) { closeMenu(); return; }
  if (eyeArmed || buildArmed || fhqArmed || hqArmed || frontArmed || roadArmed || !$('buildm').hidden) { eyeArmed = false; buildArmed = null; fhqArmed = false; hqArmed = false; frontArmed = false; roadArmed = false; $('buildm').hidden = true; syncButtons(); return; }
  if (uiHas('squads')) select(sel === null ? 'all' : null);
}
// the upgrade button (Trophy) over our picked tank workshop: shown while it can be had; the time left while it's made
function syncUpgrade() {
  const b = $('upgBtn'), n = selNode != null && s.nodes.find(k => k.id === selNode && k.side === 'blue' && k.hp > 0 && Sim.STRUCTS[k.kind].upgrade && s.t >= k.ready);
  const show = !!n && !(s.trophy && s.trophy.blue) && !s.over;
  b.hidden = !show; if (!show) return;
  const p = onScreen(n.x, n.y - Sim.STRUCTS[n.kind].r - 18);
  b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
  const txt = n.upg ? tr('trophyOn', Math.ceil(n.upg.until - s.t)) : tr('trophyGo', Math.round(Sim.TROPHY_BUILD / 60));
  if (b.textContent !== txt) b.textContent = txt; b.disabled = !!n.upg; b.dataset.id = n.id;
}
$('upgBtn').addEventListener('click', e => { e.stopPropagation(); if (Sim.upgrade(s, 'blue', +$('upgBtn').dataset.id)) { syncUpgrade(); updateHud(); } });
// pulling down a picked building of ours (not the HQ): the question first; the game waits meanwhile
let razeId = null, razeWasPlaying = false;
function askRaze() {
  const n = selNode != null && s.nodes.find(k => k.id === selNode && k.side === 'blue' && k.hp > 0);
  if (!n || n.kind === 'hq') return false;
  razeId = n.id; razeWasPlaying = playing; setPlaying(false);
  $('razeQ').textContent = tr('razeQ', sn(n.kind)); $('razeSure').hidden = false; $('razeYes').focus(); return true;
}
function endRaze(yes) {
  $('razeSure').hidden = true;
  if (yes && Sim.demolish(s, 'blue', razeId)) { selNode = null; select(null); }
  razeId = null; if (razeWasPlaying) setPlaying(true);
}
$('razeYes').addEventListener('click', () => endRaze(true));
$('razeNo').addEventListener('click', () => endRaze(false));
// edge scroll: where the mouse is (null when it has left the window)
let mouseAt = null;
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouseAt = { x: e.clientX, y: e.clientY }; });
document.documentElement.addEventListener('mouseleave', () => { mouseAt = null; });
window.addEventListener('blur', () => { mouseAt = null; });
const EDGE_PX = 10, EDGE_SPEED = 700;
function edgeScroll(dt) {
  if (!mouseAt || drag || !$('intro').hidden || !$('end').hidden) return;
  const W = innerWidth, H = innerHeight, x = mouseAt.x, y = mouseAt.y;
  const dx = x < EDGE_PX ? 1 : x > W - EDGE_PX ? -1 : 0, dy = y < EDGE_PX ? 1 : y > H - EDGE_PX ? -1 : 0;
  if (dx || dy) panBy(dx * EDGE_SPEED * dt, dy * EDGE_SPEED * dt);
}
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
// minimap: tap or drag to look there
const mini = $('mini');
function miniLook(e) { const r = mini.getBoundingClientRect(); lookAt((e.clientX - r.left) / r.width * s.W, (e.clientY - r.top) / r.height * s.H); }
mini.addEventListener('pointerdown', e => { try { mini.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } miniLook(e); });
mini.addEventListener('pointermove', e => { if (e.buttons) miniLook(e); });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); saveLog(); return; } // (the log, as a file)
  if (e.key === 'F8') { e.preventDefault(); Prof.toggle(); return; } // (the speed, live: prof.js)
  if (tour) { if (e.key === 'Escape') tourNext(true); else if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) { e.preventDefault(); tourNext(); } return; }
  if (!$('intro').hidden) { if (e.key === 'Escape') $('go').click(); return; }
  if (!$('end').hidden) return;
  // the "pull it down?" question: Enter = yes, Escape = no
  if (!$('razeSure').hidden) { if (e.key === 'Enter') { e.preventDefault(); $('razeYes').click(); } else if (e.key === 'Escape') $('razeNo').click(); return; }
  // Delete / Backspace on a picked building of ours: pull it down, once the player says yes
  if ((e.key === 'Delete' || e.key === 'Backspace') && askRaze()) { e.preventDefault(); return; }
  // physical key codes, so the shortcuts also work on a Hebrew keyboard layout
  const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : e.key.toLowerCase();
  // keys for controls this level doesn't have yet do nothing
  const need = /^\d$/.test(k) ? 'squads' : 'har'.includes(k) ? 'orders' : { d: 'eye', b: 'fhq', g: 'build' }[k];
  if (need && !uiHas(need)) return;
  // Ctrl + a number: what's picked becomes that group; the number alone: the button with that number (a second press
  // brings the camera there). Alt + a number: this view is saved as that point; Shift + it: back to it (field.js)
  if (/^\d$/.test(k) && e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); saveView(+k); }
  else if (/^\d$/.test(k) && e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goView(+k); }
  else if (/^[1-9]$/.test(k) && (e.ctrlKey || e.metaKey)) { e.preventDefault(); keyGroup(+k); }
  else if (/^[1-9]$/.test(k)) { const kb = document.querySelector(`#sqs kbd[data-k="${k}"]`); if (kb) kb.parentElement.click(); }
  else if (k === 'l' && uiHas('squads')) toggleGroup();
  else if (k === 's' && !$('silent').hidden) toggleSilent();
  else if (k === 'p') { // line ↔ block for what's picked
    const ids = sel === 'all' ? s.squads.filter(q => q.side === 'blue' && !q.dead && inAll(q)).map(q => q.id) : selIds(), to = ids.length && Sim.pack(s, ids);
    if (to) toast(tr(to === 'block' ? 'packBlock' : 'packLine'), innerWidth / 2, innerHeight / 2, 1200);
  }
  else if (k === '0') select('all');
  else if (k === 'h') { mode = 'hold'; syncButtons(); }
  else if (k === 'a') { mode = 'attack'; syncButtons(); }
  else if (k === 'r') issue('retreat');
  else if (k === ' ') { e.preventDefault(); if (!e.repeat) setPlaying(!playing); }
  else if (k === 'd') toggleEye();
  else if (k === 'b') buildHere();
  else if (k === 'g') toggleBuild();
  else if (k === 'f') $('fs').click();
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const d = 120; panBy(e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0, e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0); }
  else if (e.key === '+' || e.key === '=' || e.key === '-') zoomAt(fit.w / 2, fit.top + fit.h / 2, e.key === '-' ? 1 / 1.25 : 1.25);
  else if (k === 'escape') { eyeArmed = false; buildArmed = null; fhqArmed = false; hqArmed = false; frontArmed = false; roadArmed = false; $('buildm').hidden = true; syncButtons(); closeMenu(); }
});
