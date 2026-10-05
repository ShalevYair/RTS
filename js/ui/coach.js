// UI: a coach. In the tutorial, a player who does nothing for HINT_IDLE s gets a nudge — red arrows on the enemy, or
// the building kinds pulsing, or 🏰 — with a word beside it, again every HINT_EVERY s while still idle.
// Everywhere, the first time something the tutorial doesn't teach turns up (the front, rally points, sending the
// hurt for care, groups, missile trucks, helicopters, commandos, radio silence), a one-line tip by it — once ever
// (irts-tips). None of this with irts-tour = 99 (the UI tests).
const HINT_IDLE = 10, HINT_EVERY = 12, TIP_MS = 6500;
let actAt = performance.now(), hintAt = 0, coachAt = 0;
const tipsSeen = new Set();
try { for (const k of JSON.parse(localStorage.getItem('irts-tips') || '[]')) tipsSeen.add(k); } catch (e) { /* storage unavailable */ }
// (anything the player does counts: a tap, a click, a key)
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { actAt = performance.now(); }, true);
const coachOff = () => toured === 99;
// a note at a world spot (or, off the screen, at the top of the map)
function noteAt(text, w) {
  if (!fit) return;
  const p = w && onScreen(w.x, w.y), inView = p && p.x > 40 && p.x < fit.w - 40 && p.y > fit.top + 40 && p.y < fit.top + fit.h - 40;
  toast(text, inView ? p.x : fit.w / 2, inView ? p.y - 24 : fit.top + 70, TIP_MS);
}
// ---- the tutorial: nudge the idle player toward what to do next ----
function hint() {
  // the open field: the HQ first
  if (hqToPlace() && !hqPlanned()) { noteBy('hqb', tr('h_hq')); return; }
  // room to build, and hardly anything built: the building kinds
  if (uiHas('build') && !buildFull() && Sim.buildCount(s, 'blue', 'me') < 2 && !$('bcats').hidden) { const b = $('bcats'); b.classList.remove('hint'); void b.offsetWidth; b.classList.add('hint'); noteBy('bcats', tr('h_build')); return; }
  // else: at the enemy — the nearest of theirs we can see (or remember), red arrows there
  const ours = s.units.filter(u => u.side === 'blue'); if (!ours.length) return;
  const c = { x: ours.reduce((a, u) => a + u.x, 0) / ours.length, y: ours.reduce((a, u) => a + u.y, 0) / ours.length };
  let best = null, bd = Infinity;
  for (const u of s.units) if (u.side === 'red' && (!s.fog || s.vis.blue.has(u.id))) { const d = Math.hypot(u.x - c.x, u.y - c.y); if (d < bd) { bd = d; best = u; } }
  if (!best) for (const k in s.memNodes.blue) { const n = s.memNodes.blue[k], d = Math.hypot(n.x - c.x, n.y - c.y); if (d < bd) { bd = d; best = n; } }
  if (!best) { const h = s.nodes.find(n => n.side === 'red' && n.kind === 'hq' && (!s.fog || s.visNodes.blue.has(n.id))); if (h) best = h; }
  if (!best) return;
  // (off the screen: the camera goes halfway between us and it — or to it, if that's still not enough)
  const vr = viewRect(), out = q => vr && (q.x < vr.x + 50 || q.x > vr.x + vr.w - 50 || q.y < vr.y + 50 || q.y > vr.y + vr.h - 50);
  if (out(best)) { lookAt((c.x + best.x) / 2, (c.y + best.y) / 2); if (out(best)) lookAt(best.x, best.y); }
  pings.push({ x: best.x, y: best.y, t: performance.now(), foe: true });
  noteAt(tr(TOUCH ? 'h_attackT' : 'h_attack'), best);
}
// ---- first-time tips: [key, where (a world spot / a button id) or null, when] ----
const ourOf = type => s.units.find(u => u.side === 'blue' && u.type === type);
const TIPS = [
  ['front', 'front', () => !$('front').hidden && s.nodes.some(n => n.side === 'blue' && Sim.STRUCTS[n.kind] && Sim.STRUCTS[n.kind].unit && s.t >= n.ready)],
  ['rally', () => selNode, () => selNode && selNode.side === 'blue' && Sim.STRUCTS[selNode.kind] && (Sim.STRUCTS[selNode.kind].unit || selNode.kind === 'hq')],
  ['care', () => { const id = selIds().find(careable); const u = id && s.units.find(k => k.squad === id); return u; }, () => sel !== 'all' && selIds().some(careable)],
  ['group', null, () => Array.isArray(sel) && sel.length >= 2 && !groups.some(g => sel.every(id => g.ids.includes(id)))],
  ['ssm', () => ourOf('ssm'), () => !!ourOf('ssm')],
  ['lift', () => ourOf('lift'), () => !!ourOf('lift')],
  ['heli', () => ourOf('heli') || ourOf('gunship'), () => !!(ourOf('heli') || ourOf('gunship'))],
  ['commando', () => ourOf('commando'), () => !!ourOf('commando')],
  ['posts', () => { const ours = s.units.filter(u => u.side === 'blue'); return s.posts && s.posts.slice().sort((a, b) => Math.min(...ours.map(u => Math.hypot(u.x - a.x, u.y - a.y))) - Math.min(...ours.map(u => Math.hypot(u.x - b.x, u.y - b.y))))[0]; }, () => !!s.posts && s.t > 15],
  ['voice', null, () => !lvl && !TOUCH && s.t > 40 && !!(window.SpeechRecognition || window.webkitSpeechRecognition)],
  ['silence', null, () => !lvl && Sim.friction(s) && s.t > 90 && s.squads.some(q => q.side === 'blue' && !q.dead && Sim.quality(s, 'blue', { x: q.cx, y: q.cy }) < 0.5)],
];
function tipCheck() {
  for (const [k, at, when] of TIPS) {
    if (tipsSeen.has(k)) continue;
    let ok = false; try { ok = !!when(); } catch (e) { /* not there yet */ }
    if (!ok) continue;
    tipsSeen.add(k); try { localStorage.setItem('irts-tips', JSON.stringify([...tipsSeen])); } catch (e) { /* ignore */ }
    if (typeof at === 'string') noteBy(at, tr('tip_' + k)); else noteAt(tr('tip_' + k), at && at());
    return; // (one at a time)
  }
}
// every frame, from main.js: once a second at most
function coachTick() {
  const now = performance.now();
  if (now - coachAt < 1000 || coachOff() || !playing || tour || s.over || !$('intro').hidden) { if (!playing || tour) actAt = Math.max(actAt, now - 2000); return; }
  coachAt = now;
  if (lvl && now - actAt > HINT_IDLE * 1000 && now - hintAt > HINT_EVERY * 1000) { hintAt = now; hint(); }
  tipCheck();
}
