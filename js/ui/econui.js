// UI: the supply chain (econ.js) — the deposits on the map (oil: dark pools; iron ore: rust-red rubble; lime: pale
// chalky stones), the free ones of the armed mine's kind ringed, a mine's ghost snapping onto one; the stock by the
// power bar (⛽ fuel, 🔩 steel, 🧱 concrete); the haulers' load and the plants' state in their tooltips.

// each deposit's look: blobs and stones, from its id (the same every frame)
const depLook = new Map();
const DEP_COL = { oil: ['#151311', '#2a2420', '#3a332c'], iron: ['#7a3a22', '#93502e', '#5c2a18'], lime: ['#d9d4c6', '#bfb8a6', '#ece8dc'], bauxite: ['#b5653a', '#c9805a', '#9a4e2c'], farm: ['#c9a944', '#b49236', '#dcc06a'] };
const DEP_ICON = { oil: '🛢️', iron: '⛏️', lime: '🪨', bauxite: '⛏️', farm: '🌾' };
function depShapes(d) {
  let L = depLook.get(d.id); if (L) return L;
  let h = 0; for (const ch of d.id + d.kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }, R = Sim.DEP_R;
  L = [];
  for (let i = 0; i < (d.kind === 'oil' ? 7 : 14); i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r()) * R * 0.85;
    L.push({ x: Math.cos(a) * q, y: Math.sin(a) * q, r: (d.kind === 'oil' ? 6 + r() * 9 : 2.5 + r() * 4) * (d.rich > 1.5 ? 1.15 : 1), c: Math.floor(r() * 3), a: r() * Math.PI });
  }
  depLook.set(d.id, L); return L;
}
// the deposits on the map (under the buildings): a soft patch, then its blobs / stones; free ones of the armed mine's
// kind with a pulsing green ring
function drawDeposits(c) {
  if (!s.deposits) return;
  const vr = viewRect(), R = Sim.DEP_R, arm = buildArmed && Sim.STRUCTS[buildArmed] && Sim.STRUCTS[buildArmed].deposit;
  for (const d of s.deposits) {
    if (vr && (d.x + 2 * R < vr.x || d.x - 2 * R > vr.x + vr.w || d.y + 2 * R < vr.y || d.y - 2 * R > vr.y + vr.h)) continue;
    const C = DEP_COL[d.kind], dry = Sim.depDry(d), full = d.amount ? Math.max(0, d.left) / d.amount : 1;
    c.save(); c.translate(d.x, d.y); c.globalAlpha = dry ? 0.25 : 0.45 + 0.55 * full; // (fades as it runs out; dry — a faint scar)
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.25); g.addColorStop(0, C[1] + 'aa'); g.addColorStop(0.7, C[1] + '55'); g.addColorStop(1, C[1] + '00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.25, 0, Math.PI * 2); c.fill();
    for (const [i, b] of depShapes(d).entries()) {
      if (i / depShapes(d).length > Math.max(0.25, full)) break; // (fewer stones / pools as it empties)
      c.fillStyle = C[b.c];
      if (d.kind === 'farm') { c.save(); c.rotate(b.a); c.fillRect(b.x - b.r * 1.6, b.y - 0.9, b.r * 3.2, 1.8); c.restore(); }
      else if (d.kind === 'oil') { c.beginPath(); c.ellipse(b.x, b.y, b.r, b.r * 0.7, b.a, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(160,170,200,.18)'; c.beginPath(); c.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.2, b.r * 0.35, b.r * 0.15, b.a, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); for (let k = 0; k < 5; k++) { const a = b.a + k * 1.26, q = b.r * (0.75 + 0.25 * Math.sin(k * 2.1 + b.a)); c.lineTo(b.x + Math.cos(a) * q, b.y + Math.sin(a) * q); } c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.6; c.stroke(); }
    }
    const free = Sim.freeDeposit(s, d.kind, d.x, d.y);
    if (arm === d.kind && free) {
      const pz = 1 / view.css, k = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      c.strokeStyle = `rgba(90,220,110,${0.5 + 0.4 * k})`; c.lineWidth = 2.5 * pz; c.setLineDash([7 * pz, 5 * pz]);
      c.beginPath(); c.arc(0, 0, R + 8 + 4 * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    // (free, and close enough to read: its icon, faint)
    if (free && view.css > 0.45) { c.globalAlpha *= 0.75; c.font = `${Math.round(14 / Math.max(0.6, view.css))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(DEP_ICON[d.kind], 0, 0); c.globalAlpha = 1; }
    c.restore();
  }
}
// a mine being placed: onto the free deposit of its kind under the pointer (as the simulation snaps it)
function snapMine(kind, w) {
  const S = Sim.STRUCTS[kind]; if (!S || !S.deposit || !s.deposits) return w;
  let best = null, bd = Math.max(Sim.DEP_R * 1.6, 40 / view.css);
  for (const d of s.deposits) { if (d.kind !== S.deposit || !Sim.freeDeposit(s, d.kind, d.x, d.y)) continue; const k = Math.hypot(d.x - w.x, d.y - w.y); if (k < bd) { bd = k; best = d; } }
  return best ? { x: best.x, y: best.y } : w;
}
// the deposit under the mouse (its tooltip line)
const hitDeposit = (x, y) => (s.deposits || []).find(d => Math.hypot(d.x - x, d.y - y) < tapR(Sim.DEP_R)) || null;
const depLeft = d => d.amount ? (Sim.depDry(d) ? tr('depDry') : tr('depLeft', Math.round(d.left), Math.round(d.left / d.amount * 100))) : '';
const depInfo = d => tr('dep_' + d.kind) + (d.rich > 1.5 ? ' ★' : '') + ' · ' + (Sim.depDry(d) ? tr('depDry') : (Sim.freeDeposit(s, d.kind, d.x, d.y) ? tr('depFree') : tr('depTaken')) + ' · ' + depLeft(d));
// the stock by the power bar (ours) — red when nearly out
const STOCK_SHOW = [['concrete', '🧱', 10], ['fuel', '⛽', 20], ['steel', '🔩', 8], ['rubber', '🛞', 4], ['rations', '🥫', 20], ['alu', '✈️', 6], ['explosives', '💣', 6], ['electronics', '💾', 3]];
function syncStock() {
  const el = $('stockB'); if (!el) return;
  const on = !!s.econ && !!s.stock; el.hidden = !on; if (!on) return;
  const st = Sim.stockOf(s, 'blue'), v = STOCK_SHOW.map(([g]) => Math.floor(st[g] || 0));
  const key = v.join('|'); if (el.dataset.k === key) return; el.dataset.k = key;
  el.innerHTML = STOCK_SHOW.map(([g, i, low], j) => `<span class="${v[j] < low ? 'low' : ''}">${i}${v[j]}</span>`).join('');
  el.tipText = () => tr('stockTip', STOCK_SHOW.map(([g, i], j) => `${i} ${tr('good_' + g)} ${v[j]}`).join(' · '));
}
// a hauler's / mine's / plant's state for tooltips and the info card
function econLine(o) {
  if (o.cargo !== undefined && Sim.HAUL[o.type]) return Math.round(o.cargo / Sim.HAUL_CAP * 100) + '%';
  if (o.kind && Sim.STRUCTS[o.kind] && Sim.STRUCTS[o.kind].deposit) { const d = (s.deposits || []).find(d => d.id === o.dep); return o.dry ? tr('depDry') : Math.round((o.store || 0) / Sim.WELL_KEEP * 100) + '%' + (d && d.amount ? ' · ' + depLeft(d) : ''); }
  if (o.noGood) return tr('waitGood', tr('good_' + o.noGood));
  if (o.noCon) return tr('waitCon');
  if (o.noBurn) return tr('noBurn');
  return '';
}
