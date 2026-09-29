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
  for (const u of s.units) { if (u.side !== 'blue' || (Sim.friction(s) && !shownAt(u))) continue; const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u.squad; } }
  return best;
}
// a tap on the map: select, place, or give the order
function tap(e) {
  if (!menu.hidden) { closeMenu(); return; }
  if (s.over) return;
  const { x, y } = toWorld(e);
  if (x < 0 || y < 0 || x > s.W || y > s.H) return;
  if (eyeArmed) { Sim.drone(s, 'blue', x, y); eyeArmed = false; syncButtons(); updateHud(); return; }
  if (buildArmed) { placeBuilding(x, y); return; }
  if (fhqArmed) { placeFhq(x, y); return; }
  if (!$('buildm').hidden) { $('buildm').hidden = true; syncButtons(); return; }
  // tapping one of our buildings selects the squad it raises
  const home = s.nodes.find(n => n.side === 'blue' && n.squad && Math.hypot(n.x - x, n.y - y) < tapR(24));
  if (home && s.squads.some(q => q.id === home.squad)) { pickSquad(home.squad); return; }
  const hit = hitSquad(x, y);
  if (hit) { pickSquad(hit); return; }
  issue(mode, x, y);
}
// Mouse: a left click gives the order (or picks the squad under it); left-drag draws a rectangle that picks every squad
// in it; right-drag gives the order with a facing (from where it starts, the front toward where it's dragged), a right
// click clears the pick; middle-drag pans; the wheel zooms;
// the view also slides when the pointer rests at a screen edge. Touch: one finger pans, two pinch; press and hold, then
// drag, is the order with a facing.
// A press that moves more than DRAG_PX is not a tap.
const DRAG_PX = 8, touches = new Map();
let drag = null, boxSel = null, faceDrag = null;
const HOLD_MS = 450;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  const box = e.pointerType === 'mouse' && e.button === 0 && !eyeArmed && !buildArmed && !fhqArmed;
  const free = !eyeArmed && !buildArmed && !fhqArmed;
  drag = touches.size === 1 ? { x: e.clientX, y: e.clientY, moved: false, box, tapOk: e.button === 0, face: e.pointerType === 'mouse' && e.button === 2 && free, right: e.pointerType === 'mouse' && e.button === 2 } : { moved: true };
  if (drag.face) { const r = cv.getBoundingClientRect(); faceDrag = { x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top }; }
  // touch: held still for a moment, the drag that follows sets a facing
  if (e.pointerType !== 'mouse' && touches.size === 1 && free) {
    const d = drag; d.hold = setTimeout(() => {
      if (drag !== d || d.moved || touches.size !== 1) return;
      const r = cv.getBoundingClientRect(); d.face = true; faceDrag = { x0: d.x - r.left, y0: d.y - r.top, x1: d.x - r.left, y1: d.y - r.top };
      try { navigator.vibrate && navigator.vibrate(15); } catch (err) { /* no vibration */ }
    }, HOLD_MS);
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
function pickBox(b) {
  const w0 = { x: (Math.min(b.x0, b.x1) - view.cox) / view.css, y: (Math.min(b.y0, b.y1) - view.coy) / view.css };
  const w1 = { x: (Math.max(b.x0, b.x1) - view.cox) / view.css, y: (Math.max(b.y0, b.y1) - view.coy) / view.css };
  const inside = (x, y) => x >= w0.x && x <= w1.x && y >= w0.y && y <= w1.y;
  const ids = blueSquads().filter(q => { if (q.dead) return false; const p = guessAt(q); return p && (inside(p.x, p.y) || inside(p.x, p.y - 26)); }).map(q => q.id);
  // a squad in a group brings its whole group along
  for (const id of ids.slice()) { const g = groupOf(id); if (g) for (const x of g.ids) if (!ids.includes(x)) ids.push(x); }
  if (ids.length) select(ids.length === 1 ? ids[0] : ids);
}
const lift = e => { touches.delete(e.pointerId); if (drag) clearTimeout(drag.hold); if (!touches.size) drag = null; };
cv.addEventListener('pointerup', e => {
  const d = drag, b = boxSel, f = faceDrag; lift(e); boxSel = null; faceDrag = null;
  if (d && d.face) {
    if (!menu.hidden || s.over) return;
    if (Math.hypot(f.x1 - f.x0, f.y1 - f.y0) < DRAG_PX * 2) { if (d.right) unpick(); else tap(e); return; } // a plain right click: clear the pick; a hold: the order
    const w = p => ({ x: (p.x - view.cox) / view.css, y: (p.y - view.coy) / view.css }), a = w({ x: f.x0, y: f.y0 }), z = w({ x: f.x1, y: f.y1 });
    issue(mode, a.x, a.y, Math.atan2(z.y - a.y, z.x - a.x)); return;
  }
  if (d && d.box && d.moved && b) { if (!menu.hidden || s.over) return; pickBox(b); return; }
  if (d && d.right && !d.moved) { unpick(); return; }
  if (d && !d.moved && d.tapOk && e.isPrimary !== false) tap(e);
});
cv.addEventListener('pointercancel', e => { lift(e); boxSel = null; faceDrag = null; });
// right click: whatever was armed is dropped; else nothing is picked any more, and a second one picks them all
// (in level 1, with no picking yet, it only drops)
function unpick() {
  if (!menu.hidden) { closeMenu(); return; }
  if (eyeArmed || buildArmed || fhqArmed || !$('buildm').hidden) { eyeArmed = false; buildArmed = null; fhqArmed = false; $('buildm').hidden = true; syncButtons(); return; }
  if (uiHas('squads')) select(sel === null ? 'all' : null);
}
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
  if (tour) { if (e.key === 'Escape') tourNext(true); else if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) { e.preventDefault(); tourNext(); } return; }
  if (!$('intro').hidden) { if (e.key === 'Escape') $('go').click(); return; }
  if (!$('end').hidden) return;
  // physical key codes, so the shortcuts also work on a Hebrew keyboard layout
  const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : e.key.toLowerCase();
  // keys for controls this level doesn't have yet do nothing
  const need = /^\d$/.test(k) ? 'squads' : 'har'.includes(k) ? 'orders' : { d: 'eye', b: 'fhq', g: 'build' }[k];
  if (need && !uiHas(need)) return;
  if (/^[1-9]$/.test(k)) { const b = document.querySelectorAll('#sqs button')[+k - 1]; if (b) b.click(); }
  else if (k === 'l' && uiHas('squads')) toggleGroup();
  else if (k === '0') select('all');
  else if (k === 'h') { mode = 'hold'; syncButtons(); }
  else if (k === 'a') { mode = 'attack'; syncButtons(); }
  else if (k === 'r') issue('retreat');
  else if (k === ' ') { e.preventDefault(); setPlaying(!playing); }
  else if (k === 'd') toggleEye();
  else if (k === 'b') buildHere();
  else if (k === 'g') toggleBuild();
  else if (k === 'f') $('fs').click();
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const d = 120; panBy(e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0, e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0); }
  else if (e.key === '+' || e.key === '=' || e.key === '-') zoomAt(fit.w / 2, fit.top + fit.h / 2, e.key === '-' ? 1 / 1.25 : 1.25);
  else if (k === 'escape') { eyeArmed = false; buildArmed = null; fhqArmed = false; $('buildm').hidden = true; syncButtons(); closeMenu(); }
});
