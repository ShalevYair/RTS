// Sim: the supply chain (DESIGN.md, "שרשרת אספקה"; the full game — s.econ, set by openField). Everything made has a
// source on the map: deposits (s.deposits) of oil, iron ore and lime (cement) — a few near each base (poor), some in
// the middle (rich), in twin pairs like the posts, and one of each by each side's HQ once it's down (homeField). A mine
// built on a deposit (STRUCTS[..].deposit: oil well, iron mine, cement quarry) fills its yard (n.store, DEP_KINDS rate ×
// the deposit's richness a second, up to WELL_KEEP) and sends out haulers (oil tankers, ore trucks, cement mixers): each
// fills up at its mine, drives on its own to the nearest plant of its kind of its side and unloads there (n.inbox); the
// plant turns it into the side's stock (s.stock[side]: fuel, steel, concrete — PLANT_RATE a second). Raw goods move for
// real (a hauler can be shot); the product goes to the side's stock. Who uses it: fuel trucks fill up out of it at their
// station (fuel.js); a building site goes up only while there's concrete (CON_RATE a second of work); a workshop's unit
// comes out only once its steel is there (STEEL_COST). And what stands first (NEEDS, needsOf): a cement quarry before a
// concrete plant, the concrete plant before every other building; an iron mine before a steel mill, the mill before the
// workshops; an oil well before a refinery, the refinery before fuel stations and jeep workshops (rubber), and a fuel
// station before anything that makes what burns fuel.
// More goods (phases 2–5): the refinery makes rubber too (PLANT_ALSO) — wheeled vehicles take it; farms on fields send
// grain to the field kitchen, which makes rations (they replace the water: the rations depot fills its trucks from the
// stock); bauxite from its mines to the aluminium smelter (which burns fuel, `burn`) — aircraft take aluminium; the
// chemical plant turns fuel into explosives (CHEM_RATE) — ammunition trucks fill up with explosives and steel; and the
// electronics lab, a neutral post on the centre line, gives its holder electronics (ELEC_RATE) — missiles, the missile
// defences' trucks and drones take them. What each unit takes: UNIT_COST; each truck's fill: REFILL.
// A side starts with STOCK_START of each product.
const DEP_R = 30, DEP_SNAP = 40, WELL_KEEP = 40;
const HAUL_CAP = 20, HAUL_LOAD = 2, PLANT_RATE = 0.4, STOCK_START = { fuel: 150, steel: 60, concrete: 150, rubber: 30, rations: 150, alu: 30, explosives: 60, electronics: 20 };
// the deposits: per side `near` of them on its own ground (DEP_POOR rich), `mid` in the middle (DEP_RICH), × the map;
// rate: what a mine on it gets out a second (× its richness)
const DEP_KINDS = {
  lime: { name: 'מרבץ מלט', near: 2, mid: 0, rate: 0.25, well: 'quarry', haul: 'cementtruck', plant: 'concrete', makes: 'concrete' },
  oil:  { name: 'שדה נפט', near: 2, mid: 1, rate: 0.09, well: 'oilwell', haul: 'oiltruck', plant: 'refinery', makes: 'fuel' },
  iron: { name: 'מרבץ ברזל', near: 2, mid: 1, rate: 0.12, well: 'ironmine', haul: 'oretruck', plant: 'steelmill', makes: 'steel' },
  farm: { name: 'שדות', near: 2, mid: 1, rate: 0.15, well: 'farm', haul: 'graintruck', plant: 'kitchen', makes: 'rations' },
  // (bauxite: scarce — none on a side's own ground but the one by its HQ; rich ones in the middle. The smelter burns fuel)
  bauxite: { name: 'מרבץ בוקסיט', near: 0, mid: 2, rate: 0.08, well: 'bauxmine', haul: 'bauxtruck', plant: 'smelter', makes: 'alu', burn: { fuel: 0.4 } },
};
// a plant's second product (a share of the first); the chemical plant: fuel → explosives a second (keeping CHEM_KEEP of
// the fuel for the trucks); the lab: electronics a second to whoever holds it
const PLANT_ALSO = { refinery: { rubber: 0.7 } }, CHEM_RATE = 0.08, CHEM_KEEP = 30, ELEC_RATE = 0.05;
// what each unit out of a building takes from the stock (the haulers nothing: else the chain could stall for good)
const UNIT_COST = { tank: { steel: 8 }, jeep: { steel: 2, rubber: 2 }, ajeep: { steel: 3, rubber: 2 }, tjeep: { steel: 3, rubber: 2 },
  how: { steel: 6 }, mlrs: { steel: 5, rubber: 1 }, ssm: { steel: 4, rubber: 1, electronics: 4 }, arrow: { steel: 3, rubber: 1, electronics: 3 }, dome: { steel: 3, rubber: 1, electronics: 3 },
  mech: { steel: 1, rubber: 1 }, truck: { rubber: 1 }, fueltruck: { rubber: 1 }, watertruck: { rubber: 1 },
  air: { alu: 6, steel: 1 }, tanker: { alu: 6 }, heli: { alu: 4, steel: 1 }, gunship: { alu: 4, steel: 1 }, lift: { alu: 4 } };
