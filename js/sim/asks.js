// Sim: asks between partners (arms, DESIGN.md): a player marks a spot on the map with what they need there — fuel,
// ammunition, water, fire, a lift, guarding, a site built first — and the other answers with what it has. The computer
// partner (think 'mate') answers the player's at once (answerAsk), and asks the player in turn (mateAsks).
// s.asks: { id, side, from ('me' | 'mate'), kind, x, y, t, by: the squads sent, ok }. For ASK_T s the squads sent stay
// on it (think leaves them be), then the partner takes them back.
const ASK_KINDS = ['fuel', 'ammo', 'water', 'fire', 'lift', 'guard', 'build'];
const ASK_T = 90, ASK_EVERY = 60, ASK_GUARD_N = 3, ASK_FIRE_N = 2, ASK_SITE_R = 90, ASK_MARK_R = 200;
// what answers each (the types sent); guard: any fighting squad
const ASK_BY = { fuel: ['fueltruck'], ammo: ['truck'], water: ['watertruck'], fire: ['how', 'mlrs', 'air', 'heli', 'gunship', 'ssm'], lift: ['lift'], build: ['dozer'] };
const askWho = (s, q) => q.cmd ? 'me' : armSide(s, q.side, q.type) || 'me';
// the squads of player `who` that could answer an ask of this kind
function askCrews(s, side, who, kind) {
  return s.squads.filter(q => q.side === side && !q.dead && !q.aboard && askWho(s, q) === who && s.units.some(u => u.squad === q.id) &&
    (ASK_BY[kind] ? ASK_BY[kind].includes(q.type) : !TYPES[q.type].care && !TYPES[q.type].air && q.type !== 'ssm'));
}
// can the other player answer this kind at all (has the units for it)? — the UI offers only these
// anything may be asked that the other player has, or could build (its arms): with none of it, a computer partner builds
// what makes it first (ASK_MAKE: water — a water point, fuel — a fuel station, …), and sends it once there is one;
// the ask waits for it ASK_WAIT s
const ASK_MAKE = { fuel: ['fuelst'], ammo: ['depot'], water: ['waterst'], lift: ['helilift'], fire: ['howshop', 'mlrsshop', 'heliatk', 'airfield', 'ssmshop'] }, ASK_WAIT = 300, ASK_RETRY = 5;
const askMake = (s, side, who, kind) => (ASK_MAKE[kind] || []).find(k => (armSide(s, side, k) || 'me') === who && (!s.builds || s.builds.includes(k)) && (k !== 'fuelst' || s.fuel) && (!STRUCTS[k].fuel || s.fuel) && (!STRUCTS[k].max || alive(s, side, [k]).length < STRUCTS[k].max)) || null;
const canAsk = (s, side, who, kind) => { const o = who === 'me' ? 'mate' : 'me'; return !!s.arms && (askCrews(s, side, o, kind).length > 0 || !!askMake(s, side, o, kind)); };
// every few seconds: the asks waiting for something to be built, asked again; the partner's build order dropped once none waits
function askRetry(s) {
  if (!s.asks || !s.asks.length) return;
  for (const a of s.asks) if (a.wait && !a.ok && s.t - (a.tried || a.t) >= ASK_RETRY) { a.tried = s.t; answerAsk(s, a); if (a.ok) { a.wait = false; a.late = true; a.t = s.t; } }
  if (s.askMake) for (const k in s.askMake) if (!s.asks.some(a => a.wait && !a.ok && a.side + (a.from === 'me' ? 'mate' : 'me') === k)) delete s.askMake[k];
}
// a site of the side near (x, y), still going up
const siteNear = (s, side, x, y) => s.nodes.filter(n => n.side === side && n.hp > 0 && isSite(n) && s.t < n.ready && Math.hypot(n.x - x, n.y - y) < nodeR(n) + ASK_SITE_R).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
// a new ask from player `from` of the side; the computer partner answers the player's at once
function ask(s, side, kind, x, y, from = 'me') {
  if (!ASK_KINDS.includes(kind) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  s.asks = (s.asks || []).filter(a => s.t - a.t < (a.wait ? ASK_WAIT : ASK_T));
  const a = { id: s.askN = (s.askN || 0) + 1, side, from, kind, x: Math.round(x), y: Math.round(y), t: s.t, by: [], ok: false };
  s.asks.push(a);
  if (from === 'me' && s.mate && side === 'blue') answerAsk(s, a);
  return a;
}
// the partner answers: the nearest of what it has for it goes there (a truck with something in it; guns to within
// range, aircraft at it, a missile at a known building there; a helicopter to wait; fighters to hold the spot; the
// bulldozer to the site, first)
function answerAsk(s, a) {
  const who = a.from === 'me' ? 'mate' : 'me', p = { x: a.x, y: a.y };
  const near = l => l.sort((q, k) => Math.hypot(q.cx - a.x, q.cy - a.y) - Math.hypot(k.cx - a.x, k.cy - a.y));
  const busy = new Set(); for (const b of s.asks) if (b !== a && s.t - b.t < ASK_T) for (const id of b.by) busy.add(id);
  const crews = near(askCrews(s, a.side, who, a.kind).filter(q => !busy.has(q.id)));
  const go = (q, type, x, y) => { if (order(s, q.id, type, Math.round(x), Math.round(y), true)) a.by.push(q.id); };
  if (CARGO[(ASK_BY[a.kind] || [])[0]]) {
    // (a truck with something in it, not on its way to fill up)
    const q = crews.find(q => s.units.some(u => u.squad === q.id && (u.load ?? 1) > 0.25 && !u.refill));
    if (q) go(q, 'hold', a.x, a.y);
  } else if (a.kind === 'fire') {
    // (marking: at what's marked by the spot, if anything is — there it hits in full)
    if (s.designate) {
      let best = null, bd = ASK_MARK_R; const foe = foeOf(a.side);
      for (const v of [...s.units.filter(v => v.side === foe && v.hp > 0), ...s.nodes.filter(n => n.side === foe && n.hp > 0 && n.kind !== 'drone')]) {
        const d = Math.hypot(v.x - a.x, v.y - a.y); if (d < bd && s.marked && s.marked[a.side].has(v.kind ? 'n' + v.id : v.id)) { bd = d; best = v; }
      }
      if (best) { a.x = Math.round(best.x); a.y = Math.round(best.y); a.onMark = true; }
    }
    let n = 0;
    for (const q of crews) {
      if (n >= ASK_FIRE_N) break;
      if (q.type === 'ssm') { const t = knownFoeNode(s, a.side, a.x, a.y, 120); if (t && !q.fire && launch(s, [q.id], t.x, t.y)) { a.by.push(q.id); n++; } continue; }
      if (TYPES[q.type].arty) { // (the guns: to within range of it, from where they are)
        const d = Math.hypot(q.cx - a.x, q.cy - a.y) || 1, R = ARTY_R * 0.75;
        if (d > R) go(q, 'hold', a.x + (q.cx - a.x) / d * R, a.y + (q.cy - a.y) / d * R); else a.by.push(q.id);
        n++; continue;
      }
      go(q, 'attack', a.x, a.y); n++;
    }
  } else if (a.kind === 'lift') {
    const q = crews.find(q => !s.units.some(u => u.squad === q.id && u.cargo && u.cargo.length));
    if (q) go(q, 'hold', a.x, a.y);
  } else if (a.kind === 'guard') {
    for (const q of crews.filter(q => q.strength >= 0.4).slice(0, ASK_GUARD_N)) go(q, 'hold', a.x, a.y);
  } else if (a.kind === 'build') {
    const n = siteNear(s, a.side, a.x, a.y), q = n && crews[0];
    if (q && assignSite(s, q, n, true)) a.by.push(q.id);
  }
  a.ok = a.by.length > 0;
  if (!a.ok && (who === 'mate' || s.meBot)) { // (none of it: the computer builds what makes it, and the ask waits)
    const k = askMake(s, a.side, who, a.kind);
    if (k) { a.make = k; a.wait = true; (s.askMake = s.askMake || {})[a.side + who] = k; }
  }
  return a.ok;
}
// the squads on an answered ask still (think leaves them be)
function askBusy(s, side) {
  const out = new Set();
  for (const a of s.asks || []) if (a.side === side && s.t - a.t < ASK_T) for (const id of a.by) out.add(id);
  return out;
}
// the computer partner asks the player (at most one of a kind every ASK_EVERY s): guarding, where its trucks, guns or
// bulldozers are shot at; what the player carries (fuel, ammunition, water), where its squads run short of it; fire,
// where its squads are fighting
function mateAsks(s, side, mine, foes) {
  const last = s.askAt = s.askAt || {}, ready = k => s.t - (last[k] ?? -ASK_EVERY) >= ASK_EVERY && canAsk(s, side, 'mate', k);
  const put = (k, x, y) => { last[k] = s.t; ask(s, side, k, x, y, 'mate'); };
  const hot = q => s.t - q.lastContact < 4 || s.units.some(u => u.squad === q.id && s.t - (u.shotAt ?? -99) < 4); // (fighting, or shot at)
  if (ready('guard')) { const q = mine.find(q => (TYPES[q.type].care || TYPES[q.type].arty) && hot(q)); if (q) { put('guard', q.cx, q.cy); return; } }
  for (const [k, key] of [['fuel', 'fuel'], ['water', 'water'], ['ammo', 'sup']]) {
    if (!ready(k)) continue;
    const q = mine.find(q => { const m = s.units.filter(u => u.squad === q.id && u[key] !== undefined); return m.length && m.reduce((a, u) => a + u[key], 0) / m.length < AI_NEED; });
    if (q) { put(k, q.cx, q.cy); return; }
  }
  if (ready('fire')) {
    const q = mine.find(q => !TYPES[q.type].care && hot(q)), f = q && foes.find(({ k }) => Math.hypot(k.x - q.cx, k.y - q.cy) < AI_NEAR);
    if (f) put('fire', f.k.x, f.k.y);
  }
}

// ---- marking targets (arms, s.designate — DESIGN.md "סימון"): soldiers, commandos and drones mark what of the enemy
// they see within MARK_SIGHT of their sight; it stays marked MARK_KEEP s after. Aircraft, helicopters, guns and
// missiles hit a marked target in full, an unmarked one only MARK_HIT of the time — the air force and the guns need
// eyes on the ground. s.marked[side]: Map id (a unit's id, 'n' + a building's) → marked until ----
const MARK_BY = ['inf', 'at', 'aa', 'commando'], MARK_NEED = ['air', 'heli', 'gunship'];
const MARK_SIGHT = 0.8, MARK_KEEP = 10, MARK_EVERY = 0.5, MARK_HIT = 0.6;
function markTick(s) {
  if (!s.designate || s.t - (s.markAt ?? -99) < MARK_EVERY) return;
  s.markAt = s.t; s.marked = s.marked || { blue: new Map(), red: new Map() };
  for (const side of ['blue', 'red']) {
    const M = s.marked[side], foe = foeOf(side);
    for (const [id, t] of M) if (t < s.t) M.delete(id);
    const eyes = [];
    for (const u of s.units) if (u.side === side && u.hp > 0 && MARK_BY.includes(u.type)) eyes.push({ x: u.x, y: u.y, r: TYPES[u.type].sight * MARK_SIGHT * envSight(s, u) });
    for (const n of s.nodes) if (n.side === side && n.kind === 'drone' && n.hp > 0 && s.t >= n.ready) eyes.push({ x: n.x, y: n.y, r: DRONE_SIGHT * MARK_SIGHT });
    const until = s.t + MARK_KEEP;
    for (const e of eyes) {
      for (const v of around(s, e.x, e.y, e.r)) if (v.side === foe && v.hp > 0 && Math.hypot(v.x - e.x, v.y - e.y) <= e.r && seen(s, side, v)) M.set(v.id, until);
      for (const n of s.nodes) if (n.side === foe && n.hp > 0 && n.kind !== 'drone' && Math.hypot(n.x - e.x, n.y - e.y) <= e.r + nodeR(n)) M.set('n' + n.id, until);
    }
  }
}
// is this enemy unit / building marked for the side (no marking this game: all of it is)
const isMarked = (s, side, e) => !s.designate || !!(s.marked && s.marked[side].has(e.kind ? 'n' + e.id : e.id));
// a shot that needs marking at something unmarked: does it hit? (MARK_HIT of the time)
const markHit = (s, side, e) => isMarked(s, side, e) || s.rand() < MARK_HIT;
