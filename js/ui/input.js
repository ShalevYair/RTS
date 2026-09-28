// UI: pointer and keyboard input
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.cox) / view.css, y: (e.clientY - r.top - view.coy) / view.css };
}

// tap targets stay finger-sized when zoomed out
const tapR = r => Math.max(r, 14 / view.css);
function hitSquad(x, y) {
  for (const q of s.squads) { const p = q.side === 'blue' && !q.dead && pos(q); if (p && Math.hypot(p.x - x, p.y - 26 - y) < tapR(17)) return q.id; }
  if (s.fog) return null; // individual units aren't on the situation map
  const tol = Math.max(12, 22 / view.css); let best = null, bd = tol;
  for (const u of s.units) { if (u.side !== 'blue') continue; const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u.squad; } }
  return best;
}
// a tap on the map: select, place, or give the order
function tap(e) {
  if (!menu.hidden) { menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); return; }
  if (s.over) return;
  const { x, y } = toWorld(e);
  if (x < 0 || y < 0 || x > s.W || y > s.H) return;
  if (eyeArmed) { Sim.drone(s, 'blue', x, y); eyeArmed = false; syncButtons(); updateHud(); return; }
  if (buildArmed) { placeBuilding(x, y); return; }
  if (!$('buildm').hidden) { $('buildm').hidden = true; syncButtons(); return; }
  // tapping one of our buildings selects the squad it raises
  const home = s.nodes.find(n => n.side === 'blue' && n.squad && Math.hypot(n.x - x, n.y - y) < tapR(18));
  if (home && s.squads.some(q => q.id === home.squad)) { select(home.squad); return; }
  const hit = hitSquad(x, y);
  if (hit) { select(hit); return; }
  issue(mode, x, y);
}
// camera: drag to pan (a press that moves more than DRAG_PX is not a tap), two fingers to pinch, wheel to zoom
const DRAG_PX = 8, touches = new Map();
let drag = null;
cv.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  drag = touches.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : { moved: true };
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
  if (drag && !drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > DRAG_PX) { drag.moved = true; panBy(e.clientX - drag.x - dx, e.clientY - drag.y - dy); }
  if (drag && drag.moved) panBy(dx, dy);
});
const lift = e => { touches.delete(e.pointerId); if (!touches.size) drag = null; };
cv.addEventListener('pointerup', e => { const d = drag; lift(e); if (d && !d.moved && e.isPrimary !== false) tap(e); });
cv.addEventListener('pointercancel', lift);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
// minimap: tap or drag to look there
const mini = $('mini');
function miniLook(e) { const r = mini.getBoundingClientRect(); lookAt((e.clientX - r.left) / r.width * s.W, (e.clientY - r.top) / r.height * s.H); }
mini.addEventListener('pointerdown', e => { try { mini.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } miniLook(e); });
mini.addEventListener('pointermove', e => { if (e.buttons) miniLook(e); });
const TRAIT_KEY = { q: 'cautious', w: 'balanced', e: 'aggressive' };
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (!$('intro').hidden) { if (e.key === 'Escape') $('go').click(); return; }
  if (!$('end').hidden) return;
  // physical key codes, so the shortcuts also work on a Hebrew keyboard layout
  const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : e.key.toLowerCase();
  // keys for controls this level doesn't have yet do nothing
  const need = /^\d$/.test(k) ? 'squads' : 'har'.includes(k) ? 'orders' : k in TRAIT_KEY ? 'traits' : { d: 'eye', b: 'fhq', g: 'build' }[k];
  if (need && !uiHas(need)) return;
  if (/^[1-9]$/.test(k)) { const q = blueSquads()[+k - 1]; if (q) select(q.id); }
  else if (k === '0') select('all');
  else if (k === 'h') { mode = 'hold'; syncButtons(); }
  else if (k === 'a') { mode = 'attack'; syncButtons(); }
  else if (k === 'r') issue('retreat');
  else if (k in TRAIT_KEY) document.querySelector(`[data-trait="${TRAIT_KEY[k]}"]`).click();
  else if (k === ' ') { e.preventDefault(); setPlaying(!playing); }
  else if (k === 'd') toggleEye();
  else if (k === 'b') buildHere();
  else if (k === 'g') toggleBuild();
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const d = 120; panBy(e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0, e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0); }
  else if (e.key === '+' || e.key === '=' || e.key === '-') zoomAt(fit.w / 2, fit.top + fit.h / 2, e.key === '-' ? 1 / 1.25 : 1.25);
  else if (k === 'escape') { eyeArmed = false; buildArmed = null; $('buildm').hidden = true; syncButtons(); menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); }
});
