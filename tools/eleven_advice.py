# Makes the explanations' voice files (the advisor, js/ui/advisor.js) with ElevenLabs into
# Speak/<English|Hebrew>/Instructions/<id>.mp3 — one narrator voice for all of them.
#   python tools/eleven_advice.py
# It asks (in English, so the console shows it right) for your key, the language, the model, the voice and the set:
# the 20 main lines (what a new player hears first, with the default arms — armor + infantry, the partner builds) or
# all of them. First one line as a test, then your OK for the rest. Files already there are skipped, so running it
# again only makes what's missing. The lines: Speak/Advice_lines.csv (node tools/advice_list.js — run here first).
# Then tools/voices.py runs by itself, and the game plays them instead of the browser's voice. No packages needed.
import csv, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import eleven as E  # (the key, the models and the voices: the same as the radio's)

ROOT = E.ROOT
LANG_KEY = {'English': 'en', 'Hebrew': 'he'}
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

    langs = list(LANG_KEY)
    lang = langs[E.choose('Language', langs)]; col = LANG_KEY[lang]
    L = lines()

    print()
    try:
        models = [m['model_id'] for m in E.json.loads(E.call('/models', key)) if m.get('can_do_text_to_speech')]
        models.sort(key=lambda m: ('v4' not in m, 'v3' not in m))
    except E.urllib.error.HTTPError:
        print('  (this key may not list the models; here are the known ones)'); models = E.KNOWN_MODELS
    k = E.choose('Model (the newest first)', models + ['type another model ID'])
    model = models[k] if k < len(models) else input('Model ID: ').strip()

    print(f'\n{lang} voices (one narrator for all the explanations):')
    names = []
    for vid in E.VOICES[lang]:
        try: n = E.json.loads(E.call(f'/voices/{vid}', key))['name']
        except E.urllib.error.HTTPError: n = vid
        names.append(n)
    k = E.choose('Voice', names + ['type another voice ID'])
    vid = E.VOICES[lang][k] if k < len(names) else input('Voice ID: ').strip()

    print()
    sets = []
    for title, ids in (('the 20 main lines', [i for i in MAIN if i in L]), ('all the lines', list(L))):
        todo = [i for i in ids if not os.path.exists(out_path(lang, i))]
        sets.append((todo, f'{title}: {len(ids)} lines, {sum(len(L[i][col]) for i in ids)} characters'
                     + (f' ({len(todo)} still to make, {sum(len(L[i][col]) for i in todo)} characters)' if len(todo) < len(ids) else '')))
    todo = sets[E.choose('Which set', [s[1] for s in sets])][0]
    if not todo: print('All made already.'); return
    cost = sum(len(L[i][col]) for i in todo)
    if left is not None and cost > left: sys.exit(f'{cost} characters is over the {left} left this month.')

    first = todo[0]
    print(f'\nTest: {first} — "{L[first][col]}"')
    say(key, model, vid, L[first][col], out_path(lang, first))
    if os.name == 'nt':
        try: os.startfile(os.path.abspath(out_path(lang, first)))
        except OSError: pass
    rest = todo[1:]
    if rest:
        print(f'\nListen to Speak/{lang}/Instructions/{first}.mp3. The rest: {len(rest)} lines, {cost - len(L[first][col])} characters.')
        if input('Make the rest? [y/N] ').strip().lower() not in ('y', 'yes'): print('Stopped. The test file is kept.'); rest = []
    for k, i in enumerate(rest, 1):
        say(key, model, vid, L[i][col], out_path(lang, i)); print(f'[{k}/{len(rest)}] {i}')
    import voices as V; V.build()
    print(f'\nDone. Open the game in {lang} (⚙ explanations: "from the start") to hear them.')

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt: print('\nStopped. The files made are kept.')
