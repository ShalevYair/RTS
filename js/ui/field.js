// UI: the battlefield's extras (the full game on the big maps) — the posts on the map (their picture in the holder's
// colour, a ring round them, their line under the mouse), the weather (rain over the screen, the morning fog lying on
// the plain), saved views (Alt + a number saves where the camera looks, Shift + the number goes back there) and spoken
// orders (hold Space and speak: "tanks to the radar", "group 2 to point 4"; a short tap on Space still pauses).

// ---- posts ----
const NEUTRAL = '#9aa1a8';
const postCol = p => p.side ? colors[p.side] : NEUTRAL;
const pn = kind => lang === 'en' ? EN_POSTS[kind] : Sim.POSTS[kind].name;
const hitPost = (x, y) => (s.posts || []).find(p => Math.hypot(p.x - x, p.y - y) < tapR(Sim.POSTS[p.kind].r + 6)) || null;
function drawPosts(c) {
  if (!s.posts) return;
  const vr = viewRect();
  for (const p of s.posts) {
    const R = Sim.POSTS[p.kind].r, col = postCol(p);
    if (vr && (p.x + 3 * R < vr.x || p.x - 3 * R > vr.x + vr.w || p.y + 3 * R < vr.y || p.y - 3 * R > vr.y + vr.h)) continue;
    // (a ring on the ground in the holder's colour; no one's: light and dashed)
    c.save(); c.lineWidth = 2.5; c.globalAlpha = p.side ? 0.8 : 0.6; c.strokeStyle = col; if (!p.side) c.setLineDash([5, 5]);
    ring(p.x, p.y, R + 7); c.stroke(); c.restore();
    drawBuilding(c, p.kind, col, p.x, p.y, Math.round(R * 2.4));
    // (and a little flag in its colour)
    if (p.side) {
      const fx = p.x + R * 0.75, fy = p.y - R * 0.55;
      c.strokeStyle = '#3b3530'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 14); c.stroke();
      drawFlag(c, fx, fy + 5, 1.1, col);
    }
  }
}
// its line: name, who holds it, what it gives, how it's taken
function postInfo(p) {
  const who = tr(p.side === 'blue' ? 'pi_ours' : p.side === 'red' ? 'pi_theirs' : 'pi_free');
  return [pn(p.kind), who, tr('fx_' + p.kind), p.side === 'blue' ? '' : tr('pi_take')].filter(Boolean).join(' · ');
}

