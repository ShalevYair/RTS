// Runs simulation test files side by side (as many at once as the machine has cores, less one), and says which
// failed. node tests/run.js [fast|long|all] — fast: the quick, steady checks (`npm test`); long: the balance checks,
// whole bot games, noisy (one change of a unit's step and a 50-minute game goes another way) — `npm run test:long`.
const { spawn } = require('child_process');
const os = require('os'), path = require('path');
// (long: whole games of the computer against itself, minutes each; their thresholds are about balance, not bugs)
const LONG = ['map', 'missiles', 'styles', 'recon', 'ff', 'asks', 'arms', 'armsbench', 'bench'];
const ALL = ['smoke', 'control', 'command', 'recon', 'ff', 'map', 'levels', 'lakes', 'care', 'form', 'supply', 'repair', 'units', 'intent', 'dozer', 'singles', 'lift', 'missiles', 'arty', 'commando', 'posts', 'jam', 'path', 'ground', 'roads', 'fuel', 'styles', 'asks', 'marks', 'march', 'save', 'summon', 'fronts'];
const which = process.argv[2] || 'fast';
const files = which === 'all' ? ALL : which === 'long' ? ALL.filter(f => LONG.includes(f)) : ALL.filter(f => !LONG.includes(f));
const N = Math.max(1, Math.min(files.length, os.cpus().length - 1)), t0 = Date.now();
let next = 0, bad = [], left = files.length;
function one() {
  if (next >= files.length) return;
  const f = files[next++], t = Date.now(), p = spawn(process.execPath, [path.join(__dirname, 'sim', f + '.js')]);
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => {
    const fails = out.split('\n').filter(l => /^FAIL|Error/.test(l));
    if (code || fails.length) bad.push(f);
    console.log(`${code || fails.length ? 'FAIL' : 'ok  '} ${f} (${Math.round((Date.now() - t) / 1000)} s)${fails.length ? '\n     ' + fails.join('\n     ') : ''}`);
    if (--left === 0) { console.log(`${files.length - bad.length}/${files.length} files passed in ${Math.round((Date.now() - t0) / 1000)} s${bad.length ? ' — failed: ' + bad.join(', ') : ''}`); process.exitCode = bad.length ? 1 : 0; }
    else one();
  });
}
for (let i = 0; i < N; i++) one();
