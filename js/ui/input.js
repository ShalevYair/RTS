// UI: pointer and keyboard input
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.cox) / view.css, y: (e.clientY - r.top - view.coy) / view.css };
}

function hitSquad(x, y) {
  for (const q of s.squads) { const p = q.side === 'blue' && !q.dead && pos(q); if (p && Math.hypot(p.x - x, p.y - 26 - y) < 17) return q.id; }
  if (s.fog) return null; // individual units aren't on the situation map
  const tol = Math.max(12, 22 / view.css); let best = null, bd = tol;
  for (const u of s.units) { if (u.side !== 'blue') continue; const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u.squad; } }
  return best;
}
cv.addEventListener('pointerdown', e => {
  if (!menu.hidden) { menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); return; }
  if (s.over) return;
  const { x, y } = toWorld(e);
  if (x < 0 || y < 0 || x > s.W || y > s.H) return;
  if (eyeArmed) { Sim.drone(s, 'blue', x, y); eyeArmed = false; syncButtons(); updateHud(); return; }
  // tapping a facility in the base selects that force
  for (const t in s.bases.blue.fac) {
    const f = s.bases.blue.fac[t];
    if (Math.abs(x - f.x) < 26 && Math.abs(y - f.y) < 22) { select(s.squads.find(q => q.side === 'blue' && q.type === t).id); return; }
  }
  const hit = hitSquad(x, y);
  if (hit) { select(hit); return; }
  issue(mode, x, y);
});
const TRAIT_KEY = { q: 'cautious', w: 'balanced', e: 'aggressive' };
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (!$('intro').hidden) { if (e.key === 'Escape') $('go').click(); return; }
  if (!$('end').hidden) return;
  // physical key codes, so the shortcuts also work on a Hebrew keyboard layout
  const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : e.key.toLowerCase();
  if (['1', '2', '3', '4'].includes(k)) select('blue' + (+k - 1));
  else if (k === '0') select('all');
  else if (k === 'h') { mode = 'hold'; syncButtons(); }
  else if (k === 'a') { mode = 'attack'; syncButtons(); }
  else if (k === 'r') issue('retreat');
  else if (k in TRAIT_KEY) document.querySelector(`[data-trait="${TRAIT_KEY[k]}"]`).click();
  else if (k === ' ') { e.preventDefault(); setPlaying(!playing); }
  else if (k === 'd') toggleEye();
  else if (k === 'b') buildHere();
  else if (k === 'escape') { eyeArmed = false; syncButtons(); menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); }
});