// ---- the weather ----
const RAIN_N = 260, rainDrops = Array.from({ length: RAIN_N }, () => ({ x: Math.random(), y: Math.random(), l: 0.6 + Math.random() * 0.8, v: 0.75 + Math.random() * 0.5 }));
const fogMask = { of: null, cv: document.createElement('canvas') };
let wxWas = { rain: false, fog: false };
function drawWeather(c) {
  if (!s.extras) return;
  const w = Sim.weatherAt(s);
  if (w.fog > 0.01) drawLowFog(c, w.fog);
  if (w.rain > 0.01) drawRain(w.rain);
  // (a word when it starts)
  const r = w.rain > 0.5, f = w.fog > 0.5;
  if (playing && r && !wxWas.rain) toast(tr('wx_rain'), innerWidth / 2, 110, 3500);
  if (playing && f && !wxWas.fog) toast(tr('wx_fog'), innerWidth / 2, 110, 3500);
  wxWas = { rain: r, fog: f };
}
// the morning fog: white over the plain, thinning up the hills' sides (a picture of the height grid, made once a map)
function drawLowFog(c, k) {
  const E = s.elev; if (!E) return;
  if (fogMask.of !== s) {
    fogMask.of = s; const m = fogMask.cv; m.width = E.w; m.height = E.h;
    const g = m.getContext('2d'), img = g.createImageData(E.w, E.h), d = img.data;
    for (let i = 0; i < E.w * E.h; i++) { d[i * 4] = 232; d[i * 4 + 1] = 236; d[i * 4 + 2] = 240; d[i * 4 + 3] = Math.round(255 * clamp((1.3 - E.g[i]) / 0.9, 0, 1)); }
    g.putImageData(img, 0, 0);
  }
  const drift = reduceMotion ? 0 : Math.sin(performance.now() / 7000) * 14;
  c.save(); c.imageSmoothingEnabled = true; c.globalAlpha = 0.5 * k;
  c.drawImage(fogMask.cv, -ELEV / 2 + drift, -ELEV / 2, E.w * ELEV, E.h * ELEV);
  c.globalAlpha = 0.25 * k; c.drawImage(fogMask.cv, -ELEV / 2 - drift * 1.6, -ELEV / 2 + drift * 0.5, E.w * ELEV, E.h * ELEV);
  c.restore();
}
// rain: the light greyer, and streaks falling across the screen
function drawRain(k) {
  const c = ctx, W = cv.width, H = cv.height; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgba(40,52,70,${(0.16 * k).toFixed(3)})`; c.fillRect(0, 0, W, H);
  if (!reduceMotion) {
    const t = performance.now() / 1000; c.strokeStyle = `rgba(205,218,235,${(0.5 * k).toFixed(3)})`; c.lineWidth = 1.2; c.beginPath();
    for (const d of rainDrops) { const y = ((d.y + t * d.v * 1.2) % 1) * (H + 40) - 20, x = ((d.x + t * 0.1) % 1) * W, L = 16 * d.l; c.moveTo(x, y); c.lineTo(x - L * 0.22, y + L); }
    c.stroke();
  }
  c.restore();
}

// ---- saved views: Alt + a number keeps where the camera looks; Shift + it goes back; "point N" in a spoken order ----
let views = {};
function saveView(n) { const v = viewRect(); views[n] = { x: v ? v.x + v.w / 2 : cam.x, y: v ? v.y + v.h / 2 : cam.y, z: Math.max(1, cam.z) }; toast(tr('ptSaved', n), innerWidth / 2, 90, 1500); }
function goView(n) {
  const v = views[n]; if (!v) { toast(tr('ptNone', n), innerWidth / 2, 90, 1500); return; }
  cam.x = v.x; cam.y = v.y; cam.z = v.z; applyView();
}
// (on the minimap: each view's number where it looks)
function drawViews(c, k) {
  c.save(); c.font = `700 ${Math.round(26 / k * (360 / MINI_W))}px Rubik, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6 / k;
  for (const n in views) { const v = views[n]; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(n, v.x, v.y); c.fillStyle = '#ffe9a8'; c.fillText(n, v.x, v.y); }
  c.restore();
}

