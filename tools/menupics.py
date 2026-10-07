"""Main-menu pictures: art/menu/*.jpg|png -> js/ui/menupics.js (MENU_PICS, data URIs — works from file:// too).
The white studio background (and its soft grey floor shadow) is taken off: everything near-white and grey that
touches the border is cleared, with a soft edge; then cropped and scaled to MAX_W."""
import base64, io, pathlib, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT, MAX_W = ROOT / 'art' / 'menu', ROOT / 'js' / 'ui' / 'menupics.js', 520
LIGHT, GREY, HOLE = 196, 22, 1500  # (background: every channel above LIGHT, and channels within GREY of each other)

def cut(path):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int)
    lo, hi = a.min(2), a.max(2)
    bgish = (lo > LIGHT) & (hi - lo < GREY)
    lab, n = ndimage.label(bgish)
    sizes = ndimage.sum(bgish, lab, range(n + 1))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge | {i for i in range(1, n + 1) if sizes[i] > HOLE}))  # (and big closed pockets: under the barrel)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA'); out.putalpha(alpha)
    box = out.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox(); out = out.crop(box)
    if out.width > MAX_W: out = out.resize((MAX_W, round(out.height * MAX_W / out.width)), Image.LANCZOS)
    buf = io.BytesIO(); out.save(buf, 'WEBP', quality=88); return out, buf.getvalue()

def main():
    pics = {}
    for p in sorted(SRC.glob('*.*')):
        if p.suffix.lower() not in ('.jpg', '.jpeg', '.png'): continue
        out, data = cut(p); pics[p.stem] = (out.size, data)
        print(p.name, out.size, len(data) // 1024, 'KB')
    js = '// made by tools/menupics.py from art/menu — do not edit\nconst MENU_PICS = {\n' + ''.join(
        f"  {k}: {{ w: {w}, h: {h}, src: 'data:image/webp;base64,{base64.b64encode(d).decode()}' }},\n" for k, ((w, h), d) in pics.items()) + '};\n'
    OUT.write_text(js, encoding='utf-8')

if __name__ == '__main__': main()
