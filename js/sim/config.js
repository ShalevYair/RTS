// Sim: game constants and tunables (no DOM; also loaded by the Node tests)
const RUINS_MAX = 80; // (the last buildings destroyed, kept for the picture: their ruins — s.ruins)
const H = 640;
// map size (DESIGN.md §5): the small map is H high; the big one 2× wide and 2× high. No hill within HILL_CLEAR of
// either edge (the bases).
// (the huge map: 2× the big one each way, so up to 6000×2800)
const MAP_H_MAX = 2800, MAP_W_MAX = 6000, HILL_CLEAR = 240;
// height, in contour lines (0 = the plain, hills up to HILL_LEVELS), on a grid every ELEV_CELL. A ground unit gets
// ELEV_SIGHT more sight and ELEV_RANGE more range per line it stands on; climbing slows it and going down speeds it up, by
// SLOPE_K per line climbed per unit walked, at most SLOPE_MAX. Aircraft don't care.
// HILL_SPREAD: each hill, once placed, is spread over that much more length and width (broad hills, not bumps)
// a unit chooses its target anew every SCAN_EVERY ticks (its turn by its id; at once if the target is gone)
const SCAN_EVERY = 4, SCAN_AI = 1;
// the AI weighs enemies in one square of AI_CLUSTER as one target
const AI_CLUSTER = 60;
// (ELEV_SIGHT more sight and ELEV_RANGE more range a line: from line 8, 9% further than from line 5; a building's sight too)
const ELEV_SIGHT = 0.05, ELEV_RANGE = 0.03;
const HILL_SPREAD = 2, HILL_LEVELS = 10, ELEV_CELL = 8, SLOPE_K = 9, SLOPE_MAX = 0.5;
// random maps: the enemy's half is our half's twin, each feature moved up to MAP_JITTER and resized up to MAP_RESIZE;
// lakes keep LAKE_GAP between them
const MAP_JITTER = 30, MAP_RESIZE = 0.12, LAKE_GAP = 60, SHAPE_AMP = 0.14;
// ground (terrain.js, the full game on the big maps): per side GROUND_N = [woods, mud patches, cliffs] (big / huge
// map), between GROUND_X0 and GROUND_X1 of the width (off the HQ strip, off the centre line); woods GROUND_WOOD and
// mud GROUND_MUD across (radius range); a cliff along GROUND_CLIFF_SPAN rad of a hill's flank at GROUND_CLIFF_AT of
// its radius (about halfway up), GROUND_CLIFF_W either side of the line.
// GROUND_K[class][kind]: how fast (0 = can't go in) — soldiers: woods 0.8, mud 0.5; the commando also climbs cliffs;
// tanks and bulldozers: a tenth in both (and a wood square is cut as they go through); wheels: none of it
const GROUND_N = { big: [3, 2, 2], huge: [10, 6, 6] }, GROUND_X0 = 0.22, GROUND_X1 = 0.47;
const GROUND_WOOD = [70, 130], GROUND_MUD = [50, 90], GROUND_CLIFF_SPAN = [1.4, 2.2], GROUND_CLIFF_AT = 0.6, GROUND_CLIFF_W = 10;
// (5: a road a bulldozer paved — ROAD_K for everyone, whatever was under it)
const ROAD_K = 1.1;
const GROUND_K = {
  foot: { 1: 0.8, 2: 0.5, 3: 0, 5: ROAD_K }, commando: { 1: 0.8, 2: 0.5, 3: 0.5, 5: ROAD_K },
  track: { 1: 0.1, 2: 0.1, 3: 0, 5: ROAD_K }, wheel: { 1: 0, 2: 0, 3: 0, 5: ROAD_K },
};
// roads (roads.js): a square (PATH_CELL) takes ROAD_T s of a bulldozer standing on it (within ROAD_NEAR), on mud
// ROAD_MUD_K times that, through a wood ROAD_WOOD_K; at least ROAD_MIN long
const ROAD_T = 2, ROAD_MUD_K = 3, ROAD_WOOD_K = 2, ROAD_NEAR = 12, ROAD_MIN = 40;
// path finding (path.js): a grid of PATH_CELL squares, blocked within PATH_PAD of a lake or of a building's / post's
// edge. A* (PATH_GREED: a little greedy, faster, near-shortest) searches at most PATH_MAX squares a path and
// PATH_BUDGET a tick in all. A path is kept while the goal stays within PATH_RETARGET of where it was made for; its
// points are passed within PATH_NEAR; the straight way is looked at again every PATH_LOOK s (no way found: PATH_FAIL s); a goal in a blocked
// patch is reached from the nearest clear square within PATH_FIND squares, and a blocked stretch up to PATH_END
// before the goal (a building attacked) doesn't block the way. The building or lake itself (PATH_CORE inside its edge)
// always does.
const PATH_CELL = 16, PATH_PAD = 12, PATH_GREED = 1.2, PATH_MAX = 8000, PATH_BUDGET = 16000, PATH_RETARGET = 60, PATH_NEAR = 14, PATH_LOOK = 0.5, PATH_FIND = 8, PATH_END = 90, PATH_CORE = 4, PATH_LEAD = 30, PATH_FAIL = 4;
// lakes: ground units go around them (only aircraft fly over); nothing is built within LAKE_PAD of one.
// A ground unit looks LAKE_LOOK ahead and slides along the shore when the way is wet.
const LAKE_PAD = 20, LAKE_LOOK = 28;
const TYPES = {
  inf:  { name: 'חי"ר',  hp: 60,  speed: 26, range: 50, dmg: 7,  cd: 0.8, sight: 115, r: 3, rein: 7, cost: 1 },
  tank: { name: 'טנקים', hp: 150, speed: 37, range: 75, dmg: 18, cd: 1.6, sight: 135, r: 13, rein: 12, cost: 2 },
  air:  { name: 'מטוסים', hp: 90, speed: 80, range: 95, dmg: 14, cd: 1.2, sight: 160, r: 9, rein: 15, air: true, ammo: 10, cost: 2 },
  // the tanker (fuel.js): doesn't fight; flies TANKER_T s on its own fuel, circling its place (new ones: tankerSpot,
  // between home and the middle), and fills the planes that come to it
  tanker: { name: 'מטוסי תדלוק', hp: 120, speed: 70, range: 0, dmg: 0, cd: 1, sight: 160, r: 10, rein: 15, air: true, care: true, cost: 2 },
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
  // fuel trucks (fuel.js): from a fuel station; they carry barrels to the front and to vehicles that ran dry
  fueltruck: { name: 'משאיות דלק', hp: 90, speed: 45, range: 0, dmg: 0, cd: 1, sight: 120, r: 7, rein: 8, cost: 1, care: true },
  watertruck: { name: 'משאיות מים', hp: 90, speed: 45, range: 0, dmg: 0, cd: 1, sight: 120, r: 7, rein: 8, cost: 1, care: true },
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
  // artillery (special.js artyTick): the 200 mm gun and the MLRS — no direct fire (care: up close they flee); they fire
  // on their own at what their side sees, far off (ARTY_R)
  how:  { name: 'תותחי 200 מ"מ', hp: 90, speed: 22, range: 0, dmg: 0, cd: 1, sight: 100, r: 9, rein: 10, care: true, arty: true, cost: 2 },
  mlrs: { name: 'משגרי MLRS', hp: 90, speed: 26, range: 0, dmg: 0, cd: 1, sight: 100, r: 9, rein: 10, care: true, arty: true, cost: 2 },
  radio: { name: 'משאיות קשר', hp: 90, speed: 42, range: 0, dmg: 0, cd: 1, sight: 510, r: 8, rein: 8, cost: 1, care: true, support: true },
};
// everything moves at SPEED_K of the speeds above (half: the player's call — slower, more a commander's game, fewer
// bumps a second)
const SPEED_K = 0.5;
for (const T of Object.values(TYPES)) T.speed *= SPEED_K;
// all weapon ranges and sight are RANGE_K / SIGHT_K of the numbers above (the player's call: forces closed right in to
// see and hit each other); the signals truck already sees far (its whole job), so it stays
const RANGE_K = 1.5, SIGHT_K = 1.5;
for (const [k, T] of Object.entries(TYPES)) { T.range *= RANGE_K; if (T.gun) T.gun.range *= RANGE_K; if (k !== 'radio') T.sight *= SIGHT_K; }
// logistics: ground fighters carry SUPPLY shots, one used per shot. Low (below SUPPLY_LOW of a load) a unit goes on
// its own to the nearest supply truck, or home, holding its fire until refilled to SUPPLY_DONE. Within SUPPLY_R of a
// truck, or by one of its side's buildings (a forward HQ too), it refills SUPPLY_FILL of a load per second.
// Only where s.supply is on (the full game, and the tutorial from its care level).
const SUPPLY = { commando: 40, inf: 150, jeep: 150, tank: 60, aa: 60, at: 8, ajeep: 60, tjeep: 16 }, SUPPLY_LOW = 0.1, SUPPLY_DONE = 0.9, SUPPLY_FILL = 0.12, SUPPLY_R = 40;
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
  hq:       { name: 'מפקדה',       icon: '🏰', hp: 1500, value: 10, sight: 270, r: 48 },
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
  howshop:  { name: 'סדנת תותחים 200 מ"מ', icon: '💥', hp: 550, value: 6, unit: 'how', build: 90, every: 90, size: 3, r: 32, cat: 'shops', max: 1 },
  mlrsshop: { name: 'סדנת MLRS', icon: '🎆', hp: 550, value: 6, unit: 'mlrs', build: 90, every: 90, size: 3, r: 32, cat: 'shops', max: 1 },
  ssmshop:  { name: 'מפעל טילים', icon: '🚀', hp: 600, value: 6, unit: 'ssm', build: 180, every: 120, size: 1, keep: 1, max: 3, r: 32, cat: 'shops' }, // (at most max of it a side, keep trucks each)
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
  tankerbase: { name: 'בסיס מטוסי תדלוק', icon: '🛩️', hp: 500, value: 5, unit: 'tanker', build: 60, every: 120, size: 2, keep: 2, max: 1, first: true, r: 40, cat: 'air', fuel: true }, // (fuel: only where there's fuel)
  garage:   { name: 'מוסך',        icon: '🛠️', hp: 400,  value: 3, unit: 'mech', build: 25, every: 30,  size: 2, r: 28, cat: 'service' },
  depot:    { name: 'מחסן אספקה',  icon: '📦', hp: 400,  value: 3, unit: 'truck', build: 25, every: 30, size: 2, r: 28, cat: 'service' },
  // the fuel station (fuel.js): barrels into its yard, and up to `keep` fuel trucks
  fuelst:   { name: 'תחנת דלק', icon: '⛽', hp: 400, value: 3, unit: 'fueltruck', build: 40, every: 30, size: 1, keep: 4, r: 28, cat: 'service' },
  waterst:  { name: 'מתקן מים', icon: '💧', hp: 400, value: 3, unit: 'watertruck', build: 40, every: 120, size: 2, keep: 2, max: 2, free: true, first: true, shore: true, r: 28, cat: 'service' }, // (shore: on a lake's bank)
  // a fake HQ: cheap, no slot, draws the enemy (under fog it passes for the HQ until made out closely)
  decoy:    { name: 'מפקדה מזויפת', icon: '🏰', hp: 250,  value: 0.5, build: 15, badge: '🎭', r: 48, cat: 'service' },
};
const PRODUCERS = Object.keys(STRUCTS).filter(k => STRUCTS[k].unit);
// what the player can build: the producers and the fake HQ (at most DECOY_MAX standing, outside the slots; full game only)
const BUILDABLE = [...PRODUCERS, 'decoy'], DECOY_MAX = 2;
// arms (DESIGN.md, "זרועות"): each player commands some of the four, the computer partner the rest (Sim.setArms);
// which arm each building, and the unit it makes, is of. Not in it — the HQ, the forward HQs, the command tanks — both's
const ARMS = {
  armor:    { name: 'שריון', icon: '🛡️', builds: ['tankshop', 'jeepshop', 'jeepat', 'jeepaa', 'garage'] },
  infantry: { name: 'חיל רגלים', icon: '🪖', builds: ['tent', 'atpost', 'aapost', 'commandopost', 'clinic'] },
  air:      { name: 'חיל האוויר', icon: '✈️', builds: ['airfield', 'tankerbase', 'heliatk', 'heligun', 'helilift', 'domesite', 'arrowsite'] },
  guns:     { name: 'תותחנים והנדסה', icon: '💥', builds: ['howshop', 'mlrsshop', 'ssmshop', 'depot', 'fuelst', 'waterst', 'decoy'], also: ['dozer', 'radio', 'drone'] }, // (also: the bulldozers and signals trucks the HQ sends, the drones, the roads)
};
const ARM_OF = {};
for (const a in ARMS) for (const k of [...ARMS[a].builds, ...(ARMS[a].also || [])]) { ARM_OF[k] = a; if (STRUCTS[k] && STRUCTS[k].unit) ARM_OF[STRUCTS[k].unit] = a; }
// repairs: a damaged building is mended by its side's ground units within REPAIR_R that have nothing to do (arrived,
// no shot for REPAIR_QUIET s, not off for care or ammunition): REPAIR_RATE hp/s each (a mechanic REPAIR_MECH times
// that), counting up to REPAIR_MAX of them
const REPAIR_R = 70, REPAIR_RATE = 3, REPAIR_MECH = 3, REPAIR_MAX = 8, REPAIR_QUIET = 4;
// BUILD_GAP: the room kept between two buildings' footprints
const BUILD_MIN_Q = 0.5, BUILD_BASE = 2, BUILD_PER_NODE = 2, BUILD_GAP = 12, STRUCT_SIGHT = 240;
// nothing drives through a building: ground units are kept its STRUCTS r from its centre.
// Units keep UNIT_GAP between them. A tank that runs into enemy soldiers (FOOT) crushes them, CRUSH_DPS a second.
// a building in a ground unit's way is gone round once it's within SKIRT_AHEAD of its edge, SKIRT_STEP a step to the side
const SKIRT_AHEAD = 30, SKIRT_STEP = 30;
// (STEER_*: a ground unit about to run into another turns aside — both moving: each 90° to its right, so two meeting
// head-on pass each other; the other standing: 45°, to the side away from it. One that hasn't got anywhere for
// STUCK_T s, though it means to move, takes a detour to its right for DETOUR_T s.)
// (the times of these side-steps are by distance at the speed they were tuned at: / SPEED_K, so a half-speed unit
// steps as far aside as before — at half the distance, one jeep stayed wedged between two tanks for good)
const STEER_LOOK = 14, STUCK_T = 1.5, DETOUR_T = 1.2 / SPEED_K;
// (one standing in the way: off at DODGE_A (75°) to the side away from it for DODGE_T–DODGE_T + DODGE_JIT s — sooner
// back for its spot if the way is clear, but not before DODGE_MIN s; again within DODGE_AGAIN s: the same side)
// (YIELD_T: how long one standing in the way steps aside for one coming through)
const YIELD_T = 1.5 / SPEED_K;
const DODGE_A = 75 * Math.PI / 180, DODGE_T = 3 / SPEED_K, DODGE_JIT = 2 / SPEED_K, DODGE_MIN = 0.8 / SPEED_K, DODGE_AGAIN = 2 / SPEED_K;
// (and one that can't get to its spot — others stand there — gives up: no nearer to it for GIVEUP_T s within
// GIVEUP_R of it, it stands where it is GIVEUP_REST s (and up to GIVEUP_JIT more), then tries again; before, they shoved
// one another without end)
const GIVEUP_T = 3, GIVEUP_R = 120, GIVEUP_REST = 3, GIVEUP_JIT = 2;
// a hurt unit is slower and weaker, by its health (as its dot on the map: yellow, orange under 60%, red under 30%):
// HURT_K = [over 95% … , under 30%]
const HURT_AT = [0.95, 0.6, 0.3], HURT_K = [1, 0.9, 0.75, 0.55];
const UNIT_GAP = 10, CRUSH_DPS = 90, FOOT = ['inf', 'aa', 'at', 'med', 'commando'];
// (the player's vehicles take VEH_ROOM more room than their body — they got stuck in each other; the AI's as before:
// changed, bot games stalled — see bodyR)
const VEH_ROOM = 1.2, CRUSH_GO = 80; // (CRUSH_GO: a tank drives at soldiers this close, to run them over)
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
  fhq:   { q: 0.85, r0: 110, r1: 220, hp: 600, warm: 30, every: 180, sight: 225, max: 3 },
  drone: { q: 1,    r0: 110, r1: 310, hp: 30,  warm: 5,  every: 60, max: 10 },
  // every production building: it sees round itself, the picture is exact close by, and building reaches a bit past it
  bld:   { q: 1,    r0: 90,  r1: 190 },
  // the command tanks, before the HQ stands (open field): they carry the command with them
  cmd:   { q: 1,    r0: 150, r1: 330 },
  // a signals truck: three times the area a drone shows (√3 its rings)
  radio: { q: 1,    r0: 190, r1: 540 },
  // a signals antenna (a post) held by the side
  antenna: { q: 1,  r0: 200, r1: 460 },
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
// HQ), its units LINE_GAP + 2r apart; it turns toward a new threat at FACE_TURN rad/s. The player's don't turn: they
// face the arrow's way, or the way they went (past FACE_GO; a short move — toward the enemy HQ). Ordering all squads at once
// lines them up in rows, front to back (FORM_ROW): tanks, jeeps, infantry, AA, medics and mechanics; aircraft over the
// middle. Rows are ROW_GAP apart, squads in a row SIDE_GAP apart.
// (the signals truck and the bulldozer at the very back; bulldozers aren't ordered with everyone, though)
// A squad of more than PACK_AT units of a kind (or such squads ordered together) stands in a block instead of a line
// (sq.pack: 'line' / 'block' set by the player, else by that count). Vehicles VEH_GAP apart, soldiers LINE_GAP.
const PACK_AT = 10, VEH_GAP = 18;
const FACE_R = 320, FACE_TURN = 0.8, FACE_GO = 60, LINE_GAP = 20, ROW_GAP = 70, SIDE_GAP = 40;
// (attacking: the units that don't fight stand SUPPORT_BACK further back still)
const SUPPORT_BACK = 50;
// (together, far off: marching there in the formation — see formation; deep: the player's arrow, rows DEEP_MIN–DEEP_MAX apart)
const MARCH_MIN = 220, MARCH_PACE = 0.9, MARCH_WAIT = 2.5, DEEP_MIN = 20, DEEP_MAX = 260;
// (the front: what never goes there — missile trucks fire from far behind)
const FRONT_NOT = ['ssm', 'dozer', 'tanker'];
// under fire: a fighting unit of the player's goes at the shooter, one that doesn't falls back FLEE_D toward the HQ
// (each squad once per REACT_EVERY s)
const FLEE_D = 190, REACT_EVERY = 4;
const FORM_ROW = { commando: 2, ssm: 4, arrow: 4, dome: 4, lift: 4, heli: 1.5, gunship: 1.5, tank: 0, jeep: 1, tjeep: 1, ajeep: 1, air: 1.5, inf: 2, at: 2.5, aa: 3, med: 3.3, mech: 3.3, truck: 3.4, radio: 3.6, dozer: 4 };
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
const AI_PLAN = ['aapost', 'tankshop', 'atpost', 'jeepshop', 'clinic', 'tent', 'depot', 'fuelst', 'howshop', 'airfield', 'tankerbase', 'jeepat', 'garage', 'domesite', 'mlrsshop', 'heliatk', 'tankshop', 'heligun', 'ssmshop', 'jeepaa', 'arrowsite', 'commandopost', 'helilift'], AI_READY = 0.6;
// the AI's commander (style), picked per game for red from the seed or in the main menu (blue bots play 'steady'):
// what it builds (plan), how worn a squad may be and still attack (ready), and how it goes about it. (The rusher, the
// turtle and the flanker are gone: the turtle hardly ever won, and the other two weren't much of a difference.)
const AI_STYLES = {
  // regular: every kind (and on hard every ability — AI_PLAN_HARD, see think)
  steady:   { name: 'רגיל', icon: '⚖️', plan: AI_PLAN, ready: AI_READY },
  // one arm above all (the player can pick the enemy's commander in the main menu)
  tanks:    { name: 'מפקד השריון', icon: '🛡️', plan: ['tankshop', 'aapost', 'tankshop', 'tankshop', 'garage', 'howshop', 'tankshop'], ready: AI_READY },
  infantry: { name: 'מפקד חיל הרגלים', icon: '🪖', plan: ['tent', 'atpost', 'aapost', 'clinic', 'tent', 'commandopost', 'atpost', 'aapost', 'tent'], ready: 0.45 }, // (attacks worn: holding back, two sides of soldiers stood off for ever)
  vehicles: { name: 'מפקד הרכבים הקלים', icon: '🚙', plan: ['jeepshop', 'jeepat', 'jeepaa', 'garage', 'jeepshop', 'jeepat', 'jeepaa'], ready: AI_READY },
  // the air force: aircraft (with tankers), attack helicopters and gunships, and AA all round home
  air:      { name: 'מפקד חיל האוויר', icon: '✈️', plan: ['tankshop', 'aapost', 'airfield', 'tankerbase', 'atpost', 'heliatk', 'airfield', 'heligun', 'jeepaa', 'airfield', 'tankshop', 'domesite'], ready: AI_READY }, // (a core on the ground first: alone in the air, it was overrun)
  // the commandos: bases, transport helicopters that set them down behind the lines (aiLift), a few to hold home
  commando: { name: 'מפקד הקומנדו', icon: '🗡️', plan: ['tankshop', 'aapost', 'commandopost', 'helilift', 'atpost', 'commandopost', 'tankshop', 'helilift', 'commandopost', 'jeepat', 'domesite'], ready: AI_READY, raids: true }, // (a core on the ground first: with commandos only, it fell in 10 minutes)
  // missiles: a few squads keep home; the missile works first, and the trucks fire at the enemy's buildings (never its
  // HQ). AI_MISSILE_MISS of its missiles shot down (Arrow) — it turns 'steady'
  missile:  { name: 'מפקד הטילים', icon: '🚀', plan: ['aapost', 'ssmshop', 'domesite', 'ssmshop', 'tankshop', 'ssmshop', 'atpost', 'arrowsite', 'aapost', 'tankshop'], ready: 0.7, home: true, missiles: true },
};
// hard, regular: every ability together — missiles, armour, the air force with its tankers, commando raids by
// helicopter, a fake HQ or two; and (see think) it hunts supply trucks and keeps the posts
const AI_PLAN_HARD = ['aapost', 'tankshop', 'atpost', 'tankshop', 'jeepat', 'airfield', 'ssmshop', 'commandopost', 'helilift', 'howshop', 'tankerbase', 'domesite', 'mlrsshop', 'tankshop', 'arrowsite', 'heliatk', 'ssmshop', 'commandopost', 'jeepaa', 'garage', 'clinic', 'heligun', 'tent'];
// raids (hard, and the commando commander): a transport helicopter takes AI_RAID_MIN commandos at least (or what's
// there after AI_RAID_WAIT s) and sets them down AI_RAID_BEHIND past an enemy building it knows of; hard also goes for
// supply trucks first (AI_HUNT_W off a target's score)
const AI_RAID_MIN = 2, AI_RAID_WAIT = 60, AI_RAID_BEHIND = 90, AI_RAID_BOARD = 40, AI_HUNT_W = 250;
const AI_MISSILE_MISS = 2;
// the knockout blow: ahead (AI_PUSH_SHARE of the power, AI_PUSH_MIN fighting squads at least) the AI gathers its
// fighters where they are (gather: until AI_PUSH_IN of them are within AI_PUSH_R of the spot, AI_PUSH_GATHER s at
// most), then all of them go for the enemy HQ together — until it falls, the edge is gone (under AI_PUSH_STOP) or
// AI_PUSH_T s; then not again for AI_PUSH_REST s
const AI_PUSH_SHARE = 0.6, AI_PUSH_STOP = 0.5, AI_PUSH_MIN = 4, AI_PUSH_IN = 0.7, AI_PUSH_R = 250, AI_PUSH_GATHER = 60, AI_PUSH_T = 300, AI_PUSH_REST = 120;
// supply (s.logi): each supply truck keeps AI_TRUCK_BACK behind one of our squads — the neediest of what it carries
// first, else the k-th furthest forward —; a squad goes no more than AI_HOP past the nearest truck that keeps it going
// (fuel for vehicles, water for soldiers; or an HQ), and one short of it (under AI_NEED) waits for its truck
const AI_TRUCK_BACK = 60, AI_HOP = 450, AI_NEED = 0.3;
// AI_SILENT_R: the hard AI sends squads going farther than this in radio silence
// AI_RADIO_BACK: how far behind a leading squad the AI keeps a signals truck
const AI_RADIO_BACK = 140, AI_HOME_R = 350, FALLEN_T = 12, AI_SILENT_R = 500;

