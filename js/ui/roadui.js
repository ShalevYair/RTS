// UI: laying roads (the 🛣️ button, roads.js). Armed, a tap on the map is where the road starts, the next where it
// ends: a bulldozer (the one picked, else the nearest free one) paves it. Shift: another stretch from that end, still
// armed. While laying: a line from the start to the pointer, green where it can go, red where it can't. Roads being
// paved: a dashed line over the part still to do, and a faint one from the bulldozer to where it's working.
function roadArm() {
  if (roadArmed) { roadArmed = false; roadFrom = null; syncButtons(); return; }
  eyeArmed = false; buildArmed = null; fhqArmed = false; hqArmed = false; frontArmed = false; $('buildm').hidden = true;
  syncButtons(); roadArmed = true; roadFrom = null; syncButtons();
}
function placeRoad(x, y, more) {
  if (!roadFrom) { roadFrom = { x, y }; return; }
  const why = Sim.roadCheck(s, 'blue', roadFrom, { x, y });
  if (why) { const p = onScreen(x, y); toast(tr('why')[why] || tr('why').bad, p.x, p.y); return; } // (still armed: pick the end again)
  Sim.planRoad(s, 'blue', roadFrom, { x, y }, pickedDozer());
  pings.push({ x, y, t: performance.now() });
  if (more) roadFrom = { x, y }; else { roadArmed = false; roadFrom = null; }
  syncButtons();
}
$('road').addEventListener('click', roadArm);
function drawRoadPlans(c) {
  const G = s.ground, W = Sim.ROAD_W || 12;
  c.lineCap = 'round';
  for (const r of s.roadJobs || []) {
    if (r.side !== 'blue' || r.done || !G) continue;
    // (the part still to pave: the next square on)
    c.globalAlpha = 0.55; c.strokeStyle = colors.blue; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.b.x, r.b.y); c.stroke(); c.setLineDash([]);
    // (the square being paved: how far, a ring filling)
    c.globalAlpha = 0.8; c.strokeStyle = colors.blue; c.lineWidth = 2.5;
    c.beginPath(); c.arc(r.x, r.y, G.C * 0.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, r.work / r.need)); c.stroke();
    // (its bulldozer on its way: a faint line to it)
    const q = s.squads.find(q => q.side === 'blue' && q.type === 'dozer' && !q.dead && !q.paused && Sim.jobOf(s, q) === r), u = q && s.units.find(u => u.squad === q.id);
    if (u && Math.hypot(u.x - r.x, u.y - r.y) > 40) { c.globalAlpha = 0.4; c.lineWidth = 1.5; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(r.x, r.y); c.stroke(); c.setLineDash([]); }
    c.globalAlpha = 1;
  }
  if (!roadArmed || !mouseAt) return;
  const rc = cv.getBoundingClientRect(), w = { x: (mouseAt.x - rc.left - view.cox) / view.css, y: (mouseAt.y - rc.top - view.coy) / view.css };
  if (!roadFrom) { c.globalAlpha = 0.7; c.fillStyle = 'rgba(60,170,70,.8)'; c.beginPath(); c.arc(w.x, w.y, 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; return; }
  const ok = !Sim.roadCheck(s, 'blue', roadFrom, w);
  c.globalAlpha = 0.75; c.strokeStyle = ok ? 'rgba(60,170,70,.9)' : 'rgba(210,60,50,.9)'; c.lineWidth = Math.max(3, (G ? G.C : 16) * 0.8);
  c.beginPath(); c.moveTo(roadFrom.x, roadFrom.y); c.lineTo(w.x, w.y); c.stroke(); c.globalAlpha = 1;
}
