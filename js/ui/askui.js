// UI: asks between partners (arms; js/sim/asks.js). Alt + click on the map: a small wheel round the spot with what the
// partner can send there (Sim.canAsk) — a click on one asks; the partner says "on our way" or "we have none". Every
// ask on the map: its icon with a ring that pulses (blue ours, yellow the partner's), fading over Sim.ASK_T. The
// partner's asks of us: in the message list (a click takes the camera there), and said on the radio.
const ASK_ICON = { fuel: '⛽', ammo: '📦', water: '💧', fire: '🎯', lift: '🚁', guard: '🛡️', build: '🏗️' }, ASK_WHEEL_R = 52;
let askSeen = 0;
function openAskWheel(e, x, y) {
  closeAskWheel();
  const kinds = Sim.ASK_KINDS.filter(k => Sim.canAsk(s, 'blue', 'me', k));
  const st = $('stage').getBoundingClientRect(), w = document.createElement('div');
  w.id = 'askWheel'; w.style.left = (e.clientX - st.left) + 'px'; w.style.top = (e.clientY - st.top) + 'px';
  if (!kinds.length) { toast(tr('askNone'), e.clientX, e.clientY); return; }
  kinds.forEach((k, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / kinds.length, b = document.createElement('button');
    b.textContent = ASK_ICON[k]; b.dataset.tip = 'ask_' + k; b.setAttribute('aria-label', tr('ask_' + k));
    b.style.transform = `translate(${Math.cos(a) * ASK_WHEEL_R}px, ${Math.sin(a) * ASK_WHEEL_R}px)`;
    b.addEventListener('pointerdown', ev => ev.stopPropagation());
    b.addEventListener('click', ev => { ev.stopPropagation(); closeAskWheel(); askAt(k, x, y); });
    w.appendChild(b);
  });
  $('stage').appendChild(w);
}
function closeAskWheel() { const w = $('askWheel'); if (w) { w.remove(); hideTip(); } } // (only when it was open: every click hid any bubble — the tour's too, and the tutorial stood still)
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
  if (!s.asks || !s.asks.length) return;
  const px = 1 / view.css, now = performance.now() / 1000;
  for (const a of s.asks) {
    const age = s.t - a.t; if (age >= Sim.ASK_T || a.side !== 'blue') continue;
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
