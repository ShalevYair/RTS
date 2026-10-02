// Sim: the light and the weather — the night, rain, the morning fog — and what they (and a held radar) do to how far
// things see, how far they shoot and how often they hit. Rain and fog only where s.extras is on (the full game on the
// big maps); the night wherever s.night is.

// the weather for the whole game, from the seed (its own stream): a list of spells { kind: 'rain' | 'fog', a, b }
function weatherPlan(s) {
  const r = rng(s.seed ^ 0x3c6ef372), day = NIGHT_STEP * NIGHT_LEVELS.length, dawn = (NIGHT_LEVELS.indexOf(1) + 1) * NIGHT_STEP, L = [];
  for (let d = 0; d < 60; d++) {
    const t0 = d * day;
    // (the fog: from the first light after the night, only with the night on)
    if (s.night && r() < WX_FOG_P) L.push({ kind: 'fog', a: t0 + dawn, b: t0 + dawn + WX_FOG_T });
    if (r() < WX_RAIN_P) { const len = WX_RAIN_T[0] + r() * (WX_RAIN_T[1] - WX_RAIN_T[0]), from = d ? 0 : 90, a = t0 + from + r() * Math.max(1, day - len - from); L.push({ kind: 'rain', a, b: a + len }); }
  }
  s.wxPlan = L;
}
const NO_WX = { rain: 0, fog: 0 };
// how much rain and fog there is now, 0..1 each (eased in and out over WX_FADE); once a tick
function weatherAt(s) {
  if (!s.extras || !s.wxPlan) return NO_WX;
  const c = s.wxNow; if (c && c.t === s.t) return c;
  let rain = 0, fog = 0;
  for (const w of s.wxPlan) {
    if (s.t < w.a || s.t > w.b + WX_FADE) continue;
    const k = clamp((s.t - w.a) / WX_FADE, 0, 1) * clamp((w.b + WX_FADE - s.t) / WX_FADE, 0, 1), e = k * k * (3 - 2 * k);
    if (w.kind === 'rain') rain = Math.max(rain, e); else fog = Math.max(fog, e);
  }
  return (s.wxNow = { t: s.t, rain, fog });
}
// the morning fog lies on the plain: a unit on a hill (contour line 1 up) or in the air is above it
const fogAt = (s, u) => { const f = weatherAt(s).fog; return f && !(u.type && TYPES[u.type].air) && (u.lvl ?? levelAt(s, u)) < 1 ? f : 0; };
// a held radar: its side's units see and shoot further
const radarK = (s, side) => s.held && side && s.held[side].radar ? RADAR_K : 0;
// what the dark and the weather leave of sight (and the radar adds) for a unit; of its range; of its hits
function envSight(s, u) { const w = weatherAt(s); return (1 - NIGHT_SIGHT * nightAt(s)) * (1 - WX_K * w.rain) * (1 - WX_K * fogAt(s, u)) * (1 + radarK(s, u.side)); }
function envRange(s, u) { const w = weatherAt(s); return (1 - NIGHT_RANGE * nightAt(s)) * (1 - WX_K * w.rain) * (1 - WX_K * fogAt(s, u)) * (1 + radarK(s, u.side)); }
function envHit(s, u) { const w = weatherAt(s); return (1 - NIGHT_MISS * nightAt(s)) * (1 - WX_K * w.rain) * (1 - WX_K * fogAt(s, u)); }
// drones and buildings: the dark and the rain (they're above the fog, or see over it)
function skySight(s, side) { const w = weatherAt(s); return (1 - NIGHT_SIGHT * nightAt(s)) * (1 - WX_K * w.rain) * (1 + radarK(s, side)); }

// ---- fast roads: the roads of the UI's map (each a list of points { x, y, w }), as a set of small cells ----
function setRoads(s, roads) {
  const C = 8, on = new Set();
  for (const pts of roads) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n, w = (a.w || 4) + 3;
      for (let i2 = Math.floor((x - w) / C); i2 <= Math.floor((x + w) / C); i2++) for (let j = Math.floor((y - w) / C); j <= Math.floor((y + w) / C); j++) on.add(i2 * 65536 + j);
    }
  }
  s.roads = on;
}
const onRoad = (s, p) => !!s.roads && s.roads.has(Math.floor(p.x / 8) * 65536 + Math.floor(p.y / 8));
const isVehicle = type => !TYPES[type].air && !FOOT.includes(type);

// ---- ambush: a soldier or jeep standing still under the trees, not firing, is hard to see ----
const ambushed = (s, u) => s.extras && s.t - (u.movedAt ?? 0) >= AMBUSH_STILL && s.t - u.lastFire >= AMBUSH_QUIET && inCover(s, u);
