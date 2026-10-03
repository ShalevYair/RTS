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
    // (clicked: a ring where it works — the depot, hospital and garage round them, the tower and the rest how far they see,
    // the bunker how near its soldiers stand, the antenna its control; no ring otherwise, the flag says who holds it)
    if (selPost === p) {
      const W = postReach(p), pz = 1 / view.css;
      c.save(); c.globalAlpha = 0.12; c.fillStyle = p.side ? col : '#ffffff'; ring(p.x, p.y, W); c.fill();
      c.globalAlpha = 0.85; c.lineWidth = 2 * pz; c.setLineDash([8 * pz, 6 * pz]); c.strokeStyle = p.side ? col : '#ffffff'; ring(p.x, p.y, W); c.stroke(); c.restore();
    }
    // (in the fog, where none of ours sees it: half see-through — it's drawn over the fog)
    const dim = s.fog && !postSeen(p); if (dim) { c.save(); c.globalAlpha = POST_FOG_A; }
    drawBuilding(c, p.kind, col, p.x, p.y, Math.round(R * 2.4));
    // (and a little flag in its colour)
    if (p.side) {
      const fx = p.x + R * 0.75, fy = p.y - R * 0.55;
      c.strokeStyle = '#3b3530'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 14); c.stroke();
      drawFlag(c, fx, fy + 5, 1.1, col);
    }
    if (dim) c.restore();
  }
}
let selPost = null;
// does any of ours see a post: ours, or a unit, building or drone of ours near enough (as the fog's holes, roughly)
const POST_FOG_A = 0.5;
function postSeen(p) {
  if (p.side === 'blue') return true;
  const sk = Sim.skySight(s, 'blue');
  for (const n of s.nodes) if (n.side === 'blue' && s.t >= n.ready && Math.hypot(n.x - p.x, n.y - p.y) < (n.kind === 'drone' ? Sim.DRONE_SIGHT : 170) * sk) return true;
  for (const u of s.units) if (u.side === 'blue' && Math.hypot(u.x - p.x, u.y - p.y) < Sim.TYPES[u.type].sight * sk + Sim.POSTS[p.kind].r) return true;
  return false;
}
// how far a post works from its middle (the ring when it's clicked)
function postReach(p) {
  const R = Sim.POSTS[p.kind].r;
  if (p.kind === 'supply' || p.kind === 'hospital' || p.kind === 'motorpool') return R + Sim.POST_R;
  if (p.kind === 'bunker') return R + Sim.BUNKER_R;
  if (p.kind === 'antenna') return Sim.NODES.antenna.r1;
  return p.kind === 'tower' ? Sim.TOWER_SIGHT : Sim.POST_SIGHT;
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
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
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
// a game starts (the full one, on the big maps): the microphone, if not allowed yet, asked for in a window of ours —
// "to give spoken orders, allow the microphone" — the game waiting; yes = the browser's own question, once, on that
// click; not now = not asked again (the main menu's 🎙 still can). Already allowed: taken quietly.
async function micGate() {
  if (!SR || !s || !s.extras || micAsk.ok) return;
  let st = ''; try { st = (await navigator.permissions.query({ name: 'microphone' })).state; } catch (e) { /* not in this browser */ }
  if (st === 'granted') { micAsk(true); return; }
  let no = false; try { no = localStorage.getItem('irts-mic') === 'no'; } catch (e) { /* storage unavailable */ }
  if (no || st === 'denied') return;
  const box = $('micSure'); box.hidden = false; setPlaying(false);
  const close = () => { box.hidden = true; $('micYes').onclick = $('micNo').onclick = null; if ($('intro').hidden && menu.hidden) setPlaying(true); };
  $('micYes').onclick = async () => { close(); await micAsk(false); };
  $('micNo').onclick = () => { try { localStorage.setItem('irts-mic', 'no'); } catch (e) { /* ignore */ } close(); };
}
// 🎙 over the bottom-left buttons (the full game on the big maps): a click opens the microphone and it stays open —
// every sentence said is an order — until another click (red while open). One recognition the whole time, started
// again by itself when the browser ends it: every start was the browser's question again (opened from a file it
// doesn't remember the answer at all — play.bat). Space is only the pause again.
const MIC_ENDS = 6; // (ended this many times within 20 s: something's wrong — closed)
function syncMic() {
  const b = $('mic'); if (!b) return;
  b.hidden = !SR || !s || !s.extras;
  b.setAttribute('aria-pressed', String(!!talk));
}
async function micClick() {
  if (talk) { micOff(); return; }
  if (!SR) { talkSay(tr('vNoSR'), false); return; }
  if (!micAsk.ok && !(await micAsk(true))) { talkSay(tr('vNoMic'), false); return; }
  if (location.protocol === 'file:' && !micClick.told) { micClick.told = true; toast(tr('micFile'), innerWidth / 2, innerHeight - 160, 8000); }
  talk = { ends: [] }; syncMic(); talkShow('🎙 ' + tr('vListen')); micStart(talk);
}
function micOff() {
  const t = talk; talk = null;
  if (t) { t.off = true; try { t.rec && t.rec.abort(); } catch (e) { /* ignore */ } }
  talkShow(''); syncMic();
}
function micStart(t) {
  let r; try { r = new SR(); } catch (e) { micOff(); talkSay(tr('vNoMic'), false); return; }
  t.rec = r; r.lang = lang === 'en' ? 'en-US' : 'he-IL'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 4;
  let from = 0; // (the results already acted on)
  r.onresult = e => {
    if (t.off) return;
    let live = '';
    for (let i = from; i < e.results.length; i++) {
      const R = e.results[i];
      if (R.isFinal) { from = i + 1; talkDone([...R].map(x => x.transcript)); } else live += R[0].transcript;
    }
    if (live) { clearTimeout(talkSay.t); talkShow('🎙 ' + live); }
  };
  r.onerror = e => {
    if (t.off) return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { micOff(); talkSay(tr('vNoMic'), false); }
    else if (e.error === 'network') { micOff(); talkSay(tr('vNet'), false); }
  };
  r.onend = () => {
    if (t.off || talk !== t) return;
    const now = performance.now(); t.ends = t.ends.filter(x => now - x < 20000); t.ends.push(now);
    if (t.ends.length > MIC_ENDS) { micOff(); return; }
    micStart(t); // (the browser ended it — silence, a time limit: on listening)
  };
  try { r.start(); } catch (e) { micOff(); talkSay(tr('vNoMic'), false); }
}
function talkSay(txt, voice = true) { talkShow(txt); clearTimeout(talkSay.t); talkSay.t = setTimeout(() => talkShow(''), 2600); if (voice) Radio.say(txt); }
// a sentence heard (its alternatives): the order, else what was wrong — written only, not said (said, the
// microphone would hear it and answer it)
function talkDone(alts) {
  alts = alts.map(x => x.trim()).filter(Boolean);
  if (!alts.length) return;
  let last = null;
  for (const txt of alts) { const r = parseOrder(txt); if (r.ok) { runOrder(r, txt); return; } last = last || r; }
  talkSay('🎙 ' + alts[0] + ' — ' + (last.why || tr('vAgain')), false);
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
  const list = ids === 'all' ? s.squads.filter(q => q.side === 'blue' && !q.dead && inAll(q)) : ids.map(id => s.squads.find(q => q.id === id)).filter(Boolean);
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
const capIds = () => (sel === 'all' ? s.squads.filter(q => q.side === 'blue' && !q.dead && inAll(q)).map(q => q.id) : selIds());
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
