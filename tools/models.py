"""3D models for the 3D view: art/models/<kind>.glb -> js/ui/models.js (MODELS), so the game loads them from file://
too (a fetch of a local file is refused there; the sprites go the same way, sprites.py).

Each model is baked flat: every mesh in its rest pose (the node transforms applied; skins ignored), turned so its
front is +X and up is +Y, its length along X scaled to 1, standing on y = 0, centred on its hull. The parts:
  hull    everything but the turret
  turret  the nodes named *Turret* / *Gun* (a tank), around its own pivot (the turret's middle) — `pivot` is where
          that sits on the hull
Each part is two lists of triangles: `team` (the main paint — Main, Main_Light…: tinted with the side's colour in the
game) and `rest` (dark details, wheels, tracks: as they are), each vertex x y z nx ny nz r g b, as base64 Float32.

  python tools/models.py            every art/models/*.glb
Front: the model's gun (or its longest side) is taken as the front; FRONT below turns one that comes out the other way.
"""
import base64, json, os, struct, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC, OUT = os.path.join(ROOT, 'art', 'models'), os.path.join(ROOT, 'js', 'ui', 'models.js')
# (the turn round the up axis that brings each model's front to +X, degrees; a model not here: its gun's way)
FRONT = {}
TEAM = ('main', 'main_light', 'body', 'paint')  # materials painted in the side's colour
TURRET = ('turret', 'gun', 'barrel', 'cannon')

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    b = open(path, 'rb').read()
    _, _, _ = struct.unpack('<III', b[:12])
    jl, _ = struct.unpack('<II', b[12:20]); J = json.loads(b[20:20 + jl])
    o = 20 + jl; bl, _ = struct.unpack('<II', b[o:o + 8]); B = b[o + 8:o + 8 + bl]
    return J, B


def accessor(J, B, i):
    a = J['accessors'][i]; v = J['bufferViews'][a['bufferView']]
    dt, n = COMP[a['componentType']], NCOMP[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', 0)
    size = np.dtype(dt).itemsize * n
    if stride and stride != size:
        raw = np.frombuffer(B, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :size]
        arr = np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(B, dt, a['count'] * n, off).reshape(a['count'], n)
    arr = arr.astype(np.float64)
    if a.get('normalized'): arr /= np.iinfo(dt).max
    return arr


def node_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M


def bake(path):
    J, B = read_glb(path)
    mats = J.get('materials', [])
    parts = {}  # (part, team) -> list of (pos, nrm, col)
    def walk(i, P, turret):
        n = J['nodes'][i]; M = P @ node_matrix(n); name = (n.get('name') or '').lower()
        turret = turret or any(k in name for k in TURRET)
        if 'mesh' in n:
            for p in J['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue
                at = p['attributes']; pos = accessor(J, B, at['POSITION'])
                nrm = accessor(J, B, at['NORMAL']) if 'NORMAL' in at else np.zeros_like(pos)
                idx = accessor(J, B, p['indices']).astype(int).ravel() if 'indices' in p else np.arange(len(pos))
                m = mats[p['material']] if 'material' in p else {}
                base = np.array((m.get('pbrMetallicRoughness') or {}).get('baseColorFactor', [0.6, 0.6, 0.6, 1])[:3])
                col = np.tile(base, (len(pos), 1))
                if 'COLOR_0' in at: col = col * accessor(J, B, at['COLOR_0'])[:, :3]
                P4 = np.c_[pos, np.ones(len(pos))] @ M.T; N = nrm @ np.linalg.inv(M[:3, :3]).T
                N /= np.maximum(1e-9, np.linalg.norm(N, axis=1))[:, None]
                team = any(k == (m.get('name') or '').lower() for k in TEAM)
                parts.setdefault(('turret' if turret else 'hull', team), []).append((P4[idx, :3], N[idx], col[idx]))
        for c in n.get('children', []): walk(c, M, turret)
    for r in J['scenes'][J.get('scene', 0)]['nodes']: walk(r, np.eye(4), False)
    cat = {k: tuple(np.concatenate([v[j] for v in l]) for j in range(3)) for k, l in parts.items()}
    hull = np.concatenate([v[0] for k, v in cat.items() if k[0] == 'hull'])
    gun = np.concatenate([v[0] for k, v in cat.items() if k[0] == 'turret']) if any(k[0] == 'turret' for k in cat) else None
    # the front: toward the gun's far end (on the long side), else +X — turned to +X
    name = os.path.splitext(os.path.basename(path))[0]
    lo, hi = hull.min(0), hull.max(0); mid = (lo + hi) / 2
    if name in FRONT: ang = np.radians(FRONT[name])
    elif gun is not None:
        d = gun - mid; far = d[np.argmax(d[:, 0] ** 2 + d[:, 2] ** 2)]; ang = np.arctan2(-far[2], far[0])
        ang = round(ang / (np.pi / 2)) * (np.pi / 2)  # (to the nearest right angle)
    else: ang = 0.0 if hi[0] - lo[0] >= hi[2] - lo[2] else np.pi / 2
    c, s_ = np.cos(ang), np.sin(ang); Ry = np.array([[c, 0, -s_], [0, 1, 0], [s_, 0, c]])  # (turns `ang` back to +X)
    def turn(a): return a @ Ry.T
    hull_t = turn(hull - mid); lo, hi = hull_t.min(0), hull_t.max(0); L = hi[0] - lo[0]
    ctr = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    out = {'parts': {}}
    piv = None
    if gun is not None:
        tur_only = [v[0] for k, v in cat.items() if k[0] == 'turret']
        tt = (turn(np.concatenate(tur_only) - mid) - ctr) / L
        # (the pivot: the middle of the turret's footprint, not counting the gun reaching forward — its widest part)
        body = tt[np.abs(tt[:, 2]) > 0.25 * np.abs(tt[:, 2]).max()]
        piv = np.array([(body[:, 0].min() + body[:, 0].max()) / 2, 0, (body[:, 2].min() + body[:, 2].max()) / 2])
        out['pivot'] = [round(float(piv[0]), 4), round(float(piv[2]), 4)]
    for (part, team), (p, nr, col) in cat.items():
        q = (turn(p - mid) - ctr) / L
        if part == 'turret': q = q - piv
        n_ = turn(nr)
        v = np.c_[q, n_, np.clip(col, 0, 1)].astype(np.float32)
        out['parts'].setdefault(part, {})['team' if team else 'rest'] = base64.b64encode(v.tobytes()).decode()
    out['size'] = [1.0, round(float((hi[1] - lo[1]) / L), 4), round(float((hi[2] - lo[2]) / L), 4)]
    tri = sum(len(v[0]) for v in cat.values()) // 3
    print(f'{name}: {tri} triangles, front turned {np.degrees(ang):.0f}°, size {out["size"]}, pivot {out.get("pivot")}')
    return name, out


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.glb')) if os.path.isdir(SRC) else []
    models = dict(bake(os.path.join(SRC, f)) for f in files)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// generated by tools/models.py from art/models/*.glb — 3D models for the 3D view (three3d.js)\n')
        f.write('const MODELS = ' + json.dumps(models, separators=(',', ':')) + ';\n')
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
