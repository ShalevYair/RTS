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
  if (V3.loading) return; V3.loading = true; // (asked again while loading: once is enough — twice, its files were declared twice)
  // (the library, then the models — tools/models.py; without them, the pictures)
  const load = (src, next) => { const sc = document.createElement('script'); sc.src = src; sc.onload = next; sc.onerror = /models|ground3d/.test(src) ? next : () => toast('3D ✖', innerWidth / 2, 80, 3000); document.head.appendChild(sc); };
  load('js/lib/three.min.js', () => load('js/ui/models.js', () => load('js/ui/ground3d.js', () => v3Show(true))));
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
  scene.add(V3.sky = new THREE.HemisphereLight('#c4d8f0', '#4e4a36', V3_SKY * Math.PI));
  const sun = V3.sun = new THREE.DirectionalLight('#ffeacc', V3_SUN * Math.PI);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
  scene.add(sun, sun.target);
  // (a camera's colours — ACES — and a sky all round for the metal to reflect: a gradient sphere, blurred once)
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = V3_EXPOSE;
  scene.environment = v3Env(r);
}
// V3_SUN, V3_SKY: the sun's light and the sky's all round (× π) — a strong sun and a weak sky: light and shade, not flat
const V3_SUN = 1.0, V3_SKY = 0.33, V3_EXPOSE = 1.05, V3_ENV = 0.55; // (the exposure under ACES; how much the sky shows in the paint)
function v3Env(r) {
  const g = new THREE.SphereGeometry(100, 32, 16), col = [], top = new THREE.Color('#cfe0f2'), hor = new THREE.Color('#e8e4da'), gnd = new THREE.Color('#5e5a46'), c = new THREE.Color();
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 100; c.copy(hor).lerp(y > 0 ? top : gnd, Math.min(1, Math.abs(y) * (y > 0 ? 1.6 : 4))); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sc = new THREE.Scene(); sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.8) })); sun.position.set(-55, 60, -55); sc.add(sun);
  const pm = new THREE.PMREMGenerator(r), tex = pm.fromScene(sc, 0.02).texture; pm.dispose(); return tex;
}
// ---- the sky (v3Sky): a dome round the camera — zenith to horizon, the sun's disc and its glow, clouds drifting
// (fbm noise on a plane high up, lit from the sun), stars by night — and the sun itself turning with the flat map's
// (SUN, art.js: a minute at a time from dawn to dusk): high and white at noon, low and orange at dawn and dusk, when
// the horizon and the clouds go golden and pink. The distance haze (the scene's fog) takes the horizon's colour ----
const V3_SKY_COL = { zen: '#5f8fc4', hor: '#c9d9e6', gold: '#f2a35e', pink: '#d98a8a', nzen: '#060b1a', nhor: '#1b2640' };
const V3_SUN_GOLD = '#ffa055', V3_CLOUD_K = 0.55, V3_HAZE = 0.75; // (the low sun's colour; how cloudy; the haze — from this × the view's depth)
function v3SkyInit() {
  const u = V3.skyU = { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 }, gold: { value: 0 }, cloud: { value: V3_CLOUD_K }, time: V3U.v3Time };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }`,
    fragmentShader: `uniform vec3 zen, hor, sunCol, sunDir; uniform float night, gold, cloud, time; varying vec3 vD;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vD); float y = max(d.y, 0.0), sd = max(dot(d, sunDir), 0.0);
        vec3 c = mix(hor, zen, pow(y, 0.55));
        // (the low sun: the horizon round it golden, pink farther off)
        float side = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(sunDir.x, 0.0, sunDir.z) + 1e-4)), 0.0), 3.0);
        c = mix(c, mix(vec3(0.85, 0.55, 0.55), vec3(0.98, 0.62, 0.32), side), gold * (1.0 - smoothstep(0.0, 0.45, y)) * (0.45 + 0.55 * side));
        c += sunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.35 + pow(sd, 6.0) * 0.12) * (1.0 - night * 0.85);
        // (the clouds: on a plane high up, drifting; thin at the horizon)
        if (d.y > 0.0) {
          vec2 q = d.xz / (d.y + 0.08) * 1.6 + vec2(time * 0.012, time * 0.004);
          float f = fbm(q), cv = smoothstep(0.62 - cloud * 0.3, 0.8 - cloud * 0.15, f) * smoothstep(0.0, 0.04, d.y);
          float lit = 0.75 + 0.25 * fbm(q + sunDir.xz * 0.15) + pow(sd, 8.0) * 0.6;
          vec3 cc = mix(vec3(0.94, 0.95, 0.97), vec3(1.0, 0.72, 0.5), gold) * lit;
          cc = mix(cc, vec3(0.09, 0.11, 0.17), night);
          c = mix(c, cc, cv * 0.85);
          // (the stars, by night, between the clouds)
          vec2 g = floor(d.xz / (d.y + 0.3) * 260.0); float st = step(0.9975, h2(g)) * night * (1.0 - cv) * smoothstep(0.05, 0.3, d.y);
          c += vec3(st * (0.6 + 0.4 * sin(time * 2.0 + h2(g + 3.0) * 40.0)));
        } else c = hor;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  V3.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m); V3.skyDome.frustumCulled = false; V3.skyDome.renderOrder = -10;
  V3.scene.add(V3.skyDome); V3.scene.background = null; V3.sunV = new THREE.Vector3(-1, 1.41, -1).normalize();
}
// a linear colour as the screen shows it: × the exposure, ACES (Three's fit) and sRGB
function v3Screened(c, out) {
  const k = V3.r.toneMappingExposure / 0.6, x = c.r * k, y = c.g * k, z = c.b * k;
  const i = [0.59719 * x + 0.35458 * y + 0.04823 * z, 0.076 * x + 0.90834 * y + 0.01566 * z, 0.0284 * x + 0.13383 * y + 0.83777 * z].map(v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
  const o = [1.60475 * i[0] - 0.53108 * i[1] - 0.07367 * i[2], -0.10208 * i[0] + 1.10813 * i[1] - 0.00605 * i[2], -0.00327 * i[0] - 0.07276 * i[1] + 1.07602 * i[2]];
  const s = v => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
  return out.setRGB(s(o[0]), s(o[1]), s(o[2]));
}
function v3Sky(d) {
  if (!V3.skyDome) v3SkyInit();
  sunTick(); // (the flat map turns its sun in its own frame — not drawn now)
  const k = V3.nightK || 0, u = V3.skyU, C = v3Tmp.skyC || (v3Tmp.skyC = Object.fromEntries(Object.entries(V3_SKY_COL).map(([a, b]) => [a, new THREE.Color(b)])));
  // (the sun's way: SUN's shadow per unit of height, turned to where the light comes from; noon as before, 45° up, lower to its ends)
  const L = Math.hypot(SUN.x, SUN.y) || 1, rel = L / 1.6, el = Math.atan(1 / rel), hx = -SUN.x / L, hy = -SUN.y / L;
  V3.sunV.set(hx * Math.cos(el), Math.sin(el), hy * Math.cos(el));
  // (the golden hour: the lower the sun the more — and it lasts into the dusk: the dark takes the sky's top first, the horizon last)
  const low = Math.min(1, Math.max(0, (rel - 1) / 1.4)), gold = Math.pow(low, 1.1) * (1 - k * k * 0.8);
  u.sunDir.value.copy(V3.sunV); u.night.value = k; u.gold.value = gold;
  u.zen.value.copy(C.zen).lerp(C.pink, gold * 0.25).lerp(C.nzen, Math.min(1, k * 1.3)); u.hor.value.copy(C.hor).lerp(C.gold, gold * 0.75).lerp(C.nhor, k * k);
  u.sunCol.value.set('#fff2dc').lerp(v3Tmp.sunG || (v3Tmp.sunG = new THREE.Color(V3_SUN_GOLD)), gold);
  // (a dust storm: the sky and the haze brown, the haze close — v3Weather dims the sun)
  const dw = s.extras ? Sim.weatherAt(s).dust : 0;
  if (dw > 0.001) { const dc = v3Tmp.dustC || (v3Tmp.dustC = new THREE.Color(V3_DUST.col)); u.hor.value.lerp(dc, V3_DUST.hor * dw); u.zen.value.lerp(dc, V3_DUST.zen * dw); u.sunCol.value.lerp(dc, 0.5 * dw); }
  V3.gold = gold;
  if (V3.farHills) V3.farHills.material.color.set(V3_FAR_COL).lerp(u.hor.value, 0.62 + 0.25 * k);
  V3.skyDome.position.copy(V3.cam.position); V3.skyDome.scale.setScalar(V3.cam.far * 0.8);
  // (the haze: the horizon's colour, from a little past the middle of the view)
  // (Three mixes the fog in after the tone mapping and the sRGB: its colour given as the horizon's comes out on the screen)
  const f = V3.scene.fog; v3Screened(u.hor.value, f.color); f.near = d * V3_HAZE * (1 - (1 - V3_DUST.near) * dw); f.far = (d * 2.6 + 900) * (1 - (1 - V3_DUST.far) * dw);
}
// ---- for the minimap (render.js drawMini): the ground's picture, small (once a map), and the ground under the screen's
// corners (the top ones held to the map's reach — over the horizon, the sky's ray ran off to the plain) ----
function v3MiniBg(w, h) {
  const tex = V3.ground && V3.ground.material.map; if (!tex || !tex.image) return null;
  if (V3.miniBg && V3.miniBg.of === tex && V3.miniBg.c.width === w) return V3.miniBg.c;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.filter = 'saturate(0.85) brightness(0.92)'; g.drawImage(tex.image, 0, 0, w, h); g.filter = 'none';
  V3.miniBg = { of: tex, c }; return c;
}
function v3ViewQuad() {
  if (!V3.cam || !V3.w) return null;
  const L = Math.max(s.W, s.H), cl = p => ({ x: Math.max(-L * 0.3, Math.min(s.W + L * 0.3, p.x)), y: Math.max(-L * 0.3, Math.min(s.H + L * 0.3, p.y)) });
  return [[0, 0], [V3.w, 0], [V3.w, V3.h], [0, V3.h]].map(([x, y]) => cl(v3World(x, y)));
}
// ---- the screen ↔ the world ----
// a point of the stage → the world: along the ray from the camera to where it first goes under the hills (steps,
// then halving); past the map, the plain
// ---- the camera's turn and tilt (V3.yaw: 0 = looking north, as the flat map; V3.pitch: down from level, V3_TILT_MIN..V3_TILT_MAX):
// a middle-button drag turns (across) and tilts (up and down), Ctrl + the arrows too, Home — back to north and V3_PITCH ----
const V3_TILT_MIN = 16 * Math.PI / 180, V3_TILT_MAX = 82 * Math.PI / 180, V3_TURN_PX = 0.006, V3_TILT_PX = 0.004;
V3.yaw = 0; V3.pitch = V3_PITCH;
function v3Orbit(dx, dy) {
  if (V3.follow) V3.follow.free = performance.now() + V3_FOLLOW.free; // (following: the player looks round a while)
  V3.yaw = (V3.yaw - dx * V3_TURN_PX) % (2 * Math.PI);
  V3.pitch = Math.max(V3_TILT_MIN, Math.min(V3_TILT_MAX, V3.pitch + dy * V3_TILT_PX));
}
function v3OrbitReset() { V3.yaw = 0; V3.pitch = V3_PITCH; }
function v3World(px, py) {
  const w = V3.w || 1, h = V3.h || 1, C = V3.cam;
  const o = C.position, d = new THREE.Vector3(px / w * 2 - 1, -(py / h * 2 - 1), 0.5).unproject(C).sub(o).normalize();
  const under = t => o.y + d.y * t <= v3E(o.x + d.x * t, o.z + d.z * t);
  const far = (o.y + 20) / Math.max(0.05, -d.y), step = Math.max(4, far / 300);
  let a = 0, b = -1;
  for (let t = step; t <= far * 1.5; t += step) { if (under(t)) { b = t; break; } a = t; }
  if (b < 0) { const t = o.y / Math.max(0.05, -d.y); return { x: o.x + d.x * t, y: o.z + d.z * t }; }
  for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (under(m)) b = m; else a = m; }
  return { x: o.x + d.x * b, y: o.z + d.z * b };
}
// a world point (on the ground there) → the stage
function v3Screen(x, y) {
  const p = new THREE.Vector3(x, v3E(x, y), y).project(V3.cam);
  return { x: (p.x + 1) / 2 * (V3.w || 1), y: (1 - p.y) / 2 * (V3.h || 1) };
}
// ---- the ground: a mesh over the height grid, a vertex a cell (the huge map: ~160 000), with the flat map's picture ----
// the ground's heights as shown (world units, one a point of the elevation grid): the elevation, with the hills sinking
// smoothly to each lake within V3_SHORE (cut into a hill, a lake was a pit with sheer walls — only the look: the
// simulation keeps its heights, and changing them dragged the bot games out), and the buildings' pads (v3Pads) on top.
// v3E — the height at any point, as shown: everything put on the ground stands on it
// the bank is at least V3_SHORE wide and V3_SHORE_K × the hill's height there (so never steeper than ~2/V3_SHORE_K), and it
// rises from the water at once and eases into the hill (q(2−q)); it was 160 wide and flat-steep-flat (smoothstep) — a
// flat ring by the water, then a sheer jagged wall all round
const V3_SHORE = 160, V3_SHORE_K = 3;
function v3Heights() {
  const E = s.elev, n = E.w * E.h, hg = new Float32Array(n), far = Math.max(V3_SHORE, (HILL_LEVELS + 1) * V3_LV * V3_SHORE_K);
  const box = s.lakes.map(l => [l, Math.max(l.rx, l.ry) * 1.3 + far]);
  for (let k = 0; k < n; k++) {
    let h = E.g[k] * V3_LV; if (!h) { hg[k] = 0; continue; }
    const x = (k % E.w) * ELEV_CELL, y = Math.floor(k / E.w) * ELEV_CELL, band = Math.max(V3_SHORE, h * V3_SHORE_K); let f = 1;
    for (const [l, R] of box) {
      if (Math.abs(x - l.x) >= R || Math.abs(y - l.y) >= R) continue;
      const d = (v3LakeR(l, x, y, 4) - 1) * Math.min(l.rx, l.ry); if (d < band) { const q = Math.max(0, d / band); f = Math.min(f, q * (2 - q)); }
    }
    hg[k] = h * f;
  }
  V3.hg = hg; V3.hgv = hg.slice(); V3.hgOf = E;
}
// how far out of a lake's outline (1 = on it): as lakeK, but without its shortcut far out — past 1.5 radii it jumps
// (d²/1.62), and the bank's slope jumped there: a fold in the ground all round each lake, half a radius out
function v3LakeR(l, x, y, pad) {
  const c = Math.cos(l.a), sn = Math.sin(l.a), dx = x - l.x, dy = y - l.y, u = (dx * c + dy * sn) / (l.rx + pad), v = (-dx * sn + dy * c) / (l.ry + pad);
  return Math.hypot(u, v) / wobble(l.w, Math.atan2(v, u));
}
function v3E(x, y, bare) { // (bare: without the pads — what a building's own pad is worked out from)
  const E = s.elev, g = V3.hgOf === E && (bare ? V3.hg : V3.hgv); if (!g) return Sim.elevAt(s, { x, y }) * V3_LV;
  const fx = Math.max(0, Math.min(E.w - 1.001, x / ELEV_CELL)), fy = Math.max(0, Math.min(E.h - 1.001, y / ELEV_CELL)), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, k = j * E.w + i;
  return (g[k] * (1 - a) + g[k + 1] * a) * (1 - b) + (g[k + E.w] * (1 - a) + g[k + E.w + 1] * a) * b;
}
function v3Ground() {
  if (V3.ground) { V3.scene.remove(V3.ground); V3.ground.geometry.dispose(); V3.ground.material.map.dispose(); V3.ground.material.dispose(); }
  v3Heights(); V3.padSig = null; V3.padTouched = null;
  const E = s.elev, nx = E.w, ny = E.h, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = Math.min(s.W, i * ELEV_CELL), y = Math.min(s.H, j * ELEV_CELL);
    pos[k * 3] = x; pos[k * 3 + 1] = V3.hg[k]; pos[k * 3 + 2] = y;
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
  { // (a small copy of it on the CPU: where grass is, for the tufts — v3Tufts)
    const w = 1024, h = Math.max(1, Math.round(w * s.H / s.W)), c = document.createElement('canvas'); c.width = w; c.height = h; const gc = c.getContext('2d', BG_CTX); gc.drawImage(tex.image, 0, 0, w, h);
    V3.gmap = { w, h, d: gc.getImageData(0, 0, w, h).data }; V3.tuftKey = null;
  }
  { // (the picture's mean light — linear, as the card sees it — what its light and dark over the textures are measured from)
    const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const gc = c.getContext('2d', BG_CTX); gc.drawImage(tex.image, 0, 0, N, N);
    const d = gc.getImageData(0, 0, N, N).data, lin = v => Math.pow(v / 255, 2.2); let L = 0;
    for (let i = 0; i < d.length; i += 4) L += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
    v3GroundTex(L / (N * N));
    // (the meadow's colour: of the green there, a clearly green one — what the ground round the map fades to, v3Apron;
    // a dull middle one read as dry grass to the layers, and the plain went brown)
    const gr = []; for (let i = 0; i < d.length; i += 4) { const c = [lin(d[i]), lin(d[i + 1]), lin(d[i + 2])]; if (c[1] > c[0] && c[1] > c[2]) gr.push(c); }
    gr.sort((a, b) => (b[1] - Math.max(b[0], b[2])) - (a[1] - Math.max(a[0], a[2]))); const md = gr[Math.floor(gr.length * 0.3)] || [0.06, 0.09, 0.03];
    V3U.v3Meadow.value = new THREE.Vector3(...md);
  }
  const m = new THREE.Mesh(g, v3Shaded(new THREE.MeshLambertMaterial({ map: tex }), true));
  m.castShadow = m.receiveShadow = true;
  V3.scene.add(m); V3.ground = m; V3.of = decor;
  v3Apron(m.material);
  v3FarHills();
}
// ---- round the map, to the horizon: the ground goes on (v3Apron) — a ring from each point of the map's edge outward,
// its height there sinking smoothly to the plain (V3_APRON: the rows' distances out; how far the hills' edge sinks), in
// the ground's own material (its uv past the picture: the edge's colours, faded in the shader to the meadow's, v3Meadow).
// A flat plain of its own met the map in a hard line, and a hill cut by the edge stood as a wall ----
const V3_APRON = { rows: [0, 30, 80, 160, 280, 450, 700, 1050, 1600, 2600, 4500, 8000, 15000, 30000], sink: 500, corner: 6 };
function v3Apron(mat) {
  if (V3.apron) { V3.scene.remove(V3.apron); V3.apron.geometry.dispose(); }
  const W = s.W, H = s.H, step = ELEV_CELL * 2, P = [], A = V3_APRON;
  const edge = (x0, y0, x1, y1, nx, ny) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) P.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, nx, ny]); };
  const corner = (x, y, a0) => { for (let i = 0; i <= A.corner; i++) { const a = a0 + i / A.corner * Math.PI / 2; P.push([x, y, Math.cos(a), Math.sin(a)]); } };
  edge(0, 0, W, 0, 0, -1); corner(W, 0, -Math.PI / 2); edge(W, 0, W, H, 1, 0); corner(W, H, 0); edge(W, H, 0, H, 0, 1); corner(0, H, Math.PI / 2); edge(0, H, 0, 0, -1, 0); corner(0, 0, Math.PI);
  const R = A.rows.length, N = P.length, pos = new Float32Array(N * R * 3), uv = new Float32Array(N * R * 2), idx = [];
  P.forEach(([x, y, nx, ny], i) => {
    const h0 = v3E(Math.min(W - 0.01, Math.max(0, x)), Math.min(H - 0.01, Math.max(0, y)));
    A.rows.forEach((d, j) => {
      const k = i * R + j, px = x + nx * d, py = y + ny * d, f = Math.min(1, d / A.sink), hh = j === 0 ? h0 : h0 * (1 - f * f * (3 - 2 * f)) - 2 * Math.min(1, d / 100);
      pos[k * 3] = px; pos[k * 3 + 1] = hh; pos[k * 3 + 2] = py; uv[k * 2] = px / W; uv[k * 2 + 1] = 1 - py / H;
    });
  });
  for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; for (let j = 0; j < R - 1; j++) { const a = i * R + j, b = i2 * R + j; idx.push(a, b, a + 1, b, b + 1, a + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; V3.scene.add(m); V3.apron = m;
}
// ---- hills far round the map (only to look at, never reached): a ring of ridges, V3_FAR_HILLS — from the edge (in),
// its crest (mid) and out — of the bigger side; heights h0..h1 world units; in the haze; else the plain met the sky in a ruler's line ----
const V3_FAR_HILLS = { in: 0.45, mid: 1.0, out: 1.7, h0: 200, h1: 950, n: 360 }, V3_FAR_COL = '#4f6438';
function v3FarHills() {
  if (V3.farHills) { V3.scene.remove(V3.farHills); V3.farHills.geometry.dispose(); }
  const F = V3_FAR_HILLS, L = Math.max(s.W, s.H), cx = s.W / 2, cy = s.H / 2, N = F.n, rows = [[F.in, 0], [(F.in * 2 + F.mid) / 3, 0.3], [(F.in + F.mid * 2) / 3, 0.75], [F.mid, 1], [(F.mid + F.out) / 2, 0.65], [F.out, 0.2]];
  let sd = (s.seed * 7919 + 77) % 2147483647 || 1; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, ph = [0, 0, 0, 0, 0].map(() => rnd() * 6.28);
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    // (from the middle to the map's edge along this way: the rectangle's half-sizes)
    const e = Math.min(s.W / 2 / Math.max(1e-3, Math.abs(ca)), s.H / 2 / Math.max(1e-3, Math.abs(sa)));
    const w = 0.5 + 0.22 * Math.sin(a * 3 + ph[0]) + 0.14 * Math.sin(a * 8 + ph[1]) + 0.08 * Math.sin(a * 19 + ph[2]) + 0.05 * Math.sin(a * 37 + ph[3]) + 0.03 * Math.sin(a * 71 + ph[4]);
    const hk = F.h0 + (F.h1 - F.h0) * Math.max(0, Math.min(1, w)) ** 1.6;
    for (const [r, k] of rows) { const d = e + r * L; pos.push(cx + ca * d, -2 + k * hk, cy + sa * d); }
  }
  const R = rows.length;
  for (let i = 0; i < N; i++) for (let j = 0; j < R - 1; j++) { const a = i * R + j, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // (its own haze, not the scene's: far past the haze's end, it would be a band of the horizon's colour — a hill half
  // gone into the air reads as far away; v3Sky mixes it each frame)
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#56683e', fog: false })); m.receiveShadow = false;
  V3.scene.add(m); V3.farHills = m;
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
  bg.x0 = 0; bg.y0 = 0; bg.w = s.W; bg.h = s.H; bg.quick = false; bg.noScen = v3HasScen(); bg.elev = { w: s.elev.w, h: s.elev.h, g: V3.hg.map(h => h / V3_LV) }; R.shade = { dark: none, lite: none }; R.contours = { cells: new Map(), n: 0 };
  try {
    g.fillStyle = colors.ground; g.fillRect(0, 0, w, h); g.setTransform(k, 0, 0, k, 0, 0);
    const grass = tilePat(g, 'grass1');
    if (grass) { g.fillStyle = grass; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = GROUND_TINT; g.fillStyle = colors.ground; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = 1; }
    drawTerrain(g, s.W, s.H, s.W / 2);
  } finally { [bg.x0, bg.y0, bg.w, bg.h, bg.quick] = keep; bg.noScen = false; bg.elev = null; R.shade = shade0; R.contours = cont0; }
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
  const e = 4, hx = (v3E(x + e, y) - v3E(x - e, y)) / (2 * e), hz = (v3E(x, y + e) - v3E(x, y - e)) / (2 * e);
  const t = v3Tmp; t.n.set(-hx, 1, -hz).normalize();
  t.yaw.setFromAxisAngle(t.up, -hd); t.q.setFromUnitVectors(t.up, lift ? t.up : t.n).multiply(t.yaw);
  if (lift && t.tilt) t.q.multiply(t.tilt); // (an aircraft: banked in a turn, a helicopter's nose down as it goes — v3AirTilt)
  t.off.set(ox, 0, oy).applyQuaternion(t.q);
  t.p.set(x + t.off.x, v3E(x, y) + 0.6 + lift + t.off.y, y + t.off.z);
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
  const H = MODELS[type].head, head = H ? `vec4(${H.map(v => v.toFixed(4)).join(', ')})` : ''; // (a soldier: the helmet in the side's colour — the ball round its head)
  const air = !!(Sim.TYPES[type] && Sim.TYPES[type].air) && type !== 'drone', fly = air && (Sim.TYPES[type].hover && part === 'turret' ? 'rotor' : true), wing = air && !Sim.TYPES[type].hover ? MODELS[type].size[2] / 2 : 0; // (a plane: its wingtips in the side's colour, not a roof panel; a rotor's blades: matt)
  const mesh = new THREE.InstancedMesh(v3Geo(type, part, side), v3Paint3(clean, head, type.startsWith('b_'), fly, wing), 64);
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
const V3_CAMO = 4, V3_SCHEMES = 4; // (patterns: 0 plain, 1 spots, 2 stripes, 3 woodland; schemes a side)
// (army colours, not toy ones: ours olive, forest green, grey-green, sand-olive; theirs desert tan, earth brown,
// khaki, grey — and which side, at a glance: a recognition panel across the roof in the side's colour, V3_PANEL)
const V3_PAL = [ // (sRGB: base, dark, light — blue's four, then red's)
  ['#5c6638', '#30361c', '#868a58'], ['#43512f', '#232c18', '#6f7d4f'], ['#5d6656', '#30362c', '#8c9484'], ['#706a48', '#3c3824', '#9c9670'],
  ['#94805a', '#5c4a2e', '#b4a078'], ['#7a5a3a', '#3e2c1a', '#a0805a'], ['#857852', '#4e4428', '#a89c74'], ['#6e6a62', '#3a3833', '#928e84']]; // (the lights not near white: sand in the sun was)
const V3_PANEL = ['#2d6be0', '#d8392b'], V3_PANEL_W = 0.07; // (blue, red; half its width, of the model's length)
function v3CamoOf(u, c) {
  const h = (u.id * 0.6180339) % 1, p = Math.floor(h * 97) % V3_CAMO, sc = (u.side === 'red' ? V3_SCHEMES : 0) + Math.floor(((u.id * 0.7548777) % 1) * V3_SCHEMES);
  return c.setRGB(1, -(p + 0.01 + h * 0.98), sc + 0.5);
}
// the units' and buildings' paint: a real material — a little rough and a little metal, reflecting the sky — with dirt
// on it (grime in blotches, the roughness varying) and mud low down (V3_MUD of the model's length; not on turrets or aircraft)
const V3_SAT = '0.8', V3_MUD = 0.16, V3_MUD_COL = [0.36, 0.3, 0.21]; // (dust low down, not dark mud: the land's dry)
// the units' paint (UNIT3D in ground3d.js — Poly Haven's green_metal_rust, its light and dark only): s — repeats to the model's length;
// k — how strong (cloth: the soldiers); nk — its dents; camo — how far the pattern's colours stay apart; panel — how much of the side's colour in the roof's panel
const V3_UNITT = { s: '2.6', k: '1.0', cloth: '0.3', nk: '0.8', camo: '0.6', panel: '0.85' };
// (aircraft: smoother paint, a little sheen — V3_GLOSS: roughness, metalness; a plane's side colour on its wingtips, past V3_TIP of its half span)
const V3_GLOSS = [0.5, 0.3], V3_TIP = 0.7;
function v3Paint3(clean, head, bld, fly, wing) {
  bld = bld && typeof BLD3D === 'object';
  const k = (clean ? 'vcolC' : 'vcol') + (head ? 'H' + head : '') + (bld ? 'B' : '') + (fly ? 'F' + fly + (wing || 0).toFixed(3) : '');
  if (!V3[k]) {
    const rotor = fly === 'rotor'; // (a rotor's thin blades: matt — the sky's sheen on them made them light grey sticks)
    V3[k] = v3Camo(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rotor ? 1 : fly ? V3_GLOSS[0] : 0.78, metalness: rotor ? 0 : fly ? V3_GLOSS[1] : 0.18, envMapIntensity: rotor ? V3_ENV * 0.25 : V3_ENV }));
    V3[k].defines = {}; if (!clean && !bld) V3[k].defines.V3_DIRTY = 1; if (head) V3[k].defines.V3_HEAD = head; if (wing) V3[k].defines.V3_SPAN = (wing * V3_TIP).toFixed(4); // (no mud on a building: its bottom is the whole floor of its base)
    if (bld) { V3[k].defines.V3_BLD = 1; v3BldTex(); } else if (typeof UNIT3D === 'object') { V3[k].defines.V3_UNIT = 1; v3BldTex(); }
  }
  return V3[k];
}
// ---- the buildings' surfaces (BLD3D in ground3d.js — Poly Haven, CC0): concrete floor on what faces up, concrete wall
// on what faces sideways, profiled metal sheet on the side-coloured roofs — laid on the model from three sides
// (triplanar, by where on it a point is), each as light and dark over the model's own colours (at its mean) and as a
// normal map. V3_BLDT: s — repeats to the model's length; k — how strong the light and dark; nk — the normal maps. ----
const V3_BLDT = { s: '7.0', ms: '9.0', k: '1.0', nk: '1.0', stain: '0.5', splash: '0.06', white: '0.45', base: '0.78' };
const V3B = { v3Bf: { value: null }, v3Bw: { value: null }, v3Bm: { value: null }, v3Bfn: { value: null }, v3Bwn: { value: null }, v3Bmn: { value: null }, v3Bavg: { value: null }, v3Up: { value: null }, v3Upn: { value: null }, v3Uavg: { value: 0.1 } }; // (the means: made with the textures — Three isn't loaded yet here)
function v3BldTex() {
  if (V3B.v3Bf.value || typeof BLD3D !== 'object') return;
  V3B.v3Bavg.value = new THREE.Vector3(0.2, 0.2, 0.2);
  const avg = (im, j) => { const N = 32, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', BG_CTX); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N).data; let L = 0; for (let i = 0; i < d.length; i += 4) L += 0.2126 * (d[i] / 255) ** 2.2 + 0.7152 * (d[i + 1] / 255) ** 2.2 + 0.0722 * (d[i + 2] / 255) ** 2.2; if (j > 2) V3B.v3Uavg.value = L / (N * N); else V3B.v3Bavg.value.setComponent(j, L / (N * N)); };
  const mk = (src, srgb, j) => {
    const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
    const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; if (j >= 0) avg(im, j); }; im.src = src; return t;
  };
  const B = BLD3D; V3B.v3Bf.value = mk(B.floor.d, 1, 0); V3B.v3Bw.value = mk(B.wall.d, 1, 1); V3B.v3Bm.value = mk(B.metal.d, 1, 2);
  V3B.v3Bfn.value = mk(B.floor.n, 0, -1); V3B.v3Bwn.value = mk(B.wall.n, 0, -1); V3B.v3Bmn.value = mk(B.metal.n, 0, -1);
  if (typeof UNIT3D === 'object') { V3B.v3Up.value = mk(UNIT3D.paint.d, 1, 3); V3B.v3Upn.value = mk(UNIT3D.paint.n, 0, -1); }
}
function v3Camo(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.v3Panel = { value: V3_PANEL.map(x => { const c = new THREE.Color(x); return new THREE.Vector3(c.r, c.g, c.b); }) };
    sh.uniforms.v3Pal = { value: V3_PAL.flat().map(x => { const c = new THREE.Color(x); return new THREE.Vector3(c.r, c.g, c.b); }) }; // (linear)
    Object.assign(sh.uniforms, V3B);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTeam; varying vec3 vP3; varying vec3 vN3; varying float vTeam; varying vec3 vPat; varying float vTint;\n#if defined(V3_BLD) || defined(V3_UNIT)\nvarying vec3 vTV0; varying vec3 vTV1; varying vec3 vTV2;\n#endif')
      .replace('#include <color_vertex>', `#include <color_vertex>
      vP3 = position; vN3 = normal; vTeam = aTeam; vPat = vec3(-1.0); vTint = 1.0;
      #if defined(V3_BLD) || defined(V3_UNIT)
        mat3 v3im = mat3(1.0);
        #ifdef USE_INSTANCING
          v3im = mat3(instanceMatrix);
        #endif
        vTV0 = normalMatrix * (v3im * vec3(1.0, 0.0, 0.0)); vTV1 = normalMatrix * (v3im * vec3(0.0, 1.0, 0.0)); vTV2 = normalMatrix * (v3im * vec3(0.0, 0.0, 1.0)); // (the model's frame, in the view)
      #endif
      #ifdef USE_INSTANCING_COLOR
      if (instanceColor.g < 0.0) { vPat = vec3(floor(-instanceColor.g), fract(-instanceColor.g), floor(instanceColor.b)); vColor.xyz = color.xyz * instanceColor.r; vTint = instanceColor.r; }
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 v3Pal[${V3_PAL.length * 3}]; uniform vec3 v3Panel[2]; varying vec3 vP3; varying vec3 vN3; varying float vTeam; varying vec3 vPat; varying float vTint;
      #ifdef V3_UNIT
        varying vec3 vTV0; varying vec3 vTV1; varying vec3 vTV2; uniform sampler2D v3Up; uniform sampler2D v3Upn; uniform float v3Uavg;
        vec3 v3W() { vec3 a = abs(normalize(vN3)); a = a * a; a = a * a; return a / max(a.x + a.y + a.z, 1e-4); }
      #endif
      #ifdef V3_BLD
        varying vec3 vTV0; varying vec3 vTV1; varying vec3 vTV2;
        uniform sampler2D v3Bf; uniform sampler2D v3Bw; uniform sampler2D v3Bm; uniform sampler2D v3Bfn; uniform sampler2D v3Bwn; uniform sampler2D v3Bmn; uniform vec3 v3Bavg;
        vec3 v3W() { vec3 a = abs(normalize(vN3)); a = a * a; a = a * a; return a / max(a.x + a.y + a.z, 1e-4); } // (how much each side's projection)
      #endif
      float v3h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float v3n(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(v3h(i), v3h(i + vec3(1,0,0)), f.x), mix(v3h(i + vec3(0,1,0)), v3h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(v3h(i + vec3(0,0,1)), v3h(i + vec3(1,0,1)), f.x), mix(v3h(i + vec3(0,1,1)), v3h(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vPat.x > -0.5 && vTeam > 0.01) {
        int b = int(vPat.z) * 3; vec3 c0 = v3Pal[b], c1 = v3Pal[b + 1], c2 = v3Pal[b + 2], q = vP3 + vPat.y * 17.0, c = c0;
        if (vPat.x > 0.5 && vPat.x < 1.5) { float n = v3n(q * 6.0) * 0.65 + v3n(q * 14.0) * 0.35; c = n < 0.4 ? c1 : n > 0.6 ? c2 : c0; }
        else if (vPat.x > 1.5 && vPat.x < 2.5) { float w = sin((vP3.x + vP3.z * 0.35 + vP3.y * 0.6) * 22.0 + v3n(q * 5.0) * 5.0); c = w > 0.35 ? c1 : w < -0.75 ? c2 : c0; }
        else if (vPat.x > 2.5) { float n = v3n(q * 3.2) * 0.7 + v3n(q * 9.0) * 0.3, m = v3n(q * 4.1 + 9.0) * 0.75 + v3n(q * 11.0) * 0.25; c = n < 0.42 ? c1 : m > 0.6 ? c2 : c0; } // (woodland: big soft patches)
        c = mix(c0, c, ${V3_UNITT.camo}); // (the pattern's colours nearer each other: paint faded in the sun)
        #ifdef V3_SPAN
        if (abs(vP3.z) > V3_SPAN) c = mix(c0, v3Panel[vPat.z < ${V3_SCHEMES}.0 ? 0 : 1], ${V3_UNITT.panel}) / max(vTeam, 0.5);
        #elif !defined(V3_HEAD)
        if (vN3.y > 0.55 && abs(vP3.x) < ${V3_PANEL_W}) c = mix(c0, v3Panel[vPat.z < ${V3_SCHEMES}.0 ? 0 : 1], ${V3_UNITT.panel}) / max(vTeam, 0.5);
        #endif
        diffuseColor.rgb = c * vTeam * vTint;
      }
      #ifdef V3_HEAD
      if (vPat.x > -0.5 && distance(vP3, V3_HEAD.xyz) < V3_HEAD.w && vP3.y > V3_HEAD.y - V3_HEAD.w * 0.3 && vN3.y > 0.3) diffuseColor.rgb = mix(diffuseColor.rgb, v3Panel[vPat.z < ${V3_SCHEMES}.0 ? 0 : 1] * 0.55 * vTint, 0.55); // (a helmet cover in the side's colour, muted)
      #endif
      float v3g = v3n(vP3 * 9.0 + 3.1) * 0.6 + v3n(vP3 * 31.0) * 0.4, v3m = 0.0;
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, ${V3_SAT}); // (paint a little faded)
      diffuseColor.rgb *= (0.78 + 0.3 * v3g) * (0.72 + 0.28 * smoothstep(-0.6, 0.4, vN3.y)); // (grime in blotches; under-sides darker)
      #ifdef V3_BLD
      { // (concrete and metal: their light and dark over the model's colours)
        vec3 w = v3W(), p = vP3 * ${V3_BLDT.s}, q = vP3 * ${V3_BLDT.ms}; float mt = smoothstep(0.0, 0.05, vTeam);
        vec3 L = vec3(0.2126, 0.7152, 0.0722);
        float conc = (dot(texture2D(v3Bf, p.xz).rgb, L) / v3Bavg.x) * w.y + (dot(texture2D(v3Bw, p.zy).rgb, L) * w.x + dot(texture2D(v3Bw, p.xy).rgb, L) * w.z) / v3Bavg.y;
        float met = (dot(texture2D(v3Bm, q.xz).rgb, L) * w.y + dot(texture2D(v3Bm, q.zy).rgb, L) * w.x + dot(texture2D(v3Bm, q.xy).rgb, L) * w.z) / v3Bavg.z;
        float d = mix(pow(max(conc, 0.0), 1.6), pow(max(met, 0.0), 1.3), mt);
        diffuseColor.rgb *= mix(1.0, d, ${V3_BLDT.k});
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, L)) * vec3(1.02, 1.0, 0.96), mt * 0.45); // (the roofs' paint faded)
        // (weather: wide stains, rain streaks down the walls, dirt splashed up from the ground, the roofs' edges darker)
        float st = v3n(vP3 * 3.1 + 7.0) * 0.6 + v3n(vP3 * 8.3) * 0.4;
        float side = 1.0 - w.y;
        float streak = v3n(vec3(vP3.x * 55.0 + vP3.z * 55.0, vP3.y * 3.0, vP3.z * 9.0)) * side;
        float low = (1.0 - smoothstep(0.0, ${V3_BLDT.splash}, vP3.y + (st - 0.5) * 0.02)) * side;
        float lu = dot(diffuseColor.rgb, L); diffuseColor.rgb *= 1.0 - ${V3_BLDT.white} * smoothstep(0.35, 0.8, lu); // (nothing clean white out there: the white roofs a weathered light grey)
        diffuseColor.rgb *= (1.0 - ${V3_BLDT.stain} * smoothstep(0.32, 0.68, st)) * (1.0 - 0.4 * smoothstep(0.45, 0.85, streak)) * (1.0 - 0.35 * low);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.13, 0.09), low * 0.35);
        float oil = smoothstep(0.62, 0.8, v3n(vP3 * 31.0 + 1.3) * 0.6 + v3n(vP3 * 83.0) * 0.4) * w.y * (1.0 - mt); // (oil and tyre marks on the floors)
        float dust = smoothstep(0.35, 0.75, v3n(vP3 * 5.3 + 4.0)) * w.y * (1.0 - mt); // (sand blown over them)
        diffuseColor.rgb *= ${V3_BLDT.base} * (1.0 - 0.4 * oil) * mix(vec3(1.0), vec3(0.84, 0.8, 0.72), w.y * (1.0 - mt)); // (the floors warmer and darker: sun-baked, dusty)
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.3, 0.21), dust * 0.35);
      }
      #endif
      #ifdef V3_UNIT
      { // (worn army paint: its light and dark, its scratches, over the model's colours — less on the soldiers' cloth)
        vec3 w = v3W(), p = vP3 * ${V3_UNITT.s}; vec3 L = vec3(0.2126, 0.7152, 0.0722);
        float d = (dot(texture2D(v3Up, p.zy).rgb, L) * w.x + dot(texture2D(v3Up, p.xz).rgb, L) * w.y + dot(texture2D(v3Up, p.xy).rgb, L) * w.z) / v3Uavg;
        #ifdef V3_HEAD
          float uk = ${V3_UNITT.cloth};
        #else
          float uk = ${V3_UNITT.k};
        #endif
        diffuseColor.rgb *= mix(1.0, pow(max(d, 0.0), 1.3), uk);
      }
      #endif
      #ifdef V3_DIRTY
      v3m = smoothstep(${V3_MUD.toFixed(3)}, 0.0, vP3.y + (v3g - 0.5) * 0.05) * 0.8;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${V3_MUD_COL.join(', ')}) * (0.8 + 0.4 * v3g), v3m);
      #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (v3g - 0.5) * 0.35 + v3m * 0.3, 0.3, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #ifdef V3_UNIT
      { // (the dents and edges of the plates: the paint's normal map from three sides)
        vec3 w = v3W(), p = vP3 * ${V3_UNITT.s};
        vec3 tx = texture2D(v3Upn, p.zy).xyz * 2.0 - 1.0, ty = texture2D(v3Upn, p.xz).xyz * 2.0 - 1.0, tz = texture2D(v3Upn, p.xy).xyz * 2.0 - 1.0;
        vec3 n0 = normalize(vN3), s = sign(n0);
        vec3 nm = n0 + (vec3(0.0, tx.y, tx.x * s.x) * w.x + vec3(ty.x, 0.0, ty.y) * w.y + vec3(tz.x * s.z, tz.y, 0.0) * w.z) * ${V3_UNITT.nk};
        normal = normalize(mat3(vTV0, vTV1, vTV2) * normalize(nm));
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif
      }
      #endif
      #ifdef V3_BLD
      { // (the normal maps, from three sides, in the model's frame — then to the view)
        vec3 w = v3W(), p = vP3 * ${V3_BLDT.s}, q = vP3 * ${V3_BLDT.ms}; float mt = smoothstep(0.0, 0.05, vTeam);
        vec3 ty = mix(texture2D(v3Bfn, p.xz).xyz, texture2D(v3Bmn, q.xz).xyz, mt) * 2.0 - 1.0;
        vec3 tx = mix(texture2D(v3Bwn, p.zy).xyz, texture2D(v3Bmn, q.zy).xyz, mt) * 2.0 - 1.0;
        vec3 tz = mix(texture2D(v3Bwn, p.xy).xyz, texture2D(v3Bmn, q.xy).xyz, mt) * 2.0 - 1.0;
        vec3 n0 = normalize(vN3), s = sign(n0);
        vec3 nm = n0 + (vec3(0.0, tx.y, tx.x * s.x) * w.x + vec3(ty.x, 0.0, ty.y) * w.y + vec3(tz.x * s.z, tz.y, 0.0) * w.z) * ${V3_BLDT.nk};
        normal = normalize(mat3(vTV0, vTV1, vTV2) * normalize(nm));
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif
      }
      #endif`);
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
    if (k === 'team') { let m = 0; for (let i = 0; i < n; i++) m += (u8[i * 12 + 9] + u8[i * 12 + 10] + u8[i * 12 + 11]) / 765; m = Math.max(0.01, M.tm || m / n); for (let i = 0; i < n; i++) at[i] = Math.min(1.5, Math.max(M.tm ? 0.15 : 0.45, (u8[i * 12 + 9] + u8[i * 12 + 10] + u8[i * 12 + 11]) / 765 / m)); } // (M.tm: the mean before the baked shade in its gaps — tools/models.py — so the shade stays)
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
function v3PutModel(type, side, x, y, hd, aim, m, tint, run, lift = 0, len = 0, rise = 1, pose = null, kick = 0, door = 0) {
  const D = MODELS[type], L = len || (D.poses ? V3_MAN / D.size[1] : (SIZE[type] || 10) * (V3_LEN[type] || 1.6)), H = v3Model(type, pose || 'hull', side);
  v3Put(H, v3Lay(x, y, hd, lift, L, L, 0, 0, m, L * rise), tint);
  if (D.parts.door) { // (a workshop's roller door: rolled up toward its top by `door`, 0..1)
    const g = v3Geo(type, 'door', side); if (!g.boundingBox) g.computeBoundingBox();
    const top = g.boundingBox.max.y, k = Math.min(0.97, door), dm = v3Tmp.dm || (v3Tmp.dm = new THREE.Matrix4()), dm2 = v3Tmp.dm2 || (v3Tmp.dm2 = new THREE.Matrix4());
    dm.makeScale(1, 1 - k, 1).setPosition(0, top * k, 0); v3Put(v3Model(type, 'door', side), dm2.multiplyMatrices(m, dm), tint);
  }
  if (D.parts.fan0) v3Put(v3Model(type, 'fan' + (tint && tint.r < 1 ? 0 : Math.floor(performance.now() / 1000 * V3_FAN + x * 0.37) & 3), side), m, tint); // (roof fans: a turn a frame — still on a site, a ruin, a memory)
  if (D.lights && V3.nightK > 0.02 && !(tint && tint.g >= 0) && !pose) { // (at night: its lamps lit — where they are now)
    const lv = v3Tmp.lv || (v3Tmp.lv = new THREE.Vector3()), A = V3.lamps;
    for (const l of D.lights) {
      if (l[3] === 'y') { const h = Math.sin(l[0] * 91.7 + l[2] * 37.3 + x * 0.13 + y * 0.07) * 4375.85; if (h - Math.floor(h) > V3.nightK * 1.4) continue; } // (the windows: lit one by one as it gets dark)
      lv.set(l[0], l[1], l[2]).applyMatrix4(m); A.push(lv.x, lv.y, lv.z, V3_LAMP_K.indexOf(l[3]));
    }
  }
  const K = D.track;
  if (K) ['L', 'R'].forEach((k, i) => { const r = run ? run[i] / (K.cycle * L) : 0, f = Math.floor((r - Math.floor(r)) * K.frames) % K.frames; v3Put(v3Model(type, 'track' + k + f, 'track'), m, tint); });
  if (!D.parts.turret) return;
  const t = v3Tmp, T = v3Model(type, 'turret', side), pv = D.pivot || [0, 0];
  t.off.set(pv[0] * L, 0, pv[1] * L).applyQuaternion(t.q); t.p.set(t.p.x + t.off.x, t.p.y + t.off.y, t.p.z + t.off.z);
  t.yaw.setFromAxisAngle(t.up, -aim); if (lift) t.q.multiply(t.yaw.setFromAxisAngle(t.up, hd - aim)); else t.q.setFromUnitVectors(t.up, t.n).multiply(t.yaw); // (a rotor: on its body, tilted with it — it stood on the slope of the ground below)
  if (kick) { t.off.set(-kick * V3_KICK * L, 0, 0).applyQuaternion(t.q); t.p.add(t.off); } // (the gun kicked back as it fires)
  v3Put(T, m.compose(t.p, t.q, t.sc.set(L, L, L)), tint);
  if (lift && !(tint && tint.g >= 0) && Sim.TYPES[type] && Sim.TYPES[type].air) v3Blur(type, m, L); // (a rotor turning: a faint disc where its blades sweep)
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
// ---- aircraft in flight: a plane banks into its turn (V3_BANK × how fast it turns, up to V3_BANK_MAX), a helicopter
// dips its nose as it goes (V3_PITCH_K × its speed, up to V3_PITCH_MAX) and leans a little into a turn — eased
// (V3_EASE a second); and what v3Fx draws for them (V3.airNow): a jet's hot nozzle and its faint vapour trail
// (V3_TRAIL s of where it was), the dust a helicopter's downwash raises below it ----
const V3_BANK = 0.55, V3_BANK_MAX = 0.75, V3_PITCH_K = 0.006, V3_PITCH_MAX = 0.28, V3_EASE = 4, V3_TRAIL = 1.4;
function v3AirTilt(u, T) {
  const A = V3.air || (V3.air = new Map()), now = performance.now() / 1000; let st = A.get(u.id);
  if (!st || now - st.t > 1) { st = { hd: u.hd || 0, x: u.x, y: u.y, t: now, bank: 0, pitch: 0, sp: 0, hist: [], ht: 0 }; A.set(u.id, st); }
  const dt = Math.max(1e-3, now - st.t), hd = u.hd || 0; let dh = hd - st.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  const sp = rate ? Math.hypot(u.x - st.x, u.y - st.y) / dt / Math.max(0.1, rate) : 0, w = rate ? dh / dt / Math.max(0.1, rate) : 0, e = Math.min(1, dt * V3_EASE);
  st.sp += (sp - st.sp) * e;
  const bank = Math.max(-V3_BANK_MAX, Math.min(V3_BANK_MAX, w * V3_BANK * (T.hover ? 0.4 : 1)));
  st.bank += (bank - st.bank) * e; st.pitch += ((T.hover || u.type === 'lift' ? -Math.min(V3_PITCH_MAX, st.sp * V3_PITCH_K) : 0) - st.pitch) * e;
  st.hd = hd; st.x = u.x; st.y = u.y; st.t = now;
  const q = v3Tmp.tq || (v3Tmp.tq = new THREE.Quaternion()), eu = v3Tmp.te || (v3Tmp.te = new THREE.Euler());
  v3Tmp.tilt = q.setFromEuler(eu.set(st.bank, 0, st.pitch, 'XZY'));
  if (!st.hist.length || now - st.ht > 0.06) { st.hist.push([u.x, u.y, now]); st.ht = now; }
  while (st.hist.length && now - st.hist[0][2] > V3_TRAIL) st.hist.shift();
  (V3.airNow || (V3.airNow = [])).push({ u, st, T });
}
function v3Units() {
  const m = v3Tmp.m || (v3Tmp.m = new THREE.Matrix4()), rings = []; V3.airNow = []; V3.discs = [];
  // (what the player sees, as the flat map: ours where the picture is exact, theirs where seen)
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (s.fog && !((u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u))) continue;
    const T = Sim.TYPES[u.type], lift = T.air ? V3_AIR : 0, hd = u.hd || 0;
    if (anim.s !== s) { anim.s = s; anim.walk.clear(); anim.last.clear(); tracks.length = 0; dust.length = 0; }
    if (!T.air) stride(u); // (as the flat map: the tracks and dust it leaves)
    if (s.fog && u.side === 'red') anim.last.set(u.id, { x: u.x, y: u.y, type: u.type, side: u.side, hd: u.hd, t: s.t }); // (out of sight: its ghost, below)
    if (u.type === 'tank' && u.dig > 0 && !u.dug && v3HasModel('inf')) { const p = digger(u); v3PutModel('inf', u.side, p.x, p.y, p.a, 0, m, null, null, 0.01, 0, 1, 'pose' + (Math.floor(performance.now() / 160) % MODELS.inf.poses)); } // (its crewman digging the berm)
    if (T.air && v3HasModel(u.type)) v3AirTilt(u, T);
    if (v3HasModel(u.type)) {
      const man = !!MODELS[u.type].poses, pose = v3Walk(u), face = man && s.t - u.lastFire < 3 ? u.aim : hd; // (a soldier faces where it fires, and stands upright)
      v3PutModel(u.type, u.side, u.x, u.y, face, T.hover || u.type === 'lift' ? performance.now() / 1000 * V3_ROTOR + u.id : s.t - u.lastFire < 3 ? u.aim : hd, m, v3CamoOf(u, v3Tmp.camo || (v3Tmp.camo = new THREE.Color())), T.air || man ? null : v3Run(u, hd), man ? 0.01 : lift, 0, 1, pose, u.type === 'tank' || u.type === 'how' ? Math.max(0, 1 - (s.t - u.lastFire) / 0.25) : 0);
    }
    else { const P = v3Pic(u.type, u.side); v3Put(P, v3Lay(u.x, u.y, hd, lift, P.w, P.h, 0, 0, m)); }
    v3Tmp.tilt = null;
    if (u.type === 'tank' && hasSprite('tank') && !v3HasModel('tank')) { // (the turret, turned to where it fires)
      const R = v3Pic('turret', u.side), H = SPRITES.tank_hull, k = SIZE.tank, sc = SPRITE_LEN.tank * k / H.w;
      const aim = s.t - u.lastFire < 3 ? u.aim : hd, px = (H.px - H.w / 2) * sc, py = (H.py - H.h / 2) * sc;
      const cx = u.x + Math.cos(hd) * px - Math.sin(hd) * py, cy = u.y + Math.sin(hd) * px + Math.cos(hd) * py;
      v3Put(R, v3Lay(cx + Math.cos(aim) * R.ox - Math.sin(aim) * R.oy, cy + Math.sin(aim) * R.ox + Math.cos(aim) * R.oy, aim, 0.4, R.w, R.h, 0, 0, m));
    }
    if (!lite) V3.discs.push(u.x, u.y, (SIZE[u.type] || 8) * (CAR.has(u.type) || T.air ? (V3_LEN[u.type] || 1.6) * V3_DISC.veh : V3_DISC.foot), u.side === 'blue' ? 0 : 1); // (its side's colour on the ground under it — v3Deco)
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
    o.position.set(g.x, v3E(g.x, g.y) + 1 + (g.air ? V3_AIR : 0), g.y); o.scale.set(g.r * V3_RING.k, 1, g.r * V3_RING.k); o.updateMatrix(); V3.rings.setMatrixAt(n++, o.matrix);
  }
  V3.rings.count = n; V3.rings.instanceMatrix.needsUpdate = true;
}
// ---- the buildings: the flat map's picture of each (buildingPic, in the holder's colour) lying on the ground; going
// up — dark, lighter as the work is done; remembered (the enemy's, out of sight) — dim. Under each, an unseen block
// of about its size that throws the sun's shadow (so a flat picture still stands). Drones: their picture up in the air,
// turning slowly. ----
const V3_BLD_K = 1.0; // (a building's model: its length, of its picture's)
const V3_HURT = 0.6, V3_BURNT = 0.3, V3_RUIN = 0.3, V3_RUIN_H = 0.08, V3_RUBBLE = 44, V3_COLLAPSE = { t: 2.2, dust: 4.5, n: 26 }; // (hurt below this: darker, to V3_BURNT at nothing; a ruin: this dark, of its height)
const V3_BLOCK = { hq: 0.9, fhq: 0.6, decoy: 0.9, tower: 3.2, antenna: 2.4, radar: 1.4, power: 1.1 }, V3_SITE = 0.3, V3_MEM = 0.55;
function v3Building(kind, col, px) {
  const own = BUILDING_PIC[kind], bare = !!(own && sprite.img[own]), key = 'b:' + kind + col + px;
  const P = V3.pics.get(key); if (P) return P;
  const pic = buildingPic(kind, col, px, bare);
  // (not darkened by its own block's shadow, which falls on it too)
  const S = v3Sheet(key, pic, pic.width / ART_RES, pic.height / ART_RES); S.mesh.receiveShadow = false; S.flat = true; return S;
}
// the ground under each building levelled to its base (V3_PAD more round it, sloping back to the hill), worked out again
// only when the buildings change (their places, rounded); the heights kept from the elevation grid are put back first
const V3_PAD = 28;
function v3Pads(pads) {
  const G = V3.ground; if (!G) return;
  const sig = pads.map(p => p.map(v => Math.round(v)).join(',')).join(';'); if (sig === V3.padSig && V3.padOf === G) return;
  V3.padSig = sig; V3.padOf = G;
  const P = G.geometry.attributes.position, E = s.elev, nx = E.w;
  if (V3.padTouched) for (const k of V3.padTouched) P.array[k * 3 + 1] = V3.hgv[k] = V3.hg[k];
  const touched = new Set(), w = new Map();
  for (const [x, y, L, W, base] of pads) {
    const i0 = Math.max(0, Math.floor((x - L / 2 - V3_PAD) / ELEV_CELL)), i1 = Math.min(nx - 1, Math.ceil((x + L / 2 + V3_PAD) / ELEV_CELL));
    const j0 = Math.max(0, Math.floor((y - W / 2 - V3_PAD) / ELEV_CELL)), j1 = Math.min(E.h - 1, Math.ceil((y + W / 2 + V3_PAD) / ELEV_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, ex = Math.max(0, Math.abs(i * ELEV_CELL - x) - L / 2), ey = Math.max(0, Math.abs(j * ELEV_CELL - y) - W / 2), d = Math.hypot(ex, ey) / V3_PAD;
      if (d >= 1) continue; const f = 1 - d * d * (3 - 2 * d); if (f <= (w.get(k) || 0)) continue; // (the nearer building's pad wins)
      w.set(k, f); P.array[k * 3 + 1] = V3.hgv[k] = V3.hg[k] * (1 - f) + base * f; touched.add(k);
    }
  }
  V3.padTouched = touched; P.needsUpdate = true; G.geometry.computeVertexNormals();
}
// (buildings alive: a radar dish's turn, rad/s; a roller door — up, open, down, s; roof fans — turns of a quarter a second)
const V3_DISH = 0.9, V3_DOOR = { up: 1.2, open: 3.5, down: 2.0 }, V3_FAN = 14;
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
  let nb = 0, np = 0, nr = 0; const pads = [];
  const now = performance.now() / 1000, doors = V3.doors || (V3.doors = new Map());
  const put = (kind, col, x, y, R, px, k, side, grow = 1, n = null) => {
    // (a model of it, if there is one — art/models/b_<kind>.glb: facing the enemy, going up as it's built)
    // (level, between the middle height of its corners and the highest — a little into the slope above — on a plinth down to the lowest:
    // tilted with the ground it leaned, and at the highest corner it stood on a tower)
    if (v3HasModel('b_' + kind)) {
      const L = px * V3_BLD_K, W = MODELS['b_' + kind].size[2] * L, g = (dx, dy) => v3E(x + dx, y + dy, true);
      // (half dug in, half built up: the ground under it levelled to halfway between its lowest and highest corner — cut
      // into the slope on the high side, a bank on the low one — v3Pads; it stood on a tall mound to its highest corner)
      const hs = [g(-L / 2, -W / 2), g(L / 2, -W / 2), g(-L / 2, W / 2), g(L / 2, W / 2), g(0, 0)], base = (Math.min(...hs) + Math.max(...hs)) / 2;
      pads.push([x, y, L, W, base]);
      // (alive: a radar dish turns, a workshop's door rolls up as a unit comes out — n.prog falls back — and down again)
      const hd = side === 'red' ? Math.PI : 0, live = k >= 1 && grow >= 1, aim = live ? hd - now * V3_DISH - x * 0.01 : 0;
      let door = 0;
      if (n && live && MODELS['b_' + kind].parts.door) {
        const d = doors.get(n.id) || { p: n.prog || 0, at: -99 }; if ((n.prog || 0) < d.p - 0.3) d.at = now; d.p = n.prog || 0; doors.set(n.id, d);
        const t = now - d.at, F = V3_DOOR; door = t < F.up ? t / F.up : t < F.up + F.open ? 1 : Math.max(0, 1 - (t - F.up - F.open) / F.down);
      }
      v3PutModel('b_' + kind, side || 'none', x, y, hd, aim, m, k < 1 ? tint.setScalar(Math.max(0.35, k)) : null, null, base - hs[4] + 0.01, L, Math.max(0.12, grow), null, 0, door * door * (3 - 2 * door));
      return;
    }
    const P = v3Building(kind, col, px);
    v3Put(P, v3Lay(x, y, 0, 0, P.w, P.h, 0, 0, m), k < 1 ? tint.setScalar(k) : null);
    if (nb < 800) { const hgt = R * (V3_BLOCK[kind] || 0.75) * Math.min(1, k); o.position.set(x, v3E(x, y) + hgt / 2, y); o.scale.set(R * 1.3, hgt, R * 1.3); o.updateMatrix(); V3.blocks.setMatrixAt(nb++, o.matrix); }
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
    put(n.kind, col, n.x, n.y, S.r, pxOf(n.kind), on ? (hurt < V3_HURT ? V3_BURNT + (1 - V3_BURNT) * hurt / V3_HURT : 1) : V3_SITE + (1 - V3_SITE) * grow, n.side, grow, n);
    if (selNode === n.id) rings.push({ x: n.x, y: n.y, r: S.r + 10 });
  }
  // (the ruins of buildings destroyed: the model, dark and low — unless a new one stands on it)
  for (const r of s.ruins || []) {
    if ((s.fog && !shownAt(r)) || s.nodes.some(n => n.kind !== 'drone' && Math.hypot(n.x - r.x, n.y - r.y) < Sim.STRUCTS[n.kind].r)) continue;
    // (just destroyed: it comes down — sinking and darkening over V3_COLLAPSE.t s, the heap growing, in a cloud of
    // dust — v3Fx; then the ruin as it stays)
    const age = s.t - r.t, k = age < V3_COLLAPSE.t ? 1 - (1 - Math.max(0, age) / V3_COLLAPSE.t) ** 2 : 1;
    put(r.kind, colors[r.side], r.x, r.y, Sim.STRUCTS[r.kind].r, pxOf(r.kind), 0.75 + (V3_RUIN - 0.75) * k, r.side, 1 + (V3_RUIN_H - 1) * k);
    // (and over it a heap of debris: blocks of concrete, burnt beams, sheets of the roof — the same each frame, from where it stood)
    const R = Sim.STRUCTS[r.kind].r, g = v3E(r.x, r.y);
    for (let i = 0; i < V3_RUBBLE * k && nr < 4000; i++) {
      const h = (j) => { const v = Math.sin(r.x * 12.9898 + r.y * 78.233 + i * 37.719 + j * 4.581) * 43758.5453; return v - Math.floor(v); };
      const a = h(1) * 6.28, d = Math.sqrt(h(2)) * R * 0.85, w = 2 + h(3) * R * 0.35, kind = h(4);
      o.position.set(r.x + Math.cos(a) * d, g + 0.8 + (1 - d / R) * R * 0.22 * h(5), r.y + Math.sin(a) * d * 0.8); // (heaped up in the middle)
      o.rotation.set((h(6) - 0.5) * 1.2, h(7) * 6.28, (h(8) - 0.5) * 1.2);
      o.scale.set(w, kind < 0.6 ? w * 0.45 : 0.6, kind < 0.6 ? w * 0.7 : w * 0.25); o.updateMatrix(); V3.rubble.setMatrixAt(nr, o.matrix);
      V3.rubble.setColorAt(nr++, tint.set(kind < 0.6 ? 0x6f6a62 : kind < 0.85 ? 0x2a2420 : colors[r.side]).multiplyScalar(0.55 + h(9) * 0.35));
    }
  }
  V3.rubble.count = nr; V3.rubble.instanceMatrix.needsUpdate = true; if (V3.rubble.instanceColor) V3.rubble.instanceColor.needsUpdate = true;
  if (s.fog) for (const id in s.memNodes.blue) if (!s.visNodes.blue.has(+id)) { const g = s.memNodes.blue[id]; if (g.kind === 'drone') continue; /* (a drone gone out of sight isn't 'remembered' where it was: it flies on — it showed as its icon, a flying saucer) */ put(g.kind, colors.red, g.x, g.y, Sim.STRUCTS[g.kind].r, pxOf(g.kind), V3_MEM, 'red'); }
  if (s.posts) for (const p of s.posts) { const R = Sim.POSTS[p.kind].r; put(p.kind, postCol(p), p.x, p.y, R, Math.round(R * 2.4), s.fog && !postSeen(p) ? V3_MEM : 1, p.side); if (selPost === p) rings.push({ x: p.x, y: p.y, r: R + 10 }); }
  v3Flags();
  v3Pads(pads); V3.blocks.count = nb; V3.blocks.instanceMatrix.needsUpdate = true; V3.plinth.count = np; V3.plinth.instanceMatrix.needsUpdate = true;
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
    f.g.position.set(x, v3E(x, y), y); f.g.rotation.y = -wa; // (the cloth streams down the wind)
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
const V3_FX_MAX = 6000, V3_BLAST_LIGHTS = 3, V3_BLAST_LIT = 0.12; // (the blasts' lights: how many; how bright for each unit of blast)
// (a lamp's glow at night: d across (world units), colour, how bright at full dark; some: of the windows, the share lit; blink: on and off)
const V3_LAMP_K = ['h', 'w', 'f', 'y', 'r', 'g'], V3_LAMP = { h: { d: 7, c: [1, 0.95, 0.75], a: 0.9 }, w: { d: 5, c: [1, 0.95, 0.8], a: 0.8 }, f: { d: 16, c: [1, 0.96, 0.82], a: 0.85 },
  y: { d: 4.5, c: [1, 0.72, 0.35], a: 0.75, some: 0.6 }, r: { d: 5, c: [1, 0.15, 0.1], a: 0.9, blink: true }, g: { d: 5, c: [0.2, 1, 0.45], a: 0.9 } };
function v3SoftPic(stops) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  for (const [k, col] of stops) r.addColorStop(k, col);
  g.fillStyle = r; g.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(c); return t;
}
// a picture of four (2 × 2) puffs of noise, seen from the side: smoke — billows lit from above, darker under; fire —
// flames, hot (white) inside; ring — a thin round of dust (the shock wave on the ground)
function v3NoisePic(kind) {
  const N = 256, H = N / 2, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N), D = im.data;
  if (kind === 'ring') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - H, y - H) / H, a = Math.max(0, 1 - Math.abs(d - 0.8) / 0.16) * (d < 1 ? 1 : 0); const i = (y * N + x) * 4; D[i] = D[i + 1] = D[i + 2] = 255; D[i + 3] = 255 * a * a; }
    g.putImageData(im, 0, 0); const tx = new THREE.CanvasTexture(c); return tx;
  }
  const P = new Uint8Array(512); { let s = 99; for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1), k = P[i]; P[i] = P[j]; P[j] = k; } for (let i = 0; i < 256; i++) P[i + 256] = P[i]; }
  const h = (x, y) => P[(P[x & 255] + y) & 255] / 255, sm = v => v * v * (3 - 2 * v);
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j); return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fy) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fy; };
  const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2.03, y * 2.03) * 0.25 + vn(x * 4.1, y * 4.1) * 0.15 + vn(x * 8.3, y * 8.3) * 0.1;
  const Q = N / 2;
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * Q, oy = Math.floor(q / 2) * Q, sx = q * 13.7, sy = q * 7.1;
    for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
      const u = (x + 0.5) / Q * 2 - 1, v = (y + 0.5) / Q * 2 - 1, r = Math.hypot(u, v), n = fbm(u * 2.6 + sx, v * 2.6 + sy), i = ((oy + y) * N + ox + x) * 4;
      if (kind === 'smoke') {
        const edge = 1 - Math.min(1, r * (0.75 + 0.5 * n)), a = Math.max(0, Math.min(1, (edge - 0.08) * 2.2)) * (0.55 + 0.45 * n);
        const lit = 0.55 + 0.35 * (1 - (v + 1) / 2) + 0.25 * (n - 0.5) * 2; // (lit from above: the top of a billow bright, its underside dark)
        const L = Math.max(0, Math.min(255, 255 * lit)); D[i] = L; D[i + 1] = L * 0.98; D[i + 2] = L * 0.95; D[i + 3] = 255 * a;
      } else {
        const n2 = fbm(u * 5.3 + sy, v * 5.3 - sx), heat = Math.max(0, 1 - r * (0.55 + 1.3 * n) - (n2 - 0.5) * 0.35), a = Math.max(0, Math.min(1, heat * 2.6 - 0.2)); // (ragged: tongues of flame, not a disc)
        const w = Math.min(1, heat * 1.8); D[i] = 255; D[i + 1] = 255 * (0.45 + 0.55 * w); D[i + 2] = 255 * (0.15 + 0.85 * w * w); D[i + 3] = 255 * a;
      }
    }
  }
  g.putImageData(im, 0, 0); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function v3Bill(add, flat, tex, atlas) {
  const geo = new THREE.PlaneGeometry(1, 1), col = new THREE.InstancedBufferAttribute(new Float32Array(V3_FX_MAX * 4), 4), rot = new THREE.InstancedBufferAttribute(new Float32Array(V3_FX_MAX * 2), 2);
  col.setUsage(THREE.DynamicDrawUsage); rot.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aCol', col); geo.setAttribute('aRot', rot);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec4 aCol; attribute vec2 aRot; varying vec4 vCol; varying vec2 vUv;
      void main() { vCol = aCol; vec3 c = instanceMatrix[3].xyz; float k = length(instanceMatrix[0].xyz);
        float cs = cos(aRot.x), sn = sin(aRot.x); vec2 q = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs);
        vUv = uv; ${atlas ? 'vUv = (uv + vec2(mod(aRot.y, 2.0), floor(aRot.y / 2.0))) * 0.5;' : ''}
        ${flat ? 'gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(q.x, 0.0, -q.y) * k, 1.0);'
               : 'vec4 mv = modelViewMatrix * vec4(c, 1.0); mv.xy += q * k; mv.xyz *= 1.0 - min(0.6 * k, -mv.z * 0.5) / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv;' /* (pulled toward the camera by part of its size: a wall next to it doesn't slice it) */} }`,
    fragmentShader: `uniform sampler2D map; varying vec4 vCol; varying vec2 vUv;
      void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a); }`,
  });
  const m = new THREE.InstancedMesh(geo, mat, V3_FX_MAX); m.frustumCulled = false; m.renderOrder = add ? 6 : 5; m.count = 0;
  V3.scene.add(m); return { m, col, rot, n: 0 };
}
function v3FxInit() {
  const light = v3SoftPic([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']]);
  const puffT = v3SoftPic([[0, 'rgba(255,255,255,.9)'], [0.55, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
  V3.fx = { glow: v3Bill(true, false, light), smoke: v3Bill(false, false, v3NoisePic('smoke'), true), fire: v3Bill(true, false, v3NoisePic('fire'), true),
    mark: v3Bill(false, true, puffT), ring: v3Bill(false, true, v3NoisePic('ring')) };
  // (the blasts' light on what's round them: a few lights, given to the biggest blasts of the moment)
  V3.blastLights = [];
  for (let i = 0; i < V3_BLAST_LIGHTS; i++) { const L = new THREE.PointLight('#ffa050', 0, 1, 1.2); V3.scene.add(L); V3.blastLights.push(L); }
  V3.flareLights = []; // (the flares' cold white light: the nearest few to the middle of the screen)
  for (let i = 0; i < V3_FLARE.n; i++) { const L = new THREE.PointLight('#e9eeff', 0, V3_FLARE.dist, 1); V3.scene.add(L); V3.flareLights.push(L); }
  V3.boltLight = new THREE.PointLight('#dfe8ff', 0, V3_BOLT.dist, 1); V3.scene.add(V3.boltLight); // (lightning's light: v3BoltFx)
}
// (flares in 3D: n lights, each this bright at its brightest and reaching dist; the glow's size)
const V3_FLARE = { n: 3, k: 120, dist: 700, glow: 20 };
// one more: at (x, h, y) world, d across, colour [r, g, b] (0–1), a; ang: turned (radians), v: which of the four pictures
function v3Dot(B, x, h, y, d, r, g, b, a, ang = 0, v = 0) {
  if (B.n >= V3_FX_MAX || a <= 0.004) return;
  const o = v3Tmp.fm || (v3Tmp.fm = new THREE.Matrix4());
  o.makeScale(d, d, d); o.setPosition(x, h, y); B.m.setMatrixAt(B.n, o);
  const k = B.n * 4, A = B.col.array; A[k] = r; A[k + 1] = g; A[k + 2] = b; A[k + 3] = a;
  B.rot.array[B.n * 2] = ang; B.rot.array[B.n * 2 + 1] = v; B.n++;
}
// (a number 0..1 from a seed, the same every frame)
const v3Rnd = (s, i) => { const v = Math.sin(s * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
const v3Gnd = (x, y) => v3E(x, y);
// weapons that fire at aircraft (their shot ends up in the air) / from aircraft
const V3_UP = new Set(['aa', 'ajeep', 'arrow', 'dome']), V3_FROM_AIR = new Set(['air', 'heli', 'gunship']);
function v3Fx() {
  if (!V3.fx) v3FxInit();
  const F = V3.fx; for (const B of Object.values(F)) B.n = 0;
  smokeTick(); scorchTick();
  // dust kicked up behind vehicles and soldiers (stride, as the flat map's drawDust)
  while (dust.length && s.t - dust[0].t > DUST_T) dust.shift();
  if (!lite) for (const p of dust) { const a = (s.t - p.t) / DUST_T; if (a >= 0 && a < 1) v3Dot(F.smoke, p.x, v3Gnd(p.x, p.y) + 1.5 + a * 3, p.y, p.r * (2.2 + a * 3.5), 0.8, 0.74, 0.6, p.a * (1 - a) * 0.9); }
  v3FogBanks(F); // (the morning fog lying in the low ground)
  v3DustClouds(F); v3BoltFx(F); // (a dust storm rolling over the ground; a lightning strike)
  // woods on fire (Sim fireTick): tongues of flame on each burning square, flickering, and a glow over it — the smoke
  // is smokeTick's (both views)
  const ft = performance.now() / 1000;
  for (const p of firesOn(V3.box)) {
    const g = v3Gnd(p.x, p.y), k = 1 - p.f * 0.55;
    for (let i = 0; i < 4; i++) {
      const ph = (ft * (1.3 + v3Rnd(p.c, i) * 0.8) + v3Rnd(p.c, i + 9)) % 1, x = p.x + (v3Rnd(p.c, i + 3) - 0.5) * 14, y = p.y + (v3Rnd(p.c, i + 5) - 0.5) * 14;
      v3Dot(F.fire, x, g + 6 + ph * 28 * k, y, (11 + 9 * v3Rnd(p.c, i + 7)) * k * (1 - ph * 0.5), 1, 0.55 - ph * 0.25, 0.2, 0.85 * (1 - ph) * Math.min(1, ph * 6), ph * 3 + i, i & 3);
    }
    v3Dot(F.glow, p.x, g + 8, p.y, 34 * k, 1, 0.45, 0.12, 0.35 * (0.8 + 0.2 * Math.sin(ft * 11 + p.c)));
  }
  // a building coming down (v3Nodes: the ruin sinking): a cloud of dust rolling out from its foot, rising and thinning
  for (const r of s.ruins || []) {
    const age = s.t - r.t; if (age < 0 || age > V3_COLLAPSE.dust || (s.fog && !shownAt(r))) continue;
    const R = Sim.STRUCTS[r.kind].r, g = v3Gnd(r.x, r.y), f = age / V3_COLLAPSE.dust;
    for (let i = 0; i < V3_COLLAPSE.n; i++) {
      const a = v3Rnd(r.x + r.y, i) * 6.28, d = R * (0.5 + 0.9 * Math.sqrt(f) * (0.6 + 0.6 * v3Rnd(r.y, i))), up = v3Rnd(r.x, i + 50) * R * 0.5 + age * 7;
      v3Dot(F.smoke, r.x + Math.cos(a) * d, g + 2 + up, r.y + Math.sin(a) * d, R * (0.55 + 1.1 * f) * (0.7 + 0.6 * v3Rnd(r.x, i + 9)), 0.6, 0.56, 0.49, 0.62 * (1 - f) * Math.min(1, age * 4), a, i & 3);
    }
  }
  // clods of earth off the tracks (addTrack: thrown back and up, falling) — dark, wet ones in the mud
  if (!lite) { const now = performance.now(), dt = Math.min(0.1, (now - (V3.clodT || now)) / 1000) * (playing ? rate : 0); V3.clodT = now; clodTick(dt); for (const p of clods) v3Dot(F.smoke, p.x, v3Gnd(p.x, p.y) + 1 + p.z, p.y, p.r * 2.6, p.mud ? 0.1 : 0.2, p.mud ? 0.07 : 0.15, p.mud ? 0.04 : 0.09, 0.95, p.x * 3, (p.t * 7 | 0) % 4); }
  // lamps lit at night (the models' — tools/build_models.py `lamp`): a glow each, by its kind; a mast's red one blinks,
  // only some windows lit (the same ones — by where they are)
  const A = V3.lamps || [], nk = V3.nightK || 0, tt = performance.now() / 1000;
  for (let i = 0; i < A.length; i += 4) {
    const L = V3_LAMP[V3_LAMP_K[A[i + 3]]]; if (!L) continue;
    if (L.some) { const v = Math.sin(A[i] * 12.99 + A[i + 2] * 78.23) * 43758.5; if (v - Math.floor(v) > L.some) continue; }
    const a = nk * L.a * (L.blink ? 0.35 + 0.65 * (Math.sin(tt * 3 + A[i] * 0.1) > 0.6 ? 1 : 0) : 1);
    v3Dot(F.glow, A[i], A[i + 1], A[i + 2], L.d, L.c[0], L.c[1], L.c[2], a);
  }
  // aircraft: a jet's nozzle hot (brighter as it goes fast) and its faint vapour trail; dust under a helicopter, blown out
  for (const { u, st, T } of V3.airNow || []) {
    const D = MODELS[u.type], L = (SIZE[u.type] || 10) * (V3_LEN[u.type] || 1.6), hd = u.hd || 0, c = Math.cos(hd), sn = Math.sin(hd), g = v3Gnd(u.x, u.y), h = g + 0.6 + V3_AIR;
    if (T.hover || u.type === 'lift') {
      if (lite) continue;
      const tt = performance.now() / 1000, n = 6, R = L * 0.55;
      for (let i = 0; i < n; i++) { const a = i / n * 6.283 + tt * 0.7 + u.id, f = (tt * 0.9 + i / n) % 1, r = R * (0.5 + f * 1.1);
        v3Dot(F.smoke, u.x + Math.cos(a) * r, g + 2 + f * 3, u.y + Math.sin(a) * r, L * (0.35 + f * 0.5), 0.78, 0.71, 0.56, 0.22 * Math.sin(Math.PI * f), a, i % 4); }
      continue;
    }
    const eng = u.type === 'tanker' ? [[-0.05, 0.36], [-0.05, -0.36], [0.02, 0.2], [0.02, -0.2]] : [[-0.52, 0]]; // (along, across: of its length — a fighter's nozzle at the tail, a tanker's four engines under the wings)
    const hot = 0.6 + 0.4 * Math.min(1, st.sp / 60);
    for (const [ax, az] of eng) {
      const x = u.x + c * ax * L - sn * az * L, y = u.y + sn * ax * L + c * az * L;
      if (u.type !== 'tanker') { v3Dot(F.glow, x, h + D.size[1] * L * 0.32, y, L * 0.22, 1, 0.62, 0.28, 0.75 * hot); v3Dot(F.glow, x - c * L * 0.08, h + D.size[1] * L * 0.32, y - sn * L * 0.08, L * 0.12, 1, 0.9, 0.7, 0.8 * hot); }
      if (lite) continue;
      const H = st.hist; // (the trail: from each engine, where it was — thin and white, spreading and fading)
      for (let i = 0; i < H.length; i++) { const p = H[i], age = performance.now() / 1000 - p[2], f = age / V3_TRAIL; if (f >= 1) continue;
        v3Dot(F.smoke, p[0] + c * (ax - 0.15) * L - sn * az * L, h + D.size[1] * L * 0.3, p[1] + sn * (ax - 0.15) * L + c * az * L, L * (0.12 + f * 0.35), 0.92, 0.92, 0.9, 0.22 * (1 - f) * Math.min(1, st.sp / 30), i * 1.3, i % 4); }
    }
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
  // blasts: a flash; a fireball of rolling flames, white-hot → orange → dark red, rising; sparks thrown out and
  // falling; a ring of dust running out over the ground; dark smoke boiling up as the fire dies (and the flat map's
  // smoke left behind); and the light of it on what's round (the biggest few, V3_BLAST_LIGHTS)
  const lit = [];
  for (const f of s.fx) {
    if (f.wait > 0) continue;
    const t = 1 - f.life / f.max, a = 1 - t, R = f.size, air = f.air, g0 = v3Gnd(f.x, f.y), h = g0 + (air ? V3_AIR : 0), sd = f.x * 0.37 + f.y * 0.71 + f.max * 13.1, age = t * f.max;
    if (!f.smoked && R >= 8) { f.smoked = true; const n = R >= 26 ? 3 : R >= 18 ? 2 : 1; for (let i = 0; i < n; i++) puff(f.x + (Math.random() - 0.5) * R * 0.6, f.y, R >= 18, 0.7 + R / 30); }
    if (t < 0.18) v3Dot(F.glow, f.x, h + R * 0.5, f.y, R * 5, 1, 0.92, 0.75, (1 - t / 0.18) * 0.9); // (the flash)
    const nf = R >= 20 ? 9 : R >= 10 ? 6 : 3;
    for (let i = 0; i < nf; i++) { // (the fireball)
      const da = v3Rnd(sd, i) * 6.283, dr = v3Rnd(sd, i + 9) * R * 0.55 * Math.sqrt(t + 0.05), up = R * (0.25 + 0.9 * t) * (0.6 + 0.8 * v3Rnd(sd, i + 19));
      const sz = R * (0.9 + 1.4 * Math.sqrt(t)) * (0.7 + 0.6 * v3Rnd(sd, i + 29)), hot = Math.max(0, 1 - t * 2.2);
      const cr = 0.95, cg = 0.32 + 0.45 * hot, cb = 0.06 + 0.45 * hot * hot, al = Math.pow(a, 1.4) * (0.45 + 0.25 * hot); // (added together: dimmer each, or the middle is just white)
      v3Dot(F.fire, f.x + Math.cos(da) * dr, h + up, f.y + Math.sin(da) * dr * 0.6, sz, cr, cg, cb, al, v3Rnd(sd, i + 39) * 6.283 + age * (v3Rnd(sd, i) - 0.5) * 2, i % 4);
      if (t > 0.35) v3Dot(F.smoke, f.x + Math.cos(da) * dr, h + up * 1.15 + R * 0.3, f.y + Math.sin(da) * dr * 0.6, sz * 1.2, 0.1, 0.09, 0.08, Math.min(1, (t - 0.35) * 3) * a * 0.75, v3Rnd(sd, i + 49) * 6.283, (i + 1) % 4); // (black smoke as it burns out)
    }
    if (R >= 10 && !lite) for (let i = 0; i < (R >= 20 ? 14 : 8); i++) { // (sparks: out and up, then down)
      const da = v3Rnd(sd, i + 59) * 6.283, sp = R * (2.5 + 3 * v3Rnd(sd, i + 69)), vu = R * (2 + 4 * v3Rnd(sd, i + 79)), z = h + vu * age - 120 * age * age;
      if (z < g0) continue;
      v3Dot(F.glow, f.x + Math.cos(da) * sp * age, z, f.y + Math.sin(da) * sp * age * 0.7, 2.2 + R * 0.06, 1, 0.75, 0.35, a);
    }
    if (!air && R >= 10) v3Dot(F.ring, f.x, g0 + 1, f.y, R * (1.5 + 7 * Math.sqrt(t)), 0.62, 0.55, 0.42, 0.55 * a * a, sd); // (the dust ring)
    lit.push([R * a, f.x, h + R * 0.6, f.y, R]);
  }
  // (the lights: to the biggest)
  lit.sort((p, q) => q[0] - p[0]);
  V3.blastLights.forEach((L, i) => { const b = lit[i]; if (!b || b[0] < 2) { L.intensity = 0; return; } L.position.set(b[1], b[2], b[3]); L.distance = b[4] * 9; L.intensity = b[0] * V3_BLAST_LIT; });
  // the smoke: rising, drifting with the wind, growing, fading (as the flat map's)
  for (const p of smoke) {
    const age = s.t - p.t, a = age / p.life, x = p.x + WIND.x * age, y = p.y + WIND.y * age;
    const g = p.dark ? 0.2 : 0.7, al = (p.dark ? 0.75 : 0.5) * (1 - a) * Math.min(1, a * 6);
    const sd = p.x * 0.73 + p.t * 3.1; v3Dot(F.smoke, x, v3Gnd(p.x, p.y) + 4 + 9 * age * 1.6, y, p.r * (1 + a * 2.6) * 3.0, g, g * 0.97, g * 0.92, al * 1.2, v3Rnd(sd, 1) * 6.283 + age * (v3Rnd(sd, 2) - 0.5) * 0.8, Math.floor(v3Rnd(sd, 3) * 4));
  }
  // scorch marks: dark earth, lying on the ground
  for (const p of scorch) v3Dot(F.mark, p.x, v3Gnd(p.x, p.y) + 0.8, p.y, p.r * 2.2, 0.12, 0.09, 0.06, 0.7 * (1 - (s.t - p.t) / SCORCH_T));
  // the flares (art.js flareAt): a white star with a wide halo, a thin trail of smoke above it, a small parachute; and the light
  const fl = [];
  for (const f of flares) {
    const p = flareAt(f), g0 = v3Gnd(p.x, p.y), age = s.t - f.t;
    if (p.lit < 0.02) { if (!f.air && age < FLARE.rise) v3Dot(F.smoke, p.x, g0 + p.h, p.y, 4, 0.8, 0.8, 0.8, 0.4); continue; } // (going up: a faint streak)
    v3Dot(F.glow, p.x, g0 + p.h, p.y, V3_FLARE.glow * (0.9 + 0.2 * p.lit), 1, 0.98, 0.9, p.lit);
    v3Dot(F.glow, p.x, g0 + p.h, p.y, V3_FLARE.glow * 5, 0.75, 0.8, 1, 0.12 * p.lit);
    v3Dot(F.mark, p.x, g0 + p.h + 9, p.y, 8, 0.9, 0.9, 0.85, 0.5 * Math.min(1, p.lit * 2));
    for (let i = 1; i <= 6; i++) v3Dot(F.smoke, p.x - WIND.x * i * 0.8, g0 + p.h + i * 5, p.y - WIND.y * i * 0.8, 5 + i * 2, 0.75, 0.75, 0.78, 0.22 * (1 - i / 7) * p.lit);
    fl.push([Math.hypot(p.x - cam.x, p.y - cam.y), p.x, g0 + p.h, p.y, p.lit]);
  }
  fl.sort((a, b) => a[0] - b[0]);
  V3.flareLights.forEach((L, i) => { const b = fl[i]; if (!b) { L.intensity = 0; return; } L.position.set(b[1], b[2], b[3]); L.intensity = V3_FLARE.k * b[4] * V3_FLARE.dist / 100; });
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
  tree: ['tree_gen1', 'tree_gen2', 'tree_gen3', 'tree_genolive1', 'tree_genolive2', 'tree_genpine1', 'tree_genpine2', 'tree_genpoplar'], // (built in code — tools/build_trees.py)
  bush: ['bush_gen1', 'bush_gen2', 'bush_gen3'], rock: ['rock_smallC', 'rock_largeA', 'rock_smallF', 'stone_largeB'],
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
// ---- trees and bushes of leaves: each crown (the model's green clumps) remade as leaf cards — small squares of a
// cluster of leaves (a picture drawn once, v3LeafPic; see-through between the leaves), turned every way over the
// clumps' surface and a little inside, lit as one round crown (each card's normal out from the crown's middle); the
// trunk and branches as they were. Their shadow dappled (the depth drawn through the same picture). V3_CARDS: n — how
// many a tree (fewer for a bush), cover — how much of the crown's surface they cover, inner — how deep inside. ----
const V3_CARDS = { n: 70, bush: 34, cover: 2.6, inner: 0.35 };
function v3LeafPic() {
  if (V3.leafPic) return V3.leafPic;
  const N = 256, R = 112, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let a = 12345; const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#fff'; g.fillRect(240, 0, 16, N); // (the trunk's corner of it: plain, opaque)
  const leaves = [];
  for (let i = 0; i < 260; i++) {
    const r = R * Math.sqrt(rnd()) * (0.75 + 0.25 * rnd()), t = rnd() * 6.283, x = 120 + Math.cos(t) * r, y = 128 + Math.sin(t) * r;
    leaves.push([x, y, rnd() * 6.283, 9 + rnd() * 9, r / R, rnd()]);
  }
  leaves.sort((p, q) => q[4] - p[4]); // (the outer first: the inner over them, lighter)
  for (const [x, y, ang, L, d, v] of leaves) {
    const b = Math.min(255, Math.round(178 + v * 77 - d * 22)), gg = Math.round(b * (0.97 + v * 0.06)), bl = Math.round(b * (0.8 + v * 0.12));
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = `rgb(${b},${gg},${bl})`; g.beginPath(); g.ellipse(0, 0, L, L * 0.42, 0, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(40,45,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L * 0.9, 0); g.lineTo(L * 0.9, 0); g.stroke(); // (the vein)
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (V3.leafPic = t);
}
function v3CardGeo(model) {
  const key = 'cards:' + model, G = V3.geo || (V3.geo = new Map()); if (G.has(key)) return G.get(key);
  const src = v3Geo(model, 'hull', 'scen'), P = src.attributes.position.array, Nn = src.attributes.normal.array, C = src.attributes.color.array;
  const pos = [], nrm = [], col = [], uv = [], leafT = [], leafA = [];
  const green = i => C[i * 3 + 1] > C[i * 3] * 1.08 && C[i * 3 + 1] > C[i * 3 + 2] * 1.1;
  const cen = [0, 0, 0]; let nl = 0;
  for (let t = 0; t < P.length / 9; t++) {
    const i0 = t * 3, lf = green(i0) && green(i0 + 1) && green(i0 + 2);
    if (!lf) { for (let k = 0; k < 3; k++) { const i = i0 + k; pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nrm.push(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]); col.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); uv.push(0.97, 0.5); } continue; }
    const v = k => [P[(i0 + k) * 3], P[(i0 + k) * 3 + 1], P[(i0 + k) * 3 + 2]], A = v(0), B = v(1), D = v(2);
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    const ar = 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    leafT.push(t); leafA.push((leafA.length ? leafA[leafA.length - 1] : 0) + ar);
    for (const p of [A, B, D]) { cen[0] += p[0]; cen[1] += p[1]; cen[2] += p[2]; nl++; }
  }
  if (!leafT.length) { G.set(key, src); return src; }
  cen[0] /= nl; cen[1] /= nl; cen[2] /= nl;
  const total = leafA[leafA.length - 1], bush = model.startsWith('bush'), n = bush ? V3_CARDS.bush : V3_CARDS.n, S = Math.sqrt(total * V3_CARDS.cover / n);
  let a = 1; for (const ch of model) a = (a * 31 + ch.charCodeAt(0)) % 2147483647; const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const q = new THREE.Quaternion(), d = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), corner = new THREE.Vector3(), o = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let c = 0; c < n; c++) {
    const r = rnd() * total; let lo = 0, hi = leafT.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (leafA[m] < r) lo = m + 1; else hi = m; }
    const i0 = leafT[lo] * 3; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const pt = k => (1 - u - w) * P[i0 * 3 + k] + u * P[(i0 + 1) * 3 + k] + w * P[(i0 + 2) * 3 + k];
    const dep = 1 - rnd() * V3_CARDS.inner; o.set(cen[0] + (pt(0) - cen[0]) * dep, cen[1] + (pt(1) - cen[1]) * dep, cen[2] + (pt(2) - cen[2]) * dep);
    const cr = C[i0 * 3], cg = C[i0 * 3 + 1], cb = C[i0 * 3 + 2];
    d.set(rnd() - 0.5, rnd() - 0.5 + 0.35, rnd() - 0.5).normalize(); q.setFromUnitVectors(up, d); // (the card: facing anywhere, a little more often up)
    const sz = S * (0.75 + rnd() * 0.5), sp = rnd() * 6.283, fl = rnd() < 0.5;
    const quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { const cx = Math.cos(sp) * x - Math.sin(sp) * y, cy = Math.sin(sp) * x + Math.cos(sp) * y; return corner.set(cx * sz / 2, cy * sz / 2, 0).applyQuaternion(q).add(o).toArray(); });
    const uvs = [[0, 0], [0.9375, 0], [0.9375, 1], [0, 1]].map(([x, y]) => [fl ? 0.9375 - x : x, y]);
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = quad[k]; pos.push(p[0], p[1], p[2]);
      nv.set(p[0] - cen[0], (p[1] - cen[1]) * 0.8 + 0.25 * S, p[2] - cen[2]).normalize(); nrm.push(nv.x, nv.y, nv.z); // (lit as a round crown)
      const sh = 0.82 + 0.3 * dep; col.push(cr * sh, cg * sh, cb * sh); uv.push(uvs[k][0], uvs[k][1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  G.set(key, g); return g;
}
function v3CardMat() {
  if (V3.cardMat) return V3.cardMat;
  const map = v3LeafPic();
  V3.cardMat = v3Leafy(v3Shaded(new THREE.MeshLambertMaterial({ vertexColors: true, map, alphaTest: 0.5, side: THREE.DoubleSide })), true);
  V3.cardDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
  return V3.cardMat;
}
const V3_SCEN_HUE = 0.05;
function v3ScenChunk(key) {
  const sc = V3.sc, old = sc.chunks.get(key); if (old) for (const m of old) { V3.scene.remove(m); m.dispose(); }
  const [ci, cj] = key.split(',').map(Number), by = new Map(), o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), list = [], tint = v3Tmp.tint || (v3Tmp.tint = new THREE.Color());
  for (const e of v3ScenList(ci, cj)) { let l = by.get(e[0]); if (!l) by.set(e[0], l = []); l.push(e); }
  for (const [model, l] of by) {
    l.sort((p, q) => ((p[1] * 7.31 + p[2] * 3.17) % 1) - ((q[1] * 7.31 + q[2] * 3.17) % 1)); // (a shuffle, the same every time: a far view shows the first share of them, v3ScenLod)
    const leafy = !model.startsWith('rock') && !model.startsWith('stone'); // (trees and bushes: of leaf cards)
    const mesh = new THREE.InstancedMesh(leafy ? v3CardGeo(model) : v3Geo(model, 'hull', 'scen'), leafy ? v3CardMat() : V3.scenMat || (V3.scenMat = v3Leafy(v3Shaded(new THREE.MeshLambertMaterial({ vertexColors: true })))), l.length);
    if (leafy) mesh.customDepthMaterial = V3.cardDepth;
    l.forEach(([, x, y, a, w], i) => {
      const tall = model.startsWith('tree') ? Math.min(V3_TREE_H, V3_TREE_MAX / MODELS[model].size[1]) : 1; // (the tall thin ones: no higher than V3_TREE_MAX × wide — they hid all round them)
      o.position.set(x, v3Gnd(x, y) - w * 0.03, y); o.rotation.set(0, a, 0); o.scale.set(w, w * tall, w); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      const h = j => { const v = Math.sin(x * 12.9898 + y * 78.233 + j * 37.72) * 43758.5453; return v - Math.floor(v); }, k = 0.82 + h(0) * 0.3; // (each a little lighter or darker,
      mesh.setColorAt(i, tint.setRGB(k * (1 + (h(1) - 0.5) * 2 * V3_SCEN_HUE), k * (1 + (h(2) - 0.5) * 2 * V3_SCEN_HUE), k * (1 + (h(3) - 0.5) * 2 * V3_SCEN_HUE))); // and each of R, G, B up to ±V3_SCEN_HUE)
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.userData = { n: l.length, tree: model.startsWith('tree') }; V3.scene.add(mesh); list.push(mesh);
  }
  sc.chunks.set(key, list); sc.lod = -1;
}
// far out (the view V3_FAR wide or more — the big maps whole): no shadows from the scenery, no bushes or rocks (a pixel
// each), and a share of the trees (the woods still woods) — the 8× map's 60,000 trees, all on the screen, halved the frame rate
const V3_FAR = 2600, V3_FAR_MIN = 0.3;
function v3ScenLod(sc) {
  const w = V3.box ? V3.box.w : 0, f = w <= V3_FAR ? 1 : Math.max(V3_FAR_MIN, (V3_FAR / w) ** 1.5), k = Math.round(f * 20);
  if (sc.lod === k) return; sc.lod = k;
  for (const l of sc.chunks.values()) for (const m of l) { m.count = f >= 1 ? m.userData.n : m.userData.tree ? Math.ceil(m.userData.n * f) : 0; m.castShadow = f >= 1; }
}
function v3Scenery() {
  if (!v3HasScen()) return;
  let sc = V3.sc;
  if (sc) v3ScenLod(sc);
  if (!sc || sc.of !== decor || sc.low !== gfxLow) { // (a new map: all of it, its squares made a few a frame)
    if (sc) for (const l of sc.chunks.values()) for (const m of l) { V3.scene.remove(m); m.dispose(); }
    const cells = new Map();
    for (const it of decor.rocks.items) { const k = Math.floor(it.x / V3_CHUNK) + ',' + Math.floor(it.y / V3_CHUNK); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(it); }
    sc = V3.sc = { of: decor, low: gfxLow, cells, chunks: new Map(), todo: new Set(), dead: scen.of === decor && scen.dead ? scen.dead.length : 0, cut: s.ground ? s.ground.cut.length : 0 };
    for (let i = 0; i * V3_CHUNK < s.W; i++) for (let j = 0; j * V3_CHUNK < s.H; j++) sc.todo.add(i + ',' + j);
  }
  // (cleared or run over since: scenKill; woods cut: s.ground.cut — their squares made again)
  const sq = (x, y) => Math.floor(x / V3_CHUNK) + ',' + Math.floor(y / V3_CHUNK);
  if (scen.dead && scen.of === decor) for (; sc.dead < scen.dead.length; sc.dead++) {
    const it = scen.dead[sc.dead]; sc.todo.add(sq(it.x, it.y));
    if (it.t === 'tree' && !gfxLow) { const L = V3_SCEN.tree; v3FallStart(L[it.v % L.length], it.x, it.y, (it.v % 628) / 100, it.s * V3_SCEN_K.tree); } // (it falls: v3Falling)
  }
  const G = s.ground; if (G) for (; sc.cut < G.cut.length; sc.cut++) {
    const k = G.cut[sc.cut]; sc.todo.add(sq((k % G.w + 0.5) * G.C, (Math.floor(k / G.w) + 0.5) * G.C));
    if (!gfxLow) for (let q = 0; q < GRD_TREES; q++) { const C = G.C, i = k % G.w, j = Math.floor(k / G.w), w = GRD_TREE[0] + grdRand(k, 12 + q) * (GRD_TREE[1] - GRD_TREE[0]); v3FallStart(V3_SCEN.tree[Math.floor(grdRand(k, 16 + q) * V3_SCEN.tree.length)], i * C + grdRand(k, 4 + q) * C, j * C + grdRand(k, 8 + q) * C, grdRand(k, 20 + q) * 6.28, w * V3_SCEN_K.tree); }
  }
  // (the ones nearest the camera first; at most a few ms a frame)
  if (!sc.todo.size) return;
  const t0 = performance.now(), near = [...sc.todo].map(k => { const [i, j] = k.split(',').map(Number); return [k, Math.hypot((i + 0.5) * V3_CHUNK - cam.x, (j + 0.5) * V3_CHUNK - cam.y)]; }).sort((a, b) => a[1] - b[1]);
  for (const [k] of near) { v3ScenChunk(k); sc.todo.delete(k); if (performance.now() - t0 > 6) break; }
}
// ---- craters (V3_CRATER): where shells, rockets and blasts landed (s.fx, not in the air, from size min), a bowl in the
// ground — a raised rim of fresh earth, dark and burnt inside — that stays (the oldest go past max). Lying on the
// ground: the bowl is in its normals (the inner slope away from the sun dark), the rim really up; see-through at the edge ----
const V3_CRATER = { min: 18, k: 0.36, max: 220, rimH: 0.16 };
function v3CraterGeo() {
  const R = [0, 0.3, 0.55, 0.75, 0.9, 1.0, 1.1, 1.25, 1.45, 1.7], N = 24, pos = [], nrm = [], col = [], idx = [];
  const prof = r => (r < 0.95 ? -0.38 * (1 - (r / 0.95) ** 2) : 0) + V3_CRATER.rimH * Math.exp(-(((r - 1.05) / 0.2) ** 2));
  const cols = r => r < 0.6 ? [0.016, 0.012, 0.009, 0.92] : r < 0.95 ? [0.035, 0.026, 0.018, 0.9] : r < 1.3 ? [0.12, 0.088, 0.056, 0.85] : [0.1, 0.078, 0.05, Math.max(0, 1 - (r - 1.3) / 0.4) * 0.55]; // (linear: burnt black inside, fresh brown earth on the rim)
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), wob = 1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7);
    for (const r0 of R) {
      const r = r0 * wob, dp = (prof(r + 0.01) - prof(r - 0.01)) / 0.02; // (the slope, for the light)
      pos.push(ca * r, Math.max(0, prof(r)) + 0.02, sa * r);
      const n = new THREE.Vector3(-dp * ca, 1, -dp * sa).normalize(); nrm.push(n.x, n.y, n.z); col.push(...cols(r0));
    }
  }
  const M = R.length;
  for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; for (let j = 0; j < M - 1; j++) { const a = i * M + j, b = i2 * M + j; idx.push(a, b, a + 1, b, b + 1, a + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
  return g;
}
function v3Craters() {
  if (!V3.crater) {
    const m = v3Shaded(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    V3.crater = new THREE.InstancedMesh(v3CraterGeo(), m, V3_CRATER.max); V3.crater.receiveShadow = true; V3.crater.frustumCulled = false; V3.crater.renderOrder = 1; V3.scene.add(V3.crater);
    V3.craters = []; V3.craterOf = null;
  }
  if (V3.craterOf !== s) { V3.craters = []; V3.craterOf = s; V3.craterN = -1; }
  const L = V3.craters;
  for (const f of s.fx) if (!f.v3cr && !(f.wait > 0)) { f.v3cr = true; if (f.size >= V3_CRATER.min && !f.air && !Sim.lakeAt(s, f)) { if (L.length >= V3_CRATER.max) L.shift(); L.push({ x: f.x, y: f.y, r: f.size * V3_CRATER.k, a: Math.random() * 6.28 }); V3.craterN = -1; } }
  if (V3.craterN === L.length) return; V3.craterN = L.length; // (laid again only when one is added)
  const C = V3.crater, o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), up = v3Tmp.up || (v3Tmp.up = new THREE.Vector3(0, 1, 0)), n = v3Tmp.cn || (v3Tmp.cn = new THREE.Vector3()), q = v3Tmp.cq || (v3Tmp.cq = new THREE.Quaternion());
  L.forEach((c, i) => {
    const e = 3, hx = v3E(c.x + e, c.y) - v3E(c.x - e, c.y), hy = v3E(c.x, c.y + e) - v3E(c.x, c.y - e);
    n.set(-hx, 2 * e, -hy).normalize(); q.setFromUnitVectors(up, n);
    o.position.set(c.x, v3E(c.x, c.y), c.y); o.quaternion.copy(q); o.rotateY(c.a); o.scale.set(c.r, c.r, c.r); o.updateMatrix(); C.setMatrixAt(i, o.matrix);
  });
  C.count = L.length; C.instanceMatrix.needsUpdate = true;
}
// ---- trees that fall (V3_FALL_T): crushed by a tank or cleared for a building (scenKill) or a wood cut (s.ground.cut)
// — the tree topples away from what pushed it, bounces once, lies a while and sinks into the ground ----
const V3_FALL_T = { fall: 1.1, lie: 6, sink: 2.5, max: 40 };
function v3FallStart(model, x, y, a, w) {
  if (!V3.falling) V3.falling = [];
  if (V3.falling.length >= V3_FALL_T.max || !model.startsWith('tree')) return;
  // (away from the nearest tank or bulldozer — what's pushing it; else any way)
  let best = null, bd = 80 * 80; for (const u of s.units) if (u.type === 'tank' || u.type === 'dozer') { const d = (u.x - x) ** 2 + (u.y - y) ** 2; if (d < bd) { bd = d; best = u; } }
  const dir = best ? Math.atan2(y - best.y, x - best.x) : Math.random() * 6.28;
  const m = new THREE.Mesh(v3CardGeo(model), v3CardMat()); m.customDepthMaterial = V3.cardDepth; m.castShadow = m.receiveShadow = true;
  const tall = Math.min(V3_TREE_H, V3_TREE_MAX / MODELS[model].size[1]); V3.scene.add(m);
  V3.falling.push({ m, x, y, a, w, tall, dir, t0: performance.now() / 1000 });
}
function v3Falling() {
  const L = V3.falling; if (!L || !L.length) return;
  const now = performance.now() / 1000, F = V3_FALL_T, ax = v3Tmp.fax || (v3Tmp.fax = new THREE.Vector3()), q = v3Tmp.fq || (v3Tmp.fq = new THREE.Quaternion()), qy = v3Tmp.fqy || (v3Tmp.fqy = new THREE.Quaternion()), Y = v3Tmp.fy || (v3Tmp.fy = new THREE.Vector3(0, 1, 0));
  for (let i = L.length - 1; i >= 0; i--) {
    const f = L[i], t = now - f.t0;
    if (t > F.fall + F.lie + F.sink || V3.of !== decor) { V3.scene.remove(f.m); L.splice(i, 1); continue; }
    // (falling faster as it goes — as a tree does — then a small bounce; lying a little short of flat)
    const k = Math.min(1, t / F.fall), ang = t < F.fall ? k * k * 1.45 : 1.45 - 0.12 * Math.max(0, Math.sin((t - F.fall) * 9)) * Math.exp(-(t - F.fall) * 5);
    ax.set(Math.sin(f.dir), 0, -Math.cos(f.dir)); q.setFromAxisAngle(ax, -ang); qy.setFromAxisAngle(Y, f.a);
    const sink = Math.max(0, t - F.fall - F.lie) / F.sink;
    f.m.position.set(f.x, v3Gnd(f.x, f.y) - sink * f.w * 0.5, f.y); f.m.quaternion.copy(q).multiply(qy); f.m.scale.set(f.w, f.w * f.tall, f.w);
  }
}
// ---- dug in (Sim digTick, s.trenches): a soldier's foxhole — a ring of fresh earth, open at the back, a soft rounded
// bank with a row of sandbags along its front and a dark pit inside; a tank's hull-down scrape — a U of earth round it,
// higher at the front, sandbags on the front lip, its floor dark. Made once in code (v3TrenchGeo, one unit across;
// vertex colours: dry earth on top, damp at the foot, khaki bags), one InstancedMesh for each, scaled per unit and
// risen with the digging (f) ----
const V3_TRENCH = { foot: [V3_MAN * 0.48, 0.62], tank: [0, 0.75] };
const V3_TRENCH_COL = { dry: '#7a6247', damp: '#4b3b29', pit: '#1c150e', bag: '#8c8160', bag2: '#75694b' }; // (as the screen shows them: made linear in v3TrenchGeo)
function v3TrenchGeo(tank) {
  const P = [], C = [], I = [], tri = (a, b, c) => I.push(a, b, c), C0 = Object.fromEntries(Object.entries(V3_TRENCH_COL).map(([k, h]) => { const c = new THREE.Color(h); return [k, [c.r, c.g, c.b]]; }));
  const vert = (x, y, z, col) => { P.push(x, y, z); C.push(...col); return P.length / 3 - 1; };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  let sd = tank ? 11 : 5; const R = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  // (the bank's path: a list of { x, z, nx, nz (outward), k (height there, 0–1) })
  const path = [];
  if (!tank) {
    const a0 = Math.PI * 0.22, a1 = Math.PI * 1.78, N = 40; // (the gap at the back, −X)
    for (let i = 0; i <= N; i++) { const t = i / N, a = Math.PI + a0 + (a1 - a0) * t, end = Math.min(1, Math.min(t, 1 - t) / 0.12); path.push({ x: Math.cos(a), z: Math.sin(a), nx: Math.cos(a), nz: Math.sin(a), k: end * end * (3 - 2 * end) * (0.85 + 0.15 * Math.cos(a)) }); }
  } else {
    // (a U: back-left, along the left side to the front, round the front, back along the right side; open behind)
    const W = 0.62, F = 0.62, B = -0.75, rc = 0.3, pts = [];
    for (let i = 0; i <= 10; i++) pts.push([B + (F - rc - B) * i / 10, -W, 0, -1]);
    for (let i = 1; i < 8; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 8; pts.push([F - rc + Math.cos(a) * rc, -W + rc + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) pts.push([F, -W + rc + (2 * (W - rc)) * i / 8, 1, 0]);
    for (let i = 1; i < 8; i++) { const a = Math.PI / 2 * i / 8; pts.push([F - rc + Math.cos(a) * rc, W - rc + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]); }
    for (let i = 0; i <= 10; i++) pts.push([F - rc - (F - rc - B) * i / 10, W, 0, 1]);
    pts.forEach(([x, z, nx, nz], i) => { const t = i / (pts.length - 1), end = Math.min(1, Math.min(t, 1 - t) / 0.1), front = Math.max(0, (x - B) / (F - B)); path.push({ x, z, nx, nz, k: end * end * (3 - 2 * end) * (0.55 + 0.45 * front) }); });
  }
  // (the bank's cross-section: o = out from the path, h = up — inner foot, inner lip, crest, outer slope, outer foot)
  const prof = [[-0.2, 0], [-0.1, 0.55], [0.0, 0.9], [0.1, 1], [0.24, 0.72], [0.42, 0.3], [0.62, 0]];
  const rows = path.map(p => prof.map(([o, h], j) => {
    const w = 1 + (R() - 0.5) * 0.18, y = h * p.k * (0.42 + (R() - 0.5) * 0.04), col = j === 0 || j === prof.length - 1 ? C0.damp : mix(C0.damp, C0.dry, Math.min(1, h * 1.2) * (0.85 + R() * 0.15));
    return vert(p.x + p.nx * o * w * (tank ? 0.9 : 1), y, p.z + p.nz * o * w * (tank ? 0.9 : 1), col);
  }));
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < prof.length - 1; j++) { const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1]; tri(a, c, b); tri(b, c, d); }
  // (the pit: a dark floor inside, lighter at its rim)
  if (!tank) {
    const c = vert(0, 0.03, 0, C0.pit), N = 24, r0 = [];
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; r0.push(vert(Math.cos(a) * 0.82, 0.03, Math.sin(a) * 0.82, mix(C0.pit, C0.damp, 0.7))); }
    for (let i = 0; i < N; i++) tri(c, r0[(i + 1) % N], r0[i]);
  } else {
    const q = [[-0.75, -0.52], [0.5, -0.52], [0.5, 0.52], [-0.75, 0.52]].map(([x, z], i) => vert(x, 0.03, z, i === 1 || i === 2 ? C0.pit : mix(C0.pit, C0.damp, 0.6)));
    tri(q[0], q[2], q[1]); tri(q[0], q[3], q[2]);
  }
  // (sandbags along the front: rounded little blocks on the crest, two rows staggered)
  const bag = (x, y, z, a, L, Wd, Ht, col) => {
    const ca = Math.cos(a), sa = Math.sin(a), at = (u, v, w) => [x + u * ca - w * sa, y + v, z + u * sa + w * ca], k = 0.75; // (k: the top and the ends drawn in — a bag, not a brick)
    const c8 = [[-L, 0, -Wd], [L, 0, -Wd], [L, 0, Wd], [-L, 0, Wd], [-L * k, Ht, -Wd * k], [L * k, Ht, -Wd * k], [L * k, Ht, Wd * k], [-L * k, Ht, Wd * k]].map(([u, v, w]) => vert(...at(u, v, w), mix(col, C0.pit, v ? 0 : 0.35)));
    for (const [a1, b1, c1, d1] of [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) { tri(c8[a1], c8[c1], c8[b1]); tri(c8[a1], c8[d1], c8[c1]); }
  };
  if (!tank) {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7 - r; i++) {
      const a = -Math.PI * 0.42 + (Math.PI * 0.84) * (i + 0.5 + r * 0.5) / 7, rr = 0.98, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      bag(x, 0.36 + r * 0.1, z, a + Math.PI / 2 + (R() - 0.5) * 0.25, 0.15, 0.08, 0.1, R() < 0.5 ? C0.bag : C0.bag2);
    }
  } else {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 8 - r; i++) {
      const z = -0.48 + 0.96 * (i + 0.5 + r * 0.5) / 8;
      bag(0.66, 0.4 + r * 0.09, z, Math.PI / 2 + (R() - 0.5) * 0.2, 0.07, 0.045, 0.085, R() < 0.5 ? C0.bag : C0.bag2);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
function v3Trenches() {
  if (!V3.trench) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    V3.trench = { foot: new THREE.InstancedMesh(v3TrenchGeo(false), m, 512), tank: new THREE.InstancedMesh(v3TrenchGeo(true), m, 128) };
    for (const T of Object.values(V3.trench)) { T.castShadow = T.receiveShadow = true; T.frustumCulled = false; T.count = 0; V3.scene.add(T); }
  }
  const o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), c = v3Tmp.tc || (v3Tmp.tc = new THREE.Color()), box = V3.box, n = { foot: 0, tank: 0 };
  const put = (x, y, a, k, f) => {
    const tank = k === 'tank', T = V3.trench[tank ? 'tank' : 'foot'], kk = tank ? 'tank' : 'foot';
    if (n[kk] >= T.instanceMatrix.count || (box && (x < box.x - 40 || x > box.x + box.w + 40 || y < box.y - 40 || y > box.y + box.h + 40))) return;
    const R = tank ? (SIZE.tank || 30) * (V3_LEN.tank || 1.6) * 0.62 : V3_TRENCH.foot[0], h = (tank ? V3_TRENCH.tank[1] : V3_TRENCH.foot[1]) * f;
    o.position.set(x, v3Gnd(x, y) - 0.3, y); o.rotation.set(0, -a, 0); o.scale.set(R, R * h, R * (tank ? 0.8 : 1)); o.updateMatrix();
    T.setMatrixAt(n[kk], o.matrix); T.setColorAt(n[kk]++, c.setScalar(0.88 + ((Math.abs(Math.round(x * 3.1 + y * 7.7)) % 9) / 36)));
  };
  for (const t of s.trenches || []) if (t.side === 'blue' || !s.fog || shownAt(t)) put(t.x, t.y, t.a, t.k, 1);
  for (const u of s.units) if (u.dig > 0 && !u.dug && (u.side === 'blue' || !s.fog || s.vis.blue.has(u.id))) put(u.x, u.y, u.hd || 0, u.type === 'tank' ? 'tank' : 'foot', u.dig);
  for (const k in V3.trench) { const T = V3.trench[k]; T.count = n[k]; T.instanceMatrix.needsUpdate = true; if (T.instanceColor) T.instanceColor.needsUpdate = true; }
}
// ---- water that moves: over each lake (its own outline — decor.lakes' body, as a mask) a see-through surface whose
// ripples run and glint (a small shader on the light's own; the ground's fog and night over it — v3Shaded) ----
const V3_WATER = { col: '#0b2830', px: 256, blur: 10, fine: ['0.4', '1.4'] }; // (fine: world units a pixel spans — the ripples fade between)
function v3Water() {
  if (V3.water && V3.water.of === decor) { V3.waterT.value = (performance.now() / 1000) % 1000; v3SunDir(); return; }
  if (V3.water) for (const m of V3.water.meshes) { V3.scene.remove(m); m.geometry.dispose(); m.material.alphaMap.dispose(); m.material.dispose(); }
  V3.waterT = V3.waterT || { value: 0 }; V3.sunDir = V3.sunDir || { value: new THREE.Vector3(-0.5, 0.7, -0.5) }; V3.water = { of: decor, meshes: [] };
  for (const k of decor.lakes || []) {
    // (the mask: the lake's own outline, blurred — how deep it is: shallow at the shore, deep in the middle)
    const l = k.l, R = Math.max(l.rx, l.ry) * 1.3, N = V3_WATER.px, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.filter = `blur(${V3_WATER.blur}px)`;
    g.setTransform(N / (2 * R), 0, 0, N / (2 * R), N / 2 - l.x * N / (2 * R), N / 2 - l.y * N / (2 * R)); g.fillStyle = '#fff'; g.fill(k.body);
    const mask = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(2 * R, 2 * R, 1, 1); geo.rotateX(-Math.PI / 2);
    const mat = v3Shaded(new THREE.MeshLambertMaterial({ color: V3_WATER.col, transparent: true, alphaMap: mask, depthWrite: false }));
    const base = mat.onBeforeCompile; mat.userData.refOn = { value: 0 };
    mat.onBeforeCompile = sh => {
      base(sh); sh.uniforms.v3T = V3.waterT; sh.uniforms.v3Sun = V3.sunDir; sh.uniforms.v3Ref = V3R.tex; if (!V3R.m.value) V3R.m.value = new THREE.Matrix4(); sh.uniforms.v3RefM = V3R.m; sh.uniforms.v3RefOn = mat.userData.refOn; // (before the first reflection: a matrix — null, every frame threw and stopped)
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float v3T; uniform vec3 v3Sun; varying float vWY; float v3dep; uniform sampler2D v3Ref; uniform mat4 v3RefM; uniform float v3RefOn;')
        .replace('#include <alphamap_fragment>', `float v3m = texture2D(alphaMap, vAlphaMapUv).g; v3dep = smoothstep(0.5, 1.0, v3m);
          if (v3m < 0.5) discard;
          diffuseColor.rgb = mix(diffuseColor.rgb * 1.8 + vec3(0.015, 0.018, 0.0), diffuseColor.rgb, v3dep); // (the shallows lighter, the bottom showing)
          diffuseColor.a = mix(0.55, 0.93, v3dep) * smoothstep(0.5, 0.56, v3m);`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
          { // (ripples: three swells, their slope the normal; the sky in them by Fresnel, the sun's glint, foam at the shore)
            vec2 p = vV3; float t = v3T;
            vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.5, 0.86), d3 = vec2(0.97, -0.24);
            vec2 gr = d1 * cos(dot(p, d1) * 0.11 + t * 1.3) * 0.11 * 0.9 + d2 * cos(dot(p, d2) * 0.19 - t * 1.7) * 0.19 * 0.5 + d3 * cos(dot(p, d3) * 0.37 + t * 2.3) * 0.37 * 0.22;
            gr += vec2(v3gn(p * 0.21 + t * 0.3) - 0.5, v3gn(p * 0.23 - t * 0.27 + 7.0) - 0.5) * 0.35;
            // (from far, a pixel spans several ripples: their slopes came out at random — the sun's glint and the foam lit
            // here and there, the water white and mottled; they fade as a pixel grows past a ripple)
            float rk = 1.0 - smoothstep(${V3_WATER.fine[0]}, ${V3_WATER.fine[1]}, length(fwidth(p))); gr *= rk;
            vec3 n = normalize(vec3(-gr.x * 0.6, 1.0, -gr.y * 0.6));
            vec3 v = normalize(cameraPosition - vec3(vV3.x, vWY, vV3.y));
            float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
            vec3 sky = mix(vec3(0.1, 0.17, 0.24), vec3(0.32, 0.42, 0.52), clamp(reflect(-v, n).y, 0.0, 1.0));
            if (v3RefOn > 0.5) { // (what stands on the shore, upside down in it — v3Reflect: the scene from under the water's plane)
              vec4 rc = v3RefM * vec4(vV3.x, vWY, vV3.y, 1.0); vec2 ru = rc.xy / rc.w * 0.5 + 0.5 + gr * 0.008;
              vec3 rf = texture2D(v3Ref, clamp(ru, 0.001, 0.999)).rgb;
              sky = mix(sky, rf, ${V3_REFLECT.k} * smoothstep(0.0, 0.04, min(min(ru.x, 1.0 - ru.x), min(ru.y, 1.0 - ru.y))));
            }
            gl_FragColor.rgb = mix(gl_FragColor.rgb, sky * (1.0 - v3Night * 0.85), clamp(fr * 1.5 + 0.05, 0.0, 0.85));
            float sp = pow(max(dot(n, normalize(v3Sun + v)), 0.0), 220.0);
            sp *= rk; gl_FragColor.rgb += vec3(1.0, 0.95, 0.85) * sp * 3.0 * (1.0 - v3Night);
            float foam = (1.0 - smoothstep(0.52, 0.66, v3m)) * mix(0.5, smoothstep(0.45, 0.8, v3gn(p * 0.18 + vec2(t * 0.4, -t * 0.3))), rk) * mix(0.5, 1.0, rk);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.75, 0.78, 0.76) * (1.0 - v3Night * 0.8), foam * 0.45);
            gl_FragColor.a = max(gl_FragColor.a, fr * 0.6 + sp);
          }`);
    };
    mat.customProgramCacheKey = () => 'v3water4';
    const m = new THREE.Mesh(geo, mat); m.position.set(l.x, v3E(l.x, l.y) + 0.5, l.y); m.renderOrder = 2; m.userData.lake = l;
    V3.scene.add(m); V3.water.meshes.push(m);
  }
  v3SunDir();
}
// ---- reflections in the water: the scene drawn once more from under the plane of the lake nearest the middle of
// the screen (the camera mirrored in it; what's under the plane clipped off), small (V3_REFLECT.res of the screen),
// into a picture the water samples where each of its points would be seen in that mirror (v3RefM), shaken by its
// ripples. Only lakes at that height (within V3_REFLECT.dh) — others keep the sky's colour. Not when no lake is on
// screen, in the low graphics, or the light mode. ----
const V3_REFLECT = { res: 0.5, k: '0.85', dh: 4 };
const V3R = { tex: { value: null }, m: { value: null }, rt: null, cam: null };
function v3Reflect() {
  const W = V3.water; if (!W || !W.meshes.length) return;
  const off = () => { for (const m of W.meshes) m.material.userData.refOn.value = 0; };
  if (gfxLow || lite >= 2) { off(); return; }
  const B = V3.box, on = W.meshes.filter(m => { const l = m.userData.lake, R = Math.max(l.rx, l.ry) * 1.3; return B && l.x + R > B.x && l.x - R < B.x + B.w && l.y + R > B.y && l.y - R < B.y + B.h; });
  if (!on.length) { off(); return; }
  on.sort((a, b) => Math.hypot(a.position.x - cam.x, a.position.z - cam.y) - Math.hypot(b.position.x - cam.x, b.position.z - cam.y));
  const h = on[0].position.y, r = V3.r, w = Math.max(64, Math.round(V3.w * V3_REFLECT.res)), hh = Math.max(64, Math.round(V3.h * V3_REFLECT.res));
  if (!V3R.rt) { V3R.rt = new THREE.WebGLRenderTarget(w, hh, { type: THREE.HalfFloatType }); V3R.rt.texture.colorSpace = THREE.LinearSRGBColorSpace; V3R.cam = new THREE.PerspectiveCamera(); V3R.m.value = new THREE.Matrix4(); V3R.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); V3R.tex.value = V3R.rt.texture; }
  if (V3R.rt.width !== w || V3R.rt.height !== hh) V3R.rt.setSize(w, hh);
  // (the camera mirrored in the plane y = h: where it is, where it looks, and its up)
  const C = V3.cam, M = V3R.cam, p = C.position, f = new THREE.Vector3(); C.getWorldDirection(f);
  M.copy(C); M.position.set(p.x, 2 * h - p.y, p.z); M.up.set(0, 1, 0); M.lookAt(p.x + f.x, 2 * h - (p.y + f.y), p.z + f.z); M.updateMatrixWorld(); M.updateProjectionMatrix();
  V3R.m.value.multiplyMatrices(M.projectionMatrix, M.matrixWorldInverse);
  for (const m of W.meshes) { m.material.userData.refOn.value = Math.abs(m.position.y - h) < V3_REFLECT.dh ? 1 : 0; m.visible = false; }
  const was = { clip: r.clippingPlanes, sh: r.shadowMap.autoUpdate, deco: V3.ground && V3.ground.visible };
  V3R.plane.constant = -h + 0.3; r.clippingPlanes = [V3R.plane]; r.shadowMap.autoUpdate = false;
  r.setRenderTarget(V3R.rt); r.render(V3.scene, M); r.setRenderTarget(null);
  r.clippingPlanes = was.clip; r.shadowMap.autoUpdate = was.sh; for (const m of W.meshes) m.visible = true;
}
// (where the sun is, for the glint on the water)
function v3SunDir() { V3.sunDir.value.copy(V3.sun.position).sub(V3.sun.target.position).normalize(); }
// ---- fog of war and night, as the flat map's: two pictures of the whole map (V3_SHADE world units a pixel) — where
// the fog lies (fogHoles cut out of it) and where it's dark (nightLights cut out) — laid over the ground and the
// scenery in their shader (v3Shaded: the colour mixed toward the fog's and the night's blue, a warm glow where lit).
// Units and buildings over it, as on the flat map. Made again every V3_SHADE_MS. The sun and the sky dim at night. ----
const V3_SHADE = 8, V3_SHADE_MS = 60, V3_GLOW = 0.18;
const V3U = { v3Fog: { value: null }, v3Dark: { value: null }, v3Size: { value: null }, v3FogCol: { value: null }, v3Night: { value: 0 }, v3Lit: { value: 0 }, v3Deco: { value: null }, v3DecoBox: { value: null }, v3Time: { value: 0 },
  v3Tg: { value: null }, v3Tg2: { value: null }, v3Ty: { value: null }, v3Td: { value: null }, v3Tr: { value: null }, v3Tm: { value: null }, v3Ng: { value: null }, v3Nd: { value: null }, v3Nr: { value: null }, v3GndOn: { value: 0 }, v3MacroLum: { value: 0.1 }, v3GLum: { value: null }, v3Meadow: { value: null }, v3Wet: { value: 0 } };
