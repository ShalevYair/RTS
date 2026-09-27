// UI: DOM handles, game/UI state, theme colors, viewport and helpers shared by the UI files
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage'), bar = $('bar'), menu = $('menu');
let s, decor, sel = 'all', mode = 'hold', playing = false, rate = 1, logKey = '', hudAt = 0, diff = 'normal', endShown = false, fog = true, buildArmed = null;
try { fog = localStorage.getItem('irts-fog') !== '0'; } catch (e) { /* storage unavailable */ }
try { const d = localStorage.getItem('irts-diff'); if (d in Sim.DIFFS) diff = d; } catch (e) { /* storage unavailable */ }
const colors = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ground', 'grass2', 'field', 'field2', 'hill', 'hillHi', 'hillLine', 'tree', 'treeHi', 'road', 'roadEdge', 'water', 'waterEdge', 'rock', 'shadow', 'halo', 'outline', 'blue', 'red', 'ink', 'point', 'line', 'tInf', 'tAa', 'tTank', 'tAir', 'tJeep', 'fog'])
    colors[k] = cs.getPropertyValue('--c-' + k).trim();
}
readColors();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (e) { /* old browsers */ }
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const TC = { inf: 'tInf', aa: 'tAa', tank: 'tTank', air: 'tAir', jeep: 'tJeep' }, tcol = t => colors[TC[t]];
const SIZE = { inf: 9, aa: 10, tank: 9, air: 13, jeep: 8 };
const POSTURE = { cautious: '🛡', balanced: '⚖', aggressive: '🔥' };

// ---- viewport: world is sized to the screen's aspect at game start ----
let view = { scale: 1, ox: 0, oy: 0, css: 1, cox: 0, coy: 0 };
function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width || !r.height || !s) return;
  // keep the map clear of the top HUD strip and the bottom toolbar
  const { top, bottom } = pads(), availH = Math.max(100, r.height - top - bottom);
  const dpr = window.devicePixelRatio || 1, sc = Math.min(r.width / s.W, availH / s.H);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const cox = (r.width - s.W * sc) / 2, coy = top + (availH - s.H * sc) / 2;
  view = { scale: sc * dpr, ox: cox * dpr, oy: coy * dpr, css: sc, cox, coy };
  placeFloating();
}
new ResizeObserver(resize).observe(stage);
const pads = () => ({ top: 56, bottom: bar.offsetHeight + 16 });
function worldWidth() {
  const r = stage.getBoundingClientRect(), { top, bottom } = pads(), h = r.height - top - bottom;
  return r.width && h > 100 ? 640 * r.width / h : 1000;
}
function placeFloating() {
  const b = bar.offsetHeight + 16;
  menu.style.bottom = b + 'px'; $('call').style.bottom = b + 'px'; $('buildm').style.bottom = b + 'px';
}

// what the player sees of a blue squad: its last report under fog, the truth otherwise
const pos = q => s.fog ? s.rep[q.id] : { x: q.cx, y: q.cy, strength: q.strength, t: s.t, prev: null };

// blue squads in button / hotkey order (oldest first)
const blueSquads = () => s.squads.filter(q => q.side === 'blue');
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
