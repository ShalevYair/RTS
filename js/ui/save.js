// UI: a saved game — one place in IndexedDB (it keeps Sets, Maps, typed arrays and shared objects as they are, and has
// room for the huge map). 💾 in the settings, by itself every SAVE_EVERY of play and on leaving the game (🏠); the main
// menu's "continue" (#resume) when there is one. Only the full game; a finished game's save goes. What's kept: the
// state (Sim.saveState), and round it the camera, the groups, the screen spots and the scenery run over.
const SAVE_DB = 'irts', SAVE_KEY = 'last', SAVE_EVERY = 180000;
let saveDbH = null, saveAt = 0, saveFor = null, saveGoneFor = null;
try {
  const r = indexedDB.open(SAVE_DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('save');
  r.onsuccess = () => { saveDbH = r.result; syncResume(); };
} catch (e) { /* no IndexedDB: no saves */ }
const saveStore = mode => saveDbH.transaction('save', mode).objectStore('save');
const canSave = () => !!saveDbH && !!s && !lvl && !s.over && !!decor;
// (the put clones it all at once, now — the 🏠 that comes right after makes a new game)
function saveGame(quiet) {
  if (!canSave()) return false;
  try {
    const gone = []; decor.rocks.items.forEach((it, i) => { if (it.gone) gone.push(i); });
    const ui = { cam: Object.assign({}, cam), groups, nextGroup, views, gone, yaw: V3.yaw, pitch: V3.pitch };
    const req = saveStore('readwrite').put({ v: 1, at: Date.now(), t: s.t, s: Sim.saveState(s), ui }, SAVE_KEY);
    req.onerror = () => { if (!quiet) toast(tr('saveFail'), innerWidth / 2, innerHeight / 2); };
    saveAt = performance.now(); saveGoneFor = null;
    if (!quiet) { const b = $('saveBtn').getBoundingClientRect(); toast(tr('saved'), b.left + b.width / 2, b.top); }
    return true;
  } catch (e) { errLog('save', e); if (!quiet) toast(tr('saveFail'), innerWidth / 2, innerHeight / 2); return false; }
}
function readSave() {
  return new Promise(ok => { if (!saveDbH) return ok(null); const r = saveStore('readonly').get(SAVE_KEY); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
}
// the main menu: "continue" with the game's minute and how long ago
async function syncResume() {
  const b = $('resume'), d = await readSave(); b.hidden = !d; if (!d) return;
  $('resumeT').textContent = tr('resumeT', Math.floor(d.t / 60), tr('agoMin', Math.round((Date.now() - d.at) / 60000)));
}
async function resumeGame() {
  const d = await readSave(); if (!d) return syncResume();
  if (fsCan()) fullScreen(true);
  lvl = 0; newGame(true, d); showIntro(false);
  if (v3Want() && !V3.on) v3Toggle();
  if (d.ui.yaw !== undefined) { V3.yaw = d.ui.yaw; V3.pitch = d.ui.pitch; }
  saveAt = performance.now(); setPlaying(true);
}
$('resume').addEventListener('click', resumeGame);
$('saveBtn').addEventListener('click', () => saveGame(false));
// (🏠: saved before hud.js's listener makes a new game — capture on the button itself runs first)
$('homeYes').addEventListener('click', () => saveGame(true), true);
showIntro = (f => function (on) { f(on); if (on) syncResume(); $('saveBtn').hidden = !!lvl; })(showIntro);
// every second: the save by itself while playing; a game that's over takes its save with it
setInterval(() => {
  if (!saveDbH || !s || lvl) return;
  if (s.over) { if (saveGoneFor !== s) { saveGoneFor = s; readSave().then(d => { if (d && d.s.seed === s.seed) saveStore('readwrite').delete(SAVE_KEY); }); } return; }
  if (saveFor !== s) { saveFor = s; saveAt = performance.now(); } // (a new game: its first save SAVE_EVERY in — not the old one's over it at once)
  if (playing && performance.now() - saveAt > SAVE_EVERY) saveGame(true);
}, 1000);
