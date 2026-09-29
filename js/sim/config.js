// Sim: game constants and tunables (no DOM; also loaded by the Node tests)
const H = 640;
// map size (DESIGN.md §5): the small map is H high; the big one 2× wide and 2× high. No hill within HILL_CLEAR of
// either edge (the bases).
const MAP_H_MAX = 1400, MAP_W_MAX = 3000, HILL_CLEAR = 240;
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
  inf:  { name: 'חי"ר',  hp: 60,  speed: 26, range: 50, dmg: 7,  cd: 0.8, sight: 115, r: 5, rein: 7, cost: 1 },
  tank: { name: 'טנקים', hp: 150, speed: 37, range: 75, dmg: 18, cd: 1.6, sight: 135, r: 8, rein: 12, cost: 2 },
  air:  { name: 'מטוסים', hp: 90, speed: 80, range: 95, dmg: 14, cd: 1.2, sight: 160, r: 7, rein: 15, air: true, ammo: 10, cost: 2 },
  aa:   { name: 'נ"מ',   hp: 70,  speed: 29, range: 120, dmg: 16, cd: 1.0, sight: 150, r: 6, rein: 9, cost: 1 },
  jeep: { name: "ג'יפים", hp: 80,  speed: 60, range: 60,  dmg: 6,  cd: 0.7, sight: 170, r: 6, rein: 8, cost: 1 },
  // care squads: they don't fight (range 0); medics treat infantry and AA, mechanics repair jeeps and tanks
  med:  { name: 'חובשים', hp: 50,  speed: 30, range: 0,   dmg: 0,  cd: 1,   sight: 110, r: 5, rein: 8, cost: 1, care: true },
  mech: { name: 'מכונאים', hp: 80, speed: 45, range: 0,   dmg: 0,  cd: 1,   sight: 130, r: 6, rein: 8, cost: 1, care: true },
  truck: { name: 'משאיות אספקה', hp: 90, speed: 45, range: 0, dmg: 0, cd: 1,  sight: 120, r: 6, rein: 8, cost: 1, care: true },
};
// logistics: ground fighters carry SUPPLY shots, one used per shot. Low (below SUPPLY_LOW of a load) a unit goes on
// its own to the nearest supply truck, or home, holding its fire until refilled to SUPPLY_DONE. Within SUPPLY_R of a
// truck, or by one of its side's buildings (a forward HQ too), it refills SUPPLY_FILL of a load per second.
// Only where s.supply is on (the full game, and the tutorial from its care level).
const SUPPLY = { inf: 150, jeep: 150, tank: 60, aa: 60 }, SUPPLY_LOW = 0.1, SUPPLY_DONE = 0.9, SUPPLY_FILL = 0.12, SUPPLY_R = 40;
// care: a unit below CARE_AT of its health leaves the fight on its own and goes to the nearest unit that treats its
// kind (CARER), or home if there is none; it doesn't shoot until back at CARE_DONE. Within CARE_R of a medic /
// mechanic it heals CARE_HEAL per second.
const CARER = { inf: 'med', aa: 'med', med: 'med', jeep: 'mech', tank: 'mech', mech: 'mech', truck: 'mech' };
const CARE_AT = 0.4, CARE_DONE = 0.9, CARE_R = 30, CARE_HEAL = 9;
// power (for collapse) per full-health unit
const UNIT_VALUE = { inf: 1, aa: 1.5, jeep: 1.5, tank: 3, air: 4, med: 1, mech: 1.5, truck: 1.5 };
// Damage multiplier MULT[attacker][target]. Range order: aa > air > tank > inf
// impact explosion per attacker: big for tanks/aircraft, smaller for AA, tiny for infantry
// how long a shot flies (s): bullets (infantry, jeeps) are quick, shells slower, missiles (aircraft, AA) slowest;
// its blast shows when it lands. Only a look: the damage is dealt when fired.
const SHOT_TIME = { inf: 0.1, jeep: 0.1, tank: 0.25, air: 0.45, aa: 0.5 };
const IMPACT = { tank: { size: 18, life: 0.5 }, air: { size: 18, life: 0.5 }, aa: { size: 10, life: 0.35 }, inf: { size: 4, life: 0.22 }, jeep: { size: 6, life: 0.25 } };
// only AA can hit aircraft (and drones): every other air column is 0, and 0 means "can't target"
// (medics are hit like infantry, mechanics like jeeps; care squads hit nothing)
const MULT = {
  inf:  { inf: 1,    tank: 0.4, air: 0,   aa: 1,    jeep: 0.8, med: 1,    mech: 0.8, truck: 0.8 },
  tank: { inf: 1.3,  tank: 1,   air: 0,   aa: 1.3,  jeep: 1.3, med: 1.3,  mech: 1.3, truck: 1.3 },
  air:  { inf: 0.4,  tank: 2,   air: 0,   aa: 0.5,  jeep: 1.5, med: 0.4,  mech: 1.5, truck: 1.5 },
  aa:   { inf: 0.25, tank: 0.2, air: 2.2, aa: 0.25, jeep: 0.3, med: 0.25, mech: 0.3, truck: 0.3 },
  jeep: { inf: 1.2,  tank: 0.3, air: 0,   aa: 1,    jeep: 1,   med: 1.2,  mech: 1,   truck: 1 },
  med:  { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0 },
  mech: { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0 },
  truck: { inf: 0, tank: 0, air: 0, aa: 0, jeep: 0, med: 0, mech: 0, truck: 0 },
};
const TRAITS = {
  aggressive: { name: 'תוקפני', leash: 1.8, retreatAt: 0.15, support: 420 },
  balanced:   { name: 'מאוזן',  leash: 1.3, retreatAt: 0.3,  support: 320 },
  cautious:   { name: 'זהיר',   leash: 1.0, retreatAt: 0.5,  support: 220 },
};
const ORDER_R = { hold: 60, attack: 100, retreat: 40 };
const ORDER_NAME = { hold: 'מחזיק', attack: 'תוקף', retreat: 'נסוג', support: 'מסייע' };
const BASE_HEAL = 10, HEAL_R = 70, REARM_TIME = 2.5;
// structures (DESIGN.md §3–4). Production buildings raise one squad each and refill it, one unit per `every` s.
const STRUCTS = {
  hq:       { name: 'מפקדה',       icon: '🏰', hp: 1500, value: 10, sight: 180 },
  fhq:      { name: 'פיקוד קדמי',  icon: '🏕️', hp: 600,  value: 5 },
  drone:    { name: 'רחפן',        icon: '🛸', hp: 30,   value: 0 },
  tent:     { name: 'אוהל',        icon: '⛺', hp: 400,  value: 3, unit: 'inf',  build: 20, every: 20,  size: 6 },
  aapost:   { name: 'עמדת נ"מ',    icon: '📡', hp: 450,  value: 4, unit: 'aa',   build: 30, every: 30,  size: 4 },
  jeepshop: { name: "סדנת ג'יפים", icon: '🔧', hp: 450,  value: 4, unit: 'jeep', build: 25, every: 25,  size: 4 },
  tankshop: { name: 'סדנת טנקים',  icon: '🏭', hp: 600,  value: 6, unit: 'tank', build: 45, every: 45,  size: 3 },
  airfield: { name: 'שדה תעופה',   icon: '🛫', hp: 600,  value: 8, unit: 'air',  build: 60, every: 120, size: 2 },
  clinic:   { name: 'תחנת חובשים', icon: '🏥', hp: 350,  value: 3, unit: 'med',  build: 20, every: 25,  size: 2 },
  garage:   { name: 'מוסך',        icon: '🛠️', hp: 400,  value: 3, unit: 'mech', build: 25, every: 30,  size: 2 },
  depot:    { name: 'מחסן אספקה',  icon: '📦', hp: 400,  value: 3, unit: 'truck', build: 25, every: 30, size: 2 },
};
const PRODUCERS = Object.keys(STRUCTS).filter(k => STRUCTS[k].unit);
const BUILD_MIN_Q = 0.5, BUILD_BASE = 2, BUILD_PER_NODE = 2, BUILD_GAP = 45, STRUCT_SIGHT = 120;
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
};
const Q_STEPS = 4, DRONE_SEE = 0.6;
const Q_FLOOR = 0.15, FHQ_BUILDERS = ['tank', 'jeep'];
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
const NODE_MULT = { inf: 0.6, tank: 1.5, air: 1.2, aa: 1.5, jeep: 0.8 };
// formations: a squad stands in a line across the way to the enemy (the nearest one seen within FACE_R, else the enemy
// HQ), its units LINE_GAP + 2r apart; it turns toward a new threat at FACE_TURN rad/s. Ordering all squads at once
// lines them up in rows, front to back (FORM_ROW): tanks, jeeps, infantry, AA, medics and mechanics; aircraft over the
// middle. Rows are ROW_GAP apart, squads in a row SIDE_GAP apart.
const FACE_R = 320, FACE_TURN = 0.8, LINE_GAP = 6, ROW_GAP = 50, SIDE_GAP = 20;
const FORM_ROW = { tank: 0, jeep: 1, air: 1.5, inf: 2, aa: 3, med: 4, mech: 4, truck: 4 };
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
const AI_PLAN = ['aapost', 'tankshop', 'jeepshop', 'clinic', 'tent', 'depot', 'airfield', 'garage', 'tankshop', 'aapost'], AI_READY = 0.6;
// the AI's style, picked per game for red (blue bots play 'steady'): what it builds first, how worn a squad may be
// and still attack (ready), and how it goes about it — rush attacks early and often; turtle holds near home until it
// has `wait` squads (or the upper hand), striking only what comes close; flank goes round by the map's edge.
const AI_STYLES = {
  steady: { name: 'שקול',  icon: '🦉', plan: AI_PLAN, ready: AI_READY },
  rush:   { name: 'מסתער', icon: '⚡', plan: ['jeepshop', 'tent', 'tankshop', 'jeepshop', 'depot', 'aapost', 'clinic', 'airfield', 'garage'], ready: 0.45 },
  turtle: { name: 'מתבצר', icon: '🐢', plan: ['aapost', 'tankshop', 'depot', 'clinic', 'aapost', 'airfield', 'tankshop', 'garage', 'tent'], ready: 0.7, wait: 5 },
  flank:  { name: 'מאגף',  icon: '↪', plan: AI_PLAN, ready: AI_READY, flank: true },
};
const AI_HOME_R = 350, AI_FLANK_R = 350, FALLEN_T = 12;
