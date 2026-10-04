// UI: supplies (fuel.js) — over a unit of ours a small light when it runs low: fuel yellow (a pump), water blue (a
// drop), out of ammunition grey (a shell); empty: pulsing. Under a supply truck of ours, how full it is.
function drawPiles(c) {} // (no piles of barrels any more: the trucks serve on the spot)
function lightPic(kind, col) {
  // (a tiny glyph: a fuel pump, a drop, a shell — drawn once and kept)
  const key = kind + col; lightPic.c = lightPic.c || {}; if (lightPic.c[key]) return lightPic.c[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.2;
  if (kind === 'fuel') { g.fillRect(9, 9, 10, 15); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(11, 11, 6, 4); g.beginPath(); g.moveTo(19, 12); g.lineTo(23, 15); g.lineTo(23, 22); g.stroke(); }
  else if (kind === 'water') { g.beginPath(); g.moveTo(16, 6); g.bezierCurveTo(16, 6, 24, 16, 24, 19); g.arc(16, 19, 8, 0, Math.PI); g.bezierCurveTo(8, 16, 16, 6, 16, 6); g.fill(); }
  else { g.beginPath(); g.moveTo(12, 25); g.lineTo(12, 13); g.quadraticCurveTo(16, 4, 20, 13); g.lineTo(20, 25); g.closePath(); g.fill(); }
  return lightPic.c[key] = cv;
}
function fuelGauge(c, u) {
  const L = Sim.LIGHT_AT, k = SIZE[u.type], lights = [];
  if (u.fuel !== undefined && u.fuel < L) lights.push(['fuel', '#ffd23f', u.fuel <= 0]);
  if (u.water !== undefined && u.water < L) lights.push(['water', '#4fb3ff', u.water <= 0]);
  if (s.logi && Sim.SUPPLY[u.type] && u.sup <= 0) lights.push(['ammo', '#c8c8c8', true]);
  const z = 12 / view.css;
  lights.forEach(([kind, col, empty], i) => {
    c.globalAlpha = empty ? 0.55 + 0.45 * Math.sin(performance.now() / 250) : 0.95;
    c.drawImage(lightPic(kind, col), u.x - (lights.length - 1) * z * 0.6 + i * z * 1.2 - z / 2, u.y - k - z * 1.4, z, z);
  });
  c.globalAlpha = 1;
  // (a supply truck: a small bar of what it carries — its colour; empty and off to fill up: hollow)
  const cap = u.type === 'tanker' ? Sim.TANKER_CAP : Sim.TRUCK_CAP[u.type];
  if (cap && u.load !== undefined) {
    const w = k * 0.9, h = Math.max(1.6, 2.4 / view.css), y = u.y + k * 0.6 + h, col = { tanker: '#ffd23f', fueltruck: '#ffd23f', truck: '#c9a26a', watertruck: '#4fb3ff' }[u.type];
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(u.x - w / 2 - 0.5, y - 0.5, w + 1, h + 1);
    c.fillStyle = col; c.fillRect(u.x - w / 2, y, w * Math.max(0, u.load) / cap, h);
  }
}
