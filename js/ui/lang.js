// UI: language (עברית / English). Every word on screen comes from STR by key: static elements say which key with
// data-t (text), data-al (aria-label) and data-tip (the short tooltip); the scripts call tr(key, …args).
let lang = 'he';
try { const l = localStorage.getItem('irts-lang'); if (l === 'he' || l === 'en') lang = l; } catch (e) { /* storage unavailable */ }
const EN_TYPES = { how: '200 mm guns', mlrs: 'MLRS', inf: 'Infantry', tank: 'Tanks', air: 'Aircraft', tanker: 'Tankers', aa: 'Anti-air', at: 'Anti-tank', jeep: 'Recon jeeps', ajeep: 'AA jeeps', tjeep: 'AT jeeps', med: 'Medics', mech: 'Mechanics', truck: 'Ammunition trucks', fueltruck: 'Fuel trucks', watertruck: 'Ration trucks', dozer: 'Bulldozers', radio: 'Signals trucks' , heli: 'Attack helicopters', gunship: 'Gunships', lift: 'Transport helicopters', ssm: 'Missile trucks', arrow: 'Arrow trucks', dome: 'Iron Dome trucks', commando: 'Commandos', oiltruck: 'Oil tankers', oretruck: 'Ore trucks', cementtruck: 'Cement mixers' , bauxtruck: 'Bauxite trucks', graintruck: 'Grain trucks' };
const EN_STRUCTS = { howshop: '200 mm gun works', mlrsshop: 'MLRS works', tankerbase: 'Tanker base', fuelst: 'Fuel station', waterst: 'Rations depot', hq: 'HQ', fhq: 'Forward HQ', drone: 'Drone', tent: 'Tent', aapost: 'AA tent', atpost: 'AT tent', decoy: 'Fake HQ', jeepshop: 'Jeep workshop', jeepaa: 'AA jeep workshop', jeepat: 'AT jeep workshop', tankshop: 'Tank workshop', airfield: 'Airfield', heliatk: 'Attack helipad', heligun: 'Gunship helipad', helilift: 'Transport helipad', ssmshop: 'Missile works', arrowsite: 'Arrow site', domesite: 'Iron Dome site', commandopost: 'Commando base', clinic: 'Medic tent', garage: 'Garage', depot: 'Ammunition depot', quarry: 'Cement quarry', concrete: 'Concrete plant', oilwell: 'Oil well', refinery: 'Refinery', ironmine: 'Iron mine', steelmill: 'Steel mill', farm: 'Farm', kitchen: 'Field kitchen', bauxmine: 'Bauxite mine', smelter: 'Aluminium smelter', chemplant: 'Chemical plant', hitech: 'Hi-tech centre', elab: 'Electronics lab' };
const EN_POSTS = { radar: 'Radar', power: 'Power station', fuel: 'Fuel station', supply: 'Ammunition depot', hospital: 'Hospital', motorpool: 'Motor pool', tower: 'Observation tower', antenna: 'Signals antenna', bunker: 'Bunker' , lab: 'Research institute'};
const EN_NAMES = { 'כהן': 'Cohen', 'לוי': 'Levi', 'מזרחי': 'Mizrahi', 'פרץ': 'Peretz', 'ביטון': 'Biton', 'אברהם': 'Avraham', 'פרידמן': 'Friedman', 'אזולאי': 'Azoulay', 'דהן': 'Dahan', 'שפירא': 'Shapira' };
const EN_DIFFS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const EN_STYLES = { steady: 'Regular', missile: 'Missile commander', tanks: 'Armour commander', infantry: 'Infantry commander', vehicles: 'Light vehicles commander', air: 'Air force commander', commando: 'Commando commander' };
const tn = type => lang === 'en' ? EN_TYPES[type] : Sim.TYPES[type].name;
const sn = kind => lang === 'en' ? EN_STRUCTS[kind] : Sim.STRUCTS[kind].name;
const bossName = b => lang === 'en' ? EN_NAMES[b] || b : b;
const diffName = d => lang === 'en' ? EN_DIFFS[d] : Sim.DIFFS[d].name;
const styleName = k => lang === 'en' ? EN_STYLES[k] : Sim.AI_STYLES[k].name;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const STR = {
  he: {
    title: 'המפקד', map: 'מפת הקרב', mini: 'מפה קטנה: לחץ כדי להסתכל שם', compass: 'מצפן: לחיצה מחזירה את המצלמה לצפון (גרירה בכפתור האמצעי מסובבת)',
    power: n => `העוצמה שלך מתוך כל הכוחות במפה. מתחת ל-${n}% — הפסד`, slots: 'מבנים: בנויים / מכסה. כל 🏕️ מוסיף 2', boost: 'הצד החלש מייצר מהר יותר',
    hold: 'להחזיק', attack: 'לתקוף', retreat: 'לסגת', move: 'רק לנוע', moveOn: 'תנועה בלבד (M): נוסעים בלי לעצור לקרב', moveOff: 'לתקוף (A)', followOn: 'מצלמה אחרי היחידה (C או Esc ליציאה)', followOff: 'מצלמה רגילה',
    quit: 'יציאה', quitDone: 'המשחק נסגר. אפשר לסגור את הלשונית.', tipScore: 'ניקוד: כמה השמיד כל צד מהשני (חייל 100, ג׳יפ 250, טנק 500, מבנה 1000, המפקדה 5000). לא מכריע את המשחק.', tipHold: 'להחזיק (Q): ללכת למקום ולהגן עליו', tipAttack: 'לתקוף (A): לתפוס את האזור ולרדוף אחרי האויב', tipRetreat: 'לסגת (R): הביתה, להתרפא ולהתמלא',
    gfx: 'גרפיקה', gfxHi: 'רגילה', gfxLow: 'נמוכה', tipGfxHi: 'צללים, יום ולילה, גשם וערפל', tipGfxLow: 'מהיר יותר: בלי צללים, בלי יום ולילה, גשם וערפל (מהמשחק הבא), קרקע פשוטה',
    play: 'המשך (רווח)', fsName: 'מסך מלא', gear: 'הגדרות', fs: 'מסך מלא (F)', sqT: 'הכוחות', all: 'כל הכוחות יחד, במבנה (0)',
    eye: 'רחפן (D): לחץ ואז על מקום במפה', bld: 'בנייה (G): מבנים / מכסה', fhq: 'פיקוד קדמי (B): לחץ ואז על מקום במפה',
    speed: 'מהירות', slow: 'איטי', normalRate: 'רגיל', fast: 'מהיר', music: 'מוזיקה', vol: 'עוצמת מוזיקה', radio: 'קשר', tipRadio: 'דיווחי קשר בקול',
    sfx: 'פיצוצים', sfxVol: 'עוצמת פיצוצים', language: 'שפה', help: '❔ הדרכה', tipHelp: 'סיור קצר בכפתורים',
    home: '🏠 שלבים', tipHome: 'חזרה למסך השלבים', restart: '↻ משחק חדש', tipRestart: 'להתחיל מחדש',
    fog: 'ערפל', on: 'פעיל', off: 'כבוי', mapSize: 'מפה', big: 'גדולה', small: 'קטנה', huge: 'ענקית', diff: 'קושי', foeStyle: 'אויב', foe_random: 'אקראי: מפקד אחר בכל משחק', foe_steady: 'רגיל: כל סוגי הכוחות (בקושי "קשה" — כל היכולות יחד)', foe_missile: 'מפקד הטילים: מעט כוחות בבית והרבה טילי קרקע-קרקע על המבנים שלך', foe_tanks: 'מפקד השריון: כמעט רק טנקים, ואוהל נ"מ', foe_infantry: 'מפקד חיל הרגלים: חיילים מכל הסוגים', foe_vehicles: 'מפקד הרכבים הקלים: ג׳יפים מכל הסוגים', foe_air: 'מפקד חיל האוויר: מטוסים, מטוסי תדלוק ומסוקים, והרבה נ"מ בבית', mate: 'שותף', askNone: 'אין מה לזמן לכאן', askOff: 'בוטל', takeIt: '🚩 לכבוש', takeTip: 'החייל הקרוב יוצא לכבוש את המבנה', takeNone: 'אין אפילו חייל אחד בצבא לכבישת המבנה', sum_forces: 'כוחות', sum_supply: 'אספקה', sum_jeeps: 'ג׳יפים', sum_foot: 'חיילים', sum_planes: 'מטוסים', sum_helis: 'מסוקים', sum_guns: 'תותחים', sum_rockets: 'טילים', sum_carers: 'חובשים ומכונאים', rep1_fuel: t => `${t}: חסר לנו דלק`, rep1_water: t => `${t}: נגמרים לנו המים`, rep1_ammo: t => `${t}: חסרה לנו תחמושת`, rep1_hurt: t => `${t}: יש לנו פצועים, צריך טיפול`, repN_fuel: (n, t) => `${n} מה${t} בלי דלק`, repN_water: (n, t) => `${n} מה${t} בלי מים`, repN_ammo: (n, t) => `${n} מה${t} בלי תחמושת`, repN_hurt: (n, t) => `${n} מה${t} פצועים`, sum_eyes: 'עיניים: משאית קשר, ג׳יפ סיור ורחפן — לראות מה קורה שם', sum_care: 'טיפול: חובש, מכונאי ומשאית דלק, תחמושת ומים', etaS: t => `~${t} ש׳`, etaM: t => `~${t} דק׳`, sum_fuel: 'משאיות דלק', sum_ammo: 'משאיות תחמושת', sum_water: 'משאיות מנות קרב', sum_fire: 'הפגזה כאן: התותחים, המטוסים והמסוקים של השותף יורים על הנקודה', sum_build: 'לבנות את זה קודם (טרקטור של השותף)', sumBusy: n => `${n} בקרב — יבואו כשיסיים`, sumSent: (t, n) => `זימון: ${t} ×${n}`, askOk: 'בדרך', askNo: 'אין לנו', ic_ours: 'שלנו', ic_attack: 'תוקף', ic_hold: 'מחזיק', ic_back: 'נסוג', ic_fight: 'בקרב', askMake: t => `אין לנו עדיין — בונים ${t}, ואז נשלח`, askMine: t => `ביקשת: ${t}`, askMate: t => `השותף מבקש: ${t}`, ask_fuel: 'דלק כאן', ask_ammo: 'תחמושת כאן', ask_water: 'מנות קרב כאן', ask_fire: 'אש כאן', ask_lift: 'איסוף כאן', ask_guard: 'הגנה כאן', ask_build: 'לבנות את זה קודם', ask_radio: 'משאית קשר כאן (ראייה)', tipAsk: 'Alt+לחיצה: לזמן לכאן כוחות ואספקה, או לבקש מהשותף', noSsmHq: 'אי אפשר לשגר טיל על המפקדה', armsRow: 'זרועות', arms_tip: 'שתי הזרועות שלך — השותף הממוחשב מקבל את השתיים האחרות', arm_armor: 'שריון: טנקים, ג׳יפים, מוסך', arm_infantry: 'חיל רגלים: חיילים, נ"ט, נ"מ, קומנדו, חובשים', arm_air: 'חיל האוויר: מטוסים, מתדלקים, מסוקים, כיפת ברזל, חץ', arm_guns: 'תותחנים והנדסה: תותחים, טילים, טרקטורים, משאיות קשר ואספקה, רחפנים', armN_armor: 'שריון', armN_infantry: 'חיל רגלים', armN_air: 'חיל האוויר', armN_guns: 'תותחנים והנדסה', foe_commando: 'מפקד הקומנדו: מסוקים מנחיתים קומנדו מאחורי הקווים שלך ומפוצצים מבנים',
    tipFogOn: 'רואים רק מה שהכוחות רואים', tipFogOff: 'רואים הכל', tipBig: 'מפה גדולה, עם גלילה', tipSmall: 'כל המפה במסך', tipHuge: 'מפה ענקית, פי 4 מהגדולה: משחק ארוך',
    go: 'התחל', menuSub: 'THE COMMANDER', campaign: 'מערכה', playGame: 'התחל משחק', learn: 'לימוד', learnNote: 'בחר שלב: כל שלב מוסיף דבר אחד.', wiki: 'הדרכה', more: 'הגדרות נוספות', mainScreen: '🏠 מסך ראשי', saveGame: '💾 שמור משחק', tipSave: 'שומר את המשחק — אפשר להמשיך אותו מהמסך הראשי. נשמר גם לבד כל 3 דקות וביציאה.', saved: 'המשחק נשמר', saveFail: 'השמירה נכשלה', resume: '▶ המשך משחק שמור', resumeT: (m, ago) => `דקה ${m} · ${ago}`, agoMin: n => n < 1 ? 'עכשיו' : n < 60 ? `לפני ${n} דק׳` : n < 1440 ? `לפני ${Math.round(n / 60)} שע׳` : `לפני ${Math.round(n / 1440)} ימים`, sureHome: 'לצאת מהמשחק?', yes: 'כן', no: 'לא', back: 'חזרה', close: 'סגור', turn: 'סובב את הטלפון לרוחב', level: n => `שלב ${n}`, full: 'משחק מלא',
    again: 'שוב', share: 'שתף 🔗', copied: 'הועתק ✓', levels: '🏠 שלבים',
    replay: 'שחזור: מה ידעת מול מה קרה', replayT: 'זמן בשחזור', replayKey: '● מה קרה באמת · ○ מה ידעת',
    endStats: (err, n, d, off, a, m, ff, un) => `טעות בתמונה: ${err} · פקודות: ${n}, בדרך ${d} ש׳, סטייה ${off}, לא ברורות ${un} · שיחות: ענית ${a}, החליטו לבד ${m} · ⚠ ירי על כוחותינו: ${ff}`,
    decoyItem: n => `פיתיון · עד ${n}, בלי מכסה`, b_decoy: 'מפקדה מזויפת: בערפל האויב חושב שזו המפקדה שלך ותוקף אותה',
    road: 'כביש', tipRoad: 'כביש: לחץ על נקודת ההתחלה ואז על הסוף — טרקטור סולל אותו. כולם נוסעים בו מהר ב-10%, גם על בוץ. Shift = עוד קטע מהסוף', roadReady: 'הכביש מוכן',
    front: 'חזית', tipFront: 'חזיתות: לחץ ואז גרור קו על המפה (ישר או עקום), עד 3 — כל הצבא, שלך ושל השותף, מתחלק ביניהן לפי כוח ועומד לאורכן. קליק ימני על קו מבטל אותו', frontMax: n => `אפשר עד ${n} חזיתות — קליק ימני על קו מבטל אותו`, frontShort: 'הקו קצר מדי', frontContact: n => `חזית ${n}: מגע עם האויב`, frontPress: (n, k) => `חזית ${n} בלחץ — איבדנו ${k}`, frontReady: n => `חזית ${n} בעמדות`, frontOff: 'החזית הוסרה', frontHow: 'גרור קו על המפה כדי לסמן חזית', hqb: 'מפקדה', tipHqb: 'הקמת המפקדה: בחר מקום ברצועה שלך, והטנקים ייסעו להקים אותה',
    tipSilent: 'שקט אלחוטי (S): הכוח לא מדווח, נע לאט ובלי אבק, והאויב לא שומע אותו', silentOn: 'בשקט אלחוטי', silentOff: 'בקשר',
    tipNight: 'לילה: רואים פחות, יורים פחות רחוק ופוגעים פחות; הפקודות איטיות',
    shareText: (won, time, d) => `${won ? 'ניצחתי' : 'הפסדתי'} אחרי ${time} ברמה ${d} ב"המפקד". נסה לנצח:`,
    call: (boss, name) => `📞 סרן ${boss} (${name}): לחץ כבד. להחזיק או לסגת?`,
    sqTip: (name, boss, home) => `${name} · סרן ${boss}${home ? '' : ' · בלי מבנה, בלי תגבורת'}`,
    buildItem: (sec, unit) => `${unit} · כל ${sec} ש׳`, needsItem: k => `צריך קודם: ${k}`, needsWhy: k => `צריך קודם ${k}`, mineItem: unit => `${unit} — הובלה למפעל`, plantItem: good => `מייצר ${good} למלאי`,
    good_fuel: 'דלק', good_steel: 'פלדה', good_concrete: 'בטון', good_rubber: 'גומי', good_rations: 'מנות קרב', good_alu: 'אלומיניום', good_explosives: 'חומר נפץ', good_electronics: 'אלקטרוניקה', dep_oil: 'שדה נפט', dep_iron: 'מרבץ ברזל', dep_lime: 'מרבץ מלט', dep_farm: 'שדות', dep_bauxite: 'מרבץ בוקסיט', waitGood: g => `מחכה ל${g}`, noBurn: 'אין דלק לכבשן', depFree: 'פנוי — אפשר לבנות עליו', depTaken: 'תפוס', depLeft: (n, p) => `נשארו ${n} (${p}%)`, depDry: 'נגמר',
    techTitle: 'עץ הטכנולוגיה', techHint: 'מה צריך לבנות כדי להגיע לכל דבר. מעומעם = עוד לא אפשר; ירוק = אפשר עכשיו; ✓ = בנוי. לחיצה על מה שאפשר — להנחה.', techC1: 'מקורות', techC2: 'מפעלים', techC3: 'שירות', techC4: 'ייצור', techVeh: 'כל הרכבים וכלי הטיס', techForces: 'כל הכוחות', techAll: 'כל המבנים', techLab: 'מאפשר מעבדה', techDone: 'בנוי', techCan: 'אפשר לבנות עכשיו', techMate: 'השותף בונה את זה', tech: '', stockTip: l => 'מלאי: ' + l + ' · לחיצה — עץ הטכנולוגיה (K)', stockLow: 'כמעט נגמר', techShort: 'עץ טכנולוגיה', techBtnTip: 'עץ הטכנולוגיה (K): מה צריך לבנות כדי להגיע לכל מבנה',
    gt_concrete: 'מחצבת מלט ← מפעל בטון. כל אתר בנייה צורך בטון כשהטרקטור עובד עליו.',
    gt_fuel: 'קידוח נפט ← בית זיקוק. ממלא את משאיות הדלק של כל הרכבים וכלי הטיס, וגם הכבשן של מפעל האלומיניום ומפעל הכימיקלים שורפים ממנו.',
    gt_steel: 'מכרה ברזל ← מפעל פלדה. טנקים, ג׳יפים, תותחים, משאיות טילים ומכונאים; ומשאיות התחמושת מתמלאות בו.',
    gt_rubber: 'יוצא מבית הזיקוק יחד עם הדלק. ג׳יפים, משאיות ומכונאים.',
    gt_rations: 'חווה ← מטבח שדה. כל חייל עולה מנות; משאיות המנות ומחסן מנות הקרב מאכילים את החיילים בשטח.',
    gt_alu: 'מכרה בוקסיט ← מפעל אלומיניום (שורף דלק). שדות תעופה, מנחתים, וכל מטוס ומסוק.',
    gt_explosives: 'מפעל כימיקלים — הופך דלק לחומר נפץ. חיילי נ״ט ונ״מ, קומנדו, תותחים ו-MLRS; ומשאיות התחמושת.',
    gt_electronics: 'מרכז הייטק ← מעבדת אלקטרוניקה (פי 2 כשמחזיקים את מכון המחקר). משאיות טילים, חץ, כיפת ברזל ורחפנים.', waitSteel: 'מחכה לפלדה', waitCon: 'ממתין לבטון', noStockFuel: 'אין דלק במלאי — צריך קידוח נפט ובית זיקוק',
    bp_industry: 'תעשייה', bpn_industry: 'מלט ← בטון, ברזל ← פלדה, בוקסיט ← אלומיניום — לפי הסדר, מחוץ למכסה', bp_energy: 'דלק ומזון', bpn_energy: 'נפט ← דלק וגומי, דלק ← חומר נפץ, שדות ← מנות קרב — מחוץ למכסה',
    b_quarry: 'מחצבה על מרבץ מלט: מערבלים מובילים מלט למפעל הבטון', b_concrete: 'מפעל בטון: כל המבנים צריכים אותו, והבנייה צורכת בטון', b_oilwell: 'קידוח על שדה נפט: מכליות מובילות נפט לבית הזיקוק', b_refinery: 'בית זיקוק: נפט ← דלק. תחנות הדלק צריכות אותו', b_ironmine: 'מכרה על מרבץ ברזל: משאיות מובילות עפרה למפעל הפלדה', b_steelmill: 'מפעל פלדה: עפרה ← פלדה. הסדנאות צריכות אותו, וכל טנק/ג׳יפ/תותח צורך פלדה', b_farm: 'חווה על שדות: משאיות מובילות תבואה למטבח השדה', b_kitchen: 'מטבח שדה: תבואה ← מנות קרב. מחסן מנות הקרב צריך אותו', b_bauxmine: 'מכרה על מרבץ בוקסיט: משאיות מובילות בוקסיט למפעל האלומיניום', b_smelter: 'מפעל אלומיניום: בוקסיט ← אלומיניום (שורף דלק). שדה התעופה והמנחתים צריכים אותו, וכל כלי טיס צורך אלומיניום', b_chemplant: 'מפעל כימיקלים: דלק ← חומר נפץ. מחסן התחמושת צריך אותו', b_hitech: 'מרכז הייטק: אחד בלבד — מאפשר לבנות מעבדת אלקטרוניקה', b_elab: 'מעבדת אלקטרוניקה: אחת בלבד — מייצרת אלקטרוניקה לטילים, לחץ, לכיפת ברזל ולרחפנים (פי 2 עם מכון המחקר)', slotsLeft: n => n ? `עוד ${n} מבנים` : 'אין מקום למבנה נוסף (🏕️ פיקוד קדמי מוסיף)',
    ti_dug: 'חפור בעמדה', ti_digging: 'חופר…', victory: 'ניצחון', defeat: 'הפסד', skip: 'דלג', tipCtrlGroup: 'Ctrl+מספר: הנבחרים הופכים לקבוצה', errLogged: 'נרשמה תקלה ביומן (Ctrl+Shift+L לשמירה)', ti_hp: n => `תקינות ${n}%`, ti_ammo: n => `תחמושת ${n}%`, ti_fuel: n => `דלק ${n}%`, ti_load: n => `מטען ${n}%`, ti_water: n => `מנות קרב ${n}%`, logSaved: 'היומן נשמר: commander-log.json בתיקיית ההורדות', liteOn: 'המשחק איטי — הגרפיקה הופחתה כדי לשמור על מהירות', st_retreat: 'נסוג', st_heal: 'בטיפול', st_ammo: 'בדרך לתחמושת', st_build: 'בונה', st_idle: 'ממתין', st_fight: 'בקרב', st_move: 'בדרך', st_hold: 'מחזיק', st_silent: 'בשקט אלחוטי', foe: 'אויב',
    bp_supply: 'אספקה', bpn_supply: 'תחמושת, דלק, מים — מחוץ למכסה, עד 2 מכל אחד', bp_tents: 'אוהלים', bpn_tents: 'חי"ר, נ"ט, נ"מ, חובשים, קומנדו', bp_shops: 'סדנאות', bpn_shops: "טנקים, ג'יפים, תותחים, טילים", bp_guns: 'תותחים', bpn_guns: '200 מ"מ, MLRS', bp_defense: 'הגנה מטילים', bpn_defense: 'חץ, כיפת ברזל', bp_jeeps: "סדנת ג'יפים", bpn_jeeps: 'קל, נ"ט, נ"מ', bp_service: 'שירות', bpn_service: 'מוסך, פיתיון, הגנה', bp_air: 'תעופה', bpn_air: 'מטוסים, מסוקים', bp_helis: 'מנחת מסוקים', bpn_helis: 'קרב, מקלע, תובלה',
    placeHq: 'בחר איפה להקים את המפקדה 🏰 — ברצועה הירוקה. הטרקטור 🚜 ייסע לשם ויקים אותה.', hqWhy: { nodozer: 'אין טרקטור 🚜 שיקים אותה', band: 'רק ברצועה הירוקה בצד שלך', bad: 'אי אפשר כאן' },
    why: { short: 'קצר מדי', nodozer: 'אין טרקטור 🚜 — הוא בונה את המבנים', nohq: 'קודם מקימים את המפקדה 🏰', q: 'השליטה כאן חלשה מדי לבנייה', limit: 'המכסה מלאה — הקם 🏕️ פיקוד קדמי', gap: 'קרוב מדי למבנה אחר', bad: 'מחוץ למפה', max: 'הגעת למספר המרבי של מבנים כאלה', shore: 'מתקן מים — רק על גדת אגם', deposit: 'רק על מרבץ פנוי מהסוג שלו' },
    noVoice: 'אין קול עברי במכשיר, רק צליל קשר',
    b_tent: 'חי"ר: זול ומהיר, מחזיק שטח', b_aapost: 'נ"מ: פוגע במטוסים ורחפנים', b_jeepshop: "ג'יפים: מהירים ורואים רחוק; חזקים מול חי\"ר",
    b_atpost: 'נ"ט: חיילים עם טילים נגד טנקים ורכבים', b_jeepaa: "ג'יפי נ\"מ: מהירים, נגד מטוסים; זמן ייצור כפול", b_jeepat: "ג'יפי נ\"ט: מהירים, נגד טנקים; זמן ייצור כפול",
    b_howshop: 'תותח 200 מ"מ: יורה רחוק מאוד על מה שרואים, פגז אחד משמיד יחידה — גם טנק', b_mlrsshop: 'MLRS: מטח על שטח — חיילים וג׳יפים לא שורדים, טנקים כמעט לא נפגעים',
    b_tankshop: 'טנקים: חזקים מול רכבים, דורסים חיילים; נ"ט פוגע בהם', b_airfield: 'מטוסים: חזקים מול טנקים וג\'יפים; רק נ"מ פוגע בהם', b_heliatk: 'מסוקי קרב: טילים נגד מטוסים, מסוקים ורכבים; מרחפים במקום', b_heligun: 'מסוקי מקלע: חזקים מול חיילים; מרחפים במקום', b_commandopost: 'קומנדו: האויב לא רואה אותם (רק צמוד אליו); ירייה אחת הורגת חייל; 20 ש׳ ליד מבנה אויב — והוא מתפוצץ', b_ssmshop: 'משאיות טילי קרקע-קרקע: מבנה רגיל בפגיעה אחת, המפקדה בארבע; יורות על מבנה שראית, אחרי 10 ש׳ עמידה', b_arrowsite: 'משאיות חץ: מיירטות טילי קרקע-קרקע, טיל בדקה כל אחת', b_domesite: 'משאיות כיפת ברזל: עוצרות טילים של מטוסים, מסוקים ונ"ט באזור שלהן', b_helilift: 'מסוקי תובלה: עד 10 חיילים (גם קומנדו) — לחיצה על המסוק מעלה את הנבחרים, ואז לחיצה על המפה מורידה אותם שם',
    b_clinic: 'חובשים: מרפאים חי"ר ונ"מ', b_garage: "מכונאים: מתקנים ג'יפים וטנקים", b_fuelst: 'משאיות דלק: ממלאות רכבים סביבן', b_waterst: 'משאיות מנות קרב (אוכל ומים): לחיילים סביבן. צריך מטבח שדה', b_depot: 'משאיות תחמושת: ממלאות את הכוחות סביבן', b_tankerbase: 'מטוסי תדלוק: חגים באמצע הדרך; מטוסים שנגמר להם הדלק מתדלקים אצלם וממשיכים',
    next: 'הבא', done: 'יאללה!', skip: 'דלג',
    t_level: (n, of, hq, k, wipe) => `שלב ${n} מתוך ${of}. המטרה: ${wipe ? 'להשמיד את כל הכוחות והמבנים של האויב' : (hq ? 'להשמיד את המפקדה של האויב, או ' : '') + `להוריד את האויב מתחת ל-${k}% מהעוצמה`}. הנה מה שחדש:`,
    t_free: k => `המשחק המלא. המטרה: להשמיד את המפקדה של האויב, או להוריד את כל הצבא שלו מתחת ל-${k}%. יש כאן הכל, ועוד כמה דברים חדשים:`,
    t_keys: 'מקשים: Q להחזיק, A לתקוף, R לסגת הביתה (להתרפא). H — המפקדה, T — טרקטור.',
    h_attack: 'לחץ על האויב כדי לתקוף', h_attackT: 'לחץ על האויב כדי לתקוף', h_build: 'יש מקום לבנות — בחר סוג מבנה', h_hq: 'לחץ כאן ואז על הרצועה הירוקה',
    learned: k => `למדת: ${k}`,
    learn1: 'לשלוח כוח לתקוף', learn2: 'לבחור כוח ולשלוח אותו', learn3: 'מפקדה — להחזיק, לתקוף, לסגת', learn4: 'לבנות', learn5: 'ג׳יפים וטנקים',
    learn6: 'חובשים, מכונאים ואספקה', learn7: 'מטוסים ונ״מ', learn8: 'ערפל קרב', learn9: 'רחפנים', learn10: 'מרחק ושליטה', learn11: 'פיקוד קדמי, ולשחק במקשים',
    learn12: 'להקים מפקדה עם טרקטור', learn13: 'משאיות קשר — סיימת את הלימוד!',
    tip_front: 'חזיתות 🚩: לחץ כאן וגרור קו על המפה — כל הצבא ילך לשם, ויתחלק בין עד 3 חזיתות.',
    tip_rally: 'מבנה נבחר: לחיצה על המפה = לשם יצאו הכוחות שלו.',
    tip_care: 'נפגע ✡: לחיצה נוספת עליו שולחת אותו לטיפול עד שהוא שלם.',
    tip_group: 'Ctrl + מספר: הנבחרים נשמרים כקבוצה, והמספר לבד בוחר אותם שוב.',
    tip_ssm: 'משאית טילים: בחר אותה ולחץ על מבנה אויב שאתה מכיר. בלי מטרה היא יורה לבד על הקרוב.',
    tip_lift: 'מסוק תובלה: בחר חיילים ולחץ עליו כדי שיעלו; אחר כך בחר אותו ולחץ על המפה כדי להוריד אותם שם.',
    tip_heli: 'מסוקים מרחפים מעל מה שהם יורים בו. נ״מ פוגע בהם קשה.',
    tip_commando: 'קומנדו: האויב כמעט לא רואה אותו. 20 ש׳ ליד מבנה אויב — והמבנה מתפוצץ.',
    tip_silence: 'כוח רחוק מהמפקדה מדבר בקשר — והאויב שומע. S = שקט אלחוטי.',
    t_placeHq: 'קודם כל: בחר איפה להקים את המפקדה — איפשהו ברצועה הירוקה בצד שלך. הטרקטור 🚜 ייסע לשם ויקים אותה — וגם כל מבנה אחר, רק כשהוא עומד לידו. עד שהמפקדה קמה אין בנייה, ואם טנקי הפיקוד נופלים — הפסדת. משאית הקשר 📡 רואה רחוק; כל שתי דקות המפקדה שולחת עוד טרקטור ועוד משאית.',
    t_decoy: 'בתפריט הבנייה: 🏰🎭 מפקדה מזויפת. בערפל האויב חושב שזו המפקדה שלך ותוקף אותה.',
    t_silent: '📻 / 🤫 שקט אלחוטי לכוח שבחרת: לא מדווח, נע לאט ובלי אבק — והאויב לא שומע אותו. רכב שנוסע מהר מעלה אבק שנראה מרחוק.',
    t_night: '🌙 הלילה יורד בהדרגה: בשיא החושך כולם (גם רחפנים ומבנים) רואים 40% פחות, יורים 20% פחות רחוק ופוגעים 25% פחות, והפקודות איטיות. מפקד ששורד קרבות צובר ניסיון ⭐.',
    t_scale: k => `מפה גדולה: פי ${k} מבנים ופיקודים קדמיים.`,
    ni_build: n => `בבנייה · עוד ${n} ש׳`, ni_next: (u, n) => `${u} הבא בעוד ${n} ש׳`, ni_full: 'הכוח מלא', ni_sup: (u, n) => `${u} · בעוד ${n} ש׳`, one_dozer: 'טרקטור', one_radio: 'משאית קשר', ni_site: n => `נבנה · ${n}%`, ni_wait: n => `${n}% · ממתין לטרקטור 🚜`, hqReadyNote: 'המפקדה מוכנה! אפשר להתחיל לבנות.', fhqCan: 'אפשר להקים פיקוד קדמי 🏕️', droneCan: 'אפשר להטיס רחפן', ni_seen: n => `נראה לפני ${n} ש׳`,
    t_you: 'אתה בצבע כחול, משמאל. אתה צריך להשמיד את הצבע האדום, מימין.',
    t_hq: 'המפקדה שלך. אם היא נופלת — הפסדת (וכך גם האויב). חיילים שעומדים לידה בלי קרב מתקנים אותה, וכך כל מבנה.',
    t_power: n => `העוצמה שלך מכל הכוחות במפה. מי שיורד מתחת ל-${n}% — מפסיד. המטרה: לשבור את האויב.`,
    t_click: TOUCH ? 'לחיצה על המפה: הכוח הולך לשם ותוקף.' : 'קליק שמאלי על המפה: הכוח הולך לשם ותוקף.',
    t_play: 'ההגדרות: פתיחה עוצרת את המשחק, סגירה ממשיכה. גם רווח עוצר.',
    t_squads: 'לחיצה על כוח בוחרת אותו, ואז לחיצה על המפה שולחת רק אותו. גרירה מסמנת כמה. לחיצה כפולה = כל הכוחות מאותו סוג. קליק ימני: אף אחד; שוב: כולם.',
    t_squadsT: 'לחיצה על כוח בוחרת אותו, ואז לחיצה על המפה שולחת רק אותו. לחיצה כפולה = כל הכוחות מאותו סוג.',
    group: 'קבוצה', tipGroup: 'לאחד לקבוצה (L): נבחרים יחד ופועלים יחד', tipUngroup: 'לפרק את הקבוצה (L)',
    t_hold: 'להחזיק: ללכת למקום ולהגן עליו.', t_attack: 'לתקוף: לתפוס את האזור ולרדוף אחרי האויב שם.', t_retreat: 'לסגת: הביתה, להתרפא ולהתמלא.',
    trophy: 'מעיל רוח', trophyGo: m => `🛡️ מעיל רוח · ${m} דק׳ בלי טנקים`, trophyOn: s => `מעיל רוח: עוד ${s} ש׳`, trophyHas: 'הטנקים יוצאים עם מעיל רוח', launchAt: 'שיגור', boarded: n => `${n} על המסוק`, noRoom: 'אין מקום במסוק', packBlock: 'פריסה בקובייה', packLine: 'פריסה בשורה', razeQ: n => `האם אתה בטוח שאתה רוצה להרוס את ה${n}?`,
    t_build: 'בנייה: לחץ על סוג מבנה כאן, בחר מבנה, ואז מקום ירוק במפה. כל מבנה מוציא כוחות, אחד-אחד. כשאין עוד מקום — הסוגים מעומעמים.', t_slots: 'המספר עליו: כמה מבנים יש לך מתוך המכסה.', t_order: 'הפקודה בלחיצה על המפה: חרב = לתקוף, מגן = להחזיק. לחיצה כאן מחליפה.', tipSwitch: 'לחיצה מחליפה',
    t_vehicles: "חדש: 🔧 ג'יפים (מהירים) ו-🏭 טנקים (חזקים).",
    t_care: 'חדש: 🏥 חובשים, 🛠️ מכונאים ו-📦 משאיות תחמושת. פצועים ומי שנגמרה לו התחמושת הולכים אליהם לבד.',
    t_air: 'חדש: 🛫 מטוסים (חזקים מול רכבים) ו-📡 נ"מ — רק הוא פוגע במטוסים.',
    t_fog: soon => `${soon ? 'עוד רגע יורד ערפל: ' : 'ערפל: '}רואים רק מה שהכוחות שלך רואים. כתם אדום = איפה שהאויב נראה לאחרונה.`,
    t_eye: 'רחפן: לחץ ואז על מקום במפה. רואה סביבו עד שנ"מ מפיל אותו. אחד חדש כל דקה.',
    t_c2: 'הכחול = שליטה. רחוק מהמפקדה פקודות מגיעות באיחור ומבוצעות "בערך", ואת הכוחות שלך רואים רק בערך.',
    t_fhq: "פיקוד קדמי: לחץ ואז על מקום. ג'יפים או טנקים נוסעים ומקימים: עוד שליטה, עוד 2 מבנים, עוד שטח לבנייה.",
    t_fhqDz: 'פיקוד קדמי: לחץ ואז על מקום (דקה אחרי שהמפקדה עומדת). הוא נכנס לתור של הטרקטור: עוד שליטה, עוד 2 מבנים, עוד שטח לבנייה.',
    t_placeDz: 'עוד אין מפקדה. לחץ כאן ואז על מקום ברצועה הירוקה — הטרקטור ייסע לשם ויקים אותה.',
    t_dozer: 'הטרקטור בונה הכל (גם פיקוד קדמי), לפי הסדר שהנחת (מספר על כל אתר). הוא בונה רק כשהוא עומד ליד האתר — אם תזיז אותו, הבנייה נעצרת עד שתלחץ שוב על אתר.',
    t_radio: 'משאית הקשר רואה רחוק ונותנת שליטה סביבה. שלח אותה מאחורי הכוחות שלך.',
    t_face: TOUCH ? 'לחיצה ארוכה וגרירה = פקודה עם כיוון החזית.' : 'גרירה בכפתור הימני = פקודה עם כיוון החזית.',
    pi_free: 'של אף אחד', pi_ours: 'שלנו', pi_theirs: 'של האויב', pi_take: 'חייל שנכנס כובש (ונשאר בפנים); קומנדו כובש ויוצא',
    held_radar: 'מעניק טווח ראייה וירייה מוגדל של 10%', held_power: 'מעניקה ייצור מהיר יותר ב-10% בכל המבנים', held_fuel: 'מעניקה מהירות נסיעה גבוהה יותר ב-10% לכל הרכבים', held_lab: 'מעבדת האלקטרוניקה שלנו מייצרת פי 2 מהר', fx_lab: 'אלקטרוניקה למחזיק: טילים, חץ, כיפת ברזל ורחפנים',
    fx_radar: 'כל הכוחות של המחזיק רואים ויורים רחוק יותר ב-10%', fx_power: 'המבנים של המחזיק מייצרים מהר יותר ב-10%', fx_fuel: 'הרכבים של המחזיק נוסעים מהר יותר ב-10%',
    fx_supply: 'ממלא תחמושת סביבו', fx_hospital: 'חיילים סביבו מתרפאים מהר', fx_motorpool: 'רכבים סביבו מתוקנים מהר', fx_tower: 'רואה רחוק מאוד סביבו',
    fx_antenna: 'שליטה מלאה סביבו: פקודות מהירות ומדויקות', fx_bunker: 'עד 4 חיילים לידו חוטפים חצי נזק',
    wx_rain: '🌧 גשם: רואים, יורים ופוגעים פחות', wx_dust: '🌪 סופת אבק: רואים, יורים ופוגעים הרבה פחות — ואבק של רכבים לא מסגיר אותם', wx_fog: '🌫 ערפל בוקר בשפלה: מי שעל ההר מעליו',
    ptSaved: n => `נקודה ${n} נשמרה (Shift+${n} חוזר אליה)`, ptNone: n => `נקודה ${n} לא מוגדרת (Alt+${n} שומר)`,
    micGate: 'כדי לתת פקודות קוליות יש לאפשר שימוש במיקרופון. אחרי האישור הדפדפן ישאל פעם אחת.', micYes: 'אפשר מיקרופון', micNo: 'לא עכשיו',
    micAsk: 'מיקרופון לפקודות', mic: 'פקודה בקול', tipMic: 'פקודות בקול: לחיצה פותחת את המיקרופון (כל משפט = פקודה, למשל "טנקים לרדאר"), לחיצה נוספת סוגרת', micOk: '🎙 המיקרופון מאושר. במשחק: לחץ 🎙 ודבר.', micFile: 'המשחק נפתח מקובץ, ולכן הדפדפן שואל על המיקרופון שוב ושוב. כדי שישאל פעם אחת — פתח את המשחק דרך play.bat.',
    vListen: 'מקשיב…', vNoSR: 'הדפדפן לא תומך בזיהוי דיבור. נסה Chrome או Edge.', vNoMic: 'אין גישה למיקרופון', vNet: 'זיהוי הדיבור צריך אינטרנט', vAgain: 'לא הבנתי, חזור',
    vWho: 'מי? למשל: טנקים, כוח 2, כולם', vWhere: 'לאן? למשל: לרדאר, לנקודה 3, לשם', vNone: k => `אין ${k}`, vNoGroup: n => `אין כוח ${n}`, vNoFront: 'אין חזית',
    vGroup: n => `כוח ${n}`, vPoint: n => `נקודה ${n}`, vPicked: 'הנבחרים', vAll: 'כולם', vThere: 'לשם',
    t_posts: 'מבנים ניטרליים: רדאר, תחנת כוח ודלק, מחסנים, בתי חולים, מוסכים, מגדלי תצפית, אנטנות ובונקרים. חייל שנכנס כובש (ונשאר בפנים); חייל אויב מחזיר אותו לאף אחד, ושני — לאויב. עכבר מעל מבנה = מה הוא נותן.',
    t_weather: '🌧 גשם ו-🌫 ערפל בוקר (רק בשפלה) מורידים 20% מהראייה, מהטווח ומהפגיעה. על דרך רכבים מהירים יותר. חיילים שעומדים בשקט בין העצים כמעט לא נראים.',
    t_voice: '🎙 לחץ על 🎙 ודבר (נשאר פתוח עד לחיצה נוספת): "טנקים לרדאר", "כוח 2 לנקודה 4", "כולם לסגת". Alt+מספר שומר את המסך כנקודה, Shift+מספר קופץ אליה.',
    tip_asks: 'יש לך שותף: Alt+לחיצה על המפה = לבקש ממנו דלק, תחמושת, אש, איסוף… שם. גם הוא יבקש ממך (סימן צהוב). משולש אדום = מטרה שחיילים או רחפן מסמנים: שם מטוסים, תותחים וטילים פוגעים במלוא הכוח.',
    tip_posts: 'מבנה ניטרלי: חייל שנכנס כובש אותו. עכבר מעליו = מה הוא נותן.', tip_voice: 'לחץ 🎙 ודבר: "טנקים לרדאר", "כוח 2 לנקודה 4". Alt+מספר שומר נקודה.',
  },
  en: {
    title: 'The Commander', map: 'Battle map', mini: 'Minimap: tap to look there', compass: 'Compass: click to face north again (a middle-button drag turns the camera)',
    power: n => `Your share of all the power on the map. Below ${n}% you lose`, slots: 'Buildings: built / limit. Each 🏕️ adds 2', boost: 'The weaker side builds faster',
    hold: 'Hold', attack: 'Attack', retreat: 'Retreat', move: 'Move only', moveOn: 'Move only (M): they drive on without stopping to fight', moveOff: 'Attack (A)', followOn: 'Camera on the unit (C or Esc to leave)', followOff: 'Free camera',
    quit: 'Quit', quitDone: 'The game is closed. You can close this tab.', tipScore: 'Score: what each side has destroyed of the other (soldier 100, jeep 250, tank 500, building 1000, HQ 5000). It does not decide the game.', tipHold: 'Hold (Q): go there and defend it', tipAttack: 'Attack (A): take the area, chase the enemy', tipRetreat: 'Retreat (R): home, to heal and refill',
    gfx: 'Graphics', gfxHi: 'Normal', gfxLow: 'Low', tipGfxHi: 'Shadows, day and night, rain and fog', tipGfxLow: 'Faster: no shadows, no day and night, rain or fog (from the next game), plain ground',
    play: 'Go on (Space)', fsName: 'Full screen', gear: 'Settings', fs: 'Full screen (F)', sqT: 'Forces', all: 'All forces together, in formation (0)',
    eye: 'Drone (D): press, then a spot on the map', bld: 'Build (G): buildings / limit', fhq: 'Forward HQ (B): press, then a spot on the map',
    speed: 'Speed', slow: 'Slow', normalRate: 'Normal', fast: 'Fast', music: 'Music', vol: 'Music volume', radio: 'Radio', tipRadio: 'Radio reports read aloud',
    sfx: 'Explosions', sfxVol: 'Explosion volume', language: 'Language', help: '❔ Tour', tipHelp: 'A short tour of the controls',
    home: '🏠 Levels', tipHome: 'Back to the level screen', restart: '↻ New game', tipRestart: 'Start over',
    fog: 'Fog', on: 'On', off: 'Off', mapSize: 'Map', big: 'Big', small: 'Small', huge: 'Huge', diff: 'Level', foeStyle: 'Enemy', foe_random: 'Random: a different commander every game', foe_steady: 'Regular: every kind of force (on hard — every ability at once)', foe_missile: 'Missile commander: few forces at home and many surface-to-surface missiles at your buildings', foe_tanks: 'Armour commander: nearly all tanks, and an AA tent', foe_infantry: 'Infantry commander: soldiers of every kind', foe_vehicles: 'Light vehicles commander: jeeps of every kind', foe_air: 'Air force commander: aircraft, tankers and helicopters, and lots of AA at home', mate: 'Partner', askNone: 'Nothing to summon here', askOff: 'Called off', takeIt: '🚩 Take it', takeTip: 'The nearest soldier goes to take it', takeNone: 'Not a single soldier in the army to take it', sum_forces: 'Forces', sum_supply: 'Supplies', sum_jeeps: 'Jeeps', sum_foot: 'Soldiers', sum_planes: 'Aircraft', sum_helis: 'Helicopters', sum_guns: 'Guns', sum_rockets: 'Missiles', sum_carers: 'Medics & mechanics', rep1_fuel: t => `${t}: we're low on fuel`, rep1_water: t => `${t}: we're running out of water`, rep1_ammo: t => `${t}: we're low on ammunition`, rep1_hurt: t => `${t}: we have wounded, need care`, repN_fuel: (n, t) => `${n} of the ${t} out of fuel`, repN_water: (n, t) => `${n} of the ${t} out of water`, repN_ammo: (n, t) => `${n} of the ${t} out of ammunition`, repN_hurt: (n, t) => `${n} of the ${t} wounded`, sum_eyes: 'Eyes: a signals truck, a recon jeep and a drone — see what goes on there', sum_care: 'Care: a medic, a mechanic and a fuel, ammunition and water truck', etaS: t => `~${t}s`, etaM: t => `~${t} min`, sum_fuel: 'Fuel trucks', sum_ammo: 'Ammunition trucks', sum_water: 'Ration trucks', sum_fire: 'Shelling here: your partner’s guns, aircraft and helicopters fire at the spot', sum_build: 'Build this first (partner’s bulldozer)', sumBusy: n => `${n} fighting — they’ll come when done`, sumSent: (t, n) => `Summoned: ${t} ×${n}`, askOk: 'On our way', askNo: 'We have none', ic_ours: 'Ours', ic_attack: 'Attacking', ic_hold: 'Holding', ic_back: 'Falling back', ic_fight: 'In combat', askMake: t => `None yet — building a ${t}, then it’s on its way`, askMine: t => `You asked: ${t}`, askMate: t => `Partner asks: ${t}`, ask_fuel: 'Fuel here', ask_ammo: 'Ammunition here', ask_water: 'Rations here', ask_fire: 'Fire here', ask_lift: 'Pick up here', ask_guard: 'Guard here', ask_build: 'Build this first', ask_radio: 'Signals truck here (sight)', tipAsk: 'Alt+click: summon forces and supplies here, or ask your partner', noSsmHq: 'Missiles can’t be fired at the HQ', armsRow: 'Arms', arms_tip: 'Your two arms — the computer partner gets the other two', arm_armor: 'Armour: tanks, jeeps, motor pool', arm_infantry: 'Infantry: soldiers, AT, AA, commandos, medics', arm_air: 'Air force: aircraft, tankers, helicopters, Iron Dome, Arrow', arm_guns: 'Artillery and engineers: guns, missiles, bulldozers, signals and supply trucks, drones', armN_armor: 'Armour', armN_infantry: 'Infantry', armN_air: 'Air force', armN_guns: 'Artillery & engineers', foe_commando: 'Commando commander: helicopters set commandos down behind your lines to blow up buildings',
    tipFogOn: 'You see only what your forces see', tipFogOff: 'You see everything', tipBig: 'A big map, scrolling', tipSmall: 'The whole map on screen', tipHuge: 'A huge map, 4× the big one: a long game',
    go: 'Start', menuSub: 'Real-time command', campaign: 'Campaign', playGame: 'Start game', learn: 'Tutorial', learnNote: 'Pick a level: each one adds one thing.', wiki: 'Guide', more: 'More settings', mainScreen: '🏠 Main screen', saveGame: '💾 Save game', tipSave: 'Saves the game — go on with it from the main screen. Also saved by itself every 3 minutes and on leaving.', saved: 'Game saved', saveFail: 'Could not save', resume: '▶ Continue saved game', resumeT: (m, ago) => `minute ${m} · ${ago}`, agoMin: n => n < 1 ? 'just now' : n < 60 ? `${n} min ago` : n < 1440 ? `${Math.round(n / 60)} h ago` : `${Math.round(n / 1440)} days ago`, sureHome: 'Leave this game?', yes: 'Yes', no: 'No', back: 'Back', close: 'Close', turn: 'Turn the phone sideways', level: n => `Level ${n}`, full: 'Full game',
    again: 'Again', share: 'Share 🔗', copied: 'Copied ✓', levels: '🏠 Levels',
    replay: 'Replay: what you knew vs what happened', replayT: 'Replay time', replayKey: '● what happened · ○ what you knew',
    endStats: (err, n, d, off, a, m, ff, un) => `Picture off by: ${err} · orders: ${n}, ${d} s on the way, off by ${off}, unclear ${un} · calls: answered ${a}, decided alone ${m} · ⚠ friendly fire: ${ff}`,
    decoyItem: n => `Decoy · up to ${n}, no slot`, b_decoy: 'Fake HQ: under fog the enemy takes it for your HQ and attacks it',
    road: 'Road', tipRoad: 'Road: click where it starts, then where it ends — a bulldozer paves it. Everyone goes 10% faster on it, over mud too. Shift = another stretch from the end', roadReady: 'The road is ready',
    front: 'Front', tipFront: "Fronts: click, then drag a line on the map (straight or bent), up to 3 — the whole army, yours and your partner's, splits between them by strength and stands along them. Right-click a line to remove it", frontMax: n => `Up to ${n} fronts — right-click a line to remove it`, frontShort: 'The line is too short', frontContact: n => `Front ${n}: contact`, frontPress: (n, k) => `Front ${n} under pressure — ${k} lost`, frontReady: n => `Front ${n} in position`, frontOff: 'Front removed', frontHow: 'Drag a line on the map to mark a front', hqb: 'HQ', tipHqb: 'Set up the HQ: pick a spot in your strip and the tanks drive there to build it',
    tipSilent: 'Radio silence (S): the squad stops reporting, moves slowly with no dust, and the enemy can\'t hear it', silentOn: 'Radio silent', silentOff: 'On the air',
    tipNight: 'Night: shorter sight and range, fewer hits; slower orders',
    shareText: (won, time, d) => `I ${won ? 'won' : 'lost'} after ${time} on ${d} in "The Commander". Beat it:`,
    call: (boss, name) => `📞 Capt. ${boss} (${name}): heavy pressure. Hold or retreat?`,
    sqTip: (name, boss, home) => `${name} · Capt. ${boss}${home ? '' : ' · no building, no reinforcements'}`,
    buildItem: (sec, unit) => `${unit} · every ${sec} s`, needsItem: k => `Needs ${k} first`, needsWhy: k => `Needs ${k} first`, mineItem: unit => `${unit} haul to the plant`, plantItem: good => `Makes ${good} for the stock`,
    good_fuel: 'fuel', good_steel: 'steel', good_concrete: 'concrete', good_rubber: 'rubber', good_rations: 'rations', good_alu: 'aluminium', good_explosives: 'explosives', good_electronics: 'electronics', dep_oil: 'Oil field', dep_iron: 'Iron ore', dep_lime: 'Lime deposit', dep_farm: 'Fields', dep_bauxite: 'Bauxite', waitGood: g => `Waiting for ${g}`, noBurn: 'No fuel for the furnace', depFree: 'Free — build on it', depTaken: 'Taken', depLeft: (n, p) => `${n} left (${p}%)`, depDry: 'Exhausted',
    techTitle: 'Tech tree', techHint: 'What to build to reach everything. Dimmed = not yet; green = can go up now; ✓ = built. Click one that can go up to place it.', techC1: 'Sources', techC2: 'Plants', techC3: 'Service', techC4: 'Production', techVeh: 'All vehicles and aircraft', techForces: 'All forces', techAll: 'All buildings', techLab: 'Lets a lab go up', techDone: 'Built', techCan: 'Can go up now', techMate: 'Your partner builds this', tech: '', stockTip: l => 'Stock: ' + l + ' · click — the tech tree (K)', stockLow: 'nearly out', techShort: 'Tech tree', techBtnTip: 'The tech tree (K): what to build to get to each building',
    gt_concrete: 'Lime quarry → concrete plant. Every building site takes concrete while the bulldozer works on it.',
    gt_fuel: 'Oil well → refinery. Fills the fuel trucks for every vehicle and aircraft; the aluminium furnace and the chemical plant burn it too.',
    gt_steel: 'Iron mine → steel mill. Tanks, jeeps, guns, missile trucks and mechanics; the ammo trucks fill up with it.',
    gt_rubber: 'Comes out of the refinery with the fuel. Jeeps, trucks and mechanics.',
    gt_rations: 'Farm → field kitchen. Every soldier costs rations; the ration trucks and depot feed soldiers in the field.',
    gt_alu: 'Bauxite mine → aluminium plant (burns fuel). Airfields, helipads and every plane and helicopter.',
    gt_explosives: 'Chemical plant — turns fuel into explosives. AT and AA soldiers, commandos, guns and MLRS; and the ammo trucks.',
    gt_electronics: 'Hi-tech centre → electronics lab (×2 holding the research institute). Missile trucks, Arrow, Iron Dome and drones.', waitSteel: 'Waiting for steel', waitCon: 'Waiting for concrete', noStockFuel: 'No fuel in stock — needs an oil well and a refinery',
    bp_industry: 'Industry', bpn_industry: 'Lime → concrete, iron → steel, bauxite → aluminium — in order, past the allowance', bp_energy: 'Fuel & food', bpn_energy: 'Oil → fuel and rubber, fuel → explosives, fields → rations — past the allowance',
    b_quarry: 'Quarry on a lime deposit: mixers haul cement to the concrete plant', b_concrete: 'Concrete plant: every building needs it, and building uses concrete', b_oilwell: 'Well on an oil field: tankers haul crude to the refinery', b_refinery: 'Refinery: oil → fuel. Fuel stations need it', b_ironmine: 'Mine on iron ore: trucks haul ore to the steel mill', b_steelmill: 'Steel mill: ore → steel. The workshops need it; tanks, jeeps and guns use steel', b_farm: 'Farm on fields: trucks haul grain to the field kitchen', b_kitchen: 'Field kitchen: grain → rations. The rations depot needs it', b_bauxmine: 'Mine on bauxite: trucks haul it to the smelter', b_smelter: 'Aluminium smelter: bauxite → aluminium (burns fuel). Airfields and helipads need it; aircraft use aluminium', b_chemplant: 'Chemical plant: fuel → explosives. The ammunition depot needs it', b_hitech: 'Hi-tech centre: one only — lets an electronics lab go up', b_elab: 'Electronics lab: one only — makes electronics for missiles, Arrow, Iron Dome and drones (twice as fast with the research institute)', slotsLeft: n => n ? `${n} more buildings` : 'No room for another building (a 🏕️ forward HQ adds some)',
    ti_dug: 'Dug in', ti_digging: 'Digging…', victory: 'VICTORY', defeat: 'DEFEAT', skip: 'Skip', tipCtrlGroup: 'Ctrl+number: make the picked a group', errLogged: 'A fault was logged (Ctrl+Shift+L to save it)', ti_hp: n => `Health ${n}%`, ti_ammo: n => `Ammunition ${n}%`, ti_fuel: n => `Fuel ${n}%`, ti_load: n => `Load ${n}%`, ti_water: n => `Rations ${n}%`, logSaved: 'The log was saved: commander-log.json in Downloads', liteOn: 'The game is slow — lighter graphics to keep it moving', st_retreat: 'falling back', st_heal: 'being treated', st_ammo: 'going for ammunition', st_build: 'building', st_idle: 'waiting', st_fight: 'fighting', st_move: 'on the way', st_hold: 'holding', st_silent: 'radio silence', foe: 'enemy',
    bp_supply: 'Supply', bpn_supply: 'Ammunition, fuel, water — past the allowance, up to 2 of each', bp_tents: 'Tents', bpn_tents: 'Infantry, AT, AA, medics, commandos', bp_shops: 'Workshops', bpn_shops: 'Tanks, jeeps, guns, missiles', bp_guns: 'Artillery', bpn_guns: '200 mm, MLRS', bp_defense: 'Missile defence', bpn_defense: 'Arrow, Iron Dome', bp_jeeps: 'Jeep workshop', bpn_jeeps: 'Light, AT, AA', bp_service: 'Service', bpn_service: 'Garage, decoy, defence', bp_air: 'Aviation', bpn_air: 'Aircraft, helicopters', bp_helis: 'Helipad', bpn_helis: 'Attack, gunship, transport',
    placeHq: 'Pick where your HQ 🏰 goes, in the green strip. The bulldozer 🚜 drives there and puts it up.', hqWhy: { nodozer: 'No bulldozer 🚜 to put it up', band: 'Only in the green strip on your side', bad: 'Not here' },
    why: { short: 'Too short', nodozer: 'No bulldozer 🚜 — it puts the buildings up', nohq: 'Set up the HQ 🏰 first', q: 'Control here is too weak to build', limit: 'No free slot — set up a 🏕️ forward HQ', gap: 'Too close to another building', bad: 'Off the map', max: 'No more of these', shore: 'A water plant goes on a lake\'s bank' , deposit: 'Only on a free deposit of its kind' },
    noVoice: 'No English voice on this device, only a radio sound',
    b_tent: 'Infantry: cheap and quick, holds ground', b_aapost: 'Anti-air: hits aircraft and drones', b_jeepshop: 'Jeeps: fast, see far; strong vs infantry',
    b_atpost: 'Anti-tank: soldiers with missiles against tanks and vehicles', b_jeepaa: 'AA jeeps: fast, against aircraft; twice as long to make', b_jeepat: 'AT jeeps: fast, against tanks; twice as long to make',
    b_howshop: '200 mm gun: fires very far at what you see; one shell destroys a unit — a tank too', b_mlrsshop: 'MLRS: a salvo over an area — soldiers and jeeps do not survive, tanks barely hurt',
    b_tankshop: 'Tanks: strong vs vehicles, run over soldiers; anti-tank hurts them', b_airfield: 'Aircraft: strong vs tanks and jeeps; only AA hits them', b_heliatk: 'Attack helicopters: missiles vs aircraft, helicopters and vehicles; they hover', b_heligun: 'Gunships: strong vs soldiers; they hover', b_commandopost: 'Commandos: the enemy can\'t see them (only right by it); one shot kills a soldier; 20 s by an enemy building and it blows up', b_ssmshop: 'Surface-to-surface missile trucks: a building in one hit, the HQ in four; they fire at a building you have seen, after standing 10 s', b_arrowsite: 'Arrow trucks: they shoot down surface-to-surface missiles, one a minute each', b_domesite: 'Iron Dome trucks: they stop aircraft, helicopter and anti-tank missiles over their area', b_helilift: 'Transport helicopters: up to 10 soldiers (commandos too) — click the helicopter to put the picked ones on, then the map to set them down there',
    b_clinic: 'Medics: heal infantry and AA', b_garage: 'Mechanics: repair jeeps and tanks', b_depot: 'Ammunition trucks: refill the units round them', b_tankerbase: 'Tankers: circle halfway out; planes low on fuel fill up by them and fly on', b_fuelst: 'Fuel trucks: fill the vehicles round them', b_waterst: 'Ration trucks (food and water) for the soldiers round them. Needs a field kitchen',
    next: 'Next', done: "Let's go!", skip: 'Skip',
    t_level: (n, of, hq, k, wipe) => `Level ${n} of ${of}. The goal: ${wipe ? 'destroy all the enemy forces and buildings' : (hq ? 'destroy the enemy HQ, or ' : '') + `bring the enemy below ${k}% of the power`}. Here's what's new:`,
    t_free: k => `The full game. The goal: destroy the enemy HQ, or bring its whole army below ${k}%. Everything is here, and a few new things:`,
    t_keys: 'Keys: Q hold, A attack, R retreat home (to heal). H — the HQ, T — a bulldozer.',
    h_attack: 'Click the enemy to attack', h_attackT: 'Tap the enemy to attack', h_build: 'There is room to build — pick a building kind', h_hq: 'Press here, then the green strip',
    learned: k => `You learned: ${k}`,
    learn1: 'sending a force to attack', learn2: 'picking a force and sending it', learn3: 'the HQ — hold, attack, retreat', learn4: 'building', learn5: 'jeeps and tanks',
    learn6: 'medics, mechanics and supply', learn7: 'aircraft and AA', learn8: 'the fog of war', learn9: 'drones', learn10: 'distance and control', learn11: 'forward HQs, and playing on the keys',
    learn12: 'setting up an HQ with a bulldozer', learn13: 'signals trucks — the tutorial is done!',
    tip_front: 'Fronts 🚩: press here and drag a line on the map — the whole army goes there, split between up to 3 fronts.',
    tip_rally: 'A building picked: a click on the map = where its forces go out to.',
    tip_care: 'Hurt ✡: click it again to send it for treatment until it is whole.',
    tip_group: 'Ctrl + a number: what is picked is kept as a group, and the number alone picks it again.',
    tip_ssm: 'Missile truck: pick it and click an enemy building you know of. With no target it fires at the nearest on its own.',
    tip_lift: 'Transport helicopter: pick soldiers and click it to board; then pick it and click the map to set them down there.',
    tip_heli: 'Helicopters hover over what they fire at. AA hits them hard.',
    tip_commando: 'Commando: the enemy hardly sees him. 20 s by an enemy building — and it blows up.',
    tip_silence: 'A force far from HQ talks on the radio — and the enemy hears. S = radio silence.',
    t_placeHq: 'First: pick where your HQ goes — anywhere in the green strip on your side. The bulldozer 🚜 drives there and puts it up — and every other building too, only while it stands by it. Until the HQ stands there is no building, and if the command tanks fall, you lose. The signals truck 📡 sees far; every two minutes the HQ sends another bulldozer and another truck.',
    t_decoy: 'In the build menu: 🏰🎭 a fake HQ. Under fog the enemy takes it for yours and attacks it.',
    t_silent: '📻 / 🤫 radio silence for the picked squad: no reports, slow and dustless — and the enemy can\'t hear it. A vehicle driving fast raises dust seen from afar.',
    t_night: '🌙 Night falls step by step: in the full dark everyone (drones and buildings too) sees 40% less, shoots 20% shorter and hits 25% less, and orders are slower. A commander who survives fights gains experience ⭐.',
    t_scale: k => `A big map: ${k}× the buildings and forward HQs.`,
    ni_build: n => `building · ${n}s left`, ni_next: (u, n) => `next ${u} in ${n}s`, ni_full: 'squad full', ni_sup: (u, n) => `${u} · in ${n}s`, one_dozer: 'bulldozer', one_radio: 'signals truck', ni_site: n => `going up · ${n}%`, ni_wait: n => `${n}% · waiting for a bulldozer 🚜`, hqReadyNote: 'Headquarters is ready! You can start building.', fhqCan: 'A forward HQ 🏕️ can be set up', droneCan: 'A drone is ready to fly', ni_seen: n => `seen ${n}s ago`,
    t_you: 'You are blue, on the left. You must destroy red, on the right.',
    t_hq: 'Your HQ. If it falls, you have lost (and so has the enemy if theirs does). Soldiers standing by it with no fight repair it, and any building.',
    t_power: n => `Your share of all the power on the map. Whoever drops below ${n}% loses. The goal: break the enemy.`,
    t_click: TOUCH ? 'Tap the map: your force goes there and attacks.' : 'Left click on the map: your force goes there and attacks.',
    t_play: 'Settings: opening them pauses the game, closing goes on. Space pauses too.',
    t_squads: 'Click a force to pick it, then click the map to send only it. Drag to pick several. Double click = every force of its kind. Right click: none; again: all.',
    t_squadsT: 'Tap a force to pick it, then tap the map to send only it. Double tap = every force of its kind.',
    group: 'Group', tipGroup: 'Tie into a group (L): picked together, acting together', tipUngroup: 'Break the group up (L)',
    t_hold: 'Hold: go there and defend it.', t_attack: 'Attack: take the area and chase the enemy there.', t_retreat: 'Retreat: home, to heal and refill.',
    trophy: 'Trophy', trophyGo: m => `🛡️ Trophy · ${m} min with no tanks`, trophyOn: s => `Trophy: ${s} s to go`, trophyHas: 'Tanks come out with Trophy', launchAt: 'Launch', boarded: n => `${n} on board`, noRoom: 'No room on board', packBlock: 'In a block', packLine: 'In a line', razeQ: n => `Are you sure you want to pull down the ${n}?`,
    t_build: 'Build: press a building kind here, pick a building, then a green spot on the map. Each building sends out forces, one at a time. With no room left, the kinds are dimmed.', t_slots: 'Its number: how many buildings you have, of your limit.', t_order: 'The order a tap on the map gives: sword = attack, shield = hold. A tap here switches.', tipSwitch: 'a tap switches',
    t_vehicles: 'New: 🔧 jeeps (fast) and 🏭 tanks (strong).',
    t_care: 'New: 🏥 medics, 🛠️ mechanics and 📦 supply trucks. The wounded, and those out of ammunition, go to them on their own.',
    t_air: 'New: 🛫 aircraft (strong vs vehicles) and 📡 anti-air — the only thing that hits them.',
    t_fog: soon => `${soon ? 'Fog is coming down: ' : 'Fog: '}you see only what your forces see. A red blob = where the enemy was last seen.`,
    t_eye: 'Drone: press, then a spot on the map. It sees around it until AA downs it. A new one every minute.',
    t_c2: 'The blue is your control. Far from HQ orders arrive late and are carried out roughly, and you only see roughly where your forces are.',
    t_fhq: 'Forward HQ: press, then a spot. Jeeps or tanks drive there and set it up: more control, 2 more buildings, more room to build.',
    t_fhqDz: 'Forward HQ: press, then a spot (a minute after the HQ stands). It joins the bulldozer’s queue: more control, 2 more buildings, more room to build.',
    t_placeDz: 'No HQ yet. Press here, then a spot in the green strip — the bulldozer drives there and puts it up.',
    t_dozer: 'The bulldozer builds everything (forward HQs too), in the order you lay it out (a number on each site). It only builds while it stands by the site — move it and the work stops until you tap a site again.',
    t_radio: 'The signals truck sees far and gives control round it. Send it behind your forces.',
    t_face: TOUCH ? 'Press, hold and drag = an order with the way the front faces.' : 'Right-drag = an order with the way the front faces.',
    pi_free: "no one's", pi_ours: 'ours', pi_theirs: "the enemy's", pi_take: 'a soldier who walks in takes it (and stays inside); a commando takes it and walks out',
    held_radar: 'Gives 10% more sight and firing range', held_power: 'Gives 10% faster production in every building', held_fuel: 'Gives 10% faster driving to every vehicle', held_lab: 'Our electronics lab makes twice as fast', fx_lab: 'Electronics for its holder: missiles, Arrow, Iron Dome, drones',
    fx_radar: "the holder's forces see and shoot 10% further", fx_power: "the holder's buildings produce 10% faster", fx_fuel: "the holder's vehicles drive 10% faster",
    fx_supply: 'refills ammunition round it', fx_hospital: 'soldiers round it heal fast', fx_motorpool: 'vehicles round it are repaired fast', fx_tower: 'sees very far round it',
    fx_antenna: 'full control round it: orders fast and exact', fx_bunker: 'up to 4 soldiers by it take half the damage',
    wx_rain: '🌧 Rain: shorter sight and range, fewer hits', wx_dust: '🌪 Dust storm: far shorter sight and range, fewer hits — and no vehicle dust gives anyone away', wx_fog: '🌫 Morning fog on the plain: on a hill you are above it',
    ptSaved: n => `Point ${n} saved (Shift+${n} goes back)`, ptNone: n => `Point ${n} isn't set (Alt+${n} saves it)`,
    micGate: 'To give spoken orders, allow the microphone. The browser will then ask once.', micYes: 'Allow microphone', micNo: 'Not now',
    micAsk: 'Microphone for orders', mic: 'Spoken order', tipMic: 'Spoken orders: a click opens the microphone (each sentence = an order, e.g. "tanks to the radar"), another click closes it', micOk: '🎙 Microphone allowed. In the game: click 🎙 and speak.', micFile: 'The game was opened from a file, so the browser keeps asking about the microphone. To be asked once, open the game with play.bat.',
    vListen: 'Listening…', vNoSR: "This browser can't recognise speech. Try Chrome or Edge.", vNoMic: 'No access to the microphone', vNet: 'Speech recognition needs the internet', vAgain: 'Say again?',
    vWho: 'Who? e.g. tanks, group 2, everyone', vWhere: 'Where? e.g. to the radar, to point 3, there', vNone: k => `No ${k}`, vNoGroup: n => `No group ${n}`, vNoFront: 'No front set',
    vGroup: n => `Group ${n}`, vPoint: n => `Point ${n}`, vPicked: 'The picked', vAll: 'Everyone', vThere: 'There',
    t_posts: "Neutral buildings: a radar, power and fuel stations, depots, hospitals, motor pools, observation towers, antennas and bunkers. A soldier who walks in takes it (and stays inside); an enemy soldier makes it no one's, a second makes it theirs. Mouse over one = what it gives.",
    t_weather: '🌧 Rain and 🌫 morning fog (only on the plain) take 20% off sight, range and hits. Vehicles go faster on roads. Soldiers standing still among trees are hard to see.',
    t_voice: '🎙 Click 🎙 and speak (it stays open until another click): "tanks to the radar", "group 2 to point 4", "everyone retreat". Alt+number saves the view as a point, Shift+number jumps there.',
    tip_asks: 'You have a partner: Alt+click on the map = ask them for fuel, ammunition, fire, a pick-up… there. They will ask you too (a yellow mark). A red triangle = a target soldiers or a drone mark: aircraft, guns and missiles hit it in full.',
    tip_posts: 'A neutral building: a soldier who walks in takes it. Mouse over it = what it gives.', tip_voice: 'Click 🎙 and speak: "tanks to the radar", "group 2 to point 4". Alt+number saves a point.',
  },
};
const tr = (k, ...a) => { const v = STR[lang][k] ?? STR.he[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
// every static word, from its key; the page turns right-to-left or left-to-right with the language
function applyLang() {
  const R = document.documentElement; R.lang = lang; R.dir = lang === 'he' ? 'rtl' : 'ltr'; document.title = tr('title');
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = tr(e.dataset.t);
  for (const e of document.querySelectorAll('[data-al]')) e.setAttribute('aria-label', tr(e.dataset.al));
  for (const e of document.querySelectorAll('[data-lang]')) e.setAttribute('aria-pressed', String(e.dataset.lang === lang));
}
function setLang(l) {
  lang = l; try { localStorage.setItem('irts-lang', l); } catch (e) { /* ignore */ }
  applyLang(); if (typeof onLang === 'function') onLang();
}
applyLang();

// ---- the tooltip: a short line over a control (mouse hover), a note at a spot (toast), or a step of the tour ----
const tipEl = $('tip');
let tipFor = null, tipTimer = 0, tipHide = 0;
// r: the target's screen rectangle (a point is a zero-size one); the bubble sits above it, or below near the top
// what each kind is for, in a few words (the mouse over a squad)
const ROLE = {
  he: { how: 'תותח כבד — יחידה אחת בכל פגז, מרחוק', mlrs: 'מטח על שטח — נגד חיילים וג׳יפים', inf: 'לוחם בחיילים', at: 'צייד טנקים', aa: 'מפיל מטוסים ומסוקים', med: 'מטפל בחיילים פצועים', mech: 'מתקן רכבים', jeep: 'סיור מהיר', ajeep: 'נ״מ נייד — נגד מטוסים ומסוקים',
    tjeep: 'נ״ט נייד — נגד טנקים', tank: 'שובר קווים — נגד רכבים, חיילים ומבנים', air: 'תוקף מהאוויר', tanker: 'מתדלק מטוסים באוויר', heli: 'צייד רכבים ומסוקים', gunship: 'מחסל חיילים', lift: 'מוביל חיילים',
    truck: 'מביא תחמושת', fueltruck: 'מביא דלק', oiltruck: 'מוביל נפט לבית הזיקוק', oretruck: 'מוביל עפרה למפעל הפלדה', cementtruck: 'מוביל מלט למפעל הבטון', bauxtruck: 'מוביל בוקסיט למפעל האלומיניום', graintruck: 'מוביל תבואה למטבח השדה', watertruck: 'מביא מנות קרב', dozer: 'בונה ומתקן מבנים', radio: 'עיניים ושליטה בשטח', ssm: 'משמיד מבנים מרחוק', arrow: 'מיירט טילים', dome: 'מגן מטילים קצרים', commando: 'מפוצץ מבנים בשקט' },
  en: { how: 'Heavy gun — one unit a shell, from afar', mlrs: 'Area salvo — against soldiers and jeeps', inf: 'Fights soldiers', at: 'Tank hunter', aa: 'Shoots down aircraft and helicopters', med: 'Treats wounded soldiers', mech: 'Repairs vehicles', jeep: 'Fast scout', ajeep: 'Mobile AA — against aircraft and helicopters',
    tjeep: 'Mobile AT — against tanks', tank: 'Breaks lines — vehicles, soldiers and buildings', air: 'Strikes from the air', tanker: 'Refuels planes in the air', heli: 'Hunts vehicles and helicopters', gunship: 'Kills soldiers', lift: 'Carries soldiers',
    truck: 'Brings ammunition', fueltruck: 'Brings fuel', oiltruck: 'Hauls crude to the refinery', oretruck: 'Hauls ore to the steel mill', cementtruck: 'Hauls cement to the concrete plant', bauxtruck: 'Hauls bauxite to the smelter', graintruck: 'Hauls grain to the field kitchen', watertruck: 'Brings rations', dozer: 'Builds and repairs', radio: 'Eyes and control in the field', ssm: 'Destroys buildings from afar', arrow: 'Intercepts missiles', dome: 'Stops short-range missiles', commando: 'Blows up buildings quietly' },
};
function showTip(text, r, nav) {
  clearTimeout(tipHide);
  $('tipT').textContent = text; $('tipNav').hidden = !nav;
  if (nav) { $('tipN').textContent = nav.n; $('tipNext').textContent = nav.last ? tr('done') : tr('next') + ' ›'; $('tipSkip').textContent = tr('skip'); $('tipSkip').hidden = !!nav.last; }
  tipEl.hidden = false;
  const st = stage.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, cx = r.left + r.width / 2, below = r.top + r.height / 2 < st.height * 0.4;
  const x = Math.max(8, Math.min(st.width - w - 8, cx - w / 2)), y = below ? r.top + r.height + 12 : r.top - h - 12;
  tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, Math.min(st.height - h - 8, y)) + 'px';
  tipEl.classList.toggle('below', below); tipEl.style.setProperty('--ax', Math.max(12, Math.min(w - 12, cx - x)) + 'px');
}
const hideTip = () => { tipEl.hidden = true; tipFor = null; };
const rectOf = el => el.getBoundingClientRect();
// a note by a button (its id), for a few seconds
function noteBy(id, text) { const el = $(id); if (!el || el.hidden || el.offsetParent === null) return; const r = rectOf(el); toast(text, r.left + r.width / 2, r.top, 3500); }
// a short note at a spot on the screen (why a building can't go there, …)
function toast(text, x, y, ms = 2200) {
  if (tour) return;
  showTip(text, { left: x, top: y, width: 0, height: 0 }); tipFor = 'toast';
  tipHide = setTimeout(hideTip, ms);
}
// hover (mouse only): after a moment, the control's line
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || tour) return;
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el || el === tipFor) return;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { if (!el.isConnected || el.offsetParent === null || tour) return; /* (not during a tour: it would take the tour bubble's place) */ tipFor = el; showTip(typeof el.tipText === 'function' ? el.tipText() : tr(el.dataset.tip), rectOf(el)); }, 350);
});
document.addEventListener('pointerout', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
  clearTimeout(tipTimer); if (tipFor === el) hideTip();
});
document.addEventListener('pointerdown', () => { clearTimeout(tipTimer); if (tipFor && tipFor !== 'toast' && !tour) hideTip(); }, true);

