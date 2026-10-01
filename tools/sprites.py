# Builds js/ui/sprites.js from the pictures in art/: each one cut out of its background (a painted checkerboard or
# plain white; the white one's soft shadow kept as a see-through dark), turned to face right, cropped, scaled down,
# and written in as a data URI (so the game can recolour it even when opened straight from the disk).
#   python tools/sprites.py
# Needs Pillow. A picture's pivot (where it turns: a turret's ring) is given in the source picture's pixels.
import base64, io, os
from collections import deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
# name: (file, background ('white'; 'bluish' = white with a bluish shadow; 'checker'), flip left-right, pivot in the source or None = the middle, longest side out)
SPRITES = {
    'jeep':        ('jeep.jpg',        'bluish',  False, None,       256),
    'tank_hull':   ('tank_hull.jpg',   'bluish',  False, (517, 506), 256),
    'tank_turret': ('tank_turret.jpg', 'bluish',  False, (322, 600), None),  # (the hull's scale: they fit together)
    'ajeep':       ('jeep_aa.jpg',     'bluish',  False, None,       256),
    'tjeep':       ('jeep_at.jpg',     'bluish',  False, None,       256),
    'truck':       ('truck.jpg',       'bluish',  False, None,       256),
    'mech':        ('mech.jpg',        'bluish',  False, None,       256),
    'air':         ('plane.jpg',       'bluish',  False, None,       256),
    'dozer':       ('dozer.jpg',       'bluish',  False, None,       256),  # (these two: only once they're in art/)
    'radio':       ('radio.jpg',       'bluish',  False, None,       256),
    'drone':       ('drone.jpg',       'pure',    False, None,       192),  # (pure white only: the rotor discs are light grey)
    # soldiers (only once they're in art/): rifleman, anti-tank, anti-air, medic
    'inf':         ('inf.jpg',         'white',   False, None,       160),
    'at':          ('at.jpg',          'white',   False, None,       160),
    'aa':          ('aa.jpg',          'white',   False, None,       160),
    'med':         ('med.jpg',         'white',   False, None,       160),
}

# and every building picture in art/ (b_<kind>.jpg / .png: seen at a slant from the south, on white)
for f in sorted(os.listdir(os.path.join(ROOT, 'art'))):
    n, ext = os.path.splitext(f)
    if n.startswith('b_') and not n.endswith('_old') and ext.lower() in ('.jpg', '.jpeg', '.png') and n not in SPRITES: SPRITES[n] = (f, 'white', False, None, 320)

# and the scenery (art/Background/tree*, bush*, rock*: from above, on white; not rocky, the hills' ground) as d_<name>, small
for f in sorted(os.listdir(os.path.join(ROOT, 'art', 'Background'))) if os.path.isdir(os.path.join(ROOT, 'art', 'Background')) else []:
    n, ext = os.path.splitext(f)
    if n.startswith(('tree', 'bush', 'rock')) and n != 'rocky' and ext.lower() in ('.jpg', '.jpeg', '.png'): SPRITES['d_' + n] = ('Background/' + f, 'white', False, None, 128)

SHADOW_K = 0

