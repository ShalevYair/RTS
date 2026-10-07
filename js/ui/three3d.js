// UI: the 3D view — an experiment, F9 turns it on and off. The same game, drawn by Three.js (js/lib/three.min.js,
// loaded the first time it's asked for): the ground from the height grid (s.elev) as real hills, painted with the
// very picture the flat map paints (drawTerrain — the textures, lakes, roads, woods), lit by a sun from the
// north-west that throws the hills' shadows; the camera over the same cam as the flat map (centre and zoom), looking
// down at V3_PITCH. The units: their pictures (the flat map's, in the side's colour) lying on the ground, along its
// slope, the aircraft up in the air — each picture one draw for all of its kind; the tank's turret apart, turning to
// where it fires. Buildings, for now, plain boxes in the side's colour.
// The 3D canvas is under the flat map's (#gl, no pointer events): that one, cleared, still takes every click and
// draws the selection box and the arrow; a click's world point comes from v3World (along the ray to the hills), and
// a world point's place on screen from v3Screen (core.js: scrToWorld / worldToScr).
const V3 = { on: false, cv: null, r: null, scene: null, cam: null, sun: null, ground: null, of: null, pics: new Map(), nodes: null, rings: null };
// V3_LV: how high a contour line stands (world units — the shading's SHADE_Z, a little taller); V3_PITCH: the camera's
// look down (radians from level); V3_FOV: its upright field of view; V3_TEX: the ground picture's longer side, at most;
// V3_AIR: how high the aircraft fly; V3_FOOT: soldiers drawn this much bigger (as small as on the flat map they're
// lost on the slanting ground)
const V3_FALL = 12, V3_LV = 18, V3_PITCH = 50 * Math.PI / 180, V3_FOV = 40, V3_TEX = 4096, V3_AIR = 70, V3_FOOT = 1.6;
function v3Toggle() {
  if (V3.on) { v3Show(false); return; }
  if (window.THREE) { v3Show(true); return; }
  // (the library, then the models — tools/models.py; without them, the pictures)
  const load = (src, next) => { const sc = document.createElement('script'); sc.src = src; sc.onload = next; sc.onerror = src.includes('models') ? next : () => toast('3D ✖', innerWidth / 2, 80, 3000); document.head.appendChild(sc); };
  load('js/lib/three.min.js', () => load('js/ui/models.js', () => v3Show(true)));
}
function v3Show(on) {
  if (on && !V3.r) v3Init();
  if (on && !V3.r) return; // (no WebGL here)
  V3.on = on; V3.cv.hidden = !on;
  toast(on ? '3D' : '2D', innerWidth / 2, 80, 1200);
}
function v3Init() {
  const c = document.createElement('canvas'); c.id = 'gl'; c.hidden = true; cv.before(c); V3.cv = c;
  try { V3.r = new THREE.WebGLRenderer({ canvas: c, antialias: true }); } catch (e) { V3.r = null; c.remove(); toast('WebGL ✖', innerWidth / 2, 80, 3000); return; }
  const r = V3.r; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = V3.scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb8cc'); scene.fog = new THREE.Fog('#9fb8cc', 4000, 12000);
  V3.cam = new THREE.PerspectiveCamera(V3_FOV, 1, 2, 30000);
  // (the light: the sky all round, and the sun from the north-west, about 45° up — flat ground lit about as the flat
  // map's picture; in Three's physical units, hence the π)
  scene.add(V3.sky = new THREE.HemisphereLight('#e8f0ff', '#5a6048', 0.5 * Math.PI));
  const sun = V3.sun = new THREE.DirectionalLight('#fff4e0', 0.72 * Math.PI);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
  scene.add(sun, sun.target);
}
// ---- the screen ↔ the world ----
// a point of the stage → the world: along the ray from the camera to where it first goes under the hills (steps,
// then halving); past the map, the plain
function v3World(px, py) {
  const w = V3.w || 1, h = V3.h || 1, C = V3.cam;
  const o = C.position, d = new THREE.Vector3(px / w * 2 - 1, -(py / h * 2 - 1), 0.5).unproject(C).sub(o).normalize();
  const under = t => o.y + d.y * t <= Sim.elevAt(s, { x: o.x + d.x * t, y: o.z + d.z * t }) * V3_LV;
  const far = (o.y + 20) / Math.max(0.05, -d.y), step = Math.max(4, far / 300);
  let a = 0, b = -1;
  for (let t = step; t <= far * 1.5; t += step) { if (under(t)) { b = t; break; } a = t; }
  if (b < 0) { const t = o.y / Math.max(0.05, -d.y); return { x: o.x + d.x * t, y: o.z + d.z * t }; }
  for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (under(m)) b = m; else a = m; }
  return { x: o.x + d.x * b, y: o.z + d.z * b };
}
// a world point (on the ground there) → the stage
function v3Screen(x, y) {
  const p = new THREE.Vector3(x, Sim.elevAt(s, { x, y }) * V3_LV, y).project(V3.cam);
  return { x: (p.x + 1) / 2 * (V3.w || 1), y: (1 - p.y) / 2 * (V3.h || 1) };
}
// ---- the ground: a mesh over the height grid, a vertex a cell (the huge map: ~160 000), with the flat map's picture ----
function v3Ground() {
  if (V3.ground) { V3.scene.remove(V3.ground); V3.ground.geometry.dispose(); V3.ground.material.map.dispose(); V3.ground.material.dispose(); }
  const E = s.elev, nx = E.w, ny = E.h, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = Math.min(s.W, i * ELEV_CELL), y = Math.min(s.H, j * ELEV_CELL);
    pos[k * 3] = x; pos[k * 3 + 1] = E.g[k] * V3_LV; pos[k * 3 + 2] = y;
    uv[k * 2] = x / s.W; uv[k * 2 + 1] = 1 - y / s.H;
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6); let n = 0;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const tex = new THREE.CanvasTexture(v3Paint()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = V3.r.capabilities.getMaxAnisotropy();
  const m = new THREE.Mesh(g, v3Shaded(new THREE.MeshLambertMaterial({ map: tex }), true));
  m.castShadow = m.receiveShadow = true;
  V3.scene.add(m); V3.ground = m; V3.of = decor;
  // (round the map: plain grass to the horizon)
  if (!V3.skirt) {
    V3.skirt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), v3Shaded(new THREE.MeshLambertMaterial({ color: '#5d6e45' })));
    V3.skirt.rotation.x = -Math.PI / 2; V3.skirt.position.y = -2; V3.skirt.receiveShadow = true; V3.scene.add(V3.skirt);
  }
  V3.skirt.scale.set(s.W * 8, s.H * 8, 1); V3.skirt.position.x = s.W / 2; V3.skirt.position.z = s.H / 2;
}
// the whole map's picture, as the flat map paints its tiles — without the hills' painted light and shade and the
// contour lines (the real sun does the light now)
function v3Paint() {
  const k = Math.min(1, V3_TEX / Math.max(s.W, s.H)), w = Math.ceil(s.W * k), h = Math.ceil(s.H * k);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d', BG_CTX), R = decor.hills;
  if (R.shadeOf !== s.elev) ovPaint(); // (its shading worked out — drawTerrain would put it back otherwise)
  const keep = [bg.x0, bg.y0, bg.w, bg.h, bg.quick], shade0 = R.shade, cont0 = R.contours, none = document.createElement('canvas');
  none.width = none.height = 0;
  bg.x0 = 0; bg.y0 = 0; bg.w = s.W; bg.h = s.H; bg.quick = false; bg.noScen = v3HasScen(); R.shade = { dark: none, lite: none }; R.contours = { cells: new Map(), n: 0 };
  try {
    g.fillStyle = colors.ground; g.fillRect(0, 0, w, h); g.setTransform(k, 0, 0, k, 0, 0);
    const grass = tilePat(g, 'grass1');
    if (grass) { g.fillStyle = grass; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = GROUND_TINT; g.fillStyle = colors.ground; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = 1; }
    drawTerrain(g, s.W, s.H, s.W / 2);
  } finally { [bg.x0, bg.y0, bg.w, bg.h, bg.quick] = keep; bg.noScen = false; R.shade = shade0; R.contours = cont0; }
  return out;
}
// ---- the units ----
// a kind's picture in a side's colour, as a flat piece lying on the ground: { tex, w, h (world units: along its
// heading, across), ox, oy (where its middle sits from the unit — the tank's turret: its pivot) }. The flat map's own
// picture (spritePic; the tank: hull and turret apart), or, without one, its glyph drawn once.
function v3Pic(type, side) {
  const key = type + ':' + side; let P = V3.pics.get(key); if (P) return P;
  const base = type === 'turret' ? 'tank' : type, T0 = Sim.TYPES[base] || {}, col = side === 'wreck' ? 'wreck' : colors[side] || '#9a9a9a', k = (SIZE[base] || 8) * (CAR.has(base) || T0.air ? 1 : V3_FOOT);
  let img, w, h, ox = 0, oy = 0;
  if (type === 'tank' || type === 'turret') {
    const H = SPRITES.tank_hull, T = SPRITES.tank_turret, sc = SPRITE_LEN.tank * k / H.w;
    if (type === 'tank') { img = spritePic('tank_hull', col); w = H.w * sc; h = H.h * sc; }
    else { const ts = sc * TURRET_K; img = spritePic('tank_turret', col); w = T.w * ts; h = T.h * ts; ox = (T.w / 2 - T.px) * ts; oy = (T.h / 2 - T.py) * ts; }
  } else if (hasSprite(type)) {
    const S = SPRITES[type], sc = SPRITE_ACROSS[type] ? SPRITE_ACROSS[type] * k / S.h : SPRITE_LEN[type] * k / S.w;
    img = spritePic(type, col); w = S.w * sc; h = S.h * sc;
  } else {
    const N = 128, G = 40; img = document.createElement('canvas'); img.width = img.height = N;
    glyph(img.getContext('2d'), type, N / 2, N / 2, G, col === 'wreck' ? '#3b3833' : col, colors.outline, 0, 0); w = h = N / G * k;
  }
  return v3Sheet(key, img, w, h, ox, oy);
}
// a picture as a flat piece facing up (its right = the front, its top = the world's north), all of its kind in one
// InstancedMesh: { mesh, w, h, ox, oy, n }
function v3Sheet(key, img, w, h, ox = 0, oy = 0) {
  const tex = new THREE.CanvasTexture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45 }), 64);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3); // (a tint each: white = none)
  V3.scene.add(mesh);
  const P = { mesh, w, h, ox, oy, n: 0 }; V3.pics.set(key, P); return P;
}
// one more of a picture (col: a tint over it — a building being put up, or remembered — else none): the mesh grown
// (a new, bigger one) when full
function v3Put(P, m, col) {
  if (P.n >= P.mesh.instanceMatrix.count) {
    const old = P.mesh, big = new THREE.InstancedMesh(old.geometry, old.material, old.instanceMatrix.count * 2);
    big.castShadow = true; big.receiveShadow = !P.flat; big.instanceMatrix.setUsage(THREE.DynamicDrawUsage); big.frustumCulled = false;
    for (let i = 0; i < P.n; i++) { old.getMatrixAt(i, v3Tmp.g); big.setMatrixAt(i, v3Tmp.g); old.getColorAt(i, v3Tmp.c); big.setColorAt(i, v3Tmp.c); }
    V3.scene.remove(old); old.dispose(); V3.scene.add(big); P.mesh = big;
  }
  P.mesh.setColorAt(P.n, col || v3Tmp.white);
  P.mesh.setMatrixAt(P.n++, m);
}
let v3Tmp = {};
// where a ground unit lies: on the slope there (the ground's normal), turned to its heading
function v3Lay(x, y, hd, lift, w, h, ox, oy, out, sy = 1) {
  if (!v3Tmp.n) Object.assign(v3Tmp, { c: new THREE.Color(), white: new THREE.Color(1, 1, 1), n: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), yaw: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), off: new THREE.Vector3(), g: new THREE.Matrix4() });
  const e = 4, hx = (Sim.elevAt(s, { x: x + e, y }) - Sim.elevAt(s, { x: x - e, y })) * V3_LV / (2 * e), hz = (Sim.elevAt(s, { x, y: y + e }) - Sim.elevAt(s, { x, y: y - e })) * V3_LV / (2 * e);
  const t = v3Tmp; t.n.set(-hx, 1, -hz).normalize();
  t.yaw.setFromAxisAngle(t.up, -hd); t.q.setFromUnitVectors(t.up, lift ? t.up : t.n).multiply(t.yaw);
  t.off.set(ox, 0, oy).applyQuaternion(t.q);
  t.p.set(x + t.off.x, Sim.elevAt(s, { x, y }) * V3_LV + 0.6 + lift + t.off.y, y + t.off.z);
  return out.compose(t.p, t.q, t.sc.set(w, sy, h));
}
// ---- 3D models (art/models/*.glb → MODELS, tools/models.py): a kind's hull and turret, each two meshes — its main
// paint tinted with the side's colour (V3_TEAM of it), the rest as it is. Front +X, length 1, so scaled by V3_LEN ×
// its size. A tank's turret turns on its pivot to where it fires; a wreck: dark. ----
const V3_DRONE = 0.9, V3_DEAD = 0.7, V3_ROTOR = 14, V3_POS_Q = 16000, V3_MAN = 24, V3_STRIDE = 4; // (V3_MAN: a soldier's height, world units — taller than true to a tank, as on the flat map, or from above it was a dot; V3_STRIDE: the way it walks for each pose) // (a helicopter's rotor, radians a second)
const V3_LEN = { tank: 1.75, jeep: 1.25, ajeep: 1.25, tjeep: 1.25, air: 1.3, tanker: 1.3, heli: 1.2, gunship: 1.2, lift: 1.3, how: 2.2, mlrs: 2.4, ssm: 2.6, arrow: 2.6, dome: 2.6, truck: 2.0, fueltruck: 2.0, watertruck: 2.0, radio: 1.9, mech: 2.0, dozer: 1.7 }, V3_TEAM = 0.38;
const v3HasModel = type => typeof MODELS === 'object' && !!MODELS[type];
function v3Model(type, part, side) {
  const key = 'm:' + type + ':' + part + ':' + side; let P = V3.pics.get(key); if (P) return P;
  const mesh = new THREE.InstancedMesh(v3Geo(type, part, side), V3.vcol || (V3.vcol = new THREE.MeshLambertMaterial({ vertexColors: true })), 64);
  mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3);
  V3.scene.add(mesh); P = { mesh, w: 1, h: 1, ox: 0, oy: 0, n: 0 }; V3.pics.set(key, P); return P;
}
// a model's part as one geometry (its main paint mixed with the side's colour), made once
function v3Geo(type, part, side) {
  const key = type + ':' + part + ':' + side, G = V3.geo || (V3.geo = new Map()); if (G.has(key)) return G.get(key);
  const M = MODELS[type].parts[part], geo = [], sc = new THREE.Color(colors[side] || '#888888'); // (in the linear colours the light uses)
  if (M.pos) { // (a track's later pose: only its points — the first pose's normals and colours)
    const b = atob(M.pos), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    const Q = MODELS[type].q || V3_POS_Q, g = v3Geo(type, part.replace(/\d+$/, '0'), side).clone(); const q = new Int16Array(u8.buffer), f = new Float32Array(q.length); for (let i = 0; i < q.length; i++) f[i] = q[i] / Q; g.setAttribute('position', new THREE.BufferAttribute(f, 3)); G.set(key, g); return g; // (Int16 / its scale)
  }
  const TK = MODELS[type].teamK ?? V3_TEAM; // (how much of the side's colour in its paint)
  const Q = MODELS[type].q || V3_POS_Q; // (Int16 per unit of place: smaller for a tall model, so it fits)
  for (const k of ['team', 'rest']) {
    if (!M[k]) continue;
    // (12 bytes a point, tools/models.py `pack`: the place Int16 / V3_POS_Q, the normal Int8, the colour Uint8)
    const b = atob(M[k]), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    const dv = new DataView(u8.buffer), n = u8.length / 12, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
      pos[i * 3 + j] = dv.getInt16(i * 12 + j * 2, true) / Q; nrm[i * 3 + j] = dv.getInt8(i * 12 + 6 + j) / 127;
      const c = u8[i * 12 + 9 + j] / 255, s2 = j === 0 ? sc.r : j === 1 ? sc.g : sc.b;
      col[i * 3 + j] = k === 'team' && side !== 'wreck' ? c * (1 - TK) + s2 * TK * 0.55 : c;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.push(g);
  }
  const all = geo.length > 1 ? v3Merge(geo) : geo[0]; G.set(key, all); return all;
}
// (two geometries of the same attributes, one after the other)
function v3Merge(gs) {
  const g = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'color']) {
    const parts = gs.map(x => x.getAttribute(a).array), out = new Float32Array(parts.reduce((s2, x) => s2 + x.length, 0)); let o = 0;
    for (const x of parts) { out.set(x, o); o += x.length; } g.setAttribute(a, new THREE.BufferAttribute(out, 3));
  }
  return g;
}
// a model on the ground at (x, y), its hull to hd, its turret (if any) to aim; tint: a wreck's darkness
// how far a unit's tracks have gone since it was first seen: [left, right] — forward along its heading, and a turn
// moves each side by its distance from the middle (MODELS[type].track: zl, zr)
// a soldier walking: the pose for how far it has gone (one stride over all POSES, V3_STRIDE each), null standing
function v3Walk(u) {
  const D = MODELS[u.type]; if (!D.poses) return null;
  const R = V3.walk || (V3.walk = new Map()); let r = R.get(u.id);
  if (!r) R.set(u.id, r = { x: u.x, y: u.y, d: 0, at: -9 });
  const d = Math.hypot(u.x - r.x, u.y - r.y);
  if (d < 40) { r.d += d; if (d > 0.01) r.at = s.t; } // (not a jump: one just shown again)
  r.x = u.x; r.y = u.y;
  return s.t - r.at > 0.3 ? null : 'pose' + (Math.floor(r.d / V3_STRIDE) % D.poses);
}
function v3Run(u, hd) {
  const K = MODELS[u.type].track; if (!K) return null;
  const R = V3.run || (V3.run = new Map()), L = (SIZE[u.type] || 10) * (V3_LEN[u.type] || 1.6); let r = R.get(u.id);
  if (!r) R.set(u.id, r = { x: u.x, y: u.y, hd, l: 0, r: 0 });
  const d = (u.x - r.x) * Math.cos(hd) + (u.y - r.y) * Math.sin(hd), da = Math.atan2(Math.sin(hd - r.hd), Math.cos(hd - r.hd));
  if (Math.abs(d) < 40 && Math.abs(da) < 1) { r.l += d - K.zl * L * da; r.r += d - K.zr * L * da; } // (not a jump: a unit just shown again, turned round at once)
  r.x = u.x; r.y = u.y; r.hd = hd; r.seen = s.t; return [r.l, r.r];
}
// (run: how far each track has gone, world units — [left, right]; the pose shown for it, so they run)
// (lift: in the air, level — aircraft; a helicopter's rotor is its turret, `aim` turning it round)
// (len: its length, if not by its kind's size — a building; rise: of its height — a building going up)
// (pose: a soldier's walking pose, v3Walk — its length then by V3_MAN, its height)
function v3PutModel(type, side, x, y, hd, aim, m, tint, run, lift = 0, len = 0, rise = 1, pose = null) {
  const D = MODELS[type], L = len || (D.poses ? V3_MAN / D.size[1] : (SIZE[type] || 10) * (V3_LEN[type] || 1.6)), H = v3Model(type, pose || 'hull', side);
  v3Put(H, v3Lay(x, y, hd, lift, L, L, 0, 0, m, L * rise), tint);
  const K = D.track;
  if (K) ['L', 'R'].forEach((k, i) => { const r = run ? run[i] / (K.cycle * L) : 0, f = Math.floor((r - Math.floor(r)) * K.frames) % K.frames; v3Put(v3Model(type, 'track' + k + f, 'track'), m, tint); });
  if (!D.parts.turret) return;
  const t = v3Tmp, T = v3Model(type, 'turret', side), pv = D.pivot || [0, 0];
  t.off.set(pv[0] * L, 0, pv[1] * L).applyQuaternion(t.q); t.p.set(t.p.x + t.off.x, t.p.y + t.off.y, t.p.z + t.off.z);
  t.yaw.setFromAxisAngle(t.up, -aim); t.q.setFromUnitVectors(t.up, t.n).multiply(t.yaw);
  v3Put(T, m.compose(t.p, t.q, t.sc.set(L, L, L)), tint);
}
function v3Units() {
  const m = v3Tmp.m || (v3Tmp.m = new THREE.Matrix4()), rings = [];
  // (what the player sees, as the flat map: ours where the picture is exact, theirs where seen)
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (s.fog && !((u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u))) continue;
    const T = Sim.TYPES[u.type], lift = T.air ? V3_AIR : 0, hd = u.hd || 0;
    if (v3HasModel(u.type)) {
      const man = !!MODELS[u.type].poses, pose = v3Walk(u), face = man && s.t - u.lastFire < 3 ? u.aim : hd; // (a soldier faces where it fires, and stands upright)
      v3PutModel(u.type, u.side, u.x, u.y, face, T.hover || u.type === 'lift' ? performance.now() / 1000 * V3_ROTOR + u.id : s.t - u.lastFire < 3 ? u.aim : hd, m, null, T.air || man ? null : v3Run(u, hd), man ? 0.01 : lift, 0, 1, pose);
    }
    else { const P = v3Pic(u.type, u.side); v3Put(P, v3Lay(u.x, u.y, hd, lift, P.w, P.h, 0, 0, m)); }
    if (u.type === 'tank' && hasSprite('tank') && !v3HasModel('tank')) { // (the turret, turned to where it fires)
      const R = v3Pic('turret', u.side), H = SPRITES.tank_hull, k = SIZE.tank, sc = SPRITE_LEN.tank * k / H.w;
      const aim = s.t - u.lastFire < 3 ? u.aim : hd, px = (H.px - H.w / 2) * sc, py = (H.py - H.h / 2) * sc;
      const cx = u.x + Math.cos(hd) * px - Math.sin(hd) * py, cy = u.y + Math.sin(hd) * px + Math.cos(hd) * py;
      v3Put(R, v3Lay(cx + Math.cos(aim) * R.ox - Math.sin(aim) * R.oy, cy + Math.sin(aim) * R.ox + Math.cos(aim) * R.oy, aim, 0.4, R.w, R.h, 0, 0, m));
    }
    if (u.side === 'blue' && isSel(u.squad) && u.type !== 'dozer') rings.push({ x: u.x, y: u.y, air: T.air, r: (SIZE[u.type] || 8) * (CAR.has(u.type) || T.air ? 0.75 : V3_FOOT * 0.9) });
  }
  // (the fallen, V3_FALL s: a vehicle's burnt-out wreck, its turret knocked askew; a soldier, dark — as the flat map)
  const tint = v3Tmp.ft || (v3Tmp.ft = new THREE.Color());
  for (const f of s.fallen) {
    const age = s.t - f.t, T = Sim.TYPES[f.type]; if (age > V3_FALL || T.air || (s.fog && !shownAt(f))) continue;
    const car = CAR.has(f.type), dim = tint.setScalar(car ? 0.9 - 0.4 * age / V3_FALL : 0.45);
    if (!car && v3HasModel(f.type) && MODELS[f.type].parts.dead) { v3PutModel(f.type, f.side, f.x, f.y, f.hd + 0.3, 0, m, tint.setScalar(0.7), null, 0, V3_DEAD * V3_MAN / MODELS[f.type].size[1], 1, 'dead'); continue; } // (a soldier lying on its side — smaller: seen from above, lying at full length it looked twice one standing)
    if (car && v3HasModel(f.type)) { v3PutModel(f.type, 'wreck', f.x, f.y, f.hd + 0.3, f.hd + 1.2, m, tint.setScalar(0.35 - 0.15 * age / V3_FALL)); continue; }
    const P = v3Pic(f.type, car ? 'wreck' : f.side);
    v3Put(P, v3Lay(f.x, f.y, f.hd + 0.3, 0, P.w, P.h, 0, 0, m), dim);
    if (f.type === 'tank' && hasSprite('tank')) { const R = v3Pic('turret', 'wreck'), a = f.hd + 1.2; v3Put(R, v3Lay(f.x + Math.cos(a) * R.ox, f.y + Math.sin(a) * R.ox, a, 0.4, R.w, R.h, 0, 0, m), dim); }
  }
  return rings;
}
// (picked: a thin light ring round each, on the ground)
function v3Rings(rings) {
  if (!V3.rings) {
    const g = new THREE.RingGeometry(0.86, 1, 40); g.rotateX(-Math.PI / 2);
    V3.rings = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#e8fff0', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }), 4000);
    V3.rings.frustumCulled = false; V3.rings.renderOrder = 10; V3.scene.add(V3.rings); // (over the pictures: on the ground they cut through them)
  }
  let n = 0; const o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D());
  for (const g of rings) {
    if (n >= 4000) break;
    o.position.set(g.x, Sim.elevAt(s, g) * V3_LV + 1 + (g.air ? V3_AIR : 0), g.y); o.scale.set(g.r, 1, g.r); o.updateMatrix(); V3.rings.setMatrixAt(n++, o.matrix);
  }
  V3.rings.count = n; V3.rings.instanceMatrix.needsUpdate = true;
}
// ---- the buildings: the flat map's picture of each (buildingPic, in the holder's colour) lying on the ground; going
// up — dark, lighter as the work is done; remembered (the enemy's, out of sight) — dim. Under each, an unseen block
// of about its size that throws the sun's shadow (so a flat picture still stands). Drones: their picture up in the air,
// turning slowly. ----
const V3_BLD_K = 1.0; // (a building's model: its length, of its picture's)
const V3_BLOCK = { hq: 0.9, fhq: 0.6, decoy: 0.9, tower: 3.2, antenna: 2.4, radar: 1.4, power: 1.1 }, V3_SITE = 0.3, V3_MEM = 0.55;
function v3Building(kind, col, px) {
  const own = BUILDING_PIC[kind], bare = !!(own && sprite.img[own]), key = 'b:' + kind + col + px;
  const P = V3.pics.get(key); if (P) return P;
  const pic = buildingPic(kind, col, px, bare);
  // (not darkened by its own block's shadow, which falls on it too)
  const S = v3Sheet(key, pic, pic.width / ART_RES, pic.height / ART_RES); S.mesh.receiveShadow = false; S.flat = true; return S;
}
function v3Nodes(rings) {
  if (!V3.blocks) {
    V3.blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), 800);
    V3.blocks.castShadow = true; V3.blocks.frustumCulled = false; V3.scene.add(V3.blocks);
  }
  if (!V3.plinth) { // (under a building's model on a slope: a mound of earth down to the ground, wider at the foot — a
    // straight concrete block looked like a pillar on a steep hill)
    const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * 1.6, 1, 4, 1); g.rotateY(Math.PI / 4);
    V3.plinth = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x8a7c5c, flatShading: true }), 400);
    V3.plinth.receiveShadow = V3.plinth.castShadow = true; V3.plinth.frustumCulled = false; V3.scene.add(V3.plinth);
  }
  const m = v3Tmp.m, o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), tint = v3Tmp.tint || (v3Tmp.tint = new THREE.Color());
  let nb = 0, np = 0;
  const put = (kind, col, x, y, R, px, k, side, grow = 1) => {
    // (a model of it, if there is one — art/models/b_<kind>.glb: facing the enemy, going up as it's built)
    // (level, between the middle height of its corners and the highest — a little into the slope above — on a plinth down to the lowest:
    // tilted with the ground it leaned, and at the highest corner it stood on a tower)
    if (v3HasModel('b_' + kind)) {
      const L = px * V3_BLD_K, W = MODELS['b_' + kind].size[2] * L, g = (dx, dy) => Sim.elevAt(s, { x: x + dx, y: y + dy }) * V3_LV;
      const hs = [g(-L / 2, -W / 2), g(L / 2, -W / 2), g(-L / 2, W / 2), g(L / 2, W / 2), g(0, 0)], avg = hs.reduce((a, b) => a + b) / hs.length, top = avg + 0.6 * (Math.max(...hs) - avg), low = Math.min(...hs);
      v3PutModel('b_' + kind, side || 'none', x, y, side === 'red' ? Math.PI : 0, 0, m, k < 1 ? tint.setScalar(Math.max(0.35, k)) : null, null, top - hs[4] + 0.01, L, Math.max(0.12, grow));
      if (top - low > 0.5 && np < 400) { o.position.set(x, (top + low) / 2 - 0.5, y); o.rotation.set(0, 0, 0); o.scale.set(L * 0.97, top - low + 1.6, W * 0.97); o.updateMatrix(); V3.plinth.setMatrixAt(np++, o.matrix); }
      return;
    }
    const P = v3Building(kind, col, px);
    v3Put(P, v3Lay(x, y, 0, 0, P.w, P.h, 0, 0, m), k < 1 ? tint.setScalar(k) : null);
    if (nb < 800) { const hgt = R * (V3_BLOCK[kind] || 0.75) * Math.min(1, k); o.position.set(x, Sim.elevAt(s, { x, y }) * V3_LV + hgt / 2, y); o.scale.set(R * 1.3, hgt, R * 1.3); o.updateMatrix(); V3.blocks.setMatrixAt(nb++, o.matrix); }
  };
  for (const n of s.nodes) {
    if (n.hp <= 0 || !nodeShown(n)) continue;
    const col = colors[n.side];
    if (n.kind === 'drone') { // (up in the air, turning slowly; the model's props whirl — a pose each frame)
      if (v3HasModel('drone')) { v3PutModel('drone', n.side, n.x, n.y, s.t * 0.35 + n.id, 0, m, null, null, V3_AIR * 1.4, DRONE_PX * V3_DRONE, 1, 'spin' + ((V3.frame = (V3.frame || 0) + 1) + n.id) % 4); continue; }
      if (!sprite.img.drone) continue;
      let P = V3.pics.get('drone:' + n.side);
      if (!P) { const D = SPRITES.drone, sc = DRONE_PX / Math.max(D.w, D.h); P = v3Sheet('drone:' + n.side, spritePic('drone', col), D.w * sc, D.h * sc); }
      v3Put(P, v3Lay(n.x, n.y, s.t * 0.35 + n.id, V3_AIR * 1.4, P.w, P.h, 0, 0, m)); continue;
    }
    const S = Sim.STRUCTS[n.kind], on = s.t >= n.ready, site = Number.isFinite(n.work) && !on;
    const grow = on || (n.kind === 'hq' && !site) ? 1 : site ? Math.min(1, n.work / Math.max(0.01, n.need)) : Math.max(0, Math.min(1, (s.t - n.t0) / Math.max(0.01, n.ready - n.t0)));
    put(n.kind, col, n.x, n.y, S.r, pxOf(n.kind), on ? 1 : V3_SITE + (1 - V3_SITE) * grow, n.side, grow);
    if (selNode === n.id) rings.push({ x: n.x, y: n.y, r: S.r + 10 });
  }
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { const g = s.memNodes.blue[id]; put(g.kind, colors.red, g.x, g.y, Sim.STRUCTS[g.kind].r, pxOf(g.kind), V3_MEM, 'red'); }
  if (s.posts) for (const p of s.posts) { const R = Sim.POSTS[p.kind].r; put(p.kind, postCol(p), p.x, p.y, R, Math.round(R * 2.4), s.fog && !postSeen(p) ? V3_MEM : 1, p.side); if (selPost === p) rings.push({ x: p.x, y: p.y, r: R + 10 }); }
  V3.blocks.count = nb; V3.blocks.instanceMatrix.needsUpdate = true; V3.plinth.count = np; V3.plinth.instanceMatrix.needsUpdate = true;
}
// ---- fire and smoke: bits of light and smoke, each a soft round picture facing the camera (or, a scorch mark, lying
// on the ground), all of a kind in one InstancedMesh with its own colour and see-through-ness (aCol) — the light ones
// added (they glow), the smoke laid over. The same things as the flat map: shots in flight (a bright head and a
// fading tail; a missile's white trail; the artillery's shells in an arc), muzzle flashes, blasts (a fireball, a
// glow round the big ones), the smoke (smokeTick: hurt vehicles, wrecks, chimneys, after a blast — rising and
// drifting with the wind), scorch marks where blasts landed (scorchTick), the long-range missiles' arc. ----
const V3_FX_MAX = 6000;
function v3SoftPic(stops) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  for (const [k, col] of stops) r.addColorStop(k, col);
  g.fillStyle = r; g.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(c); return t;
}
function v3Bill(add, flat, tex) {
  const geo = new THREE.PlaneGeometry(1, 1), col = new THREE.InstancedBufferAttribute(new Float32Array(V3_FX_MAX * 4), 4);
  col.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aCol', col);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec4 aCol; varying vec4 vCol; varying vec2 vUv;
      void main() { vCol = aCol; vUv = uv; vec3 c = instanceMatrix[3].xyz; float k = length(instanceMatrix[0].xyz);
        ${flat ? 'gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(position.x, 0.0, -position.y) * k, 1.0);'
               : 'vec4 mv = modelViewMatrix * vec4(c, 1.0); mv.xy += position.xy * k; gl_Position = projectionMatrix * mv;'} }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vCol; varying vec2 vUv;
      void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a); }`,
  });
  const m = new THREE.InstancedMesh(geo, mat, V3_FX_MAX); m.frustumCulled = false; m.renderOrder = add ? 6 : 5; m.count = 0;
  V3.scene.add(m); return { m, col, n: 0 };
}
function v3FxInit() {
  const light = v3SoftPic([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']]);
  const puffT = v3SoftPic([[0, 'rgba(255,255,255,.9)'], [0.55, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
  V3.fx = { glow: v3Bill(true, false, light), smoke: v3Bill(false, false, puffT), mark: v3Bill(false, true, puffT) };
}
// one more: at (x, h, y) world, d across, colour [r, g, b] (0–1), a
function v3Dot(B, x, h, y, d, r, g, b, a) {
  if (B.n >= V3_FX_MAX || a <= 0.004) return;
  const o = v3Tmp.fm || (v3Tmp.fm = new THREE.Matrix4());
  o.makeScale(d, d, d); o.setPosition(x, h, y); B.m.setMatrixAt(B.n, o);
  const k = B.n * 4, A = B.col.array; A[k] = r; A[k + 1] = g; A[k + 2] = b; A[k + 3] = a; B.n++;
}
const v3Gnd = (x, y) => Sim.elevAt(s, { x, y }) * V3_LV;
// weapons that fire at aircraft (their shot ends up in the air) / from aircraft
const V3_UP = new Set(['aa', 'ajeep', 'arrow', 'dome']), V3_FROM_AIR = new Set(['air', 'heli', 'gunship']);
function v3Fx() {
  if (!V3.fx) v3FxInit();
  const F = V3.fx; for (const B of Object.values(F)) B.n = 0;
  smokeTick(); scorchTick();
  // shots in flight
  for (const sh of s.shots) {
    const age = sh.dur + 0.12 - sh.life, k = Math.min(1, age / sh.dur);
    const h1 = v3Gnd(sh.x1, sh.y1) + (V3_FROM_AIR.has(sh.kind) ? V3_AIR : 4), h2 = v3Gnd(sh.x2, sh.y2) + (V3_UP.has(sh.kind) ? V3_AIR : 3);
    const L = Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1), arc = sh.kind === 'how' || sh.kind === 'mlrs' ? L * 0.25 : 0;
    const at = f => { f = Math.max(0, Math.min(1, f)); return [sh.x1 + (sh.x2 - sh.x1) * f, h1 + (h2 - h1) * f + Math.sin(Math.PI * f) * arc, sh.y1 + (sh.y2 - sh.y1) * f]; };
    if (age < 0.07) { const r = sh.kind === 'tank' || sh.kind === 'how' ? 16 : sh.kind === 'inf' || sh.kind === 'jeep' ? 6 : 10; v3Dot(F.glow, sh.x1, h1, sh.y1, r, 1, 0.85, 0.5, 0.9); } // (the muzzle flash)
    if (k >= 1) continue;
    const missile = sh.kind === 'air' || sh.kind === 'heli' || sh.kind === 'arrow' || sh.kind === 'dome' || sh.kind === 'aa' || sh.kind === 'at' || sh.kind === 'ajeep' || sh.kind === 'tjeep';
    const big = sh.kind === 'tank' || sh.kind === 'how' || sh.kind === 'mlrs', len = Math.min(1, (big ? 22 : 12) / Math.max(1, L));
    if (missile) { // (a white trail behind, a hot head)
      for (let i = 1; i <= 6; i++) { const p = at(k - len * 2.5 * i / 6); v3Dot(F.smoke, p[0], p[1], p[2], 3 + i * 0.8, 0.85, 0.85, 0.82, 0.35 * (1 - i / 7)); }
      const p = at(k); v3Dot(F.glow, p[0], p[1], p[2], 7, 1, 0.7, 0.3, 1);
    } else { // (a tracer: a bright head, a fading tail)
      for (let i = 0; i <= 4; i++) { const p = at(k - len * i / 4); v3Dot(F.glow, p[0], p[1], p[2], (big ? 6 : 3.5) * (1 - i * 0.12), 1, big ? 0.65 : 0.85, big ? 0.3 : 0.45, (1 - i / 5) * 0.9); }
    }
  }
  // blasts: a fireball (white → orange), a wide glow round the big ones; a little smoke left behind (as the flat map)
  for (const f of s.fx) {
    if (f.wait > 0) continue;
    const t = 1 - f.life / f.max, a = 1 - t, R = f.size, r = R * (0.35 + 0.65 * Math.sqrt(t)), h = v3Gnd(f.x, f.y);
    if (!f.smoked && R >= 8) { f.smoked = true; const n = R >= 26 ? 3 : R >= 18 ? 2 : 1; for (let i = 0; i < n; i++) puff(f.x + (Math.random() - 0.5) * R * 0.6, f.y, R >= 18, 0.7 + R / 30); }
    v3Dot(F.glow, f.x, h + r * 0.6, f.y, r * 2.2, 1, 0.75 + 0.25 * a, 0.35 * a + 0.1, a);
    v3Dot(F.glow, f.x, h + r * 0.4, f.y, r * 1.2, 1, 1, 0.85, a * a);
    if (R >= 14) v3Dot(F.glow, f.x, h + 4, f.y, R * 4.4, 1, 0.55, 0.2, 0.3 * a);
  }
  // the smoke: rising, drifting with the wind, growing, fading (as the flat map's)
  for (const p of smoke) {
    const age = s.t - p.t, a = age / p.life, x = p.x + WIND.x * age, y = p.y + WIND.y * age;
    const g = p.dark ? 0.24 : 0.74, al = (p.dark ? 0.6 : 0.42) * (1 - a) * Math.min(1, a * 6);
    v3Dot(F.smoke, x, v3Gnd(p.x, p.y) + 4 + 9 * age * 1.6, y, p.r * (1 + a * 2.4) * 2.2, g, g * 0.97, g * 0.92, al);
  }
  // scorch marks: dark earth, lying on the ground
  for (const p of scorch) v3Dot(F.mark, p.x, v3Gnd(p.x, p.y) + 0.8, p.y, p.r * 2.2, 0.12, 0.09, 0.06, 0.7 * (1 - (s.t - p.t) / SCORCH_T));
  // the long-range missiles: high arcs with a white trail (seen by both sides)
  for (const mi of s.missiles || []) {
    const T = Sim.SSM_FLIGHT, L = Math.hypot(mi.x - mi.x0, mi.y - mi.y0), h0 = v3Gnd(mi.x0, mi.y0), h1 = v3Gnd(mi.x, mi.y);
    const at = f => { f = Math.min(1, Math.max(0, f)); return [mi.x0 + (mi.x - mi.x0) * f, h0 + (h1 - h0) * f + Math.sin(Math.PI * f) * L * MISSILE_ARC, mi.y0 + (mi.y - mi.y0) * f]; };
    const f = (s.t - mi.t0) / T;
    for (let i = 1; i <= 14; i++) { const p = at(f - 0.12 * i / 14); v3Dot(F.smoke, p[0], p[1], p[2], 6 + i, 0.88, 0.88, 0.85, 0.5 * (1 - i / 15)); }
    const p = at(f); v3Dot(F.glow, p[0], p[1], p[2], 14, 1, 0.7, 0.3, 1);
  }
  for (const B of Object.values(F)) { B.m.count = B.n; B.m.instanceMatrix.needsUpdate = true; B.col.needsUpdate = true; }
}
// ---- the scenery: the flat map's trees, bushes and stones (decor.rocks.items) and the woods' trees (ground.js), each
// a model (Kenney's Nature Kit, CC0: art/models/tree_*, bush_*, rock_*) standing where the flat map draws it, turned
// at random, its width the picture's (V3_SCEN_K of it); not painted on the ground then (bg.noScen). In squares of
// V3_CHUNK, a mesh for each model in each (so what's off screen, or out of the sun's shadow box, isn't drawn), made
// again only when something in it is cleared, run over or cut. ----
const V3_SCEN = {
  tree: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_pineRoundB'],
  bush: ['bush_a', 'bush_b'], rock: ['rock_smallC', 'rock_largeA'], rockHi: ['rock_largeA', 'rock_tallB', 'rock_smallC'],
};
const V3_SCEN_K = { tree: 0.8, bush: 1.1, rock: 0.9 }, V3_TREE_H = 0.75, V3_CHUNK = 512;
const v3HasScen = () => typeof MODELS === 'object' && V3_SCEN.tree.every(k => MODELS[k]);
// (what stands in a square: [model, x, y, turn, width])
function v3ScenList(ci, cj) {
  const out = [], x0 = ci * V3_CHUNK, y0 = cj * V3_CHUNK, x1 = x0 + V3_CHUNK, y1 = y0 + V3_CHUNK;
  const pick = (L, v) => L[v % L.length];
  for (const it of V3.sc.cells.get(ci + ',' + cj) || []) {
    if (it.gone) continue;
    const L = it.t === 'rock' ? (it.hi && it.s >= 10 / WORLD_K ? V3_SCEN.rockHi : V3_SCEN.rock) : V3_SCEN[it.t];
    out.push([pick(L, it.v), it.x, it.y, (it.v % 628) / 100, it.s * V3_SCEN_K[it.t]]);
  }
  const G = s.ground; if (!G) return out;
  const C = G.C, n = gfxLow ? 1 : GRD_TREES;
  for (let j = Math.floor(y0 / C); j < Math.min(G.h, Math.ceil(y1 / C)); j++) for (let i = Math.floor(x0 / C); i < Math.min(G.w, Math.ceil(x1 / C)); i++) {
    const k = j * G.w + i; if (G.k[k] !== Sim.GR_WOOD) continue;
    for (let q = 0; q < n; q++) {
      const x = i * C + grdRand(k, 4 + q) * C, y = j * C + grdRand(k, 8 + q) * C, w = GRD_TREE[0] + grdRand(k, 12 + q) * (GRD_TREE[1] - GRD_TREE[0]);
      out.push([V3_SCEN.tree[Math.floor(grdRand(k, 16 + q) * V3_SCEN.tree.length)], x, y, grdRand(k, 20 + q) * 6.28, w * V3_SCEN_K.tree]);
    }
  }
  return out;
}
function v3ScenChunk(key) {
  const sc = V3.sc, old = sc.chunks.get(key); if (old) for (const m of old) { V3.scene.remove(m); m.dispose(); }
  const [ci, cj] = key.split(',').map(Number), by = new Map(), o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), list = [], tint = v3Tmp.tint || (v3Tmp.tint = new THREE.Color());
  for (const e of v3ScenList(ci, cj)) { let l = by.get(e[0]); if (!l) by.set(e[0], l = []); l.push(e); }
  for (const [model, l] of by) {
    const mesh = new THREE.InstancedMesh(v3Geo(model, 'hull', 'scen'), V3.scenMat || (V3.scenMat = v3Shaded(new THREE.MeshLambertMaterial({ vertexColors: true }))), l.length);
    l.forEach(([, x, y, a, w], i) => {
      const tall = model.startsWith('tree') ? V3_TREE_H : 1;
      o.position.set(x, v3Gnd(x, y) - w * 0.03, y); o.rotation.set(0, a, 0); o.scale.set(w, w * tall, w); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, tint.setScalar(0.82 + (Math.abs(Math.round(x * 7.1 + y * 13.7)) % 31) / 30 * 0.3)); // (each a little lighter or darker)
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); V3.scene.add(mesh); list.push(mesh);
  }
  sc.chunks.set(key, list);
}
function v3Scenery() {
  if (!v3HasScen()) return;
  let sc = V3.sc;
  if (!sc || sc.of !== decor || sc.low !== gfxLow) { // (a new map: all of it, its squares made a few a frame)
    if (sc) for (const l of sc.chunks.values()) for (const m of l) { V3.scene.remove(m); m.dispose(); }
    const cells = new Map();
    for (const it of decor.rocks.items) { const k = Math.floor(it.x / V3_CHUNK) + ',' + Math.floor(it.y / V3_CHUNK); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(it); }
    sc = V3.sc = { of: decor, low: gfxLow, cells, chunks: new Map(), todo: new Set(), dead: scen.of === decor && scen.dead ? scen.dead.length : 0, cut: s.ground ? s.ground.cut.length : 0 };
    for (let i = 0; i * V3_CHUNK < s.W; i++) for (let j = 0; j * V3_CHUNK < s.H; j++) sc.todo.add(i + ',' + j);
  }
  // (cleared or run over since: scenKill; woods cut: s.ground.cut — their squares made again)
  const sq = (x, y) => Math.floor(x / V3_CHUNK) + ',' + Math.floor(y / V3_CHUNK);
  if (scen.dead && scen.of === decor) for (; sc.dead < scen.dead.length; sc.dead++) { const it = scen.dead[sc.dead]; sc.todo.add(sq(it.x, it.y)); }
  const G = s.ground; if (G) for (; sc.cut < G.cut.length; sc.cut++) { const k = G.cut[sc.cut]; sc.todo.add(sq((k % G.w + 0.5) * G.C, (Math.floor(k / G.w) + 0.5) * G.C)); }
  // (the ones nearest the camera first; at most a few ms a frame)
  if (!sc.todo.size) return;
  const t0 = performance.now(), near = [...sc.todo].map(k => { const [i, j] = k.split(',').map(Number); return [k, Math.hypot((i + 0.5) * V3_CHUNK - cam.x, (j + 0.5) * V3_CHUNK - cam.y)]; }).sort((a, b) => a[1] - b[1]);
  for (const [k] of near) { v3ScenChunk(k); sc.todo.delete(k); if (performance.now() - t0 > 6) break; }
}
// ---- fog of war and night, as the flat map's: two pictures of the whole map (V3_SHADE world units a pixel) — where
// the fog lies (fogHoles cut out of it) and where it's dark (nightLights cut out) — laid over the ground and the
// scenery in their shader (v3Shaded: the colour mixed toward the fog's and the night's blue, a warm glow where lit).
// Units and buildings over it, as on the flat map. Made again every V3_SHADE_MS. The sun and the sky dim at night. ----
const V3_SHADE = 8, V3_SHADE_MS = 60, V3_GLOW = 0.18;
const V3U = { v3Fog: { value: null }, v3Dark: { value: null }, v3Size: { value: null }, v3FogCol: { value: null }, v3Night: { value: 0 }, v3Lit: { value: 0 }, v3Deco: { value: null }, v3DecoBox: { value: null } };
function v3Shaded(mat, deco) {
  if (deco) mat.defines = { V3_DECO: 1 }; // (the ground: what's drawn on it too, v3Deco)
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, V3U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vV3;').replace('#include <project_vertex>', `#include <project_vertex>
      vec4 v3w = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        v3w = instanceMatrix * v3w;
      #endif
      vV3 = (modelMatrix * v3w).xz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vV3; uniform sampler2D v3Fog; uniform sampler2D v3Dark; uniform vec2 v3Size; uniform vec4 v3FogCol; uniform float v3Night; uniform float v3Lit; uniform sampler2D v3Deco; uniform vec4 v3DecoBox;`)
      .replace('#include <fog_fragment>', `vec2 v3uv = vec2(vV3.x / v3Size.x, 1.0 - vV3.y / v3Size.y);
      if (v3Night > 0.0) { float d = texture2D(v3Dark, v3uv).a; gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.031, 0.055, 0.157), d * v3Night) + vec3(1.0, 0.67, 0.31) * (1.0 - d) * v3Lit; }
      if (v3FogCol.w > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, v3FogCol.rgb, texture2D(v3Fog, v3uv).a * v3FogCol.w);
      #ifdef V3_DECO
        vec2 v3du = (vV3 - v3DecoBox.xy) / v3DecoBox.zw;
        if (v3du.x > 0.0 && v3du.x < 1.0 && v3du.y > 0.0 && v3du.y < 1.0) { vec4 dc = texture2D(v3Deco, vec2(v3du.x, 1.0 - v3du.y)); gl_FragColor.rgb = mix(gl_FragColor.rgb, dc.rgb, dc.a); }
      #endif
      #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => 'v3shade' + (deco ? 'd' : ''); return mat;
}
function v3ShadeInit() {
  const mk = () => { const c = document.createElement('canvas'), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return { c, g: c.getContext('2d'), t }; };
  V3.fogP = mk(); V3.darkP = mk(); V3U.v3Fog.value = V3.fogP.t; V3U.v3Dark.value = V3.darkP.t;
  V3U.v3Size.value = new THREE.Vector2(1, 1); V3U.v3FogCol.value = new THREE.Vector4(0, 0, 0, 0);
}
// (a picture the map's size, cleared to full and cut where f says)
function v3ShadePic(P, f) {
  const w = Math.ceil(s.W / V3_SHADE), h = Math.ceil(s.H / V3_SHADE);
  if (P.c.width !== w || P.c.height !== h) { P.c.width = w; P.c.height = h; P.t.dispose(); P.t.image = P.c; }
  const g = P.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.setTransform(1 / V3_SHADE, 0, 0, 1 / V3_SHADE, 0, 0); g.globalCompositeOperation = 'destination-out'; f(g);
  P.t.needsUpdate = true;
}
function v3Shade() {
  if (!V3.fogP) v3ShadeInit();
  const k = Sim.nightAt(s) || 0, now = performance.now();
  // (the night: the dark NIGHT_DARK of it, the sun and the sky down with it)
  V3U.v3Night.value = NIGHT_DARK * k; V3U.v3Lit.value = V3_GLOW * k * 0.5;
  V3.sun.intensity = 0.72 * Math.PI * (1 - 0.7 * k); V3.sky.intensity = 0.5 * Math.PI * (1 - 0.45 * k);
  // (the fog: its colour and how thick, fading in at the start as on the flat map)
  const fc = V3U.v3FogCol.value;
  if (s.fog) { const m = colors.fog.match(/[\d.]+/g) || [0, 0, 0, 0.5]; fc.set(m[0] / 255, m[1] / 255, m[2] / 255, (m[3] !== undefined ? +m[3] : 1) * (s.fogAt ? Math.min(1, (s.t - s.fogAt) / 3) : 1)); }
  else fc.w = 0;
  V3U.v3Size.value.set(s.W, s.H);
  if (now - (V3.shadeAt || 0) < V3_SHADE_MS) return; V3.shadeAt = now;
  if (s.fog) v3ShadePic(V3.fogP, fogHoles);
  if (k) v3ShadePic(V3.darkP, g => { for (const [x, y, r, a] of nightLights()) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
}
// ---- what the flat map draws on the ground — where we may build and the building at the cursor, the control map,
// the enemy as we know it, the bulldozers' jobs, the roads being laid, the squads out of the exact picture, the front,
// what's picked (its rally line), the pings — drawn by the same functions onto a picture of what's on screen (V3.box:
// the world under the screen's corners), laid on the ground in its shader over the fog and the night (V3_DECO). ----
const V3_DECO = 1536;
function v3DecoBox() {
  const w = V3.w || 1, h = V3.h || 1, P = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0]].map(([x, y]) => v3World(x, y));
  const M = 60, x0 = Math.max(-M, Math.min(...P.map(p => p.x)) - M), x1 = Math.min(s.W + M, Math.max(...P.map(p => p.x)) + M);
  const y0 = Math.max(-M, Math.min(...P.map(p => p.y)) - M), y1 = Math.min(s.H + M, Math.max(...P.map(p => p.y)) + M);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}
