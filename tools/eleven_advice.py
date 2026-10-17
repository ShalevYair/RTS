# Makes the explanations' voice files (the advisor, js/ui/advisor.js) with ElevenLabs into
# Speak/<English|Hebrew>/Instructions/<id>.mp3 — one narrator voice per language.
#   python tools/eleven_advice.py
# Both languages, each in its narrator's voice (VOICE). It asks (in English, so the console shows it right) for your
# key, the model and the set: the 20 main lines (what a new player hears first, with the default arms — armor + infantry, the partner builds) or
# all of them. First the first line in each language as a test, then your OK for the rest. Files already there are skipped, so running it
# again only makes what's missing. The lines: Speak/Advice_lines.csv (node tools/advice_list.js — run here first).
# Then tools/voices.py runs by itself, and the game plays them instead of the browser's voice. No packages needed.
import csv, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import eleven as E  # (the key, the models and the voices: the same as the radio's)

ROOT = E.ROOT
LANG_KEY = {'English': 'en', 'Hebrew': 'he'}
# the narrator of each language (ElevenLabs voice IDs)
VOICE = {'English': 'XfNU2rGpBa01ckF309OY', 'Hebrew': 'UZzDIQRRTW2Id7YBcbgC'}
# the first 20 a new player hears (default arms: armor + infantry; engineering with the partner)
MAIN = ['intro_goal', 'intro_mate', 'arms_armor_infantry', 'hq_mate', 'intro_supply', 'intro_off', 'hq_ready',
        'matechain_armor', 'matechain_infantry', 'why_nohq_mate', 'needm_tankshop', 'tech',
        'f_select', 'f_fronts', 'f_dry', 'f_post', 'f_wheel', 'f_night', 'f_missile', 'f_hqhit']

def out_path(lang, i): return os.path.join(ROOT, 'Speak', lang, 'Instructions', f'{i}.mp3')

def lines():
    try: subprocess.run(['node', os.path.join(ROOT, 'tools', 'advice_list.js')], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError): print('  (node not found; using Speak/Advice_lines.csv as it is)')
    with open(os.path.join(ROOT, 'Speak', 'Advice_lines.csv'), encoding='utf-8-sig', newline='') as f:
        return {r['id']: r for r in csv.DictReader(f)}

def cost_of(L, todo): return sum(len(L[i][LANG_KEY[lang]]) for lang, i in todo)

def say(key, model, vid, line, out):
    body = {'text': line, 'model_id': model}
    if any(k in model for k in ('v2', 'turbo', 'flash')):
        body['voice_settings'] = {'stability': 0.55, 'similarity_boost': 0.75, 'style': 0.1, 'use_speaker_boost': True}
    for tries in range(5):
        try: data = E.call(f'/text-to-speech/{vid}?output_format=mp3_44100_128', key, body); break
        except E.urllib.error.HTTPError as e:
            msg = e.read().decode(errors='ignore')[:300]
            if e.code == 429: E.time.sleep(5 * (tries + 1)); continue
            if e.code in (400, 422) and 'voice_settings' in body: body.pop('voice_settings'); continue
            sys.exit(f'\nElevenLabs refused ({e.code}): {msg}')
    else: sys.exit('\nToo many requests; run it again later (the files made are kept).')
    os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'wb').write(data)

def main():
    print('ElevenLabs explanations voice for The Commander\n')
    key = input('The API key: ').strip().strip('"\'')
    if not key: sys.exit('No key.')
    print(f'  Using: {key[:4]}...{key[-4:]} ({len(key)} characters)')
    try: sub = E.json.loads(E.call('/user/subscription', key)); left = sub['character_limit'] - sub['character_count']
    except E.urllib.error.HTTPError as e:
        msg = e.read().decode(errors='ignore')[:300]
        if 'permission' not in msg.lower(): sys.exit(f'The key did not work ({e.code}): {msg}')
        print('  (this key may not read the account, so the characters left are unknown; that is fine)'); left = None
    print(f'OK. Characters left this month: {left if left is not None else "?"}.\n')

    L = lines()

    print()
    try:
        models = [m['model_id'] for m in E.json.loads(E.call('/models', key)) if m.get('can_do_text_to_speech')]
        models.sort(key=lambda m: ('v4' not in m, 'v3' not in m))
    except E.urllib.error.HTTPError:
        print('  (this key may not list the models; here are the known ones)'); models = E.KNOWN_MODELS
    k = E.choose('Model (the newest first)', models + ['type another model ID'])
    model = models[k] if k < len(models) else input('Model ID: ').strip()

    print('\nVoices:')
    for lang, vid in VOICE.items():
        try: n = E.json.loads(E.call(f'/voices/{vid}', key))['name']
        except E.urllib.error.HTTPError as e:
            n = '?' if e.code == 401 else None  # (401: a key without "Voices – read"; the ID still speaks)
            if n is None: sys.exit(f'  {lang}: voice {vid} not reachable ({e.code}); add it to "My Voices" in the Voice Library.')
        print(f'  {lang}: {n} ({vid})')

    # both languages, the same set
    print()
    sets = []
    for title, ids in (('the 20 main lines', [i for i in MAIN if i in L]), ('all the lines', list(L))):
        todo = [(lang, i) for lang in VOICE for i in ids if not os.path.exists(out_path(lang, i))]
        full = sum(len(L[i][LANG_KEY[lang]]) for lang in VOICE for i in ids)
        sets.append((todo, f'{title}, English + Hebrew: {2 * len(ids)} files, {full} characters'
                     + (f' ({len(todo)} still to make, {cost_of(L, todo)} characters)' if len(todo) < 2 * len(ids) else '')))
    todo = sets[E.choose('Which set', [s[1] for s in sets])][0]
    if not todo: print('All made already.'); return
    cost = cost_of(L, todo)
    if left is not None and cost > left: sys.exit(f'{cost} characters is over the {left} left this month.')

    # the test: the first line in each language; then your OK
    test = [next(t for t in todo if t[0] == lang) for lang in VOICE if any(t[0] == lang for t in todo)]
    print('\nTest:')
    for lang, i in test:
        line = L[i][LANG_KEY[lang]]; print(f'  {lang}/Instructions/{i}.mp3 — {line if lang == "English" else ""}')
        say(key, model, VOICE[lang], line, out_path(lang, i))
        if os.name == 'nt':
            try: os.startfile(os.path.abspath(out_path(lang, i)))
            except OSError: pass
    rest = [t for t in todo if t not in test]
    if rest:
        print(f'\nListen to them in Speak/<English|Hebrew>/Instructions/. The rest: {len(rest)} files, {cost_of(L, rest)} characters.')
        if input('Make the rest? [y/N] ').strip().lower() not in ('y', 'yes'): print('Stopped. The test files are kept.'); rest = []
    for k, (lang, i) in enumerate(rest, 1):
        say(key, model, VOICE[lang], L[i][LANG_KEY[lang]], out_path(lang, i)); print(f'[{k}/{len(rest)}] {lang}/{i}')
    import voices as V; V.build()
    print('\nDone. In the game: gear, explanations, "from the start" — to hear them.')

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\nStopped. The files made are kept.')
