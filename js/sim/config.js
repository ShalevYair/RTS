// Sim: game constants and tunables (no DOM; also loaded by the Node tests)
const H = 640, WIN = 300;
const TYPES = {
  inf:  { name: 'חי"ר',  hp: 60,  speed: 30, range: 50, dmg: 7,  cd: 0.8, sight: 115, r: 5, rein: 7, cost: 1 },
  tank: { name: 'טנקים', hp: 150, speed: 44, range: 75, dmg: 18, cd: 1.6, sight: 135, r: 8, rein: 12, cost: 2 },
  air:  { name: 'מטוסים', hp: 90, speed: 95, range: 95, dmg: 14, cd: 1.2, sight: 160, r: 7, rein: 15, air: true, ammo: 10, cost: 2 },
  aa:   { name: 'נ"מ',   hp: 70,  speed: 34, range: 120, dmg: 16, cd: 1.0, sight: 150, r: 6, rein: 9, cost: 1 },
};
// Damage multiplier MULT[attacker][target]. Range order: aa > air > tank > inf
// impact explosion per attacker: big for tanks/aircraft, smaller for AA, tiny for infantry
const IMPACT = { tank: { size: 18, life: 0.5 }, air: { size: 18, life: 0.5 }, aa: { size: 10, life: 0.35 }, inf: { size: 4, life: 0.22 } };
const MULT = {
  inf:  { inf: 1,    tank: 0.4, air: 0.3, aa: 1 },
  tank: { inf: 1.3,  tank: 1,   air: 0.1, aa: 1.3 },
  air:  { inf: 0.4,  tank: 2,   air: 0.8, aa: 0.5 },
  aa:   { inf: 0.25, tank: 0.2, air: 2.2, aa: 0.25 },
};
const TRAITS = {
  aggressive: { name: 'תוקפני', leash: 1.8, retreatAt: 0.15, support: 420 },
  balanced:   { name: 'מאוזן',  leash: 1.3, retreatAt: 0.3,  support: 320 },
  cautious:   { name: 'זהיר',   leash: 1.0, retreatAt: 0.5,  support: 220 },
};
const ORDER_R = { hold: 60, attack: 100, retreat: 40 };
const ORDER_NAME = { hold: 'מחזיק', attack: 'תוקף', retreat: 'נסוג', support: 'מסייע' };
const BASE_HEAL = 10, CAPTURE_RATE = 0.05, REARM_TIME = 2.5;
// reinforcement speed: +15% per held point, +50% more if the point matches the unit type
// tuned in Node (bot vs bot): the early leader still wins ~2/3 of even games instead of ~95%
const REIN_PER_POINT = 0.15, REIN_PER_MATCH = 0.5, CATCHUP_MAX = 0.6, CATCHUP_GAP = 0.2, CATCHUP_CAPTURE = 0.5;
// reserves: every reinforcement is paid for; the pool refills 1 per RESERVE_EVERY seconds
const RESERVE_START = 20, RESERVE_EVERY = 6, RESERVE_MAX = 30;
const FAC_Y = { inf: 80, aa: 240, tank: 400, air: 560 };
const REPORT_EVERY = 6, MARK_LIFE = 4;
// orders travel from HQ: BASE seconds + distance / SPEED, capped
const ORDER_DELAY_BASE = 1, ORDER_SPEED = 150, ORDER_DELAY_MAX = 8;
// a squad under pressure calls HQ for a decision; unanswered calls are decided by its commander's temper
const CALL_TIME = 10, CALL_COOLDOWN = 45, CALL_BAND = 0.15, FIRM_TIME = 20, FIRM_BONUS = 0.15, HIST_EVERY = 3;
const TEMPERS = {
  bold:    { name: 'נועז', icon: '🦁', report: 1.4,  rosy: 0.15,  retreat: -0.05 },
  steady:  { name: 'שקול', icon: '🦉', report: 1,    rosy: 0,     retreat: 0 },
  anxious: { name: 'חרד',  icon: '🐇', report: 0.75, rosy: -0.1,  retreat: 0.05 },
};
const SURNAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'אזולאי', 'דהן', 'שפירא'];
const EYE_R = 110, EYE_TIME = 8, EYE_EVERY = 25, EYE_START = 1, EYE_MAX = 2;
const SUPPORT_MAX = 30, CONTACT_MEMORY = 2, INITIATIVE_EVERY = 1.5, SUPPORT_R = 90;

// difficulty: how often the enemy re-plans and how much it thinks about matchups
const DIFFS = {
  easy:   { name: 'קל',   every: 12, smart: false, traits: false },
  normal: { name: 'רגיל', every: 8,  smart: true,  traits: false },
  hard:   { name: 'קשה',  every: 5,  smart: true,  traits: true },
};
const AI_NEAR = 170, AI_KEEP = 60, FIRE_REVEAL = 1, POINT_SIGHT = 2.5, MEMORY = 20;
