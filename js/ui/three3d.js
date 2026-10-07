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
// (the 3D view wanted: by default yes; irts-3d = '0' — the flat map; under automation — the UI tests — no, unless irts-3d = '1')
function v3Want() { try { const v = localStorage.getItem('irts-3d'); return v === '1' || (v !== '0' && !navigator.webdriver); } catch (e) { return !navigator.webdriver; } }
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
  // (a camera's colours — ACES — and a sky all round for the metal to reflect: a gradient sphere, blurred once)
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = V3_EXPOSE;
  scene.environment = v3Env(r);
}
const V3_EXPOSE = 1.05, V3_ENV = 0.55; // (the exposure under ACES; how much the sky shows in the paint)
function v3Env(r) {
  const g = new THREE.SphereGeometry(100, 32, 16), col = [], top = new THREE.Color('#cfe0f2'), hor = new THREE.Color('#e8e4da'), gnd = new THREE.Color('#5e5a46'), c = new THREE.Color();
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 100; c.copy(hor).lerp(y > 0 ? top : gnd, Math.min(1, Math.abs(y) * (y > 0 ? 1.6 : 4))); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sc = new THREE.Scene(); sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.8) })); sun.position.set(-55, 60, -55); sc.add(sun);
  const pm = new THREE.PMREMGenerator(r), tex = pm.fromScene(sc, 0.02).texture; pm.dispose(); return tex;
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
    big.castShadow = old.castShadow; big.receiveShadow = old.receiveShadow; big.instanceMatrix.setUsage(THREE.DynamicDrawUsage); big.frustumCulled = false;
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
const V3_KICK = 0.07, V3_BLUR = 0.22; // (a gun's recoil: of the length, all the way back; a rotor disc's darkness)
const V3_DRONE = 0.9, V3_DEAD = 0.7, V3_ROTOR = 14, V3_POS_Q = 16000, V3_MAN = 24, V3_STRIDE = 4; // (V3_MAN: a soldier's height, world units — taller than true to a tank, as on the flat map, or from above it was a dot; V3_STRIDE: the way it walks for each pose) // (a helicopter's rotor, radians a second)
const V3_LEN = { tank: 1.75, jeep: 1.25, ajeep: 1.25, tjeep: 1.25, air: 1.3, tanker: 1.3, heli: 1.2, gunship: 1.2, lift: 1.3, how: 2.2, mlrs: 2.4, ssm: 2.6, arrow: 2.6, dome: 2.6, truck: 2.0, fueltruck: 2.0, watertruck: 2.0, radio: 1.9, mech: 2.0, dozer: 1.7 }, V3_TEAM = 0.38;
const v3HasModel = type => typeof MODELS === 'object' && !!MODELS[type];
function v3Model(type, part, side) {
  const key = 'm:' + type + ':' + part + ':' + side; let P = V3.pics.get(key); if (P) return P;
  const clean = part === 'turret' || part.startsWith('spin') || !!(Sim.TYPES[type] && Sim.TYPES[type].air); // (no mud up there)
  const mesh = new THREE.InstancedMesh(v3Geo(type, part, side), v3Paint3(clean), 64);
  mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3);
  V3.scene.add(mesh); P = { mesh, w: 1, h: 1, ox: 0, oy: 0, n: 0 }; V3.pics.set(key, P); return P;
}
// ---- camouflage: each unit's paint (its `team` part) in colours of its own — a scheme of three (a base, a dark, a
// light) in its side's hues (blue: deep blue, teal, indigo, slate; red: brick, maroon, rust, brown and sand), laid in a
// pattern — plain, spots, tiger stripes, or squares (digital) — worked out on the card from where on the model a point
// is (so it stays on the unit as it moves). Which scheme, pattern and seed come in the instance's colour: red = the tint,
// green < 0 = -(pattern + seed), blue = the scheme (side × 4 + which). The model's own shading of its paint (panels a
// shade lighter or darker) kept: aTeam = its brightness against the part's mean (0 = not paint). ----
const V3_CAMO = 4, V3_SCHEMES = 4; // (patterns: 0 plain, 1 spots, 2 stripes, 3 squares; schemes a side)
// (army colours, not toy ones: ours olive, forest green, grey-green, sand-olive; theirs desert tan, earth brown,
// khaki, grey — and which side, at a glance: a recognition panel across the roof in the side's colour, V3_PANEL)
const V3_PAL = [ // (sRGB: base, dark, light — blue's four, then red's)
  ['#5c6638', '#30361c', '#868a58'], ['#43512f', '#232c18', '#6f7d4f'], ['#5d6656', '#30362c', '#8c9484'], ['#706a48', '#3c3824', '#9c9670'],
  ['#a08a5c', '#5c4a2e', '#c8b484'], ['#7a5a3a', '#3e2c1a', '#a8865e'], ['#8c7e52', '#4e4428', '#b4a87c'], ['#6e6a62', '#3a3833', '#9a968c']];
