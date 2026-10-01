// Sim: game constants and tunables (no DOM; also loaded by the Node tests)
const H = 640;
// map size (DESIGN.md §5): the small map is H high; the big one 2× wide and 2× high. No hill within HILL_CLEAR of
// either edge (the bases).
// (the huge map: 2× the big one each way, so up to 6000×2800)
const MAP_H_MAX = 2800, MAP_W_MAX = 6000, HILL_CLEAR = 240;
// height, in contour lines (0 = the plain, hills up to HILL_LEVELS), on a grid every ELEV_CELL. A ground unit gets
// ELEV_BONUS more range and sight per line it stands on; climbing slows it and going down speeds it up, by
// SLOPE_K per line climbed per unit walked, at most SLOPE_MAX. Aircraft don't care.
// HILL_SPREAD: each hill, once placed, is spread over that much more length and width (broad hills, not bumps)
const HILL_SPREAD = 2, HILL_LEVELS = 10, ELEV_CELL = 8, ELEV_BONUS = 0.1, SLOPE_K = 9, SLOPE_MAX = 0.5;
// random maps: the enemy's half is our half's twin, each feature moved up to MAP_JITTER and resized up to MAP_RESIZE;
// lakes keep LAKE_GAP between them
const MAP_JITTER = 30, MAP_RESIZE = 0.12, LAKE_GAP = 60, SHAPE_AMP = 0.14;
// lakes: ground units go around them (only aircraft fly over); nothing is built within LAKE_PAD of one.
// A ground unit looks LAKE_LOOK ahead and slides along the shore when the way is wet.
const LAKE_PAD = 20, LAKE_LOOK = 28;
const TYPES = {
  inf:  { name: 'חי"ר',  hp: 60,  speed: 26, range: 50, dmg: 7,  cd: 0.8, sight: 115, r: 3, rein: 7, cost: 1 },
  tank: { name: 'טנקים', hp: 150, speed: 37, range: 75, dmg: 18, cd: 1.6, sight: 135, r: 13, rein: 12, cost: 2 },
  air:  { name: 'מטוסים', hp: 90, speed: 80, range: 95, dmg: 14, cd: 1.2, sight: 160, r: 9, rein: 15, air: true, ammo: 10, cost: 2 },
  // (AA soldiers: missiles only at what flies; at the ground a rifle — gun: an infantryman's range and pace, half his
  // hitting power, hitting as infantry does, MULT.inf)
  aa:   { name: 'נ"מ',   hp: 70,  speed: 29, range: 120, dmg: 16, cd: 1.0, sight: 150, r: 3, rein: 9, cost: 1, gun: { range: 50, dmg: 3.5, cd: 0.8, as: 'inf' } },
  jeep: { name: "ג'יפים", hp: 80,  speed: 60, range: 60,  dmg: 6,  cd: 0.7, sight: 170, r: 8, rein: 8, cost: 1 },
  // anti-tank soldiers: like AA, but their launcher is for armour
  at:   { name: 'נ"ט',   hp: 60,  speed: 27, range: 95, dmg: 26, cd: 2.0, sight: 125, r: 3, rein: 9, cost: 1 },
  // armed jeeps (twice as long to make): AA missiles or anti-tank missiles on the back
  ajeep: { name: "ג'יפי נ\"מ", hp: 80, speed: 55, range: 110, dmg: 12, cd: 1.1, sight: 170, r: 8, rein: 8, cost: 1 },
  tjeep: { name: "ג'יפי נ\"ט", hp: 80, speed: 55, range: 90,  dmg: 20, cd: 1.8, sight: 170, r: 8, rein: 8, cost: 1 },
  // care squads: they don't fight (range 0); medics treat infantry and AA, mechanics repair jeeps and tanks
  med:  { name: 'חובשים', hp: 50,  speed: 30, range: 0,   dmg: 0,  cd: 1,   sight: 110, r: 3, rein: 8, cost: 1, care: true },
  mech: { name: 'מכונאים', hp: 80, speed: 45, range: 0,   dmg: 0,  cd: 1,   sight: 130, r: 7, rein: 8, cost: 1, care: true },
  truck: { name: 'משאיות אספקה', hp: 90, speed: 45, range: 0, dmg: 0, cd: 1,  sight: 120, r: 7, rein: 8, cost: 1, care: true },
  // support (the full game): a bulldozer builds the HQ, forward HQs and every building (only while it stands by the
  // site); a signals truck sees far and gives control around it (NODES.radio). Neither fights; both come from the HQ.
  dozer: { name: 'טרקטורים', hp: 120, speed: 30, range: 0, dmg: 0, cd: 1, sight: 110, r: 9, rein: 8, cost: 1, care: true, support: true },
  // helicopters (from a helipad): they hover — hold a spot, stand over what they shoot — where planes circle.
  // AA hits them hard, and flying low, soldiers and jeeps a little too. heli: missiles (aircraft, helicopters,
  // vehicles); gunship: a machine gun (soldiers)
  heli:    { name: 'מסוקי קרב', hp: 110, speed: 55, range: 90, dmg: 16, cd: 1.4, sight: 150, r: 9, rein: 15, air: true, hover: true, ammo: 8, cost: 2 },
  gunship: { name: 'מסוקי מקלע', hp: 100, speed: 60, range: 70, dmg: 6, cd: 0.35, sight: 150, r: 9, rein: 15, air: true, hover: true, ammo: 30, cost: 2 },
  // the transport helicopter: no gun; carries up to `cap` soldiers (any kind on foot, commandos too) — see special.js
  lift:    { name: 'מסוקי תובלה', hp: 130, speed: 70, range: 0, dmg: 0, cd: 1, sight: 150, r: 10, rein: 15, air: true, hover: true, care: true, cap: 10, cost: 2 },
  // missiles (special.js): a surface-to-surface missile truck; and the missile defences' trucks — Arrow (against those
  // missiles) and Iron Dome (against the short ones: aircraft's, helicopters', anti-tank). None of them fights.
  ssm:     { name: 'משאיות טילים', hp: 100, speed: 35, range: 0, dmg: 0, cd: 1, sight: 110, r: 9, rein: 8, care: true, cost: 2 },
  arrow:   { name: 'משאיות חץ', hp: 90, speed: 38, range: 0, dmg: 0, cd: 1, sight: 120, r: 9, rein: 8, care: true, cost: 2 },
  dome:    { name: 'משאיות כיפת ברזל', hp: 90, speed: 38, range: 0, dmg: 0, cd: 1, sight: 120, r: 9, rein: 8, care: true, cost: 2 },
  // the commando (special.js): the enemy doesn't see him — only right by its drone or signals truck, close by its
  // units or buildings, or for a moment when he fires; he sees round him as a drone does (all of it made out). One
  // shot kills a soldier (a few seconds between); by an enemy building, standing still, he blows it up (the HQ: four)
  commando: { name: 'קומנדו', hp: 70, speed: 30, range: 70, dmg: 70, cd: 3, sight: 200, r: 3, rein: 8, cost: 2, stealth: true },
  radio: { name: 'משאיות קשר', hp: 90, speed: 42, range: 0, dmg: 0, cd: 1, sight: 510, r: 8, rein: 8, cost: 1, care: true, support: true },
};
// logistics: ground fighters carry SUPPLY shots, one used per shot. Low (below SUPPLY_LOW of a load) a unit goes on
// its own to the nearest supply truck, or home, holding its fire until refilled to SUPPLY_DONE. Within SUPPLY_R of a
// truck, or by one of its side's buildings (a forward HQ too), it refills SUPPLY_FILL of a load per second.
// Only where s.supply is on (the full game, and the tutorial from its care level).
const SUPPLY = { commando: 40, inf: 150, jeep: 150, tank: 60, aa: 60, at: 40, ajeep: 60, tjeep: 40 }, SUPPLY_LOW = 0.1, SUPPLY_DONE = 0.9, SUPPLY_FILL = 0.12, SUPPLY_R = 40;
// care: a unit below CARE_AT of its health leaves the fight on its own and goes to the nearest unit that treats its
// kind (CARER), or home if there is none; it doesn't shoot until back at CARE_DONE. Within CARE_R of a medic /
// mechanic it heals CARE_HEAL per second.
const CARER = { commando: 'med', ssm: 'mech', arrow: 'mech', dome: 'mech', inf: 'med', aa: 'med', at: 'med', med: 'med', jeep: 'mech', ajeep: 'mech', tjeep: 'mech', tank: 'mech', mech: 'mech', truck: 'mech', dozer: 'mech', radio: 'mech' };
const CARE_AT = 0.4, CARE_DONE = 0.9, CARE_R = 30, CARE_HEAL = 9;
// power (for collapse) per full-health unit
const UNIT_VALUE = { commando: 2, ssm: 2.5, arrow: 2, dome: 2, lift: 3, heli: 4, gunship: 3.5, inf: 1, aa: 1.5, at: 1.5, jeep: 1.5, ajeep: 2.5, tjeep: 2.5, tank: 3, air: 4, med: 1, mech: 1.5, truck: 1.5, dozer: 1.5, radio: 1.5 };
// Damage multiplier MULT[attacker][target]. Range order: aa > air > tank > inf
// impact explosion per attacker: big for tanks/aircraft, smaller for AA, tiny for infantry
// how long a shot flies (s): bullets (infantry, jeeps) are quick, shells slower, missiles (aircraft, AA) slowest;
// its blast shows when it lands. Only a look: the damage is dealt when fired.
const SHOT_TIME = { commando: 0.1, heli: 0.45, gunship: 0.1, inf: 0.1, jeep: 0.1, tank: 0.25, air: 0.45, aa: 0.5, at: 0.35, ajeep: 0.5, tjeep: 0.35 };
const IMPACT = { commando: { size: 4, life: 0.22 }, heli: { size: 16, life: 0.45 }, gunship: { size: 5, life: 0.22 }, tank: { size: 18, life: 0.5 }, air: { size: 18, life: 0.5 }, aa: { size: 10, life: 0.35 }, inf: { size: 4, life: 0.22 }, jeep: { size: 6, life: 0.25 }, at: { size: 14, life: 0.45 }, ajeep: { size: 10, life: 0.35 }, tjeep: { size: 14, life: 0.45 } };
// only AA (soldiers and AA jeeps) can hit aircraft (and drones): every other air column is 0, and 0 means "can't target".
// Anti-tank (soldiers and AT jeeps) is strong against vehicles, weak against people
// (medics are hit like infantry, mechanics like jeeps; care squads hit nothing)
const MULT = {
  inf:   { inf: 1, tank: 0.4, air: 0, aa: 1, jeep: 0.8, med: 1, mech: 0.8, truck: 0.8, at: 1, ajeep: 0.8, tjeep: 0.8, dozer: 0.8, radio: 0.8, heli: 0.25, gunship: 0.25, lift: 0.25, ssm: 0.8, arrow: 0.8, dome: 0.8, commando: 1 },
  tank:  { inf: 1.0, tank: 1, air: 0, aa: 1.0, jeep: 1.3, med: 1.0, mech: 1.3, truck: 1.3, at: 1.0, ajeep: 1.3, tjeep: 1.3, dozer: 1.3, radio: 1.3, heli: 0, gunship: 0, lift: 0, ssm: 1.3, arrow: 1.3, dome: 1.3, commando: 1.0 },
  air:   { inf: 0.4, tank: 2, air: 0, aa: 0.5, jeep: 1.5, med: 0.4, mech: 1.5, truck: 1.5, at: 0.4, ajeep: 1.5, tjeep: 1.5, dozer: 1.5, radio: 1.5, heli: 0, gunship: 0, lift: 0, ssm: 1.5, arrow: 1.5, dome: 1.5, commando: 0.4 },
  aa:    { inf: 0.25, tank: 0.2, air: 2.2, aa: 0.25, jeep: 0.3, med: 0.25, mech: 0.3, truck: 0.3, at: 0.25, ajeep: 0.3, tjeep: 0.3, dozer: 0.3, radio: 0.3, heli: 2.2, gunship: 2.2, lift: 2.2, ssm: 0.3, arrow: 0.3, dome: 0.3, commando: 0.25 },
  jeep:  { inf: 1.2, tank: 0.3, air: 0, aa: 1, jeep: 1, med: 1.2, mech: 1, truck: 1, at: 1.2, ajeep: 1, tjeep: 1, dozer: 1, radio: 1, heli: 0.25, gunship: 0.25, lift: 0.25, ssm: 1, arrow: 1, dome: 1, commando: 1.2 },
  at:    { inf: 0.2, tank: 2.2, air: 0, aa: 0.2, jeep: 1.5, med: 0.2, mech: 1.5, truck: 1.5, at: 0.2, ajeep: 1.5, tjeep: 1.5, dozer: 1.5, radio: 1.5, heli: 0, gunship: 0, lift: 0, ssm: 1.5, arrow: 1.5, dome: 1.5, commando: 0.2 },
  ajeep: { inf: 0.25, tank: 0.2, air: 1.7, aa: 0.25, jeep: 0.3, med: 0.25, mech: 0.3, truck: 0.3, at: 0.25, ajeep: 0.3, tjeep: 0.3, dozer: 0.3, radio: 0.3, heli: 1.7, gunship: 1.7, lift: 1.7, ssm: 0.3, arrow: 0.3, dome: 0.3, commando: 0.25 },
  tjeep: { inf: 0.2, tank: 1.9, air: 0, aa: 0.2, jeep: 1.3, med: 0.2, mech: 1.3, truck: 1.3, at: 0.2, ajeep: 1.3, tjeep: 1.3, dozer: 1.3, radio: 1.3, heli: 0, gunship: 0, lift: 0, ssm: 1.3, arrow: 1.3, dome: 1.3, commando: 0.2 },
  med:   { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  mech:  { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  truck: { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  dozer: { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  radio: { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  // (air: 1 = it can go for anything flying — an unknown air track, a drone: the attack helicopter's missiles do)
  heli:    { inf: 0.4, tank: 1.8, air: 1, aa: 0.5, jeep: 1.5, med: 0.4, mech: 1.5, truck: 1.5, at: 0.4, ajeep: 1.5, tjeep: 1.5, dozer: 1.5, radio: 1.5, heli: 1.2, gunship: 1.2, lift: 1.2, ssm: 1.5, arrow: 1.5, dome: 1.5, commando: 0.4 },
  gunship: { inf: 1.6, tank: 0.15, air: 0, aa: 1.4, jeep: 0.6, med: 1.6, mech: 0.6, truck: 0.6, at: 1.6, ajeep: 0.6, tjeep: 0.6, dozer: 0.6, radio: 0.6, heli: 0, gunship: 0, lift: 0, ssm: 0.6, arrow: 0.6, dome: 0.6, commando: 1.6 },
  lift:    { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  ssm:     { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  arrow:   { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  dome:    { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0, at: 0, ajeep: 0, tjeep: 0, dozer: 0, radio: 0, heli: 0, gunship: 0, lift: 0, ssm: 0, arrow: 0, dome: 0, commando: 0 },
  commando: { inf: 1, tank: 0.05, air: 0, aa: 1, jeep: 0.1, med: 1, mech: 0.1, truck: 0.1, at: 1, ajeep: 0.1, tjeep: 0.1, dozer: 0.1, radio: 0.1, heli: 0, gunship: 0, lift: 0, ssm: 0.1, arrow: 0.1, dome: 0.1, commando: 1 },
};
const TRAITS = {
  aggressive: { name: 'תוקפני', leash: 1.8, retreatAt: 0.15, support: 420 },
  balanced:   { name: 'מאוזן',  leash: 1.3, retreatAt: 0.3,  support: 320 },
  cautious:   { name: 'זהיר',   leash: 1.0, retreatAt: 0.5,  support: 220 },
};
const ORDER_R = { hold: 60, attack: 100, retreat: 40 };
const ORDER_NAME = { hold: 'מחזיק', attack: 'תוקף', retreat: 'נסוג', support: 'מסייע' };
const BASE_HEAL = 10, HEAL_R = 70, REARM_TIME = 2.5;
const AIR_ORBIT = 45, AIR_LEAD = 0.6; // aircraft circle: the ring round where they are sent, and how far ahead on it they steer
// structures (DESIGN.md §3–4). Production buildings raise one squad each and refill it, one unit per `every` s.
// r: its footprint's radius (nothing drives through it; the picture is about 2.4r across): the HQ the biggest, the
// airfield as big, then the tank workshop, the jeep workshops / garage / depot, and the tents the smallest.
// cat: where it is in the build menu (tents, workshops — jeep ones in a sub-menu —, the airfield, services)
// (r: a building's footprint radius — its picture, collisions, room between buildings; distances to a building —
// fire, healing, repair — count from its edge: nodeR)
// (bodies — buildings' and units' r — are 1/1.5 of what they were at 2× / 2–3×: the world is 1.5× bigger round them,
// and the UI zooms in 1.5× (WORLD_K); at the full size big bodies jammed in passes and round buildings)
const STRUCTS = {
  hq:       { name: 'מפקדה',       icon: '🏰', hp: 1500, value: 10, sight: 180, r: 48 },
  fhq:      { name: 'פיקוד קדמי',  icon: '🏕️', hp: 600,  value: 5, r: 24 },
  drone:    { name: 'רחפן',        icon: '🛸', hp: 30,   value: 0, r: 0 },
  tent:     { name: 'אוהל',        icon: '⛺', hp: 400,  value: 3, unit: 'inf',  build: 20, every: 15,  size: 6, r: 21, cat: 'tents' },
  atpost:   { name: 'אוהל נ"ט',    icon: '🚀', hp: 450,  value: 4, unit: 'at',   build: 30, every: 30,  size: 4, r: 21, cat: 'tents' },
  aapost:   { name: 'אוהל נ"מ',    icon: '📡', hp: 450,  value: 4, unit: 'aa',   build: 30, every: 30,  size: 4, r: 21, cat: 'tents' },
  // the commando base (3 minutes to set up, one every 2 minutes, at most 4)
  commandopost: { name: 'בסיס קומנדו', icon: '🗡️', hp: 400, value: 4, unit: 'commando', build: 180, every: 120, size: 4, r: 21, cat: 'tents' },
  clinic:   { name: 'אוהל חובשים', icon: '🏥', hp: 350,  value: 3, unit: 'med',  build: 20, every: 25,  size: 2, r: 21, cat: 'tents' },
  tankshop: { name: 'סדנת טנקים',  icon: '🏭', hp: 600,  value: 6, unit: 'tank', build: 50, every: 60,  size: 3, r: 36, cat: 'shops', upgrade: 'trophy' },
  // the missile works: surface-to-surface missile trucks (3 minutes to set up, one every 2 minutes, at most 3)
  ssmshop:  { name: 'מפעל טילים', icon: '🚀', hp: 600, value: 6, unit: 'ssm', build: 180, every: 120, size: 3, r: 32, cat: 'shops' },
  // the missile defences (the service menu's page): Arrow, Iron Dome
  arrowsite: { name: 'אתר חץ', icon: '🛡️', hp: 500, value: 5, unit: 'arrow', build: 120, every: 60, size: 3, r: 28, cat: 'defense' },
  domesite:  { name: 'אתר כיפת ברזל', icon: '🛡️', hp: 450, value: 4, unit: 'dome', build: 60, every: 60, size: 4, r: 28, cat: 'defense' },
  jeepshop: { name: "סדנת ג'יפים", icon: '🔧', hp: 450,  value: 4, unit: 'jeep', build: 25, every: 25,  size: 4, r: 28, cat: 'jeeps' },
  // the same workshop, set up for armed jeeps: each takes twice as long (badge: what's on the back)
  jeepat:   { name: "סדנת ג'יפי נ\"ט", icon: '🔧', hp: 450, value: 4, unit: 'tjeep', build: 25, every: 50, size: 3, badge: '🚀', r: 28, cat: 'jeeps' },
  jeepaa:   { name: "סדנת ג'יפי נ\"מ", icon: '🔧', hp: 450, value: 4, unit: 'ajeep', build: 25, every: 50, size: 3, badge: '✈️', r: 28, cat: 'jeeps' },
  // helipads (the aviation menu's second page): attack helicopters, gunships
  heliatk:  { name: 'מנחת מסוקי קרב', icon: '🚁', hp: 550, value: 7, unit: 'heli', build: 50, every: 90, size: 2, badge: '🚀', r: 36, cat: 'helis' },
  helilift: { name: 'מנחת מסוקי תובלה', icon: '🚁', hp: 500, value: 5, unit: 'lift', build: 40, every: 90, size: 1, badge: '🪂', r: 36, cat: 'helis' },
  heligun:  { name: 'מנחת מסוקי מקלע', icon: '🚁', hp: 550, value: 7, unit: 'gunship', build: 50, every: 90, size: 2, badge: '🔫', r: 36, cat: 'helis' },
  airfield: { name: 'שדה תעופה',   icon: '🛫', hp: 600,  value: 8, unit: 'air',  build: 60, every: 120, size: 2, r: 45, cat: 'air' },
  garage:   { name: 'מוסך',        icon: '🛠️', hp: 400,  value: 3, unit: 'mech', build: 25, every: 30,  size: 2, r: 28, cat: 'service' },
  depot:    { name: 'מחסן אספקה',  icon: '📦', hp: 400,  value: 3, unit: 'truck', build: 25, every: 30, size: 2, r: 28, cat: 'service' },
  // a fake HQ: cheap, no slot, draws the enemy (under fog it passes for the HQ until made out closely)
  decoy:    { name: 'מפקדה מזויפת', icon: '🏰', hp: 250,  value: 0.5, build: 15, badge: '🎭', r: 48, cat: 'service' },
};
const PRODUCERS = Object.keys(STRUCTS).filter(k => STRUCTS[k].unit);
// what the player can build: the producers and the fake HQ (at most DECOY_MAX standing, outside the slots; full game only)
const BUILDABLE = [...PRODUCERS, 'decoy'], DECOY_MAX = 2;
// repairs: a damaged building is mended by its side's ground units within REPAIR_R that have nothing to do (arrived,
// no shot for REPAIR_QUIET s, not off for care or ammunition): REPAIR_RATE hp/s each (a mechanic REPAIR_MECH times
// that), counting up to REPAIR_MAX of them
const REPAIR_R = 70, REPAIR_RATE = 3, REPAIR_MECH = 3, REPAIR_MAX = 8, REPAIR_QUIET = 4;
// BUILD_GAP: the room kept between two buildings' footprints
const BUILD_MIN_Q = 0.5, BUILD_BASE = 2, BUILD_PER_NODE = 2, BUILD_GAP = 12, STRUCT_SIGHT = 160;
// nothing drives through a building: ground units are kept its STRUCTS r from its centre.
// Units keep UNIT_GAP between them. A tank that runs into enemy soldiers (FOOT) crushes them, CRUSH_DPS a second.
// a building in a ground unit's way is gone round once it's within SKIRT_AHEAD of its edge, SKIRT_STEP a step to the side
const SKIRT_AHEAD = 30, SKIRT_STEP = 30;
// (STEER_*: a ground unit about to run into another turns aside — both moving: each 90° to its right, so two meeting
// head-on pass each other; the other standing: 45°, to the side away from it. One that hasn't got anywhere for
// STUCK_T s, though it means to move, takes a detour to its right for DETOUR_T s.)
const STEER_LOOK = 14, STUCK_T = 1.5, DETOUR_T = 1.2;
// (and one that can't get to its spot — others stand there — gives up: no nearer to it for GIVEUP_T s within
// GIVEUP_R of it, it stands where it is GIVEUP_REST s (and up to GIVEUP_JIT more), then tries again; before, they shoved
// one another without end)
const GIVEUP_T = 3, GIVEUP_R = 120, GIVEUP_REST = 3, GIVEUP_JIT = 2;
// a hurt unit is slower and weaker, by its health (as its dot on the map: yellow, orange under 60%, red under 30%):
// HURT_K = [over 95% … , under 30%]
const HURT_AT = [0.95, 0.6, 0.3], HURT_K = [1, 0.9, 0.75, 0.55];
const UNIT_GAP = 10, CRUSH_DPS = 90, FOOT = ['inf', 'aa', 'at', 'med', 'commando'];
// how hard a unit is to push aside when two bump (soldiers 1)
// (SLIDE: how much of a push goes sideways)
const MASS = { tank: 6, jeep: 2, ajeep: 2, tjeep: 2, mech: 2, truck: 2, dozer: 3, radio: 2 }, SLIDE = 0.35;
// collapse: a side whose power falls below COLLAPSE of both sides' total loses (not before COLLAPSE_AFTER s)
const COLLAPSE = 0.15, COLLAPSE_AFTER = 60;
// comeback: the weaker side (by power share) produces up to BOOST_MAX faster, fully at share BOOST_FULL
const BOOST_MAX = 0.3, BOOST_FULL = 0.25;
const MARK_LIFE = 4;
// a squad under pressure calls HQ for a decision; unanswered calls are decided by its commander's temper
const CALL_TIME = 10, CALL_COOLDOWN = 45, CALL_BAND = 0.15, FIRM_TIME = 20, FIRM_BONUS = 0.15, HIST_EVERY = 3;
const TEMPERS = {
  bold:    { name: 'נועז', icon: '🦁', report: 1.4,  rosy: 0.15,  retreat: -0.05 },
  steady:  { name: 'שקול', icon: '🦉', report: 1,    rosy: 0,     retreat: 0 },
  anxious: { name: 'חרד',  icon: '🐇', report: 0.75, rosy: -0.1,  retreat: 0.05 },
};
const SURNAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'אזולאי', 'דהן', 'שפירא'];
// control nodes (DESIGN.md §1): q = quality at full strength, full inside r0, then in Q_STEPS rings down to nothing at
// r1 (100% → 80% → 60% → 40% → 20%), so the zones can be seen on the map.
// Drones: one more comes every `every` s (the first is in hand at once), up to `max` in the air and in hand together;
// one stays up until AA shoots it down. It sees out to its 60% ring (DRONE_SEE), making out less the farther out.
// Drones don't count for building (only the HQ and forward HQs do).
const NODES = {
  hq:    { q: 1,    r0: 280, r1: 480 },
  fhq:   { q: 0.85, r0: 110, r1: 220, hp: 600, warm: 30, every: 180, sight: 150, max: 3 },
  drone: { q: 1,    r0: 110, r1: 310, hp: 30,  warm: 5,  every: 60, max: 10 },
  // every production building: it sees round itself, the picture is exact close by, and building reaches a bit past it
  bld:   { q: 1,    r0: 90,  r1: 190 },
  // the command tanks, before the HQ stands (open field): they carry the command with them
  cmd:   { q: 1,    r0: 150, r1: 330 },
  // a signals truck: three times the area a drone shows (√3 its rings)
  radio: { q: 1,    r0: 190, r1: 540 },
};
const Q_STEPS = 4, DRONE_SEE = 0.6;
const Q_FLOOR = 0.15, FHQ_BUILDERS = ['tank', 'jeep', 'ajeep', 'tjeep'];
// what Q sets: order delay 1 + 7·(1−Q); report every 4 + 12·(1−Q) s; position noise ±80·(1−Q), strength ±0.3·(1−Q)
const DELAY_MIN = 1, DELAY_SPAN = 7, REPORT_MIN = 4, REPORT_SPAN = 12, NOISE_POS = 80, NOISE_STR = 0.3;
// identifying the enemy (our Q where it stands): >= ID_FULL type and number, >= ID_CLASS ground/air, else just "movement".
// A track followed with gaps no longer than TRACK_GAP keeps what was already made out.
const ID_FULL = 0.7, ID_CLASS = 0.4, TRACK_GAP = 3;
// executing "roughly": the commander goes to the target + a random offset within SPREAD·(1−Q)^SPREAD_POW;
// a bold one also overshoots by BOLD_STRETCH of that radius
const SPREAD = 120, SPREAD_POW = 1.5, BOLD_STRETCH = 0.6;
// friendly fire (under fog): a shot at an enemy with a unit of another friendly squad within FF_R of it hits
// that unit instead, with chance FF_CHANCE·(1−Q)² (Q at the shooter's squad); a squad reports it once per FF_NOTE s.
// The hard AI only masses squads on one target where its control is at least FF_MASS_Q.
const FF_CHANCE = 0.08, FF_R = 60, FF_NOTE = 8, FF_MASS_Q = 0.5;
// damage to structures by attacker type (AA is the only thing that can hit a drone)
const NODE_MULT = { commando: 0.3, ssm: 0, arrow: 0, dome: 0, lift: 0, heli: 1.2, gunship: 0.6, inf: 0.6, tank: 1.5, air: 1.2, aa: 1.5, jeep: 0.8, at: 1.5, ajeep: 0.8, tjeep: 1.3 };
// formations: a squad stands in a line across the way to the enemy (the nearest one seen within FACE_R, else the enemy
// HQ), its units LINE_GAP + 2r apart; it turns toward a new threat at FACE_TURN rad/s. Ordering all squads at once
// lines them up in rows, front to back (FORM_ROW): tanks, jeeps, infantry, AA, medics and mechanics; aircraft over the
// middle. Rows are ROW_GAP apart, squads in a row SIDE_GAP apart.
// (the signals truck and the bulldozer at the very back; bulldozers aren't ordered with everyone, though)
// A squad of more than PACK_AT units of a kind (or such squads ordered together) stands in a block instead of a line
// (sq.pack: 'line' / 'block' set by the player, else by that count). Vehicles VEH_GAP apart, soldiers LINE_GAP.
const PACK_AT = 10, VEH_GAP = 18;
const FACE_R = 320, FACE_TURN = 0.8, LINE_GAP = 20, ROW_GAP = 70, SIDE_GAP = 40;
// (attacking: the units that don't fight stand SUPPORT_BACK further back still)
const SUPPORT_BACK = 220;
// (the front: what never goes there — missile trucks fire from far behind)
const FRONT_NOT = ['ssm'];
// under fire: a fighting unit of the player's goes at the shooter, one that doesn't falls back FLEE_D toward the HQ
// (each squad once per REACT_EVERY s)
const FLEE_D = 190, REACT_EVERY = 4;
const FORM_ROW = { commando: 2, ssm: 5, arrow: 5, dome: 5, lift: 4, heli: 1.5, gunship: 1.5, tank: 0, jeep: 1, tjeep: 1, ajeep: 1, air: 1.5, inf: 2, at: 2.5, aa: 3, med: 4, mech: 4, truck: 4, radio: 5, dozer: 5 };
const SUPPORT_MAX = 30, CONTACT_MEMORY = 2, INITIATIVE_EVERY = 1.5, SUPPORT_R = 90;

// difficulty: how often the AI re-plans and how well it decides (never extra units or vision).
// mass: squads converge on the same target instead of spreading out
const DIFFS = {
  easy:   { name: 'קל',   every: 12, smart: false, traits: false },
  normal: { name: 'רגיל', every: 8,  smart: true,  traits: false },
  hard:   { name: 'קשה',  every: 5,  smart: true,  traits: true, mass: true },
};
const AI_NEAR = 170, AI_KEEP = 60, FIRE_REVEAL = 1, MEMORY = 20;
// the AI's build plan (it cycles through it) and when a squad is fit to attack
// forward HQs: a hill at most AI_FHQ_REACH past a node's edge; the trip is dropped after AI_FHQ_TRIP s
const AI_FHQ_REACH = 250, AI_FHQ_TRIP = 90;
const AI_PLAN = ['aapost', 'tankshop', 'atpost', 'jeepshop', 'clinic', 'tent', 'depot', 'airfield', 'jeepat', 'garage', 'domesite', 'heliatk', 'tankshop', 'heligun', 'ssmshop', 'jeepaa', 'arrowsite', 'commandopost'], AI_READY = 0.6;
// the AI's style, picked per game for red (blue bots play 'steady'): what it builds first, how worn a squad may be
// and still attack (ready), and how it goes about it — rush attacks early and often; turtle holds near home until it
// has `wait` squads (or the upper hand), striking only what comes close; flank goes round by the map's edge.
const AI_STYLES = {
  steady: { name: 'שקול',  icon: '🦉', plan: AI_PLAN, ready: AI_READY },
  rush:   { name: 'מסתער', icon: '⚡', plan: ['jeepshop', 'tent', 'tankshop', 'heligun', 'jeepat', 'depot', 'aapost', 'clinic', 'airfield', 'garage'], ready: 0.45 },
  turtle: { name: 'מתבצר', icon: '🐢', plan: ['aapost', 'tankshop', 'atpost', 'depot', 'clinic', 'jeepaa', 'heliatk', 'airfield', 'tankshop', 'garage', 'tent'], ready: 0.7, wait: 5 },
  flank:  { name: 'מאגף',  icon: '↪', plan: AI_PLAN, ready: AI_READY, flank: true },
};
// AI_SILENT_R: the hard AI sends squads going farther than this in radio silence
// AI_RADIO_BACK: how far behind a leading squad the AI keeps a signals truck
const AI_RADIO_BACK = 140, AI_HOME_R = 350, AI_FLANK_R = 350, FALLEN_T = 12, AI_SILENT_R = 500;

// radio silence: a silent squad sends no reports (only the full-control ring still shows it), moves at SILENT_SPEED
// and raises no dust. A talking squad is heard by the enemy: each of its check-ins gives the enemy a vague fix
// ("movement") within RADIO_NOISE of it, at most every RADIO_EVERY s
const SILENT_SPEED = 0.6, RADIO_NOISE = 90, RADIO_EVERY = 6;
// dust: a vehicle driving fast (over DUST_FAST of its speed) is noticed by the enemy from DUST_SEE away, through the
// fog, as "movement" within DUST_NOISE
const DUST_SEE = 420, DUST_NOISE = 40, DUST_FAST = 0.7, DUSTY = ['tank', 'jeep', 'ajeep', 'tjeep', 'mech', 'truck'];
// night (full game): the dark changes once every NIGHT_STEP s, by a quarter, along NIGHT_LEVELS (two minutes of day,
// four to fall, two of night, four to lift), each change eased over NIGHT_FADE s. In the full dark units see
// NIGHT_SIGHT less and orders take NIGHT_DELAY longer (by how dark it is); drones and buildings see as by day
const NIGHT_LEVELS = [0, 0, 0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25], NIGHT_STEP = 60, NIGHT_FADE = 8, NIGHT_SIGHT = 0.4, NIGHT_DELAY = 0.5;
// supply lines: a shot fired far from home (no building of the side within SUPPLY_FAR, no supply truck within
// SUPPLY_NEAR) uses SUPPLY_FAR_K times the ammunition
const SUPPLY_FAR = 350, SUPPLY_NEAR = 150, SUPPLY_FAR_K = 1.7;
// careers: a commander gains experience (the UNIT_VALUE of each enemy unit his squad destroys); ranks at RANK_XP.
// Per rank: reports RANK_NOISE cleaner, orders understood RANK_SPREAD closer and RANK_DELAY faster, unclear orders
// half as often. He falls with his squad; a new one comes up with the refills
const RANK_XP = [0, 4, 10], RANK_NOISE = 0.3, RANK_SPREAD = 0.3, RANK_DELAY = 0.15;
// unclear orders: under friction, where Q < UNCLEAR_Q, an order (not a retreat) comes through garbled with chance
// UNCLEAR_K·(UNCLEAR_Q − Q) / UNCLEAR_Q; the commander reads it by his temper (bold attacks, anxious holds, steady
// keeps to what he was doing)
const UNCLEAR_Q = 0.5, UNCLEAR_K = 0.5;
// open field (the full game): no HQ at the start. Each side picks a spot for it anywhere in the first HQ_BAND of the
// map's width (any height); its CMD_TANKS command tanks drive there and set it up (HQ_WARM s to build). Until it
// stands the command tanks carry the command (NODES.cmd) and nothing can be built; losing them first loses the game.
const HQ_BAND = 0.2, HQ_WARM = 20, CMD_TANKS = 2;
// the player's buildings (singles): one unit out at a time, and at most BUILD_UNITS alive from each building
const BUILD_UNITS = 4;
// cover: soldiers and jeeps among trees are missed COVER_MISS of the times they'd be hit (the trees come from the UI's
// scenery, Sim.setCover; none in Node)
const COVER = ['inf', 'at', 'aa', 'med', 'commando', 'jeep', 'ajeep', 'tjeep'], COVER_MISS = 0.5, COVER_CELL = 64;
// support (the full game, s.dozers): each side starts with a bulldozer and a signals truck; the HQ sends out another
// of each every SUPPORT_EVERY s while it has fewer than SUPPORT_CAP. A building goes up only while a bulldozer stands
// within DOZER_R of it (its work: the building's time, HQ_WARM for the HQ, the forward HQ's warm-up).
// A bulldozer works from a corner of the site, DOZER_R past its footprint. The first forward HQ may be set up
// FHQ_AFTER_HQ s after the HQ stands (none before it).
// the transport helicopter: soldiers board it within BOARD_R of it while it stands; it sets them down LAND_T s after it
// gets where it was sent, within DROP_R round it
const BOARD_R = 26, LAND_T = 1.5, DROP_R = 30;
// missiles: a truck stands SSM_SETUP s still, then launches at a building its side knows; the missile flies SSM_FLIGHT s
// (the launch shows the enemy where the truck is); a building goes down in one hit, the HQ in SSM_HQ_HITS; soldiers
// and vehicles within SSM_SPLASH take SSM_SPLASH_DMG. The truck launches again after SSM_RELOAD s.
// Arrow: a truck takes on an enemy missile halfway, anywhere within ARROW_R_K of the map's height of it, ARROW_P of
// the time; ARROW_RELOAD s to load the next. Iron Dome: the short missiles (MISSILE_SHOTS: aircraft, attack
// helicopters, anti-tank) at anything of its side within DOME_R_K of the map's height; DOME_RELOAD s between.
// Trophy (the tank workshop's upgrade, TROPHY_BUILD s with no tanks): every tank out after it (or back by a workshop)
// stops TROPHY_MAX of those missiles, one more every TROPHY_EVERY s; never shells or bullets.
const SSM_SETUP = 10, SSM_FLIGHT = 10, SSM_RELOAD = 60, SSM_HQ_HITS = 4, SSM_SPLASH = 40, SSM_SPLASH_DMG = 60;
const ARROW_R_K = 1, ARROW_P = 0.9, ARROW_RELOAD = 60, DOME_R_K = 0.5, DOME_RELOAD = 60;
const MISSILE_SHOTS = ['air', 'heli', 'at', 'tjeep'], TROPHY_MAX = 3, TROPHY_EVERY = 30, TROPHY_BUILD = 180;
// the commando: seen by the enemy only within STEALTH_EYE of its drone or signals truck, STEALTH_NEAR of its units or
// buildings, or for STEALTH_FIRE s after he fires; a charge on a building takes PLANT_T s standing by it (within its
// edge + PLANT_R), and brings it down (the HQ: a quarter — four together, at once)
const STEALTH_EYE = 40, STEALTH_NEAR = 25, STEALTH_FIRE = 4, PLANT_T = 20, PLANT_R = 15;
const SUPPORT_EVERY = 120, SUPPORT_CAP = 3, DOZER_R = 40, FHQ_AFTER_HQ = 60;