// ---- the ground: real textures (js/ui/ground3d.js — Poly Haven photos, CC0; tools/ground3d.py), each with its normal
// map, picked from the map's picture: meadow where it's green, dry grass where yellow (and in wide drifts), earth where
// brown, mud where dark brown, rock on the steep (slope0..1: 1 − the normal's up), the high (high0..1, world units) and
// where grey. The picture's light and dark kept over them (macro of it), so fields, woods and shores still show. In
// world units a tile (two sizes each, so no repeat shows); nk: how deep the normal maps; far0..1: world units a pixel
// over which they fade (far off they only glitter). ----
const V3_GND = { grass: '95.0', grass2: '70.0', g2k: '0.85', dry: '170.0', dirt: '210.0', rock: '150.0', mud: '120.0', k2: '3.3', macro: '0.55', nk: '1.0', slope0: '0.16', slope1: '0.4', high0: '95.0', high1: '170.0', far0: '0.6', far1: '2.5' };
function v3GroundTex(macroLum) {
  V3U.v3MacroLum.value = macroLum;
  if (V3U.v3GndOn.value || typeof GROUND3D !== 'object') return;
  const mk = (src, srgb) => {
    const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
    const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; }; im.src = src; return t;
  };
  const G = GROUND3D, U = V3U;
  U.v3Tg.value = mk(G.grass.d, 1); U.v3Tg2.value = mk((G.grass2 || G.grass).d, 1); U.v3Ty.value = mk(G.dry.d, 1); U.v3Td.value = mk(G.dirt.d, 1); U.v3Tr.value = mk(G.rock.d, 1); U.v3Tm.value = mk(G.mud.d, 1);
  U.v3Ng.value = mk(G.grass.n); U.v3Nd.value = mk(G.dirt.n); U.v3Nr.value = mk(G.rock.n);
  // (each layer's mean light, so the meadow's two grasses and the dry one are mixed at one brightness — their own
  // light and dark mixed in drifts read as clouds' shadows)
  U.v3GLum.value = new THREE.Vector3(1, 1, 1);
  [['grass', 0], ['grass2', 1], ['dry', 2]].forEach(([k, j]) => { const im = new Image(); im.onload = () => {
    const N = 32, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', BG_CTX); g.drawImage(im, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data; let L = 0; for (let i = 0; i < d.length; i += 4) L += 0.2126 * (d[i] / 255) ** 2.2 + 0.7152 * (d[i + 1] / 255) ** 2.2 + 0.0722 * (d[i + 2] / 255) ** 2.2;
    U.v3GLum.value.setComponent(j, L / (N * N)); }; im.src = (G[k] || G.grass).d; });
  U.v3GndOn.value = 1;
}
function v3Shaded(mat, deco) {
  if (deco) mat.defines = { V3_DECO: 1 }; // (the ground: what's drawn on it too, v3Deco)
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, V3U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vV3;\n#ifdef V3_DECO\nvarying vec3 vWN; varying float vWH;\n#endif').replace('#include <project_vertex>', `#include <project_vertex>
      vec4 v3w = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        v3w = instanceMatrix * v3w;
      #endif
      vV3 = (modelMatrix * v3w).xz;
      #ifdef V3_DECO
        vWN = normalize(objectNormal); vWH = (modelMatrix * v3w).y;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef V3_DECO
        vec3 v3tn = vec3(0.0, 0.0, 1.0); float v3far = 1.0;
        if (v3GndOn > 0.0) {
          vec3 m = diffuseColor.rgb;
          float v3out = max(max(-vV3.x, vV3.x - v3Size.x), max(-vV3.y, vV3.y - v3Size.y)); // (past the map's edge: its colours faded to the meadow's)
          if (v3out > 0.0) m = mix(m, v3Meadow, smoothstep(0.0, 300.0, v3out));
          float ml = dot(m, vec3(0.2126, 0.7152, 0.0722));
          float k2 = ${V3_GND.k2};
          vec2 gx = dFdx(vV3), gy = dFdy(vV3); // (the gradients outside the branches below: inside them they're undefined)
          #define V3T(T, S) mix(textureGrad(T, vV3 / S, gx / S, gy / S), textureGrad(T, vV3 / (S * k2) + 0.37, gx / (S * k2), gy / (S * k2)), 0.25)
          // (what the picture is there)
          float green = smoothstep(0.0, 0.03, m.g - max(m.r, m.b) * 0.95);
          float brown = smoothstep(0.0, 0.025, m.r - m.g);
          float yellow = smoothstep(0.0, 0.05, min(m.r, m.g) - m.b * 1.6) * (1.0 - brown);
          float grey = 1.0 - smoothstep(0.015, 0.06, max(m.r, max(m.g, m.b)) - min(m.r, min(m.g, m.b)));
          float drift = smoothstep(0.5, 0.78, v3gn(vV3 * 0.006) * 0.65 + v3gn(vV3 * 0.023 + 5.3) * 0.35);
          float wy = clamp(max(yellow * (1.0 - green), drift * 0.45), 0.0, 1.0);
          float wd = brown, wm = brown * (1.0 - smoothstep(0.03, 0.08, ml));
          float wr = clamp(smoothstep(${V3_GND.slope0}, ${V3_GND.slope1}, 1.0 - vWN.y) + smoothstep(${V3_GND.high0}, ${V3_GND.high1}, vWH) * 0.5 + grey * 0.6, 0.0, 1.0);
          wr = clamp(wr * (0.7 + 0.6 * v3gn(vV3 * 0.017)), 0.0, 1.0);
          float w2 = smoothstep(0.35, 0.7, v3gn(vV3 * 0.009 + 2.7) * 0.7 + v3gn(vV3 * 0.04) * 0.3) * ${V3_GND.g2k};
          // (only the layers that show here — each costs two looks at a texture)
          vec3 c = vec3(0.0);
          if (wr < 0.99) {
            if (wd < 0.99) {
              c = w2 < 0.99 ? V3T(v3Tg, ${V3_GND.grass}).rgb : vec3(0.0);
              if (w2 > 0.01) c = mix(c, V3T(v3Tg2, ${V3_GND.grass2}).rgb * (v3GLum.x / v3GLum.y), w2);
              if (wy > 0.01) c = mix(c, V3T(v3Ty, ${V3_GND.dry}).rgb * (v3GLum.x / v3GLum.z), wy);
            }
            if (wd > 0.01) c = mix(c, V3T(v3Td, ${V3_GND.dirt}).rgb, wd);
            if (wm > 0.01) c = mix(c, V3T(v3Tm, ${V3_GND.mud}).rgb, wm);
          }
          if (wr > 0.01) c = mix(c, V3T(v3Tr, ${V3_GND.rock}).rgb, wr);
          // (the picture's light and dark over it)
          c *= mix(1.0, clamp(ml / v3MacroLum, 0.45, 1.6), ${V3_GND.macro});
          diffuseColor.rgb = c;
          v3far = 1.0 - smoothstep(${V3_GND.far0}, ${V3_GND.far1}, length(fwidth(vV3)));
          if (v3far > 0.01) { // (the normal maps — only near, one size)
            #define V3N(T, S) (textureGrad(T, vV3 / S, gx / S, gy / S).xyz * 2.0 - 1.0)
            float wn = max(wd, wm);
            vec3 nn = wr < 0.99 ? (wn < 0.99 ? V3N(v3Ng, ${V3_GND.grass}) : vec3(0.0, 0.0, 1.0)) : vec3(0.0, 0.0, 1.0);
            if (wr < 0.99 && wn > 0.01) nn = mix(nn, V3N(v3Nd, ${V3_GND.dirt}), wn);
            if (wr > 0.01) nn = mix(nn, V3N(v3Nr, ${V3_GND.rock}), wr);
            v3tn = nn; v3tn.xy *= ${V3_GND.nk} * v3far; v3tn = normalize(v3tn);
          }
        }
      #endif`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #ifdef V3_DECO
        if (v3GndOn > 0.0) { // (the normal maps: in the ground's own frame — x along the world's x, y along its z — then to the view)
          vec3 N = normalize(vWN), Tn = normalize(vec3(1.0, 0.0, 0.0) - N * N.x), Bn = -cross(N, Tn);
          normal = normalize((viewMatrix * vec4(normalize(Tn * v3tn.x + Bn * v3tn.y + N * v3tn.z), 0.0)).xyz);
        }
      #endif`).replace('#include <common>', `#include <common>
      float v3gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float v3gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(v3gh(i), v3gh(i + vec2(1, 0)), f.x), mix(v3gh(i + vec2(0, 1)), v3gh(i + vec2(1, 1)), f.x), f.y); }
      varying vec2 vV3; uniform float v3GndOn; uniform float v3MacroLum; uniform vec3 v3GLum; uniform vec3 v3Meadow; uniform float v3Wet;
      #ifdef V3_DECO
        uniform sampler2D v3Tg; uniform sampler2D v3Tg2; uniform sampler2D v3Ty; uniform sampler2D v3Td; uniform sampler2D v3Tr; uniform sampler2D v3Tm; uniform sampler2D v3Ng; uniform sampler2D v3Nd; uniform sampler2D v3Nr;
      #endif
      #ifdef V3_DECO
        varying vec3 vWN; varying float vWH;
      #endif
      uniform sampler2D v3Fog; uniform sampler2D v3Dark; uniform vec2 v3Size; uniform vec4 v3FogCol; uniform float v3Night; uniform float v3Lit; uniform sampler2D v3Deco; uniform vec4 v3DecoBox;`)
      .replace('#include <fog_fragment>', `vec2 v3uv = vec2(vV3.x / v3Size.x, 1.0 - vV3.y / v3Size.y);
      #ifdef V3_DECO
        if (v3Wet > 0.0) { // (the rain: the ground soaked darker, a wet sheen looking across it, puddles shining on the flat)
          vec3 v3v = normalize(cameraPosition - vec3(vV3.x, vWH, vV3.y)); float fr = pow(1.0 - max(v3v.y, 0.0), 3.0);
          float pud = smoothstep(0.7, 0.86, v3gn(vV3 * 0.06)) * smoothstep(0.95, 0.995, vWN.y);
          gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - 0.28 * v3Wet * (1.0 - pud * 0.5)) + v3Wet * (fr * 0.1 + pud * (0.04 + fr * 0.18)) * vec3(0.5, 0.58, 0.66) * (1.0 - v3Night * 0.8);
        }
      #endif
      if (v3Night > 0.0) { float d = texture2D(v3Dark, v3uv).a; gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.031, 0.055, 0.157), d * v3Night) + vec3(1.0, 0.67, 0.31) * (1.0 - d) * v3Lit; }
      if (v3FogCol.w > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, v3FogCol.rgb, texture2D(v3Fog, v3uv).a * v3FogCol.w);
      #ifdef V3_DECO
        vec2 v3du = (vV3 - v3DecoBox.xy) / v3DecoBox.zw;
        if (v3du.x > 0.0 && v3du.x < 1.0 && v3du.y > 0.0 && v3du.y < 1.0) { vec4 dc = texture2D(v3Deco, vec2(v3du.x, 1.0 - v3du.y)); gl_FragColor.rgb = mix(gl_FragColor.rgb, dc.rgb, dc.a); }
      #endif
      #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => 'v3shade2' + (deco ? 'd' + Object.values(V3_GND).join() : ''); return mat;
}
// trees and bushes less low-poly: the leaves (the green points) lit as a soft round crown — the normal bent out from
// the trunk and up, not each facet's own — with clumps of light and dark leaves, darker deep inside and low down,
// and swaying a little in the wind (each tree its own beat); trunks and rocks as they are
const V3_LEAF = { bend: 0.75, sway: 0.025, cells: '24.0', cut: '0.85', tilt: '1.3', cardK: '1.45' };
function v3Leafy(mat, cards) {
  const was = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    was(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float v3Time; varying float vLeaf; varying vec3 vLP;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vLeaf = (color.g > color.r * 1.08 && color.g > color.b * 1.1) ? 1.0 : 0.0; vLP = position;
        objectNormal = normalize(mix(objectNormal, normalize(vec3(position.x, 0.55, position.z)), vLeaf * ${V3_LEAF.bend}));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float v3ph = instanceMatrix[3].x * 0.013 + instanceMatrix[3].z * 0.017;
        transformed.xz += vec2(sin(v3Time * 1.3 + v3ph), cos(v3Time * 1.1 + v3ph * 1.7)) * ${V3_LEAF.sway} * position.y * position.y * vLeaf;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying float vLeaf; varying vec3 vLP;
        float v3h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float v3n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(v3h3(i), v3h3(i + vec3(1, 0, 0)), f.x), mix(v3h3(i + vec3(0, 1, 0)), v3h3(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(v3h3(i + vec3(0, 0, 1)), v3h3(i + vec3(1, 0, 1)), f.x), mix(v3h3(i + vec3(0, 1, 1)), v3h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef V3_CARDS
          if (vLeaf > 0.5) normal = normalize(vNormal); // (a card's back as lit as its front: the crown's normal, not flipped)
        #else
        if (vLeaf > 0.5) { // (leaves, not a lump: V3_LEAF.cells to the tree's size, each a leaf with its own tilt; gaps darker; the outline ragged)
          vec3 q = vLP * ${V3_LEAF.cells};
          float near = 1.0 - smoothstep(0.5, 1.2, length(fwidth(q))); // (far off a leaf is under a pixel: then the lump's own shading)
          float lm = v3n3(q) * 0.6 + v3n3(q * 2.17 + 11.0) * 0.4;
          vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          float edge = 1.0 - abs(dot(fn, normalize(vViewPosition)));
          if (lm < smoothstep(0.25, 0.9, edge) * ${V3_LEAF.cut} * near) discard;
          vec3 c = floor(q * 1.6);
          vec3 tilt = vec3(v3h3(c), v3h3(c + 7.13), v3h3(c + 3.31)) - 0.5;
          normal = normalize(normal + tilt * ${V3_LEAF.tilt} * near);
          diffuseColor.rgb *= mix(1.0, (0.55 + 0.75 * smoothstep(0.2, 0.8, lm)) * (0.85 + 0.3 * v3h3(c + 1.7)), near);
        }
        #endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vLeaf > 0.5) {
          float cl = v3gn(vLP.xz * 14.0 + vLP.y * 9.0) * 0.6 + v3gn(vLP.xz * 37.0 - vLP.y * 23.0) * 0.4;
          diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, 0.72) * vec3(0.78, 0.8, 0.66); // (a deeper, duller green than the kit's)
          #ifndef V3_CARDS
          diffuseColor.rgb *= (0.62 + 0.62 * cl) * (0.75 + 0.25 * smoothstep(0.0, 0.9, length(vLP.xz) * 2.2 + vLP.y * 0.25));
          #else
          diffuseColor.rgb *= ${V3_LEAF.cardK} * (0.85 + 0.3 * cl); // (the cards' picture already has its light and dark leaves)
          #endif
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.0, 0.72), smoothstep(0.55, 0.8, cl) * 0.5);
        }`);
  };
  if (cards) mat.defines = Object.assign(mat.defines || {}, { V3_CARDS: 1 });
  mat.customProgramCacheKey = () => 'v3leaf' + (cards ? 'c' : '') + Object.values(V3_LEAF).join(); return mat;
}
// ---- the night's own lights in 3D (over the flat map's, nightLights): headlights — a pool of light ahead of each
// vehicle of ours, and of a seen enemy one (V3_HEAD_L: how far ahead, of its model's length; V3_HEAD_R: how wide; a);
// muzzle flashes lighting what's round them for a moment (V3_FLASH_R). V3_MOON: the sun's light at full dark ----
const V3_MOON = '#7d95d6', V3_HEAD_L = 1.6, V3_HEAD_R = 34, V3_HEAD_A = 0.75, V3_FLASH_R = 46;
function v3NightLights() {
  const out = [];
  for (const u of s.units) {
    if (!CAR.has(u.type) || Sim.TYPES[u.type].air) continue;
    if (s.fog && !(u.side === 'blue' ? shownAt(u) : s.vis.blue.has(u.id) && shownAt(u))) continue;
    const L = (SIZE[u.type] || 10) * (V3_LEN[u.type] || 1.6), hd = u.hd || 0;
    for (const f of [0.75, 1.3]) out.push([u.x + Math.cos(hd) * L * V3_HEAD_L * f * 0.6, u.y + Math.sin(hd) * L * V3_HEAD_L * f * 0.6, V3_HEAD_R * (0.55 + 0.45 * f), V3_HEAD_A * (f > 1 ? 0.7 : 1)]);
  }
  for (const sh of s.shots) if (sh.dur + 0.12 - sh.life < 0.15) out.push([sh.x1, sh.y1, V3_FLASH_R, 0.8]);
  return out;
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
  V3.sun.intensity = V3_SUN * Math.PI * (1 - 0.62 * k); V3.sky.intensity = V3_SKY * Math.PI * (1 - 0.45 * k);
  // (the moon: by night the sun's light a cool blue, and the sky's — the shapes and their shadows still there, not just dark)
  const mc = v3Tmp.moon || (v3Tmp.moon = [new THREE.Color('#ffeacc'), new THREE.Color(V3_MOON), new THREE.Color('#c4d8f0'), new THREE.Color('#7f93c4')]);
  V3.sun.color.copy(mc[0]).lerp(v3Tmp.sunG || mc[0], (V3.gold || 0) * 0.75).lerp(mc[1], k); V3.sky.color.copy(mc[2]).lerp(mc[1], (V3.gold || 0) * 0.15).lerp(mc[3], k);
  // (the fog: its colour and how thick, fading in at the start as on the flat map)
  const fc = V3U.v3FogCol.value;
  if (s.fog) { const m = colors.fog.match(/[\d.]+/g) || [0, 0, 0, 0.5]; fc.set(m[0] / 255, m[1] / 255, m[2] / 255, (m[3] !== undefined ? +m[3] : 1) * (s.fogAt ? Math.min(1, (s.t - s.fogAt) / 3) : 1)); }
  else fc.w = 0;
  V3U.v3Size.value.set(s.W, s.H);
  if (now - (V3.shadeAt || 0) < V3_SHADE_MS) return; V3.shadeAt = now;
  if (s.fog) v3ShadePic(V3.fogP, fogHoles);
  if (k) v3ShadePic(V3.darkP, g => { for (const [x, y, r, a] of nightLights().concat(v3NightLights())) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
}
// ---- what the flat map draws on the ground — where we may build and the building at the cursor, the control map,
// the enemy as we know it, the bulldozers' jobs, the roads being laid, the squads out of the exact picture, the front,
// what's picked (its rally line), the pings — drawn by the same functions onto a picture of what's on screen (V3.box:
// the world under the screen's corners), laid on the ground in its shader over the fog and the night (V3_DECO). ----
const V3_DECO = 1536, V3_CLOUDS = 0.45; // (the clouds' shadows: fainter than on the flat map — over real light and shade they were dark blots)
function v3DecoBox() {
  const w = V3.w || 1, h = V3.h || 1, P = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0]].map(([x, y]) => v3World(x, y));
  const M = 60, x0 = Math.max(-M, Math.min(...P.map(p => p.x)) - M), x1 = Math.min(s.W + M, Math.max(...P.map(p => p.x)) + M);
  const y0 = Math.max(-M, Math.min(...P.map(p => p.y)) - M), y1 = Math.min(s.H + M, Math.max(...P.map(p => p.y)) + M);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}
// ---- each unit's side at a glance: a soft disc of its side's colour on the ground under it (as the team circles of
// other RTS games) — the army paint and the ground are much the same colours, and from the zoom one plays at the
// sides were hard to tell apart. V3_DISC: its radius — of its model's length (vehicles, aircraft) / of its size (soldiers); a: how strong ----
const V3_DISC = { veh: 0.5, foot: 2.8, a: 0.42 }; // (veh: of its model's length)
function v3Discs(g) {
  const A = V3.discs || []; if (!A.length) return;
  const P = V3.discPic || (V3.discPic = [colors.blue, colors.red].map(col => {
    const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), r = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    r.addColorStop(0, col); r.addColorStop(0.62, col); r.addColorStop(0.78, 'rgba(0,0,0,0)'); // (a disc with a soft edge; its middle under the unit anyway)
    x.globalAlpha = 1; x.fillStyle = r; x.fillRect(0, 0, N, N);
    x.globalCompositeOperation = 'destination-out'; const h = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); h.addColorStop(0, 'rgba(0,0,0,0.85)'); h.addColorStop(0.5, 'rgba(0,0,0,0.6)'); h.addColorStop(0.62, 'rgba(0,0,0,0)'); x.fillStyle = h; x.fillRect(0, 0, N, N); // (lighter in the middle: a ring more than a blot)
    return c;
  }));
  g.globalAlpha = V3_DISC.a;
  for (let i = 0; i < A.length; i += 4) { const r = A[i + 2]; g.drawImage(P[A[i + 3]], A[i] - r, A[i + 1] - r, r * 2, r * 2); }
  g.globalAlpha = 1;
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
  if (!lite) { drawTracks(g); drawClouds(g, V3_CLOUDS); } drawWeather(g); if (s.extras) drawBoltFlat(g); // (tracks in the ground, clouds' shadows, the morning fog; rain — over the screen)
  v3Discs(g);
  if (s.fog) { if (Sim.friction(s)) drawQuality(g); drawEnemyIntel(g); drawMarks(g); }
  drawDozerJobs(g); drawBuildArea(g);
  for (const q of s.squads) if (q.side === 'blue' && !q.dead && !sqShown(q)) drawGuess(g, q, guessAt(q), isSel(q.id));
  drawRoutes(g); drawFront(g); drawPicked(g); drawDesignated(g); drawAsks(g); drawPings(g);
  V3U.v3DecoBox.value.set(B.x, B.y, B.w, B.h); D.t.needsUpdate = true;
}
// ---- close up, the ground's small things: tufts of grass where the map is green, and pebbles where it's earth or
// rock — set out round what's on screen, in cells of V3_TUFT.cell (each cell's the same every time: a hash of where
// it is), not on water, under buildings or in the woods; only zoomed in (the view under V3_TUFT.vw wide), shrinking
// to nothing as it nears that. Made again when the view has moved a cell or more ----
const V3_TUFT = { cell: 6, vw: 1100, max: 14000, grass: 1.0, stone: 0.2, h: 4, sh: 2.0 };
function v3TuftPic() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) { // (blades: from the bottom, bent a little, darker at the root)
    const x0 = N * (0.2 + 0.6 * r()), h = N * (0.45 + 0.5 * r()), bend = (r() - 0.5) * N * 0.35, w = 2 + r() * 3;
    const gr = g.createLinearGradient(0, N, 0, N - h); gr.addColorStop(0, '#2f3a1c'); gr.addColorStop(1, r() < 0.3 ? '#b5b27a' : '#a7a670');
    g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, N); g.quadraticCurveTo(x0 + bend * 0.3, N - h * 0.6, x0 + bend, N - h); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function v3TuftInit() {
  // (a tuft: two crossed upright cards, their foot at y 0; a pebble: a small squashed stone)
  const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(48).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); // (lit as the ground is: from above)
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([...a.attributes.uv.array, ...b.attributes.uv.array]), 2));
  geo.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5, 0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]); // (each card both ways round, one-sided: two-sided, the back's normal turned down and it was black)
  const gm = v3Shaded(new THREE.MeshLambertMaterial({ map: v3TuftPic(), alphaTest: 0.5 }));
  const sg = new THREE.IcosahedronGeometry(0.5, 0); sg.scale(1, 0.45, 0.8); sg.translate(0, 0.1, 0);
  const sm = v3Shaded(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
  const mk = (g, m) => { const M = new THREE.InstancedMesh(g, m, V3_TUFT.max); M.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(V3_TUFT.max * 3), 3); M.receiveShadow = true; M.frustumCulled = false; M.count = 0; V3.scene.add(M); return M; };
  V3.tufts = { grass: mk(geo, gm), stone: mk(sg, sm) };
}
function v3Tufts(vw) {
  if (gfxLow || lite || !V3.gmap || !V3.box) { if (V3.tufts) V3.tufts.grass.count = V3.tufts.stone.count = 0; return; }
  if (!V3.tufts) v3TuftInit();
  const T = V3.tufts, k = 1 - Math.max(0, Math.min(1, (vw - V3_TUFT.vw * 0.7) / (V3_TUFT.vw * 0.3))); // (1 close in, 0 from V3_TUFT.vw)
  if (k <= 0) { T.grass.count = T.stone.count = 0; V3.tuftKey = null; return; }
  const C = V3_TUFT.cell, B = V3.box, i0 = Math.floor(B.x / C), j0 = Math.floor(B.y / C), i1 = Math.ceil((B.x + B.w) / C), j1 = Math.ceil((B.y + B.h) / C);
  const key = [i0, j0, i1, j1, Math.round(k * 8), V3.padSig, s.nodes.length, V3.craters ? V3.craters.length + ':' + (V3.craters[0] || {}).x : 0].join();
  if (V3.tuftKey === key) return; V3.tuftKey = key;
  const G = V3.gmap, m = v3Tmp.tm || (v3Tmp.tm = new THREE.Matrix4()), q = v3Tmp.tq2 || (v3Tmp.tq2 = new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const blocks = s.nodes.filter(n => n.kind !== 'drone' && n.hp > 0).map(n => [n.x, n.y, (Sim.STRUCTS[n.kind].r * 1.3 + 8) ** 2]).concat((s.posts || []).map(o => [o.x, o.y, (Sim.POSTS[o.kind].r * 1.3 + 8) ** 2]))
    .concat((V3.craters || []).filter(c => c.x > B.x - 60 && c.x < B.x + B.w + 60 && c.y > B.y - 60 && c.y < B.y + B.h + 60).map(c => [c.x, c.y, (c.r * 1.2) ** 2])); // (none in a crater)
  let ng = 0, ns = 0;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const h = v3Rnd(i * 7.13, j * 3.71), x = (i + v3Rnd(i, j)) * C, y = (j + v3Rnd(j, i)) * C;
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) continue;
    const gi = (Math.floor(y / s.H * G.h) * G.w + Math.floor(x / s.W * G.w)) * 4, R = G.d[gi], Gr = G.d[gi + 1], Bl = G.d[gi + 2];
    const green = (Gr - (R + Bl) / 2) / 255, lum = (R + Gr + Bl) / 765;
    const grass = green > 0.04 && lum < 0.6, stone = !grass && green < 0.02;
    const clump = v3Rnd(Math.floor(i / 5) * 3.1, Math.floor(j / 5) * 5.7) * 0.6 + v3Rnd(Math.floor(i / 2) * 1.3, Math.floor(j / 2) * 2.9) * 0.4; // (in patches: some ground bare, some thick)
    if (!(grass ? h < V3_TUFT.grass * Math.max(0, clump - 0.35) / 0.65 : stone && h < V3_TUFT.stone)) continue;
    if (s.lakes.length && lakeAt(s, { x, y })) continue;
    if (s.ground && Sim.groundAt(s, x, y)) continue; // (woods, mud, cliffs, roads: their own)
    if (blocks.some(b => (b[0] - x) ** 2 + (b[1] - y) ** 2 < b[2])) continue;
    const r = v3Rnd(i * 1.7, j * 2.3), g = v3E(x, y);
    q.setFromAxisAngle(up, r * 6.283);
    if (grass && ng < V3_TUFT.max) {
      const S = V3_TUFT.h * (0.6 + 0.8 * r) * k; m.compose(p.set(x, g - 0.3, y), q, sc.set(S * 1.1, S, S * 1.1)); T.grass.setMatrixAt(ng, m);
      col.setRGB(R / 255, Gr / 255, Bl / 255).convertSRGBToLinear(); col.lerp(v3Tmp.dry || (v3Tmp.dry = new THREE.Color('#9c9460').convertSRGBToLinear()), 0.3 + 0.3 * h).multiplyScalar(2.0 + 0.6 * h); T.grass.setColorAt(ng++, col); // (the ground's colour under it, toward dry straw: not bright green blobs) // (its tint: the ground's under it, a little lighter — the blades catch the light)
    } else if (stone && ns < V3_TUFT.max) {
      const S = V3_TUFT.sh * (0.6 + 1.2 * r * r) * k; m.compose(p.set(x, g, y), q, sc.set(S, S, S)); T.stone.setMatrixAt(ns, m);
      col.setRGB(R / 255, Gr / 255, Bl / 255).convertSRGBToLinear().multiplyScalar(0.8 + 0.6 * h); T.stone.setColorAt(ns++, col);
    }
  }
  T.grass.count = ng; T.stone.count = ns;
  for (const M of [T.grass, T.stone]) { M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true; }
}
// ---- the sun's shadow box: fitted to what's on screen, in the sun's own view — the ground under the screen's corners
// (and V3_SHADOW_M round it, for what stands just off screen and throws its shadow in; up to V3_SHADOW_UP high),
// its edges snapped to the shadow map's texels (or the shadows crawl as the view moves). A square of 1.8 × the
// screen's width was most of it ground off screen: about 3 × the texels on what's seen now ----
const V3_SHADOW_M = 60, V3_SHADOW_UP = 120, V3_SHADOW_STEP = 64;
function v3SunBox(ty, vw) {
  const sun = V3.sun, sc = sun.shadow.camera, N = sun.shadow.mapSize.x;
  const sv = V3.sunV; sun.target.position.set(cam.x, ty, cam.y); sun.position.set(cam.x + sv.x * 2600, ty + sv.y * 2600, cam.y + sv.z * 2600);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); sc.position.copy(sun.position); sc.lookAt(sun.target.position); sc.updateMatrixWorld();
  const inv = sc.matrixWorldInverse, v = v3Tmp.sv || (v3Tmp.sv = new THREE.Vector3()), w = V3.w || 1, h = V3.h || 1;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h]]) {
    const p = v3World(px, py), g = v3E(p.x, p.y);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const up of [0, V3_SHADOW_UP]) {
      v.set(p.x + dx * V3_SHADOW_M, g + up, p.y + dy * V3_SHADOW_M).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  }
  // (each side its own length, in steps of V3_SHADOW_STEP, so the texels keep their size as it moves; edges on the texel grid)
  const W = Math.ceil(Math.max(300, x1 - x0) / V3_SHADOW_STEP) * V3_SHADOW_STEP, H = Math.ceil(Math.max(300, y1 - y0) / V3_SHADOW_STEP) * V3_SHADOW_STEP;
  const tx = W / N, ty2 = H / N, cx = Math.round((x0 + x1) / 2 / tx) * tx, cy = Math.round((y0 + y1) / 2 / ty2) * ty2;
  if (sc.left !== cx - W / 2 || sc.top !== cy + H / 2) { sc.left = cx - W / 2; sc.right = cx + W / 2; sc.bottom = cy - H / 2; sc.top = cy + H / 2; sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix(); }
}
// ---- the weather in 3D (Sim weatherAt): rain as real drops — streaks falling through a box round what's on screen,
// slanting with the wind, moved in their shader (V3_RAIN) — and the ground wet under it (v3Wet: darker, a sheen, puddles);
// the morning fog as banks lying in the low ground (level under 1: as the flat map's drawLowFog), drifting slowly ----
const V3_RAIN = { n: 3000, len: 10, h: 420, fall: 330, a: 0.5, far: 1700 };
function v3Weather() {
  const w = s.extras ? Sim.weatherAt(s) : { rain: 0, fog: 0, dust: 0 }, rain = gfxLow || reduceMotion ? 0 : w.rain;
  V3U.v3Wet.value += ((w.rain > 0.05 ? Math.min(1, w.rain * 1.2) : 0) - V3U.v3Wet.value) * 0.02; // (wet slowly, dry slowly)
  if (!V3.rain && rain > 0.01) {
    const N = V3_RAIN.n, B = new Float32Array(N * 6), E = new Float32Array(N * 2), P = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); B.set([x, y, z, x, y, z], i * 6); E[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aB', new THREE.BufferAttribute(B, 3)); g.setAttribute('aE', new THREE.BufferAttribute(E, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: new THREE.Vector3() }, uS: { value: 1000 }, uT: { value: 0 }, uA: { value: 0 }, uW: { value: new THREE.Vector2() } },
      vertexShader: `attribute vec3 aB; attribute float aE; uniform vec3 uC; uniform float uS, uT; uniform vec2 uW; varying float vE;
        void main() { float H = ${V3_RAIN.h.toFixed(1)}, y = fract(aB.y - uT * ${V3_RAIN.fall.toFixed(1)} * (0.8 + 0.4 * aB.z) / H) * H;
          vec3 p = vec3(uC.x + (aB.x - 0.5) * uS, uC.y + y + aE * ${V3_RAIN.len.toFixed(1)}, uC.z + (aB.z - 0.5) * uS);
          p.xz += uW * (y + aE * ${V3_RAIN.len.toFixed(1)}) * 0.035; vE = aE; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uA; varying float vE; void main() { gl_FragColor = vec4(0.78, 0.82, 0.88, uA * (0.35 + 0.65 * vE)); }` });
    V3.rain = new THREE.LineSegments(g, m); V3.rain.frustumCulled = false; V3.rain.renderOrder = 5; V3.scene.add(V3.rain);
  }
  v3DustWeather(gfxLow ? 0 : w.dust || 0);
  { const f = typeof boltFlash === 'function' ? boltFlash() : 0; // (a flash: the night lifted, the sky lit — for a moment)
    if (f) { V3U.v3Night.value *= 1 - V3_BOLT.flash * f; V3.sky.intensity += V3_SKY * Math.PI * 0.9 * f; if (V3.skyU) V3.skyU.night.value *= 1 - 0.35 * f; } }
  // (zoomed far out: the drops' box round the middle covered a patch of the screen — then the flat map's streaks over all
  // of it instead, drawRain; V3_RAIN.far: how wide a view the drops still fill)
  V3.rainFar = !!V3.box && Math.max(V3.box.w, V3.box.h) > V3_RAIN.far;
  if (V3.rain) {
    V3.rain.visible = rain > 0.01 && !V3.rainFar;
    if (V3.rain.visible) { const U = V3.rain.material.uniforms, B = V3.box; U.uC.value.set(cam.x, v3E(cam.x, cam.y) - 20, cam.y); U.uS.value = B ? Math.min(1400, Math.max(B.w, B.h) * 0.8) : 1000; U.uT.value = performance.now() / 1000; U.uA.value = V3_RAIN.a * rain * (1 - (V3.nightK || 0) * 0.5); U.uW.value.set(WIND.x, WIND.y); }
  }
}
// ---- a dust storm (Sim weatherAt .dust, only round noon): the haze brown and close (v3Sky), the sun dimmed, clouds
// of dust rolling over the ground with the wind (v3DustClouds) and fine streaks of it blowing past (V3.dust, in its
// shader like the rain). Lightning (field.js bolt, rain at night): the bolt as a chain of glows from the cloud down,
// branching, a real light at it, the night and the sky lifted for the flash (v3BoltFx, v3Weather) ----
const V3_DUST = { col: '#b38a55', hor: 0.85, zen: 0.65, near: 0.3, far: 0.7, sun: 0.5, n: 2200, len: 18, h: 140, speed: 150, a: 0.3, cloud: 0.3 };
const V3_BOLT = { h: 1100, dist: 2600, light: 6000, glow: 9, step: 4, flash: 0.6 };
function v3DustWeather(dw) {
  if (!V3.dust && dw > 0.01) {
    const N = V3_DUST.n, B = new Float32Array(N * 6), E = new Float32Array(N * 2), P = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); B.set([x, y, z, x, y, z], i * 6); E[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aB', new THREE.BufferAttribute(B, 3)); g.setAttribute('aE', new THREE.BufferAttribute(E, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: new THREE.Vector3() }, uS: { value: 1000 }, uT: { value: 0 }, uA: { value: 0 }, uD: { value: new THREE.Vector2(1, 0) } },
      vertexShader: `attribute vec3 aB; attribute float aE; uniform vec3 uC; uniform float uS, uT; uniform vec2 uD; varying float vE, vF;
        void main() { float sp = ${V3_DUST.speed.toFixed(1)} * (0.6 + 0.8 * aB.z), al = (fract(aB.x + uT * sp / uS) - 0.5) * uS, ac = (aB.z - 0.5) * uS;
          vec2 q = uC.xz + uD * (al + aE * ${V3_DUST.len.toFixed(1)}) + vec2(-uD.y, uD.x) * ac; float y = uC.y + aB.y * aB.y * ${V3_DUST.h.toFixed(1)} + sin(uT * 2.0 + aB.x * 40.0) * 4.0;
          vE = aE; vF = 1.0 - abs(al / uS) * 2.0; gl_Position = projectionMatrix * viewMatrix * vec4(q.x, y, q.y, 1.0); }`,
      fragmentShader: `uniform float uA; varying float vE, vF; void main() { gl_FragColor = vec4(0.78, 0.66, 0.47, uA * vF * (0.25 + 0.75 * vE)); }` });
    V3.dust = new THREE.LineSegments(g, m); V3.dust.frustumCulled = false; V3.dust.renderOrder = 5; V3.scene.add(V3.dust);
  }
  if (V3.dust) {
    V3.dust.visible = dw > 0.01 && !reduceMotion;
    if (V3.dust.visible) { const U = V3.dust.material.uniforms, B = V3.box, wl = Math.hypot(WIND.x, WIND.y) || 1; U.uC.value.set(cam.x, v3E(cam.x, cam.y), cam.y); U.uS.value = B ? Math.min(1600, Math.max(B.w, B.h) * 0.9) : 1000; U.uT.value = performance.now() / 1000; U.uA.value = V3_DUST.a * dw; U.uD.value.set(WIND.x / wl, WIND.y / wl); }
  }
  if (dw > 0.001) V3.sun.intensity *= 1 - V3_DUST.sun * dw;
}
// (the dust's clouds: big soft puffs over the ground on screen, a grid of them carried along the wind — each fading in
// and out as it goes through its cell, so none pops)
function v3DustClouds(F) {
  const w = s.extras ? Sim.weatherAt(s).dust : 0, B = V3.box; if (w < 0.02 || !B || reduceMotion || gfxLow) return;
  const st = Math.max(120, Math.max(B.w, B.h) / 14), t = performance.now() / 1000, wl = Math.hypot(WIND.x, WIND.y) || 1, dx = WIND.x / wl, dy = WIND.y / wl;
  const i0 = Math.floor(B.x / st) - 1, j0 = Math.floor(B.y / st) - 1;
  for (let i = i0; i <= i0 + Math.ceil(B.w / st) + 2; i++) for (let j = j0; j <= j0 + Math.ceil(B.h / st) + 2; j++) {
    const r = v3Rnd(i * 5.7, j * 1.3), ph = (t * V3_DUST.speed * 0.45 / st + r) % 1, go = (ph - 0.5) * st * 2;
    const x = (i + 0.5) * st + dx * go + (v3Rnd(j, i) - 0.5) * st * 0.6, y = (j + 0.5) * st + dy * go + (r - 0.5) * st * 0.6;
    if (x < -100 || y < -100 || x > s.W + 100 || y > s.H + 100) continue;
    v3Dot(F.smoke, x, v3Gnd(Math.max(0, Math.min(s.W, x)), Math.max(0, Math.min(s.H, y))) + 18 + r * 40, y, st * (1.4 + r), 0.72, 0.58, 0.38, V3_DUST.cloud * w * Math.sin(ph * Math.PI) * (1 - (V3.nightK || 0) * 0.5), r * 6 + t * 0.2, (i + j) & 3);
  }
}
// (the bolt: a jagged channel from the cloud to the strike, and two or three branches off it — made once per strike)
function v3BoltPath(b) {
  let sd = Math.floor(b.seed * 9973) % 2147483647 || 7; const R = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const g = v3Gnd(Math.max(0, Math.min(s.W, b.x)), Math.max(0, Math.min(s.H, b.y))), top = g + V3_BOLT.h, N = 24, main = [];
  let x = b.x + (R() - 0.5) * 300, y = b.y + (R() - 0.5) * 300;
  for (let i = 0; i <= N; i++) { const k = i / N; main.push([x + (b.x - x) * k * k, top - (top - g) * k, y + (b.y - y) * k * k]); x += (R() - 0.5) * 90; y += (R() - 0.5) * 90; }
  main[N] = [b.x, g, b.y];
  const out = [[main, 1]];
  for (let n = 0; n < 3; n++) {
    const at = 3 + Math.floor(R() * (N - 10)), p = main[at], br = [p], a = R() * 6.28, L = 4 + Math.floor(R() * 6);
    let [px, ph, py] = p; for (let i = 0; i < L; i++) { px += Math.cos(a) * 30 + (R() - 0.5) * 50; py += Math.sin(a) * 30 + (R() - 0.5) * 50; ph -= (top - g) / N * (0.7 + R() * 0.6); br.push([px, ph, py]); }
    out.push([br, 0.45]);
  }
  return out;
}
function v3BoltFx(F) {
  const f = typeof boltFlash === 'function' ? boltFlash() : 0; if (V3.boltLight) V3.boltLight.intensity = 0;
  if (!f || !bolt) return;
  const P = bolt.path || (bolt.path = v3BoltPath(bolt));
  for (const [pts, w] of P) for (let i = 1; i < pts.length; i++) {
    const [ax, ah, ay] = pts[i - 1], [bx, bh, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bh - ah, by - ay) / V3_BOLT.step));
    for (let k = 0; k < n; k++) { const q = k / n; v3Dot(F.glow, ax + (bx - ax) * q, ah + (bh - ah) * q, ay + (by - ay) * q, V3_BOLT.glow * w, 0.82, 0.88, 1, Math.min(1, f * 1.4) * w); }
  }
  const g = P[0][0][P[0][0].length - 1];
  v3Dot(F.glow, g[0], g[1] + 10, g[2], 160 * f, 0.8, 0.86, 1, 0.6 * f); // (where it struck)
  if (V3.boltLight) { V3.boltLight.position.set(g[0], g[1] + 320, g[2]); V3.boltLight.intensity = V3_BOLT.light * f * (0.5 + 0.5 * bolt.near); }
}
// (the morning fog's banks: billboards over the low ground on screen, one every so far, drifting — v3Fx)
function v3FogBanks(F) {
  const w = s.extras ? Sim.weatherAt(s).fog : 0, B = V3.box; if (w < 0.02 || !B || !s.elev) return;
  const st = Math.max(90, Math.max(B.w, B.h) / 30), t = performance.now() / 1000, i0 = Math.floor(B.x / st), j0 = Math.floor(B.y / st);
  for (let i = i0; i <= i0 + Math.ceil(B.w / st); i++) for (let j = j0; j <= j0 + Math.ceil(B.h / st); j++) {
    const r = v3Rnd(i * 7.3, j), x = (i + r) * st + Math.sin(t * 0.05 + r * 6) * 30, y = (j + v3Rnd(j * 3.1, i)) * st + Math.cos(t * 0.04 + r * 5) * 20;
    if (x < 0 || y < 0 || x > s.W || y > s.H || Sim.levelAt(s, { x, y }) >= 1) continue;
    v3Dot(F.smoke, x, v3Gnd(x, y) + 12 + r * 14, y, st * (1.6 + r * 0.9), 0.9, 0.92, 0.95, 0.3 * w * (1 - (V3.nightK || 0) * 0.6), r * 6, (i + j) & 3);
  }
}
// ---- following one unit (C, 3D): the camera comes down low behind it and goes with it, turning as it turns (a few
// seconds after the player turns the camera, it swings back behind); C again, Esc, moving the camera, or the unit
// gone (the next of its squad, if any) — back as it was ----
const V3_FOLLOW = { pitch: 0.5, zoom: 0.95, k: 2.2, turn: 1.4, ahead: 35, free: 3500 };
function v3Follow(id) {
  if (!V3.on) return false;
  if (V3.follow) { v3Unfollow(); return false; }
  const u = s.units.find(k => k.squad === id); if (!u) return false;
  V3.follow = { u: u.id, sq: id, back: { pitch: V3.pitch, z: cam.z }, t: performance.now(), t0: performance.now() }; return true;
}
function v3Unfollow(stay) {
  const f = V3.follow; if (!f) return; V3.follow = null;
  if (!stay) { V3.pitch = f.back.pitch; cam.z = f.back.z; applyView(); }
}
function v3FollowTick() {
  const f = V3.follow; if (!f) return;
  const now = performance.now(), dt = Math.min(0.1, (now - (f.t || now)) / 1000); f.t = now;
  let u = s.units.find(k => k.id === f.u);
  if (!u) { u = s.units.find(k => k.squad === f.sq); if (u) f.u = u.id; else { v3Unfollow(true); return; } }
  const k = 1 - Math.exp(-dt * V3_FOLLOW.k), hd = u.hd || 0;
  cam.x += (u.x + Math.cos(hd) * V3_FOLLOW.ahead - cam.x) * k; cam.y += (u.y + Math.sin(hd) * V3_FOLLOW.ahead - cam.y) * k;
  if (now - f.t0 < 2500) { cam.z += (zoomMax() * V3_FOLLOW.zoom - cam.z) * k; V3.pitch += (V3_FOLLOW.pitch - V3.pitch) * k; } // (coming down to it; then the wheel and the tilt are the player's)
  // (behind it: the camera's way from the target is −the heading)
  if (now > (f.free || 0)) { const want = Math.atan2(-Math.cos(hd), -Math.sin(hd)), d = Math.atan2(Math.sin(want - V3.yaw), Math.cos(want - V3.yaw)); V3.yaw += d * (1 - Math.exp(-dt * V3_FOLLOW.turn)); }
  applyView();
}
// every frame, instead of the flat map
function v3Draw() {
  V3U.v3Time.value = performance.now() / 1000;
  if (V3.of !== decor) { v3Ground(); for (const P of V3.pics.values()) { V3.scene.remove(P.mesh); P.mesh.dispose(); } V3.pics.clear(); }
  v3FollowTick(); // (following one unit: C)
  const r = V3.r, st = stage.getBoundingClientRect(), w = Math.round(st.width), h = Math.round(st.height);
  if (V3.w !== w || V3.h !== h) { V3.w = w; V3.h = h; r.setSize(w, h, false); V3.cam.aspect = w / h; V3.cam.updateProjectionMatrix(); }
  // (the camera: over cam, as far off as shows the flat map's width at its middle)
  const vw = fit.w / view.css, d = Math.max(60, vw / (2 * Math.tan(V3_FOV * Math.PI / 360) * V3.cam.aspect));
  const ty = v3E(cam.x, cam.y), P = V3.pitch, Y = V3.yaw;
  V3.cam.position.set(cam.x + d * Math.cos(P) * Math.sin(Y), ty + d * Math.sin(P), cam.y + d * Math.cos(P) * Math.cos(Y)); V3.cam.lookAt(cam.x, ty, cam.y);
  V3.cam.near = Math.max(2, d * 0.2); V3.cam.far = d * 6 + 4000 + Math.max(s.W, s.H) * (V3.pitch < 0.6 ? 2.6 : 0); // (low: out to the far hills) V3.cam.updateProjectionMatrix(); V3.cam.updateMatrixWorld(); // (the near plane well out: the depth exact enough for the AO, post3d.js)
  v3Sky(d); v3SunBox(ty, vw);
  sceneryTick(); groundTick(); // (as the flat map's frame: what's cleared, run over, cut)
  for (const P of V3.pics.values()) P.n = 0;
  V3.lamps = [];
  const rings = v3Units(); v3Nodes(rings); v3Rings(rings); v3Fx(); v3Scenery(); v3Falling(); v3Craters(); v3Water(); v3Trenches(); v3Tufts(vw); v3Shade(); v3Deco();
  for (const P of V3.pics.values()) { P.mesh.count = P.n; P.mesh.instanceMatrix.needsUpdate = true; P.mesh.instanceColor.needsUpdate = true; }
  v3Weather(); // (rain drops, the wet ground)
  v3Reflect(); // (what's on the shore, in the water)
  if (v3PostWant()) v3PostRender(V3.scene, V3.cam, d); else r.render(V3.scene, V3.cam); // (post3d.js: AO, glow, grade)
  v3Info();
}
// what the flat map writes over buildings and our units — construction, health, the next unit; health dots, fuel /
// water / ammunition lights, ⟲, Trophy, reload, riders, the Star of David — by its own functions (drawStructInfo,
// unitInfo, healthDot, fuelGauge) on the 2D canvas over the 3D one, placed for each so that its spot lands on the
// screen where its model stands (and scaled as the ground is there)
// a unit's bar on screen (px at dpr d): dark back, the health in green / yellow / orange / red, the enemy's edged red;
// a rank over it as gold chevrons
const V3_BAR = { h: 4, edge: 1 }, V3_BAR_FOOT = new Set(['inf', 'at', 'aa', 'med', 'commando']);
function v3Bar(c, x, y, d, k, side, rank, w) {
  c.setTransform(d, 0, 0, d, 0, 0); x /= d; y /= d;
  const h = V3_BAR.h, L = x - w / 2;
  c.fillStyle = 'rgba(10,12,16,.72)'; c.fillRect(L - 1, y - 1, w + 2, h + 2);
  c.fillStyle = k < HURT_LOW ? '#e53935' : k < HURT_MID ? '#ff8f1f' : k < 0.97 ? '#e8d23b' : '#5fd35a'; c.fillRect(L, y, w * Math.max(0, Math.min(1, k)), h);
  c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 4; i++) c.fillRect(L + w * i / 4, y, 1, h); // (ticks: each a quarter)
  if (side === 'red') { c.strokeStyle = '#ff5a4e'; c.lineWidth = 1; c.strokeRect(L - 1.5, y - 1.5, w + 3, h + 3); }
  for (let i = 0; i < rank; i++) { const cy = y - 4 - i * 4; c.strokeStyle = '#ffcf3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 5, cy); c.lineTo(x, cy - 3); c.lineTo(x + 5, cy); c.stroke(); }
}
function v3Info() {
  const c = ctx, dpr = fit ? fit.dpr : 1, P = v3Tmp.ip || (v3Tmp.ip = new THREE.Vector3()), W = V3.w, H = V3.h;
  const scr = (x, y, h) => { P.set(x, v3E(x, y) + h, y).project(V3.cam); return [(P.x + 1) / 2 * W, (1 - P.y) / 2 * H, P.z]; };
  const put = (x, y, h) => {
    const a = scr(x, y, h); if (a[2] > 1 || a[0] < -60 || a[0] > W + 60 || a[1] < -60 || a[1] > H + 60) return false;
    // (the scale: of the ground along the screen's up — what the flat map's offsets up and down are drawn along; across
    // it, the ground shows bigger — at a low tilt the marks floated far over what they're for)
    const b = scr(x + Math.sin(V3.yaw) * 10, y + Math.cos(V3.yaw) * 10, h), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / 10; V3.infoK = k; // (label: its size on screen from it)
    c.setTransform(k * dpr, 0, 0, k * dpr, (a[0] - x * k) * dpr, (a[1] - y * k) * dpr); return true;
  };
  c.save(); c.textAlign = 'center';
  for (const n of s.nodes) if (n.kind !== 'drone' && n.hp > 0 && nodeShown(n) && put(n.x, n.y, 0)) drawStructInfo(c, n);
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (u.side !== 'blue' || (s.fog && !(whole.has(u.squad) && shownAt(u)))) continue;
    const T = Sim.TYPES[u.type]; if (!put(u.x, u.y, T.air ? V3_AIR - SIZE[u.type] * 0.6 : SIZE[u.type] * 0.35)) continue; // (an aircraft's marks: nearer its body — they float high over a big one)
    unitInfo(c, u); fuelGauge(c, u);
    if (sel !== 'all' && sel != null && isSel(u.squad) && hurtUnit(u)) starOfDavid(c, u.x, u.y - SIZE[u.type] * (T.air ? 1.2 : 1.05) - 9 / view.css);
  }
  // (a health bar over each unit that's hurt or under the mouse — ours, and the enemy's in sight; on the mouse's, the
  // commander's rank too: modern RTS style, nothing over the healthy ones the rest of the time)
  const hq = typeof hoverNode === 'string' && hoverNode[0] === 'q' ? hoverNode.slice(1) : null;
  for (const u of s.units) {
    const T = Sim.TYPES[u.type], k = u.hp / T.hp, on = u.squad === hq; if (k >= 0.97 && !on) continue;
    if (u.side === 'blue' ? s.fog && !(whole.has(u.squad) && shownAt(u)) : s.fog && !s.vis.blue.has(u.id)) continue;
    const h = T.air ? V3_AIR - SIZE[u.type] * 0.6 : SIZE[u.type] * 0.35; if (!put(u.x, u.y, h)) continue;
    const a = scr(u.x, u.y, h); v3Bar(c, a[0] * dpr, (a[1] - SIZE[u.type] * (T.air ? 0.9 : 0.75) * V3.infoK - 11) * dpr, dpr, k, u.side, on ? Sim.rankOf(s.squads.find(q => q.id === u.squad) || {}) : 0, T.air || u.type === 'tank' ? 30 : V3_BAR_FOOT.has(u.type) ? 16 : 22);
  }
  c.restore(); c.setTransform(1, 0, 0, 1, 0, 0); V3.infoK = 0;
}
