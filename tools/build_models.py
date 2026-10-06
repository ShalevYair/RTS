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
        'tank': [0.62, 0.62, 0.58], 'water': [0.24, 0.38, 0.62], 'warn': [0.75, 0.62, 0.15], 'white': [0.86, 0.86, 0.84],
        # (buildings)
        'concrete': [0.64, 0.62, 0.57], 'sand': [0.70, 0.61, 0.45], 'canvas': [0.43, 0.43, 0.30], 'wood': [0.47, 0.35, 0.23],
        'olive': [0.33, 0.36, 0.24], 'asphalt': [0.22, 0.22, 0.21], 'red': [0.72, 0.12, 0.10], 'net': [0.30, 0.34, 0.21]}


class Mesh:
    """triangles by material, flat-shaded; each with a shade (a colour factor, `self.k`, ~1: so that sandbags, crates
    and panels of one material aren't all the very same colour)"""
    def __init__(self): self.tri = {}; self.k = 1.0

    def add(self, mat, pts, faces):
        P = np.asarray(pts, float)
        for f in faces:
            for k in range(1, len(f) - 1):
                a, b, c = P[f[0]], P[f[k]], P[f[k + 1]]
                self.tri.setdefault(mat, []).append((a, b, c, self.k))
        return self

    def hull(self, mat, pts):
        """the convex shape round these points (a sloped roof, a wedge, a bevelled block…), its faces outward"""
        from scipy.spatial import ConvexHull
        P = np.asarray(pts, float); H = ConvexHull(P); mid = P.mean(0)
        for f in H.simplices:
            a, b, c = P[f]
            if np.dot(np.cross(b - a, c - a), a - mid) < 0: b, c = c, b
            self.tri.setdefault(mat, []).append((a, b, c, self.k))
        return self

    def block(self, mat, c, s, bev=0.08, rot=0.0):
        """a box with its edges bevelled (bev: how much, of the smallest side) — catches the light on its edges"""
        x, y, z = np.asarray(s, float) / 2; b = bev * min(x, y, z) * 2
        p = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    p += [(sx * x, sy * (y - b), sz * (z - b)), (sx * (x - b), sy * y, sz * (z - b)), (sx * (x - b), sy * (y - b), sz * z)]
        return self.hull(mat, np.asarray(p) @ ry(rot).T + c)

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

    def slab(self, mat, pts, a, b, plane='xz'):
        """a flat convex shape (pts: its outline, 2D) given thickness — in the xz plane between y = a and b (a wing),
        or in the xy plane between z = a and b (a fin). Its faces both ways round (no matter which way the outline goes)"""
        P = np.asarray(pts, float); n = len(P)
        lo = np.c_[P[:, 0], np.full(n, a), P[:, 1]] if plane == 'xz' else np.c_[P[:, 0], P[:, 1], np.full(n, a)]
        hi = lo.copy(); hi[:, 1 if plane == 'xz' else 2] = b
        o = list(range(n))
        faces = [tuple(n + i for i in o), tuple(o)] + [(o[i], o[(i + 1) % n], n + o[(i + 1) % n], n + o[i]) for i in range(n)]
        return self.add(mat, np.r_[lo, hi], faces + [f[::-1] for f in faces])

    def strut(self, mat, p0, p1, w):
        """a thin bar from p0 to p1 (three-sided, w thick)"""
        p0, p1 = np.asarray(p0, float), np.asarray(p1, float); d = p1 - p0; L = np.linalg.norm(d)
        if L < 1e-6: return self
        u = d / L; a = np.cross(u, (0, 1, 0) if abs(u[1]) < 0.9 else (1, 0, 0)); a /= np.linalg.norm(a); b = np.cross(u, a)
        return self.hull(mat, [p + (a * sa + b * sb) * w for p in (p0, p1) for sa, sb in ((1, 0), (-0.5, 0.87), (-0.5, -0.87))])

    def loft(self, mat, secs):
        """a smooth body through cross-sections along x: secs = [(x, [(y, z), …]), …], each convex; the shape between two
        neighbours is their hull — a fuselage, a sloped bonnet, a tank's nose"""
        for (x0, r0), (x1, r1) in zip(secs, secs[1:]):
            self.hull(mat, [(x0, y, z) for y, z in r0] + [(x1, y, z) for y, z in r1])
        return self

    def tyre(self, c, r, w, out=1, rim='metal'):
        """a tyre with a rounded shoulder, its rim and hub on the outer face (out: +1 / -1 along z)"""
        x, y, z = c; n = 18; a = np.linspace(0, 2 * np.pi, n, endpoint=False)
        ring = lambda rr, dz: [(x + rr * np.cos(t), y + rr * np.sin(t), z + dz) for t in a]
        k = self.k
        self.k = k * 0.9; self.hull('dark', ring(r * 0.86, -w / 2) + ring(r, -w * 0.32) + ring(r, w * 0.32) + ring(r * 0.86, w / 2))
        self.k = k * 1.0; self.cyl(rim, (x, y, z + out * (w / 2 - 0.02)), r * 0.56, 0.06, 'z', 12)
        self.k = k * 0.75; self.cyl(rim, (x, y, z + out * (w / 2 + 0.03)), r * 0.22, 0.08, 'z', 8, r2=r * 0.16) if out > 0 else self.cyl(rim, (x, y, z - w / 2 - 0.03), r * 0.16, 0.08, 'z', 8, r2=r * 0.22)
        for t in np.linspace(0, 2 * np.pi, 6, endpoint=False):  # (wheel nuts)
            self.k = k * 0.6; self.box('dark', (x + np.cos(t) * r * 0.36, y + np.sin(t) * r * 0.36, z + out * (w / 2 + 0.02)), (0.06, 0.06, 0.04))
        self.k = k; return self

    def wheels(self, xs, z, r, w, y=None, mat='dark', hub='metal'):
        for x in xs:
            for sz in (-1, 1): self.tyre((x, r if y is None else y, sz * z), r, w, sz, hub)
        return self

    def tracks(self, x0, x1, z, h, w, wheels=5, skirt=None):
        """tracks: a belt round the wheels (rounded ends, a lighter tread on it), road wheels, a drive sprocket at the
        front, return rollers on top; `skirt`: side plates over the upper run (that material)"""
        r = h / 2; a = np.linspace(-np.pi / 2, np.pi / 2, 7)
        for sz in (-1, 1):
            zz = sz * z
            belt = [(x1 + r * np.cos(t), r + r * np.sin(t)) for t in a] + [(x0 - r * np.cos(t), r + r * np.sin(t)) for t in a[::-1]]
            self.k = 0.85; self.hull('dark', [(px, py, zz + dz) for px, py in belt for dz in (-w / 2, w / 2)])
            for i, xx in enumerate(np.arange(x0, x1, 0.32)):  # (the tread's links, on the bottom)
                self.k = 1.25 if i % 2 else 1.0; self.box('dark', (xx, 0.02, zz), (0.16, 0.05, w * 1.02))
            for xx in np.linspace(x0 + r * 0.3, x1 - r * 0.3, wheels):
                self.k = 1.0; self.cyl('metal', (xx, r * 0.95, zz + sz * (w / 2 + 0.01)), r * 0.72, 0.06, 'z', 14)
                self.k = 0.6; self.cyl('dark', (xx, r * 0.95, zz + sz * (w / 2 + 0.05)), r * 0.25, 0.04, 'z', 8)
            self.k = 0.9; self.cyl('metal', (x1 + r * 0.05, r * 1.1, zz + sz * (w / 2 + 0.02)), r * 0.6, 0.08, 'z', 10)   # sprocket
            for xx in np.linspace(x0 + (x1 - x0) * 0.25, x1 - (x1 - x0) * 0.25, 2):
                self.k = 0.8; self.cyl('metal', (xx, h - 0.05, zz + sz * w * 0.2), r * 0.18, w * 0.5, 'z', 8)
            if skirt:
                self.k = 1.0; self.hull(skirt, [(px, py, zz + sz * (w / 2 + dz)) for px in (x0 - r * 0.6, x1 + r * 0.6) for py in (h * 0.55, h + 0.12) for dz in (0.02, 0.08)])
        self.k = 1.0; return self


def ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def write(kind, parts, gen='tools/build_models.py'):
    """parts: [(name, Mesh, parent index or None)] -> art/models/<kind>.glb (each part a node; a mesh per part, a
    primitive per material)"""
    mats = sorted({m for _, M, _ in parts for m in M.tri})
    J = {'asset': {'version': '2.0', 'generator': gen}, 'scene': 0, 'scenes': [{'nodes': []}],
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
            K = np.repeat(np.asarray([t[3] for t in T], np.float32), 3)
            T = np.asarray([t[:3] for t in T], np.float32)  # (n, 3, 3)
            nr = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); nr /= np.maximum(1e-9, np.linalg.norm(nr, axis=1))[:, None]
            pos = T.reshape(-1, 3); nrm = np.repeat(nr, 3, axis=0).astype(np.float32); idx = np.arange(len(pos), dtype=np.uint32)
            col = np.repeat(np.clip(K, 0, 2)[:, None], 3, axis=1).astype(np.float32)
            a0 = len(J['accessors'])
            J['accessors'] += [{'bufferView': view(pos, 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
                               {'bufferView': view(nrm, 34962), 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
                               {'bufferView': view(idx, 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
                               {'bufferView': view(col, 34962), 'componentType': 5126, 'count': len(col), 'type': 'VEC3'}]
            prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'COLOR_0': a0 + 3}, 'indices': a0 + 2, 'material': mats.index(m)})
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


# ---- the trucks: a bonneted cab at the front (+X), a chassis, six wheels; each kind its own load. The cab: a sloped
# bonnet with a grille and lights, a cab with a raked windscreen in two panes, side windows, mirrors, mudguards over
# the front wheels, an exhaust stack, a fuel tank and a step under the door ----
def truck(L=7.0, W=2.5, axles=(-1.0, -2.2), cab=1.8, hood=1.3, r=0.55):
    M = Mesh(); f = L / 2; hw = W / 2
    M.k = 0.8; M.box('dark', (0, 1.0, 0), (L - 0.2, 0.3, W * 0.62))                        # chassis rails
    # (the bonnet: sloping down to the front)
    M.k = 1.0; M.loft('body', [(f - hood, [(1.3, hw - 0.15), (1.3, -hw + 0.15), (2.15, hw - 0.25), (2.15, -hw + 0.25)]),
                              (f - 0.05, [(1.2, hw - 0.2), (1.2, -hw + 0.2), (1.95, hw - 0.35), (1.95, -hw + 0.35)])])
    M.k = 0.5; M.box('dark', (f - 0.02, 1.55, 0), (0.06, 0.65, W - 0.85))                  # grille
    for yy in np.arange(1.33, 1.85, 0.12): M.k = 0.9; M.box('metal', (f + 0.02, yy, 0), (0.04, 0.04, W - 0.95))
    for sz in (-1, 1):
        M.k = 1.0; M.cyl('white', (f + 0.0, 1.62, sz * (hw - 0.32)), 0.13, 0.08, 'x', 10); M.k = 0.8; M.cyl('metal', (f - 0.03, 1.62, sz * (hw - 0.32)), 0.17, 0.06, 'x', 10)
        M.k = 1.0; M.box('warn', (f, 1.36, sz * (hw - 0.28)), (0.05, 0.1, 0.18))
    M.k = 0.7; M.block('dark', (f + 0.12, 1.08, 0), (0.25, 0.32, W * 0.95), 0.2)          # bumper
    for sz in (-0.5, 0.5): M.k = 1.0; M.cyl('warn', (f + 0.28, 1.08, sz), 0.07, 0.15, 'x', 6)   # tow hooks
    # (the cab: a raked windscreen — its top edge set back)
    cx0, cx1 = f - hood - cab, f - hood; rk = 0.35
    M.k = 1.0; M.hull('body', [(x, y, z) for x in (cx0, cx1) for y in (1.25,) for z in (hw, -hw)] + [(cx0, 3.05, hw - 0.05), (cx0, 3.05, -hw + 0.05), (cx1 - rk, 3.05, hw - 0.05), (cx1 - rk, 3.05, -hw + 0.05), (cx1, 2.2, hw), (cx1, 2.2, -hw)])
    for sz in (-1, 1):  # (two panes, a pillar between)
        n = np.array((np.cos(np.arctan2(rk, 0.85)), np.sin(np.arctan2(rk, 0.85)), 0)) * 0.03
        z0, z1 = (0.06, hw - 0.18) if sz > 0 else (-hw + 0.18, -0.06)
        M.k = 1.0; M.hull('glass', [np.add(p, n) for p in ((cx1 - 0.04, 2.3, z0), (cx1 - 0.04, 2.3, z1), (cx1 - rk + 0.04, 2.95, z0), (cx1 - rk + 0.04, 2.95, z1))] + [np.add(p, 2 * n) for p in ((cx1 - 0.04, 2.3, z0), (cx1 - rk + 0.04, 2.95, z1))])
        M.k = 1.0; M.box('glass', ((cx0 + cx1) / 2 - 0.1, 2.55, sz * (hw + 0.01)), (cab * 0.62, 0.65, 0.04))   # side window
        M.k = 0.7; M.box('dark', ((cx0 + cx1) / 2 - 0.1, 1.85, sz * (hw + 0.01)), (0.05, 0.75, 0.03))        # door line
        M.k = 0.85; M.box('dark', ((cx0 + cx1) / 2 + 0.45, 2.05, sz * (hw + 0.02)), (0.18, 0.05, 0.04))    # handle
        M.strut('dark', (cx1 - 0.1, 2.5, sz * hw), (cx1 + 0.15, 2.65, sz * (hw + 0.45)), 0.03)                # mirror
        M.k = 0.8; M.box('dark', (cx1 + 0.17, 2.55, sz * (hw + 0.47)), (0.06, 0.4, 0.22))
        # (mudguard over the front wheel)
        M.k = 1.0; M.hull('body', [(f - 1.0 + dx, 1.45 + (0.25 if abs(dx) < 0.3 else 0), sz * zz) for dx in (-0.75, -0.25, 0.25, 0.75) for zz in (hw - 0.45, hw + 0.03)] + [(f - 1.0 + dx, 1.32, sz * zz) for dx in (-0.75, 0.75) for zz in (hw - 0.45, hw + 0.03)])
        M.k = 0.8; M.box('metal', (cx0 + 0.6, 1.0, sz * (hw - 0.1)), (0.45, 0.06, 0.3))                      # step
    M.k = 0.95; M.cyl('metal', (cx0 + 0.8, 1.1, -(hw - 0.35)), 0.3, 0.9, 'x', 12)                          # fuel tank
    M.k = 0.7; M.cyl('dark', (cx0 - 0.15, 2.6, hw - 0.3), 0.08, 2.4, 'y', 8); M.cyl('dark', (cx0 - 0.15, 3.85, hw - 0.3), 0.1, 0.12, 'y', 8)  # exhaust
    M.k = 1.0; M.box('body', (cx0 + 0.6, 3.1, 0), (0.9, 0.12, W - 0.5))                                     # roof hatch
    M.wheels([f - 1.0] + list(axles), hw - 0.12, r, 0.42)
    for sz in (-1, 1): M.k = 1.0; M.box('red', (-L / 2 + 0.05, 1.25, sz * (hw - 0.15)), (0.05, 0.12, 0.2))   # rear lights
    return M, f, hw, cx0

def bed_sides(M, x0, x1, hw, h=0.6, y0=1.18):
    """a flat bed with low plank sides (each plank a shade)"""
    M.k = 0.9; M.box('body', ((x0 + x1) / 2, y0, 0), (x1 - x0, 0.14, hw * 2))
    for i, yy in enumerate(np.arange(y0 + 0.12, y0 + h, 0.16)):
        M.k = 0.92 + 0.08 * (i % 2)
        for sz in (-1, 1): M.box('body', ((x0 + x1) / 2, yy + 0.07, sz * (hw - 0.03)), (x1 - x0, 0.14, 0.06))
        M.box('body', (x0 + 0.03, yy + 0.07, 0), (0.06, 0.14, hw * 2))
    M.k = 1.0

def k_truck():  # ammunition / supply: a cargo bed under canvas on bows
    M, f, hw, cx0 = truck(); x0, x1 = -3.45, cx0 - 0.15
    bed_sides(M, x0, x1, hw)
    a = np.linspace(0, np.pi, 9)
    arch = [(1.75 + 0.75 * np.sin(t) * 1.0 + 0.0 * t, (hw - 0.02) * np.cos(t)) for t in a] + [(1.75, hw - 0.02), (1.75, -hw + 0.02)]
    arch = [(y + 0.0, z) for y, z in arch]
    M.k = 1.0; M.loft('canvas', [(x0, [(y + 0.25, z) for y, z in arch]), (x1, [(y + 0.25, z) for y, z in arch])])
    for xx in np.linspace(x0 + 0.4, x1 - 0.3, 4):  # (the bows under it, showing as ridges)
        M.k = 0.85; M.loft('canvas', [(xx - 0.05, [(y + 0.29, z * 1.01) for y, z in arch]), (xx + 0.05, [(y + 0.29, z * 1.01) for y, z in arch])])
    M.k = 0.35; M.box('dark', (x0 - 0.02, 2.4, 0), (0.04, 1.0, hw * 1.4))                                  # the open back
    for sz in (-1, 1): M.k = 0.8; M.box('canvas', (x0 + 0.5, 1.7, sz * (hw + 0.02)), (0.6, 0.4, 0.03))    # tie-down flaps
    return [('hull', M, None)]

def k_tanktruck(color):  # a fuel / water bowser: a tank with domed ends, bands, a walkway and a hose reel
    M, f, hw, cx0 = truck(); x0, x1 = -3.4, cx0 - 0.2; L = x1 - x0; xc = (x0 + x1) / 2; r = 1.0
    M.k = 1.0; M.cyl(color, (xc, 2.15, 0), r, L - 0.5, 'x', 20)
    M.cyl(color, (x1 - 0.12, 2.15, 0), r, 0.3, 'x', 20, r2=r * 0.7); M.cyl(color, (x0 + 0.12, 2.15, 0), r * 0.7, 0.3, 'x', 20, r2=r)
    for xx in np.linspace(x0 + 0.6, x1 - 0.6, 3): M.k = 0.8; M.cyl(color, (xx, 2.15, 0), r * 1.03, 0.1, 'x', 20)     # bands
    M.k = 0.7; M.box('metal', (xc, 3.2, 0), (L - 0.6, 0.06, 0.7))                                        # walkway
    for xx in np.linspace(x0 + 0.4, x1 - 0.4, 4):
        for sz in (-1, 1): M.strut('metal', (xx, 3.2, sz * 0.35), (xx, 3.75, sz * 0.35), 0.025)
    for sz in (-1, 1): M.strut('metal', (x0 + 0.4, 3.75, sz * 0.35), (x1 - 0.4, 3.75, sz * 0.35), 0.025)
    for xx in (xc - 0.8, xc + 0.8): M.k = 0.9; M.cyl('metal', (xx, 3.22, 0), 0.25, 0.12, 'y', 10)          # hatches
    M.k = 0.85; M.box('metal', (x0 + 0.25, 1.45, 0), (0.5, 0.7, hw * 1.6))                                # rear cabinet
    M.k = 0.6; M.cyl('dark', (x0 + 0.25, 1.5, hw - 0.1), 0.32, 0.25, 'z', 12)                              # hose reel
    M.k = 0.7; M.box('dark', (xc, 1.2, 0), (L - 0.2, 0.2, hw * 1.7))
    return [('hull', M, None)]

def k_radio():  # a shelter body: door, ladder, AC unit, a telescopic mast with whips and a dish
    M, f, hw, cx0 = truck(6.6); x0, x1 = -3.2, cx0 - 0.15; xc = (x0 + x1) / 2
    M.block('body', (xc, 2.15, 0), (x1 - x0, 1.9, hw * 2), 0.04)
    M.k = 0.55; M.box('dark', (xc - 0.4, 2.05, hw + 0.01), (0.85, 1.5, 0.03)); M.k = 0.9; M.box('metal', (xc - 0.05, 2.0, hw + 0.04), (0.05, 0.08, 0.05))
    for yy in np.arange(1.25, 2.5, 0.25): M.k = 0.9; M.box('metal', (xc - 0.4, yy, hw + 0.25), (0.6, 0.04, 0.04))   # ladder rungs
    M.k = 0.9; M.block('metal', (x0 - 0.2, 2.6, 0), (0.35, 0.7, 1.1), 0.1); M.k = 0.5; M.box('dark', (x0 - 0.38, 2.6, 0), (0.02, 0.5, 0.8))  # AC
    for i, (rr, hh) in enumerate(((0.12, 1.4), (0.09, 1.4), (0.06, 1.2))):
        M.k = 1.0 - 0.05 * i; M.cyl('metal', (x0 + 0.5, 3.1 + 0.7 + i * 1.3, -0.6), rr, hh, 'y', 8)
    M.strut('dark', (x0 + 0.5, 6.6, -0.6), (x0 + 0.5, 7.8, -0.6), 0.02)
    for sz in (-0.5, 0.5): M.strut('dark', (x1 - 0.3, 3.1, sz), (x1 - 0.3, 4.6, sz), 0.015)                  # whips
    M.k = 1.0; M.cyl('white', (xc + 0.4, 3.35, 0.5), 0.55, 0.14, 'y', 16, r2=0.15); M.strut('metal', (xc + 0.4, 3.1, 0.5), (xc + 0.4, 3.3, 0.5), 0.05)
    return [('hull', M, None)]

def k_mech():  # recovery truck: a flat bed, a crane on a turntable, toolboxes, a spare wheel
    M, f, hw, cx0 = truck(6.6); x0, x1 = -3.2, cx0 - 0.15
    bed_sides(M, x0, x1, hw, 0.35)
    for sz in (-1, 1): M.k = 1.0; M.block('olive', (x1 - 0.6, 1.55, sz * (hw - 0.35)), (1.0, 0.6, 0.55), 0.1); M.k = 0.6; M.box('dark', (x1 - 0.6, 1.55, sz * (hw - 0.07)), (0.8, 0.04, 0.02))
    M.k = 1.0; M.cyl('warn', (x0 + 0.7, 1.45, 0), 0.45, 0.4, 'y', 12); M.block('warn', (x0 + 0.7, 1.9, 0), (0.7, 0.6, 0.7), 0.15)
    M.hull('warn', [(x0 + 0.7 + dx, 2.0 + dy, dz) for dx, dy in ((0, 0), (0, 0.35)) for dz in (-0.17, 0.17)] + [(x0 + 3.0 + dx, 3.4 + dy, dz) for dx, dy in ((0, 0), (0, 0.25)) for dz in (-0.13, 0.13)])
    M.hull('warn', [(x0 + 2.95 + dx, 3.45 + dy, dz) for dx, dy in ((0, 0), (0, 0.2)) for dz in (-0.1, 0.1)] + [(x0 + 4.1 + dx, 4.0 + dy, dz) for dx, dy in ((0, 0), (0, 0.18)) for dz in (-0.09, 0.09)])
    M.strut('dark', (x0 + 4.1, 3.95, 0), (x0 + 4.1, 2.4, 0), 0.02); M.k = 0.8; M.box('dark', (x0 + 4.1, 2.35, 0), (0.15, 0.2, 0.08))  # cable, hook
    M.strut('metal', (x0 + 1.0, 1.8, 0), (x0 + 2.0, 2.9, 0), 0.08)                                              # its ram
    M.k = 1.0; M.tyre((x1 - 1.5, 1.85, 0), 0.5, 0.35, 1)
    return [('hull', M, None)]

def missile(M, x, y, z, L, r, tilt=0.0, fins=True):
    """a missile along x: a body, an ogive nose, fins at the tail; tilted nose-up by `tilt`"""
    c, s = np.cos(tilt), np.sin(tilt)
    def P(u, v, w): return (x + u * c - v * s, y + u * s + v * c, z + w)
    a = np.linspace(0, 2 * np.pi, 14, endpoint=False)
    secs = [(-L / 2, r), (L / 2 - L * 0.16, r), (L / 2 - L * 0.08, r * 0.8), (L / 2 - L * 0.02, r * 0.4), (L / 2, r * 0.08)]
    for (u0, r0), (u1, r1) in zip(secs, secs[1:]):
        M.hull('white', [P(u0, r0 * np.cos(t), r0 * np.sin(t)) for t in a] + [P(u1, r1 * np.cos(t), r1 * np.sin(t)) for t in a])
    M.k = 0.6; M.hull('dark', [P(-L / 2 - 0.05, r * 0.8 * np.cos(t), r * 0.8 * np.sin(t)) for t in a] + [P(-L / 2 + 0.02, r * np.cos(t), r * np.sin(t)) for t in a])
    if fins:
        for t in (0, np.pi / 2, np.pi, 3 * np.pi / 2):
            M.k = 0.8; M.hull('dark', [P(u, rr * np.cos(t), rr * np.sin(t)) for u, rr in ((-L / 2, r), (-L / 2 + L * 0.12, r), (-L / 2 + 0.02, r * 2.6), (-L / 2 + L * 0.05, r * 2.6))] +
                             [P(u, rr * np.cos(t) + 0.02 * np.sin(t), rr * np.sin(t) - 0.02 * np.cos(t)) for u, rr in ((-L / 2, r), (-L / 2 + 0.02, r * 2.6))])
    M.k = 1.0

def k_ssm():  # an 8×8 launcher: a long missile on an erector, stabiliser jacks down
    M, f, hw, cx0 = truck(9.4, 2.7, (-1.8, -3.0, -4.0), 2.1, 1.4)
    x0, x1 = -4.7, cx0 - 0.2
    M.k = 0.85; M.box('body', ((x0 + x1) / 2, 1.3, 0), (x1 - x0, 0.3, hw * 2))
    for sz in (-1, 1):
        for xx in (x0 + 0.5, x1 - 0.4): M.strut('metal', (xx, 1.2, sz * hw), (xx, 0.1, sz * (hw + 0.4)), 0.07); M.k = 0.7; M.box('dark', (xx, 0.06, sz * (hw + 0.4)), (0.4, 0.08, 0.4))
    T = Mesh(); tilt = 0.12
    T.k = 0.9; T.hull('metal', [(u, 1.7 + u * np.sin(tilt) + e, w) for u in (-4.2, 2.6) for e in (0, 0.35) for w in (-0.45, 0.45)])
    for u in (-3.0, -0.5, 1.8):  # (the clamps round it)
        T.k = 0.7; T.box('dark', (u, 2.6 + u * np.sin(tilt), 0), (0.2, 0.95, 1.0), tilt=tilt)
    missile(T, -0.7, 2.55 - 0.7 * np.sin(tilt) * -1, 0, 7.0, 0.42, tilt)
    T.strut('warn', (-2.5, 1.4, 0), (-2.0, 2.0, 0), 0.12)                                                          # the raising ram
    return [('hull', M, None), ('turret', T, 0)]

def k_launcher(n_rows, n_cols, tilt):  # arrow / dome: a box of canisters raised at the back of a truck, its cells' ends showing
    def make():
        M, f, hw, cx0 = truck(7.8, 2.6, (-1.4, -2.6), 2.0, 1.35)
        x0, x1 = -3.9, cx0 - 0.2
        M.k = 0.85; M.box('body', ((x0 + x1) / 2, 1.3, 0), (x1 - x0, 0.3, hw * 2))
        for sz in (-1, 1): M.strut('metal', (x0 + 0.4, 1.2, sz * hw), (x0 + 0.4, 0.1, sz * (hw + 0.4)), 0.07)
        T = Mesh(); c, s = np.cos(tilt), np.sin(tilt); Lb = 3.6; Hb = 0.3 + 0.55 * n_rows; Wb = 0.35 + 0.55 * n_cols; hx, hy = -2.6, 1.6
        def P(u, v, w): return (hx + u * c - v * s, hy + u * s + v * c, w)
        T.k = 1.0; T.hull('body', [P(u, v, w) for u in (0, Lb) for v in (0, Hb) for w in (-Wb / 2, Wb / 2)])
        for i in range(n_rows):
            for j in range(n_cols):
                v = 0.15 + 0.275 + i * 0.55; w = (j - (n_cols - 1) / 2) * 0.55
                T.k = 0.45; T.hull('dark', [P(Lb + e, v + dv, w + dw) for e in (0.0, 0.04) for dv in (-0.21, 0.21) for dw in (-0.21, 0.21)])
                T.k = 1.0; T.hull('white', [P(Lb + e, v + dv, w + dw) for e in (0.04, 0.06) for dv in (-0.13, 0.13) for dw in (-0.13, 0.13)])
        for u in (0.6, 1.8, 3.0): T.k = 0.85; T.hull('body', [P(u + du, v, w) for du in (-0.06, 0.06) for v in (-0.04, Hb + 0.04) for w in (-Wb / 2 - 0.04, Wb / 2 + 0.04)])  # (ribs round it)
        T.strut('dark', (hx + 0.8, 1.45, 0), P(1.4, 0, 0), 0.14)
        T.k = 0.7; T.box('dark', (hx, 1.6, 0), (0.4, 0.4, Wb * 0.6))                                              # the hinge
        return [('hull', M, None), ('turret', T, 0)]
    return make

def k_mlrs():  # M270: a tracked hull with a sloped nose, an armoured cab, a launcher box of 2 × 6 cells that turns
    M = Mesh(); L, W = 6.9, 3.0; hw = W / 2
    M.tracks(-L / 2 + 0.6, L / 2 - 0.5, hw - 0.3, 1.0, 0.55, 6, 'body')
    M.k = 1.0; M.loft('body', [(-L / 2, [(0.95, hw - 0.6), (0.95, -hw + 0.6), (1.95, hw - 0.6), (1.95, -hw + 0.6)]),
                              (L / 2 - 1.0, [(0.95, hw - 0.6), (0.95, -hw + 0.6), (1.95, hw - 0.6), (1.95, -hw + 0.6)]),
                              (L / 2 - 0.1, [(1.1, hw - 0.65), (1.1, -hw + 0.65), (1.5, hw - 0.65), (1.5, -hw + 0.65)])])
    M.k = 1.0; M.hull('body', [(x, y, z) for x in (L / 2 - 1.9, L / 2 - 0.4) for z in (hw - 0.3, -hw + 0.3) for y in (1.9,)] + [(L / 2 - 1.9, 2.9, hw - 0.35), (L / 2 - 1.9, 2.9, -hw + 0.35), (L / 2 - 0.85, 2.9, hw - 0.4), (L / 2 - 0.85, 2.9, -hw + 0.4), (L / 2 - 0.4, 2.3, hw - 0.3), (L / 2 - 0.4, 2.3, -hw + 0.3)])
    for z in (-0.6, 0, 0.6): M.k = 1.0; M.box('glass', (L / 2 - 0.62, 2.62, z), (0.08, 0.3, 0.45), tilt=0.5)   # vision blocks
    for sz in (-1, 1): M.k = 1.0; M.box('glass', (L / 2 - 1.3, 2.55, sz * (hw - 0.32)), (0.6, 0.35, 0.04))
    for sz in (-1, 1): M.k = 1.0; M.cyl('white', (L / 2 - 0.12, 1.45, sz * (hw - 0.85)), 0.09, 0.05, 'x', 8)
    M.k = 0.8; M.box('dark', (-L / 2 + 0.6, 2.0, hw - 0.7), (0.8, 0.1, 0.5))                                          # engine grille
    T = Mesh(); cx = -1.0
    T.k = 0.8; T.cyl('dark', (cx, 2.05, 0), 0.9, 0.2, 'y', 14)
    T.k = 1.0; T.hull('body', [(cx + u, 2.25 + u * 0.08 + e, w) for u in (-2.0, 2.0) for e in (0, 1.05) for w in (-1.15, 1.15)])
    for row in (0, 1):
        for j in range(6):
            u = 2.02; v = 2.25 + 2.0 * 0.08 + 0.28 + row * 0.5; w = (j - 2.5) * 0.36
            T.k = 0.4; T.hull('dark', [(cx + u + e, v + dv, w + dw) for e in (0, 0.03) for dv in (-0.19, 0.19) for dw in (-0.15, 0.15)])
            T.k = 0.9; T.cyl('white', (cx + u + 0.04, v, w), 0.09, 0.03, 'x', 8)
    for u in (-1.2, 0.0, 1.2): T.k = 0.85; T.hull('body', [(cx + u + du, 2.25 + u * 0.08 + e, w) for du in (-0.05, 0.05) for e in (-0.03, 1.08) for w in (-1.18, 1.18)])
    return [('hull', M, None), ('turret', T, 0)]

def k_dozer():  # D9 armoured: tracks, an engine bay with a grille, an armoured cab with slit windows, a curved blade, a ripper
    M = Mesh(); L, W = 6.2, 3.4; hw = W / 2
    M.tracks(-L / 2 + 0.7, L / 2 - 1.5, hw - 0.4, 1.3, 0.7, 5)
    M.k = 1.0; M.loft('body', [(-L / 2 + 0.4, [(1.3, hw - 0.75), (1.3, -hw + 0.75), (2.0, hw - 0.75), (2.0, -hw + 0.75)]),
                              (L / 2 - 1.6, [(1.3, hw - 0.75), (1.3, -hw + 0.75), (2.05, hw - 0.75), (2.05, -hw + 0.75)])])
    M.loft('body', [(0.0, [(2.0, 0.7), (2.0, -0.7), (2.75, 0.6), (2.75, -0.6)]), (L / 2 - 1.4, [(2.0, 0.65), (2.0, -0.65), (2.6, 0.55), (2.6, -0.55)])])  # engine bay
    for xx in np.arange(0.3, L / 2 - 1.5, 0.18): M.k = 0.55; M.box('dark', (xx, 2.76, 0), (0.07, 0.03, 0.9))
    M.k = 0.65; M.cyl('dark', (0.2, 3.3, 0.45), 0.09, 1.1, 'y', 8)                                                       # exhaust
    M.k = 1.0; M.hull('body', [(x, 2.0, z) for x in (-2.2, -0.2) for z in (hw - 0.8, -hw + 0.8)] + [(x, 3.7, z) for x in (-2.1, -0.4) for z in (hw - 0.9, -hw + 0.9)])  # armoured cab
    for sz in (-1, 1): M.k = 1.0; M.box('glass', (-1.2, 3.15, sz * (hw - 0.83)), (1.2, 0.2, 0.04))
    M.k = 1.0; M.box('glass', (-0.27, 3.15, 0), (0.04, 0.2, 1.3))
    M.k = 0.95; M.box('body', (-1.15, 3.78, 0), (1.9, 0.16, W - 1.6))
    a = np.linspace(-0.6, 0.6, 7)  # (the blade: curved, its edge at the bottom)
    blade = [(1.22 + 1.9 * np.sin(t), 0.9 * (1 - np.cos(t))) for t in a]  # (y, x: from the ground up to over the hood, hollow to the front)
    for (y0, x0), (y1, x1) in zip(blade, blade[1:]):
        M.k = 1.0; M.hull('body', [(L / 2 - 0.2 + xx + e, yy, z) for (yy, xx) in ((y0, x0), (y1, x1)) for z in (hw + 0.2, -hw - 0.2) for e in (0, 0.18)])
    M.k = 0.7; M.box('metal', (L / 2 - 0.05, 0.12, 0), (0.25, 0.2, W + 0.4))                                             # the cutting edge
    for sz in (-1, 1):
        M.k = 0.8; M.hull('dark', [(L / 2 - 2.0, 0.9, sz * (hw + 0.05)), (L / 2 - 2.0, 1.25, sz * (hw + 0.05)), (L / 2 - 0.2, 0.7, sz * (hw + 0.05)), (L / 2 - 0.2, 1.1, sz * (hw + 0.05)),
                                   (L / 2 - 2.0, 0.9, sz * (hw - 0.2)), (L / 2 - 0.2, 0.7, sz * (hw - 0.2))])   # push arms
        M.strut('metal', (L / 2 - 1.3, 2.0, sz * 0.6), (L / 2 - 0.15, 1.6, sz * 0.6), 0.09)                           # lift rams
    M.k = 0.8; M.box('dark', (-L / 2 + 0.2, 1.4, 0), (0.3, 0.3, 1.8))
    M.hull('dark', [(-L / 2 - 0.1, 1.4, -0.12), (-L / 2 - 0.1, 1.4, 0.12), (-L / 2 - 0.3, 0.0, -0.1), (-L / 2 - 0.3, 0.0, 0.1), (-L / 2 + 0.15, 1.3, 0), (-L / 2 - 0.05, 0.3, 0)])  # ripper
    return [('hull', M, None)]


# ---- aircraft (flown level at V3_AIR in the game): a fighter, a tanker; a helicopter's rotor is its `turret`, which
# the game turns round and round. Bodies lofted through round sections ----
def round_secs(xs_rs, cy=0.0, sq=1.0, n=12, cz=0.0):
    """[(x, r) or (x, r, dy)] -> loft sections of circles (squashed `sq` across) round (cy, cz), each raised dy"""
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return [(p[0], [(cy + (p[2] if len(p) > 2 else 0) + p[1] * np.sin(t), cz + p[1] * sq * np.cos(t)) for t in a]) for p in xs_rs]

def wing(M, mat, pts, y, t=0.12, sz=1):
    """a wing: its outline (x, z) at height y, thinner toward the tip"""
    P = [(x, y, sz * z) for x, z in pts]
    root = max(abs(p[1]) for p in pts) * 0 + min(abs(z) for _, z in pts)
    M.hull(mat, P + [(x, y + (t if abs(z) <= root + 0.01 else t * 0.4), sz * z) for x, z in pts])

def k_air():  # a fighter (F-16-like): a lofted body, a belly intake, a bubble canopy, cropped deltas, missiles at the tips
    M = Mesh()
    M.k = 1.0; M.loft('body', round_secs([(-5.2, 0.42), (-4.4, 0.55), (-1.0, 0.7), (1.5, 0.66, 0.05), (3.5, 0.5, 0.05), (5.0, 0.28, 0.0), (6.0, 0.05, -0.05)], 0, 1.05))
    M.k = 0.5; M.loft('dark', round_secs([(-5.5, 0.36), (-5.2, 0.42)]))                                                # nozzle
    M.k = 0.9; M.hull('body', [(x, y, z) for x in (0.6, 2.6) for y in (-0.95, -0.45) for z in (-0.45, 0.45)] + [(-0.5, -0.5, 0.4), (-0.5, -0.5, -0.4)])  # intake
    M.k = 0.3; M.box('dark', (2.62, -0.7, 0), (0.04, 0.4, 0.75))
    M.k = 1.0; M.loft('glass', [(1.8, [(0.55, 0.0), (0.6, 0.25), (0.6, -0.25)]), (2.6, [(0.55, 0.3), (0.55, -0.3), (1.05, 0.0), (0.98, 0.2), (0.98, -0.2)]), (3.8, [(0.45, 0.2), (0.45, -0.2), (0.6, 0.0)])])
    for sz in (1, -1):
        M.k = 1.0; wing(M, 'body', [(1.6, 0.6), (-2.6, 4.7), (-3.5, 4.7), (-3.4, 0.6)], -0.05, 0.12, sz)
        M.k = 0.95; wing(M, 'body', [(-3.6, 0.4), (-4.9, 2.3), (-5.5, 2.3), (-5.3, 0.4)], 0.0, 0.08, sz)
        missile(M, -2.8, -0.02, sz * 4.85, 2.4, 0.08, 0.0)
        missile(M, -0.6, -0.4, sz * 2.4, 2.8, 0.11, 0.0); M.k = 0.7; M.box('dark', (-0.6, -0.2, sz * 2.4), (1.0, 0.25, 0.06))
        M.k = 0.9; M.hull('body', [(-4.2, -0.4, sz * 0.4), (-5.0, -0.4, sz * 0.4), (-5.2, -1.0, sz * 0.55), (-4.6, -1.0, sz * 0.55), (-4.2, -0.4, sz * 0.36)])  # ventral fins
    M.k = 1.0; M.hull('body', [(-3.0, 0.5, 0.06), (-3.0, 0.5, -0.06), (-4.9, 3.1, 0.04), (-4.9, 3.1, -0.04), (-5.5, 3.1, 0.04), (-5.4, 0.45, 0.06), (-5.4, 0.45, -0.06)])  # fin
    M.k = 0.9; M.cyl('tank', (0.3, -0.95, 0), 0.35, 3.2, 'x', 12)                                                     # belly tank
    return [('hull', M, None)]

def k_tanker():  # a four-engined tanker (KC-135-like), lofted, with a flight deck, nacelles and a boom
    M = Mesh()
    M.k = 1.0; M.loft('body', round_secs([(-16.5, 0.35, 0.9), (-14.0, 1.2, 0.35), (-10.0, 1.65), (11.0, 1.65), (13.5, 1.4, -0.1), (15.0, 0.9, -0.3), (15.8, 0.25, -0.45)], 0, 1.0, 16))
    M.k = 0.9; M.hull('glass', [(13.9, 0.9, 0.7), (13.9, 0.9, -0.7), (14.8, 0.45, 0.55), (14.8, 0.45, -0.55), (13.9, 1.1, 0.5), (13.9, 1.1, -0.5)])
    for x in np.arange(-11, 11, 1.2):  # (windows down the sides)
        for sz in (-1, 1): M.k = 1.0; M.box('glass', (x, 0.5, sz * 1.62), (0.25, 0.3, 0.04))
    for sz in (1, -1):
        M.k = 1.0; wing(M, 'body', [(3.5, 1.4), (-5.0, 19.0), (-6.8, 19.0), (-2.6, 1.4)], -0.6, 0.3, sz)
        for z in (6.5, 12.0):
            xx = 0.6 - z * 0.42
            M.k = 0.9; M.loft('metal', round_secs([(xx - 1.6, 0.5), (xx - 0.6, 0.65), (xx + 1.4, 0.62)], -1.35, 1.0, 10))
            M.k = 0.3; M.cyl('dark', (xx + 1.45, -1.35, sz * z), 0.5, 0.06, 'x', 10)
            M.k = 0.8; M.box('metal', (xx, -0.75, sz * z), (1.6, 0.6, 0.15))
        M.k = 0.95; wing(M, 'body', [(-12.5, 0.8), (-15.3, 6.5), (-16.6, 6.5), (-16.2, 0.8)], 0.7, 0.18, sz)
    M.k = 1.0; M.hull('body', [(-11.5, 1.3, 0.15), (-11.5, 1.3, -0.15), (-15.6, 7.6, 0.08), (-15.6, 7.6, -0.08), (-17.2, 7.6, 0.08), (-16.8, 1.0, 0.15), (-16.8, 1.0, -0.15)])
    M.k = 0.8; M.strut('dark', (-15.5, -0.6, 0), (-19.5, -2.0, 0), 0.18); M.box('dark', (-18.5, -1.7, 0), (0.15, 0.08, 1.2))  # the boom, its vanes
    return [('hull', M, None)]

def rotor(r, y, x=0.0, blades=4):
    """a rotor: a hub with a cap, tapered blades a little twisted"""
    T = Mesh()
    T.k = 0.8; T.cyl('metal', (x, y - 0.3, 0), 0.22, 0.6, 'y', 10); T.cyl('metal', (x, y + 0.05, 0), 0.4, 0.2, 'y', 10, r2=0.15)
    for i in range(blades):
        a = 2 * np.pi * i / blades; c, s = np.cos(a), np.sin(a)
        def P(u, v, e): return (x + u * c - v * s, y + e, u * s + v * c)
        T.k = 0.9; T.hull('dark', [P(0.3, -0.25, 0), P(0.3, 0.25, 0), P(r / 2, -0.18, 0.06), P(r / 2, 0.18, -0.02), P(0.3, -0.25, 0.06), P(r / 2, 0.18, 0.04)])
        T.k = 1.1; T.hull('warn', [P(r / 2 - 0.25, -0.18, 0.07), P(r / 2 - 0.25, 0.18, 0.07), P(r / 2, -0.18, 0.07), P(r / 2, 0.18, 0.07), P(r / 2 - 0.25, 0.0, 0.1)])  # tips
    return T

def tail(M, x, y, h, rr):  # a tail boom's fin and a two-bladed tail rotor
    M.k = 1.0; M.hull('body', [(x, y, 0.08), (x, y, -0.08), (x - 1.0, y + h, 0.06), (x - 1.0, y + h, -0.06), (x - 1.6, y + h, 0.06), (x - 0.9, y - 0.1, 0.08), (x - 0.9, y - 0.1, -0.08)])
    for a in (0.6, 0.6 + np.pi / 2):
        M.k = 0.9; M.hull('dark', [(x - 1.0 + np.cos(a) * rr * k - np.sin(a) * dw, y + h * 0.55 + np.sin(a) * rr * k + np.cos(a) * dw, 0.22 + e) for k in (-1, 1) for dw in (-0.1, 0.1) for e in (0, 0.04)])

def k_heli():  # an attack helicopter (Apache): a narrow lofted body, a stepped two-seat canopy, engines at the sides,
    # stub wings with rocket pods and missiles, a chin gun, a tail wheel
    M = Mesh()
    M.k = 1.0; M.loft('body', [(-1.6, [(0.9, 0.6), (0.9, -0.6), (2.6, 0.55), (2.6, -0.55), (1.7, 0.75), (1.7, -0.75)]),
                              (1.5, [(0.7, 0.62), (0.7, -0.62), (2.3, 0.55), (2.3, -0.55), (1.5, 0.72), (1.5, -0.72)]),
                              (3.3, [(0.9, 0.42), (0.9, -0.42), (1.7, 0.4), (1.7, -0.4)]),
                              (4.1, [(1.15, 0.2), (1.15, -0.2), (1.45, 0.15), (1.45, -0.15)])])
    M.k = 1.0; M.hull('glass', [(1.0, 2.25, 0.55), (1.0, 2.25, -0.55), (1.0, 3.0, 0.4), (1.0, 3.0, -0.4), (2.1, 2.2, 0.55), (2.1, 2.2, -0.55), (1.6, 2.75, 0.35), (1.6, 2.75, -0.35)])  # rear seat
    M.hull('glass', [(2.2, 2.15, 0.55), (2.2, 2.15, -0.55), (2.2, 2.65, 0.35), (2.2, 2.65, -0.35), (3.4, 1.65, 0.42), (3.4, 1.65, -0.42), (2.9, 2.1, 0.25), (2.9, 2.1, -0.25)])  # front seat, lower
    for sz in (-1, 1):  # (the engines, at the sides)
        M.k = 0.95; M.loft('body', round_secs([(-1.5, 0.35), (-0.6, 0.48), (0.6, 0.45), (1.0, 0.3)], 2.55, 1.0, 10, sz * 0.95))
        M.k = 0.4; M.cyl('dark', (1.02, 2.55, sz * 0.95), 0.26, 0.04, 'x', 10)
    M.k = 1.0; M.loft('body', round_secs([(-1.6, 0.42, 1.95), (-6.6, 0.22, 2.2)], 0, 1.0, 8))                         # tail boom
    tail(M, -6.4, 2.2, 2.0, 1.0)
    for sz in (1, -1): M.k = 0.95; M.hull('body', [(-6.3, 2.5, sz * 0.1), (-6.9, 2.5, sz * 0.1), (-6.3, 2.5, sz * 1.3), (-6.7, 2.5, sz * 1.3), (-6.3, 2.58, sz * 0.1), (-6.9, 2.58, sz * 1.3)])  # tailplane
    M.k = 1.0; M.hull('body', [(x, y, z) for x in (-0.2, 0.9) for y in (1.25, 1.4) for z in (-2.1, 2.1)])                 # stub wings
    for sz in (-1, 1):  # (rocket pods inboard, missiles outboard)
        M.k = 0.8; M.loft('dark', round_secs([(-0.4, 0.26), (0.8, 0.3)], 0.95, 1.0, 10, sz * 1.25))
        M.k = 0.5; M.cyl('dark', (0.82, 0.95, sz * 1.25), 0.22, 0.04, 'x', 10)
        for dz in (-0.18, 0.18):
            for dy in (-0.18, 0.18): missile(M, 0.4, 0.95 + dy, sz * 2.0 + dz, 1.4, 0.07, 0.0, False)
        M.k = 0.6; M.box('dark', (0.4, 1.2, sz * 2.0), (1.0, 0.1, 0.5))
        M.k = 0.7; M.strut('dark', (0.6, 0.85, sz * 0.5), (0.6, 0.1, sz * 0.9), 0.07); M.k = 0.8; M.tyre((0.6, 0.25, sz * 0.95), 0.25, 0.15, sz)  # main gear
    M.k = 0.6; M.cyl('dark', (3.3, 0.55, 0), 0.22, 0.4, 'y', 10); M.cyl('dark', (3.8, 0.55, 0), 0.05, 1.0, 'x', 6)   # chin gun
    M.k = 0.95; M.cyl('body', (0.2, 2.95, 0), 0.5, 0.7, 'y', 10)                                                            # mast fairing
    return [('hull', M, None), ('turret', rotor(13.0, 3.5, 0.2), 0)]

def k_gunship():  # a utility helicopter with door guns (Black Hawk): a deep lofted cabin, open doors, a long tail
    M = Mesh()
    M.k = 1.0; M.loft('body', [(-2.6, [(0.5, 1.0), (0.5, -1.0), (2.5, 0.9), (2.5, -0.9), (2.8, 0.5), (2.8, -0.5)]),
                              (1.6, [(0.4, 1.1), (0.4, -1.1), (2.4, 1.0), (2.4, -1.0), (2.75, 0.5), (2.75, -0.5)]),
                              (3.3, [(0.55, 0.9), (0.55, -0.9), (2.2, 0.85), (2.2, -0.85)]),
                              (4.2, [(0.8, 0.6), (0.8, -0.6), (1.5, 0.5), (1.5, -0.5)])])
    M.k = 1.0; M.hull('glass', [(2.6, 1.6, 0.85), (2.6, 1.6, -0.85), (2.6, 2.3, 0.8), (2.6, 2.3, -0.8), (3.9, 1.4, 0.55), (3.9, 1.4, -0.55), (3.5, 1.95, 0.6), (3.5, 1.95, -0.6)])
    for sz in (-1, 1):
        M.k = 0.25; M.box('dark', (0.4, 1.5, sz * 1.08), (1.8, 1.4, 0.05))                                                 # open door
        M.k = 0.8; M.strut('dark', (0.9, 1.7, sz * 1.15), (2.2, 1.8, sz * 1.55), 0.05); M.box('dark', (0.9, 1.7, sz * 1.15), (0.4, 0.25, 0.15))  # door gun
        M.k = 0.7; M.strut('dark', (-0.6, 0.45, sz * 0.9), (-0.6, 0.1, sz * 1.2), 0.06); M.tyre((-0.6, 0.3, sz * 1.25), 0.3, 0.18, sz)
        M.k = 1.0; M.box('glass', (2.2, 2.0, sz * 1.0), (0.7, 0.5, 0.04))
    M.k = 0.95; M.loft('body', round_secs([(-1.5, 0.45, 2.4), (-0.4, 0.55, 2.7)], 0, 1.0, 10))                         # engine
    M.k = 1.0; M.loft('body', round_secs([(-2.6, 0.55, 2.1), (-7.4, 0.24, 2.35)], 0, 1.0, 8))
    tail(M, -7.2, 2.35, 2.0, 1.1)
    M.k = 0.95; M.hull('body', [(-7.0, 2.3, -1.4), (-7.0, 2.3, 1.4), (-7.6, 2.3, -1.4), (-7.6, 2.3, 1.4), (-7.0, 2.38, 0), (-7.6, 2.38, 0)])
    M.k = 0.7; M.tyre((2.8, 0.3, 0), 0.25, 0.15, 1)
    M.k = 0.95; M.cyl('body', (0.0, 3.0, 0), 0.6, 0.6, 'y', 10)
    return [('hull', M, None), ('turret', rotor(14.0, 3.5, 0.0), 0)]

def k_lift():  # a heavy transport helicopter (CH-53): a long boxy body, a rear ramp, sponsons, a six-bladed rotor
    M = Mesh()
    M.k = 1.0; M.loft('body', [(-4.6, [(0.8, 1.3), (0.8, -1.3), (3.2, 1.25), (3.2, -1.25)]),
                              (3.6, [(0.6, 1.35), (0.6, -1.35), (3.3, 1.3), (3.3, -1.3), (3.5, 0.8), (3.5, -0.8)]),
                              (5.0, [(0.8, 1.1), (0.8, -1.1), (2.8, 1.0), (2.8, -1.0)]),
                              (5.8, [(1.1, 0.7), (1.1, -0.7), (2.0, 0.6), (2.0, -0.6)])])
    M.k = 1.0; M.hull('glass', [(4.3, 2.0, 1.05), (4.3, 2.0, -1.05), (4.3, 2.9, 0.9), (4.3, 2.9, -0.9), (5.6, 1.6, 0.65), (5.6, 1.6, -0.65), (5.1, 2.3, 0.75), (5.1, 2.3, -0.75)])
    M.k = 0.95; M.hull('body', [(-4.6, 1.0, 1.2), (-4.6, 1.0, -1.2), (-4.6, 3.0, 1.2), (-4.6, 3.0, -1.2), (-6.3, 2.0, 0.9), (-6.3, 2.0, -0.9), (-6.3, 3.0, 0.9), (-6.3, 3.0, -0.9)])  # ramp
    for x in np.arange(-3.6, 3.5, 0.9):
        for sz in (-1, 1): M.k = 1.0; M.box('glass', (x, 2.5, sz * 1.36), (0.35, 0.35, 0.04))
    for sz in (-1, 1):
        M.k = 1.0; M.loft('body', [(-1.5, [(0.6, sz * 1.3), (0.6, sz * 2.2), (1.6, sz * 1.3), (1.4, sz * 2.0)]), (1.8, [(0.6, sz * 1.3), (0.6, sz * 2.2), (1.6, sz * 1.3), (1.4, sz * 2.0)])])  # sponson
        M.k = 0.8; M.tyre((0.2, 0.45, sz * 1.9), 0.45, 0.3, sz)
        M.k = 0.95; M.loft('body', round_secs([(-1.0, 0.5, 3.6), (1.2, 0.55, 3.6)], 0, 1.0, 10, sz * 1.0))
        M.k = 0.4; M.cyl('dark', (1.22, 3.6, sz * 1.0), 0.4, 0.04, 'x', 10)
    M.k = 0.7; M.tyre((4.2, 0.4, 0), 0.38, 0.25, 1)
    M.k = 1.0; M.loft('body', round_secs([(-6.3, 0.6, 2.8), (-10.6, 0.3, 3.1)], 0, 1.0, 8))
    tail(M, -10.4, 3.1, 2.8, 1.5)
    M.k = 0.95; M.cyl('body', (0.6, 3.9, 0), 0.6, 0.7, 'y', 10)
    return [('hull', M, None), ('turret', rotor(17.0, 4.4, 0.6, 6), 0)]

def jeep():  # a light armoured 4×4 (Humvee-like): low and wide, a sloped bonnet, a squared cab, a turret ring on top
    M = Mesh(); L, W = 4.8, 2.2; hw = W / 2
    M.k = 1.0; M.loft('body', [(-L / 2, [(0.55, hw - 0.05), (0.55, -hw + 0.05), (1.3, hw - 0.1), (1.3, -hw + 0.1)]),
                              (L / 2 - 1.5, [(0.55, hw), (0.55, -hw), (1.3, hw - 0.1), (1.3, -hw + 0.1)]),
                              (L / 2 - 0.05, [(0.55, hw - 0.05), (0.55, -hw + 0.05), (1.1, hw - 0.15), (1.1, -hw + 0.15)])])
    M.k = 1.0; M.hull('body', [(x, 1.25, z) for x in (-1.6, L / 2 - 1.5) for z in (hw - 0.12, -hw + 0.12)] + [(x, 1.9, z) for x in (-1.5, L / 2 - 1.8) for z in (hw - 0.18, -hw + 0.18)])
    M.k = 1.0; M.box('glass', (L / 2 - 1.66, 1.6, 0), (0.06, 0.45, W - 0.5), tilt=0.3)
    for sz in (-1, 1):
        for x in (-0.9, 0.2): M.k = 1.0; M.box('glass', (x, 1.6, sz * (hw - 0.14)), (0.6, 0.38, 0.04))
        M.k = 0.7; M.box('dark', (-0.35, 0.95, sz * (hw + 0.01)), (0.04, 0.6, 0.03))
        M.k = 1.0; M.cyl('white', (L / 2 - 0.02, 0.95, sz * (hw - 0.3)), 0.1, 0.05, 'x', 8)
        M.strut('dark', (L / 2 - 1.5, 1.5, sz * hw), (L / 2 - 1.3, 1.6, sz * (hw + 0.3)), 0.03)
    M.k = 0.5; M.box('dark', (L / 2 - 0.01, 0.8, 0), (0.05, 0.4, W - 0.9))
    M.k = 0.7; M.block('dark', (L / 2 + 0.08, 0.6, 0), (0.2, 0.25, W - 0.2), 0.2)
    M.k = 0.8; M.cyl('dark', (-0.6, 1.95, 0), 0.62, 0.14, 'y', 14)                                                       # turret ring
    M.wheels([1.5, -1.4], hw - 0.12, 0.5, 0.4)
    return M

def k_ajeep():  # anti-aircraft: a twin cannon on a turntable behind a shield
    M = jeep(); T = Mesh()
    T.k = 0.8; T.cyl('dark', (-0.6, 2.05, 0), 0.55, 0.12, 'y', 12)
    T.k = 1.0; T.block('body', (-0.6, 2.40, 0), (0.8, 0.55, 0.9), 0.12)
    T.k = 1.0; T.hull('body', [(-0.15, 2.10, z) for z in (-0.65, 0.65)] + [(-0.05, 2.80, z) for z in (-0.6, 0.6)] + [(-0.25, 2.10, z) for z in (-0.65, 0.65)])  # shield
    for sz in (-0.22, 0.22):
        T.k = 0.7; T.cyl('dark', (0.45, 2.90, sz), 0.07, 1.9, 'x', 8, tilt=0.55); T.cyl('dark', (0.0, 2.65, sz), 0.12, 0.6, 'x', 8, tilt=0.55)
    T.k = 0.9; T.box('olive', (-0.75, 2.55, 0.5), (0.4, 0.4, 0.15))                                                        # ammo box
    return [('hull', M, None), ('turret', T, 0)]

def k_tjeep():  # anti-tank: a TOW launcher on a mount, its sight
    M = jeep(); T = Mesh()
    T.k = 0.8; T.cyl('dark', (-0.6, 2.05, 0), 0.5, 0.12, 'y', 12)
    T.k = 0.7; T.strut('dark', (-0.6, 2.10, 0), (-0.6, 2.55, 0), 0.08)
    T.k = 1.0; T.block('body', (-0.6, 2.70, 0), (0.6, 0.4, 0.5), 0.15)
    T.k = 0.95; T.loft('warn', round_secs([(-1.2, 0.16), (0.6, 0.18), (0.75, 0.14)], 2.95, 1.0, 10))
    T.k = 0.6; T.box('dark', (-0.45, 2.80, -0.36), (0.45, 0.25, 0.22)); T.k = 1.0; T.box('glass', (-0.22, 2.80, -0.36), (0.02, 0.15, 0.14))
    return [('hull', M, None), ('turret', T, 0)]

KINDS = {'air': k_air, 'tanker': k_tanker, 'heli': k_heli, 'gunship': k_gunship, 'lift': k_lift, 'ajeep': k_ajeep, 'tjeep': k_tjeep,
         'truck': k_truck, 'fueltruck': lambda: k_tanktruck('tank'), 'watertruck': lambda: k_tanktruck('water'),
         'radio': k_radio, 'mech': k_mech, 'ssm': k_ssm, 'arrow': k_launcher(2, 2, 0.75), 'dome': k_launcher(3, 4, 0.6),
         'mlrs': k_mlrs, 'dozer': k_dozer}

if __name__ == '__main__':
    for k in (sys.argv[1:] or KINDS):
        write(k, KINDS[k]())
