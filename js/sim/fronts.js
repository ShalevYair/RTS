// Sim: fronts — the player draws up to FRONT_MAX lines on the map, and the side's whole army (the player's and the
// partner's squads alike) goes to them: split between them evenly by strength, each squad its own fixed place along
// its line (in the order they stand, left to right, so no two cross on the way), in depth by kind — the fighters on
// the line, the medics / mechanics / signals trucks, the supply trucks and the guns behind it — and the supply behind
// the fighters while the line moves on (never ahead of them). Aircraft: behind the line while enemy AA is known near
// it, else out ahead to strike what is known there. A squad the player orders by hand leaves its front for FRONT_FREE s.
const FRONT_MAX = 3, FRONT_EVERY = 1, FRONT_FREE = 300, FRONT_EPS = 24, FRONT_REBAL = 5;
const FRONT_GAP = 30, FRONT_ROW = 42; // (along the line: room per unit; the rows behind the first, apart)
// how far behind the line each kind stands (the supply also as far again as the fighters still are behind theirs)
const FRONT_DEPTH = { care: 110, radio: 150, dome: 150, truck: 170, arty: 230 };
const FRONT_AA_R = 290, FRONT_AIR_R = 450, FRONT_AIR_BACK = 160; // (known enemy AA within this of a plane's spot: it waits back)
// not on a front: the bulldozers (their sites), the missile and Arrow trucks (home), tankers, transport helicopters,
// commandos (their own raids)
const FRONT_SKIP = ['dozer', 'ssm', 'arrow', 'tanker', 'lift', 'commando'];
const FRONT_LINE_ORDER = ['tank', 'tjeep', 'at', 'jeep', 'inf', 'ajeep', 'aa']; // (the first row first)
// what part of the army a squad is
function frontRole(sq) {
  const T = TYPES[sq.type];
  if (FRONT_SKIP.includes(sq.type)) return null;
  if (T.air) return 'air';
  if (CARGO[sq.type]) return 'truck:' + sq.type;
  if (T.arty) return 'arty';
  if (sq.type === 'radio' || sq.type === 'dome') return sq.type;
  if (T.care) return 'care';
  return 'line';
}
// a front's line: its points, the length along it, and which way is "back" (toward home) at each piece
function frontGeo(s, side, f) {
  const home = hqOf(s, side) || s.bases[side], P = f.pts, cum = [0], nx = [], ny = [];
  for (let i = 1; i < P.length; i++) {
    const dx = P[i].x - P[i - 1].x, dy = P[i].y - P[i - 1].y, L = Math.hypot(dx, dy) || 1;
    cum.push(cum[i - 1] + L);
    let x = -dy / L, y = dx / L; const mx = (P[i].x + P[i - 1].x) / 2, my = (P[i].y + P[i - 1].y) / 2;
    if (x * (home.x - mx) + y * (home.y - my) < 0) { x = -x; y = -y; }
    nx.push(x); ny.push(y);
  }
  return { P, cum, nx, ny, L: cum[cum.length - 1] || 1 };
}
// the point a along the line, d behind it
function frontAt(g, a, d) {
  a = clamp(a, 0, g.L); let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < a) i++;
  const k = (a - g.cum[i - 1]) / ((g.cum[i] - g.cum[i - 1]) || 1), A = g.P[i - 1], B = g.P[i];
  return { x: A.x + (B.x - A.x) * k + g.nx[i - 1] * d, y: A.y + (B.y - A.y) * k + g.ny[i - 1] * d };
}
// where p is to the line: a = along it, d = how far behind it (ahead: below 0)
function frontProj(g, p) {
  let best = { a: 0, d: 0, e: Infinity };
  for (let i = 1; i < g.P.length; i++) {
    const A = g.P[i - 1], B = g.P[i], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1;
    const k = clamp(((p.x - A.x) * dx + (p.y - A.y) * dy) / L2, 0, 1), qx = A.x + dx * k, qy = A.y + dy * k, e = Math.hypot(p.x - qx, p.y - qy);
    if (e < best.e) best = { a: g.cum[i - 1] + k * Math.sqrt(L2), d: (p.x - qx) * g.nx[i - 1] + (p.y - qy) * g.ny[i - 1], e };
  }
  return best;
}
// the player's fronts: a new line (points along it, the way it was drawn), or one taken off. Drawn near a front
// (FRONT_NEAR on the whole) — or with FRONT_MAX of them already — it takes the nearest one's place: the same front
// (number, colour, squads), its squads off to their places on the new line (that's how a front moves on)
const FRONT_NEAR = 250;
function addFront(s, side, pts) {
  s.fronts = s.fronts || {}; const F = s.fronts[side] = s.fronts[side] || [];
  pts = (pts || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: clamp(Math.round(p.x), 0, s.W), y: clamp(Math.round(p.y), 0, s.H) }));
  if (pts.length < 2) return null;
  let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]); if (L < 40) return null;
  const near = f => { const g = frontGeo(s, side, f); let e = 0; for (const p of pts) e += frontProj(g, p).e; return e / pts.length; };
  const old = F.map(f => ({ f, e: near(f) })).sort((a, b) => a.e - b.e)[0];
  if (old && (old.e < FRONT_NEAR || F.length >= FRONT_MAX)) { old.f.pts = pts; old.f.t = s.t; old.f.ready = false; s.frontAt = -99; return old.f; }
  s.frontSeq = (s.frontSeq || 0) + 1;
  const f = { id: s.frontSeq, pts, t: s.t }; F.push(f);
  if (s.front) s.front[side] = null; // (the old single flag: the lines take its place)
  s.frontAt = -99; return f;
}
function removeFront(s, side, id) {
  const F = s.fronts && s.fronts[side]; if (!F) return false;
  const i = F.findIndex(f => f.id === id); if (i < 0) return false;
  F.splice(i, 1);
  for (const q of s.squads) if (q.side === side && q.front === id) q.front = null;
  s.frontAt = -99; return true;
}
// a squad the player sent somewhere by hand: off its front for FRONT_FREE s (then back to it on its own)
function frontFree(s, ids) { for (const id of ids || []) { const q = s.squads.find(q => q.id === id); if (q) { q.freeAt = s.t; q.front = null; } } }
// back to its front now (not waiting out FRONT_FREE)
function toFront(s, ids) { for (const id of ids || []) { const q = s.squads.find(q => q.id === id); if (q) q.freeAt = undefined; } s.frontAt = -99; }
const onFronts = (s, side) => !!(s.fronts && s.fronts[side] && s.fronts[side].length);
// the squad's strength for the split: what its units are worth, by how whole they are
function frontPower(s, sq) { let p = 0; for (const u of s.units) if (u.squad === sq.id) p += (UNIT_VALUE[u.type] || 1) * Math.max(0.2, u.hp / TYPES[u.type].hp); return p; }
// share these out between the fronts, evenly by weight: each keeps its front; new ones go to the one that's shortest
// (the nearest if even); then, at most once every FRONT_REBAL s, one moves from the fullest to the emptiest if that
// evens them out (the one nearest to the other line) — need: a front's share (default even)
function frontSplit(s, items, F, geo, wt, need, rebal) {
  const load = new Map(F.map(f => [f.id, 0])), share = f => need ? need(f) : 1;
  for (const o of items) if (load.has(o.q.front)) load.set(o.q.front, load.get(o.q.front) + wt(o));
  for (const o of items) if (!load.has(o.q.front)) {
    let best = null, bv = Infinity;
    for (const f of F) { const v = load.get(f.id) / Math.max(1e-6, share(f)) + frontProj(geo.get(f.id), o.p).e * 1e-6; if (v < bv) { bv = v; best = f; } }
    o.q.front = best.id; load.set(best.id, load.get(best.id) + wt(o));
  }
  if (!rebal || F.length < 2) return;
  const tot = F.reduce((a, f) => a + share(f), 0), lv = f => load.get(f.id) / (share(f) / tot);
  const hi = F.reduce((a, f) => lv(f) > lv(a) ? f : a), lo = F.reduce((a, f) => lv(f) < lv(a) ? f : a); if (hi === lo) return;
  const gap = (lv(hi) - lv(lo)) * (share(lo) / tot) / 2, g = geo.get(lo.id);
  const c = items.filter(o => o.q.front === hi.id && wt(o) <= gap * 0.8).sort((a, b) => frontProj(g, a.p).e - frontProj(g, b.p).e)[0];
  if (c) c.q.front = lo.id;
}
// an order from the front (as the AI's: compared with what it last asked, so it isn't resent all the time)
function frontOrder(s, sq, type, x, y) {
  x = Math.round(x); y = Math.round(y);
  const p = pending(s, sq.id, 'order'), cur = p || sq.order, w = cur.want || cur, k = sq.frontAsk;
  if (cur.type === type && Math.hypot(w.x - x, w.y - y) < FRONT_EPS) return;
  if (k && k.type === type && cur.type === type && Math.hypot(k.x - x, k.y - y) < FRONT_EPS) return;
  sq.frontAsk = { type, x, y };
  order(s, sq.id, type, x, y, true);
}
function frontTick(s) {
  if (!s.fronts || s.over || s.t - (s.frontAt ?? -99) < FRONT_EVERY) return;
  s.frontAt = s.t; const rebal = s.t - (s.frontRebal ?? -99) >= FRONT_REBAL; if (rebal) s.frontRebal = s.t;
  for (const side of ['blue', 'red']) {
    const F = s.fronts[side]; if (!F || !F.length) continue;
    const geo = new Map(F.map(f => [f.id, frontGeo(s, side, f)])), busy = askBusy(s, side), byRole = {};
    for (const q of s.squads) {
      if (q.side !== side || q.dead || q.aboard || q.boarding || q.fhqAt || q.hqAt || busy.has(q.id) || s.t - (q.freeAt ?? -1e9) < FRONT_FREE) continue; // (sent by hand lately, or answering an ask: not now)
      const r = frontRole(q); if (!r) { q.front = null; continue; }
      if (q.type === 'ssm' && q.fire) continue;
      const us = s.units.filter(u => u.squad === q.id); if (!us.length) continue;
      const p = { x: us.reduce((a, u) => a + u.x, 0) / us.length, y: us.reduce((a, u) => a + u.y, 0) / us.length };
      (byRole[r] = byRole[r] || []).push({ q, p, n: us.length, pw: frontPower(s, q) });
    }
    // (the split: fighters and aircraft by strength; the supply by what each front needs of it; the rest by number)
    const has = (f, test) => (byRole.line || []).concat(byRole.air || []).filter(o => o.q.front === f.id && test(o.q.type)).reduce((a, o) => a + o.n, 0) + 0.01;
    const NEED = { fueltruck: t => needsFuel(t) && !TYPES[t].air, watertruck: t => needsWater(t), truck: t => !!SUPPLY[t] };
    for (const r of Object.keys(byRole)) {
      const items = byRole[r], kind = r.startsWith('truck:') ? r.slice(6) : null;
      frontSplit(s, items, F, geo, r === 'line' || r === 'air' ? o => o.pw : () => 1, kind && NEED[kind] ? f => has(f, NEED[kind]) : null, rebal);
    }
    frontRescue(s, side, byRole);
    for (const f of F) {
      const g = geo.get(f.id), line = (byRole.line || []).filter(o => o.q.front === f.id);
      // the fighters: rows along the line — the first-row kinds first — each squad as wide as its units, and in each
      // row in the order they stand along the line (so their ways don't cross)
      line.sort((a, b) => (FRONT_LINE_ORDER.indexOf(a.q.type) + 99) % 99 - (FRONT_LINE_ORDER.indexOf(b.q.type) + 99) % 99);
      const K = Math.max(1, Math.floor(g.L / FRONT_GAP)); let row = [], rows = [], used = 0;
      for (const o of line) { if (used + o.n > K && row.length) { rows.push(row); row = []; used = 0; } row.push(o); used += o.n; }
      if (row.length) rows.push(row);
      const lags = [];
      rows.forEach((row, ri) => {
        for (const o of row) o.a = frontProj(g, o.p).a;
        row.sort((a, b) => a.a - b.a);
        const n = row.reduce((a, o) => a + o.n, 0); let at = 0;
        for (const o of row) {
          const a = g.L * (at + o.n / 2) / n, d = ri * FRONT_ROW, c = frontAt(g, a, d); at += o.n;
          if (!frontDry(s, o.q)) lags.push(Math.max(0, frontProj(g, o.p).d - d));
          frontOrder(s, o.q, 'hold', c.x, c.y);
        }
      });
      lags.sort((a, b) => a - b); const lag = lags.length ? lags[lags.length >> 1] : 0; // (how far behind their places the fighters still are: the middle one — not those stuck dry far back)
      // the rest behind: each kind spread evenly along the line at its depth, and the supply that much further back
      // while the fighters are still on their way (it never runs ahead of them)
      for (const r of Object.keys(byRole)) {
        if (r === 'line' || r === 'air') continue;
        const its = byRole[r].filter(o => o.q.front === f.id && !o.q.rescue); if (!its.length) continue; // (off to one run dry: frontRescue)
        for (const o of its) o.a = frontProj(g, o.p).a;
        its.sort((a, b) => a.a - b.a);
        const base = FRONT_DEPTH[r.startsWith('truck:') ? 'truck' : r] || FRONT_DEPTH.care;
        its.forEach((o, i) => { const c = frontAt(g, g.L * (i + 0.5) / its.length, base + lag); frontOrder(s, o.q, 'hold', c.x, c.y); });
      }
      // aircraft: over their stretch of the line; enemy AA known near it — back out of its reach; none — out to strike
      // the nearest enemy known ahead of the line
      const air = (byRole.air || []).filter(o => o.q.front === f.id); if (!air.length) continue;
      const foe = side === 'blue' ? 'red' : 'blue', known = [];
      for (const q of s.squads) if (q.side === foe && !q.dead) { const k = intel(s, side, q); if (k) known.push(k); }
      const aa = known.filter(k => k.type === 'aa' || k.type === 'ajeep');
      for (const o of air) o.a = frontProj(g, o.p).a;
      air.sort((a, b) => a.a - b.a);
      air.forEach((o, i) => {
        const a = g.L * (i + 0.5) / air.length; let c = frontAt(g, a, 0);
        if (aa.some(k => dist(k, c) < FRONT_AA_R)) {
          let d = FRONT_AIR_BACK; c = frontAt(g, a, d);
          while (d < 700 && aa.some(k => dist(k, c) < FRONT_AA_R)) { d += 60; c = frontAt(g, a, d); }
          frontOrder(s, o.q, 'hold', c.x, c.y); return;
        }
        let tgt = null, bd = FRONT_AIR_R;
        for (const k of known) { const e = dist(k, c), pr = frontProj(g, k); if (e < bd && pr.d < 60) { bd = e; tgt = k; } }
        if (tgt) frontOrder(s, o.q, 'attack', tgt.x, tgt.y); else { const h = frontAt(g, a, 40); frontOrder(s, o.q, 'hold', h.x, h.y); }
      });
    }
  }
}
// a squad on a front run dry of what keeps it going: fuel (a vehicle), ammunition, water — it stands there, far from
// the trucks behind the line
const DRY = { fueltruck: u => needsFuel(u.type) && !TYPES[u.type].air && (u.fuel ?? 1) < 0.05, truck: u => !!SUPPLY[u.type] && u.sup !== undefined && u.sup < 0.05, watertruck: u => needsWater(u.type) && (u.water ?? 1) < 0.15 };
const FULL = { fueltruck: u => (u.fuel ?? 1) > 0.9, truck: u => (u.sup ?? 1) > 0.9, watertruck: u => (u.water ?? 1) > 0.9 };
const frontDry = (s, q) => s.units.some(u => u.squad === q.id && Object.values(DRY).some(f => f(u)));
// a truck of the kind goes to it (the nearest with a load, no more than half a kind's trucks at once — the line still
// served), stays till it's full, then back to its place on the line (FRONT_RESCUE s at most)
const FRONT_RESCUE = 120;
function frontRescue(s, side, byRole) {
  const on = new Set(); for (const r of Object.keys(byRole)) for (const o of byRole[r]) on.add(o.q.id);
  for (const kind of Object.keys(DRY)) {
    const trucks = (byRole['truck:' + kind] || []).map(o => o.q);
    for (const q of trucks) if (q.rescue) { const u = s.units.find(u => u.id === q.rescue.u); if (!u || FULL[kind](u) || s.t - q.rescue.t > FRONT_RESCUE) q.rescue = null; }
    const dry = s.units.filter(u => u.side === side && on.has(u.squad) && DRY[kind](u)); if (!dry.length || !trucks.length) continue;
    const tu = q => s.units.find(u => u.squad === q.id);
    for (const u of dry) {
      if (trucks.some(q => { const t = tu(q); return t && dist(t, u) < TRUCK_R * 0.9 || q.rescue && (() => { const v = s.units.find(v => v.id === q.rescue.u); return v && dist(v, u) < 150; })(); })) continue;
      if (trucks.filter(q => q.rescue).length >= Math.max(1, Math.floor(trucks.length / 2))) break;
      const free = trucks.filter(q => !q.rescue && tu(q) && !tu(q).refill && (tu(q).load ?? 1) > TRUCK_CAP[kind] * 0.3).sort((a, b) => dist(tu(a), u) - dist(tu(b), u))[0];
      if (!free) break;
      free.rescue = { u: u.id, t: s.t };
    }
    for (const q of trucks) if (q.rescue) { const u = s.units.find(u => u.id === q.rescue.u); if (u) frontOrder(s, q, 'hold', u.x, u.y); }
  }
}

