// UI: the 3D view's last touch — the scene drawn into a picture first (v3PostRender), then put on the screen with:
// shade where things meet (ambient occlusion from the depth: under the tanks, round the buildings, in the folds of
// the hills — what sets a model on the ground and not over it), a glow round what's brightest (fire, explosions, the
// lights at night) and a grade (a little contrast and colour, warm in the light, cool in the shade). Not with low
// graphics (gfxLow), and F10 turns it off and on (irts-post). Three renders into the picture exactly as to the screen
// (marked as XR's: ACES and sRGB, so the look without it is the same); MSAA as on the screen.
const V3P = { T: null, ao: null, b: [], mats: {}, quad: null, cam: null, w: 0, h: 0, fail: false };
// AO: r — its reach, of the camera's distance (min..max world units); k — how dark; n — samples. BLOOM: th — from how
// bright (0..1, the picture's light), k — how strong. GRADE: con — contrast, sat — saturation, warm — highlights warmer
// and shadows cooler.
const V3_AO = { r: 0.06, min: 8, max: 110, k: 2.6, n: 14 }, V3_BLOOM = { th: 0.86, k: 0.5 }, V3_GRADE = { con: 0.12, sat: 1.06, warm: 0.035 };
function v3PostWant() {
  if (gfxLow || V3P.fail) return false;
  try { return localStorage.getItem('irts-post') !== '0'; } catch (e) { return true; }
}
function v3PostToggle() {
  const on = !v3PostWant(); try { localStorage.setItem('irts-post', on ? '1' : '0'); } catch (e) { /* ignore */ }
  toast(on ? 'FX ✓' : 'FX ✖', innerWidth / 2, 80, 1200);
}
const V3_FULL = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function v3PostMat(frag, uni) {
  return new THREE.ShaderMaterial({ vertexShader: V3_FULL, fragmentShader: frag, uniforms: uni, depthTest: false, depthWrite: false });
}
function v3PostInit() {
  const geo = new THREE.BufferGeometry(); // (one triangle over the whole screen)
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  V3P.quad = new THREE.Mesh(geo); V3P.quad.frustumCulled = false; V3P.scene = new THREE.Scene(); V3P.scene.add(V3P.quad); V3P.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // (ambient occlusion — McGuire's scalable AO on the depth: points round each, on a spiral turned at random each pixel)
  V3P.mats.ao = v3PostMat(`
    uniform sampler2D tDepth; uniform vec2 tanH; uniform float cn, cf, R, ppu, k; uniform vec2 px;
    varying vec2 vUv;
    float vz(vec2 uv) { float d = texture2D(tDepth, uv).x; return cn * cf / ((cf - cn) * d - cf); }
    vec3 vp(vec2 uv) { float z = vz(uv); return vec3((uv * 2.0 - 1.0) * tanH * -z, z); }
    void main() {
      float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 p = vp(vUv);
      vec3 a = vp(vUv + vec2(px.x, 0.0)) - p, b = vp(vUv - vec2(px.x, 0.0)) - p, c = vp(vUv + vec2(0.0, px.y)) - p, e = vp(vUv - vec2(0.0, px.y)) - p;
      vec3 dx = abs(a.z) < abs(b.z) ? a : -b, dy = abs(c.z) < abs(e.z) ? c : -e;
      vec3 n = normalize(cross(dx, dy)); if (dot(n, -p) < 0.0) n = -n;
      float rs = R * ppu / -p.z; // (the reach on screen, in uv)
      float rnd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
      float sum = 0.0, R2 = R * R;
      for (int i = 0; i < ${V3_AO.n}; i++) {
        float t = (float(i) + 0.5) / ${V3_AO.n}.0, ang = rnd + float(i) * 2.39996;
        vec2 o = vec2(cos(ang), sin(ang)) * t * rs; o.x *= px.y / px.x;
        vec3 v = vp(vUv + o) - p; float vv = dot(v, v), vn = dot(v, n);
        float f = max(R2 - vv, 0.0); sum += f * f * f * max((vn - 0.015 * R) / (0.01 * R2 + vv), 0.0);
      }
      float ao = max(0.0, 1.0 - sum * k * 5.0 / (R2 * R2 * R2 * ${V3_AO.n}.0));
      gl_FragColor = vec4(vec3(ao), 1.0);
    }`, { tDepth: { value: null }, tanH: { value: new THREE.Vector2() }, cn: { value: 1 }, cf: { value: 2 }, R: { value: 10 }, ppu: { value: 1 }, k: { value: V3_AO.k }, px: { value: new THREE.Vector2() } });
  // (the glow: what's bright, a quarter and an eighth of the size, blurred each way)
  V3P.mats.hi = v3PostMat(`
    uniform sampler2D tIn; uniform vec2 px; uniform float th; varying vec2 vUv;
    void main() {
      vec3 c = (texture2D(tIn, vUv + px * vec2(-0.5, -0.5)).rgb + texture2D(tIn, vUv + px * vec2(0.5, -0.5)).rgb + texture2D(tIn, vUv + px * vec2(-0.5, 0.5)).rgb + texture2D(tIn, vUv + px * vec2(0.5, 0.5)).rgb) * 0.25;
      c = min(c, vec3(2.0)); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + 0.2, l), 1.0);
    }`, { tIn: { value: null }, px: { value: new THREE.Vector2() }, th: { value: V3_BLOOM.th } });
  V3P.mats.blur = v3PostMat(`
    uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tIn, vUv).rgb * 0.227027;
      c += (texture2D(tIn, vUv + dir * 1.3846154).rgb + texture2D(tIn, vUv - dir * 1.3846154).rgb) * 0.3162162;
      c += (texture2D(tIn, vUv + dir * 3.2307692).rgb + texture2D(tIn, vUv - dir * 3.2307692).rgb) * 0.0702703;
      gl_FragColor = vec4(c, 1.0);
    }`, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
  // (all of it together on the screen)
  V3P.mats.out = v3PostMat(`
    uniform sampler2D tCol; uniform sampler2D tAo; uniform sampler2D tB1; uniform sampler2D tB2; uniform vec2 apx; uniform float bk, con, sat, warm, aoOn, dbg;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tCol, vUv).rgb;
      if (aoOn > 0.0) {
        float ao = (texture2D(tAo, vUv + apx * vec2(-1.0, -1.0)).r + texture2D(tAo, vUv + apx * vec2(1.0, -1.0)).r + texture2D(tAo, vUv + apx * vec2(-1.0, 1.0)).r + texture2D(tAo, vUv + apx * vec2(1.0, 1.0)).r) * 0.25;
        c *= mix(1.0, ao, 0.9);
      }
      c = c / (1.0 + max(c - 1.0, 0.0)); // (over-bright — fire added on fire — rolled off toward white, not past it: the grade below breaks above 1)
      vec3 g = texture2D(tB1, vUv).rgb + texture2D(tB2, vUv).rgb * 1.3; c = min(c + g * bk * (1.0 - c * 0.5), vec3(1.0));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = mix(c, c * c * (3.0 - 2.0 * c), con); // (an S-curve)
      c += vec3(warm, warm * 0.3, -warm) * (l - 0.45); // (warm light, cool shade)
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; // (no banding)
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      if (dbg > 0.5) gl_FragColor = dbg > 1.5 ? vec4(texture2D(tB1, vUv).rgb + texture2D(tB2, vUv).rgb, 1.0) : vec4(texture2D(tAo, vUv).rrr, 1.0); // (V3P.dbg: 1 the AO, 2 the glow)
    }`, { tCol: { value: null }, tAo: { value: null }, tB1: { value: null }, tB2: { value: null }, apx: { value: new THREE.Vector2() }, bk: { value: V3_BLOOM.k }, con: { value: V3_GRADE.con }, sat: { value: V3_GRADE.sat }, warm: { value: V3_GRADE.warm }, aoOn: { value: 1 }, dbg: { value: 0 } });
}
function v3PostSize(r, w, h) {
  for (const t of [V3P.T, V3P.ao, ...V3P.b]) if (t) t.dispose();
  const pr = r.getPixelRatio(), W = Math.max(1, Math.round(w * pr)), H = Math.max(1, Math.round(h * pr));
  const T = V3P.T = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: r.capabilities.isWebGL2 ? 4 : 0, colorSpace: THREE.SRGBColorSpace });
  T.depthTexture = new THREE.DepthTexture(W, H); T.depthTexture.type = THREE.UnsignedIntType;
  T.isXRRenderTarget = true; // (so Three draws into it as to the screen: ACES and sRGB — see the top)
  const rt = (k, ty = THREE.UnsignedByteType) => new THREE.WebGLRenderTarget(Math.max(1, Math.round(W / k)), Math.max(1, Math.round(H / k)), { type: ty, depthBuffer: false });
  V3P.ao = rt(2); V3P.b = [rt(2, THREE.HalfFloatType), rt(4, THREE.HalfFloatType), rt(4, THREE.HalfFloatType), rt(8, THREE.HalfFloatType), rt(8, THREE.HalfFloatType)];
  V3P.w = w; V3P.h = h; V3P.pr = pr;
}
function v3PostPass(r, mat, target) { V3P.quad.material = mat; r.setRenderTarget(target); r.render(V3P.scene, V3P.cam); }
// the scene, to the screen through all of the above (d: the camera's distance to what it looks at)
function v3PostRender(scene, cam, d) {
  const r = V3.r;
  try {
    if (!V3P.quad) v3PostInit();
    if (V3P.w !== V3.w || V3P.h !== V3.h || V3P.pr !== r.getPixelRatio()) v3PostSize(r, V3.w, V3.h);
    const T = V3P.T, M = V3P.mats, ao = V3P.ao, [h1, q1, q2, e1, e2] = V3P.b;
    r.setRenderTarget(T); r.render(scene, cam);
    // the AO
    const A = M.ao.uniforms, ty = Math.tan(cam.fov * Math.PI / 360);
    A.tDepth.value = T.depthTexture; A.tanH.value.set(ty * cam.aspect, ty); A.cn.value = cam.near; A.cf.value = cam.far;
    A.R.value = Math.max(V3_AO.min, Math.min(V3_AO.max, d * V3_AO.r)); A.ppu.value = 0.5 / ty; A.px.value.set(1 / ao.width, 1 / ao.height);
    const aoOn = !lite; if (aoOn) v3PostPass(r, M.ao, ao);
    // the glow
    M.hi.uniforms.tIn.value = T.texture; M.hi.uniforms.px.value.set(1 / T.width, 1 / T.height); v3PostPass(r, M.hi, h1);
    const blur = (src, dst, dx, dy) => { M.blur.uniforms.tIn.value = src.texture; M.blur.uniforms.dir.value.set(dx / src.width, dy / src.height); v3PostPass(r, M.blur, dst); };
    blur(h1, q1, 1, 0); blur(q1, q2, 0, 1); blur(q2, e1, 1, 0); blur(e1, e2, 0, 1);
    const O = M.out.uniforms; O.tCol.value = T.texture; O.tAo.value = ao.texture; O.tB1.value = q2.texture; O.tB2.value = e2.texture; O.apx.value.set(1 / ao.width, 1 / ao.height); O.aoOn.value = aoOn ? 1 : 0; O.dbg.value = V3P.dbg || 0;
    v3PostPass(r, M.out, null);
  } catch (e) { V3P.fail = true; r.setRenderTarget(null); console.warn('[irts] post', e); r.render(scene, cam); }
}
