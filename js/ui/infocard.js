// UI: the info card. A click on anything on the map — a squad of ours, the partner's, the enemy's in sight, a building
// of any side (or the memory of one), a post — opens a card at the bottom of the screen: its picture, what it is, bars
// for its health, ammunition, fuel, water and load (what it has of them; the enemy's only health), what it's doing,
// and what it's for (the wiki's line). It follows the thing while open; a click on bare ground, ✕ or Esc closes it.
// The mouse over anything still gives the short line (input.js hover) — the partner's squads too now (hitMateSquad).
let card = null, cardT = 0;
const CARD_MS = 250, CARD_BARS = [['hp', '❤️'], ['ammo', '🔫'], ['fuel', '⛽'], ['water', '💧'], ['load', '📦']];
// a partner's squad under a spot (seen and picked by nobody — only looked at)
function hitMateSquad(x, y) {
  const tol = Math.max(12, 22 / view.css); let best = null, bd = tol;
  for (const u of s.units) {
    if (u.side !== 'blue' || Sim.armSide(s, 'blue', u.type) !== 'mate') continue;
    const d = Math.hypot(u.x - x, u.y - y) - Math.max(0, (SIZE[u.type] || 10) * 0.35); if (d < bd) { bd = d; best = u.squad; }
  }
  return best;
}
// what a click at (x, y) is on: a squad, a building (or its memory), a post — or nothing
function cardUnder(x, y) {
  const q = hitSquad(x, y) || hitMateSquad(x, y) || hitFoeSquad(x, y); if (q) return { t: 'sq', id: q };
  const n = hitNode(x, y, 'blue') || hitNode(x, y, 'red'); if (n) return n.mem ? { t: 'mem', id: n.id, n } : { t: 'node', id: n.id };
  const p = hitPost(x, y); return p ? { t: 'post', id: p.id } : null;
}
function cardAt(x, y) { card = cardUnder(x, y); cardT = 0; if (!card) $('infoCard').hidden = true; }
function closeCard() { card = null; $('infoCard').hidden = true; }
$('icClose').addEventListener('click', e => { e.stopPropagation(); closeCard(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && card) closeCard(); });
// the picture: the unit as on the map, nose up; a building's picture
function cardPic(cv, kind, unit, col) {
  const g = cv.getContext('2d'), W = cv.width; g.clearRect(0, 0, W, W);
  try {
    if (unit) { if (hasSprite(unit)) drawUnitPic(g, unit, W / 2, W / 2, W * 0.42 / (SPRITE_LEN[unit] || 1.3), col, -Math.PI / 2, -Math.PI / 2); else glyph(g, unit, W / 2, W / 2, W * 0.3, col, true, -Math.PI / 2, -Math.PI / 2); return; }
    const p = buildingPic(kind, col, 40), k = W * 0.95 / Math.max(p.width, p.height); g.drawImage(p, (W - p.width * k) / 2, (W - p.height * k) / 2, p.width * k, p.height * k);
  } catch (e) { /* not loaded yet */ }
}
// every frame (main.js): the card follows what it shows, CARD_MS apart; gone with it
function cardTick(now) {
  if (!card || !s) return; if (now - cardT < CARD_MS) return; cardT = now;
  const el = $('infoCard'), bars = {}, desc = WIKI_UNIT[lang === 'en' ? 'en' : 'he'], descS = WIKI_STRUCT[lang === 'en' ? 'en' : 'he'];
  let title = '', who = '', line = '', about = '', unit = null, kind = null, col = colors.blue;
  if (card.t === 'sq') {
    const q = s.squads.find(k => k.id === card.id), us = q ? s.units.filter(u => u.squad === q.id) : [];
    if (!q || q.dead || !us.length || (q.side === 'red' && s.fog && !us.some(u => s.vis.blue.has(u.id)))) return closeCard();
    const T = Sim.TYPES[q.type], n = us.length, avg = f => us.reduce((a, u) => a + f(u), 0) / n, ours = q.side === 'blue';
    unit = q.type; col = colors[q.side];
    title = tn(q.type) + (n > 1 ? ' ×' + n : ''); who = ours ? (Sim.ownSquad(s, q) ? tr('ic_ours') : tr('mate')) : tr('foe');
    bars.hp = avg(u => u.hp / T.hp);
    if (ours) {
      if (T.ammo) bars.ammo = avg(u => u.ammo / T.ammo); else if (s.supply && Sim.SUPPLY[q.type]) bars.ammo = avg(u => u.sup ?? 1);
      if (us.some(u => u.fuel !== undefined)) bars.fuel = avg(u => u.fuel ?? 1);
      if (us.some(u => u.water !== undefined)) bars.water = avg(u => u.water ?? 1);
      const cap = q.type === 'tanker' ? Sim.TANKER_CAP : Sim.TRUCK_CAP[q.type]; if (cap) bars.load = avg(u => (u.load ?? cap) / cap);
      const o = q.order || {}, st = [];
      if (q.retreating) st.push(tr('ic_back')); else if (o.type) st.push(tr(o.type === 'attack' ? 'ic_attack' : o.type === 'hold' ? 'ic_hold' : 'ic_back'));
      if (us.some(u => u.engaged)) st.push(tr('ic_fight'));
      if (us.every(u => u.dug)) st.push(tr('ti_dug')); else if (us.some(u => u.dig > 0 && !u.dug)) st.push(tr('ti_digging'));
      if (q.silent) st.push('🤫');
      line = st.join(' · ');
    }
    about = desc[q.type] || (ROLE[lang] || ROLE.he)[q.type] || '';
  } else if (card.t === 'post') {
    const p = (s.posts || []).find(k => k.id === card.id); if (!p) return closeCard();
    kind = p.kind; col = p.side ? colors[p.side] : '#9a9a9a';
    title = pn(p.kind); who = tr(p.side === 'blue' ? 'pi_ours' : p.side === 'red' ? 'pi_theirs' : 'pi_free'); about = tr('fx_' + p.kind); line = p.side === 'blue' ? '' : tr('pi_take');
  } else {
    const n = card.t === 'mem' ? card.n : s.nodes.find(k => k.id === card.id);
    if (!n || (card.t === 'node' && (n.hp <= 0 || !nodeShown(n)))) return closeCard();
    const S = Sim.STRUCTS[n.kind], fake = n.side === 'red' && n.kind === 'decoy'; kind = fake ? 'hq' : n.kind; col = colors[n.side];
    title = sn(kind) + (n.side === 'blue' && n.kind === 'decoy' ? ' 🎭' : '');
    who = n.side === 'blue' ? (Sim.armSide(s, 'blue', n.kind) === 'mate' ? tr('mate') : tr('ic_ours')) : tr('foe');
    if (card.t !== 'mem' && (n.side === 'blue' || !s.fog || Sim.idLevel(s, 'blue', n) >= 2)) bars.hp = n.hp / S.hp;
    line = nodeInfo(n).split(' · ').slice(1).filter(t => !/%$/.test(t)).join(' · ');
    about = descS[kind] || '';
  }
  el.querySelector('b').textContent = title; el.querySelector('.icWho').textContent = who;
  el.querySelector('.icLine').textContent = line; el.querySelector('.icDesc').textContent = about;
  el.querySelector('.icBars').innerHTML = CARD_BARS.filter(([k]) => bars[k] !== undefined).map(([k, ico]) => { const v = Math.max(0, Math.min(1, bars[k])); return `<div class="icBar"><span>${ico}</span><i style="--v:${(v * 100).toFixed(0)}%;--c:${v < 0.3 ? '#e04a3a' : v < 0.6 ? '#e8a530' : '#4cba5c'}"></i><small>${Math.round(v * 100)}%</small></div>`; }).join('');
  const cv = el.querySelector('canvas'), pk = (unit || kind) + col; if (cv.dataset.k !== pk) { cv.dataset.k = pk; cardPic(cv, kind, unit, col); }
  el.hidden = false;
}
