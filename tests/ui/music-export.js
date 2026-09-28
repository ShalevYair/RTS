// Renders the first 25 s of each music piece to tests/ui/out/music/*.wav, to listen to outside the game
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');
const OUT = path.join(__dirname, 'out', 'music'); fs.mkdirSync(OUT, { recursive: true });
function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2)); return b;
}
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await (await b.newContext()).newPage(); await p.goto(URL); await p.waitForTimeout(300);
  for (let k = 0; k < 5; k++) {
    const r = await p.evaluate(k => Music._debug.render(k, 25), k);
    let peak = 0; for (const v of r.data) peak = Math.max(peak, Math.abs(v));
    const f = path.join(OUT, `${k + 1}-${r.name.replace(/ /g, '-')}.wav`); fs.writeFileSync(f, wav(r.data, r.rate));
    console.log(f, 'peak', (peak / 32767).toFixed(2));
  }
  await b.close();
})();
