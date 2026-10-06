"""Low-poly 3D models for the units that have none yet, built from boxes and cylinders in code -> art/models/<kind>.glb
(then `python tools/models.py` bakes them into js/ui/models.js, like the downloaded ones).

Each model: front +X, up +Y, on y = 0, in metres (models.py scales its length to 1 anyway). Materials: `body` = the
side's paint (tinted in the game), `dark` (tyres, tracks, vents), `metal`, `glass`, `tank` (a fuel / water tank),
`warn` (warning colours). Nodes named `turret` (and children) turn toward the target in the game, round their middle.

  python tools/build_models.py            every kind below
  python tools/build_models.py mlrs ssm   only those
"""
import json, os, struct, sys
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'models')
MATS = {'body': [0.40, 0.40, 0.31], 'dark': [0.09, 0.09, 0.085], 'metal': [0.42, 0.43, 0.44], 'glass': [0.16, 0.22, 0.28],
        'tank': [0.62, 0.62, 0.58], 'water': [0.24, 0.38, 0.62], 'warn': [0.75, 0.62, 0.15], 'white': [0.86, 0.86, 0.84]}


class Mesh:
    """triangles by material, flat-shaded"""
    def __init__(self): self.tri = {}

    def add(self, mat, pts, faces):
        P = np.asarray(pts, float)
        for f in faces:
            for k in range(1, len(f) - 1):
                a, b, c = P[f[0]], P[f[k]], P[f[k + 1]]
                self.tri.setdefault(mat, []).append((a, b, c))
        return self

    def box(self, mat, c, s, rot=0.0, tilt=0.0):
        """box centred at c, size s (x y z); turned `rot` round Y and tilted `tilt` round Z (nose up), both radians"""
        x, y, z = np.asarray(s, float) / 2
        p = np.array([[sx * x, sy * y, sz * z] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)])
        p = p @ rz(tilt).T @ ry(rot).T + c
        # (corners: index = 4*sx + 2*sy + sz, each 0/1)
        return self.add(mat, p, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)])

    def cyl(self, mat, c, r, l, axis='x', n=12, r2=None, tilt=0.0, rot=0.0):
        """cylinder (or cone, r2) of length l along `axis`, centred at c"""
        r2 = r if r2 is None else r2
        a = np.linspace(0, 2 * np.pi, n, endpoint=False)
        ring = lambda rr, t: np.c_[np.full(n, t), rr * np.cos(a), rr * np.sin(a)]
        p = np.r_[ring(r, -l / 2), ring(r2, l / 2)]
        if axis == 'y': p = p[:, [1, 0, 2]]
        elif axis == 'z': p = p[:, [1, 2, 0]]
        p = p @ rz(tilt).T @ ry(rot).T + c
        side = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        ends = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
        if axis == 'y': side, ends = [f[::-1] for f in side], [e[::-1] for e in ends]
        return self.add(mat, p, side + ends)

    def wheels(self, xs, z, r, w, y=None, mat='dark', hub='metal'):
        for x in xs:
            for sz in (-1, 1):
                self.cyl(mat, (x, r if y is None else y, sz * z), r, w, 'z', 14)
                self.cyl(hub, (x, r if y is None else y, sz * (z + w / 2 + 0.01)), r * 0.45, 0.03, 'z', 8)
        return self

    def tracks(self, x0, x1, z, h, w, wheels=5):
        r = h / 2
        for sz in (-1, 1):
            self.box('dark', ((x0 + x1) / 2, r, sz * z), (x1 - x0, h, w))
            self.cyl('dark', (x0, r, sz * z), r, w, 'z', 12); self.cyl('dark', (x1, r, sz * z), r, w, 'z', 12)
            for x in np.linspace(x0, x1, wheels):
                self.cyl('metal', (x, r * 0.9, sz * (z + w / 2 + 0.01)), r * 0.6, 0.04, 'z', 10)
        return self


def ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def write(kind, parts):
    """parts: [(name, Mesh, parent index or None)] -> art/models/<kind>.glb (each part a node; a mesh per part, a
    primitive per material)"""
    mats = sorted({m for _, M, _ in parts for m in M.tri})
    J = {'asset': {'version': '2.0', 'generator': 'tools/build_models.py'}, 'scene': 0, 'scenes': [{'nodes': []}],
         'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [],
         'materials': [{'name': m, 'pbrMetallicRoughness': {'baseColorFactor': MATS[m] + [1], 'metallicFactor': 0.1, 'roughnessFactor': 0.8}} for m in mats]}
    blob = bytearray()
    def view(a, target):
        while len(blob) % 4: blob.append(0)
        J['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': a.nbytes, 'target': target}); blob.extend(a.tobytes())
        return len(J['bufferViews']) - 1
    for name, M, parent in parts:
        prims = []
        for m, T in M.tri.items():
            T = np.asarray(T, np.float32)  # (n, 3, 3)
            nr = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); nr /= np.maximum(1e-9, np.linalg.norm(nr, axis=1))[:, None]
            pos = T.reshape(-1, 3); nrm = np.repeat(nr, 3, axis=0).astype(np.float32); idx = np.arange(len(pos), dtype=np.uint32)
            a0 = len(J['accessors'])
            J['accessors'] += [{'bufferView': view(pos, 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
                               {'bufferView': view(nrm, 34962), 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
                               {'bufferView': view(idx, 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'}]
            prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1}, 'indices': a0 + 2, 'material': mats.index(m)})
        J['meshes'].append({'name': name, 'primitives': prims})
        J['nodes'].append({'name': name, 'mesh': len(J['meshes']) - 1})
        i = len(J['nodes']) - 1
        if parent is None: J['scene'] = 0; J['scenes'][0]['nodes'].append(i)
        else: J['nodes'][parent].setdefault('children', []).append(i)
    J['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); blob += b'\0' * (-len(blob) % 4)
    path = os.path.join(OUT, kind + '.glb')
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)
    print(f'{kind}: {sum(len(t) for _, M, _ in parts for t in M.tri.values())} triangles -> {path}')


# ---- the trucks: a cab at the front (+X), a chassis, six wheels; each kind its own load ----
def truck(L=7.0, W=2.5, cab=1.9):
    M = Mesh()
    M.box('dark', (0, 0.95, 0), (L, 0.35, W * 0.8))                          # chassis
    M.box('body', (L / 2 - cab / 2, 1.85, 0), (cab, 1.7, W))                 # cab
    M.box('glass', (L / 2 + 0.01, 2.15, 0), (0.05, 0.6, W * 0.85))          # windscreen
    M.box('glass', (L / 2 - cab / 2, 2.2, W / 2 + 0.01), (cab * 0.6, 0.5, 0.04)); M.box('glass', (L / 2 - cab / 2, 2.2, -W / 2 - 0.01), (cab * 0.6, 0.5, 0.04))
    M.box('dark', (L / 2 + 0.03, 1.2, 0), (0.08, 0.35, W * 0.9))            # bumper
    M.wheels([L / 2 - 1.0, -L / 2 + 2.2, -L / 2 + 1.0], W / 2 - 0.15, 0.55, 0.4)
    return M, L, W, cab

def k_truck():  # ammunition / supply: a canvas-covered cargo bed
    M, L, W, cab = truck(); bx = -cab / 2
    M.box('body', (bx, 1.4, 0), (L - cab - 0.2, 0.5, W))
    M.cyl('body', (bx, 2.0, 0), W / 2, L - cab - 0.3, 'x', 10)
    M.box('body', (bx, 1.85, 0), (L - cab - 0.3, 0.9, W))
    M.box('warn', (bx - 1.0, 1.25, W / 2 + 0.02), (0.5, 0.25, 0.03))
    return [('hull', M, None)]

def k_tanktruck(color):
    M, L, W, cab = truck(); bx = -cab / 2 - 0.1
    M.cyl(color, (bx, 2.05, 0), 1.0, L - cab - 0.5, 'x', 16)
    M.cyl('metal', (bx + (L - cab - 0.5) / 2 + 0.02, 2.05, 0), 0.7, 0.05, 'x', 12)
    M.cyl('metal', (bx, 3.08, 0), 0.25, 0.15, 'y', 10)                      # filler cap
    M.box('dark', (bx, 1.15, 0), (L - cab - 0.4, 0.25, W * 0.9))
    return [('hull', M, None)]

def k_radio():  # a box body with a mast and a small dish
    M, L, W, cab = truck(6.4); bx = -cab / 2
    M.box('body', (bx, 2.05, 0), (L - cab - 0.3, 1.9, W))
    M.box('dark', (bx - 0.5, 2.0, W / 2 + 0.01), (0.9, 1.3, 0.03))           # door
    M.cyl('metal', (bx - 1.2, 4.6, 0.6), 0.07, 3.2, 'y', 6)                   # mast
    M.cyl('metal', (bx - 1.2, 6.2, 0.6), 0.02, 1.4, 'z', 4)
    M.cyl('white', (bx + 0.6, 3.25, -0.4), 0.55, 0.12, 'y', 14, r2=0.2)      # dish
    return [('hull', M, None)]

def k_mech():  # repair truck: a flat bed, a crane and toolboxes
    M, L, W, cab = truck(6.4); bx = -cab / 2
    M.box('body', (bx, 1.35, 0), (L - cab - 0.2, 0.4, W))
    for sz in (-1, 1): M.box('body', (bx + 0.3, 1.85, sz * (W / 2 - 0.3)), (1.8, 0.6, 0.55))
    M.cyl('warn', (bx - 1.2, 2.0, 0), 0.25, 0.6, 'y', 8)
    M.box('warn', (bx - 0.2, 2.6, 0), (2.6, 0.25, 0.25), tilt=0.45)          # crane arm
    M.cyl('dark', (bx + 0.95, 2.6, 0), 0.03, 1.0, 'y', 4)
    return [('hull', M, None)]

def k_ssm():  # a long missile on an erector, raised a little
    M, L, W, cab = truck(9.0, 2.7, 2.2); bx = -cab / 2
    M.wheels([-0.5], W / 2 - 0.15, 0.55, 0.4)
    M.box('dark', (bx, 1.4, 0), (L - cab - 0.3, 0.45, W * 0.8))
    T = Mesh()
    T.box('metal', (-0.6, 2.0, 0), (6.4, 0.35, 0.9), tilt=0.12)              # erector
    T.cyl('white', (-0.4, 2.55, 0), 0.42, 6.2, 'x', 14, tilt=0.12)           # missile
    T.cyl('white', (2.9, 2.95, 0), 0.42, 0.9, 'x', 14, r2=0.02, tilt=0.12)   # nose
    T.box('dark', (-3.3, 2.15, 0), (0.6, 0.06, 1.4), tilt=0.12)               # fins
    return [('hull', M, None), ('turret', T, 0)]

def k_launcher(n_rows, n_cols, tilt, tube='white'):  # arrow / dome: a box of tubes, raised at the back of a truck
    def make():
        M, L, W, cab = truck(7.6, 2.6, 2.0); bx = -cab / 2
        M.box('dark', (bx, 1.4, 0), (L - cab - 0.3, 0.45, W * 0.8))
        T = Mesh(); cx = -1.4
        T.box('body', (cx, 2.6, 0), (3.4, 0.25 + 0.55 * n_rows, 0.4 + 0.6 * n_cols), tilt=tilt)
        for i in range(n_rows):
            for j in range(n_cols):
                o = rz(tilt) @ (1.72, (i - (n_rows - 1) / 2) * 0.55, (j - (n_cols - 1) / 2) * 0.6)  # (on the box's end, tilted with it)
                T.cyl(tube, (cx + o[0], 2.6 + o[1], o[2]), 0.2, 0.08, 'x', 10, tilt=tilt)
        T.box('dark', (cx - 1.0, 1.95, 0), (0.4, 0.8, 0.6))                    # the hinge
        return [('hull', M, None), ('turret', T, 0)]
    return make

def k_mlrs():  # M270: tracked, a cab at the front, a launcher box of 2 × 6 rockets that turns
    M = Mesh(); L, W = 6.9, 3.0
    M.tracks(-L / 2 + 0.5, L / 2 - 0.5, W / 2 - 0.3, 1.0, 0.55, 6)
    M.box('body', (0, 1.45, 0), (L, 0.9, W - 0.7))
    M.box('body', (L / 2 - 0.9, 2.3, 0), (1.7, 1.0, W - 0.6))                # cab
    M.box('glass', (L / 2 - 0.04, 2.45, 0), (0.05, 0.45, W - 0.8))
    T = Mesh(); cx = -1.0
    T.box('body', (cx, 2.6, 0), (4.0, 1.0, 2.3), tilt=0.08)
    for row in (0, 1):
        for j in range(6):
            o = rz(0.08) @ (2.01, (row - 0.5) * 0.45, (j - 2.5) * 0.36)
            T.cyl('dark', (cx + o[0], 2.6 + o[1], o[2]), 0.14, 0.04, 'x', 8, tilt=0.08)
    T.box('dark', (cx - 0.3, 2.0, 0), (1.2, 0.3, 1.2))
    return [('hull', M, None), ('turret', T, 0)]

def k_dozer():  # D9: tracks, a big blade in front, a cab, a ripper behind
    M = Mesh(); L, W = 6.2, 3.4
    M.tracks(-L / 2 + 0.6, L / 2 - 1.4, W / 2 - 0.35, 1.2, 0.65, 5)
    M.box('body', (-0.4, 1.7, 0), (L - 2.2, 1.2, W - 1.4))
    M.box('body', (0.6, 2.3, 0), (1.6, 0.7, W - 1.6))                        # engine hood
    M.box('body', (-1.0, 3.0, 0), (1.6, 1.4, W - 1.4))                       # armoured cab
    M.box('glass', (-0.18, 3.15, 0), (0.05, 0.5, W - 1.7))
    M.box('body', (L / 2 - 0.25, 1.1, 0), (0.35, 1.9, W + 0.3), tilt=-0.15)  # blade
    for sz in (-1, 1): M.box('dark', (L / 2 - 1.0, 1.1, sz * (W / 2 - 0.1)), (1.6, 0.2, 0.2))  # push arms
    M.box('dark', (-L / 2 + 0.1, 1.0, 0), (0.25, 1.4, 0.3), tilt=0.3)        # ripper
    return [('hull', M, None)]

KINDS = {'truck': k_truck, 'fueltruck': lambda: k_tanktruck('tank'), 'watertruck': lambda: k_tanktruck('water'),
         'radio': k_radio, 'mech': k_mech, 'ssm': k_ssm, 'arrow': k_launcher(2, 2, 0.75), 'dome': k_launcher(3, 4, 0.6),
         'mlrs': k_mlrs, 'dozer': k_dozer}

if __name__ == '__main__':
    for k in (sys.argv[1:] or KINDS):
        write(k, KINDS[k]())
