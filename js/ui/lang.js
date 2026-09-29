// UI: language (עברית / English). Every word on screen comes from STR by key: static elements say which key with
// data-t (text), data-al (aria-label) and data-tip (the short tooltip); the scripts call tr(key, …args).
let lang = 'he';
try { const l = localStorage.getItem('irts-lang'); if (l === 'he' || l === 'en') lang = l; } catch (e) { /* storage unavailable */ }
const EN_TYPES = { inf: 'Infantry', tank: 'Tanks', air: 'Aircraft', aa: 'Anti-air', jeep: 'Jeeps', med: 'Medics', mech: 'Mechanics', truck: 'Supply trucks' };
const EN_STRUCTS = { hq: 'HQ', fhq: 'Forward HQ', drone: 'Drone', tent: 'Tent', aapost: 'AA post', jeepshop: 'Jeep workshop', tankshop: 'Tank workshop', airfield: 'Airfield', clinic: 'Medic station', garage: 'Garage', depot: 'Supply depot' };
const EN_NAMES = { 'כהן': 'Cohen', 'לוי': 'Levi', 'מזרחי': 'Mizrahi', 'פרץ': 'Peretz', 'ביטון': 'Biton', 'אברהם': 'Avraham', 'פרידמן': 'Friedman', 'אזולאי': 'Azoulay', 'דהן': 'Dahan', 'שפירא': 'Shapira' };
const EN_DIFFS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const EN_STYLES = { steady: 'Steady', rush: 'Rusher', turtle: 'Turtle', flank: 'Flanker' };
const tn = type => lang === 'en' ? EN_TYPES[type] : Sim.TYPES[type].name;
const sn = kind => lang === 'en' ? EN_STRUCTS[kind] : Sim.STRUCTS[kind].name;
const bossName = b => lang === 'en' ? EN_NAMES[b] || b : b;
const diffName = d => lang === 'en' ? EN_DIFFS[d] : Sim.DIFFS[d].name;
const styleName = k => lang === 'en' ? EN_STYLES[k] : Sim.AI_STYLES[k].name;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const STR = {
  he: {
    title: 'פיקוד על כוונה', map: 'מפת הקרב', mini: 'מפה קטנה: לחץ כדי להסתכל שם',
    power: n => `העוצמה שלך מתוך כל הכוחות במפה. מתחת ל-${n}% — הפסד`, slots: 'מבנים: בנויים / מכסה. כל 🏕 מוסיף 2', boost: 'הצד החלש מייצר מהר יותר',
    hold: 'להחזיק', attack: 'לתקוף', retreat: 'לסגת',
    tipHold: 'להחזיק (H): ללכת למקום ולהגן עליו', tipAttack: 'לתקוף (A): לתפוס את האזור ולרדוף אחרי האויב', tipRetreat: 'לסגת (R): הביתה, להתרפא ולהתמלא',
    play: 'המשך (רווח)', fsName: 'מסך מלא', gear: 'הגדרות', fs: 'מסך מלא (F)', sqT: 'הכוחות', all: 'כל הכוחות יחד, במבנה (0)',
    eye: 'רחפן (D): לחץ ואז על מקום במפה', bld: 'בנייה (G)', fhq: 'פיקוד קדמי (B): לחץ ואז על מקום במפה',
    speed: 'מהירות', slow: 'איטי', normalRate: 'רגיל', fast: 'מהיר', music: 'מוזיקה', vol: 'עוצמת מוזיקה', radio: 'קשר', tipRadio: 'דיווחי קשר בקול',
    sfx: 'פיצוצים', sfxVol: 'עוצמת פיצוצים', language: 'שפה', help: '❔ הדרכה', tipHelp: 'סיור קצר בכפתורים',
    home: '🏠 שלבים', tipHome: 'חזרה למסך השלבים', restart: '↻ משחק חדש', tipRestart: 'להתחיל מחדש',
    fog: 'ערפל', on: 'פעיל', off: 'כבוי', mapSize: 'מפה', big: 'גדולה', small: 'קטנה', diff: 'קושי',
    tipFogOn: 'רואים רק מה שהכוחות רואים', tipFogOff: 'רואים הכל', tipBig: 'מפה גדולה, עם גלילה', tipSmall: 'כל המפה במסך',
    go: 'התחל', turn: 'סובב את הטלפון לרוחב', level: n => `שלב ${n}`, full: 'משחק מלא',
    again: 'שוב', share: 'שתף 🔗', copied: 'הועתק ✓', levels: '🏠 שלבים',
    replay: 'שחזור: מה ידעת מול מה קרה', replayT: 'זמן בשחזור', replayKey: '● מה קרה באמת · ○ מה ידעת',
    endStats: (err, n, d, off, a, m, ff) => `טעות בתמונה: ${err} · פקודות: ${n}, בדרך ${d} ש׳, סטייה ${off} · שיחות: ענית ${a}, החליטו לבד ${m} · ⚠ ירי על כוחותינו: ${ff}`,
    shareText: (won, time, d) => `${won ? 'ניצחתי' : 'הפסדתי'} אחרי ${time} ברמה ${d} ב"פיקוד על כוונה". נסה לנצח:`,
    call: (boss, name) => `📞 סרן ${boss} (${name}): לחץ כבד. להחזיק או לסגת?`,
    sqTip: (name, boss, home) => `${name} · סרן ${boss}${home ? '' : ' · בלי מבנה, בלי תגבורת'}`,
    buildItem: (sec, unit) => `${sec} ש׳ · ${unit}`,
    why: { q: 'השליטה כאן חלשה מדי לבנייה', limit: 'המכסה מלאה — הקם 🏕 פיקוד קדמי', gap: 'קרוב מדי למבנה אחר', bad: 'מחוץ למפה' },
    noVoice: 'אין קול עברי במכשיר, רק צליל קשר',
    b_tent: 'חי"ר: זול, מחזיק שטח', b_aapost: 'נ"מ: היחיד שפוגע במטוסים ורחפנים', b_jeepshop: "ג'יפים: מהירים ורואים רחוק; חזקים מול חי\"ר",
    b_tankshop: 'טנקים: חזקים מול חי"ר, נ"מ וג\'יפים', b_airfield: 'מטוסים: חזקים מול טנקים וג\'יפים; רק נ"מ פוגע בהם',
    b_clinic: 'חובשים: מרפאים חי"ר ונ"מ', b_garage: "מכונאים: מתקנים ג'יפים וטנקים", b_depot: 'משאיות אספקה: ממלאות תחמושת',
    next: 'הבא', done: 'יאללה!', skip: 'דלג',
    t_you: 'זה הכוח שלך (כחול). האויב — באדום.',
    t_power: n => `העוצמה שלך מכל הכוחות במפה. מי שיורד מתחת ל-${n}% — מפסיד. המטרה: לשבור את האויב.`,
    t_click: TOUCH ? 'לחיצה על המפה: הכוח הולך לשם ותוקף.' : 'קליק שמאלי על המפה: הכוח הולך לשם ותוקף.',
    t_play: 'ההגדרות: פתיחה עוצרת את המשחק, סגירה ממשיכה. גם רווח עוצר.',
    t_squads: 'סוגי הכוחות שלך: לחיצה (או המספר) בוחרת את כל הכוחות מהסוג. ★ = כולם יחד, במבנה.' + (TOUCH ? '' : ' קליק ימני: אף אחד; קליק ימני שני: כולם.'),
    t_hold: 'להחזיק: ללכת למקום ולהגן עליו.', t_attack: 'לתקוף: לתפוס את האזור ולרדוף אחרי האויב שם.', t_retreat: 'לסגת: הביתה, להתרפא ולהתמלא.',
    t_build: 'בנייה: בחר מבנה ואז מקום ירוק במפה. כל מבנה מקים כוח וממלא אותו.', t_slots: 'כמה מבנים יש לך מתוך המכסה.',
    t_vehicles: "חדש: 🔧 ג'יפים (מהירים) ו-🏭 טנקים (חזקים).",
    t_care: 'חדש: 🏥 חובשים, 🛠 מכונאים ו-📦 משאיות אספקה. פצועים ומי שנגמרה לו התחמושת הולכים אליהם לבד.',
    t_air: 'חדש: 🛫 מטוסים (חזקים מול רכבים) ו-🎯 נ"מ — רק הוא פוגע במטוסים.',
    t_fog: soon => `${soon ? 'עוד רגע יורד ערפל: ' : 'ערפל: '}רואים רק מה שהכוחות שלך רואים. כתם אדום = איפה שהאויב נראה לאחרונה.`,
    t_eye: 'רחפן: לחץ ואז על מקום במפה. רואה סביבו עד שנ"מ מפיל אותו. אחד חדש כל דקה.',
    t_c2: 'הכחול = שליטה. רחוק מהמפקדה פקודות מגיעות באיחור ומבוצעות "בערך", ואת הכוחות שלך רואים רק בערך.',
    t_fhq: "פיקוד קדמי: לחץ ואז על מקום. ג'יפים או טנקים נוסעים ומקימים: עוד שליטה, עוד 2 מבנים, עוד שטח לבנייה.",
    t_face: TOUCH ? 'לחיצה ארוכה וגרירה = פקודה עם כיוון החזית.' : 'גרירה בכפתור הימני = פקודה עם כיוון החזית.',
  },
  en: {
    title: 'Command by Intent', map: 'Battle map', mini: 'Minimap: tap to look there',
    power: n => `Your share of all the power on the map. Below ${n}% you lose`, slots: 'Buildings: built / limit. Each 🏕 adds 2', boost: 'The weaker side builds faster',
    hold: 'Hold', attack: 'Attack', retreat: 'Retreat',
    tipHold: 'Hold (H): go there and defend it', tipAttack: 'Attack (A): take the area, chase the enemy', tipRetreat: 'Retreat (R): home, to heal and refill',
    play: 'Go on (Space)', fsName: 'Full screen', gear: 'Settings', fs: 'Full screen (F)', sqT: 'Forces', all: 'All forces together, in formation (0)',
    eye: 'Drone (D): press, then a spot on the map', bld: 'Build (G)', fhq: 'Forward HQ (B): press, then a spot on the map',
    speed: 'Speed', slow: 'Slow', normalRate: 'Normal', fast: 'Fast', music: 'Music', vol: 'Music volume', radio: 'Radio', tipRadio: 'Radio reports read aloud',
    sfx: 'Explosions', sfxVol: 'Explosion volume', language: 'Language', help: '❔ Tour', tipHelp: 'A short tour of the controls',
    home: '🏠 Levels', tipHome: 'Back to the level screen', restart: '↻ New game', tipRestart: 'Start over',
    fog: 'Fog', on: 'On', off: 'Off', mapSize: 'Map', big: 'Big', small: 'Small', diff: 'Level',
    tipFogOn: 'You see only what your forces see', tipFogOff: 'You see everything', tipBig: 'A big map, scrolling', tipSmall: 'The whole map on screen',
    go: 'Start', turn: 'Turn the phone sideways', level: n => `Level ${n}`, full: 'Full game',
    again: 'Again', share: 'Share 🔗', copied: 'Copied ✓', levels: '🏠 Levels',
    replay: 'Replay: what you knew vs what happened', replayT: 'Replay time', replayKey: '● what happened · ○ what you knew',
    endStats: (err, n, d, off, a, m, ff) => `Picture off by: ${err} · orders: ${n}, ${d} s on the way, off by ${off} · calls: answered ${a}, decided alone ${m} · ⚠ friendly fire: ${ff}`,
    shareText: (won, time, d) => `I ${won ? 'won' : 'lost'} after ${time} on ${d} in "Command by Intent". Beat it:`,
    call: (boss, name) => `📞 Capt. ${boss} (${name}): heavy pressure. Hold or retreat?`,
    sqTip: (name, boss, home) => `${name} · Capt. ${boss}${home ? '' : ' · no building, no reinforcements'}`,
    buildItem: (sec, unit) => `${sec} s · ${unit}`,
    why: { q: 'Control here is too weak to build', limit: 'No free slot — set up a 🏕 forward HQ', gap: 'Too close to another building', bad: 'Off the map' },
    noVoice: 'No English voice on this device, only a radio sound',
    b_tent: 'Infantry: cheap, holds ground', b_aapost: 'Anti-air: the only one that hits aircraft and drones', b_jeepshop: 'Jeeps: fast, see far; strong vs infantry',
    b_tankshop: 'Tanks: strong vs infantry, AA and jeeps', b_airfield: 'Aircraft: strong vs tanks and jeeps; only AA hits them',
    b_clinic: 'Medics: heal infantry and AA', b_garage: 'Mechanics: repair jeeps and tanks', b_depot: 'Supply trucks: refill ammunition',
    next: 'Next', done: "Let's go!", skip: 'Skip',
    t_you: 'This is your force (blue). The enemy is red.',
    t_power: n => `Your share of all the power on the map. Whoever drops below ${n}% loses. The goal: break the enemy.`,
    t_click: TOUCH ? 'Tap the map: your force goes there and attacks.' : 'Left click on the map: your force goes there and attacks.',
    t_play: 'Settings: opening them pauses the game, closing goes on. Space pauses too.',
    t_squads: 'Your kinds of forces: a tap (or its number) picks all the squads of that kind. ★ = all together, in formation.' + (TOUCH ? '' : ' Right click: none; right click again: all.'),
    t_hold: 'Hold: go there and defend it.', t_attack: 'Attack: take the area and chase the enemy there.', t_retreat: 'Retreat: home, to heal and refill.',
    t_build: 'Build: pick a building, then a green spot on the map. Each building raises a force and keeps it filled.', t_slots: 'How many buildings you have, of your limit.',
    t_vehicles: 'New: 🔧 jeeps (fast) and 🏭 tanks (strong).',
    t_care: 'New: 🏥 medics, 🛠 mechanics and 📦 supply trucks. The wounded, and those out of ammunition, go to them on their own.',
    t_air: 'New: 🛫 aircraft (strong vs vehicles) and 🎯 anti-air — the only thing that hits them.',
    t_fog: soon => `${soon ? 'Fog is coming down: ' : 'Fog: '}you see only what your forces see. A red blob = where the enemy was last seen.`,
    t_eye: 'Drone: press, then a spot on the map. It sees around it until AA downs it. A new one every minute.',
    t_c2: 'The blue is your control. Far from HQ orders arrive late and are carried out roughly, and you only see roughly where your forces are.',
    t_fhq: 'Forward HQ: press, then a spot. Jeeps or tanks drive there and set it up: more control, 2 more buildings, more room to build.',
    t_face: TOUCH ? 'Press, hold and drag = an order with the way the front faces.' : 'Right-drag = an order with the way the front faces.',
  },
};
const tr = (k, ...a) => { const v = STR[lang][k] ?? STR.he[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
// every static word, from its key; the page turns right-to-left or left-to-right with the language
function applyLang() {
  const R = document.documentElement; R.lang = lang; R.dir = lang === 'he' ? 'rtl' : 'ltr'; document.title = tr('title');
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = tr(e.dataset.t);
  for (const e of document.querySelectorAll('[data-al]')) e.setAttribute('aria-label', tr(e.dataset.al));
  for (const e of document.querySelectorAll('[data-lang]')) e.setAttribute('aria-pressed', String(e.dataset.lang === lang));
}
function setLang(l) {
  lang = l; try { localStorage.setItem('irts-lang', l); } catch (e) { /* ignore */ }
  applyLang(); if (typeof onLang === 'function') onLang();
}
applyLang();

// ---- the tooltip: a short line over a control (mouse hover), a note at a spot (toast), or a step of the tour ----
const tipEl = $('tip');
let tipFor = null, tipTimer = 0, tipHide = 0;
// r: the target's screen rectangle (a point is a zero-size one); the bubble sits above it, or below near the top
function showTip(text, r, nav) {
  clearTimeout(tipHide);
  $('tipT').textContent = text; $('tipNav').hidden = !nav;
  if (nav) { $('tipN').textContent = nav.n; $('tipNext').textContent = nav.last ? tr('done') : tr('next') + ' ›'; $('tipSkip').textContent = tr('skip'); $('tipSkip').hidden = !!nav.last; }
  tipEl.hidden = false;
  const st = stage.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, cx = r.left + r.width / 2, below = r.top + r.height / 2 < st.height * 0.4;
  const x = Math.max(8, Math.min(st.width - w - 8, cx - w / 2)), y = below ? r.top + r.height + 12 : r.top - h - 12;
  tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, Math.min(st.height - h - 8, y)) + 'px';
  tipEl.classList.toggle('below', below); tipEl.style.setProperty('--ax', Math.max(12, Math.min(w - 12, cx - x)) + 'px');
}
const hideTip = () => { tipEl.hidden = true; tipFor = null; };
const rectOf = el => el.getBoundingClientRect();
// a short note at a spot on the screen (why a building can't go there, …)
function toast(text, x, y, ms = 2200) {
  if (tour) return;
  showTip(text, { left: x, top: y, width: 0, height: 0 }); tipFor = 'toast';
  tipHide = setTimeout(hideTip, ms);
}
// hover (mouse only): after a moment, the control's line
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || tour) return;
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el || el === tipFor) return;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { if (!el.isConnected || el.offsetParent === null) return; tipFor = el; showTip(typeof el.tipText === 'function' ? el.tipText() : tr(el.dataset.tip), rectOf(el)); }, 350);
});
document.addEventListener('pointerout', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
  clearTimeout(tipTimer); if (tipFor === el) hideTip();
});
document.addEventListener('pointerdown', () => { clearTimeout(tipTimer); if (tipFor && tipFor !== 'toast' && !tour) hideTip(); }, true);