// ---- the tour: the new things of a level, one after another, each with its line, before the fight starts ----
// a step: { el: an element id, or a function giving a screen point / rectangle; t: the text }. The game waits.
let tour = null;
function runTour(steps, then) {
  steps = steps.filter(st => { const r = stepRect(st, true); return r && (r.width || r.height || r.left || r.top); });
  if (!steps.length) { then && then(); return; }
  // (cam: where it was — a step may take the camera to its spot)
  hideTip(); tour = { steps, i: 0, then, cam: { ...cam } }; $('tourBg').hidden = false; tourShow();
}
function stepRect(st, peek) { // (peek: only whether it's there — the camera doesn't move to it)
  if (typeof st.el === 'function') { const p = st.el(peek); return p && { left: p.x - (p.w || 0) / 2, top: p.y - (p.h || 0) / 2, width: p.w || 0, height: p.h || 0 }; }
  const el = $(st.el); return el && !el.hidden && el.offsetParent !== null ? rectOf(el) : null;
}
function tourShow() {
  document.querySelectorAll('.tourOn').forEach(e => e.classList.remove('tourOn'));
  const st = tour.steps[tour.i], el = typeof st.el === 'string' && $(st.el);
  if (el) el.classList.add('tourOn');
  showTip(st.t, stepRect(st), { n: `${tour.i + 1}/${tour.steps.length}`, last: tour.i === tour.steps.length - 1 });
  tour.dot = typeof st.el === 'function' ? st.el() : null;
}
function tourNext(skip) {
  if (!tour) return;
  if (!skip && ++tour.i < tour.steps.length) { tourShow(); return; }
  const then = tour.then; cam = tour.cam; applyView(); tour = null; $('tourBg').hidden = true; hideTip();
  document.querySelectorAll('.tourOn').forEach(e => e.classList.remove('tourOn'));
  then && then();
}
$('tipNext').addEventListener('click', () => tourNext());
$('tipSkip').addEventListener('click', () => tourNext(true));
$('tourBg').addEventListener('click', () => tourNext());
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
