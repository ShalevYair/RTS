// Sim: posts — neutral buildings on the map (the full game on the big maps), taken by soldiers. See POSTS (config).
// A soldier who walks into a post that isn't his side's goes in for good: a post of no side becomes his, the enemy's
// becomes no one's (a second one takes it). A commando takes it whole and walks out again. Posts don't count in power
// and can't be destroyed; nothing drives through them.

// the full game's extras on this map: the posts, the weather (and the fast roads and ambushes: s.extras)
function extras(s) {
  s.extras = true; makePosts(s); weatherPlan(s);
  return s;
}
// where they go: the one-of-a-kind ones (radar, power, fuel) on the centre line — the radar near the middle; the rest
// in pairs, one on our half and its twin on the enemy's (the observation towers on high ground). Not in a lake, not
// by the bases, POST_GAP apart.
function makePosts(s) {
  const r = rng(s.seed ^ 0x1b873593), W = s.W, H = s.H, col = s.scale >= 4 ? 1 : 0, out = [];
  const ok = (p, R) => p.x > R + 30 && p.x < W - R - 30 && p.y > R + 30 && p.y < H - R - 30 && !lakeAt(s, p, R + LAKE_PAD + 10) && out.every(o => dist(o, p) > POST_GAP + POSTS[o.kind].r + R);
  const twin = p => ({ x: W - p.x, y: s.turn ? H - p.y : p.y });
  const add = (kind, p) => out.push({ id: 'p' + out.length, kind, x: Math.round(p.x), y: Math.round(p.y), side: null });
  for (const kind of Object.keys(POSTS)) {
    const P = POSTS[kind], n = P.n[col], R = P.r;
    if (n === 1) {
      for (let i = 0; i < 300; i++) {
        const mid = kind === 'radar' && i < 150, p = { x: W / 2 + (r() - 0.5) * 30, y: H * (mid ? 0.35 + r() * 0.3 : 0.1 + r() * 0.8) };
        if (ok(p, R)) { add(kind, p); break; }
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
      .sort((a, b) => dist(a, p) - dist(b, p)).slice(0, BUNKER_MAX).forEach(u => s.bunkered.add(u.id));
  }
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