// what one of a truck's fulls takes from the stock as it fills up at its building
const REFILL = { fueltruck: { fuel: 1 }, watertruck: { rations: 1 }, truck: { explosives: 0.6, steel: 0.3 } };
// (a drone: one electronics, and only past DRONE_KEEP in stock — the missiles first: the drones took it all, and no
// missile truck came out; HQ_ELEC: an HQ's trickle, so a side without the lab isn't left with none for good)
const DRONE_COST = { electronics: 1 }, DRONE_KEEP = 6, HQ_ELEC = 0.01;
const DEP_POOR = 1, DEP_RICH = 2.2, AI_MINES = 7, AI_NEED_WAIT = 480;
// what stands first (besides the concrete plant, which every building but these needs)
const NEEDS = { concrete: ['quarry'], steelmill: ['ironmine'], refinery: ['oilwell'], smelter: ['bauxmine'], kitchen: ['farm'], chemplant: ['refinery'],
  airfield: ['smelter'], tankerbase: ['refinery', 'smelter'], heliatk: ['smelter'], heligun: ['smelter'], helilift: ['smelter'],
  waterst: ['kitchen'], depot: ['chemplant', 'steelmill'],
  tankshop: ['steelmill'], jeepshop: ['steelmill', 'refinery'], jeepat: ['steelmill', 'refinery'], jeepaa: ['steelmill', 'refinery'],
  howshop: ['steelmill'], mlrsshop: ['steelmill'], ssmshop: ['steelmill'], garage: ['steelmill'], fuelst: ['refinery'] };
const NO_CONCRETE = ['hq', 'fhq', 'quarry', 'concrete'];
// concrete a second of a site's work (STEEL_COST: the steel in UNIT_COST, for the UI)
const CON_RATE = 0.3, STEEL_COST = Object.fromEntries(Object.entries(UNIT_COST).filter(([k, c]) => c.steel).map(([k, c]) => [k, c.steel]));
// what each hauler carries, from which building to which
const HAUL = Object.fromEntries(Object.entries(DEP_KINDS).map(([k, D]) => [D.haul, { res: k, well: D.well, plant: D.plant, makes: D.makes }]));
const PLANT_OF = Object.fromEntries(Object.values(DEP_KINDS).map(D => [D.plant, D.makes]));
const MINES = Object.values(DEP_KINDS).map(D => D.well);
const HAUL_OF_PLANT = Object.fromEntries(Object.entries(DEP_KINDS).map(([k, D]) => [D.plant, k]));
// a cost ({good: n}) in stock? take it all (true) or nothing (false)
function pay(s, side, cost, k = 1) {
  if (!s.econ || !cost) return true;
  const st = stockOf(s, side);
  for (const g in cost) if ((st[g] || 0) < cost[g] * k) return g;
  for (const g in cost) st[g] -= cost[g] * k;
  return true;
}
const stockOf = (s, side) => (s.stock || (s.stock = {}))[side] || (s.stock[side] = { ...STOCK_START });
const standing = (s, side, kind) => s.nodes.some(n => n.side === side && n.kind === kind && n.hp > 0 && s.t >= n.ready);
// the first building this kind still waits for on this side (null: none — or no supply chain this game)
function needsOf(s, side, kind) {
  if (!s.econ || !STRUCTS[kind]) return null;
  // (and whatever makes something that burns fuel: a fuel station first)
  const fuel = STRUCTS[kind].unit && needsFuel(STRUCTS[kind].unit) ? ['fuelst'] : [];
  for (const k of [...(NO_CONCRETE.includes(kind) ? [] : ['concrete']), ...(NEEDS[kind] || []), ...fuel]) if (!standing(s, side, k)) return k;
  return null;
}

