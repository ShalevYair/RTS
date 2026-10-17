// Sim: posts — neutral buildings on the map (the full game on the big maps), taken by soldiers. See POSTS (config).
// A soldier who walks into a post that isn't his side's goes in for good: a post of no side becomes his, the enemy's
// becomes no one's (a second one takes it). A commando takes it whole and walks out again. Posts don't count in power
// and can't be destroyed; nothing drives through them.

// the full game's extras on this map: the posts, the ground (woods, mud, cliffs: terrain.js), the weather (and the fast roads and ambushes: s.extras)
function extras(s) {
  s.extras = true; makePosts(s); makeGround(s); weatherPlan(s);
  return s;
}
// where they go: the one-of-a-kind ones (radar, power, fuel) on the centre line — the radar near the middle; the rest
// in pairs, one on our half and its twin on the enemy's (the observation towers on high ground). Not in a lake, not
// by the bases, POST_GAP apart.
function makePosts(s) {
  const r = rng(s.seed ^ 0x1b873593), W = s.W, H = s.H, col = s.scale >= 4 ? 1 : 0, out = [];
  const ok = (p, R, g = 1) => p.x > R + 30 && p.x < W - R - 30 && p.y > R + 30 && p.y < H - R - 30 && !lakeAt(s, p, R + LAKE_PAD + 10) && out.every(o => dist(o, p) > POST_GAP * g + POSTS[o.kind].r + R);
  const twin = p => ({ x: W - p.x, y: s.turn ? H - p.y : p.y });
  const add = (kind, p) => out.push({ id: 'p' + out.length, kind, x: Math.round(p.x), y: Math.round(p.y), side: null });
  for (const kind of Object.keys(POSTS)) {
    const P = POSTS[kind], n = P.n[col] * (s.scale >= 8 && P.n[col] > 1 ? 2 : 1), R = P.r; // (the 8× map: twice the huge one's pairs)
    if (n === 1) {
      // (the centre line fills up — radar, power, fuel, the lab: past 300 tries, a little closer to the others)
      for (let i = 0; i < 600; i++) {
        const mid = kind === 'radar' && i < 150, p = { x: W / 2 + (r() - 0.5) * 30, y: H * (mid ? 0.35 + r() * 0.3 : 0.1 + r() * 0.8) };
        if (ok(p, R, i < 300 ? 1 : 0.5)) { add(kind, p); break; }
      }
      continue;
    }
    for (let k = 0; k < n / 2; k++) {
      let best = null, bh = -1;
      for (let i = 0; i < (P.hill ? 60 : 300); i++) {
        const p = { x: W * (0.24 + r() * 0.2), y: H * (0.08 + r() * 0.84) }, q = twin(p);
        if (!ok(p, R) || !ok(q, R) || dist(p, q) < POST_GAP + 2 * R) continue;
        const h = P.hill ? Math.min(elevAt(s, p), elevAt(s, q)) : 0;
        if (h > bh) { bh = h; best = [p, q]; if (!P.hill) break; }
      }
      if (best) { add(kind, best[0]); add(kind, best[1]); }
    }
  }
  s.posts = out; s.postsV = 0; countPosts(s);
}
// how many of each kind a side holds (s.held), and the soldiers sheltered by bunkers (s.bunkered)
function countPosts(s) {
  s.held = { blue: {}, red: {} };
  for (const p of s.posts) if (p.side) s.held[p.side][p.kind] = (s.held[p.side][p.kind] || 0) + 1;
  s.bunkered = new Set();
  for (const p of s.posts) {
    if (p.kind !== 'bunker' || !p.side) continue;
    const R = POSTS.bunker.r + BUNKER_R;
    around(s, p.x, p.y, R + MAX_R).filter(u => u.side === p.side && FOOT.includes(u.type) && dist(u, p) <= R + TYPES[u.type].r)
      .sort((a, b) => (b.bunk === p.id) - (a.bunk === p.id) || dist(a, p) - dist(b, p)).slice(0, BUNKER_MAX).forEach(u => s.bunkered.add(u.id)); // (its garrison first)
  }
}
// ---- a bunker's garrison: up to BUNKER_MAX soldiers of its side (q.bunker = its id) stand at its walls (bunkerSlot) and
// fire from it — they take BUNKER_K of the damage (s.bunkered), need no food (fuel.js), and the bunker sees round it
// like a signals truck (intel.js). They never leave on their own (not to a front, not to take a post, not summoned,
// not the AI, not under fire): only an order by hand takes them out (step.js). Soldiers go in when sent to it
// (garrison — the player clicking our bunker with them picked), and the one who takes a bunker stays in it. ----
const BUNKER_IN = ['inf', 'at', 'aa', 'med'];
const bunkerSquads = (s, p) => s.squads.filter(q => q.bunker === p.id && !q.dead);
const bunkerMen = (s, p) => { const ids = new Set(bunkerSquads(s, p).map(q => q.id)); return s.units.filter(u => ids.has(u.squad)); };
// the k-th place at its walls: round it, the first ones toward the enemy
function bunkerSlot(s, p, k) {
  const foe = s.bases[p.side === 'blue' ? 'red' : 'blue'] || { x: s.W / 2, y: s.H / 2 }, a0 = Math.atan2(foe.y - p.y, foe.x - p.x);
  const a = a0 + [0, 0.9, -0.9, Math.PI][k % 4], R = POSTS.bunker.r + 6;
  return { x: Math.round(p.x + Math.cos(a) * R), y: Math.round(p.y + Math.sin(a) * R) };
}
function bunkerSeat(s, p, q) { q.bunker = p.id; q.bunkerGo = null; q.front = null; const k = bunkerSquads(s, p).indexOf(q); const c = bunkerSlot(s, p, Math.max(0, k)); order(s, q.id, 'hold', c.x, c.y, true); }
// soldiers sent into our bunker (as many as there's room for; the rest not): true if any went
function garrison(s, side, ids, postId) {
  const p = (s.posts || []).find(k => k.id === postId); if (!p || p.kind !== 'bunker' || p.side !== side) return false;
  let room = BUNKER_MAX - bunkerMen(s, p).length - s.squads.filter(q => q.bunkerGo === p.id && !q.dead).reduce((a, q) => a + s.units.filter(u => u.squad === q.id).length, 0), any = false;
  for (const id of ids) {
    const q = s.squads.find(k => k.id === id); if (!q || q.dead || q.side !== side || !BUNKER_IN.includes(q.type) || q.bunker === p.id) continue;
    const n = s.units.filter(u => u.squad === q.id).length; if (!n || n > room) continue;
    room -= n; q.bunkerGo = p.id; q.bunker = null; any = true; order(s, q.id, 'hold', p.x, p.y, true);
  }
  return any;
}
// out by hand: an order of the player's (step.js)
function unbunker(s, ids) { for (const id of ids || []) { const q = s.squads.find(k => k.id === id); if (q) { q.bunker = null; q.bunkerGo = null; } } }
function bunkerTick(s) {
  for (const p of s.posts) if (p.kind === 'bunker') {
    for (const q of s.squads) {
      if (q.bunker === p.id && (q.dead || q.side !== p.side)) q.bunker = null;
      if (q.bunkerGo !== p.id) continue;
      if (q.dead || q.side !== p.side) { q.bunkerGo = null; continue; }
      if (s.units.some(u => u.squad === q.id && dist(u, p) <= POSTS.bunker.r + BUNKER_R + TYPES[u.type].r)) bunkerSeat(s, p, q);
    }
  }
  const man = new Map(); for (const q of s.squads) if (q.bunker && !q.dead) man.set(q.id, q.bunker);
  for (const u of s.units) { const b = man.get(u.squad); if (b) u.bunk = b; else if (u.bunk) delete u.bunk; }
}
const postK = (s, side, kind, k) => s.held && s.held[side] && s.held[side][kind] ? 1 + k : 1;
// a post of this kind held by u's side, close enough to serve it (by its edge)
const postNear = (s, u, kind) => !!s.posts && s.posts.some(p => p.kind === kind && p.side === u.side && dist(p, u) <= POSTS[kind].r + POST_R);
// every tick: soldiers walking into posts
function postsTick(s) {
  if (!s.posts) return;
  const gone = new Set();
  for (const p of s.posts) {
    const R = POSTS[p.kind].r;
    for (const u of around(s, p.x, p.y, R + MAX_R + CAPTURE_PAD)) {
      if (u.side === p.side || u.hp <= 0 || gone.has(u) || !CAPTURERS.includes(u.type)) continue;
      const reach = R + TYPES[u.type].r + CAPTURE_PAD; if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 > reach * reach) continue;
      const was = p.side;
      if (p.kind === 'bunker' && p.side && bunkerMen(s, p).length) continue; // (men in it: they hold it — shoot them out first)
      if (p.kind === 'bunker' && !p.side && u.type !== 'commando') { p.side = u.side; s.postsV++; postNews(s, p, was); const q = s.squads.find(k => k.id === u.squad); if (q && BUNKER_IN.includes(q.type)) bunkerSeat(s, p, q); break; } // (a bunker: whoever takes it stays in — the garrison)
      if (u.type === 'commando') { if (s.t - (u.tookAt ?? -99) < 3) continue; u.tookAt = s.t; p.side = u.side; }
      else { p.side = p.side ? null : u.side; gone.add(u); }
      s.postsV++; postNews(s, p, was);
      break; // (one at a time)
    }
  }
  if (gone.size) {
    s.units = s.units.filter(u => !gone.has(u));
    // (a squad that all went in isn't "destroyed": no loss reported)
    for (const u of gone) { const q = s.squads.find(k => k.id === u.squad); if (q && !q.dead && !s.units.some(m => m.squad === q.id)) { q.dead = true; q.deadAt = s.t; q.count = 0; q.strength = 0; } }
  }
  bunkerTick(s);
  countPosts(s);
}
// ours taken or lost: on the radio and the map (the 'flag' / 'flagLost' marks)
function postNews(s, p, was) {
  const name = POSTS[p.kind].name;
  if (p.side === 'blue') { note(s, `כבשנו את ${name}`); s.marks.push({ x: p.x, y: p.y, kind: 'flag', t: s.t, who: name, post: p.kind }); }
  else if (was === 'blue') { note(s, `איבדנו את ${name}`); s.marks.push({ x: p.x, y: p.y, kind: 'flagLost', t: s.t, who: name, post: p.kind }); }
}
// the AI: a soldier squad (not in a fight) to each post it doesn't hold, the nearest to its HQ first, one squad a post
function aiPosts(s, side, mine, setOrder) {
  if (!s.posts) return new Set();
  const busy = new Set(), home = hqOf(s, side) || s.bases[side];
  for (const q of mine) if (q.postGo) { const p = s.posts.find(k => k.id === q.postGo); if (!p || p.side === side || q.dead || q.retreating) q.postGo = null; else busy.add(q.id); }
  const want = s.posts.filter(p => p.side !== side && !mine.some(q => q.postGo === p.id) && !threatAt(s, side, p, AI_NEAR)).sort((a, b) => dist(a, home) - dist(b, home));
  for (const p of want.slice(0, 2)) {
    const q = mine.filter(k => CAPTURERS.includes(k.type) && !busy.has(k.id) && k.strength >= 0.5 && s.t - k.lastContact > CONTACT_MEMORY).sort((a, b) => Math.hypot(a.cx - p.x, a.cy - p.y) - Math.hypot(b.cx - p.x, b.cy - p.y))[0];
    if (!q) break;
    q.postGo = p.id; busy.add(q.id); setOrder(q, 'attack', p.x, p.y);
  }
  return busy;
}
