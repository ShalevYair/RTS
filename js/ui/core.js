// UI: DOM handles, game/UI state, theme colors, viewport and helpers shared by the UI files
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage'), bar = $('bar'), menu = $('menu');
const nodeHp = new Map(), can = { fhq: true, drone: true }; // (our buildings' health last frame; what could be done last frame)
let selNode = null, pings = []; // (a picked building's id; the arrows marking where an order went)
let roadArmed = false, roadFrom = null; // (laying a road: armed, and where it starts once tapped — roadui.js)
let s, decor, sel = 'all', mode = 'hold', playing = false, rate = 1, logKey = '', hudAt = 0, diff = 'normal', endShown = false, fog = true, buildArmed = null;
try { fog = localStorage.getItem('irts-fog') !== '0'; } catch (e) { /* storage unavailable */ }
try { const d = localStorage.getItem('irts-diff'); if (d in Sim.DIFFS) diff = d; } catch (e) { /* storage unavailable */ }
// the enemy's style in the full game (the main menu): 'random' = a different one each game (Sim.AI_STYLES)
let foeStyle = 'random';
try { const f = localStorage.getItem('irts-foe'); if (f && (f === 'random' || f in Sim.AI_STYLES)) foeStyle = f; } catch (e) { /* storage unavailable */ }
// tutorial: `done` = the highest level won; `lvl` = the level being played (0 = the full game, with its settings)
let done = 0;
try { done = Math.max(0, Math.min(Sim.LEVELS, +localStorage.getItem('irts-done') || 0)); } catch (e) { /* storage unavailable */ }
let lvl = done >= Sim.LEVELS ? 0 : done + 1;
// what the player has in this game: everything in the full game, only the level's controls in the tutorial
const uiHas = k => !s.ui || s.ui.includes(k);
// selection: 'all', one squad id, or a list of ids (picked with a rectangle)
const isSel = id => sel === 'all' || sel === id || (Array.isArray(sel) && sel.includes(id));
const oneSel = () => typeof sel === 'string' && sel !== 'all' ? sel : null;
const colors = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ground', 'grass2', 'field', 'field2', 'hill', 'hillHi', 'hillLine', 'tree', 'treeHi', 'road', 'roadEdge', 'water', 'waterEdge', 'rock', 'shadow', 'halo', 'outline', 'blue', 'red', 'ink', 'point', 'line', 'tInf', 'tAa', 'tTank', 'tAir', 'tJeep', 'tMed', 'tMech', 'tTruck', 'fog'])
    colors[k] = cs.getPropertyValue('--c-' + k).trim();
}
readColors();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (e) { /* old browsers */ }
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const TC = { inf: 'tInf', aa: 'tAa', at: 'tAa', tank: 'tTank', air: 'tAir', tanker: 'tAir', jeep: 'tJeep', ajeep: 'tJeep', tjeep: 'tJeep', med: 'tMed', mech: 'tMech', truck: 'tTruck', fueltruck: 'tTruck', watertruck: 'tTruck' }, tcol = t => colors[TC[t]];
// drawn sizes: tanks big, soldiers (infantry, AA, medics) small
// (the soldiers as they were; the vehicles 2–3× that, the aircraft the biggest, then the tanks — with their bodies in
// the sim, TYPES[..].r, grown the same)
// WORLD_K: the world is 1.5× bigger than the units (the sim's bodies 1/1.5 of their look before); everything drawn
// for them is 1/WORLD_K and the camera opens / zooms WORLD_K× closer, so on screen they look the same
const WORLD_K = 1.5;
const SIZE = Object.fromEntries(Object.entries({ commando: 5.5, how: 30, mlrs: 26, ssm: 24, arrow: 22, dome: 22, lift: 40, heli: 36, gunship: 34, inf: 5, aa: 5.5, at: 5.5, tank: 40, air: 42, tanker: 50, jeep: 26, ajeep: 26, tjeep: 26, med: 5, mech: 20, truck: 20, fueltruck: 20, watertruck: 20, dozer: 24, radio: 22 }).map(([k, v]) => [k, v / WORLD_K]));
// vehicles (tracks, dust, wrecks)
const CAR = new Set(['tank', 'jeep', 'ajeep', 'tjeep', 'mech', 'truck', 'fueltruck', 'watertruck', 'dozer', 'radio', 'ssm', 'arrow', 'dome', 'how', 'mlrs']);