// no woods, mud or cliff within R of p (a bulldozer in woods crawls: one stood 13 minutes short of a quarry's site)
function openAround(s, p, R) {
  if (!s.ground) return true;
  for (let dx = -R; dx <= R; dx += 16) for (let dy = -R; dy <= R; dy += 16) { if (dx * dx + dy * dy > R * R) continue; const g = groundAt(s, p.x + dx, p.y + dy); if (g === GR_WOOD || g === GR_MUD || g === GR_CLIFF) return false; }
  return true;
}
const DEP_CLEAR = 90;
// lay the deposits (once, the first tick: after the posts and the ground). Not in a lake, on mud or a cliff, by a post;
// each one's twin on the enemy's half
function makeDeposits(s) {
  const r = rng(s.seed ^ 0x2545f491), W = s.W, H = s.H, k = Math.max(1, Math.ceil((s.scale || 1) / 2)), out = [];
  const twin = p => ({ x: W - p.x, y: s.turn ? H - p.y : p.y });
  const ok = p => p.x > 60 && p.x < W - 60 && p.y > 60 && p.y < H - 60 && !lakeAt(s, p, DEP_R + LAKE_PAD + 10) && !groundBad(s, p.x, p.y, DEP_R) && openAround(s, p, DEP_CLEAR) &&
    (s.posts || []).every(o => dist(o, p) > POSTS[o.kind].r + DEP_R + 60) && out.every(o => dist(o, p) > DEP_R * 2 + 120);
  const add = (kind, p, rich) => out.push({ id: 'd' + out.length, kind, x: Math.round(p.x), y: Math.round(p.y), rich });
  for (const [kind, D] of Object.entries(DEP_KINDS)) for (const [n, x0, x1, rich] of [[D.near * k, HQ_BAND * 0.6, HQ_BAND + 0.08, DEP_POOR], [D.mid * k, 0.32, 0.44, DEP_RICH]]) {
    for (let j = 0; j < n; j++) for (let i = 0; i < 300; i++) {
      // (spread over the height: the j-th of n in its band of it)
      const p = { x: W * (x0 + r() * (x1 - x0)), y: H * ((j + 0.15 + r() * 0.7) / n) }, q = twin(p);
      if (!ok(p) || !ok(q) || dist(p, q) < DEP_R * 4) continue;
      add(kind, p, rich); add(kind, q, rich); break;
    }
  }
  s.deposits = out;
}
// a home deposit of each kind for each side, once its HQ is down (wherever it was put in the strip): HOME_R from it — the
// map's own may be out of reach of any HQ spot (the huge map's strip is 5000 high)
const HOME_R = [260, 360]; // (out at the edge of what the HQ lets build: nearer, they and their room took the middle of the base, and the workshops had nowhere to go)
function homeField(s, side) {
  const hq = s.nodes.find(n => n.side === side && n.kind === 'hq' && n.hp > 0); if (!hq) return;
  const r = rng(s.seed ^ (side === 'blue' ? 0x51ed27 : 0x3c6ef3)), foe = s.bases[foeOf(side)];
  for (const kind of Object.keys(DEP_KINDS)) for (let i = 0; i < 300; i++) {
    const a = Math.atan2(foe.y - hq.y, foe.x - hq.x) + (r() - 0.5) * (i < 100 ? 2.6 : 6.3), R = HOME_R[0] + r() * (HOME_R[1] - HOME_R[0]) + (i > 200 ? 100 : 0);
    const p = { x: Math.round(hq.x + Math.cos(a) * R), y: Math.round(hq.y + Math.sin(a) * R) }, well = DEP_KINDS[kind].well;
    if (p.x < 60 || p.x > s.W - 60 || p.y < 60 || p.y > s.H - 60 || lakeAt(s, p, DEP_R + LAKE_PAD + 10) || groundBad(s, p.x, p.y, DEP_R) || (i < 250 && !openAround(s, p, DEP_CLEAR))) continue;
    if (s.nodes.some(n => n.hp > 0 && n.kind !== 'drone' && dist(n, p) < roomPair(s, n.kind, well) + 4) || s.deposits.some(d => dist(d, p) < DEP_R * 2 + 70) || (s.posts || []).some(o => dist(o, p) < POSTS[o.kind].r + DEP_R + 40)) continue;
    s.deposits.push({ id: 'd' + s.deposits.length, kind, x: p.x, y: p.y, rich: DEP_POOR, home: side }); break;
  }
  (s.homeDep = s.homeDep || {})[side] = true;
}
// the AI's forward HQ toward a deposit: a free one on our half it can't build on yet, safe, within reach of its HQs — a
// spot by it (toward home), so the deposit falls in what the forward HQ opens for building. null: none
function aiDepSpot(s, side) {
  if (!s.econ || !s.deposits) return null;
  const home = hqOf(s, side) || s.bases[side], foe = s.bases[foeOf(side)];
  const nodes = controlNodes(s, side).filter(n => n.kind === 'hq' || n.kind === 'fhq');
  const d = s.deposits.filter(d => freeDeposit(s, d.kind, d.x, d.y) && Math.abs(d.x - home.x) < Math.abs(d.x - foe.x) && quality(s, side, d, true) < BUILD_MIN_Q && !threatAt(s, side, d, AI_NEAR) &&
    nodes.some(n => dist(n, d) < nodeSpec(n.kind).r1 + AI_FHQ_REACH)).sort((a, b) => dist(a, home) - dist(b, home))[0];
  if (!d) return null;
  const k = dist(d, home) || 1;
  return { x: Math.round(d.x + (home.x - d.x) / k * 110), y: Math.round(d.y + (home.y - d.y) / k * 110) };
}
// the deposit of this kind under (x, y) with no building on it yet (a mine: its centre snaps to it)
const freeDeposit = (s, kind, x, y) => (s.deposits || []).find(d => d.kind === kind && Math.hypot(d.x - x, d.y - y) <= DEP_SNAP && !s.nodes.some(n => n.hp > 0 && n.dep === d.id));
// a building that isn't a mine may not stand on a free deposit, nor so close a mine wouldn't fit on it (blocked for good)
const onDeposit = (s, kind, x, y) => !STRUCTS[kind].deposit && (s.deposits || []).some(d => Math.hypot(d.x - x, d.y - y) < (freeDeposit(s, d.kind, d.x, d.y) ? roomPair(s, kind, DEP_KINDS[d.kind].well) : DEP_R + (STRUCTS[kind].r || 20) + 10));
// a hauler's tick (from updateUnit; always busy with its own round): load at its mine, unload at the nearest plant
function haulTick(s, u, sq, dt) {
  const H = HAUL[u.type], R = n => nodeR(n) + FUEL_R;
  if (u.cargo === undefined) u.cargo = 0;
  const ready = n => n.side === u.side && n.hp > 0 && s.t >= n.ready;
  const near = kind => { let b = null, bd = Infinity; for (const n of s.nodes) if (n.kind === kind && ready(n)) { const d = dist(u, n); if (d < bd) { bd = d; b = n; } } return b; };
  if (!u.full) {
    const w = s.nodes.find(n => n.id === sq.home && ready(n)) || near(H.well); // (its own mine; that one gone — the nearest)
    if (!w) return true; // (no mine: it stands where it is)
    if (dist(u, w) > R(w)) { moveTo(s, u, w.x, w.y, 1, dt); return true; }
    const add = Math.min(HAUL_CAP - u.cargo, HAUL_LOAD * dt, w.store || 0);
    u.cargo += add; w.store -= add;
    if (u.cargo >= HAUL_CAP - 0.01) u.full = true;
    return true;
  }
  const p = near(H.plant);
  if (!p) return true; // (no plant: it waits, full, where it is)
  if (dist(u, p) > R(p)) { moveTo(s, u, p.x, p.y, 1, dt); return true; }
  const out = Math.min(u.cargo, HAUL_LOAD * dt);
  u.cargo -= out; p.inbox = (p.inbox || 0) + out;
  if (u.cargo <= 0.01) { u.cargo = 0; u.full = false; }
  return true;
}
// every tick: the mines dig, the plants turn what was unloaded into the side's stock
function econTick(s, dt) {
  if (!s.econ) return;
  if (!s.deposits) makeDeposits(s);
  for (const side of ['blue', 'red']) { stockOf(s, side); if (!(s.homeDep && s.homeDep[side])) homeField(s, side); }
  for (const n of s.nodes) {
    if (n.hp <= 0 || s.t < n.ready) continue;
    const S = STRUCTS[n.kind];
    if (S.deposit) { const d = s.deposits.find(d => d.id === n.dep); n.store = Math.min(WELL_KEEP, (n.store || 0) + DEP_KINDS[S.deposit].rate * (d ? d.rich : DEP_POOR) * dt); }
    const good = PLANT_OF[n.kind], st = stockOf(s, n.side);
    if (good && n.inbox > 0) {
      let k = Math.min(n.inbox, PLANT_RATE * dt);
      const burn = DEP_KINDS[HAUL_OF_PLANT[n.kind]].burn; // (the smelter: what it burns, out of the stock — none, it stops)
      if (burn) for (const g in burn) k = Math.min(k, (st[g] || 0) / burn[g]);
      if (k > 0) { n.inbox -= k; st[good] = (st[good] || 0) + k; n.busy = s.t; if (burn) for (const g in burn) st[g] -= k * burn[g]; }
      n.noBurn = !!burn && k <= 0;
      const also = PLANT_ALSO[n.kind]; if (also && k > 0) for (const g in also) st[g] = (st[g] || 0) + k * also[g];
    }
    if (n.kind === 'chemplant') { const k = Math.max(0, Math.min(CHEM_RATE * dt, st.fuel - CHEM_KEEP)); st.fuel -= k; st.explosives = (st.explosives || 0) + k; n.busy = k > 0 ? s.t : n.busy; }
  }
  for (const side of ['blue', 'red']) if (standing(s, side, 'hq')) stockOf(s, side).electronics += HQ_ELEC * dt;
  if (s.posts) for (const p of s.posts) if (p.kind === 'lab' && p.side) { const st = stockOf(s, p.side); st.electronics = (st.electronics || 0) + ELEC_RATE * dt; }
}
// take up to `want` of a product from the side's stock (what was there)
function takeStock(s, side, good, want) {
  if (!s.econ) return want;
  const st = stockOf(s, side), k = Math.max(0, Math.min(want, st[good] || 0));
  st[good] -= k; return k;
}
// a site's work this tick: the concrete it takes (dozerWork) — false: none in stock, it waits (n.noCon)
function siteConcrete(s, n, dt) {
  if (!s.econ || NO_CONCRETE.includes(n.kind)) return true;
  const want = CON_RATE * dt, st = stockOf(s, n.side);
  n.noCon = st.concrete < want;
  if (n.noCon) return false;
  st.concrete -= want; return true;
}
// a unit of this type out of a building: what it takes, all or nothing (k of them) — false: not enough, it waits (n.noGood: what's short)
function payUnit(s, n, type, k = 1) {
  const r = pay(s, n.side, UNIT_COST[type], k);
  n.noGood = r === true ? null : r; n.noSteel = n.noGood === 'steel';
  return r === true;
}
// a truck filling up at its building: up to `want` of its fulls, as far as the stock goes (what it got)
function takeFill(s, side, type, want) {
  const R = REFILL[type]; if (!s.econ || !R || want <= 0) return want;
  const st = stockOf(s, side); let k = want;
  for (const g in R) k = Math.min(k, Math.max(0, st[g] || 0) / R[g]);
  for (const g in R) st[g] -= k * R[g];
  return k;
}
// the AI's chain sites go next on their bulldozer's list, right after what it's building now (at the end of a list of
// 7–9 sites, the refinery stood unbuilt for ten minutes)
function jobSoon(s, n) {
  const q = s.squads.find(q => q.type === 'dozer' && !q.dead && (q.jobs || []).includes(n.id)); if (!q) return;
  const now = jobOf(s, q), l = q.jobs.filter(id => id !== n.id), i = now && now !== n ? l.indexOf(now.id) + 1 : 0;
  l.splice(Math.max(0, i), 0, n.id); q.jobs = l;
}
const builtLast = s => s.nodes[s.nodes.length - 1];
// the AI's chain (every 10 s, once its HQ stands), in the order things need each other: for each kind — lime, iron,
// oil — a mine on the nearest free deposit it can build on (none where an enemy is known), then its plant by the HQ (a
// second past 4 mines of the kind); then more mines, AI_WANT of each kind. At most three chain sites at a time
const AI_WANT = { lime: 2, iron: 3, oil: 3, farm: 2, bauxite: 2 };
function aiEcon(s, side) {
  if (!s.econ || !s.deposits) return;
  if (s.t - (s.aiEconAt && s.aiEconAt[side] || -99) < 5) return;
  (s.aiEconAt = s.aiEconAt || {})[side] = s.t;
  const hq = hqOf(s, side); if (!hq || s.t < hq.ready) return;
  const sites = s.nodes.filter(n => n.side === side && n.hp > 0 && s.t < n.ready && (MINES.includes(n.kind) || PLANT_OF[n.kind])).length;
  if (sites >= 3) return;
  const mine = kind => { const D = DEP_KINDS[kind];
    for (const d of s.deposits.filter(d => d.kind === kind).sort((a, b) => dist(a, hq) - dist(b, hq)))
      if (freeDeposit(s, kind, d.x, d.y) && !threatAt(s, side, d, AI_NEAR) && build(s, side, D.well, d.x, d.y)) { jobSoon(s, builtLast(s)); return true; }
    return false; };
  // (a plant: round the HQ, then the forward HQs, then the side's other buildings — an HQ in a corner had no room)
  const plant = kind => { const P = DEP_KINDS[kind].plant;
    const at = [...s.nodes.filter(n => n.side === side && n.hp > 0 && STRUCTS[n.kind] && STRUCTS[n.kind].econ && !STRUCTS[n.kind].deposit), hq, ...s.nodes.filter(n => n.side === side && n.hp > 0 && n.kind === 'fhq'), ...s.nodes.filter(n => n.side === side && n.hp > 0 && n !== hq && n.kind !== 'fhq' && n.kind !== 'drone' && n.kind !== 'decoy')]; // (by the other plants first: one industrial yard)
    for (const [j, n] of at.slice(0, 12).entries()) for (let i = 0; i < (n === hq ? 24 : 8); i++) { const a = s.rand() * Math.PI * 2, r = roomPair(s, n.kind, P) + 5 + s.rand() * (n !== hq ? 90 : i < 12 ? 320 : 200) + (n === hq && i < 12 ? 100 : 0); if (build(s, side, P, n.x + Math.cos(a) * r, n.y + Math.sin(a) * r)) { jobSoon(s, builtLast(s)); return true; } }
    return false; };
  const count = k => alive(s, side, [k]).length;
  const place = P => { for (let i = 0; i < 24; i++) { const a = s.rand() * Math.PI * 2, r = roomPair(s, 'hq', P) + 5 + s.rand() * (i < 12 ? 200 : 360); if (build(s, side, P, hq.x + Math.cos(a) * r, hq.y + Math.sin(a) * r)) { jobSoon(s, builtLast(s)); return true; } } return false; };
  for (const kind of Object.keys(DEP_KINDS)) {
    const D = DEP_KINDS[kind];
    if (!count(D.well)) { if (mine(kind)) return; continue; }
    if (count(D.plant) < (count(D.well) >= 4 ? 2 : 1)) { if (plant(kind)) return; }
    // (the refinery up: a fuel station at once — everything that makes vehicles waits for it; the kitchen up: a rations
    // depot — the soldiers' canteens; the steel mill up: a chemical plant — the ammunition)
    for (const [k0, P] of [['oil', 'fuelst'], ['farm', 'waterst'], ['iron', 'chemplant']]) if (kind === k0 && !needsOf(s, side, P) && !alive(s, side, [P]).length && place(P)) return;
  }
  for (const kind of Object.keys(DEP_KINDS)) if (count(DEP_KINDS[kind].well) < AI_WANT[kind] && mine(kind)) return;
}
