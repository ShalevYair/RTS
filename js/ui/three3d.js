// UI: the 3D view — an experiment, F9 turns it on and off. The same game, drawn by Three.js (js/lib/three.min.js,
// loaded the first time it's asked for): the ground from the height grid (s.elev) as real hills, painted with the
// very picture the flat map paints (drawTerrain — the textures, lakes, roads, woods), lit by a sun from the
// north-west that throws the hills' shadows; the camera over the same cam as the flat map (centre and zoom), looking
// down at V3_PITCH. The units and buildings, for now, as plain shapes in the side's colour. Look only: a left click
// does nothing here yet (the flat map's orders don't know where a click lands on a hill); the wheel zooms, a right or
// middle drag pans, the arrows and the minimap move the camera.
const V3 = { on: false, cv: null, r: null, scene: null, cam: null, sun: null, ground: null, of: null, units: null, nodes: null };
// V3_LV: how high a contour line stands (world units — the shading's SHADE_Z, a little taller); V3_PITCH: the camera's
// look down (radians from level); V3_FOV: its upright field of view; V3_TEX: the ground picture's longer side, at most
const V3_LV = 18, V3_PITCH = 50 * Math.PI / 180, V3_FOV = 40, V3_TEX = 4096, V3_AIR = 70, V3_MAX = 4000;
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
  const c = document.createElement('canvas'); c.id = 'gl'; c.hidden = true; cv.after(c); V3.cv = c;
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
  // (pointer: the wheel zooms, a right or middle drag pans; a left click — nothing yet)
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('wheel', e => { e.preventDefault(); zoomAt(fit.w / 2, fit.top + fit.h / 2, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  let at = null;
  c.addEventListener('pointerdown', e => { if (e.button === 0) return; at = { x: e.clientX, y: e.clientY }; try { c.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
  c.addEventListener('pointermove', e => { if (!at) return; panBy(e.clientX - at.x, (e.clientY - at.y) / Math.sin(V3_PITCH)); at = { x: e.clientX, y: e.clientY }; });
  c.addEventListener('pointerup', () => { at = null; });
}
// the ground: a mesh over the height grid, a vertex a cell (the huge map: ~260 000), with the flat map's picture on it
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
// the units and buildings: boxes in the side's colour (instanced: one draw for them all)
function v3Shapes() {
  const mk = (n, geo) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.castShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); V3.scene.add(m); return m; };
  if (!V3.units) { V3.units = mk(V3_MAX, new THREE.BoxGeometry(1, 1, 1)); V3.nodes = mk(600, new THREE.BoxGeometry(1, 1, 1)); }
  const o = new THREE.Object3D(), col = new THREE.Color(), hAt = (x, y) => Sim.elevAt(s, { x, y }) * V3_LV;
  const C = { blue: colors.blue, red: colors.red, none: '#9a9a9a' };
  // (what the player sees: ours all, theirs where seen — under fog, as the flat map)
  let n = 0;
  for (const u of s.units) {
    if (n >= V3_MAX) break;
    if (u.side !== 'blue' && s.fog && !s.vis.blue.has(u.id)) continue;
    const T = Sim.TYPES[u.type], foot = !CAR.has(u.type) && !T.air, k = (SIZE[u.type] || 8) * (foot ? 2.2 : 1);
    o.position.set(u.x, hAt(u.x, u.y) + (T.air ? V3_AIR : 0), u.y);
    o.rotation.set(0, -(u.hd || 0), 0);
    if (foot) o.scale.set(k * 0.5, k * 0.9, k * 0.5); else if (T.air) o.scale.set(k * 0.9, k * 0.15, k * 0.8); else o.scale.set(k * 0.85, k * 0.32, k * 0.5);
    o.position.y += o.scale.y / 2; o.updateMatrix(); V3.units.setMatrixAt(n, o.matrix);
    V3.units.setColorAt(n, col.set(C[u.side] || C.none)); n++;
  }
  V3.units.count = n; V3.units.instanceMatrix.needsUpdate = true; if (V3.units.instanceColor) V3.units.instanceColor.needsUpdate = true;
  n = 0;
  const box = (x, y, r, side, rise) => {
    o.position.set(x, hAt(x, y), y); o.rotation.set(0, 0, 0); o.scale.set(r * 1.7, r * 0.7 * rise, r * 1.7);
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
  if (V3.of !== decor) v3Ground();
  const r = V3.r, st = stage.getBoundingClientRect(), w = Math.round(st.width), h = Math.round(st.height);
  if (V3.w !== w || V3.h !== h) { V3.w = w; V3.h = h; r.setSize(w, h, false); V3.cam.aspect = w / h; V3.cam.updateProjectionMatrix(); }
  // (the camera: over cam, as far off as shows the flat map's width at its middle)
  const vw = fit.w / view.css, d = Math.max(60, vw / (2 * Math.tan(V3_FOV * Math.PI / 360) * V3.cam.aspect));
  const ty = Sim.elevAt(s, cam) * V3_LV;
  V3.cam.position.set(cam.x, ty + d * Math.sin(V3_PITCH), cam.y + d * Math.cos(V3_PITCH)); V3.cam.lookAt(cam.x, ty, cam.y);
  V3.cam.far = d * 6 + 4000; V3.cam.updateProjectionMatrix();
  V3.scene.fog.near = d * 1.6; V3.scene.fog.far = d * 5 + 2000;
  // (the sun's shadow box: round what's on screen)
  const sun = V3.sun, half = Math.max(400, vw * 0.9), sc = sun.shadow.camera;
  sun.target.position.set(cam.x, ty, cam.y - vw * 0.15); sun.position.set(cam.x - 1500, ty + 2100, cam.y - vw * 0.15 - 1500);
  if (sc.right !== half) { sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix(); }
  v3Shapes();
  r.render(V3.scene, V3.cam);
}
