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
  if (buildArmed) { placeBuilding(x, y); return; }
  if (!$('buildm').hidden) { $('buildm').hidden = true; syncButtons(); return; }
  // tapping one of our buildings selects the squad it raises
  const home = s.nodes.find(n => n.side === 'blue' && n.squad && Math.hypot(n.x - x, n.y - y) < 18);
  if (home && s.squads.some(q => q.id === home.squad)) { select(home.squad); return; }
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
  else if (k === 'escape') { eyeArmed = false; buildArmed = null; $('buildm').hidden = true; syncButtons(); menu.hidden = true; $('gear').setAttribute('aria-expanded', 'false'); }
});
