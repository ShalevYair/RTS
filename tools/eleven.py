# Makes the radio voice files with ElevenLabs into Speak/<Language>/<event>/: every line recorded ONCE, the lines of
# each event dealt out across the language's voices — so one soldier says "We are under attack!", another "Taking fire!".
#   python tools/eleven.py
# It asks (in English, so the console shows it right) for your key, the language, the model
# (v4 first) and the set: 1 line per event, 4, or the full set (up to 16 for the common events). First the test: each
# event's first line, in turn in each voice (a few hundred characters), then your OK for the rest. It never spends more
# than BUDGET characters in a run; files already there are skipped, so running it again only makes what's missing.
# Then tools/voices.py runs by itself, and the game plays them. No packages needed.
import json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.join(os.path.dirname(__file__), '..')
API = 'https://api.elevenlabs.io/v1'
BUDGET = 9000

# the voices of each language (ElevenLabs voice IDs)
VOICES = {
    'English': ['AyUH0Pu6NRwQV6bOdfNx', 'ESNrF6xSj96uiykXXT1f', '5bh6Hc8SO3Yh1skN9Cqm', '9D11mwho5zJsFlhRnewD', 'U0xH5XqH9N0NawL9bdEo',
                'Vs5CmVCVJwW4odQS2pVf', 'zYcjlYFOd3taleS0gkk3', '87tjwokZlpNU7QL3HaLP', 'eCGXfCpGinKGrwYNoBuo', '0wg6fPA7PA9n5PKb8N2e'],
    'Hebrew': ['yGpVFXFoImvRvaURKypy', 'JIxTgeeS5w0UQyBxEnrl', 'k77ZRVqAFg9Hd0ltAuON', 'uwHajH4FhtzVp6X17pr7', '1WOvbtTEb49xcgFUMDu9'],
}