// ---- viewport: world is sized to the screen's aspect at game start; a camera (centre + zoom) looks at it ----
// zoom 1 = the whole map fits; zooming in stops at ZOOM_PX screen px per world unit. The big map opens on our base at
// START_PX (about the small map's look on a desktop), whatever the screen.
// map size: small / big (the default) / huge (2× the big one each way); hugeMap implies bigMap
let bigMap = true, hugeMap = false;
try { const m = localStorage.getItem('irts-map'); bigMap = m !== 'small'; hugeMap = m === 'huge'; } catch (e) { /* storage unavailable */ }
// the map is drawn at most MAX_DPR canvas pixels per screen pixel: on a dense screen (a laptop's 1.5–2×) every
// full-screen layer — the ground, the fog, the night — cost 2–4× the pixels, and the game crawled (9 fps at 2×);
// the browser scales it up, a little softer
// lite: the light mode, on by itself when the frames are slow (main.js, liteTick) — 1: no shadows under the units,
// no idle puffs, dust, tracks or clouds, the units look round for targets half as often; 2: the map drawn at
// LITE_RES of the pixels too. Better plainer and a little dumber than a game that hardly moves.
// (everyone — the right click's pick, the ★, "everyone" said: not the bulldozers, which would leave their sites, nor
// the missile trucks, which fire from far behind)
const NOT_ALL = ['dozer', 'ssm'], inAll = q => !NOT_ALL.includes(q.type);
let lite = 0; const LITE_RES = 0.7;
// gfxLow: the low graphics, picked in the settings (irts-gfx) — no shadows at all, no day and night, no rain or
// morning fog (they're not in the game at all then: s.night, s.wxPlan), the ground plain and at half the pixels (no
// contour lines, no hill shading, no stony ground or fields), and the light mode's step 1 always; the units as ever
let gfxLow = false;
try { gfxLow = localStorage.getItem('irts-gfx') === 'low'; } catch (e) { /* storage unavailable */ }
const MAX_DPR = 1, DPR = () => Math.min(window.devicePixelRatio || 1, MAX_DPR) * (lite >= 2 ? LITE_RES : 1);
const START_PX = 1 * WORLD_K, ZOOM_PX = 2.5 * WORLD_K;
// (the tutorial opens closer still, on our forces, TUT_AHEAD toward the enemy)
const TUT_PX = 1.7 * WORLD_K, TUT_AHEAD = 120;
let view = { scale: 1, ox: 0, oy: 0, css: 1, cox: 0, coy: 0 }, cam = { x: 0, y: 0, z: 1 }, fit = null;
function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width || !r.height || !s) return;
  // keep the map clear of the top HUD strip and the bottom toolbar
  const { top, bottom } = pads(), availH = Math.max(100, r.height - top - bottom);
  const dpr = DPR();
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  fit = { sc: Math.min(r.width / s.W, availH / s.H), w: r.width, h: availH, top, dpr };
  applyView();
  placeFloating();
}
const zoomMax = () => Math.max(1, ZOOM_PX / fit.sc);
// keep the camera on the map: a side that fits on screen is centred
function applyView() {
  if (!fit) return;
  if (cam.z < 0) { // a new big map (or a tutorial level): the opening zoom
    // (a tutorial level: less close on a narrow screen — a phone — and only a little ahead of our forces, by how much is seen)
    cam.z = (cam.px ? cam.px * Math.min(1, Math.max(0.55, fit.w / 900)) : START_PX) / fit.sc;
    if (cam.ahead) { cam.x += Math.min(cam.ahead, fit.w / (fit.sc * Math.max(1, cam.z)) * 0.2); cam.ahead = 0; }
  }
  cam.z = Math.max(1, Math.min(zoomMax(), cam.z));
  const sc = fit.sc * cam.z, vw = fit.w / sc, vh = fit.h / sc;
  cam.x = vw >= s.W ? s.W / 2 : Math.max(vw / 2, Math.min(s.W - vw / 2, cam.x));
  cam.y = vh >= s.H ? s.H / 2 : Math.max(vh / 2, Math.min(s.H - vh / 2, cam.y));
  const cox = fit.w / 2 - cam.x * sc, coy = fit.top + fit.h / 2 - cam.y * sc;
  view = { scale: sc * fit.dpr, ox: cox * fit.dpr, oy: coy * fit.dpr, css: sc, cox, coy };
}
// the part of the world on screen (for the minimap)
const viewRect = () => V3.on && V3.box ? V3.box : fit ? { x: (0 - view.cox) / view.css, y: (fit.top - view.coy) / view.css, w: fit.w / view.css, h: fit.h / view.css } : null;
// zoom by f keeping the world point under screen point (px, py) in place
function zoomAt(px, py, f) {
  if (V3.on) { px = fit.w / 2; py = fit.top + fit.h / 2; }
  const wx = (px - view.cox) / view.css, wy = (py - view.coy) / view.css;
  cam.z *= f; applyView();
  cam.x += wx - (px - view.cox) / view.css; cam.y += wy - (py - view.coy) / view.css; applyView();
}
// (the 3D view: zoom on the middle of the screen, and a pan up / down goes farther — the ground is seen slanting)
const panBy = (dx, dy) => { if (V3.on) dy /= Math.sin(V3_PITCH); cam.x -= dx / view.css; cam.y -= dy / view.css; applyView(); };
// a point of the stage (px from its corner) ↔ the world (the 3D view has its own: three3d.js)
const scrToWorld = (px, py) => V3.on ? v3World(px, py) : { x: (px - view.cox) / view.css, y: (py - view.coy) / view.css };
const worldToScr = (x, y) => V3.on ? v3Screen(x, y) : { x: view.cox + x * view.css, y: view.coy + y * view.css };
const lookAt = (x, y) => { cam.x = x; cam.y = y; applyView(); };
new ResizeObserver(resize).observe(stage);
new ResizeObserver(resize).observe(document.querySelector('.hudl')); // the types can wrap to a second line
// the map stays clear of the top strip (power, types, buildings) and of the bottom bar and corner
const pads = () => ({ top: Math.max(56, document.querySelector('.hudl').offsetHeight + 16), bottom: Math.max(bar.offsetHeight, $('corner').offsetHeight, $('gOrd').offsetHeight) + 16 });
function worldWidth() {
  const r = stage.getBoundingClientRect(), { top, bottom } = pads(), h = r.height - top - bottom;
  return r.width && h > 100 ? Sim.H * r.width / h : 1000;
}
function placeFloating() {
  const b = bar.offsetHeight + 16;
  menu.style.bottom = $('corner').offsetHeight + 16 + 'px'; $('call').style.bottom = b + 'px'; $('buildm').style.bottom = b + 'px';
}

