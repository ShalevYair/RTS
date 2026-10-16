// Pictures of buildings that have a 3D model but no picture (art/b_<kind>.png): each model rendered on its own — seen
// from the south at a slant like the drawn ones, in our colour (spritePic recolours the blue), see-through around it —
// for the build menu, the tech tree, the info card and the flat map. Then `python tools/sprites.py`.
// node tools/modelpics.js [kind …]   (none: every building model without a picture in art/; needs the server on 8765)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ART = path.join(__dirname, '..', 'art');
// (the buildings the drawn pictures don't cover: the supply chain's)
const NEED = ['quarry', 'concrete', 'ironmine', 'steelmill', 'bauxmine', 'smelter', 'oilwell', 'refinery', 'chemplant', 'farm', 'kitchen', 'hitech', 'elab', 'waterst', 'lab'];
(async () => {
  const b = await chromium.launch({ headless: false, channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.addInitScript(() => { localStorage.setItem('irts-done', '99'); localStorage.setItem('irts-tour', '99'); localStorage.setItem('irts-fs', '0'); localStorage.setItem('irts-3d', '1'); });
  await p.goto('http://localhost:8765/?' + Date.now()); await p.waitForFunction(() => typeof startGame === 'function'); await p.waitForTimeout(1000);
  const all = await p.evaluate(async () => { startGame(0); if (!V3.on) v3Toggle(); while (!V3.on || typeof MODELS !== 'object') await new Promise(r => setTimeout(r, 100)); return Object.keys(MODELS).filter(k => k.startsWith('b_')).map(k => k.slice(2)); });
  const want = process.argv.slice(2).length ? process.argv.slice(2) : all.filter(k => NEED.includes(k) && !['jpg', 'png'].some(e => fs.existsSync(path.join(ART, `b_${k}.${e}`))));
  console.log('pictures for:', want.join(' '));
  for (const k of want) {
    const url = await p.evaluate(kind => {
      const W = 720, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(W, W); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
      const sc = new THREE.Scene(), g = v3Geo('b_' + kind, 'hull', 'blue');
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }));
      sc.add(m); for (const part of Object.keys(MODELS['b_' + kind].parts)) if (part !== 'hull' && !/^(pose|spin|track)/.test(part) && !/\d$/.test(part.replace(/^fan0$/, 'fan'))) sc.add(new THREE.Mesh(v3Geo('b_' + kind, part, 'blue'), m.material));
      sc.add(new THREE.HemisphereLight(0xdfe8f2, 0x4a4234, 0.55)); const sun = new THREE.DirectionalLight(0xfff4e0, 3.2); sun.position.set(-1.0, 1.6, 0.35); sc.add(sun); const fill = new THREE.DirectionalLight(0xc8d8ff, 0.5); fill.position.set(1, 0.6, 1); sc.add(fill);
      const box = new THREE.Box3().setFromObject(sc), c = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).length() / 2;
      const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, 100), el = 0.62, az = 0.78; // (on the diagonal, ~35° up — the drawn pictures' slant: the roof and two walls)
      cam.position.set(c.x + Math.cos(el) * Math.sin(az) * 10, c.y + Math.sin(el) * 10, c.z + Math.cos(el) * Math.cos(az) * 10); cam.lookAt(c); cam.updateProjectionMatrix();
      r.render(sc, cam); const u = r.domElement.toDataURL('image/png'); r.dispose(); return u;
    }, k);
    fs.writeFileSync(path.join(ART, `b_${k}.png`), Buffer.from(url.split(',')[1], 'base64')); console.log('art/b_' + k + '.png');
  }
  await b.close();
})();