// ---- the tour: the new things of a level, one after another, each with its line, before the fight starts ----
// a step: { el: an element id, or a function giving a screen point / rectangle; t: the text }. The game waits.
let tour = null;
function runTour(steps, then) {
  steps = steps.filter(st => { const r = stepRect(st); return r && (r.width || r.height || r.left || r.top); });
  if (!steps.length) { then && then(); return; }
  hideTip(); tour = { steps, i: 0, then }; $('tourBg').hidden = false; tourShow();
}
function stepRect(st) {
  if (typeof st.el === 'function') { const p = st.el(); return p && { left: p.x - (p.w || 0) / 2, top: p.y - (p.h || 0) / 2, width: p.w || 0, height: p.h || 0 }; }
  const el = $(st.el); return el && !el.hidden && el.offsetParent !== null ? rectOf(el) : null;
}
function tourShow() {
  document.querySelectorAll('.tourOn').forEach(e => e.classList.remove('tourOn'));
  const st = tour.steps[tour.i], el = typeof st.el === 'string' && $(st.el);
  if (el) el.classList.add('tourOn');
  showTip(st.t, stepRect(st), { n: `${tour.i + 1}/${tour.steps.length}`, last: tour.i === tour.steps.length - 1 });
  tour.dot = typeof st.el === 'function' ? st.el() : null;
}
function tourNext(skip) {
  if (!tour) return;
  if (!skip && ++tour.i < tour.steps.length) { tourShow(); return; }
  const then = tour.then; tour = null; $('tourBg').hidden = true; hideTip();
  document.querySelectorAll('.tourOn').forEach(e => e.classList.remove('tourOn'));
  then && then();
}
$('tipNext').addEventListener('click', () => tourNext());
$('tipSkip').addEventListener('click', () => tourNext(true));
$('tourBg').addEventListener('click', () => tourNext());
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