const V3_PANEL = ['#2d6be0', '#d8392b'], V3_PANEL_W = 0.07; // (blue, red; half its width, of the model's length)
function v3CamoOf(u, c) {
  const h = (u.id * 0.6180339) % 1, p = Math.floor(h * 97) % V3_CAMO, sc = (u.side === 'red' ? V3_SCHEMES : 0) + Math.floor(((u.id * 0.7548777) % 1) * V3_SCHEMES);
  return c.setRGB(1, -(p + 0.01 + h * 0.98), sc + 0.5);
}
// the units' and buildings' paint: a real material — a little rough and a little metal, reflecting the sky — with dirt
// on it (grime in blotches, the roughness varying) and mud low down (V3_MUD of the model's length; not on turrets or aircraft)
const V3_SAT = '0.8', V3_MUD = 0.09, V3_MUD_COL = [0.16, 0.12, 0.08];
function v3Paint3(clean) {
  const k = clean ? 'vcolC' : 'vcol';
  if (!V3[k]) { V3[k] = v3Camo(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.18, envMapIntensity: V3_ENV })); if (!clean) V3[k].defines = { V3_DIRTY: 1 }; }
  return V3[k];
}
function v3Camo(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.v3Panel = { value: V3_PANEL.map(x => { const c = new THREE.Color(x); return new THREE.Vector3(c.r, c.g, c.b); }) };
    sh.uniforms.v3Pal = { value: V3_PAL.flat().map(x => { const c = new THREE.Color(x); return new THREE.Vector3(c.r, c.g, c.b); }) }; // (linear)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTeam; varying vec3 vP3; varying vec3 vN3; varying float vTeam; varying vec3 vPat; varying float vTint;')
      .replace('#include <color_vertex>', `#include <color_vertex>
      vP3 = position; vN3 = normal; vTeam = aTeam; vPat = vec3(-1.0); vTint = 1.0;
      #ifdef USE_INSTANCING_COLOR
      if (instanceColor.g < 0.0) { vPat = vec3(floor(-instanceColor.g), fract(-instanceColor.g), floor(instanceColor.b)); vColor.xyz = color.xyz * instanceColor.r; vTint = instanceColor.r; }
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 v3Pal[${V3_PAL.length * 3}]; uniform vec3 v3Panel[2]; varying vec3 vP3; varying vec3 vN3; varying float vTeam; varying vec3 vPat; varying float vTint;
      float v3h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float v3n(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(v3h(i), v3h(i + vec3(1,0,0)), f.x), mix(v3h(i + vec3(0,1,0)), v3h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(v3h(i + vec3(0,0,1)), v3h(i + vec3(1,0,1)), f.x), mix(v3h(i + vec3(0,1,1)), v3h(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vPat.x > -0.5 && vTeam > 0.01) {
        int b = int(vPat.z) * 3; vec3 c0 = v3Pal[b], c1 = v3Pal[b + 1], c2 = v3Pal[b + 2], q = vP3 + vPat.y * 17.0, c = c0;
        if (vPat.x > 0.5 && vPat.x < 1.5) { float n = v3n(q * 6.0) * 0.65 + v3n(q * 14.0) * 0.35; c = n < 0.4 ? c1 : n > 0.6 ? c2 : c0; }
        else if (vPat.x > 1.5 && vPat.x < 2.5) { float w = sin((vP3.x + vP3.z * 0.35 + vP3.y * 0.6) * 22.0 + v3n(q * 5.0) * 5.0); c = w > 0.35 ? c1 : w < -0.75 ? c2 : c0; }
        else if (vPat.x > 2.5) { float n = v3h(floor(q * 20.0)) * 0.6 + v3n(q * 5.0) * 0.4; c = n < 0.38 ? c1 : n > 0.62 ? c2 : c0; }
        if (vN3.y > 0.55 && abs(vP3.x) < ${V3_PANEL_W}) c = v3Panel[vPat.z < ${V3_SCHEMES}.0 ? 0 : 1] / max(vTeam, 0.5);
        diffuseColor.rgb = c * vTeam * vTint;
      }
      float v3g = v3n(vP3 * 9.0 + 3.1) * 0.6 + v3n(vP3 * 31.0) * 0.4, v3m = 0.0;
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, ${V3_SAT}); // (paint a little faded)
      diffuseColor.rgb *= (0.78 + 0.3 * v3g) * (0.72 + 0.28 * smoothstep(-0.6, 0.4, vN3.y)); // (grime in blotches; under-sides darker)
      #ifdef V3_DIRTY
      v3m = smoothstep(${V3_MUD.toFixed(3)}, 0.0, vP3.y + (v3g - 0.5) * 0.05) * 0.8;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${V3_MUD_COL.join(', ')}) * (0.8 + 0.4 * v3g), v3m);
      #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (v3g - 0.5) * 0.35 + v3m * 0.3, 0.3, 1.0);`);
  };
  return mat;
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
    const at = new Float32Array(n); // (its paint: where the camouflage goes — each point's brightness against the part's mean, so its panels keep their shades)
    if (k === 'team') { let m = 0; for (let i = 0; i < n; i++) m += (u8[i * 12 + 9] + u8[i * 12 + 10] + u8[i * 12 + 11]) / 765; m = Math.max(0.01, m / n); for (let i = 0; i < n; i++) at[i] = Math.min(1.5, Math.max(0.45, (u8[i * 12 + 9] + u8[i * 12 + 10] + u8[i * 12 + 11]) / 765 / m)); }
    g.setAttribute('aTeam', new THREE.BufferAttribute(at, 1));
    geo.push(g);
  }
  const all = geo.length > 1 ? v3Merge(geo) : geo[0]; G.set(key, all); return all;
}
// (two geometries of the same attributes, one after the other)
function v3Merge(gs) {
  const g = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'color', 'aTeam']) {
    const parts = gs.map(x => x.getAttribute(a).array), out = new Float32Array(parts.reduce((s2, x) => s2 + x.length, 0)); let o = 0;
    for (const x of parts) { out.set(x, o); o += x.length; } g.setAttribute(a, new THREE.BufferAttribute(out, a === 'aTeam' ? 1 : 3));
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
// (kick: 0..1, how far the gun is kicked back — just fired)
function v3PutModel(type, side, x, y, hd, aim, m, tint, run, lift = 0, len = 0, rise = 1, pose = null, kick = 0) {
  const D = MODELS[type], L = len || (D.poses ? V3_MAN / D.size[1] : (SIZE[type] || 10) * (V3_LEN[type] || 1.6)), H = v3Model(type, pose || 'hull', side);
  v3Put(H, v3Lay(x, y, hd, lift, L, L, 0, 0, m, L * rise), tint);
  if (D.lights && V3.nightK > 0.02 && !(tint && tint.g >= 0) && !pose) { // (at night: its lamps lit — where they are now)
    const lv = v3Tmp.lv || (v3Tmp.lv = new THREE.Vector3()), A = V3.lamps;
    for (const l of D.lights) { lv.set(l[0], l[1], l[2]).applyMatrix4(m); A.push(lv.x, lv.y, lv.z, V3_LAMP_K.indexOf(l[3])); }
  }
  const K = D.track;
  if (K) ['L', 'R'].forEach((k, i) => { const r = run ? run[i] / (K.cycle * L) : 0, f = Math.floor((r - Math.floor(r)) * K.frames) % K.frames; v3Put(v3Model(type, 'track' + k + f, 'track'), m, tint); });
  if (!D.parts.turret) return;
  const t = v3Tmp, T = v3Model(type, 'turret', side), pv = D.pivot || [0, 0];
  t.off.set(pv[0] * L, 0, pv[1] * L).applyQuaternion(t.q); t.p.set(t.p.x + t.off.x, t.p.y + t.off.y, t.p.z + t.off.z);
  t.yaw.setFromAxisAngle(t.up, -aim); t.q.setFromUnitVectors(t.up, t.n).multiply(t.yaw);
  if (kick) { t.off.set(-kick * V3_KICK * L, 0, 0).applyQuaternion(t.q); t.p.add(t.off); } // (the gun kicked back as it fires)
  v3Put(T, m.compose(t.p, t.q, t.sc.set(L, L, L)), tint);
  if (lift && !(tint && tint.g >= 0)) v3Blur(type, m, L); // (a rotor turning: a faint disc where its blades sweep)
}
// a helicopter's rotor disc: the round its blades sweep (their reach and height from the rotor's own shape), faint
function v3Blur(type, m, L) {
  const R = V3.rotor || (V3.rotor = new Map()); let b = R.get(type);
  if (!b) { const g = v3Geo(type, 'turret', 'blue'); g.computeBoundingBox(); const B = g.boundingBox; R.set(type, b = { r: Math.max(B.max.x - B.min.x, B.max.z - B.min.z) / 2, y: B.max.y - 0.004 }); }
  let P = V3.pics.get('blur');
  if (!P) {
    const g = new THREE.CircleGeometry(1, 32); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#2a2d30', transparent: true, opacity: V3_BLUR, depthWrite: false }), 16);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3).fill(1), 3);
    V3.scene.add(mesh); P = { mesh, n: 0 }; V3.pics.set('blur', P);
  }
  const t = v3Tmp; t.off.set(0, b.y * L, 0).applyQuaternion(t.q);
  v3Put(P, m.compose(t.p.add(t.off), t.q, t.sc.set(b.r * L * 0.98, 1, b.r * L * 0.98)));
}
function v3Units() {
  const m = v3Tmp.m || (v3Tmp.m = new THREE.Matrix4()), rings = [];
  // (what the player sees, as the flat map: ours where the picture is exact, theirs where seen)
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (s.fog && !((u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u))) continue;
    const T = Sim.TYPES[u.type], lift = T.air ? V3_AIR : 0, hd = u.hd || 0;
    if (anim.s !== s) { anim.s = s; anim.walk.clear(); anim.last.clear(); tracks.length = 0; dust.length = 0; }
    if (!T.air) stride(u); // (as the flat map: the tracks and dust it leaves)
    if (s.fog && u.side === 'red') anim.last.set(u.id, { x: u.x, y: u.y, type: u.type, side: u.side, hd: u.hd, t: s.t }); // (out of sight: its ghost, below)
    if (u.type === 'tank' && u.dig > 0 && !u.dug && v3HasModel('inf')) { const p = digger(u); v3PutModel('inf', u.side, p.x, p.y, p.a, 0, m, null, null, 0.01, 0, 1, 'pose' + (Math.floor(performance.now() / 160) % MODELS.inf.poses)); } // (its crewman digging the berm)
    if (v3HasModel(u.type)) {
      const man = !!MODELS[u.type].poses, pose = v3Walk(u), face = man && s.t - u.lastFire < 3 ? u.aim : hd; // (a soldier faces where it fires, and stands upright)
      v3PutModel(u.type, u.side, u.x, u.y, face, T.hover || u.type === 'lift' ? performance.now() / 1000 * V3_ROTOR + u.id : s.t - u.lastFire < 3 ? u.aim : hd, m, v3CamoOf(u, v3Tmp.camo || (v3Tmp.camo = new THREE.Color())), T.air || man ? null : v3Run(u, hd), man ? 0.01 : lift, 0, 1, pose, u.type === 'tank' || u.type === 'how' ? Math.max(0, 1 - (s.t - u.lastFire) / 0.25) : 0);
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
  // (the enemy just gone out of sight: dim where last seen, GHOST_T s — the flat map's drawGhosts)
  if (s.fog) {
    const alive = new Set(s.units.map(u => u.id)), gt = v3Tmp.gt || (v3Tmp.gt = new THREE.Color());
    for (const [id, g] of anim.last) {
      const age = s.t - g.t; if (age < 0.05) continue;
      if (age > GHOST_T || (!alive.has(id) && age < 0.3)) { anim.last.delete(id); continue; }
      if (v3HasModel(g.type) && !MODELS[g.type].poses) v3PutModel(g.type, g.side, g.x, g.y, g.hd || 0, g.hd || 0, m, gt.setScalar(0.25 + 0.3 * (1 - age / GHOST_T)), null, Sim.TYPES[g.type].air ? V3_AIR : 0);
      else if (v3HasModel(g.type)) v3PutModel(g.type, g.side, g.x, g.y, g.hd || 0, 0, m, gt.setScalar(0.25 + 0.3 * (1 - age / GHOST_T)), null, 0.01, 0, 1, null);
    }
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
// (picked: a fine, dashed, faint light ring round each, on the ground — V3_RING: its width, dashes, see-through)
const V3_RING = { w: 0.055, dash: 18, a: 0.5, k: 0.85 };
function v3Rings(rings) {
  if (!V3.rings) {
    const g = new THREE.RingGeometry(1 - V3_RING.w, 1, 64); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#f4fff6', transparent: true, opacity: V3_RING.a, depthWrite: false, depthTest: false });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRing;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRing = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRing;').replace('void main() {', `void main() {
        if (fract(atan(vRing.y, vRing.x) / 6.2831853 * ${V3_RING.dash}.0) > 0.62) discard;`);
    };
    V3.rings = new THREE.InstancedMesh(g, mat, 4000);
    V3.rings.frustumCulled = false; V3.rings.renderOrder = 10; V3.scene.add(V3.rings); // (over the pictures: on the ground they cut through them)
  }
  let n = 0; const o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D());
  for (const g of rings) {
    if (n >= 4000) break;
    o.position.set(g.x, Sim.elevAt(s, g) * V3_LV + 1 + (g.air ? V3_AIR : 0), g.y); o.scale.set(g.r * V3_RING.k, 1, g.r * V3_RING.k); o.updateMatrix(); V3.rings.setMatrixAt(n++, o.matrix);
  }
  V3.rings.count = n; V3.rings.instanceMatrix.needsUpdate = true;
}
// ---- the buildings: the flat map's picture of each (buildingPic, in the holder's colour) lying on the ground; going
// up — dark, lighter as the work is done; remembered (the enemy's, out of sight) — dim. Under each, an unseen block
// of about its size that throws the sun's shadow (so a flat picture still stands). Drones: their picture up in the air,
// turning slowly. ----
const V3_BLD_K = 1.0; // (a building's model: its length, of its picture's)
const V3_HURT = 0.6, V3_BURNT = 0.3, V3_RUIN = 0.3, V3_RUIN_H = 0.08, V3_RUBBLE = 44; // (hurt below this: darker, to V3_BURNT at nothing; a ruin: this dark, of its height)
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
  if (!V3.rubble) {
    V3.rubble = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 4000);
    V3.rubble.castShadow = V3.rubble.receiveShadow = true; V3.rubble.frustumCulled = false; V3.rubble.count = 0; V3.scene.add(V3.rubble);
  }
  const m = v3Tmp.m, o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), tint = v3Tmp.tint || (v3Tmp.tint = new THREE.Color());
  let nb = 0, np = 0, nr = 0;
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
    const hurt = n.hp / S.hp; // (badly hurt: darker — burnt)
    put(n.kind, col, n.x, n.y, S.r, pxOf(n.kind), on ? (hurt < V3_HURT ? V3_BURNT + (1 - V3_BURNT) * hurt / V3_HURT : 1) : V3_SITE + (1 - V3_SITE) * grow, n.side, grow);
    if (selNode === n.id) rings.push({ x: n.x, y: n.y, r: S.r + 10 });
  }
  // (the ruins of buildings destroyed: the model, dark and low — unless a new one stands on it)
  for (const r of s.ruins || []) {
    if ((s.fog && !shownAt(r)) || s.nodes.some(n => n.kind !== 'drone' && Math.hypot(n.x - r.x, n.y - r.y) < Sim.STRUCTS[n.kind].r)) continue;
    put(r.kind, colors[r.side], r.x, r.y, Sim.STRUCTS[r.kind].r, pxOf(r.kind), V3_RUIN, r.side, V3_RUIN_H);
    // (and over it a heap of debris: blocks of concrete, burnt beams, sheets of the roof — the same each frame, from where it stood)
    const R = Sim.STRUCTS[r.kind].r, g = Sim.elevAt(s, r) * V3_LV;
    for (let i = 0; i < V3_RUBBLE && nr < 4000; i++) {
      const h = (j) => { const v = Math.sin(r.x * 12.9898 + r.y * 78.233 + i * 37.719 + j * 4.581) * 43758.5453; return v - Math.floor(v); };
      const a = h(1) * 6.28, d = Math.sqrt(h(2)) * R * 0.85, w = 2 + h(3) * R * 0.35, kind = h(4);
      o.position.set(r.x + Math.cos(a) * d, g + 0.8 + (1 - d / R) * R * 0.22 * h(5), r.y + Math.sin(a) * d * 0.8); // (heaped up in the middle)
      o.rotation.set((h(6) - 0.5) * 1.2, h(7) * 6.28, (h(8) - 0.5) * 1.2);
      o.scale.set(w, kind < 0.6 ? w * 0.45 : 0.6, kind < 0.6 ? w * 0.7 : w * 0.25); o.updateMatrix(); V3.rubble.setMatrixAt(nr, o.matrix);
      V3.rubble.setColorAt(nr++, tint.set(kind < 0.6 ? 0x6f6a62 : kind < 0.85 ? 0x2a2420 : colors[r.side]).multiplyScalar(0.55 + h(9) * 0.35));
    }
  }
  V3.rubble.count = nr; V3.rubble.instanceMatrix.needsUpdate = true; if (V3.rubble.instanceColor) V3.rubble.instanceColor.needsUpdate = true;
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { const g = s.memNodes.blue[id]; put(g.kind, colors.red, g.x, g.y, Sim.STRUCTS[g.kind].r, pxOf(g.kind), V3_MEM, 'red'); }
  if (s.posts) for (const p of s.posts) { const R = Sim.POSTS[p.kind].r; put(p.kind, postCol(p), p.x, p.y, R, Math.round(R * 2.4), s.fog && !postSeen(p) ? V3_MEM : 1, p.side); if (selPost === p) rings.push({ x: p.x, y: p.y, r: R + 10 }); }
  v3Flags();
  V3.blocks.count = nb; V3.blocks.instanceMatrix.needsUpdate = true; V3.plinth.count = np; V3.plinth.instanceMatrix.needsUpdate = true;
}
// the flag of each headquarters (and the dummy one — it's to look the same): a pole at a front corner of its yard and
// a cloth in the side's colour, waving with the smoke's wind (WIND) — its points moved each frame, a wave running to
// the free end (a few of them: a mesh each)
const V3_FLAG = { at: [12.5 / 34, 4 / 34], pole: 8.7 / 34, w: 3.2 / 34, h: 2.0 / 34 }; // (where in its yard, of its length — where the model had a still one, tools/build_buildings.py b_hq; the pole and cloth: of the length)
function v3Flags() {
  const F = V3.flags || (V3.flags = new Map()), seen = new Set(), t = performance.now() / 1000, wa = Math.atan2(WIND.y, WIND.x);
  for (const n of s.nodes) {
    if ((n.kind !== 'hq' && n.kind !== 'decoy') || n.hp <= 0 || s.t < n.ready || !nodeShown(n) || !v3HasModel('b_' + n.kind)) continue;
    seen.add(n.id); let f = F.get(n.id);
    const L = pxOf(n.kind) * V3_BLD_K, fa = n.side === 'red' ? Math.PI : 0;
    if (!f || f.side !== n.side) {
      if (f) { V3.scene.remove(f.g); f.cloth.geometry.dispose(); }
      const g = new THREE.Group(), ph = V3_FLAG.pole * L, cw = V3_FLAG.w * L, ch = V3_FLAG.h * L;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, ph, 6), V3.flagPole || (V3.flagPole = new THREE.MeshLambertMaterial({ color: '#8c8f93' })));
      pole.position.y = ph / 2; pole.castShadow = true; g.add(pole);
      const cg = new THREE.PlaneGeometry(cw, ch, 10, 3); cg.translate(cw / 2, ph - ch / 2 - 0.3, 0);
      const cloth = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: colors[n.side], side: THREE.DoubleSide })); cloth.castShadow = true; g.add(cloth);
      V3.scene.add(g); F.set(n.id, f = { g, cloth, side: n.side, x0: Float32Array.from(cg.attributes.position.array), cw });
    }
    const lx = V3_FLAG.at[0] * L, lz = V3_FLAG.at[1] * L, c = Math.cos(fa), sn = Math.sin(fa), x = n.x + lx * c - lz * sn, y = n.y + lx * sn + lz * c;
    f.g.position.set(x, Sim.elevAt(s, { x, y }) * V3_LV, y); f.g.rotation.y = -wa; // (the cloth streams down the wind)
    const P = f.cloth.geometry.attributes.position, A = P.array, X = f.x0;
    for (let i = 0; i < A.length; i += 3) { const u = X[i] / f.cw; A[i + 2] = Math.sin(t * 5 - u * 7 + n.id) * f.cw * 0.09 * u; A[i + 1] = X[i + 1] - u * u * f.cw * 0.08; }
    P.needsUpdate = true; f.cloth.geometry.computeVertexNormals();
  }
  for (const [id, f] of F) if (!seen.has(id)) { V3.scene.remove(f.g); f.cloth.geometry.dispose(); F.delete(id); }
}
// ---- fire and smoke: bits of light and smoke, each a soft round picture facing the camera (or, a scorch mark, lying
// on the ground), all of a kind in one InstancedMesh with its own colour and see-through-ness (aCol) — the light ones
// added (they glow), the smoke laid over. The same things as the flat map: shots in flight (a bright head and a
// fading tail; a missile's white trail; the artillery's shells in an arc), muzzle flashes, blasts (a fireball, a
// glow round the big ones), the smoke (smokeTick: hurt vehicles, wrecks, chimneys, after a blast — rising and
// drifting with the wind), scorch marks where blasts landed (scorchTick), the long-range missiles' arc. ----
const V3_FX_MAX = 6000;
// (a lamp's glow at night: d across (world units), colour, how bright at full dark; some: of the windows, the share lit; blink: on and off)
const V3_LAMP_K = ['h', 'w', 'f', 'y', 'r', 'g'], V3_LAMP = { h: { d: 7, c: [1, 0.95, 0.75], a: 0.9 }, w: { d: 5, c: [1, 0.95, 0.8], a: 0.8 }, f: { d: 16, c: [1, 0.96, 0.82], a: 0.85 },
  y: { d: 4.5, c: [1, 0.72, 0.35], a: 0.75, some: 0.6 }, r: { d: 5, c: [1, 0.15, 0.1], a: 0.9, blink: true }, g: { d: 5, c: [0.2, 1, 0.45], a: 0.9 } };
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
  // dust kicked up behind vehicles and soldiers (stride, as the flat map's drawDust)
  while (dust.length && s.t - dust[0].t > DUST_T) dust.shift();
  if (!lite) for (const p of dust) { const a = (s.t - p.t) / DUST_T; if (a >= 0 && a < 1) v3Dot(F.smoke, p.x, v3Gnd(p.x, p.y) + 1.5 + a * 3, p.y, p.r * (2.2 + a * 3.5), 0.8, 0.74, 0.6, p.a * (1 - a) * 0.9); }
  // lamps lit at night (the models' — tools/build_models.py `lamp`): a glow each, by its kind; a mast's red one blinks,
  // only some windows lit (the same ones — by where they are)
  const A = V3.lamps || [], nk = V3.nightK || 0, tt = performance.now() / 1000;
  for (let i = 0; i < A.length; i += 4) {
    const L = V3_LAMP[V3_LAMP_K[A[i + 3]]]; if (!L) continue;
    if (L.some) { const v = Math.sin(A[i] * 12.99 + A[i + 2] * 78.23) * 43758.5; if (v - Math.floor(v) > L.some) continue; }
    const a = nk * L.a * (L.blink ? 0.35 + 0.65 * (Math.sin(tt * 3 + A[i] * 0.1) > 0.6 ? 1 : 0) : 1);
    v3Dot(F.glow, A[i], A[i + 1], A[i + 2], L.d, L.c[0], L.c[1], L.c[2], a);
  }
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
  tree: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_pineRoundB', 'tree_cone', 'tree_pineTallA', 'tree_pineRoundD', 'tree_pineSmallB',
    'tree_plateau', 'tree_simple', 'tree_small', 'tree_tall', 'tree_thin', 'tree_blocks', 'tree_pineDefaultA', 'tree_oak_dark'],
  bush: ['bush_a', 'bush_b', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'], rock: ['rock_smallC', 'rock_largeA', 'rock_smallF', 'stone_largeB'],
  rockHi: ['rock_largeA', 'rock_tallB', 'rock_smallC', 'rock_largeC', 'rock_tallE'],
};
const V3_SCEN_K = { tree: 0.8, bush: 1.1, rock: 0.9 }, V3_TREE_H = 0.75, V3_TREE_MAX = 2.0, V3_CHUNK = 512;
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
const V3_SCEN_HUE = 0.05;
function v3ScenChunk(key) {
  const sc = V3.sc, old = sc.chunks.get(key); if (old) for (const m of old) { V3.scene.remove(m); m.dispose(); }
  const [ci, cj] = key.split(',').map(Number), by = new Map(), o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), list = [], tint = v3Tmp.tint || (v3Tmp.tint = new THREE.Color());
  for (const e of v3ScenList(ci, cj)) { let l = by.get(e[0]); if (!l) by.set(e[0], l = []); l.push(e); }
  for (const [model, l] of by) {
    const mesh = new THREE.InstancedMesh(v3Geo(model, 'hull', 'scen'), V3.scenMat || (V3.scenMat = v3Shaded(new THREE.MeshLambertMaterial({ vertexColors: true }))), l.length);
    l.forEach(([, x, y, a, w], i) => {
      const tall = model.startsWith('tree') ? Math.min(V3_TREE_H, V3_TREE_MAX / MODELS[model].size[1]) : 1; // (the tall thin ones: no higher than V3_TREE_MAX × wide — they hid all round them)
      o.position.set(x, v3Gnd(x, y) - w * 0.03, y); o.rotation.set(0, a, 0); o.scale.set(w, w * tall, w); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      const h = j => { const v = Math.sin(x * 12.9898 + y * 78.233 + j * 37.72) * 43758.5453; return v - Math.floor(v); }, k = 0.82 + h(0) * 0.3; // (each a little lighter or darker,
      mesh.setColorAt(i, tint.setRGB(k * (1 + (h(1) - 0.5) * 2 * V3_SCEN_HUE), k * (1 + (h(2) - 0.5) * 2 * V3_SCEN_HUE), k * (1 + (h(3) - 0.5) * 2 * V3_SCEN_HUE))); // and each of R, G, B up to ±V3_SCEN_HUE)
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
// ---- dug in (Sim digTick; the flat map's drawTrenches): a ring of earth round a soldier, open at his back; a longer
// one round a tank's front and sides — rising as it's dug, staying where it was (s.trenches), the enemy's where seen ----
const V3_TRENCH = { foot: [V3_MAN * 0.42, 0.55], tank: [0, 0.6] }, V3_TRENCH_COL = '#7a6444';
function v3Trenches() {
  if (!V3.trench) {
    const g = new THREE.TorusGeometry(1, 0.3, 5, 16, Math.PI * 1.5); g.rotateX(Math.PI / 2); g.rotateY(Math.PI * 0.75); // (lying flat, its gap at the back: −X)
    V3.trench = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: V3_TRENCH_COL, flatShading: true }), 512);
    V3.trench.castShadow = V3.trench.receiveShadow = true; V3.trench.frustumCulled = false; V3.trench.count = 0; V3.scene.add(V3.trench);
  }
  const T = V3.trench, o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), c = v3Tmp.tc || (v3Tmp.tc = new THREE.Color()), box = V3.box; let n = 0;
  const put = (x, y, a, k, f) => {
    if (n >= T.instanceMatrix.count || (box && (x < box.x - 40 || x > box.x + box.w + 40 || y < box.y - 40 || y > box.y + box.h + 40))) return;
    const tank = k === 'tank', R = tank ? (SIZE.tank || 30) * (V3_LEN.tank || 1.6) * 0.55 : V3_TRENCH.foot[0], h = (tank ? V3_TRENCH.tank[1] : V3_TRENCH.foot[1]) * f;
    o.position.set(x, v3Gnd(x, y) - 0.4, y); o.rotation.set(0, -a, 0); o.scale.set(R * (tank ? 1.15 : 1), R * h * 0.5, R * (tank ? 0.75 : 1)); o.updateMatrix();
    T.setMatrixAt(n, o.matrix); T.setColorAt(n++, c.setScalar(0.85 + ((Math.abs(Math.round(x * 3.1 + y * 7.7)) % 9) / 30)));
  };
  for (const t of s.trenches || []) if (t.side === 'blue' || !s.fog || shownAt(t)) put(t.x, t.y, t.a, t.k, 1);
  for (const u of s.units) if (u.dig > 0 && !u.dug && (u.side === 'blue' || !s.fog || s.vis.blue.has(u.id))) put(u.x, u.y, u.hd || 0, u.type === 'tank' ? 'tank' : 'foot', u.dig);
  T.count = n; T.instanceMatrix.needsUpdate = true; if (T.instanceColor) T.instanceColor.needsUpdate = true;
}
// ---- water that moves: over each lake (its own outline — decor.lakes' body, as a mask) a see-through surface whose
// ripples run and glint (a small shader on the light's own; the ground's fog and night over it — v3Shaded) ----
const V3_WATER = { col: '#3f86b0', a: 0.42, px: 256 };
function v3Water() {
  if (V3.water && V3.water.of === decor) { V3.waterT.value = (performance.now() / 1000) % 1000; return; }
  if (V3.water) for (const m of V3.water.meshes) { V3.scene.remove(m); m.geometry.dispose(); m.material.alphaMap.dispose(); m.material.dispose(); }
  V3.waterT = V3.waterT || { value: 0 }; V3.water = { of: decor, meshes: [] };
  for (const k of decor.lakes || []) {
    const l = k.l, R = Math.max(l.rx, l.ry) * 1.3, N = V3_WATER.px, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.setTransform(N / (2 * R), 0, 0, N / (2 * R), N / 2 - l.x * N / (2 * R), N / 2 - l.y * N / (2 * R)); g.fillStyle = '#fff'; g.fill(k.body);
    const mask = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(2 * R, 2 * R, 1, 1); geo.rotateX(-Math.PI / 2);
    const mat = v3Shaded(new THREE.MeshLambertMaterial({ color: V3_WATER.col, transparent: true, opacity: V3_WATER.a, alphaMap: mask, depthWrite: false }));
    const base = mat.onBeforeCompile;
    mat.onBeforeCompile = sh => {
      base(sh); sh.uniforms.v3T = V3.waterT;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float v3T;').replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        float w = sin(vV3.x * 0.07 + v3T * 1.3 + sin(vV3.y * 0.05 + v3T * 0.6) * 2.0) * sin(vV3.y * 0.08 - v3T * 1.1 + sin(vV3.x * 0.04 + v3T * 0.3) * 1.5);
        diffuseColor.rgb *= 0.88 + 0.22 * w; diffuseColor.rgb += vec3(0.9, 0.95, 1.0) * smoothstep(0.78, 0.98, w) * 0.55; diffuseColor.a *= 0.85 + 0.3 * smoothstep(0.7, 1.0, w);`);
    };
    mat.customProgramCacheKey = () => 'v3water';
    const m = new THREE.Mesh(geo, mat); m.position.set(l.x, Sim.elevAt(s, l) * V3_LV + 0.5, l.y); m.renderOrder = 2;
    V3.scene.add(m); V3.water.meshes.push(m);
  }
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
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef V3_DECO
        float v3gr = v3gn(vV3 * 0.9) * 0.5 + v3gn(vV3 * 0.23) * 0.3 + v3gn(vV3 * 0.05) * 0.2; // (grain, clods, patches)
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, 0.82) * (0.84 + 0.3 * v3gr);
      #endif`).replace('#include <common>', `#include <common>
      float v3gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float v3gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(v3gh(i), v3gh(i + vec2(1, 0)), f.x), mix(v3gh(i + vec2(0, 1)), v3gh(i + vec2(1, 1)), f.x), f.y); }
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
  const k = Sim.nightAt(s) || 0, now = performance.now(); V3.nightK = k;
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
  if (!lite) { drawTracks(g); drawClouds(g); } drawWeather(g); // (tracks in the ground, clouds' shadows, the morning fog; rain — over the screen)
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
  V3.lamps = [];
  const rings = v3Units(); v3Nodes(rings); v3Rings(rings); v3Fx(); v3Scenery(); v3Water(); v3Trenches(); v3Shade(); v3Deco();
  for (const P of V3.pics.values()) { P.mesh.count = P.n; P.mesh.instanceMatrix.needsUpdate = true; P.mesh.instanceColor.needsUpdate = true; }
  r.render(V3.scene, V3.cam);
  v3Info();
}
// what the flat map writes over buildings and our units — construction, health, the next unit; health dots, fuel /
// water / ammunition lights, ⟲, Trophy, reload, riders, the Star of David — by its own functions (drawStructInfo,
// unitInfo, healthDot, fuelGauge) on the 2D canvas over the 3D one, placed for each so that its spot lands on the
// screen where its model stands (and scaled as the ground is there)
function v3Info() {
  const c = ctx, dpr = fit ? fit.dpr : 1, P = v3Tmp.ip || (v3Tmp.ip = new THREE.Vector3()), W = V3.w, H = V3.h;
  const scr = (x, y, h) => { P.set(x, Sim.elevAt(s, { x, y }) * V3_LV + h, y).project(V3.cam); return [(P.x + 1) / 2 * W, (1 - P.y) / 2 * H, P.z]; };
  const put = (x, y, h) => {
    const a = scr(x, y, h); if (a[2] > 1 || a[0] < -60 || a[0] > W + 60 || a[1] < -60 || a[1] > H + 60) return false;
    const b = scr(x + 10, y, h), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / 10;
    c.setTransform(k * dpr, 0, 0, k * dpr, (a[0] - x * k) * dpr, (a[1] - y * k) * dpr); return true;
  };
  c.save(); c.textAlign = 'center';
  for (const n of s.nodes) if (n.kind !== 'drone' && n.hp > 0 && nodeShown(n) && put(n.x, n.y, 0)) drawStructInfo(c, n);
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (u.side !== 'blue' || (s.fog && !(whole.has(u.squad) && shownAt(u)))) continue;
    const T = Sim.TYPES[u.type]; if (!put(u.x, u.y, T.air ? V3_AIR - SIZE[u.type] * 0.6 : SIZE[u.type] * 0.35)) continue; // (an aircraft's marks: nearer its body — they float high over a big one)
    unitInfo(c, u); healthDot(c, u); fuelGauge(c, u);
    if (sel !== 'all' && sel != null && isSel(u.squad) && hurtUnit(u)) starOfDavid(c, u.x, u.y - SIZE[u.type] * (T.air ? 1.2 : 1.05) - 9 / view.css);
  }
  c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
}