function v3Deco() {
  if (!V3.deco) {
    const c = document.createElement('canvas'); c.width = c.height = V3_DECO;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    V3.deco = { c, g: c.getContext('2d'), t }; V3U.v3Deco.value = t; V3U.v3DecoBox.value = new THREE.Vector4(0, 0, 1, 1);
  }
  const D = V3.deco, g = D.g, B = V3.box = v3DecoBox(), kx = V3_DECO / B.w, ky = V3_DECO / B.h;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V3_DECO, V3_DECO);
  g.setTransform(kx, 0, 0, ky, -B.x * kx, -B.y * ky);
  if (s.fog) { if (Sim.friction(s)) drawQuality(g); drawEnemyIntel(g); drawMarks(g); }
  drawDozerJobs(g); drawBuildArea(g);
  for (const q of s.squads) if (q.side === 'blue' && !q.dead && !sqShown(q)) drawGuess(g, q, guessAt(q), isSel(q.id));
  drawFront(g); drawPicked(g); drawDesignated(g); drawAsks(g); drawPings(g);
  V3U.v3DecoBox.value.set(B.x, B.y, B.w, B.h); D.t.needsUpdate = true;
}
// every frame, instead of the flat map
function v3Draw() {
  if (V3.of !== decor) { v3Ground(); for (const P of V3.pics.values()) { V3.scene.remove(P.mesh); P.mesh.dispose(); } V3.pics.clear(); }
  const r = V3.r, st = stage.getBoundingClientRect(), w = Math.round(st.width), h = Math.round(st.height);
  if (V3.w !== w || V3.h !== h) { V3.w = w; V3.h = h; r.setSize(w, h, false); V3.cam.aspect = w / h; V3.cam.updateProjectionMatrix(); }
  // (the camera: over cam, as far off as shows the flat map's width at its middle)
  const vw = fit.w / view.css, d = Math.max(60, vw / (2 * Math.tan(V3_FOV * Math.PI / 360) * V3.cam.aspect));
  const ty = Sim.elevAt(s, cam) * V3_LV;
  V3.cam.position.set(cam.x, ty + d * Math.sin(V3_PITCH), cam.y + d * Math.cos(V3_PITCH)); V3.cam.lookAt(cam.x, ty, cam.y);
  V3.cam.far = d * 6 + 4000; V3.cam.updateProjectionMatrix(); V3.cam.updateMatrixWorld();
  V3.scene.fog.near = d * 1.6; V3.scene.fog.far = d * 5 + 2000;
  // (the sun's shadow box: round what's on screen)
  const sun = V3.sun, half = Math.max(400, vw * 0.9), sc = sun.shadow.camera;
  sun.target.position.set(cam.x, ty, cam.y - vw * 0.15); sun.position.set(cam.x - 1500, ty + 2100, cam.y - vw * 0.15 - 1500);
  if (sc.right !== half) { sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix(); }
  sceneryTick(); groundTick(); // (as the flat map's frame: what's cleared, run over, cut)
  for (const P of V3.pics.values()) P.n = 0;
  const rings = v3Units(); v3Nodes(rings); v3Rings(rings); v3Fx(); v3Scenery(); v3Shade(); v3Deco();
  for (const P of V3.pics.values()) { P.mesh.count = P.n; P.mesh.instanceMatrix.needsUpdate = true; P.mesh.instanceColor.needsUpdate = true; }
  r.render(V3.scene, V3.cam);
}
