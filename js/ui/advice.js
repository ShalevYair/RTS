// The explanations while playing (advisor.js): every line — its id (the recording's file name: Speak/<English|Hebrew>/
// Instructions/<id>.mp3), Hebrew (the caption in Hebrew) and English (the caption in English, and for now the browser's voice
// in both). Some lines are made from the game's data (what needs what, what opens, which arms are yours), so the list
// stays right when a building changes. `node tools/advice_list.js` writes the whole list to Speak/Advice_lines.md.
// (plain data and functions — no DOM: the tool loads it in Node)

// the arms, as said in a sentence
const ADV_ARM = { armor: ['השריון', 'the armour'], infantry: ['חיל הרגלים', 'the infantry'], air: ['חיל האוויר', 'the air force'], guns: ['התותחנים וההנדסה', 'artillery and engineering'] };
// the supply chain, in the order it's taught (with engineering yours): [building, the deposit it stands on]
const ADV_STEPS = [['quarry', 'lime'], ['concrete'], ['oilwell', 'oil'], ['refinery'], ['fuelst'], ['ironmine', 'iron'], ['steelmill'], ['farm', 'farm'], ['kitchen'], ['waterst'], ['chemplant'], ['depot'], ['bauxmine', 'bauxite'], ['smelter'], ['hitech']];
// [id, Hebrew, English] — the ones written by hand
const ADV_FIXED = [
  // the opening — the game running
  ['intro_goal', 'המטרה: להשמיד את מפקדת האויב, או כמעט את כל הצבא שלו.', 'Your goal: destroy the enemy headquarters, or nearly all of its army.'],
  ['intro_mate', 'להבדיל ממשחקי אסטרטגיה אחרים, כאן משחקים עם שותף ששולט איתכם באותו צבא ממש. כל אחד מכם אחראי על חילות אחרים.', 'Unlike other strategy games, here you play with a partner who commands the very same army with you. Each of you is in charge of different arms.'],
  ['intro_supply', 'בנוסף, צריך לנהל את שרשרת האספקה. למשל, בלי דלק הכוחות לא זזים, ובלי תחמושת הם לא יורים.', 'You also have to run the supply chain. Without fuel, your forces cannot move, and without ammunition they cannot fire.'],
  ['intro_off', 'אם תרצו לכבות את ההסברים, זה בגלגל השיניים בפינה למטה.', 'To turn these explanations off, use the gear in the bottom corner.'],
  ['hq_me', 'קודם כול, בחרו איפה להקים את המפקדה, ברצועה הירוקה בצד שלכם. הטרקטור ייסע לשם ויבנה אותה.', 'First, choose where to set up your headquarters, in the green strip on your side. The bulldozer will drive there and build it.'],
  ['hq_mate', 'השותף שלכם מקים את המפקדה ואת שרשרת האספקה. הטרקטורים אצלו.', 'Your partner sets up the headquarters and the supply chain. The bulldozers are his.'],
  ['hq_ready', 'המפקדה עומדת. המשחק בנוי על משאבים, וכל דבר מתחיל במרבץ על המפה.', 'The headquarters is up. This game runs on resources, and everything starts at a deposit on the map.'],
  // the supply chain, one step at a time (engineering yours)
  ['step_quarry', 'הקימו מחצבה על מרבץ המלט: האבנים הלבנות על המפה.', 'Build a quarry on the lime deposit: the white stones on the map.'],
  ['step_concrete', 'עכשיו מפעל בטון. בלי בטון אי אפשר לבנות שום מבנה.', 'Now a concrete plant. Without concrete, nothing can be built.'],
  ['con_ready', 'יש בטון. אפשר לבנות אוהלים ומבנים בסיסיים.', 'Concrete is flowing. Tents and the basic buildings are open.'],
  ['step_oilwell', 'הקימו קידוח נפט על השלוליות השחורות. מהנפט עושים את הדלק של כל הרכבים.', 'Drill an oil well on the black pools. Oil becomes the fuel for every vehicle.'],
  ['step_refinery', 'בית זיקוק הופך את הנפט לדלק ולגומי.', 'A refinery turns the oil into fuel and rubber.'],
  ['step_fuelst', 'תחנת דלק שולחת משאיות דלק לכוחות. בלעדיה הרכבים נעצרים.', 'A fuel station sends fuel trucks to your forces. Without it, vehicles stop.'],
  ['step_ironmine', 'הקימו מכרה ברזל על האבנים האדומות.', 'Build an iron mine on the red stones.'],
  ['step_steelmill', 'מפעל פלדה הופך את עפרות הברזל לפלדה, ופלדה פותחת את הסדנאות.', 'A steel mill turns the iron ore into steel, and steel opens the workshops.'],
  ['step_farm', 'הקימו חווה על השדות הזהובים. החיילים אוכלים מנות קרב.', 'Build a farm on the golden fields. Soldiers eat field rations.'],
  ['step_kitchen', 'מטבח שדה הופך את התבואה למנות קרב.', 'A field kitchen turns the grain into rations.'],
  ['step_waterst', 'מחסן מנות קרב שולח משאיות אוכל לחיילים בשטח.', 'A rations depot sends food trucks to the soldiers in the field.'],
  ['step_chemplant', 'מפעל כימיקלים הופך דלק לחומר נפץ, בשביל תחמושת.', 'A chemical plant turns fuel into explosives, for ammunition.'],
  ['step_depot', 'מחסן תחמושת שולח משאיות תחמושת לכוחות.', 'An ammunition depot sends ammo trucks to your forces.'],
  ['step_bauxmine', 'הקימו מכרה בוקסיט על האדמה הכתומה, בשביל אלומיניום.', 'Build a bauxite mine on the orange earth, for aluminium.'],
  ['step_smelter', 'מפעל אלומיניום. בלי אלומיניום אין מטוסים ומסוקים.', 'An aluminium smelter. Without aluminium there are no planes or helicopters.'],
  ['step_hitech', 'מרכז הייטק ומעבדת אלקטרוניקה פותחים טילים, חץ, כיפת ברזל ורחפנים.', 'A hi-tech centre and an electronics lab open missiles, Arrow, Iron Dome and drones.'],
  // the supply chain is the partner's: what you wait for (your first arm)
  ['matechain_armor', 'השותף בונה את שרשרת האספקה. כשתהיה פלדה, תוכלו להקים סדנת טנקים.', 'Your partner builds the supply chain. Once there is steel, you can set up a tank workshop.'],
  ['matechain_infantry', 'השותף בונה את שרשרת האספקה. כשיהיה בטון, תוכלו להקים אוהלים לחיילים.', 'Your partner builds the supply chain. Once there is concrete, you can set up tents for soldiers.'],
  ['matechain_air', 'השותף בונה את שרשרת האספקה. כשיהיה אלומיניום, תוכלו להקים שדה תעופה.', 'Your partner builds the supply chain. Once there is aluminium, you can set up an airfield.'],
  // why not — the first time each
  ['why_nohq_me', 'קודם צריך מפקדה. לחצו על המגדל בפינה למטה ובחרו מקום ברצועה הירוקה.', 'You need a headquarters first. Click the tower in the bottom corner and pick a spot in the green strip.'],
  ['why_nohq_mate', 'עוד אין מפקדה. השותף מקים אותה, ואפשר לבנות ברגע שהיא עומדת.', 'There is no headquarters yet. Your partner is setting it up, and you can build as soon as it stands.'],
  ['why_con_me', 'קודם צריך מפעל בטון. כל מבנה צריך בטון.', 'You need a concrete plant first. Every building needs concrete.'],
  ['why_con_mate', 'קודם צריך מפעל בטון, וכל מבנה צריך בטון. את זה בונה השותף.', 'A concrete plant comes first, and every building needs concrete. Your partner builds that.'],
  ['why_limit', 'אין מקום לעוד מבנה. פיקוד קדמי פותח עוד מקום ועוד שטח.', 'There is no room for another building. A forward headquarters opens more room and more ground.'],
  ['why_deposit', 'מכרה נבנה רק על מרבץ פנוי מהסוג שלו. המרבצים המתאימים מסומנים בטבעת ירוקה.', 'A mine goes only on a free deposit of its kind. The right deposits are ringed in green.'],
  ['why_band', 'את המפקדה מקימים רק ברצועה הירוקה בצד שלכם.', 'The headquarters goes only in the green strip on your side.'],
  ['why_q', 'השליטה כאן חלשה מדי לבנייה. בונים קרוב למפקדה או לפיקוד קדמי.', 'Control is too weak to build here. Build close to the headquarters or a forward headquarters.'],
  ['why_gap', 'קרוב מדי למבנה אחר. צריך להשאיר מקום לטרקטור.', 'Too close to another building. Leave room for the bulldozer.'],
  ['tech', 'מה מוביל למה רואים בעץ הטכנולוגיה, בגלגל השיניים או במקש K.', 'To see what leads to what, open the tech tree: in the gear menu, or press K.'],
  // what's new, when it's of use
  ['f_select', 'לחיצה על כוח בוחרת אותו, ולחיצה על המפה שולחת אותו לשם. גרירה בוחרת כמה כוחות.', 'Click a unit to select it, then click the map to send it there. Drag to select several.'],
  ['f_fronts', 'במקום להזיז כל כוח, סמנו חזית: לחצו על הדגל וגררו קו על המפה. הצבא שלכם ושל השותף יתחלק בין החזיתות. קליק ימני על קו מבטל אותו.', 'Instead of moving every unit, mark a front: click the flag and drag a line on the map. Your army and your partner\'s will spread along the fronts. Right-click a line to remove it.'],
  ['f_fhq', 'נגמר המקום לבנייה. פיקוד קדמי מגדיל את השטח ואת המכסה. הכפתור למטה משמאל.', 'You are out of building room. A forward headquarters adds ground and room. The button is at the bottom left.'],
  ['f_drone', 'יש רחפן מוכן. לחצו עליו ואז על המפה. הוא רואה רחוק.', 'A drone is ready. Click it, then the map. It sees far.'],
  ['f_dry', 'לכוח נגמר דלק או אוכל. נורה צהובה היא דלק, טיפה היא מנות קרב. המשאיות באות אליו מתחנת הדלק וממחסן המנות.', 'A unit has run out of fuel or food. A yellow light is fuel, a drop is rations. Trucks come to it from the fuel station and the rations depot.'],
  ['f_post', 'על המפה יש מבנים ניטרליים, כמו רדאר ותחנת כוח. חייל שנכנס לאחד כובש אותו, והוא נותן יתרון.', 'There are neutral buildings on the map, like a radar or a power plant. A soldier who walks into one captures it, and it gives you an edge.'],
  ['f_wheel', 'Alt ולחיצה על המפה פותחים גלגל: מזמנים כוחות, ומבקשים מהשותף דלק, תחמושת או הפגזה.', 'Alt and click on the map opens a wheel: summon forces, and ask your partner for fuel, ammunition or a barrage.'],
  ['f_night', 'יורד לילה. בחושך רואים ויורים פחות טוב.', 'Night is falling. In the dark, everyone sees and shoots worse.'],
  ['f_weather', 'מזג האוויר מקצר את הראייה ואת הטווח.', 'The weather shortens sight and range.'],
  ['f_missile', 'שיגור טיל! כיפת ברזל וחץ מיירטים טילים.', 'Missile launch! Iron Dome and Arrow intercept missiles.'],
  ['f_ghost', 'כוח שיוצא מטווח הראייה של משאית קשר, רחפן, ג׳יפ סיור או מבנה שלנו נראה כמו רוח רפאים: המיקום שלו רק מוערך, לפי הדיווח האחרון. לוקח זמן עד שפקודה מגיעה אליו, והיא לא תמיד מבוצעת בדיוק.', 'A unit out of sight of a signals truck, a drone, a recon jeep or one of our buildings shows as a ghost: where it is is only a guess, from its last report. Orders take a while to reach it, and are not always carried out exactly.'],
  ['f_hqhit', 'המפקדה תחת התקפה. אם היא נופלת, הפסדתם.', 'Your headquarters is under attack. If it falls, you lose.'],
];
// the lines made from the game's data: which arms are yours, what needs what, what opens
function adviceLines(Sim, EN) {
  const jh = l => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' ו' + l[l.length - 1], je = l => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]; // (a, b and c)
  const L = {}, he = k => Sim.STRUCTS[k].name, lc = t => /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t, en = k => lc(EN[k] || k), an = t => (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t;
  for (const [id, h, e] of ADV_FIXED) L[id] = { he: h, en: e };
  // (your two arms, and the partner's two)
  const A = Object.keys(ADV_ARM);
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const o = A.filter(k => k !== A[i] && k !== A[j]);
    L[`arms_${A[i]}_${A[j]}`] = { he: `אתם מפקדים על ${ADV_ARM[A[i]][0]} ועל ${ADV_ARM[A[j]][0]}, והשותף על ${ADV_ARM[o[0]][0]} ועל ${ADV_ARM[o[1]][0]}.`, en: `You command ${ADV_ARM[A[i]][1]} and ${ADV_ARM[A[j]][1]}. Your partner commands ${ADV_ARM[o[0]][1]} and ${ADV_ARM[o[1]][1]}.` };
  }
  // (what a building needs first — and what that needs; the concrete plant aside: every building needs it, why_con)
  // (what it needs besides concrete — and, making something that burns fuel, a fuel station: as needsOf in econ.js)
  const own = k => { const S = Sim.STRUCTS[k], l = (Sim.NEEDS[k] || []).filter(n => n !== 'concrete'); if (S && S.unit && Sim.needsFuel(S.unit) && !l.includes('fuelst')) l.push('fuelst'); return l; };
  for (const k of Object.keys(Sim.STRUCTS)) {
    const d = own(k); if (!d.length || !Sim.STRUCTS[k]) continue;
    let h = `ל${he(k)} צריך קודם ${jh(d.map(he))}.`, e = `The ${en(k)} needs ${je(d.map(n => an(en(n))))} first.`;
    for (const n of d) { const dd = own(n).filter(m => !d.includes(m)); if (dd.length) { h += ` ל${he(n)} צריך ${jh(dd.map(he))}.`; e += ` The ${en(n)} needs ${je(dd.map(m => an(en(m))))}.`; } }
    L['need_' + k] = { he: h, en: e };
    L['needm_' + k] = { he: h + ' את זה בונה השותף.', en: e + ' Your partner builds that.' };
  }
  // (a fighting building whose way just opened)
  for (const k of Object.keys(Sim.STRUCTS)) if (Sim.STRUCTS[k].unit && !Sim.STRUCTS[k].econ && own(k).length) L['open_' + k] = { he: `אפשר עכשיו לבנות ${he(k)}.`, en: `You can now build ${an(en(k))}.` };
  return L;
}
if (typeof module === 'object') module.exports = { adviceLines, ADV_STEPS, ADV_ARM };
