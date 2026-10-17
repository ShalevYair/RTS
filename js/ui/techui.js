// UI: the tech tree (the supply chain, econ.js) — one look at what comes from what. Columns in the reading direction
// (left to right in English, right to left in Hebrew — the grid's own direction): the sources (mines, fields, the
// hi-tech centre), the plants, the service buildings, the fighting buildings. Each building: its picture, built ✓ /
// can go up now (a green halo) / locked (dimmed, "needs first: …"); a line from each thing to what needs it (not the
// concrete plant — everything needs it — nor the fuel station: a ⛽ badge on what waits for it). A click on one that can
// go up: closed, and it's armed to put down. The game stands still while it's open. The button: the stock under the
// power bar (and K / Tab).

// the rows: [source, plant, service, fighting buildings — a list, or a line of text]
const TECH_ROWS = [
  ['oilwell', 'refinery', 'fuelst', 'techVeh'],
  [null, 'chemplant', 'depot', 'techForces'],
  ['ironmine', 'steelmill', null, ['tankshop', 'jeepshop', 'jeepat', 'jeepaa', 'howshop', 'mlrsshop', 'garage']],
  ['quarry', 'concrete', null, 'techAll'],
  ['farm', 'kitchen', 'waterst', ['tent', 'atpost', 'aapost', 'clinic', 'commandopost']],
  ['bauxmine', 'smelter', null, ['airfield', 'tankerbase', 'heliatk', 'heligun', 'helilift']],
  ['hitech', 'elab', null, ['ssmshop', 'arrowsite', 'domesite']],
];
// (dotted: "uses what it makes" — not a building that has to stand first: soldiers eat rations)
const TECH_USES = [['waterst', 'tent'], ['waterst', 'atpost'], ['waterst', 'aapost'], ['waterst', 'clinic'], ['waterst', 'commandopost']];
let techWas = null; // (playing, before it opened)

function techOpen() {
  if (!s || !s.econ || !$('techTree').hidden) return;
  techWas = playing; setPlaying(false); hideTip();
  $('buildm').hidden = true; buildArmed = null;
  techBuild(); $('techTree').hidden = false; requestAnimationFrame(techLines); syncButtons();
}
function techClose() {
  if ($('techTree').hidden) return;
  $('techTree').hidden = true; hideTip();
  if (techWas && $('intro').hidden && $('end').hidden && menu.hidden) setPlaying(true); else syncButtons();
}
const techToggle = () => $('techTree').hidden ? techOpen() : techClose();

