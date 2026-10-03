// UI: fuel (fuel.js) — the barrels and the ammunition crates (a station's / depot's yard behind a low fence, and the
// piles the trucks drop by the front)
// and, under a vehicle of ours that's running low, a small gauge (orange; red under FUEL_LOW; a pulsing ⛽ when empty)
const FUEL_GAUGE = 0.5;
function drawPiles(c) {
  for (const p of s.piles || []) {
    if (p.side !== 'blue' && s.fog) continue; // (the enemy's: only without fog)
    const r = 3.2, cols = 6, n = Math.min(p.n, 24);
    if (p.node) { // (the yard: a fence round where the barrels stand)
      c.globalAlpha = 0.75; c.strokeStyle = '#8a7a5c'; c.lineWidth = 1.2; c.setLineDash([2, 2]);
      c.strokeRect(p.x - cols * r - 3, p.y - 2 * r * 2 - 3, cols * r * 2 + 6, 4 * r * 2 + 6); c.setLineDash([]); c.globalAlpha = 1;
    }
    for (let i = 0; i < n; i++) {
      const x = p.x + ((i % cols) - (cols - 1) / 2) * r * 2, y = p.y + (Math.floor(i / cols) - 1.5) * r * 2;
      if (p.k === 'ammo') { // (a crate: a wooden box with a band)
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - r + 0.8, y - r + 1, r * 2 - 0.4, r * 2 - 0.4);
        c.fillStyle = p.side === 'blue' ? '#7a6238' : '#7a4a38'; c.fillRect(x - r + 0.2, y - r + 0.2, r * 2 - 0.4, r * 2 - 0.4);
        c.strokeStyle = 'rgba(30,20,10,.7)'; c.lineWidth = 0.6; c.strokeRect(x - r + 0.2, y - r + 0.2, r * 2 - 0.4, r * 2 - 0.4);
        c.beginPath(); c.moveTo(x - r + 0.2, y); c.lineTo(x + r - 0.2, y); c.stroke();
        continue;
      }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x + 0.8, y + 1, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.side === 'blue' ? '#3d5a3a' : '#5a3d3a'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#c9a227'; c.lineWidth = 0.7; c.beginPath(); c.arc(x, y, r * 0.6, 0, Math.PI * 2); c.stroke();
    }
    if (p.side === 'blue' && p.n > 0 && view.css > 0.8) label(String(p.n), p.x, p.y + 4 * r + 6, colors.ink);
  }
}
function fuelGauge(c, u) {
  if (u.fuel === undefined || u.fuel >= FUEL_GAUGE) return;
  const k = SIZE[u.type], w = k * 0.9, h = Math.max(1.6, 2.4 / view.css), y = u.y + k * 0.6 + h;
  if (u.fuel <= 0) { c.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 250); label('⛽', u.x, u.y - k - 6, '#e53935'); c.globalAlpha = 1; return; }
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(u.x - w / 2 - 0.5, y - 0.5, w + 1, h + 1);
  c.fillStyle = u.fuel < Sim.FUEL_LOW ? '#e53935' : '#ff8f1f'; c.fillRect(u.x - w / 2, y, w * u.fuel, h);
}