# short radio lines, each costing its length in characters (audio tags too). The [tags] direct the delivery on Eleven
# v3 / v4 (older models get the lines without them); CAPITALS add weight; "..." a pause. The sets take each event's
# first 1 / 4 / all lines, so the most telling ones come first. New lines go at the END (a file is named by its number).
# Hebrew: men and women speak, so every line is plural ("we") or the same for both ("קיבלתי").
LINES = {
  'English': {
    'selected': ["Yes, sir.", "Awaiting orders.", "Standing by.", "Go ahead, command.", "Ready.", "Orders?", "[tired] What now?",
                 "Listening.", "Sir?", "We read you.", "Command, go.", "Ready when you are.", "What's the plan?", "At your service.",
                 "[low, gravelly voice] Talk to me.", "Yes, command?"],
    'on_the_way': ["On the way.", "Moving out.", "Roger, moving.", "En route.", "Copy that, moving.", "[excited] Let's go, let's GO!",
                   "Wilco.", "Heading there now.", "Understood.", "On it.", "Moving, moving.", "Roger that.", "Copy, on our way.",
                   "Move out, boys!"],
    'attacking': ["[shouting] Attacking!", "[shouting] Engaging!", "[shouting] Going in!", "[shouting] Weapons free!",
                  "[shouting] Hit them HARD!", "[shouting] Charge!", "Target in sight... engaging.", "[shouting] Open fire!",
                  "[shouting] Take them out!", "[shouting] Show them what we've got!", "Roger. Engaging the enemy.",
                  "[shouting] For the regiment!"],
    'holding': ["Holding position.", "Digging in.", "We hold here.", "Holding the line.", "[low, gravelly voice] Nobody gets through.",
                "Setting up a defense.", "We stay put.", "Roger, holding."],
    'retreating': ["[shouting] Falling back!", "[shouting] Pull out, pull out!", "Withdrawing.", "[shouting] Back, BACK!",
                   "Breaking contact.", "[shouting] Retreat!", "Heading home."],
    'in_position': ["In position.", "We're here.", "Objective reached.", "Position secured.", "In place, command.", "Area is ours.",
                    "Arrived.", "On site.", "All set.", "Area secure.", "We made it."],
    'under_attack': ["[shouting] We are under attack!", "[shouting] Contact! CONTACT!", "[shouting] Taking fire!",
                     "[shouting] They're on us!", "[shouting] Incoming!", "[shouting] We've got company!", "[shouting] Enemy, close!",
                     "[shouting] Ambush!", "[shouting] Hostiles, engaging!", "[shouting] Under fire!", "[shouting] Get down!",
                     "[shouting] Enemy contact!"],
    'heavy_losses': ["[shouting] Heavy losses!", "[shouting] We're getting hammered!", "[shouting] Can't hold, pulling back!",
                     "[shouting] MEDIC!", "[shouting] We're losing men!", "[shouting] Need help here!", "[shouting] Too many of them!"],
    'squad_lost': ["[grim] Squad down.", "[grim] We lost them...", "[sighs] Unit destroyed.", "[grim] They're gone.",
                   "[grim] No answer from them..."],
    'friendly_fire': ["[shouting] Cease fire! Friendlies!", "[shouting] Check your fire!", "[shouting] Blue on blue!",
                      "[shouting] Hold fire, those are ours!", "[shouting] You're hitting us!"],
    'promoted': ["We're veterans now.", "Battle hardened, sir.", "[laughs] Getting good at this.", "The boys are learning fast."],
    'say_again': ["[confused] Say again?", "Message unclear.", "You're breaking up...", "[confused] Repeat, command?",
                  "[confused] Didn't catch that.", "Signal's bad."],
    'forward_hq': ["Setting up forward command.", "Forward post going up.", "Building a command post here.", "Forward HQ, setting up."],
    'building_lost': ["[shouting] Building down!", "[shouting] They hit our base!", "Structure lost.", "[grim] We lost a building.",
                      "[shouting] Base structure destroyed!"],
    'base_attack': ["[shouting] The base is under attack!", "[shouting] Enemy at the base!", "[shouting] They're hitting our base!",
                    "[shouting] Base under fire!", "[shouting] Defend the base!", "[shouting] Hostiles in the base!"],
    'fhq_attack': ["[shouting] Forward HQ under attack!", "[shouting] The forward post is taking fire!",
                   "[shouting] Enemy at the forward post!", "[shouting] Forward command needs help!",
                   "[shouting] They found the forward post!"],
    'hq_attack': ["[shouting] Headquarters under attack!", "[shouting] They're at the HQ!", "[shouting] Protect the HQ!",
                  "[shouting] HQ taking fire!", "[shouting] All units, defend headquarters!", "[shouting] The command post is hit!"],
  },
  'Hebrew': {
    'selected': ["כן, המפקדה.", "ממתינים לפקודות.", "כאן, מקשיבים.", "המפקדה, עבור.", "מוכנים.", "מה הפקודה?", "[tired] מה עכשיו?",
                 "בהאזנה.", "שומעים אותך.", "מחכים להוראות.", "כאן כוח, עבור.", "מוכנים כשתרצו.", "מה התוכנית?", "כולם מוכנים.",
                 "[low, gravelly voice] אנחנו על הקשר.", "קיבלנו, עבור."],
    'on_the_way': ["בדרך.", "זזים.", "קיבלתי, זזים.", "יוצאים לדרך.", "מתקדמים.", "רשמתי, בתנועה.", "יוצאים עכשיו.", "הבנתי.",
                   "על זה.", "בתנועה, בתנועה.", "קיבלתי.", "מתקדמים ליעד.", "[excited] יאללה, זזים!", "קדימה, כולם אחריי!"],
    'attacking': ["[shouting] תוקפים!", "[shouting] פותחים באש!", "[shouting] נכנסים!", "[shouting] אש חופשית!",
                  "[shouting] מכים בהם חזק!", "[shouting] הסתערות!", "מטרה בעין... פותחים באש.", "[shouting] אש! אש!",
                  "[shouting] מחסלים אותם!", "[shouting] קדימה, להסתער!", "קיבלתי. תוקפים את האויב.", "[shouting] אחריי!"],
    'holding': ["מחזיקים עמדה.", "מתבצרים.", "נשארים כאן.", "מחזיקים את הקו.", "[low, gravelly voice] אף אחד לא עובר.",
                "נערכים להגנה.", "לא זזים מכאן.", "קיבלתי, מחזיקים."],
    'retreating': ["[shouting] נסוגים!", "[shouting] החוצה, החוצה!", "מתנתקים.", "[shouting] אחורה, אחורה!", "שוברים מגע.",
                   "[shouting] נסיגה!", "חוזרים הביתה."],
    'in_position': ["בעמדה.", "הגענו.", "היעד הושג.", "העמדה מאובטחת.", "במקום, המפקדה.", "השטח בידינו.", "הגענו ליעד.",
                    "בשטח.", "הכל מוכן.", "השטח נקי.", "עשינו את זה."],
    'under_attack': ["[shouting] אנחנו תחת התקפה!", "[shouting] מגע! מגע!", "[shouting] חוטפים אש!", "[shouting] הם עלינו!",
                     "[shouting] ירי נכנס!", "[shouting] יש לנו אורחים!", "[shouting] אויב, קרוב!", "[shouting] מארב!",
                     "[shouting] כוח אויב, מגיבים!", "[shouting] תחת אש!", "[shouting] לתפוס מחסה!", "[shouting] מגע עם האויב!"],
    'heavy_losses': ["[shouting] אבדות כבדות!", "[shouting] חוטפים חזק!", "[shouting] לא מחזיקים, נסוגים!", "[shouting] חובש!",
                     "[shouting] יש לנו נפגעים!", "[shouting] צריכים עזרה כאן!", "[shouting] הם רבים מדי!"],
    'squad_lost': ["[grim] כוח אבד.", "[grim] איבדנו אותם...", "[sighs] הכוח הושמד.", "[grim] הם אינם.", "[grim] אין מהם תשובה..."],
    'friendly_fire': ["[shouting] חדל אש! כוחותינו!", "[shouting] ירי על כוחותינו!", "[shouting] לעצור אש, אלה שלנו!",
                      "[shouting] אתם יורים עלינו!", "[shouting] לבדוק את הירי!"],
    'promoted': ["אנחנו ותיקים עכשיו.", "צברנו ניסיון.", "[laughs] מתחילים להשתפר בזה.", "החבר'ה לומדים מהר."],
    'say_again': ["[confused] אפשר שוב?", "ההודעה לא ברורה.", "הקשר נקטע...", "[confused] לא הבנו, שוב?", "[confused] לא קלטנו.",
                  "הקליטה גרועה."],
    'forward_hq': ["מקימים פיקוד קדמי.", "העמדה הקדמית עולה.", "מקימים כאן מוצב פיקוד.", "פיקוד קדמי, בהקמה."],
    'building_lost': ["[shouting] מבנה נפל!", "[shouting] פגעו לנו בבסיס!", "מבנה אבד.", "[grim] איבדנו מבנה.",
                      "[shouting] מבנה בבסיס הושמד!"],
    'base_attack': ["[shouting] הבסיס תחת התקפה!", "[shouting] אויב בבסיס!", "[shouting] תוקפים לנו את הבסיס!",
                    "[shouting] הבסיס תחת אש!", "[shouting] להגן על הבסיס!", "[shouting] כוחות אויב בתוך הבסיס!"],
    'fhq_attack': ["[shouting] הפיקוד הקדמי תחת התקפה!", "[shouting] העמדה הקדמית חוטפת אש!", "[shouting] אויב בעמדה הקדמית!",
                   "[shouting] הפיקוד הקדמי צריך עזרה!", "[shouting] גילו את העמדה הקדמית!"],
    'hq_attack': ["[shouting] המפקדה תחת התקפה!", "[shouting] הם במפקדה!", "[shouting] להגן על המפקדה!",
                  "[shouting] המפקדה חוטפת אש!", "[shouting] כל הכוחות, להגן על המפקדה!", "[shouting] פגעו במפקדה!"],
  },
}
HEATED = {'attacking', 'under_attack', 'heavy_losses', 'friendly_fire', 'retreating', 'building_lost', 'base_attack', 'fhq_attack', 'hq_attack'}
KNOWN_MODELS = ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5']
SETS = [('basic: 1 line per event', 1), ('4 lines per event', 4), ('full: up to 16 for the common events', 99)]

