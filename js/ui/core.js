// UI: DOM handles, game/UI state, theme colors, viewport and helpers shared by the UI files
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage'), bar = $('bar'), menu = $('menu');
let s, decor, sel = 'all', mode = 'hold', playing = false, rate = 1, logKey = '', hudAt = 0, diff = 'normal', endShown = false, fog = true, buildArmed = null;
try { fog = localStorage.getItem('irts-fog') !== '0'; } catch (e) { /* storage unavailable */ }
try { const d = localStorage.getItem('irts-diff'); if (d in Sim.DIFFS) diff = d; } catch (e) { /* storage unavailable */ }
// tutorial: `done` = the highest level won; `lvl` = the level being played (0 = the full game, with its settings)
let done = 0;
try { done = Math.max(0, Math.min(Sim.LEVELS, +localStorage.getItem('irts-done') || 0)); } catch (e) { /* storage unavailable */ }
let lvl = done >= Sim.LEVELS ? 0 : done + 1;
// what the player has in this game: everything in the full game, only the level's controls in the tutorial
const uiHas = k => !s.ui || s.ui.includes(k);
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

// ---- viewport: world is sized to the screen's aspect at game start; a camera (centre + zoom) looks at it ----
// zoom 1 = the whole map fits; zooming in stops at ZOOM_PX screen px per world unit. The big map opens on our base at
// START_PX (about the small map's look on a desktop), whatever the screen.
let bigMap = true;
try { bigMap = localStorage.getItem('irts-map') !== 'small'; } catch (e) { /* storage unavailable */ }
const START_PX = 1, ZOOM_PX = 2.5;
let view = { scale: 1, ox: 0, oy: 0, css: 1, cox: 0, coy: 0 }, cam = { x: 0, y: 0, z: 1 }, fit = null;
function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width || !r.height || !s) return;
  // keep the map clear of the top HUD strip and the bottom toolbar
  const { top, bottom } = pads(), availH = Math.max(100, r.height - top - bottom);
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  fit = { sc: Math.min(r.width / s.W, availH / s.H), w: r.width, h: availH, top, dpr };
  applyView();
  placeFloating();
}
const zoomMax = () => Math.max(1, ZOOM_PX / fit.sc);
// keep the camera on the map: a side that fits on screen is centred
function applyView() {
  if (!fit) return;
  if (cam.z < 0) cam.z = START_PX / fit.sc; // a new big map: the opening zoom
  cam.z = Math.max(1, Math.min(zoomMax(), cam.z));
  const sc = fit.sc * cam.z, vw = fit.w / sc, vh = fit.h / sc;
  cam.x = vw >= s.W ? s.W / 2 : Math.max(vw / 2, Math.min(s.W - vw / 2, cam.x));
  cam.y = vh >= s.H ? s.H / 2 : Math.max(vh / 2, Math.min(s.H - vh / 2, cam.y));
  const cox = fit.w / 2 - cam.x * sc, coy = fit.top + fit.h / 2 - cam.y * sc;
  view = { scale: sc * fit.dpr, ox: cox * fit.dpr, oy: coy * fit.dpr, css: sc, cox, coy };
}
// the part of the world on screen (for the minimap)
const viewRect = () => fit ? { x: (0 - view.cox) / view.css, y: (fit.top - view.coy) / view.css, w: fit.w / view.css, h: fit.h / view.css } : null;
// zoom by f keeping the world point under screen point (px, py) in place
function zoomAt(px, py, f) {
  const wx = (px - view.cox) / view.css, wy = (py - view.coy) / view.css;
  cam.z *= f; applyView();
  cam.x += wx - (px - view.cox) / view.css; cam.y += wy - (py - view.coy) / view.css; applyView();
}
const panBy = (dx, dy) => { cam.x -= dx / view.css; cam.y -= dy / view.css; applyView(); };
const lookAt = (x, y) => { cam.x = x; cam.y = y; applyView(); };
new ResizeObserver(resize).observe(stage);
const pads = () => ({ top: 56, bottom: bar.offsetHeight + 16 });
function worldWidth() {
  const r = stage.getBoundingClientRect(), { top, bottom } = pads(), h = r.height - top - bottom;
  return r.width && h > 100 ? Sim.H * r.width / h : 1000;
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
