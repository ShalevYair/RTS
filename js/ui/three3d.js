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
const V3_LV = 18, V3_PITCH = 50 * Math.PI / 180, V3_FOV = 40, V3_TEX = 4096, V3_AIR = 70, V3_FOOT = 1.6;
function v3Toggle() {
  if (V3.on) { v3Show(false); return; }
  if (window.THREE) { v3Show(true); return; }
  const sc = document.createElement('script'); sc.src = 'js/lib/three.min.js';
  sc.onload = () => v3Show(true);
  sc.onerror = () => toast('3D ✖', innerWidth / 2, 80, 3000);
  document.head.appendChild(sc);
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
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#5a6048', 0.5 * Math.PI));
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
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  m.castShadow = m.receiveShadow = true;
  V3.scene.add(m); V3.ground = m; V3.of = decor;
  // (round the map: plain grass to the horizon)
  if (!V3.skirt) {
    V3.skirt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#5d6e45' }));
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
  bg.x0 = 0; bg.y0 = 0; bg.w = s.W; bg.h = s.H; bg.quick = false; R.shade = { dark: none, lite: none }; R.contours = { cells: new Map(), n: 0 };
  try {
    g.fillStyle = colors.ground; g.fillRect(0, 0, w, h); g.setTransform(k, 0, 0, k, 0, 0);
    const grass = tilePat(g, 'grass1');
    if (grass) { g.fillStyle = grass; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = GROUND_TINT; g.fillStyle = colors.ground; g.fillRect(0, 0, s.W, s.H); g.globalAlpha = 1; }
    drawTerrain(g, s.W, s.H, s.W / 2);
  } finally { [bg.x0, bg.y0, bg.w, bg.h, bg.quick] = keep; R.shade = shade0; R.contours = cont0; }
  return out;
}
// ---- the units ----
// a kind's picture in a side's colour, as a flat piece lying on the ground: { tex, w, h (world units: along its
// heading, across), ox, oy (where its middle sits from the unit — the tank's turret: its pivot) }. The flat map's own
// picture (spritePic; the tank: hull and turret apart), or, without one, its glyph drawn once.
function v3Pic(type, side) {
  const key = type + ':' + side; let P = V3.pics.get(key); if (P) return P;
  const base = type === 'turret' ? 'tank' : type, T0 = Sim.TYPES[base] || {}, col = colors[side] || '#9a9a9a', k = (SIZE[base] || 8) * (CAR.has(base) || T0.air ? 1 : V3_FOOT);
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
    glyph(img.getContext('2d'), type, N / 2, N / 2, G, col, colors.outline, 0, 0); w = h = N / G * k;
  }
  const tex = new THREE.CanvasTexture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // (a flat piece facing up; its picture's right = the unit's front, its top = the world's north)
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45 }), 64);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  V3.scene.add(mesh);
  P = { mesh, w, h, ox, oy, n: 0 }; V3.pics.set(key, P); return P;
}
// one more of a picture: grown (a new, bigger mesh) when full
function v3Put(P, m) {
  if (P.n >= P.mesh.instanceMatrix.count) {
    const old = P.mesh, big = new THREE.InstancedMesh(old.geometry, old.material, old.instanceMatrix.count * 2);
    big.castShadow = big.receiveShadow = true; big.instanceMatrix.setUsage(THREE.DynamicDrawUsage); big.frustumCulled = false;
    for (let i = 0; i < P.n; i++) { old.getMatrixAt(i, v3Tmp.g); big.setMatrixAt(i, v3Tmp.g); }
    V3.scene.remove(old); old.dispose(); V3.scene.add(big); P.mesh = big;
  }
  P.mesh.setMatrixAt(P.n++, m);
}
let v3Tmp = {};
// where a ground unit lies: on the slope there (the ground's normal), turned to its heading
function v3Lay(x, y, hd, lift, w, h, ox, oy, out) {
  if (!v3Tmp.n) Object.assign(v3Tmp, { n: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), yaw: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), off: new THREE.Vector3(), g: new THREE.Matrix4() });
  const e = 4, hx = (Sim.elevAt(s, { x: x + e, y }) - Sim.elevAt(s, { x: x - e, y })) * V3_LV / (2 * e), hz = (Sim.elevAt(s, { x, y: y + e }) - Sim.elevAt(s, { x, y: y - e })) * V3_LV / (2 * e);
  const t = v3Tmp; t.n.set(-hx, 1, -hz).normalize();
  t.yaw.setFromAxisAngle(t.up, -hd); t.q.setFromUnitVectors(t.up, lift ? t.up : t.n).multiply(t.yaw);
  t.off.set(ox, 0, oy).applyQuaternion(t.q);
  t.p.set(x + t.off.x, Sim.elevAt(s, { x, y }) * V3_LV + 0.6 + lift + t.off.y, y + t.off.z);
  return out.compose(t.p, t.q, t.sc.set(w, 1, h));
}
function v3Units() {
  for (const P of V3.pics.values()) P.n = 0;
  const m = v3Tmp.m || (v3Tmp.m = new THREE.Matrix4()), rings = [];
  // (what the player sees, as the flat map: ours where the picture is exact, theirs where seen)
  const whole = s.fog ? new Set(s.squads.filter(q => q.side === 'blue' && sqShown(q)).map(q => q.id)) : null;
  for (const u of s.units) {
    if (s.fog && !((u.side === 'blue' ? whole.has(u.squad) : s.vis.blue.has(u.id)) && shownAt(u))) continue;
    const T = Sim.TYPES[u.type], lift = T.air ? V3_AIR : 0, hd = u.hd || 0;
    const P = v3Pic(u.type, u.side); v3Put(P, v3Lay(u.x, u.y, hd, lift, P.w, P.h, 0, 0, m));
    if (u.type === 'tank' && hasSprite('tank')) { // (the turret, turned to where it fires)
      const R = v3Pic('turret', u.side), H = SPRITES.tank_hull, k = SIZE.tank, sc = SPRITE_LEN.tank * k / H.w;
      const aim = s.t - u.lastFire < 3 ? u.aim : hd, px = (H.px - H.w / 2) * sc, py = (H.py - H.h / 2) * sc;
      const cx = u.x + Math.cos(hd) * px - Math.sin(hd) * py, cy = u.y + Math.sin(hd) * px + Math.cos(hd) * py;
      v3Put(R, v3Lay(cx + Math.cos(aim) * R.ox - Math.sin(aim) * R.oy, cy + Math.sin(aim) * R.ox + Math.cos(aim) * R.oy, aim, 0.4, R.w, R.h, 0, 0, m));
    }
    if (u.side === 'blue' && isSel(u.squad) && u.type !== 'dozer') rings.push(u);
  }
  for (const P of V3.pics.values()) { P.mesh.count = P.n; P.mesh.instanceMatrix.needsUpdate = true; }
  // (picked: a thin light ring round each, on the ground)
  if (!V3.rings) {
    const g = new THREE.RingGeometry(0.86, 1, 40); g.rotateX(-Math.PI / 2);
    V3.rings = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#e8fff0', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }), 4000);
    V3.rings.frustumCulled = false; V3.rings.renderOrder = 10; // (over the units' pictures: on the ground they cut through it) V3.scene.add(V3.rings);
  }
  let n = 0; const o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D());
  for (const u of rings) {
    if (n >= 4000) break;
    const r = (SIZE[u.type] || 8) * (CAR.has(u.type) || Sim.TYPES[u.type].air ? 0.75 : V3_FOOT * 0.9);
    o.position.set(u.x, Sim.elevAt(s, u) * V3_LV + 1 + (Sim.TYPES[u.type].air ? V3_AIR : 0), u.y); o.scale.set(r, 1, r); o.updateMatrix(); V3.rings.setMatrixAt(n++, o.matrix);
  }
  V3.rings.count = n; V3.rings.instanceMatrix.needsUpdate = true;
}
// ---- the buildings: boxes in the side's colour (instanced: one draw for them all) ----
function v3Nodes() {
  if (!V3.nodes) { V3.nodes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 600); V3.nodes.castShadow = V3.nodes.receiveShadow = true; V3.nodes.frustumCulled = false; V3.scene.add(V3.nodes); }
  const o = v3Tmp.o || (v3Tmp.o = new THREE.Object3D()), col = v3Tmp.c || (v3Tmp.c = new THREE.Color()), C = { blue: colors.blue, red: colors.red, none: '#9a9a9a' };
  let n = 0;
  const box = (x, y, r, side, rise) => {
    o.position.set(x, Sim.elevAt(s, { x, y }) * V3_LV, y); o.rotation.set(0, 0, 0); o.scale.set(r * 1.7, r * 0.7 * rise, r * 1.7);
    o.position.y += o.scale.y / 2; o.updateMatrix(); V3.nodes.setMatrixAt(n, o.matrix); V3.nodes.setColorAt(n, col.set(C[side] || C.none)); n++;
  };
  for (const nd of s.nodes) {
    if (n >= 590 || nd.kind === 'drone' || nd.hp <= 0) continue;
    if (nd.side !== 'blue' && s.fog && !(s.memNodes.blue[nd.id])) continue;
    const r = (Sim.STRUCTS[nd.kind] && Sim.STRUCTS[nd.kind].r) || 24, rise = nd.need ? Math.max(0.15, nd.work / nd.need) : 1;
    box(nd.x, nd.y, r, nd.side, rise);
  }
  if (s.posts) for (const p of s.posts) if (n < 600) box(p.x, p.y, Sim.POSTS[p.kind].r, p.side || 'none', 1);
  V3.nodes.count = n; V3.nodes.instanceMatrix.needsUpdate = true; if (V3.nodes.instanceColor) V3.nodes.instanceColor.needsUpdate = true;
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
  v3Units(); v3Nodes();
  r.render(V3.scene, V3.cam);
}