def call(path, key, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    with urllib.request.urlopen(req, timeout=90) as r: return r.read()

def out_path(lang, ev, i, name): return os.path.join(ROOT, 'Speak', lang, ev, f'{name}_{i}.mp3')

def say(key, model, vid, ev, line, out):
    hot = ev in HEATED
    if not any(k in model for k in ('v3', 'v4')): line = re.sub(r'\[[^\]]*\]\s*', '', line)
    body = {'text': line, 'model_id': model}
    if any(k in model for k in ('v2', 'turbo', 'flash')):  # (the newer models take their own settings; left to them)
        body['voice_settings'] = {'stability': 0.3 if hot else 0.5, 'similarity_boost': 0.75, 'style': 0.45 if hot else 0.15, 'use_speaker_boost': True}
    for tries in range(5):
        try: data = call(f'/text-to-speech/{vid}?output_format=mp3_44100_128', key, body); break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='ignore')[:300]
            if e.code == 429: time.sleep(5 * (tries + 1)); continue
            if e.code in (400, 422) and 'voice_settings' in body: body.pop('voice_settings'); continue
            sys.exit(f'\nElevenLabs refused ({e.code}): {msg}')
    else: sys.exit('\nToo many requests; run it again later (the files made are kept).')
    os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'wb').write(data)

def plan(lines, names, ids, per):
    # every line once: event e's first line in voice e, its next lines in the voices after (so the test — each event's
    # first line — goes round all the voices)
    out = []
    for e, (ev, ls) in enumerate(lines.items()):
        for i, line in enumerate(ls[:per], 1):
            v = (e + i - 1) % len(names)
            out.append((ev, i, line, names[v], ids[v]))
    return out