def cut(im, bg):
    im = im.convert('RGBA'); W, H = im.size; px = im.load()
    def grey(p): r, g, b, _ = p; return max(r, g, b) - min(r, g, b) < 16
    if bg == 'checker': is_bg = lambda p: grey(p) and 140 <= p[0] <= 240
    elif bg == 'bluish': is_bg = lambda p: max(p[:3]) - min(p[:3]) < 40 and min(p[:3]) >= 150  # (white, and its shadow, a little bluish)
    elif bg == 'pure': is_bg = lambda p: grey(p) and p[0] >= 238
    else: is_bg = lambda p: grey(p) and p[0] >= 150  # (plain grey only: a building's light grey runway stays)
    seen = bytearray(W * H); q = deque((x, y) for x in range(W) for y in (0, H - 1))
    q.extend((x, y) for y in range(H) for x in (0, W - 1))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or seen[y * W + x]: continue
        seen[y * W + x] = 1
        p = px[x, y]
        if not is_bg(p): continue
        if bg != 'checker':  # the shadow: how much darker than white, as a see-through black (SHADOW_K 0: none —
            # the game draws each shadow itself, always the same way however the unit turns)
            a = max(0, min(1, (242 - min(p[:3])) / 80)) * 0.55 * SHADOW_K
            px[x, y] = (0, 0, 0, int(a * 255))
        else:
            px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    if bg == 'pure':  # the light grey left (a drone's spinning rotor discs): see-through, by how light
        for y in range(H):
            for x in range(W):
                p = px[x, y]
                if p[3] and grey(p) and p[0] > 150: px[x, y] = (p[0], p[1], p[2], int(255 * max(0.12, min(1, (235 - p[0]) / 150))))
    if bg not in ('checker', 'pure'):  # white pockets shut in by the picture (under a net, behind a bumper): big ones go too
        bright = lambda p: p[3] == 255 and grey(p) and p[0] >= 222
        for y0 in range(H):
            for x0 in range(W):
                if seen[y0 * W + x0] or not bright(px[x0, y0]): continue
                blob, q = [], deque([(x0, y0)]); seen[y0 * W + x0] = 1
                while q:
                    x, y = q.popleft(); blob.append((x, y))
                    for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= n[0] < W and 0 <= n[1] < H and not seen[n[1] * W + n[0]] and bright(px[n]):
                            seen[n[1] * W + n[0]] = 1; q.append(n)
                if len(blob) >= 250:
                    for b in blob: px[b] = (0, 0, 0, int(max(0, min(1, (242 - px[b][0]) / 80)) * 0.55 * SHADOW_K * 255))
    return im

def build():
    out, hull_k = {}, None
    for name, (f, bg, flip, pivot, size) in SPRITES.items():
        if not os.path.exists(os.path.join(ROOT, 'art', f)): print(name, '- no', f, 'yet'); continue
        im = cut(Image.open(os.path.join(ROOT, 'art', f)), bg)
        W = im.size[0]
        bb = im.getbbox(); im = im.crop(bb)
        pv = (pivot[0] - bb[0], pivot[1] - bb[1]) if pivot else (im.size[0] / 2, im.size[1] / 2)
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT); pv = (im.size[0] - pv[0], pv[1])
        k = size / max(im.size) if size else hull_k
        if name == 'tank_hull': hull_k = k
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
        out[name] = { 'src': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), 'w': im.size[0], 'h': im.size[1], 'px': round(pv[0] * k, 1), 'py': round(pv[1] * k, 1) }
        print(name, im.size, 'pivot', out[name]['px'], out[name]['py'], len(b.getvalue()) // 1024, 'KB')
    # the buttons' icons (art/icon_<name>: white on black) — white, see-through by how dark: ICONS.<name>
    icons = {}
    for f in sorted(os.listdir(os.path.join(ROOT, 'art'))):
        n, ext = os.path.splitext(f)
        if not n.startswith('icon_') or ext.lower() not in ('.jpg', '.jpeg', '.png'): continue
        g = Image.open(os.path.join(ROOT, 'art', f)).convert('L').point(lambda v: 0 if v < 40 else min(255, (v - 40) * 255 // 170))
        g = g.crop(g.point(lambda v: 255 if v > 60 else 0).getbbox())
        side = max(g.size); sq = Image.new('L', (side, side), 0); sq.paste(g, ((side - g.size[0]) // 2, (side - g.size[1]) // 2))
        sq = sq.resize((96, 96), Image.LANCZOS); im = Image.new('RGBA', sq.size, (255, 255, 255, 0)); im.putalpha(sq)
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); icons[n[5:]] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
        print('icon', n[5:], len(b.getvalue()) // 1024, 'KB')
    js = ['// generated by tools/sprites.py from art/ — do not edit by hand', 'const SPRITES = {']
    for n, d in out.items():
        js.append(f"  {n}: {{ w: {d['w']}, h: {d['h']}, px: {d['px']}, py: {d['py']}, src: '{d['src']}' }},")
    js.append('};')
    js.append('const ICONS = {')
    for n, d in icons.items(): js.append(f"  {n}: '{d}',")
    js.append('};')
    open(os.path.join(ROOT, 'js', 'ui', 'sprites.js'), 'w', encoding='utf-8').write('\n'.join(js) + '\n')

build()