// radio silence: a silent squad sends no reports (only the full-control ring still shows it), moves at SILENT_SPEED
// and raises no dust. A talking squad is heard by the enemy: each of its check-ins gives the enemy a vague fix
// ("movement") within RADIO_NOISE of it, at most every RADIO_EVERY s
const SILENT_SPEED = 0.6, RADIO_NOISE = 90, RADIO_EVERY = 6;
// dust: a vehicle driving fast (over DUST_FAST of its speed) is noticed by the enemy from DUST_SEE away, through the
// fog, as "movement" within DUST_NOISE
const DUST_SEE = 420, DUST_NOISE = 40, DUST_FAST = 0.7, DUSTY = ['tank', 'jeep', 'ajeep', 'tjeep', 'mech', 'truck'];
// night (full game): the dark changes once every NIGHT_STEP s, by a quarter, along NIGHT_LEVELS — noon, four steps
// down to the full night, four back up (an 8-minute day) — each change eased over NIGHT_FADE s. In the full dark
// everything sees NIGHT_SIGHT less (units, drones, signals trucks, buildings), shoots NIGHT_RANGE less far and misses
// NIGHT_MISS of its shots; orders take NIGHT_DELAY longer (all by how dark it is)
const NIGHT_LEVELS = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25], NIGHT_STEP = 60, NIGHT_FADE = 8, NIGHT_SIGHT = 0.4, NIGHT_DELAY = 0.5, NIGHT_RANGE = 0.2, NIGHT_MISS = 0.25;
// weather (the full game on the big maps, s.extras): rain now and then, all over the map; and a morning fog after the
// night, only down on the plain (on a hill a unit is above it). Each takes WX_K off sight, range and the hits (where it
// is), eased in and out over WX_FADE s; it all adds up with the night. Per day (8 minutes): rain with chance WX_RAIN_P,
// WX_RAIN_T s long; morning fog with chance WX_FOG_P, from the first light for WX_FOG_T s
const WX_K = 0.2, WX_FADE = 20, WX_RAIN_P = 0.45, WX_RAIN_T = [90, 180], WX_FOG_P = 0.6, WX_FOG_T = 150;
// roads (s.extras): a vehicle on a road goes ROAD_FAST faster (the roads come from the UI's map, Sim.setRoads) — 1 now:
// the dirt roads drawn on the map are no faster (the player's call)
const ROAD_FAST = 1, ROAD_CELL = 64;
// ambush (s.extras): a unit standing still in the trees (AMBUSH_STILL s without moving, AMBUSH_QUIET s without firing)
// is seen only from AMBUSH_NEAR, or by a drone / signals truck
const AMBUSH_STILL = 3, AMBUSH_QUIET = 5, AMBUSH_NEAR = 50;
// posts (s.extras): neutral buildings on the map, taken by soldiers. A soldier who walks into one that isn't his side's
// goes in (and is gone): one of no side becomes his, the enemy's becomes no one's — a second one takes it. A commando
// takes it whole and walks out again. They aren't counted in power and can't be destroyed.
// n: how many on the big map and on the huge one
const POSTS = {
  radar:     { name: 'רדאר',       icon: '📡', r: 26, n: [1, 1] },
  power:     { name: 'תחנת כוח',   icon: '⚡', r: 28, n: [1, 1] },
  fuel:      { name: 'תחנת דלק',   icon: '⛽', r: 24, n: [1, 1] },
  supply:    { name: 'מחסן אספקה', icon: '📦', r: 24, n: [2, 4] },
  hospital:  { name: 'בית חולים',  icon: '🏥', r: 26, n: [2, 4] },
  motorpool: { name: 'מוסך',       icon: '🛠️', r: 26, n: [2, 4] },
  tower:     { name: 'מגדל תצפית', icon: '🗼', r: 18, n: [2, 4], hill: true },
  antenna:   { name: 'אנטנת קשר',  icon: '📶', r: 18, n: [2, 4] },
  bunker:    { name: 'בונקר',      icon: '🧱', r: 20, n: [2, 4] },
};
// radar: its side's units see and shoot RADAR_K further · power station: its side's buildings produce POWER_K faster ·
// fuel station: its side's vehicles go FUEL_K faster · supply depot / hospital / garage: within POST_R of its edge,
// ammunition refills, soldiers / vehicles heal POST_HEAL a second · observation tower: sees TOWER_SIGHT round it (any
// post of a side sees POST_SIGHT) · signals antenna: control round it (NODES.antenna; not for building) · bunker: up to
// BUNKER_MAX of its side's soldiers within BUNKER_R of its edge take BUNKER_K of the damage
const RADAR_K = 0.1, POWER_K = 0.1, FUEL_K = 0.1, POST_R = 80, POST_HEAL = 20, TOWER_SIGHT = 460, POST_SIGHT = 120;
const BUNKER_R = 30, BUNKER_MAX = 4, BUNKER_K = 0.5, CAPTURE_PAD = 6, CAPTURERS = ['inf', 'at', 'aa', 'commando'], POST_GAP = 170;
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
// the HQ under FIX_AT of its health: the nearest bulldozer with nothing to build (or under FIX_BUSY, the nearest) mends it, DOZER_FIX hp/s (one the player sends elsewhere
// isn't sent again for FIX_SKIP s)
const FIX_AT = 0.85, FIX_BUSY = 0.5, DOZER_FIX = 8, FIX_SKIP = 60, FIX_QUIET = 6; // (FIX_QUIET: mending only once nothing has hit it that long)
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
// (the launch shows the enemy where the truck is); a building goes down in one hit — never at the HQ, nor at a fake one (what passes for
// it: firing or not would tell which), and only when ordered (no launching on their own); soldiers
// and vehicles within SSM_SPLASH take SSM_SPLASH_DMG. The truck launches again after SSM_RELOAD s.
// Arrow: a truck takes on an enemy missile halfway, anywhere within ARROW_R_K of the map's height of it, ARROW_P of
// the time; ARROW_RELOAD s to load the next. Iron Dome: the short missiles (MISSILE_SHOTS: aircraft, attack
// helicopters, anti-tank) at anything of its side within DOME_R_K of the map's height; DOME_RELOAD s between.
// Trophy (the tank workshop's upgrade, TROPHY_BUILD s with no tanks): every tank out after it (or back by a workshop)
// stops TROPHY_MAX of those missiles, one more every TROPHY_EVERY s; never shells or bullets.
const SSM_SETUP = 10, SSM_FLIGHT = 10, SSM_RELOAD = 120, SSM_SPLASH = 40, SSM_SPLASH_DMG = 60;
const ARROW_R_K = 1, ARROW_P = 0.9, ARROW_RELOAD = 60, DOME_R_K = 0.5, DOME_RELOAD = 60;
const MISSILE_SHOTS = ['air', 'heli', 'at', 'tjeep'], TROPHY_MAX = 3, TROPHY_EVERY = 30, TROPHY_BUILD = 180;
// the commando: seen by the enemy only within STEALTH_EYE of its drone or signals truck, STEALTH_NEAR of its units or
// buildings, or for STEALTH_FIRE s after he fires; a charge on a building takes PLANT_T s standing by it (within its
// edge + PLANT_R), and brings it down (the HQ: a quarter — four together, at once)
const STEALTH_EYE = 40, STEALTH_NEAR = 25, STEALTH_FIRE = 4, PLANT_T = 20, PLANT_R = 15;
const SUPPORT_EVERY = 120, SUPPORT_CAP = 3, ARMS_DOZERS = 2, DOZER_R = 40, FHQ_AFTER_HQ = 60;
// fuel (fuel.js, the full game): FUEL_T s of moving on a full tank (planes FUEL_AIR s of flying; they turn back under
// PLANE_BACK); under FUEL_LOW a vehicle goes to fill up, until FUEL_DONE, within FUEL_R of the fuel. A barrel fills
// a vehicle; FUEL_BARRELS: those that take more. An HQ / forward HQ fills FUEL_HQ_RATE a second (counted FUEL_HQ_FAR
// farther than a pile, when choosing). A station makes a barrel every FUEL_MAKE s, FUEL_STOCK in its yard at most;
// a truck carries FUEL_LOAD; a pile at the front holds PILE_MAX, PILE_BACK behind the front mark. A vehicle looks for
// the nearest fuel every FUEL_LOOK s and turns back when what's left is FUEL_SPARE times the drive there (or FUEL_LOW)
const FUEL_T = 120, FUEL_AIR = 100, PLANE_BACK = 0.2, FUEL_LOW = 0.25, FUEL_DONE = 0.95, FUEL_R = 40; // (FUEL_R: past two bodies and the gap separate keeps between them)
const FUEL_BARRELS = { tank: 2, dozer: 2 }, FUEL_HQ_RATE = 0.05, FUEL_HQ_FAR = 150, FUEL_HQ_R = 120; // (FUEL_HQ_R: how far from an HQ's edge it fills)
// supply trucks (the full game: s.logi, fuel.js) — no unit goes back for anything: a truck serves what's within TRUCK_R
// of it (fuel FUEL_FILL, ammunition AMMO_FILL, water WATER_FILL of a full one a second), carrying TRUCK_CAP fulls (a
// tank's fuel and ammunition: 2); empty, it drives to its building, fills up in TRUCK_REFILL s and goes back to its
// place. Soldiers drink: WATER_T s on a full canteen; dry, THIRST of their health a second; by a water building
// (WATER_NEAR of its edge) WATER_FILL. Under LIGHT_AT a light shows (fuel yellow, water blue). A medic / mechanic
// goes to the hurt of its kind within MED_SEEK. A water building stands within SHORE_R of a lake.
const TRUCK_CAP = { fueltruck: 8, truck: 8, watertruck: 30 }, TRUCK_R = 100, TRUCK_REFILL = 12, FUEL_FILL = 0.25, AMMO_FILL = 0.2, WATER_FILL = 0.1;
const AMMO_CRATES = { tank: 2 }, AMMO_HQ_RATE = 0.04;
const AI_SUPPLY2 = 300;
// the tanker: TANKER_T s of its own fuel, TANKER_CAP planes' fulls; a plane within TANKER_R of it fills TANKER_FILL a
// second. A plane turns for the nearest fuel (a tanker, or home) when what's left is what the way there takes plus
// BINGO_PAD (planes: PLANE_BACK no more). A tanker's place: TANKER_MID of the way from home to the middle
const TANKER_T = 600, TANKER_CAP = 8, TANKER_R = 45, TANKER_FILL = 0.25, BINGO_PAD = 0.06, TANKER_MID = 0.8;
// (the supply buildings in the full game, s.logi — ammunition, fuel, water: at most 2 of each, past the building
// allowance (free); a truck at once (first), another 2 minutes on, one lost — another 2 minutes on: 4 trucks of each
// kind at most. Outside it (the tutorial) as they were: specOf)
const LOGI_SPEC = { every: 120, size: 2, keep: 2, max: 2, free: true, first: true, value: 0 }; // (value 0: not in the power — structures.js)
const LOGI_STRUCTS = Object.fromEntries(['depot', 'fuelst', 'waterst'].map(k => [k, { ...STRUCTS[k], ...LOGI_SPEC }]));
const specOf = (s, kind) => (s.logi && LOGI_STRUCTS[kind]) || STRUCTS[kind];
// jams (the player's units): a moving unit pushes a standing one of ours aside (gets PUSH_THROUGH of the push, of 2);
// one within ARRIVE_NEAR of its place, blocked (ARRIVE_STUCK s), touching one that has arrived there has arrived too, and stays so while its place
// stays the same and it's within ARRIVE_LEAVE of it — pushed off, it walks back once none of ours has touched it for
// ARRIVE_CALM s (within ARRIVE_SLACK: where it is will do); within ARRIVE_STALL_R and no nearer for ARRIVE_STALL s:
// arrived where it is (squad.js arrivedAt)
const PUSH_THROUGH = 0.3, ARRIVE_NEAR = 45, ARRIVE_LEAVE = 80, ARRIVE_STUCK = 0.4, ARRIVE_CALM = 6, ARRIVE_SLACK = 16, ARRIVE_STALL = 2, ARRIVE_STALL_R = 70;
const WATER_T = 300, THIRST = 0.01, LIGHT_AT = 0.2, MED_SEEK = 180, WATER_NEAR = 60, SHORE_R = 34, LOGI_KINDS = ['depot', 'fuelst', 'waterst'];
const FUEL_MAKE = 10, FUEL_STOCK = 24, FUEL_LOAD = 6, PILE_MAX = 24, PILE_BACK = 50, FUEL_LOOK = 2, FUEL_SPARE = 1.3;
// the fuel truck: like the supply truck in every table by type
// the tanker: like an aircraft as a target, hits nothing; worth an aircraft
for (const a in MULT) MULT[a].tanker = MULT[a].air;
MULT.tanker = { ...MULT.lift }; NODE_MULT.tanker = 0; UNIT_VALUE.tanker = 3; if (MASS.air !== undefined) MASS.tanker = MASS.air; if (FORM_ROW.air !== undefined) FORM_ROW.tanker = FORM_ROW.air;
// artillery: as a target like a truck (a vehicle), hits nothing directly (artyTick does); worth a tank
for (const k of ['how', 'mlrs']) {
  for (const a in MULT) MULT[a][k] = MULT[a].truck;
  MULT[k] = { ...MULT.truck }; NODE_MULT[k] = 0; UNIT_VALUE[k] = 3; CARER[k] = 'mech'; MASS[k] = 3; FORM_ROW[k] = 4; DUSTY.push(k);
}
// the score (s.score): what a side destroyed of the enemy's — each unit by its kind (SCORE; else SCORE_UNIT), each
// building SCORE_NODE (some their own, SCORE_NODES; half while it's still going up). Only kills: a unit lost to thirst
// or pulled down by its own side gives nobody anything. The score doesn't decide the game — the HQ and the collapse do.
const SCORE = { inf: 100, at: 120, aa: 120, med: 100, commando: 500, jeep: 250, ajeep: 300, tjeep: 300, tank: 500, air: 500, tanker: 400, heli: 500, gunship: 450, lift: 400, mech: 150, truck: 250, fueltruck: 250, watertruck: 250, dozer: 300, radio: 300, ssm: 400, arrow: 400, dome: 400, how: 450, mlrs: 450 };
const SCORE_UNIT = 100, SCORE_NODE = 1000, SCORE_NODES = { hq: 5000, fhq: 2000, decoy: 300, drone: 150 };
// the AI builds by what it sees (ai.js aiCounter): each kind of enemy force — what it is, which of our units answer it,
// and the buildings that make them
const AI_THREATS = {
  armour: { is: ['tank'], by: ['at', 'tjeep', 'how', 'air', 'heli'], build: ['atpost', 'jeepat', 'howshop'] },
  air:    { is: ['air', 'heli', 'gunship', 'lift'], by: ['aa', 'ajeep'], build: ['aapost', 'jeepaa'] },
  foot:   { is: ['inf', 'at', 'aa', 'commando'], by: ['mlrs', 'gunship', 'tank', 'jeep'], build: ['mlrsshop', 'jeepshop', 'heligun'] },
  wheels: { is: ['jeep', 'ajeep', 'tjeep'], by: ['tank', 'inf', 'at'], build: ['tankshop', 'tent'] },
};
const AI_SEEN_T = 300, AI_COUNTER_MIN = 4, AI_COUNTER_K = 1, AI_COUNTER_EVERY = 120;
// artillery fires only at what its side sees now (any eye: units, drones, signals trucks, buildings), within ARTY_R —
// twice the longest direct range — after standing ARTY_SETUP s. The 200 mm gun: a shell every HOW_CD s destroys one
// unit, any (a tank too: the best one it sees first), or takes HOW_NODE off a building. The MLRS: a salvo every
// MLRS_CD s over ARTY_AREA round the target — soldiers and wheels in it gone, tanks and bulldozers lose MLRS_TANK of
// their health, a building MLRS_NODE. Firing shows the enemy where it stands. Shells fly ARTY_FLIGHT s (the damage is
// done at the firing, as every shot). The AI keeps them ARTY_BACK behind its leading squads.
const ARTY_R = 2 * Math.max(...Object.values(TYPES).map(T => Math.max(T.range, T.gun ? T.gun.range : 0)));
const ARTY_SETUP = 10, HOW_CD = 25, MLRS_CD = 45, ARTY_AREA = 50, MLRS_TANK = 0.15, HOW_NODE = 120, MLRS_NODE = 40, ARTY_FLIGHT = 2.5, ARTY_BACK = 160, MLRS_ROCKETS = 8;
SHOT_TIME.how = SHOT_TIME.mlrs = ARTY_FLIGHT; IMPACT.how = { size: 28, life: 0.8 }; IMPACT.mlrs = { size: 14, life: 0.5 };
SUPPLY.how = 12; SUPPLY.mlrs = 6;
for (const k of ['fueltruck', 'watertruck']) {
  for (const T of [CARER, UNIT_VALUE, MASS, FORM_ROW]) if (T.truck !== undefined) T[k] = T.truck;
  for (const a in MULT) MULT[a][k] = MULT[a].truck;
  MULT[k] = { ...MULT.truck };
  DUSTY.push(k);
}