// ---- spoken orders: hold Space and say who and where ----
// who: "group 3" / "כוח 3" (Ctrl + 3, or the 3rd button), a kind ("tanks", "טנקים"), "everyone" / "כולם", else what's
// picked; where: "point 4" / "נקודה 4" (a saved view), the radar, the power or fuel station, the HQ, the front, the
// nearest post of a kind ("the bunker"), "there" / "לשם" (where the mouse is); and maybe how: hold / retreat (else
// attack). Through the same orders as a click: late and rough far from HQ.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition, TALK_TAP = 300;
let talk = null;
const talkEl = (() => { const e = document.createElement('div'); e.id = 'talk'; e.hidden = true; e.setAttribute('aria-live', 'polite'); document.body.appendChild(e); return e; })();
function talkShow(txt) { talkEl.textContent = txt; talkEl.hidden = !txt; }
// the microphone, asked for once by a click (the main menu's 🎙, or the start of a game once it was allowed): the
// browser's question came up at the first Space held, the window lost focus to it, and the listening was dropped —
// every time. Opened from the disk (file://) the browser doesn't remember the answer: the stream is kept open for the
// visit, so it isn't asked again; over http it is remembered, and the stream is let go.
let micStream = null;
const micWanted = () => { try { return localStorage.getItem('irts-mic') === '1'; } catch (e) { return false; } };
async function micAsk(quiet) {
  if (!SR) { if (!quiet) talkSay(tr('vNoSR'), false); return false; }
  if (micAsk.ok) { if (!quiet) talkSay(tr('micOk'), false); return true; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { micAsk.ok = true; return true; } // (the recognition asks itself)
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (location.protocol === 'file:') micStream = st; else st.getTracks().forEach(k => k.stop());
    micAsk.ok = true; try { localStorage.setItem('irts-mic', '1'); } catch (e) { /* storage unavailable */ }
    if (!quiet) talkSay(tr('micOk') + (location.protocol === 'file:' ? ' ' + tr('micFile') : ''), false);
    syncMic(); return true;
  } catch (e) { if (!quiet) talkSay(tr('vNoMic'), false); return false; }
}
// 🎙 over the bottom-left buttons (the full game on the big maps): a click listens to the end of what's said, another
// click stops; red while listening
let talkEnd = null; // (an order being finished after the key / the click: its words still coming)
function syncMic() {
  const b = $('mic'); if (!b) return;
  b.hidden = !SR || !s || !s.extras;
  b.setAttribute('aria-pressed', String(!!(talk && talk.click)));
}
async function micClick() {
  if (talk && talk.click) { talkUp(); return; }
  if (talk) return;
  if (!micAsk.ok && !(await micAsk(true))) { talkSay(tr('vNoMic')); return; }
  talkDown(true); syncMic();
}
// Space down (or 🎙 clicked: click): start listening at once (so the first word isn't lost); a short tap of the key
// turns out to be a pause
function talkDown(click) {
  if (talk) return;
  talk = { at: performance.now(), said: [], up: false, err: null, rec: null, click: !!click };
  const t = talk;
  if (click) talkShow('🎙 ' + tr('vListen')); else setTimeout(() => { if (talk === t && !t.up) talkShow('🎙 ' + tr('vListen')); }, TALK_TAP);
  if (!SR) return;
  try {
    // (a click: the browser ends it when the speaking stops; the key: until it's let go)
    const r = new SR(); t.rec = r; r.lang = lang === 'en' ? 'en-US' : 'he-IL'; r.interimResults = true; r.continuous = !click; r.maxAlternatives = 4;
    r.onresult = e => {
      const fin = [], now = [];
      for (let i = 0; i < e.results.length; i++) { const R = e.results[i]; now.push(R[0].transcript); if (R.isFinal) fin.push([...R].map(a => a.transcript)); }
      t.said = fin; t.live = now.join(' ');
      if (t.click || performance.now() - t.at > TALK_TAP) talkShow('🎙 ' + t.live);
      if (t.auto && fin.length) { try { r.stop(); } catch (x) { /* ignore */ } } // (the key was lost: the first whole sentence)
    };
    r.onerror = e => { t.err = e.error; };
    r.onend = () => { t.ended = true; if (t.click && talk === t) { talk = null; t.up = true; } if (t.up) talkDone(t); };
    r.start();
  } catch (e) { t.rec = null; if (click) { talk = null; talkSay(tr('vNoMic')); syncMic(); } }
}
// Space up (or 🎙 clicked again): a tap = pause / go on; held = the order, once the words are in
function talkUp() {
  const t = talk; if (!t) return; talk = null; t.up = true; talkEnd = t; syncMic();
  if (!t.click && performance.now() - t.at < TALK_TAP) { try { t.rec && t.rec.abort(); } catch (e) { /* ignore */ } talkShow(''); setPlaying(!playing); return; }
  if (!SR) { talkShow(''); talkSay(tr('vNoSR')); return; }
  if (!t.rec || t.ended) { talkDone(t); return; }
  try { t.rec.stop(); } catch (e) { talkDone(t); }
  setTimeout(() => { if (!t.done) talkDone(t); }, 2500); // (no answer from the service: give up)
}
// the window lost the focus while the key was held (the browser asking about the microphone, another window): the
// key's release won't come — it listens on to the end of the first sentence (at most TALK_LOST ms), not dropped
const TALK_LOST = 8000;
function talkBlur() {
  const t = talk; if (!t || t.click) return;
  talk = null; t.up = true; t.auto = true; talkEnd = t;
  if (!t.rec || t.ended) { talkDone(t); return; }
  setTimeout(() => { if (!t.done) { try { t.rec.stop(); } catch (e) { talkDone(t); } setTimeout(() => { if (!t.done) talkDone(t); }, 2500); } }, TALK_LOST);
}
function talkSay(txt, voice = true) { talkShow(txt); clearTimeout(talkSay.t); talkSay.t = setTimeout(() => talkShow(''), 2600); if (voice) Radio.say(txt); }
function talkDone(t) {
  if (t.done) return; t.done = true; syncMic();
  if (t.err === 'not-allowed' || t.err === 'service-not-allowed') { talkSay(tr('vNoMic')); return; }
  if (t.err === 'network') { talkSay(tr('vNet')); return; }
  // every way it may have been heard: the finals' alternatives (else what was heard so far)
  const alts = t.said.length ? t.said.reduce((acc, a) => acc.flatMap(x => a.slice(0, 2).map(y => (x + ' ' + y).trim())), ['']) : t.live ? [t.live] : [];
  if (!alts.length) { talkSay(tr('vAgain')); return; }
  let last = null;
  for (const txt of alts) { const r = parseOrder(txt); if (r.ok) { runOrder(r, txt); return; } last = last || r; }
  talkSay(last.why || tr('vAgain'));
}
// words → digits
const NUMW = { 'אפס': 0, 'אחת': 1, 'אחד': 1, 'שתיים': 2, 'שתים': 2, 'שניים': 2, 'שני': 2, 'שתי': 2, 'שלוש': 3, 'שלש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7, 'שמונה': 8, 'תשע': 9, 'תשעה': 9,
  zero: 0, one: 1, won: 1, two: 2, too: 2, to: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const numOf = w => w == null ? null : /^\d$/.test(w) ? +w : w in NUMW ? NUMW[w] : null;
const FOOTS = ['inf', 'at', 'aa', 'commando'];
// what kinds a word names (Hebrew without its geresh and quotes; English)
const KIND_WORDS = [
  [/טנק|tank/, ['tank']], [/גיפ|jeep/, ['jeep', 'ajeep', 'tjeep']], [/מטוס|plane|aircraft|jet/, ['air']], [/מסוק|heli|chopper|gunship/, ['heli', 'gunship', 'lift']],
  [/חיילים|חייל|רגלים|חיר|soldier|infantry|troop|rifle/, FOOTS], [/ נט |נגד טנקים|anti.?tank/, ['at']], [/ נמ |נגד מטוסים|anti.?air/, ['aa']], [/קומנדו|commando/, ['commando']],
  [/טרקטור|dozer/, ['dozer']], [/משאי\S* קשר|signal|radio truck/, ['radio']], [/חובש|medic/, ['med']], [/מכונא|mechanic/, ['mech']], [/משאי\S* אספקה|supply truck/, ['truck']], [/טילים|missile/, ['ssm']],
];
const POST_WORDS = [[/רדאר|ראדר|radar/, 'radar'], [/תחנת כוח|תחנת הכוח|power/, 'power'], [/דלק|fuel|gas/, 'fuel'], [/בית חולים|בית החולים|hospital/, 'hospital'], [/מוסך|garage|motor ?pool/, 'motorpool'],
  [/מחסן|depot|supplies/, 'supply'], [/מגדל|tower/, 'tower'], [/אנטנ|antenna/, 'antenna'], [/בונקר|bunker/, 'bunker']];
function parseOrder(raw) {
  const t = ' ' + raw.toLowerCase().replace(/["'׳״`.,!?]/g, '').replace(/\s+/g, ' ') + ' ';
  // who
  let ids = null, whoTxt = '';
  const g = t.match(/(?:כוח|קבוצה|group|squad|force|team)\s*(\S+)/);
  const gn = g && numOf(g[1]);
  if (g && gn !== null) {
    if (gn === 0) ids = 'all';
    else { const gr = groups.find(x => x.key === gn); const kb = !gr && document.querySelector(`#sqs kbd[data-k="${gn}"]`); ids = gr ? gr.ids.slice() : kb ? btnIds(kb.parentElement) : []; }
    whoTxt = tr('vGroup', gn);
    if (ids !== 'all' && !ids.length) return { why: tr('vNoGroup', gn) };
  } else if (/כולם|כל הכוחות|\ball\b|everyone|everybody/.test(t)) { ids = 'all'; whoTxt = tr('vAll'); }
  else {
    const types = new Set(); for (const [re, l] of KIND_WORDS) if (re.test(t)) l.forEach(k => types.add(k));
    // ("missile trucks" / "signals trucks": not the plain trucks as well)
    if (types.has('ssm') || types.has('radio')) types.delete('truck');
    if (types.size) {
      ids = s.squads.filter(q => q.side === 'blue' && !q.dead && types.has(q.type)).map(q => q.id);
      whoTxt = [...types].filter(k => s.squads.some(q => q.side === 'blue' && !q.dead && q.type === k)).map(tn).join(', ') || tn([...types][0]);
      if (!ids.length) return { why: tr('vNone', tn([...types][0])) };
    }
  }
  if (ids === null) { const l = selIds(); if (!l.length) return { why: tr('vWho') }; ids = sel === 'all' ? 'all' : l.slice(); whoTxt = tr('vPicked'); }
  // how
  const type = /לסגת|סגו|תסגו|נסיגה|retreat|fall back|pull back/.test(t) ? 'retreat' : /להחזיק|החזיקו|החזק|תחזיקו|להגן|הגנו|hold|defend|guard/.test(t) ? 'hold' : 'attack';
  // where
  const list = ids === 'all' ? s.squads.filter(q => q.side === 'blue' && !q.dead && q.type !== 'dozer') : ids.map(id => s.squads.find(q => q.id === id)).filter(Boolean);
  const mid = list.length ? { x: list.reduce((a, q) => a + q.cx, 0) / list.length, y: list.reduce((a, q) => a + q.cy, 0) / list.length } : { x: cam.x, y: cam.y };
  let at = null, whereTxt = '';
  const pt = t.match(/(?:נקודה|point)\s*(\S+)/), pnum = pt && numOf(pt[1]);
  if (pt && pnum !== null) { const v = views[pnum]; if (!v) return { why: tr('ptNone', pnum) }; at = { x: v.x, y: v.y }; whereTxt = tr('vPoint', pnum); }
  if (!at) for (const [re, kind] of POST_WORDS) if (re.test(t) && s.posts) {
    const l = s.posts.filter(p => p.kind === kind); if (!l.length) continue;
    at = l.reduce((a, p) => dist2(p, mid) < dist2(a, mid) ? p : a); whereTxt = pn(kind); break;
  }
  if (!at && /מפקדה|בסיס|הביתה|headquarters|\bhq\b|\bbase\b|\bhome\b/.test(t)) { const h = s.nodes.find(n => n.side === 'blue' && n.kind === 'hq' && n.hp > 0); if (h) { at = h; whereTxt = sn('hq'); } }
  if (!at && /חזית|front/.test(t)) { const f = s.front && s.front.blue; if (!f) return { why: tr('vNoFront') }; at = f; whereTxt = tr('front'); }
  if (!at && / (לשם|לכאן|כאן|שם|הנה) | there | here /.test(t)) { const m = lastMouse ? toWorld(lastMouse) : { x: cam.x, y: cam.y }; at = m; whereTxt = tr('vThere'); }
  if (!at && type !== 'retreat') return { why: tr('vWhere') };
  return { ok: true, ids, type, at, txt: `${whoTxt} → ${type === 'retreat' && !at ? tr('retreat') : whereTxt}${type === 'hold' ? ' · ' + tr('hold') : ''}` };
}
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
// soldiers picked and a post that isn't ours: as many as it takes (one; two if the enemy holds it), the nearest, go into
// it, the rest to it as ordered — the arrows closing on it yellow. false: not that (no post, ours, no soldiers)
const capIds = () => (sel === 'all' ? s.squads.filter(q => q.side === 'blue' && !q.dead && q.type !== 'dozer').map(q => q.id) : selIds());
const canTake = pt => !!pt && pt.side !== 'blue' && capIds().some(id => { const q = s.squads.find(k => k.id === id); return q && !q.dead && Sim.CAPTURERS.includes(q.type); });
function sendCapture(pt, type = 'attack') {
  if (!canTake(pt)) return false;
  const ids = capIds(), d = q => Math.hypot(q.cx - pt.x, q.cy - pt.y);
  const go = ids.map(id => s.squads.find(q => q.id === id)).filter(q => q && !q.dead && Sim.CAPTURERS.includes(q.type)).sort((a, b) => d(a) - d(b)).slice(0, pt.side ? 2 : 1).map(q => q.id);
  for (const id of go) { Sim.order(s, id, 'attack', pt.x, pt.y, true); orderSay[id] = 'go'; }
  const rest = ids.filter(id => !go.includes(id)), keep = sel;
  if (rest.length) { sel = rest.length === 1 ? rest[0] : rest; issue(type, pt.x, pt.y, undefined, false, true); sel = keep; }
  else { pings.push({ x: pt.x, y: pt.y, t: performance.now(), cap: true }); if (!Sim.friction(s)) Radio.hear({ kind: 'go', id: go[0] }); }
  return true;
}
function runOrder(r) {
  sel = r.ids === 'all' ? 'all' : r.ids.length === 1 ? r.ids[0] : r.ids.slice(); selNode = null; syncButtons();
  if (r.type === 'retreat') issue('retreat'); else if (!(r.at.kind && Sim.POSTS[r.at.kind] && sendCapture(r.at, r.type))) issue(r.type, r.at.x, r.at.y);
  talkSay('🎙 ' + r.txt, false);
}
