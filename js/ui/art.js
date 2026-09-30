// UI: the look — buildings drawn as pictures (not emoji), light and air (cloud shadows, a vignette, night lights),
// battle marks (smoke, scorch marks, muzzle flashes), and moving water. Nothing here changes the game.

// ---- buildings: each kind drawn once off screen in its side's colour, as seen from above and a little to the south
// (roofs lit from the north-west, a darker wall along the front, a soft shadow to the south-east), kept per kind,
// colour and size. Drawn on a 40-unit footprint and scaled.
const artCache = new Map(), ART_RES = 3;
const STONE = '#d8d0bf', STONE_DK = '#a39a88', WOOD = '#8d6b43', WOOD_DK = '#5e4629', METAL = '#6f757a', SAND = '#cdb88e';
function buildingPic(kind, col, px) {
  const key = kind + col + px; let pic = artCache.get(key); if (pic) return pic;
  const P = px * ART_RES / 40, w = Math.ceil(px * 1.7 * ART_RES);
  pic = document.createElement('canvas'); pic.width = pic.height = w;
  const c = pic.getContext('2d');
  // a building with its own picture (art/): recoloured, about as wide as the drawn one
  const own = BUILDING_PIC[kind], im = own && spritePic(own, col);
  if (im) { const dw = px * 1.35 * ART_RES, dh = dw * im.height / im.width; c.drawImage(im, (w - dw) / 2, (w - dh) / 2 - dh * 0.06, dw, dh); artCache.set(key, pic); return pic; }
  c.translate(w / 2, w / 2); c.scale(P, P); c.lineJoin = 'round'; c.lineCap = 'round';
  const dk = shade(col, -0.38), lt = shade(col, 0.28);
  // a lit roof: light at its north-west corner, the side colour, darker to the south-east
  const lit = (x, y, ww, hh, base) => { const g = c.createLinearGradient(x, y, x + ww, y + hh); g.addColorStop(0, shade(base, 0.25)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -0.22)); return g; };
  const shadowOn = () => { c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 5 * P; c.shadowOffsetX = 3 * P; c.shadowOffsetY = 4 * P; };
  const shadowOff = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = c.shadowOffsetY = 0; };
  const edge = (lw = 0.8) => { c.lineWidth = lw; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke(); };
  // a building: its roof (x, y, w, h) and a front wall `wall` high below it
  const block = (x, y, ww, hh, wall, roof, wallCol = STONE_DK) => {
    c.beginPath(); c.rect(x, y + hh, ww, wall); c.fillStyle = wallCol; c.fill(); edge();
    c.beginPath(); c.rect(x, y, ww, hh); c.fillStyle = lit(x, y, ww, hh, roof); c.fill(); edge();
  };
  const disc = (x, y, r, fill) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); edge(); };
  const crate = (x, y, s2) => { c.beginPath(); c.rect(x - s2, y - s2, 2 * s2, 2 * s2); c.fillStyle = WOOD; c.fill(); edge(0.6); c.beginPath(); c.moveTo(x - s2, y - s2); c.lineTo(x + s2, y + s2); c.moveTo(x + s2, y - s2); c.lineTo(x - s2, y + s2); c.strokeStyle = WOOD_DK; c.lineWidth = 0.6; c.stroke(); };
  const barrel = (x, y) => { disc(x, y, 2.2, METAL); c.beginPath(); c.arc(x - 0.5, y - 0.5, 1, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); };
  // sandbags in a ring (posts), each bag its own lump
  const bags = (r, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * 0.85); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, 0, 3.3, 2.1, 0, 0, Math.PI * 2); c.fillStyle = i % 2 ? SAND : shade(SAND, -0.1); c.fill(); edge(0.5); c.restore(); } };
  const tube = (x1, y1, x2, y2, wd, fill) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = wd + 1.2; c.strokeStyle = 'rgba(0,0,0,.55)'; c.stroke(); c.lineWidth = wd; c.strokeStyle = fill; c.stroke(); };
  // a hangar: a corrugated roof (stripes) over a front wall with a dark open door
  const hangar = (x, y, ww, hh, wall) => {
    block(x, y, ww, hh, wall, col);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 0.7; c.beginPath(); for (let i = x + 3; i < x + ww; i += 3) { c.moveTo(i, y + 0.6); c.lineTo(i, y + hh - 0.6); } c.stroke();
    c.beginPath(); c.rect(x + ww * 0.3, y + hh + 1, ww * 0.4, wall - 1); c.fillStyle = '#2b2a28'; c.fill();
  };
  shadowOn();
  if (kind === 'hq' || kind === 'decoy') {
    // a fortress: a stone wall round a yard, a tower at each corner under a coloured cone, the keep in the middle
    c.beginPath(); c.rect(-17, -13, 34, 28); c.fillStyle = STONE; c.fill(); edge(1); shadowOff();
    c.beginPath(); c.rect(-13, -9, 26, 20); c.fillStyle = shade(SAND, 0.1); c.fill(); edge(0.6);
    c.beginPath(); c.rect(-17, 15, 34, 5); c.fillStyle = STONE_DK; c.fill(); edge(); // the front wall
    c.beginPath(); c.moveTo(-4, 20); c.lineTo(-4, 16.5); c.arc(0, 16.5, 4, Math.PI, 0); c.lineTo(4, 20); c.fillStyle = '#3a2f24'; c.fill(); // the gate
    block(-7, -8, 14, 11, 5, col, STONE_DK);
    for (const [x, y] of [[-17, -13], [17, -13], [-17, 15], [17, 15]]) {
      disc(x, y + 2, 6.2, STONE_DK); disc(x, y, 6, STONE);
      const g = c.createRadialGradient(x - 2, y - 2, 0.5, x, y, 5); g.addColorStop(0, lt); g.addColorStop(1, dk);
      c.beginPath(); c.arc(x, y, 4.6, 0, Math.PI * 2); c.fillStyle = g; c.fill(); edge(0.6);
    }
    c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -19); c.strokeStyle = '#3b3530'; c.lineWidth = 0.9; c.stroke(); // the flag pole (the flag waves: drawn live)
  } else if (kind === 'fhq') {
    // a command tent with an antenna, crates by it
    c.beginPath(); c.roundRect ? c.roundRect(-12, -8, 24, 16, 3) : c.rect(-12, -8, 24, 16); c.fillStyle = lit(-12, -8, 24, 16, col); c.fill(); edge(); shadowOff();
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.strokeStyle = dk; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.moveTo(-12, -8); c.lineTo(-16, -12); c.moveTo(12, -8); c.lineTo(16, -12); c.moveTo(-12, 8); c.lineTo(-16, 12); c.moveTo(12, 8); c.lineTo(16, 12); c.strokeStyle = 'rgba(60,50,40,.7)'; c.lineWidth = 0.5; c.stroke();
    crate(14, 4, 2.6); crate(15, -3, 2.2);
    c.beginPath(); c.moveTo(-8, -2); c.lineTo(-8, -20); c.strokeStyle = '#333'; c.lineWidth = 0.9; c.stroke(); disc(-8, -20, 1.4, '#e0e0e0');
  } else if (kind === 'tent') {
    // a ridge tent from above: the lit half, the shaded half, the ridge, a dark door, guy ropes
    const cl = mix(col, '#7c8a5a', 0.35);
    c.beginPath(); c.moveTo(-14, -9); c.lineTo(14, -9); c.lineTo(14, 0); c.lineTo(-14, 0); c.closePath(); c.fillStyle = shade(cl, 0.22); c.fill(); edge(); shadowOff();
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.lineTo(14, 10); c.lineTo(-14, 10); c.closePath(); c.fillStyle = shade(cl, -0.2); c.fill(); edge();
    c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.strokeStyle = shade(cl, -0.45); c.lineWidth = 1.3; c.stroke();
    c.beginPath(); c.moveTo(-14, -9); c.lineTo(-18, 0); c.lineTo(-14, 10); c.closePath(); c.fillStyle = '#2e2a22'; c.fill(); // the door end
    c.strokeStyle = 'rgba(60,50,40,.6)'; c.lineWidth = 0.5; c.beginPath(); for (const x of [-8, 0, 8]) { c.moveTo(x, -9); c.lineTo(x, -14); c.moveTo(x, 10); c.lineTo(x, 15); } c.stroke();
  } else if (kind === 'aapost' || kind === 'atpost') {
    // a sandbagged post: AA — a pair of launch tubes pointing up and a radar dish; AT — one fat launcher, ammunition crates
    c.beginPath(); c.ellipse(0, 1, 15, 13, 0, 0, Math.PI * 2); c.fillStyle = '#6d6250'; c.fill(); shadowOff();
    bags(15, 16);
    if (kind === 'aapost') {
      tube(-6, 6, 6, -8, 2.6, METAL); tube(-3, 8, 9, -6, 2.6, METAL); disc(-6, 6, 3, col);
      c.save(); c.translate(-8, -6); c.rotate(-0.5); c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); c.fillStyle = lt; c.fill(); edge(0.6); c.restore();
      disc(-8, -6, 1, dk);
    } else {
      tube(-8, 2, 9, 2, 4.4, METAL); disc(10, 2, 3, col); disc(-8, 2, 2.4, dk);
      crate(-5, -7, 2.4); crate(1, -7, 2.4);
    }
  } else if (kind === 'jeepshop' || kind === 'jeepaa' || kind === 'jeepat') {
    // a workshop hangar, a jeep parked by it; the armed ones have a white mark on the roof (a plane / a rocket)
    hangar(-15, -12, 26, 17, 5); shadowOff();
    c.save(); c.translate(15, 9); c.beginPath(); c.rect(-3.5, -6, 7, 12); c.fillStyle = shade(col, -0.1); c.fill(); edge(0.6); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-3.5, -6, 7, 3); c.restore();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.5;
    if (kind === 'jeepaa') { c.beginPath(); c.moveTo(-2, -9); c.lineTo(-1, -5); c.lineTo(3, -4); c.lineTo(3, -2.8); c.lineTo(-1, -3.2); c.lineTo(-1.5, 0); c.lineTo(0.5, 1); c.lineTo(0.5, 2); c.lineTo(-2, 1.3); c.lineTo(-4.5, 2); c.lineTo(-4.5, 1); c.lineTo(-2.5, 0); c.lineTo(-3, -3.2); c.lineTo(-7, -2.8); c.lineTo(-7, -4); c.lineTo(-3, -5); c.closePath(); c.fill(); c.stroke(); }
    if (kind === 'jeepat') { c.beginPath(); c.moveTo(-2, -9); c.lineTo(0, -6); c.lineTo(0, 0); c.lineTo(1.6, 2); c.lineTo(-5.6, 2); c.lineTo(-4, 0); c.lineTo(-4, -6); c.closePath(); c.fill(); c.stroke(); }
  } else if (kind === 'tankshop') {
    // a factory: a sawtooth roof in two halves, a tall chimney, a wide door
    block(-17, -13, 34, 22, 6, col); shadowOff();
    for (let i = 0; i < 5; i++) { const x = -17 + i * 6.8; c.beginPath(); c.rect(x, -13, 3.4, 22); c.fillStyle = 'rgba(0,0,0,.14)'; c.fill(); }
    c.beginPath(); c.rect(-8, 9.8, 16, 5); c.fillStyle = '#2b2a28'; c.fill();
    disc(12, -10, 3.6, '#8a8078'); disc(12, -10, 2, '#2a2622');
  } else if (kind === 'airfield') {
    // a runway with its centre line, a hangar and a control tower
    c.save(); c.rotate(-0.12); c.beginPath(); c.rect(-20, 2, 40, 9); c.fillStyle = '#5b5f62'; c.fill(); edge(); shadowOff();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8; c.setLineDash([2.5, 2.5]); c.beginPath(); c.moveTo(-18, 6.5); c.lineTo(18, 6.5); c.stroke(); c.setLineDash([]); c.restore();
    shadowOn(); hangar(-14, -15, 18, 10, 4); shadowOff();
    disc(11, -9, 4, STONE); disc(11, -9, 2.6, lt);
  } else if (kind === 'clinic') {
    // a white building, a coloured roof with a white cross
    block(-13, -11, 26, 18, 5, col, '#e9e6de'); shadowOff();
    c.fillStyle = '#fff'; c.fillRect(-2, -8, 4, 12); c.fillRect(-6, -4, 12, 4);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.4; c.strokeRect(-2, -8, 4, 12); c.strokeRect(-6, -4, 12, 4);
  } else if (kind === 'garage') {
    // a garage, a wrench on the roof, oil drums by the wall
    hangar(-14, -11, 24, 16, 5); shadowOff();
    c.save(); c.rotate(-0.7); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-1, -6, 2, 10); c.beginPath(); c.arc(0, -6.5, 2.6, 0, Math.PI * 2); c.fill(); c.fillStyle = shade(col, 0.05); c.fillRect(-0.9, -10, 1.8, 3.5); c.restore();
    barrel(14, 2); barrel(14, 7); barrel(17.5, 4.5);
  } else if (kind === 'depot') {
    // a supply shed and stacks of crates and barrels in the yard
    block(-15, -12, 16, 13, 4, col); shadowOff();
    for (const [x, y] of [[6, -8], [11, -8], [6, -3], [11, -3], [8.5, -5.5]]) crate(x, y, 2.4);
    barrel(-10, 9); barrel(-5.5, 9); barrel(-1, 9); crate(8, 8, 2.6);
  } else {
    c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Sim.STRUCTS[kind].icon, 0, 2); // (anything new: its emoji)
  }
  shadowOff(); artCache.set(key, pic); return pic;
}
// what a building sprite is drawn as on a canvas (dx: the picture's width in world units)
function drawBuilding(c, kind, col, x, y, px) { const pic = buildingPic(kind, col, px), w = pic.width / ART_RES; c.drawImage(pic, x - w / 2, y - w / 2, w, w); }
// the HQ's flag, waving (on the keep's pole)
function drawFlag(c, x, y, k, col) {
  const t = performance.now() / 260, px = x, py = y - 19 * k;
  c.beginPath(); c.moveTo(px, py);
  for (let i = 0; i <= 6; i++) c.lineTo(px + i * 1.6 * k, py + Math.sin(t + i * 0.8) * 0.9 * k * i / 6);
  for (let i = 6; i >= 0; i--) c.lineTo(px + i * 1.6 * k, py + 5 * k + Math.sin(t + i * 0.8) * 0.9 * k * i / 6);
  c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 0.6; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
}
// ---- smoke: grey puffs rising and drifting from damaged vehicles and buildings, wrecks, busy factories ----
const smoke = [], SMOKE_MAX = 500, WIND = { x: 7, y: -2 };
let artT = null;
function puff(x, y, dark, big = 1) {
  if (smoke.length >= SMOKE_MAX) smoke.shift();
  smoke.push({ x: x + (Math.random() - 0.5) * 4, y, t: s.t, life: 2.2 + Math.random() * 1.4, r: (3 + Math.random() * 2) * big, dark });
}
// every frame (from draw): new puffs for the time that passed in the game, then the smoke drawn
function drawSmoke(c) {
  const dt = artT === null || s.t < artT ? 0 : Math.min(0.1, s.t - artT); artT = s.t;
  if (dt > 0) {
    const vis = u => !s.fog || ((u.side === 'blue' || s.vis.blue.has(u.id)) && shownAt(u));
    for (const u of s.units) { const T = Sim.TYPES[u.type]; if (!T.air && CAR.has(u.type) && u.hp < T.hp * 0.5 && vis(u) && Math.random() < dt * 3) puff(u.x, u.y - 3, true); }
    for (const f of s.fallen) if (CAR.has(f.type) && s.t - f.t < 10 && (!s.fog || shownAt(f)) && Math.random() < dt * 5) puff(f.x, f.y - 2, true, 1.3);
    for (const n of s.nodes) {
      if (n.kind === 'drone' || !nodeShown(n)) continue;
      const S = Sim.STRUCTS[n.kind];
      if (n.hp < S.hp * 0.5 && Math.random() < dt * 4) puff(n.x + (Math.random() - 0.5) * 16, n.y - 6, true, 1.5);
      if (n.kind === 'tankshop' && n.prog > 0 && s.t >= n.ready && Math.random() < dt * 2) puff(n.x + 12, n.y - 12, false);
    }
  }
  const v = viewRect();
  for (let i = smoke.length - 1; i >= 0; i--) if (s.t - smoke[i].t > smoke[i].life || s.t < smoke[i].t) smoke.splice(i, 1);
  for (const p of smoke) {
    const a = (s.t - p.t) / p.life, x = p.x + WIND.x * (s.t - p.t), y = p.y + (WIND.y - 9) * (s.t - p.t);
    if (v && (x < v.x - 40 || x > v.x + v.w + 40 || y < v.y - 40 || y > v.y + v.h + 40)) continue;
    c.globalAlpha = (p.dark ? 0.5 : 0.34) * (1 - a) * Math.min(1, a * 6);
    c.fillStyle = p.dark ? '#3d3a36' : '#bdbab2'; ring(x, y, p.r * (1 + a * 2.4)); c.fill();
  }
  c.globalAlpha = 1;
}
// ---- scorch marks: where shells and blasts landed, dark earth that fades over SCORCH_T s ----
const scorch = [], SCORCH_T = 120, SCORCH_MAX = 300;
function drawScorch(c) {
  for (const f of s.fx) if (!f.scorched && !(f.wait > 0)) { f.scorched = true; if (f.size >= 14) { if (scorch.length >= SCORCH_MAX) scorch.shift(); scorch.push({ x: f.x, y: f.y, r: f.size * (f.size >= 26 ? 1.1 : 0.7), t: s.t, a: Math.random() * 3 }); } }
  const v = viewRect();
  for (let i = scorch.length - 1; i >= 0; i--) if (s.t - scorch[i].t > SCORCH_T || s.t < scorch[i].t) scorch.splice(i, 1);
  for (const p of scorch) {
    if (v && (p.x < v.x - 40 || p.x > v.x + v.w + 40 || p.y < v.y - 40 || p.y > v.y + v.h + 40)) continue;
    const k = 1 - (s.t - p.t) / SCORCH_T, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, `rgba(30,24,18,${0.55 * k})`); g.addColorStop(0.6, `rgba(45,36,26,${0.3 * k})`); g.addColorStop(1, 'rgba(45,36,26,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 0.8, p.a, 0, Math.PI * 2); c.fill();
  }
}
// ---- a muzzle flash where a shot leaves (the first moments of its flight), and a glow round big blasts ----
function drawFlashes(c) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const sh of s.shots) {
    const age = sh.dur + 0.12 - sh.life; if (age > 0.07) continue;
    const r = sh.kind === 'tank' ? 7 : sh.kind === 'inf' || sh.kind === 'jeep' ? 3 : 5, g = c.createRadialGradient(sh.x1, sh.y1, 0, sh.x1, sh.y1, r);
    g.addColorStop(0, 'rgba(255,245,200,.95)'); g.addColorStop(0.4, 'rgba(255,190,80,.6)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = g; ring(sh.x1, sh.y1, r); c.fill();
  }
  for (const f of s.fx) {
    if (f.wait > 0 || f.size < 14) continue;
    const a = f.life / f.max, r = f.size * 2.2, g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,170,60,${0.35 * a})`); g.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = g; ring(f.x, f.y, r); c.fill();
  }
  c.restore();
}

// ---- cloud shadows: big soft shapes drifting slowly over the map ----
const cloudPic = (() => {
  const w = 256, p = document.createElement('canvas'); p.width = p.height = w; const c = p.getContext('2d');
  let a = 7; const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 9; i++) {
    const x = w * (0.25 + r() * 0.5), y = w * (0.3 + r() * 0.4), R = w * (0.14 + r() * 0.16), g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
  }
  return p;
})();
const clouds = { seed: null, list: [] }, CLOUD_SPEED = 6, CLOUD_ALPHA = 0.34;
function drawClouds(c) {
  if (clouds.seed !== s.seed + ':' + s.W) {
    clouds.seed = s.seed + ':' + s.W; clouds.list = [];
    let a = s.seed * 7 + 3; const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const n = Math.max(4, Math.min(40, Math.round(s.W * s.H / 420000)));
    for (let i = 0; i < n; i++) clouds.list.push({ x: r() * (s.W + 800) - 400, y: r() * s.H, R: 260 + r() * 360, sq: 0.55 + r() * 0.35 });
  }
  const v = viewRect(), span = s.W + 800, t = reduceMotion ? 0 : s.t;
  c.globalAlpha = CLOUD_ALPHA;
  for (const k of clouds.list) {
    const x = ((k.x + t * CLOUD_SPEED + 400) % span + span) % span - 400, y = k.y - t * CLOUD_SPEED * 0.25 % s.H;
    const yy = ((y % s.H) + s.H) % s.H, w = k.R * 2, h = k.R * 2 * k.sq;
    if (v && (x + w / 2 < v.x || x - w / 2 > v.x + v.w || yy + h / 2 < v.y || yy - h / 2 > v.y + v.h)) continue;
    c.drawImage(cloudPic, x - w / 2, yy - h / 2, w, h);
  }
  c.globalAlpha = 1;
}
// ---- a vignette: the screen's edges a little darker (screen pixels; remade on resize) ----
const vig = { cv: document.createElement('canvas'), key: '' };
function drawVignette(c) {
  const key = cv.width + 'x' + cv.height;
  if (vig.key !== key) {
    vig.key = key; vig.cv.width = cv.width; vig.cv.height = cv.height;
    const g = vig.cv.getContext('2d'), R = Math.hypot(cv.width, cv.height) / 2, gr = g.createRadialGradient(cv.width / 2, cv.height / 2, R * 0.55, cv.width / 2, cv.height / 2, R);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,14,8,.32)'); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(vig.cv, 0, 0); c.restore();
}
// ---- night: the map dark blue, but light where there's light — our buildings (and the enemy's we can see), fires,
// explosions — cut out of the dark, with a warm glow ----
// (NIGHT_DARK: how much of the light the full night takes away)
const nightCv = document.createElement('canvas'), NIGHT_DARK = 0.72;
function drawNightLit(c) {
  const k = Sim.nightAt(s); if (!k) return;
  if (nightCv.width !== cv.width || nightCv.height !== cv.height) { nightCv.width = cv.width; nightCv.height = cv.height; }
  const g = nightCv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, nightCv.width, nightCv.height);
  g.fillStyle = `rgba(8,14,40,${(NIGHT_DARK * k).toFixed(3)})`; g.fillRect(0, 0, nightCv.width, nightCv.height);
  g.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy); g.globalCompositeOperation = 'destination-out';
  const lights = [];
  for (const n of s.nodes) if (n.kind !== 'drone' && nodeShown(n) && s.t >= n.ready) lights.push([n.x, n.y, n.kind === 'hq' ? 90 : 60, 0.8]);
  // (a blast lights its surroundings softly — no flash of the whole screen)
  for (const f of s.fx) if (!(f.wait > 0) && f.size >= 10) { const a = f.life / f.max; lights.push([f.x, f.y, f.size * 3, 0.45 * Math.min(1, (1 - a) * 5) * a]); }
  // (our own units carry a little light: vehicles more than soldiers)
  for (const u of s.units) if (u.side === 'blue' && !Sim.TYPES[u.type].air && (!s.fog || shownAt(u))) lights.push([u.x, u.y, CAR.has(u.type) ? 28 : 16, 0.5]);
  for (const f of s.fallen) if (CAR.has(f.type) && s.t - f.t < 10 && (!s.fog || shownAt(f))) lights.push([f.x, f.y, 34, 0.7 * (1 - (s.t - f.t) / 10)]);
  for (const [x, y, r, a] of lights) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(nightCv, 0, 0); c.restore();
  // and a warm glow over the lit spots
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of lights) { const gr = c.createRadialGradient(x, y, 0, x, y, r * 0.6); gr.addColorStop(0, `rgba(255,170,80,${0.18 * a * k})`); gr.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gr; ring(x, y, r * 0.6); c.fill(); }
  c.restore();
}

// ---- water: slow ripples moving over each lake on screen, and foam along its shore ----
function drawWater(c) {
  const v = viewRect(), t = reduceMotion ? 0 : performance.now() / 1000;
  for (const k of decor.lakes) {
    const l = k.l, R = Math.max(l.rx, l.ry);
    if (v && (l.x + R < v.x || l.x - R > v.x + v.w || l.y + R < v.y || l.y - R > v.y + v.h)) continue;
    c.save(); c.clip(k.body);
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1.2;
    for (let i = -4; i <= 4; i++) {
      const y0 = l.y + i * R / 4.5 + Math.sin(t * 0.4 + i) * 6;
      c.beginPath();
      for (let x = l.x - R; x <= l.x + R; x += 12) { const yy = y0 + Math.sin(x * 0.045 + t * 1.3 + i * 1.7) * 2.2; if (x === l.x - R) c.moveTo(x, yy); else c.lineTo(x, yy); }
      c.setLineDash([10 + (i & 1) * 8, 22]); c.lineDashOffset = -t * 14 * (i & 1 ? 1 : -1); c.stroke();
    }
    c.setLineDash([]); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.6; c.setLineDash([3, 7]); c.lineDashOffset = t * 6; c.stroke(k.body); c.setLineDash([]);
  }
}

// ---- the ground's grain: a fine speckle texture over the grass (in the cached ground picture) and a warm grade ----
const grain = (() => {
  const w = 96, p = document.createElement('canvas'); p.width = p.height = w; const c = p.getContext('2d');
  let a = 11; const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 700; i++) { const light = r() < 0.5; c.fillStyle = light ? 'rgba(255,255,230,.5)' : 'rgba(20,30,10,.5)'; const s2 = 0.6 + r() * 1.4; c.fillRect(r() * w, r() * w, s2, s2 * (0.6 + r())); }
  for (let i = 0; i < 60; i++) { c.strokeStyle = 'rgba(40,60,20,.35)'; c.lineWidth = 0.6; const x = r() * w, y = r() * w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 3); c.stroke(); }
  return p;
})();
function drawGrain(c, W, H) {
  c.save(); c.globalAlpha = 0.3; c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}
function drawGrade(c, W, H) {
  c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(255,214,150,.12)'; c.fillRect(0, 0, W, H); c.restore();
}

// ---- unit pictures (js/ui/sprites.js, made from art/ by tools/sprites.py): loaded once, recoloured per side (the
// picture's blue parts get the side's hue, keeping their light and shade; a wreck is the picture dark and grey) ----
const sprite = { img: {}, pic: new Map() };
for (const k in (typeof SPRITES === 'object' ? SPRITES : {})) {
  const im = new Image(); im.onload = () => { sprite.img[k] = im; sqKey = ''; artCache.clear(); if (k.startsWith('d_')) bg.key = ''; try { nameBuildMenu(); } catch (e) { /* not up yet */ } }; im.src = SPRITES[k].src;
}
function spritePic(k, col) {
  const key = k + col; let p = sprite.pic.get(key); if (p) return p;
  const im = sprite.img[k]; if (!im) return null;
  p = document.createElement('canvas'); p.width = im.width; p.height = im.height;
  const c = p.getContext('2d'); c.drawImage(im, 0, 0);
  const d = c.getImageData(0, 0, p.width, p.height), a = d.data, wreck = col === 'wreck', [hue] = wreck ? [0] : toHsl(...rgbOf(col));
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3] || (!a[i] && !a[i + 1] && !a[i + 2])) continue; // (clear, or the shadow)
    const [h, sat, l] = toHsl(a[i], a[i + 1], a[i + 2]);
    if (wreck) { const v = Math.round(l * 255 * 0.45 + 18); a[i] = v; a[i + 1] = v * 0.96; a[i + 2] = v * 0.9; continue; }
    if (sat < 0.3 || h < 190 || h > 260) continue; // only the team blue
    const [r, g, b] = fromHsl(hue, sat, l); a[i] = r; a[i + 1] = g; a[i + 2] = b;
  }
  c.putImageData(d, 0, 0); sprite.pic.set(key, p); return p;
}
// how long a unit's picture is on the map, in its size k (as long as the drawn glyph)
// (soldiers: by how wide they are across the shoulders, SPRITE_ACROSS — a launcher makes one much longer than the next)
const SPRITE_LEN = { jeep: 1.75, ajeep: 1.8, tjeep: 1.85, truck: 1.85, mech: 2, air: 2, tank: 1.9, dozer: 1.9, radio: 1.9, inf: 1, at: 1, aa: 1, med: 1 }, TURRET_K = 0.86;
const SPRITE_ACROSS = { inf: 1.9, at: 1.9, aa: 1.9, med: 1.9 };
// a building's picture: art/b_<kind> (the fake HQ looks just like the real one; the armed jeeps' workshops, the jeeps')
const BUILDING_PIC = new Proxy({}, { get: (_, kind) => { const k = kind === 'decoy' ? 'hq' : kind; return sprite.img['b_' + k] || !/^jeepa[at]$/.test(k) ? 'b_' + k : 'b_jeepshop'; } });
const hasSprite = type => type === 'tank' ? !!(sprite.img.tank_hull && sprite.img.tank_turret) : !!(SPRITE_LEN[type] && sprite.img[type]);
const hasBuildingPic = kind => !!(BUILDING_PIC[kind] && sprite.img[BUILDING_PIC[kind]]);
// a unit drawn from its picture when there is one (else the drawn glyph): turned to its heading, a tank's turret to
// where it aims, kicked back a little when it fires. col: the side's colour, or 'wreck'
function drawUnitPic(c, type, x, y, k, col, hd, aim, recoil = 0) {
  if (type !== 'tank') {
    const S = SPRITES[type], p = spritePic(type, col), sc = SPRITE_ACROSS[type] ? SPRITE_ACROSS[type] * k / S.h : SPRITE_LEN[type] * k / S.w;
    c.save(); c.translate(x, y); c.rotate(hd); c.drawImage(p, -S.w / 2 * sc, -S.h / 2 * sc, S.w * sc, S.h * sc); c.restore();
    return;
  }
  const H = SPRITES.tank_hull, T = SPRITES.tank_turret, sc = SPRITE_LEN.tank * k / H.w;
  c.save(); c.translate(x, y); c.rotate(hd);
  c.drawImage(spritePic('tank_hull', col), -H.w / 2 * sc, -H.h / 2 * sc, H.w * sc, H.h * sc);
  c.translate((H.px - H.w / 2) * sc, (H.py - H.h / 2) * sc); c.rotate(aim - hd); c.translate(-recoil * 0.12 * k, 0);
  const ts = sc * TURRET_K; c.drawImage(spritePic('tank_turret', col), -T.px * ts, -T.py * ts, T.w * ts, T.h * ts);
  c.restore();
}

// ---- where an order went: four arrows closing on the spot (green; red at an enemy), and the picked building ----
const PING_MS = 650;
function drawPings(c) {
  const now = performance.now(), px = 1 / view.css; pings = pings.filter(p => now - p.t < PING_MS);
  for (const p of pings) {
    const f = (now - p.t) / PING_MS, d = (8 + 22 * (1 - f) * (1 - f)) * px, a = f < 0.7 ? 1 : (1 - f) / 0.3, col = p.foe ? '#e8392e' : '#34b35a';
    c.save(); c.translate(p.x, p.y); c.globalAlpha = a; c.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(Math.PI / 4 + i * Math.PI / 2); c.translate(d, 0);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(9 * px, -6 * px); c.lineTo(9 * px, -2.5 * px); c.lineTo(15 * px, -2.5 * px); c.lineTo(15 * px, 2.5 * px); c.lineTo(9 * px, 2.5 * px); c.lineTo(9 * px, 6 * px); c.closePath();
      c.lineWidth = 3 * px; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); c.fillStyle = col; c.fill();
      c.restore();
    }
    c.globalAlpha = a * 0.6; c.strokeStyle = col; c.lineWidth = 2 * px; c.beginPath(); c.arc(0, 0, (4 + 10 * f) * px, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
}
function drawPicked(c) {
  const n = selNode != null && s.nodes.find(n => n.id === selNode && n.hp > 0); if (!n) return;
  const big = n.kind === 'hq' || n.kind === 'decoy', rx = big ? 34 : 24, ry = rx * 0.55, y = n.y + (big ? 12 : 8);
  c.save(); c.lineWidth = 2.2 / view.css; c.strokeStyle = 'rgba(255,255,255,.95)'; c.setLineDash([7 / view.css, 5 / view.css]); c.lineDashOffset = -performance.now() / 60 / view.css;
  c.beginPath(); c.ellipse(n.x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke(); c.restore();
}

// ---- scenery pictures (art/Background → d_tree*, d_bush*, d_rock*): drawn into the ground cache, only where it
// covers; each item picks its picture by a hash of where it stands (rock slabs only up the hills) ----
const SCENERY_WEIGHT = { d_rock3: 0 }; // (0 = left out: the new rock3 is a square slab, a floor tile on the map)
function drawScenery(c) {
  // (a picture's weight, 4 unless SCENERY_WEIGHT says)
  const pics = t => Object.keys(sprite.img).filter(k => k.startsWith('d_' + t)).sort().flatMap(k => Array(SCENERY_WEIGHT[k] ?? 4).fill(sprite.img[k]));
  const P = { tree: pics('tree'), bush: pics('bush'), rock: pics('rock') };
  if (!P.tree.length) return false;
  if (!P.bush.length) P.bush = P.tree;
  if (!P.rock.length) return false;
  const slab = sprite.img.d_rock3, low = P.rock.filter(im => im !== slab); // (rock3, a flat slab: only up the hills)
  if (!low.length) low.push(...P.rock);
  const x0 = bg.x0 - 20, y0 = bg.y0 - 20, x1 = bg.x0 + bg.w + 20, y1 = bg.y0 + bg.h + 20;
  for (const it of decor.rocks.items) {
    if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
    const L = it.t === 'rock' ? (it.hi && it.s >= 10 ? P.rock : low) : P[it.t], // (the slab only big: small, it's a grey square)
      im = L[it.v % L.length], w = it.s, h = w * im.height / im.width;
    it.im = im; if (it.gone) continue; // (cleared or run over: see sceneryTick)
    c.drawImage(im, it.x - w / 2, it.y - h / 2, w, h);
  }
  return true;
}

// ---- ground textures (art/Background → js/ui/tiles.js by tools/tiles.py): repeating patterns, TILE_W world units a
// tile. Grass is the ground, dry grass and bare earth the blotches, mud the lake shores, stony ground up the hills ----
const tile = { img: {}, pat: new WeakMap() }, TILE_W = 190, GROUND_TINT = 0.18, RELIEF_OVER_TILES = 0.62;
for (const k in (typeof TILES === 'object' ? TILES : {})) { const im = new Image(); im.onload = () => { tile.img[k] = im; bg.key = ''; }; im.src = TILES[k]; }
// a tile's pattern for a canvas (kept per context)
function tilePat(c, k) {
  const im = tile.img[k]; if (!im) return null;
  let m = tile.pat.get(c); if (!m) tile.pat.set(c, m = {});
  if (!m[k]) { m[k] = c.createPattern(im, 'repeat'); m[k].setTransform(new DOMMatrix().scale(TILE_W / im.width)); }
  return m[k];
}
// stony ground over the hills: the texture where the land is high, stronger the higher (a mask from the height grid,
// stretched smoothly like the relief), on a layer the size of the cache
const stony = { cv: document.createElement('canvas'), mask: null, key: null };
function drawStony(c, pat) {
  const E = s.elev;
  if (stony.key !== E) {
    stony.key = E; stony.mask = document.createElement('canvas'); stony.mask.width = E.w; stony.mask.height = E.h;
    const mc = stony.mask.getContext('2d'), img = mc.createImageData(E.w, E.h);
    for (let i = 0; i < E.g.length; i++) img.data[i * 4 + 3] = 255 * Math.max(0, Math.min(1, (E.g[i] - 2) / 5)) * 0.6;
    mc.putImageData(img, 0, 0);
  }
  const L = stony.cv, T = c.getTransform(); L.width = c.canvas.width; L.height = c.canvas.height;
  const g = L.getContext('2d'); g.setTransform(T);
  g.fillStyle = pat; g.fillRect(-1e5, -1e5, 2e5, 2e5);
  g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true;
  g.drawImage(stony.mask, -ELEV / 2, -ELEV / 2, E.w * ELEV, E.h * ELEV);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(L, 0, 0); c.restore();
}

// ---- scenery that's cleared (a building going up there) or run over (a tank): taken out of the ground picture,
// and drawn on top for a moment, sinking and fading ----
const scen = { grid: null, of: null, gone: [], seen: new Set(), next: 0, dirty: false }, SCEN_CELL = 64, SCEN_FADE = 1800;
function scenGrid() {
  if (scen.of === decor) return scen.grid;
  const G = new Map();
  for (const it of decor.rocks.items) { const k = Math.floor(it.x / SCEN_CELL) + ',' + Math.floor(it.y / SCEN_CELL); let l = G.get(k); if (!l) G.set(k, l = []); l.push(it); }
  scen.grid = G; scen.of = decor; scen.gone = []; scen.seen = new Set(); return G;
}
function scenNear(x, y, r, f) {
  const G = scenGrid();
  for (let i = Math.floor((x - r) / SCEN_CELL); i <= Math.floor((x + r) / SCEN_CELL); i++) for (let j = Math.floor((y - r) / SCEN_CELL); j <= Math.floor((y + r) / SCEN_CELL); j++) {
    const l = G.get(i + ',' + j); if (l) for (const it of l) if (!it.gone && Math.hypot(it.x - x, it.y - y) < r) f(it);
  }
}
function scenKill(it) { it.gone = performance.now(); if (it.im) scen.gone.push(it); scen.dirty = true; }
// every few frames: new buildings clear their ground; tanks crush what they drive over (only with the pictures in)
function sceneryTick() {
  if (!decor || !sprite.img.d_tree1) return;
  const now = performance.now(); if (now < scen.next) return; scen.next = now + 120;
  for (const n of s.nodes) if (!scen.seen.has(n.id) && n.kind !== 'drone' && nodeShown(n)) { scen.seen.add(n.id); scenNear(n.x, n.y, Sim.STRUCTS[n.kind].r * 1.5 + 18, scenKill); }
  for (const u of s.units) if (u.type === 'tank' && (u.side === 'blue' || !s.fog || s.vis.blue.has(u.id))) scenNear(u.x, u.y, SIZE.tank * 0.75, scenKill);
  // (the ground picture is painted again, at most twice a second)
  if (scen.dirty && now - (scen.painted || 0) > 500) { scen.dirty = false; scen.painted = now; bg.key = ''; }
}
function drawGoneScenery(c) {
  const now = performance.now();
  scen.gone = scen.gone.filter(it => now - it.gone < SCEN_FADE);
  for (const it of scen.gone) {
    const k = (now - it.gone) / SCEN_FADE, w = it.s * (1 - 0.35 * k), h = w * it.im.height / it.im.width * (1 - 0.5 * k);
    c.globalAlpha = 1 - k; c.drawImage(it.im, it.x - w / 2, it.y - h / 2 + it.s * 0.15 * k, w, h);
  }
  c.globalAlpha = 1;
}
