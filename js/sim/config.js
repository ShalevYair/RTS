// Sim: game constants and tunables (no DOM; also loaded by the Node tests)
const H = 640;
const TYPES = {
  inf:  { name: 'חי"ר',  hp: 60,  speed: 30, range: 50, dmg: 7,  cd: 0.8, sight: 115, r: 5, rein: 7, cost: 1 },
  tank: { name: 'טנקים', hp: 150, speed: 44, range: 75, dmg: 18, cd: 1.6, sight: 135, r: 8, rein: 12, cost: 2 },
  air:  { name: 'מטוסים', hp: 90, speed: 95, range: 95, dmg: 14, cd: 1.2, sight: 160, r: 7, rein: 15, air: true, ammo: 10, cost: 2 },
  aa:   { name: 'נ"מ',   hp: 70,  speed: 34, range: 120, dmg: 16, cd: 1.0, sight: 150, r: 6, rein: 9, cost: 1 },
  jeep: { name: "ג'יפים", hp: 80,  speed: 70, range: 60,  dmg: 6,  cd: 0.7, sight: 170, r: 6, rein: 8, cost: 1 },
};
// power (for collapse) per full-health unit
const UNIT_VALUE = { inf: 1, aa: 1.5, jeep: 1.5, tank: 3, air: 4 };
// Damage multiplier MULT[attacker][target]. Range order: aa > air > tank > inf
// impact explosion per attacker: big for tanks/aircraft, smaller for AA, tiny for infantry
const IMPACT = { tank: { size: 18, life: 0.5 }, air: { size: 18, life: 0.5 }, aa: { size: 10, life: 0.35 }, inf: { size: 4, life: 0.22 }, jeep: { size: 6, life: 0.25 } };
// only AA can hit aircraft (and drones): every other air column is 0, and 0 means "can't target"
const MULT = {
  inf:  { inf: 1,    tank: 0.4, air: 0,   aa: 1,    jeep: 0.8 },
  tank: { inf: 1.3,  tank: 1,   air: 0,   aa: 1.3,  jeep: 1.3 },
  air:  { inf: 0.4,  tank: 2,   air: 0,   aa: 0.5,  jeep: 1.5 },
  aa:   { inf: 0.25, tank: 0.2, air: 2.2, aa: 0.25, jeep: 0.3 },
  jeep: { inf: 1.2,  tank: 0.3, air: 0,   aa: 1,    jeep: 1 },
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
  hq:       { name: 'מפקדה',       icon: '🚩', hp: 1500, value: 10, sight: 180 },
  fhq:      { name: 'פיקוד קדמי',  icon: '🏕', hp: 600,  value: 5 },
  drone:    { name: 'רחפן',        icon: '🛸', hp: 30,   value: 0 },
  tent:     { name: 'אוהל',        icon: '⛺', hp: 400,  value: 3, unit: 'inf',  build: 20, every: 20,  size: 6 },
  aapost:   { name: 'עמדת נ"מ',    icon: '🎯', hp: 450,  value: 4, unit: 'aa',   build: 30, every: 30,  size: 4 },
  jeepshop: { name: "סדנת ג'יפים", icon: '🔧', hp: 450,  value: 4, unit: 'jeep', build: 25, every: 25,  size: 4 },
  tankshop: { name: 'סדנת טנקים',  icon: '🏭', hp: 600,  value: 6, unit: 'tank', build: 45, every: 45,  size: 3 },
  airfield: { name: 'שדה תעופה',   icon: '🛫', hp: 600,  value: 8, unit: 'air',  build: 60, every: 120, size: 2 },
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
// control nodes (DESIGN.md §1): q = quality at full strength, full inside r0, none beyond r1
const NODES = {
  hq:    { q: 1,    r0: 280, r1: 480 },
  fhq:   { q: 0.85, r0: 110, r1: 220, hp: 600, warm: 30, every: 60, sight: 150 },
  drone: { q: 1,    r0: 150, r1: 300, hp: 30,  warm: 10, life: 60, every: 30 },
};
const Q_FLOOR = 0.15, FHQ_BUILDERS = ['tank', 'jeep'];
// what Q sets: order delay 1 + 7·(1−Q); report every 4 + 12·(1−Q) s; position noise ±80·(1−Q), strength ±0.3·(1−Q)
const DELAY_MIN = 1, DELAY_SPAN = 7, REPORT_MIN = 4, REPORT_SPAN = 12, NOISE_POS = 80, NOISE_STR = 0.3;
// identifying the enemy (our Q where it stands): >= ID_FULL type and number, >= ID_CLASS ground/air, else just "movement".
// A track followed with gaps no longer than TRACK_GAP keeps what was already made out.
const ID_FULL = 0.7, ID_CLASS = 0.4, TRACK_GAP = 3;
// executing "roughly": the commander goes to the target + a random offset within SPREAD·(1−Q)^SPREAD_POW;
// a bold one also overshoots by BOLD_STRETCH of that radius
const SPREAD = 120, SPREAD_POW = 1.5, BOLD_STRETCH = 0.6;
// damage to structures by attacker type (AA is the only thing that can hit a drone)
const NODE_MULT = { inf: 0.6, tank: 1.5, air: 1.2, aa: 1.5, jeep: 0.8 };
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
const AI_PLAN = ['aapost', 'tankshop', 'jeepshop', 'tent', 'airfield', 'tankshop', 'aapost'], AI_READY = 0.6;
