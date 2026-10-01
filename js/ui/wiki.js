// UI: the guide — the game explained by topic (the main menu's "guide"): the goal, how to play, command and control,
// the units and buildings (cards drawn from the game's own numbers), support and supply, the keys
const WIKI_UNIT = {
  he: {
    inf: 'חיילים עם רובים. זולים, יוצאים מהר, טובים נגד חיילים אחרים. חלשים מול טנקים.',
    at: 'חיילים עם טיל נגד רכבים. ההפתעה הכי רעה לטנק ולג׳יפ, חלשים נגד חיילים.',
    aa: 'חיילים עם טילי נ"מ. הם היחידים (עם ג׳יפי נ"מ) שפוגעים במטוסים וברחפנים.',
    jeep: 'מהירים ורואים רחוק. טובים לסיור ולפשיטות, לא לקרב חזיתי.',
    ajeep: 'ג׳יפ עם טילי נ"מ: מגן על הכוחות מפני מטוסים ורחפנים, ובתנועה.',
    tjeep: 'ג׳יפ עם טיל נ"ט: צייד טנקים מהיר.',
    tank: 'השריון: חזק, איטי, דורס חיילים. נ"ט ומטוסים הם האויבים שלו.',
    air: 'מטוסים חגים מעל המטרה ויורים עד שנגמרת התחמושת, ואז חוזרים להתחמש. רק נ"מ פוגע בהם.',
    heli: 'מסוקי קרב: מרחפים במקום ויורים טילים — במטוסים, במסוקים, בטנקים ובג׳יפים. נ"מ פוגע בהם חזק, וחיילים וג׳יפים קצת (הם טסים נמוך).',
    gunship: 'מסוקי מקלע: מרחפים מעל חיילים ומחסלים אותם. חלשים מול רכבים; נ"מ, חיילים וג׳יפים פוגעים בהם.',
    lift: 'מסוקי תובלה: לא יורים. נושאים עד 10 חיילים מכל סוג רגלי (גם קומנדו). בוחרים חיילים ולוחצים על המסוק — הם עולים; בוחרים את המסוק ולוחצים על המפה — הוא נוחת ומוריד אותם. מסוק שמופל — כולם איתו.',
    ssm: 'משאיות טילי קרקע-קרקע: בוחרים ולוחצים על מבנה אויב שראית — המשאית עוצרת, מתכוננת 10 ש׳ ומשגרת (טיל בדקה). מבנה רגיל נהרס בפגיעה אחת, המפקדה בארבע. השיגור מגלה לאויב איפה היא.',
    arrow: 'משאיות חץ: מיירטות טילי קרקע-קרקע באמצע הדרך, בטווח של כגובה המפה. טיל אחד בדקה לכל משאית.',
    dome: 'משאיות כיפת ברזל: עוצרות טילים קצרים — של מטוסים, מסוקי קרב ונ"ט — על כוחות ומבנים שלנו באזור שלהן. אחד בדקה לכל משאית.',
    commando: 'קומנדו: האויב לא רואה אותו — רק כשהוא ממש מתחת לרחפן או צמוד למשאית קשר, צמוד לכוחות או למבנים שלו, או רגע אחרי שהוא יורה. רואה סביבו כמו רחפן. ירייה אחת הורגת חייל (כל 3 ש׳). עומד 20 ש׳ ליד מבנה אויב — המבנה מתפוצץ; המפקדה צריכה ארבעה. עולה גם על מסוק תובלה.',
    med: 'חובשים: לא יורים. חיילים פצועים באים אליהם להתרפא.',
    mech: 'מכונאים: מתקנים רכבים פגועים, ומתקנים מבנים מהר.',
    truck: 'משאיות אספקה: יחידה בלי תחמושת נוסעת אליהן להתמלא. רחוק מהן ומהמבנים — היריות יקרות יותר.',
    dozer: 'הטרקטור בונה הכל: המפקדה, פיקוד קדמי וכל מבנה. בונה רק כשהוא עומד ליד האתר; אם הוא זז — הבנייה נעצרת.',
    radio: 'משאית קשר: רואה רחוק מאוד (פי 3 מרחפן) ונותנת שליטה סביבה. יקרה — שמור עליה מאחורי הכוחות.',
  },
  en: {
    inf: 'Soldiers with rifles. Cheap, quick to make, good against other soldiers. Weak against tanks.',
    at: 'Soldiers with an anti-tank missile. The worst surprise for a tank or a jeep; weak against soldiers.',
    aa: 'Soldiers with anti-air missiles. They (and AA jeeps) are the only ones that hit aircraft and drones.',
    jeep: 'Fast and far-seeing. Good for scouting and raids, not for a head-on fight.',
    ajeep: 'A jeep with AA missiles: keeps aircraft and drones off the squads, on the move.',
    tjeep: 'A jeep with an anti-tank missile: a fast tank hunter.',
    tank: 'The armour: strong, slow, runs soldiers over. Anti-tank and aircraft are its enemies.',
    air: 'Aircraft circle over their target and fire until out of ammunition, then fly back to rearm. Only AA hits them.',
    heli: 'Attack helicopters hover and fire missiles — at aircraft, helicopters, tanks and jeeps. AA hits them hard, soldiers and jeeps a little (they fly low).',
    gunship: 'Gunships hover over soldiers and cut them down. Weak against vehicles; AA, soldiers and jeeps hit them.',
    lift: 'Transport helicopters don\'t shoot. They carry up to 10 soldiers of any kind on foot (commandos too). Pick soldiers and click the helicopter — they get on; pick the helicopter and click the map — it lands and sets them down. Shot down, it takes them all.',
    ssm: 'Surface-to-surface missile trucks: pick them and click an enemy building you have seen — the truck stops, sets up for 10 s and launches (one a minute). A building goes down in one hit, the HQ in four. The launch shows the enemy where it is.',
    arrow: 'Arrow trucks shoot down surface-to-surface missiles halfway, anywhere within about the map\'s height. One a minute each.',
    dome: 'Iron Dome trucks stop the short missiles — aircraft\'s, attack helicopters\', anti-tank — at our forces and buildings over their area. One a minute each.',
    commando: 'Commandos: the enemy doesn\'t see one — only right under its drone or by its signals truck, close by its forces or buildings, or just after he fires. He sees round him as a drone does. One shot kills a soldier (every 3 s). Twenty seconds standing by an enemy building and it blows up; the HQ takes four. He rides the transport helicopter too.',
    med: 'Medics: they don\'t fight. Hurt soldiers come to them to heal.',
    mech: 'Mechanics: repair damaged vehicles, and buildings fast.',
    truck: 'Supply trucks: a unit out of ammunition drives to one to refill. Far from them and from buildings, shots cost more.',
    dozer: 'The bulldozer builds everything: the HQ, forward HQs and every building. Only while it stands by the site; if it moves, the work stops.',
    radio: 'A signals truck: sees very far (3× a drone) and gives control around it. Precious — keep it behind the squads.',
  },
};
const WIKI_STRUCT = {
  he: { hq: 'המפקדה הראשית: לב השליטה. אם היא נופלת — הפסדת.', fhq: 'פיקוד קדמי: מרחיב את השליטה ואת השטח שאפשר לבנות בו, ומוסיף מקום למבנים.',
    tent: 'מגייס חי"ר.', atpost: 'מגייס לוחמי נ"ט.', aapost: 'מגייס לוחמי נ"מ.', jeepshop: 'מייצר ג׳יפים.', jeepaa: 'מייצר ג׳יפי נ"מ (לאט).', jeepat: 'מייצר ג׳יפי נ"ט (לאט).',
    tankshop: 'מייצר טנקים.', airfield: 'מייצר מטוסים, ושם הם מתחמשים.', clinic: 'מוציא חובשים.', garage: 'מוציא מכונאים.', depot: 'מוציא משאיות אספקה.', decoy: 'מפקדה מזויפת: בערפל האויב חושב שזו המפקדה שלך ותוקף אותה.' },
  en: { hq: 'The main HQ: the heart of command. If it falls, you lose.', fhq: 'A forward HQ: spreads control and the ground you may build on, and adds room for buildings.',
    tent: 'Raises infantry.', atpost: 'Raises anti-tank soldiers.', aapost: 'Raises anti-air soldiers.', jeepshop: 'Makes jeeps.', jeepaa: 'Makes AA jeeps (slowly).', jeepat: 'Makes AT jeeps (slowly).',
    tankshop: 'Makes tanks.', airfield: 'Makes aircraft, and they rearm there.', clinic: 'Sends out medics.', garage: 'Sends out mechanics.', depot: 'Sends out supply trucks.', decoy: 'A fake HQ: under fog the enemy takes it for yours and attacks it.' },
};
// the pages: [icon, title, body]; a body is HTML, or a function making it (the cards)
const WIKI = {
  he: [
    ['🎯', 'מטרת המשחק', `<h2>מטרת המשחק</h2>
      <p>אתה <b>המפקד</b>. אתה לא מזיז חיילים אחד-אחד: אתה נותן <b>כוונה</b> למפקדי הכוחות — לאן, לתקוף או להחזיק — והם מבצעים בעצמם.</p>
      <h3>איך מנצחים</h3><ul><li>משמידים את <b>המפקדה</b> של האויב, או</li><li>מורידים את כל הצבא שלו (כוחות ומבנים) מתחת לקו בפס העוצמה למעלה.</li></ul>
      <h3>איך מפסידים</h3><ul><li>המפקדה שלך נופלת, או העוצמה שלך יורדת מתחת לקו.</li><li>בתחילת משחק מלא: אם טנקי הפיקוד נופלים לפני שהמפקדה קמה.</li></ul>`],
    ['🕹', 'איך משחקים', `<h2>איך משחקים</h2>
      <h3>התחלה</h3><p>בוחרים איפה תקום המפקדה — ברצועה הירוקה בצד שלך. הטרקטור נוסע לשם ומקים אותה. עד שהיא עומדת אין בנייה.</p>
      <h3>בחירה</h3><ul><li>לחיצה על כוח בוחרת אותו; גרירה משמאל מסמנת מלבן.</li><li>הכפתורים למעלה: ★ = כולם, ואחריו כל סוג (מקשים 1–9).</li><li>לחיצה על מבנה בוחרת אותו ואת הכוח שלו.</li></ul>
      <h3>פקודות</h3><ul><li>לחיצה על המפה = לאן. הכפתור בפינה מחליף בין <b>לתקוף</b> (חרב) ל<b>החזיק</b> (מגן).</li><li>לחיצה על אויב = תקיפה עליו.</li><li>גרירה בכפתור הימני = לאן, ולאיזה כיוון לעמוד.</li><li><kbd>R</kbd> = נסיגה הביתה.</li></ul>
      <h3>מצלמה</h3><p>גלגלת לזום, כפתור אמצעי או קצה המסך להזזה, או חיצים. בטלפון: אצבע אחת גוררת, שתיים מצביטות.</p>`],
    ['📡', 'פיקוד ושליטה', `<h2>פיקוד ושליטה</h2>
      <p>המשחק המלא הוא על <b>ערפל המלחמה</b>: אתה לא רואה הכל, והפקודות לא מגיעות מיד.</p>
      <h3>איכות שליטה</h3><p>סביב המפקדה, פיקוד קדמי, רחפן ומשאית קשר יש שליטה טובה (הכחול על המפה). שם פקודות מגיעות מהר ומדויק, והדיווחים נכונים. רחוק מהם — פקודות באיחור, "בערך", ולפעמים לא ברורות.</p>
      <h3>תמונת מצב</h3><p>כוח שלך רחוק מופיע איפה שהוא <b>דיווח</b>, לא איפה שהוא באמת. אויב מופיע ככתם אדום — ככל שהזיהוי טוב יותר, רואים סוג ומספר.</p>
      <h3>שקט אלחוטי 🤫</h3><p>כוח בשקט לא מדווח ולא נשמע אצל האויב, ונע לאט ובלי אבק. רכב שנוסע מהר מעלה אבק שנראה מרחוק.</p>
      <h3>לילה 🌙</h3><p>החושך יורד בהדרגה (יום של 8 דקות). בשיא: כולם — גם רחפנים, משאיות קשר ומבנים — רואים 40% פחות, יורים 20% פחות רחוק ופוגעים 25% פחות, והפקודות איטיות יותר.</p>
      <h3>מפקדים</h3><p>לכל כוח מפקד עם אופי (נועז, שקול, חרד). מפקד ששורד קרבות צובר ניסיון ⭐: מדווח מדויק יותר ומבין פקודות טוב יותר.</p>`],
    ['🗺', 'שדה הקרב', `<h2>שדה הקרב</h2><p>במפה הגדולה והענקית (לא בקטנה):</p>
      <h3>מבנים ניטרליים</h3><p>חייל (חי"ר, נ"ט, נ"מ) שנכנס למבנה כובש אותו ונשאר בפנים. חייל אויב מחזיר אותו לאף אחד, ושני — לאויב. קומנדו כובש ויוצא. אי אפשר להשמיד אותם, והם לא נספרים בעוצמה.</p>
      <ul><li>📡 רדאר (אחד, באמצע): כל הכוחות שלך רואים ויורים רחוק יותר ב-10%</li><li>⚡ תחנת כוח: הייצור מהיר ב-10% · ⛽ תחנת דלק: הרכבים מהירים ב-10%</li>
      <li>📦 מחסן: ממלא תחמושת · 🏥 בית חולים: חיילים מתרפאים מהר · 🛠️ מוסך: רכבים מתוקנים מהר</li>
      <li>🗼 מגדל תצפית: רואה רחוק מאוד · 📶 אנטנה: שליטה מלאה סביבה · 🧱 בונקר: עד 4 חיילים לידו חוטפים חצי נזק</li></ul>
      <h3>מזג אוויר</h3><p>🌧 גשם בכל המפה, ו-🌫 ערפל בוקר רק בשפלה (על ההר מעליו): כל אחד מוריד 20% מהראייה, מהטווח ומהפגיעה. מצטבר עם הלילה.</p>
      <h3>דרכים ומארבים</h3><p>רכב על דרך נוסע מהר ב-30%. חיילים וג'יפים שעומדים בשקט בין העצים ולא יורים — נראים רק מקרוב, או מרחפן ומשאית קשר.</p>
      <h3>פקודות בקול 🎙</h3><p>החזק <kbd>רווח</kbd> ודבר: "טנקים לרדאר", "כוח 2 לנקודה 4", "חיילים להחזיק בבונקר", "כולם לסגת". <kbd>Alt</kbd>+מספר שומר את המסך כנקודה, <kbd>Shift</kbd>+מספר קופץ אליה. "לשם" = איפה שהעכבר. Chrome או Edge, עם אינטרנט.</p>`],
    ['🪖', 'יחידות', () => wikiCards('unit')],
    ['🏗', 'מבנים', () => `<p>בונים מתפריט הבנייה 🏗 (<kbd>G</kbd>), רק איפה שהשטח ירוק. כל מבנה ייצור מקים כוח משלו וממלא אותו. הכוח הראשון יוצא מלא.</p>` + wikiCards('struct')],
    ['🚜', 'תמיכה ואספקה', `<h2>תמיכה ואספקה</h2>
      <h3>טרקטור 🚜</h3><p>בונה את המפקדה, פיקוד קדמי וכל מבנה — רק כשהוא עומד ליד האתר. בחר טרקטור ואז בנה, והוא ייסע. לחיצה על אתר בבנייה כשטרקטור נבחר שולחת אותו לשם. כל שתי דקות המפקדה שולחת עוד טרקטור (עד שלושה).</p>
      <h3>משאית קשר 📡</h3><p>רואה רחוק ונותנת שליטה סביבה. כל שתי דקות מגיעה עוד אחת (עד שלוש).</p>
      <h3>תחמושת</h3><p>ליחידות יש מלאי יריות. כשנגמר, היחידה נוסעת לבד למשאית אספקה או למבנה, ולא יורה עד שהתמלאה.</p>
      <h3>טיפול ותיקון</h3><p>יחידה פצועה (נקודה כתומה או אדומה עליה) הולכת לחובש או למכונאי. ליד מבנים שלך מתרפאים, ויחידות פנויות מתקנות מבנים פגועים.</p>
      <h3>רחפנים</h3><p>אחד חדש כל דקה. מטיסים מעל מקום כדי לראות ולשלוט שם, עד שנ"מ מפיל אותו.</p>`],
    ['⌨', 'מקשים', `<h2>מקשים</h2><ul>
      <li><kbd>1</kbd>–<kbd>9</kbd> בחירת סוג כוח · <kbd>0</kbd> כולם</li><li><kbd>A</kbd> לתקוף · <kbd>H</kbd> להחזיק · <kbd>R</kbd> לסגת</li>
      <li><kbd>G</kbd> בנייה · <kbd>B</kbd> פיקוד קדמי · <kbd>D</kbd> רחפן · <kbd>S</kbd> שקט אלחוטי · <kbd>P</kbd> שורה / קובייה</li>
      <li><kbd>L</kbd> לקשור / לפרק קבוצה · <kbd>Ctrl</kbd>+מספר קבוצה · <kbd>F</kbd> מסך מלא · <kbd>Esc</kbd> ביטול</li>
      <li><kbd>רווח</kbd> לחיצה = עצירה, החזקה = פקודה בקול · <kbd>Alt</kbd>+מספר שמירת נקודה · <kbd>Shift</kbd>+מספר קפיצה אליה</li></ul>`],
  ],
  en: [
    ['🎯', 'The goal', `<h2>The goal</h2>
      <p>You are <b>the commander</b>. You don't move soldiers one by one: you give your squads' commanders an <b>intent</b> — where to go, attack or hold — and they carry it out.</p>
      <h3>To win</h3><ul><li>Destroy the enemy's <b>HQ</b>, or</li><li>bring its whole army (squads and buildings) below the line on the power bar.</li></ul>
      <h3>To lose</h3><ul><li>Your HQ falls, or your power drops below the line.</li><li>At the start of a full game: your command tanks fall before the HQ stands.</li></ul>`],
    ['🕹', 'How to play', `<h2>How to play</h2>
      <h3>The start</h3><p>Pick where your HQ goes — in the green strip on your side. The bulldozer drives there and puts it up. Nothing else is built until it stands.</p>
      <h3>Picking</h3><ul><li>Click a squad to pick it; drag with the left button for a rectangle.</li><li>The buttons on top: ★ = all, then each kind (keys 1–9).</li><li>Click a building to pick it and its squad.</li></ul>
      <h3>Orders</h3><ul><li>Click the map = where to. The corner button switches <b>attack</b> (sword) and <b>hold</b> (shield).</li><li>Click an enemy = attack it.</li><li>Drag with the right button = where to, and which way to face.</li><li><kbd>R</kbd> = fall back home.</li></ul>
      <h3>Camera</h3><p>Wheel to zoom; middle button, the screen edge or the arrows to move. On a phone: one finger drags, two pinch.</p>`],
    ['📡', 'Command and control', `<h2>Command and control</h2>
      <p>The full game is about the <b>fog of war</b>: you don't see everything, and orders don't arrive at once.</p>
      <h3>Control</h3><p>Around the HQ, forward HQs, drones and signals trucks control is good (the blue on the map): orders arrive fast and exact, reports are right. Far from them orders come late, "roughly", and sometimes garbled.</p>
      <h3>The picture</h3><p>A squad of yours far away shows where it last <b>reported</b>, not where it really is. The enemy shows as a red blob — the better it's identified, the more you see of its kind and size.</p>
      <h3>Radio silence 🤫</h3><p>A silent squad doesn't report and isn't heard by the enemy; it moves slower and raises no dust. A vehicle driving fast raises dust seen from afar.</p>
      <h3>Night 🌙</h3><p>The dark comes on step by step (an 8-minute day). At its deepest everyone — drones, signals trucks and buildings too — sees 40% less, shoots 20% shorter and hits 25% less, and orders are slower.</p>
      <h3>Commanders</h3><p>Each squad has a commander with a temper (bold, steady, anxious). One who survives fights gains experience ⭐: truer reports, orders better understood.</p>`],
    ['🗺', 'The battlefield', `<h2>The battlefield</h2><p>On the big and huge maps (not the small one):</p>
      <h3>Neutral buildings</h3><p>A soldier (infantry, AT, AA) who walks into one takes it and stays inside. An enemy soldier makes it no one's, a second makes it theirs. A commando takes it and walks out. They can't be destroyed and don't count in power.</p>
      <ul><li>📡 Radar (one, in the middle): all your forces see and shoot 10% further</li><li>⚡ Power station: production 10% faster · ⛽ Fuel station: vehicles 10% faster</li>
      <li>📦 Depot: refills ammunition · 🏥 Hospital: soldiers heal fast · 🛠️ Motor pool: vehicles repaired fast</li>
      <li>🗼 Observation tower: sees very far · 📶 Antenna: full control round it · 🧱 Bunker: up to 4 soldiers by it take half the damage</li></ul>
      <h3>Weather</h3><p>🌧 Rain over the whole map, and 🌫 morning fog only on the plain (on a hill you're above it): each takes 20% off sight, range and hits. It adds up with the night.</p>
      <h3>Roads and ambushes</h3><p>A vehicle on a road goes 30% faster. Soldiers and jeeps standing still among trees, not firing, are seen only up close, or by a drone or signals truck.</p>
      <h3>Spoken orders 🎙</h3><p>Hold <kbd>Space</kbd> and speak: "tanks to the radar", "group 2 to point 4", "soldiers hold the bunker", "everyone retreat". <kbd>Alt</kbd>+number saves the view as a point, <kbd>Shift</kbd>+number jumps there. "There" = where the mouse is. Chrome or Edge, online.</p>`],
    ['🪖', 'Units', () => wikiCards('unit')],
    ['🏗', 'Buildings', () => `<p>Build from the build menu 🏗 (<kbd>G</kbd>), only where the ground is green. Each production building raises a squad of its own and keeps it full. The first squad comes out whole.</p>` + wikiCards('struct')],
    ['🚜', 'Support and supply', `<h2>Support and supply</h2>
      <h3>Bulldozer 🚜</h3><p>Puts up the HQ, forward HQs and every building — only while it stands by the site. Pick a bulldozer, then build, and it drives there. Clicking a site with a bulldozer picked sends it there. Every two minutes the HQ sends another (up to three).</p>
      <h3>Signals truck 📡</h3><p>Sees far and gives control around it. Another comes every two minutes (up to three).</p>
      <h3>Ammunition</h3><p>Units carry a store of shots. When it runs out a unit drives on its own to a supply truck or a building, and holds its fire until refilled.</p>
      <h3>Care and repair</h3><p>A hurt unit (an orange or red dot on it) goes to a medic or a mechanic. Near your buildings units heal, and idle units repair damaged buildings.</p>
      <h3>Drones</h3><p>A new one every minute. Fly it over a spot to see and command there, until AA brings it down.</p>`],
    ['⌨', 'Keys', `<h2>Keys</h2><ul>
      <li><kbd>1</kbd>–<kbd>9</kbd> pick a kind · <kbd>0</kbd> all</li><li><kbd>A</kbd> attack · <kbd>H</kbd> hold · <kbd>R</kbd> fall back</li>
      <li><kbd>G</kbd> build · <kbd>B</kbd> forward HQ · <kbd>D</kbd> drone · <kbd>S</kbd> radio silence · <kbd>P</kbd> line / block</li>
      <li><kbd>L</kbd> group / ungroup · <kbd>Ctrl</kbd>+number group · <kbd>F</kbd> full screen · <kbd>Esc</kbd> cancel</li>
      <li><kbd>Space</kbd> tap = pause, hold = spoken order · <kbd>Alt</kbd>+number save a point · <kbd>Shift</kbd>+number jump there</li></ul>`],
  ],
};
// the cards: every unit / building with its picture and the game's own numbers
function wikiCards(what) {
  const he = lang !== 'en', out = [];
  if (what === 'unit') {
    for (const ty of TYPE_KEYS) {
      const T = Sim.TYPES[ty], line = T.range ? (he ? `חיים ${T.hp} · מהירות ${T.speed} · טווח ${T.range}` : `health ${T.hp} · speed ${T.speed} · range ${T.range}`) : (he ? `חיים ${T.hp} · מהירות ${T.speed} · לא יורה` : `health ${T.hp} · speed ${T.speed} · doesn't fight`);
      out.push(`<div class="wikiCard"><canvas width="64" height="64" data-unit="${ty}"></canvas><div><b>${tn(ty)}</b><small>${line}</small><p>${WIKI_UNIT[he ? 'he' : 'en'][ty] || ''}</p></div></div>`);
    }
    return `<h2>${he ? 'יחידות' : 'Units'}</h2><div class="wikiCards">${out.join('')}</div>`;
  }
  for (const k of ['hq', 'fhq', ...Sim.BUILDABLE]) {
    const S = Sim.STRUCTS[k]; if (!S) continue;
    const line = S.unit ? (he ? `${tn(S.unit)} · כל ${S.every} ש׳ · בנייה ${S.build} ש׳` : `${tn(S.unit)} · every ${S.every}s · builds in ${S.build}s`) : S.build ? (he ? `בנייה ${S.build} ש׳` : `builds in ${S.build}s`) : '';
    out.push(`<div class="wikiCard"><canvas width="64" height="64" data-struct="${k}"></canvas><div><b>${sn(k)}</b><small>${line}</small><p>${WIKI_STRUCT[he ? 'he' : 'en'][k] || ''}</p></div></div>`);
  }
  return `<h2>${he ? 'מבנים' : 'Buildings'}</h2><div class="wikiCards">${out.join('')}</div>`;
}
let wikiAt = 0;
function wikiShow(i) {
  const pages = WIKI[lang === 'en' ? 'en' : 'he']; wikiAt = i;
  $('wikiNav').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  const body = pages[i][2]; $('wikiText').innerHTML = typeof body === 'function' ? body() : body; $('wikiText').scrollTop = 0;
  // (the cards' pictures, in our colour)
  $('wikiText').querySelectorAll('canvas[data-unit]').forEach(cv => { const ty = cv.dataset.unit; if (hasSprite(ty) && ty !== 'air') { const g = cv.getContext('2d'); g.clearRect(0, 0, 64, 64); drawUnitPic(g, ty, 32, 32, 58 / (SPRITE_LEN[ty] || 1.9), colors.blue, 0, 0); } else drawSquadIcon(cv, ty); }); // (vehicles: as big as the card allows)
  $('wikiText').querySelectorAll('canvas[data-struct]').forEach(cv => { const g = cv.getContext('2d'), p = buildingPic(cv.dataset.struct, colors.blue, 40); g.clearRect(0, 0, 64, 64); g.drawImage(p, -8, -8, 80, 80); });
}
function openWiki() {
  const pages = WIKI[lang === 'en' ? 'en' : 'he'], nav = $('wikiNav'); nav.textContent = '';
  pages.forEach(([ico, title], i) => { const b = document.createElement('button'); b.innerHTML = `<span aria-hidden="true">${ico}</span><span></span>`; b.lastChild.textContent = title; b.addEventListener('click', () => wikiShow(i)); nav.appendChild(b); });
  $('wiki').hidden = false; wikiShow(Math.min(wikiAt, pages.length - 1));
}
$('wikiBtn').addEventListener('click', openWiki);
$('wikiX').addEventListener('click', () => { $('wiki').hidden = true; });
$('wiki').addEventListener('click', e => { if (e.target === $('wiki')) $('wiki').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('wiki').hidden) { $('wiki').hidden = true; e.stopPropagation(); } }, true);