// what the player sees of a blue squad: its last report under command friction, the truth otherwise
// (in the full-control ring a squad reports all the time, so there it's live)
const pos = q => Sim.friction(s) ? s.rep[q.id] : { x: q.cx, y: q.cy, strength: q.strength, t: s.t, prev: null };

// blue squads in button / hotkey order (oldest first)
const blueSquads = () => s.squads.filter(q => q.side === 'blue');
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

// order symbols, the same on the buttons (SVG) and on the map (Path2D): a shield (hold), a sword (attack), a U-turn
// arrow (retreat), a plus (support); drawn in a 24-unit box around 0
const ORDER_PATH = {
  hold: 'M0-10.5L8.5-7.2V-0.5C8.5 5 4.6 8.8 0 10.5C-4.6 8.8-8.5 5-8.5-0.5V-7.2Z',
  attack: 'M8.1 -8.1L7.5 -4.2L-0.6 4.0L2.3 6.8L0.3 8.8L-2.9 5.5L-4.9 7.5L-4.1 8.3L-6.1 10.2L-10.2 6.1L-8.3 4.1L-7.5 4.9L-5.5 2.9L-8.8 -0.3L-6.8 -2.3L-4.0 0.6L4.2 -7.5L8.1 -8.1Z',
  retreat: 'M-10-2.5L-3-9.5V-5.5H2C7 -5.5 10-2 10 2.5V9H5.5V3C5.5 0.5 4-1 1.5-1H-3V4.5Z',
  support: 'M-2.5-9H2.5V-2.5H9V2.5H2.5V9H-2.5V2.5H-9V-2.5H-2.5Z',
};
const orderSvg = k => `<svg class="ico" viewBox="-12 -12 24 24" aria-hidden="true"><path d="${ORDER_PATH[k]}" fill="currentColor"/></svg>`;