// shown: everything this game has, the partner's arms too (the whole tree — his are marked)
const techShown = k => !(Sim.STRUCTS[k].fuel && !s.fuel) && !(s.builds && !s.builds.includes(k));
// what a building is to this side now: 'done' (one stands), 'can' (it may go up), 'lock' (it waits for something)
function techState(k) {
  if (s.nodes.some(n => n.side === 'blue' && n.kind === k && n.hp > 0 && s.t >= n.ready)) return 'done';
  return Sim.needsOf(s, 'blue', k) ? 'lock' : 'can';
}
// its small line: a mine — its haulers; a plant — what it makes; a fighting building — its unit and what one costs
function techLine(k) {
  const S = Sim.STRUCTS[k], P = Sim.PLANT_OF[k];
  if (S.deposit) return tr('good_' + Sim.DEP_KINDS[S.deposit].makes);
  if (P) return tr('good_' + P) + (k === 'refinery' ? ' + ' + tr('good_rubber') : '');
  if (k === 'chemplant') return tr('good_explosives');
  if (k === 'elab') return tr('good_electronics');
  if (k === 'hitech') return tr('techLab') + ' · ' + tr('needsItem', Sim.NEEDS.hitech.map(sn).join(' + '));
  if (!S.unit) return '';
  const c = Sim.UNIT_COST[S.unit] || {}, ic = Object.fromEntries(STOCK_SHOW.map(([g, i]) => [g, i]));
  return tn(S.unit) + (Object.keys(c).length ? ' · ' + Object.entries(c).map(([g, n]) => n + ic[g]).join(' ') : '');
}
function techNode(k) {
  const b = document.createElement('button'), st = techState(k), S = Sim.STRUCTS[k];
  const mate = Sim.armSide(s, 'blue', k) === 'mate';
  b.className = 'tnode ' + st + (mate ? ' mate' : ''); b.dataset.tk = k; b.dataset.tip = 'tech';
  b.innerHTML = '<canvas width="84" height="84"></canvas><b></b><small></small>' + (st === 'done' ? '<i class="tok">✓</i>' : '');
  drawPic(b.querySelector('canvas'), k);
  b.querySelector('b').textContent = sn(k); b.querySelector('small').textContent = techLine(k);
  const fuel = S.unit && Sim.needsFuel(S.unit) && Sim.STRUCTS.fuelst; if (fuel) { const i = document.createElement('i'); i.className = 'tfuel'; i.textContent = '⛽'; b.appendChild(i); }
  b.tipText = () => { const nd = Sim.needsOf(s, 'blue', k); return sn(k) + (mate ? ' · ' + tr('techMate') : '') + ' · ' + (nd ? tr('needsItem', needName(nd)) : st === 'done' ? tr('techDone') : tr('techCan')); };
  b.addEventListener('click', () => {
    const nd = Sim.needsOf(s, 'blue', k);
    if (nd) { advWhy('needs', k); const r = b.getBoundingClientRect(); toast(tr('needsWhy', needName(nd)), r.left + r.width / 2, r.top - 10); blink(b); return; }
    if (Sim.armSide(s, 'blue', k) === 'mate') { const r = b.getBoundingClientRect(); toast(tr('techMate'), r.left + r.width / 2, r.top - 10); return; } // (the partner's arm: he builds it)
    if (!buildOk(k)) return;
    techClose(); buildArmed = k; syncButtons();
  });
  b.addEventListener('mouseenter', () => techLit(k, true)); b.addEventListener('mouseleave', () => techLit(k, false));
  return b;
}
// the grid, fresh each time it opens (what stands changes)
function techBuild() {
  const g = $('techGrid'); g.innerHTML = '';
  for (const h of ['techC1', 'techC2', 'techC3', 'techC4']) { const d = document.createElement('div'); d.className = 'thead'; d.textContent = tr(h); g.appendChild(d); }
  for (const row of TECH_ROWS) row.forEach((c, j) => {
    const d = document.createElement('div'); d.className = 'tcell' + (j === 3 ? ' tlast' : '');
    if (Array.isArray(c)) c.filter(techShown).forEach(k => d.appendChild(techNode(k)));
    else if (c && Sim.STRUCTS[c]) { if (techShown(c)) d.appendChild(techNode(c)); }
    else if (c) { const t = document.createElement('div'); t.className = 'tall'; t.textContent = tr(c); d.appendChild(t); }
    g.appendChild(d);
  });
}
// the lines: from each building to what needs it (both on the grid; not the concrete plant, not the fuel station) —
// drawn from where they are on the screen, so the reading direction comes for free
function techLines() {
  const svg = $('techSvg'), box = $('techGrid').getBoundingClientRect(); if (!box.width) return;
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); svg.style.width = box.width + 'px'; svg.style.height = box.height + 'px';
  const at = k => document.querySelector(`#techGrid [data-tk="${k}"]`), rtl = getComputedStyle($('techGrid')).direction === 'rtl';
  let out = '';
  // (into the last column: one line to the row's box — a line to each building ran through the ones before it)
  const done = new Set();
  const line = (a, b, cls) => {
    let A = at(a), B = at(b); if (!A || !B) return;
    const col = e => [...$('techGrid').children].indexOf(e.closest('.tcell')) % 4; if (col(B) <= col(A)) return; // (backward — the hi-tech centre, a source that needs plants: said under it, not a line across the tree)
    const cell = B.closest('.tlast'); if (cell) { const key = a + '>' + [...cell.parentNode.children].indexOf(cell); if (done.has(key)) return; done.add(key); B = cell; }
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const x1 = (rtl ? ra.left : ra.right) - box.left, y1 = ra.top + ra.height / 2 - box.top, x2 = (rtl ? rb.right : rb.left) - box.left, y2 = rb.top + rb.height / 2 - box.top, m = (x1 + x2) / 2;
    const to = cell ? [...cell.querySelectorAll('[data-tk]')].map(e => e.dataset.tk).filter(k => (Sim.NEEDS[k] || []).includes(a) || TECH_USES.some(([x, y]) => x === a && y === k)).join(' ') : b; // (lit: only the ones in the box that need it)
    out += `<path class="${cls}" data-to="${to}" data-from="${a}" d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}"/>`;
  };
  for (const [k, need] of Object.entries(Sim.NEEDS)) for (const n of need) if (n !== 'concrete' && n !== 'fuelst') line(n, k, 'tl ' + techState(n));
  for (const [a, b] of TECH_USES) line(a, b, 'tl use');
  svg.innerHTML = out;
}
// hovering a building: the lines into it (what it needs) and out of it (what it opens) light up
function techLit(k, on) { for (const p of document.querySelectorAll('#techSvg path')) p.classList.toggle('lit', on && (p.dataset.to.split(' ').includes(k) || p.dataset.from === k)); }

$('techClose').addEventListener('click', techClose);
$('techTree').addEventListener('click', e => { if (e.target === $('techTree')) techClose(); });
$('stockB').addEventListener('click', techOpen);
$('techM').querySelector('svg').innerHTML = STOCK_SVG.tech;
$('techM').addEventListener('click', () => { closeMenu(false); techOpen(); techWas = true; }); // (from the ⚙ menu: it stays still — techOpen keeps it stopped, and closing the tree goes back to play)
addEventListener('resize', () => { if (!$('techTree').hidden) techLines(); });