def choose(prompt, options):
    for i, o in enumerate(options, 1): print(f'  {i}. {o}')
    while True:
        a = input(f'{prompt} [1]: ').strip() or '1'
        if a.isdigit() and 1 <= int(a) <= len(options): return int(a) - 1

def main():
    print('ElevenLabs radio voices for The Commander\n')
    label = input('Key name (just a label for you): ').strip() or 'key'
    key = input(f'The API key "{label}": ').strip().strip('"\'')
    if not key: sys.exit('No key.')
    print(f'  Using: {key[:4]}...{key[-4:]} ({len(key)} characters)')
    try: sub = json.loads(call('/user/subscription', key)); left = sub['character_limit'] - sub['character_count']
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors='ignore')[:300]
        if 'permission' not in msg.lower(): sys.exit(f'The key did not work ({e.code}): {msg}')
        # a key without the "User: read" permission: fine, just no count of what's left
        print('  (this key may not read the account, so the characters left are unknown; that is fine)'); left = None
    budget = min(BUDGET, left) if left is not None else BUDGET
    print(f'OK. Characters left this month: {left if left is not None else "?"}. This run spends at most {budget}.\n')

    langs = list(LINES)
    lang = langs[choose('Language', langs)]; lines = LINES[lang]

    print()
    try:
        models = [m['model_id'] for m in json.loads(call('/models', key)) if m.get('can_do_text_to_speech')]
        models.sort(key=lambda m: ('v4' not in m, 'v3' not in m))
    except urllib.error.HTTPError:  # (a key without the "Models" permission: the known ones, or type one)
        print('  (this key may not list the models; here are the known ones)'); models = KNOWN_MODELS
    k = choose('Model (the newest first)', models + ['type another model ID'])
    model = models[k] if k < len(models) else input('Model ID: ').strip()

    print(f'\n{lang} voices:')
    names, ids = [], []
    for vid in VOICES[lang]:
        try: v = json.loads(call(f'/voices/{vid}', key))
        except urllib.error.HTTPError as e:
            if e.code != 401: print(f'  - {vid}: not reachable ({e.code}); add it to "My Voices" in the Voice Library. Skipped.'); continue
            v = {'name': f'v{len(names) + 1}'}  # (a key without the "Voices" permission: no names, the ID still speaks)
        n = re.sub(r'[^A-Za-z0-9]', '', v['name'].split(' ')[0]) or 'v' + vid[:5]
        while n in names: n += 'x'
        names.append(n); ids.append(vid); print(f'  {len(names):2}. {v["name"]}')
    if not names: sys.exit('No voice reachable.')

    print()
    opts = []
    for title, per in SETS:
        p = plan(lines, names, ids, per); todo = [t for t in p if not os.path.exists(out_path(lang, t[0], t[1], t[3]))]
        opts.append((todo, f'{title}: {len(p)} lines, {sum(len(t[2]) for t in p)} characters' + (f' ({len(todo)} still to make, {sum(len(t[2]) for t in todo)} characters)' if len(todo) < len(p) else '')))
    todo = opts[choose('Which set', [o[1] for o in opts])][0]
    cost = sum(len(t[2]) for t in todo)
    if not todo: print('All made already.'); return
    if cost > budget: sys.exit(f'{cost} characters is over {budget}. Pick a smaller set, or run it next month.')

    # the test: each event's first line, round the voices; then your OK
    test = [t for t in todo if t[1] == 1] or todo[:1]
    print(f'\nTest: {len(test)} lines, each event\'s first one, round the voices ({sum(len(t[2]) for t in test)} characters, part of the total)…')
    for ev, i, line, n, vid in test: say(key, model, vid, ev, line, out_path(lang, ev, i, n)); print(f'  {n:<12} {ev}/{n}_{i}.mp3')
    if os.name == 'nt':
        try: os.startfile(os.path.abspath(os.path.join(ROOT, 'Speak', lang, test[0][0])))
        except OSError: pass
    rest = [t for t in todo if t not in test]
    if rest:
        print(f'\nListen to them in Speak/{lang}/<event>/. The rest: {len(rest)} lines, {sum(len(t[2]) for t in rest)} characters.')
        if input('Make the rest? [y/N] ').strip().lower() not in ('y', 'yes'): print('Stopped. The test files are kept.'); rest = []
    for k, (ev, i, line, n, vid) in enumerate(rest, 1):
        say(key, model, vid, ev, line, out_path(lang, ev, i, n)); print(f'[{k}/{len(rest)}] {ev}/{n}_{i}')
    sys.path.insert(0, os.path.dirname(__file__)); import voices as V; V.build()
    print(f'\nDone. Open the game in {lang} to hear them.')

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\nStopped. The files made are kept.')
