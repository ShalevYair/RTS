"""3D models of the buildings, built in code (tools/build_models.py's Mesh) -> art/models/b_<kind>.glb, then
`python tools/models.py` bakes them like the rest. In the style of their pictures (art/b_<kind>.jpg): a base walled in
with sand barriers, concrete and canvas, blue corrugated roofs (`body`: the side's colour in the game), antennas, crates.

Front +X (toward the enemy, for blue), up +Y, metres; models.py scales the length (along X) to 1 and the game to the
building's size. Each piece a little lighter or darker (Mesh.k), so a wall of barriers isn't one flat colour.

  python tools/build_buildings.py           every kind below
  python tools/build_buildings.py hq tent   only those
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from build_models import Mesh, write, ry

GEN = 'tools/build_buildings.py'


class B(Mesh):
    """a building's mesh, with the pieces they're made of"""
    def __init__(self, seed):
        super().__init__(); self.r = np.random.default_rng(seed)

    def var(self, a=0.9, b=1.1): self.k = float(self.r.uniform(a, b)); return self

    def pad(self, L, W, mat='concrete', y=0.12, tile=4.0):
        """the base's ground: slabs of concrete, each a shade of its own"""
        nx, nz = max(1, int(round(L / tile))), max(1, int(round(W / tile)))
        for i in range(nx):
            for j in range(nz):
                self.var(0.72, 0.84).box(mat, (-L / 2 + (i + 0.5) * L / nx, y / 2, -W / 2 + (j + 0.5) * W / nz), (L / nx - 0.06, y, W / nz - 0.06))
        self.k = 0.6; self.box('asphalt', (0, y / 2 - 0.01, 0), (L, y - 0.02, W))  # (the joints between)
        self.k = 1.0; return self

    def barrier(self, a, b, h=1.3, s=1.1):
        """a line of filled sand barriers (HESCO) from a to b (x, z): wire-mesh baskets, the sand a little sunk in each"""
        a, b = np.asarray(a, float), np.asarray(b, float); d = b - a; L = np.hypot(*d); n = max(1, int(round(L / s)))
        ang = np.arctan2(d[1], d[0]); step = L / n
        for i in range(n):
            c = a + d * (i + 0.5) / n; hh = h * self.r.uniform(0.94, 1.04)
            self.var(0.82, 1.08).box('sand', (c[0], hh / 2, c[1]), (step * 0.97, hh, s), rot=-ang)
            self.k *= 0.8; self.box('sand', (c[0], hh + 0.02, c[1]), (step * 0.8, 0.05, s * 0.8), rot=-ang)
        self.k = 1.0; return self

    def wall_ring(self, L, W, gate=6.0, h=1.3, s=1.1, gate_side='+x'):
        """barriers round an L × W yard, an opening of `gate` in the middle of one side"""
        x, z = L / 2 - s / 2, W / 2 - s / 2; g = gate / 2
        if gate_side == '+x': self.barrier((x, -z), (x, -g), h, s).barrier((x, g), (x, z), h, s)
        else: self.barrier((x, -z), (x, z), h, s)
        self.barrier((-x, -z), (-x, z), h, s)
        self.barrier((-x + s, z), (x - s, z), h, s).barrier((-x + s, -z), (x - s, -z), h, s)
        return self

    def roof(self, cx, cz, L, W, y0, h, over=0.5, mat='body', ribs=1.0, along='x', ends='concrete'):
        """a gable roof of corrugated sheets: two slopes meeting at a ridge (along x, or z), ribs down each slope; the
        walls' triangles under it at the ends (`ends`: their material, None = none)"""
        if ends: self.gable_ends(cx, cz, L, W, y0, h, ends, along)
        t = 0.14
        def P(u, v, y):  # (u along the ridge, v across)
            return (cx + u, y, cz + v) if along == 'x' else (cx + v, y, cz + u)
        hu, hv = L / 2 + over, W / 2 + over
        for sv in (-1, 1):
            pts = [P(u, sv * hv, y0 + dy) for u in (-hu, hu) for dy in (0, t)] + [P(u, 0, y0 + h + h * over / (W / 2) + dy) for u in (-hu, hu) for dy in (0, t)]
            self.k = 1.0 if sv > 0 else 0.96; self.hull(mat, pts)
            # (the ribs: thin lighter strips down the slope)
            ytop = y0 + h + h * over / (W / 2)
            for u in np.arange(-hu + ribs / 2, hu, ribs):
                self.k = 1.12; w = 0.07
                self.hull(mat, [P(u + du, sv * hv, y0 + t + e) for du in (-w, w) for e in (0, 0.05)] + [P(u + du, 0, ytop + t + e) for du in (-w, w) for e in (0, 0.05)])
        self.k = 0.6; self.hull('dark', [P(u, 0, y0 + h + h * over / (W / 2) + t + e) + np.zeros(3) for u in (-hu, hu) for e in (0, 0.12)] + [P(u, dv, y0 + h + h * over / (W / 2) + t - 0.1) for u in (-hu, hu) for dv in (-0.25, 0.25)])
        self.k = 1.0; return self

    def gable_ends(self, cx, cz, L, W, y0, h, mat='concrete', along='x'):
        for su in (-1, 1):
            u = su * L / 2
            pts = [(u + du, y0, v) for v in (-W / 2, W / 2) for du in (-0.15, 0.15)] + [(u + du, y0 + h, 0) for du in (-0.15, 0.15)]
            pts = [(cx + p[0], p[1], cz + p[2]) if along == 'x' else (cx + p[2], p[1], cz + p[0]) for p in pts]
            self.hull(mat, pts)
        return self

    def windows(self, x0, x1, y, z, n, w=1.1, h=1.0, face=1, along='x'):
        """a row of windows on a wall (at z, facing ±z; or at x facing ±x — along='z'), each a dark pane in a light frame"""
        for x in np.linspace(x0, x1, n):
            if along == 'x':
                self.k = 1.15; self.box('concrete', (x, y, z + face * 0.04), (w + 0.25, h + 0.25, 0.08))
                self.k = self.r.uniform(0.8, 1.2); self.box('glass', (x, y, z + face * 0.09), (w, h, 0.06))
            else:
                self.k = 1.15; self.box('concrete', (z + face * 0.04, y, x), (0.08, h + 0.25, w + 0.25))
                self.k = self.r.uniform(0.8, 1.2); self.box('glass', (z + face * 0.09, y, x), (0.06, h, w))
        self.k = 1.0; return self

    def roller(self, x, y, z, w, h, face=1):
        """a roller door on a wall facing +x: grey slats"""
        for i, yy in enumerate(np.arange(y - h / 2 + 0.15, y + h / 2, 0.3)):
            self.k = 0.95 + 0.1 * (i % 2); self.box('metal', (x + face * 0.06, yy, z), (0.08, 0.28, w))
        self.k = 1.0; return self

    def crates(self, x, z, nx, nz, layers=2, s=1.0, mat='olive'):
        for i in range(nx):
            for j in range(nz):
                for l in range(int(self.r.integers(1, layers + 1))):
                    self.var(0.85, 1.12).block(mat, (x + i * s * 1.05, s * 0.45 + l * s * 0.9, z + j * s * 1.05), (s, s * 0.9, s), 0.1, rot=float(self.r.uniform(-0.08, 0.08)))
        self.k = 1.0; return self

    def barrels(self, x, z, n, mat='olive'):
        for i in range(n):
            a = i * 2.4; rr = 0.55 * np.sqrt(i)
            self.var(0.85, 1.1).cyl(mat, (x + np.cos(a) * rr, 0.45, z + np.sin(a) * rr), 0.3, 0.9, 'y', 10)
            self.k *= 0.7; self.cyl(mat, (x + np.cos(a) * rr, 0.91, z + np.sin(a) * rr), 0.22, 0.03, 'y', 8)
        self.k = 1.0; return self

    def sandbags(self, x, z, r, n, rows=2):
        """a ring of sandbags (a gun pit)"""
        for row in range(rows):
            for i in range(n):
                a = 2 * np.pi * (i + 0.5 * row) / n
                self.var(0.85, 1.05).block('sand', (x + np.cos(a) * r, 0.2 + row * 0.33, z + np.sin(a) * r), (0.75, 0.32, 0.42), 0.35, rot=-a + np.pi / 2)
        self.k = 1.0; return self

    def mast(self, x, z, h, y0=0.0, dishes=2):
        """a lattice mast: three legs, braces every metre, dishes and whips on top"""
        r0, r1 = 0.5, 0.18
        legs = [(np.cos(a), np.sin(a)) for a in (0, 2.094, 4.189)]
        for c, s_ in legs:
            p0 = np.array((x + c * r0, y0, z + s_ * r0)); p1 = np.array((x + c * r1, y0 + h, z + s_ * r1))
            self.strut('metal', p0, p1, 0.06)
        for y in np.arange(y0 + 1.0, y0 + h, 1.2):
            r = r0 + (r1 - r0) * (y - y0) / h
            pts = [np.array((x + c * r, y, z + s_ * r)) for c, s_ in legs]
            for i in range(3): self.strut('metal', pts[i], pts[(i + 1) % 3], 0.03)
        for i in range(dishes):
            a = 1.0 + i * 2.2; y = y0 + h * (0.65 + 0.15 * i)
            self.k = 1.0; self.cyl('white', (x + np.cos(a) * 0.6, y, z + np.sin(a) * 0.6), 0.55, 0.15, 'x', 14, r2=0.15, rot=-a)
        self.strut('dark', np.array((x, y0 + h, z)), np.array((x, y0 + h + 2.5, z)), 0.03)
        return self

    def strut(self, mat, p0, p1, w):
        d = p1 - p0; L = np.linalg.norm(d)
        if L < 1e-6: return self
        u = d / L; a = np.cross(u, (0, 1, 0) if abs(u[1]) < 0.9 else (1, 0, 0)); a /= np.linalg.norm(a); b = np.cross(u, a)
        self.hull(mat, [p + (a * sa + b * sb) * w for p in (p0, p1) for sa, sb in ((1, 0), (-0.5, 0.87), (-0.5, -0.87))])
        return self

    def flag(self, x, z, h=7.0, w=2.6, fh=1.6):
        """a pole and a flag in the side's colour, in a wave (both faces)"""
        self.strut('metal', np.array((x, 0, z)), np.array((x, h + 0.2, z)), 0.07)
        self.k = 1.0; self.cyl('metal', (x, h + 0.25, z), 0.12, 0.12, 'y', 8)
        n = 6; xs = [x - w * i / n for i in range(n + 1)]; zs = [z + 0.25 * np.sin(i * 1.3) * i / n for i in range(n + 1)]
        for i in range(n):
            q = [(xs[i], h, zs[i]), (xs[i + 1], h - 0.05, zs[i + 1]), (xs[i + 1], h - fh - 0.05, zs[i + 1]), (xs[i], h - fh, zs[i])]
            self.k = 0.92 + 0.12 * (i % 2); self.add('body', q, [(0, 1, 2, 3), (3, 2, 1, 0)])
        self.k = 1.0; return self

    def ac(self, x, y, z):
        """a rooftop air-conditioning unit: a grey box, a dark fan on top"""
        self.var(0.9, 1.05).block('metal', (x, y + 0.35, z), (1.0, 0.7, 0.8), 0.1)
        self.k = 0.5; self.cyl('dark', (x, y + 0.72, z), 0.3, 0.04, 'y', 10); self.k = 1.0; return self

    def ridge_tent(self, cx, cz, L, W, wall=1.6, h=3.4, panels=True, mat='canvas'):
        """a big army tent: walls, a ridge roof along x, the roof's blue panels, doors at the ends"""
        self.k = 1.0
        self.hull(mat, [(cx + u, y, cz + v) for u in (-L / 2, L / 2) for v in (-W / 2, W / 2) for y in (0, wall)] + [(cx + u, h, cz) for u in (-L / 2, L / 2)])
        # (the roof's seams, and its blue panels)
        slope = np.hypot(W / 2, h - wall)
        for sv in (-1, 1):
            for u in np.linspace(-L / 2 + 0.6, L / 2 - 0.6, 4):
                self.k = 0.8; self.strut('canvas', np.array((cx + u, wall + 0.02, cz + sv * W / 2)), np.array((cx + u, h + 0.02, cz)), 0.06)
            if panels:
                for u in np.linspace(-L / 2 + L / 6, L / 2 - L / 6, 3):
                    f0, f1 = 0.2, 0.8  # (of the way up the slope)
                    def at(f, du): return (cx + u + du, wall + (h - wall) * f + 0.05, cz + sv * W / 2 * (1 - f))
                    self.k = 1.0; self.hull('body', [at(f, du) for f in (f0, f1) for du in (-L / 9, L / 9)] + [tuple(np.add(at(f, du), (0, 0.06, 0))) for f in (f0, f1) for du in (-L / 9, L / 9)])
        for su in (-1, 1):  # (doors: a darker flap at each end)
            self.k = 0.55; self.box(mat, (cx + su * (L / 2 + 0.03), 1.0, cz), (0.06, 2.0, 1.4))
        # (guy ropes' pegs: a few posts round it)
        self.k = 1.0
        for u in np.linspace(-L / 2, L / 2, 4):
            for sv in (-1, 1): self.strut('wood', np.array((cx + u, 0, cz + sv * (W / 2 + 0.9))), np.array((cx + u, 0.5, cz + sv * (W / 2 + 0.9))), 0.05)
        return self

    def net(self, cx, cz, L, W, h=2.4):
        """a camouflage net on poles, sagging"""
        for su in (-1, 1):
            for sv in (-1, 1): self.strut('wood', np.array((cx + su * L / 2, 0, cz + sv * W / 2)), np.array((cx + su * L / 2, h, cz + sv * W / 2)), 0.06)
        n = 5
        for i in range(n):
            for j in range(n):
                u0, u1 = -L / 2 + L * i / n, -L / 2 + L * (i + 1) / n; v0, v1 = -W / 2 + W * j / n, -W / 2 + W * (j + 1) / n
                sag = lambda u, v: h - 0.5 * (1 - (2 * u / L) ** 2) * (1 - (2 * v / W) ** 2) + self.r.uniform(-0.08, 0.08)
                self.var(0.8, 1.15)
                q = [(cx + u, sag(u, v), cz + v) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
                self.add('net', q + [(p[0], p[1] + 0.05, p[2]) for p in q], [(4, 5, 6, 7), (3, 2, 1, 0)])
        self.k = 1.0; return self

    def car(self, x, z, rot=0.0, L=4.6, W=2.0, mat='olive'):
        """a parked vehicle, simple (a jeep / small truck)"""
        R = ry(rot)
        def at(p): return tuple(np.asarray(p) @ R.T + (x, 0, z))
        self.k = self.r.uniform(0.9, 1.05)
        self.hull(mat, [at((u, y, v)) for u in (-L / 2, L / 2) for v in (-W / 2, W / 2) for y in (0.5, 1.2)])
        self.hull(mat, [at((u, y, v)) for u in (-L / 2 + 0.3, L * 0.1) for v in (-W / 2 + 0.1, W / 2 - 0.1) for y in (1.2, 1.9)])
        for u in (-L / 3, L / 3):
            for v in (-W / 2, W / 2): self.k = 1.0; self.cyl('dark', at((u, 0.45, v)), 0.45, 0.3, 'z', 8, rot=rot)
        self.k = 1.0; return self

    def hangar(self, cx, cz, L, W, h, roof_h, door=0.62, inside=None):
        """a workshop hangar: concrete walls, a big door in front (+x) open — dark inside, what's being made in there —
        a corrugated gable roof along x, windows down the sides"""
        t = 0.4
        self.k = 1.0
        self.box('concrete', (cx - L / 2 + t / 2, h / 2, cz), (t, h, W))                              # back
        for sv in (-1, 1): self.box('concrete', (cx, h / 2, cz + sv * (W / 2 - t / 2)), (L, h, t))     # sides
        dw = W * door; side = (W - dw) / 2
        for sv in (-1, 1): self.box('concrete', (cx + L / 2 - t / 2, h / 2, cz + sv * (dw / 2 + side / 2)), (t, h, side))
        self.box('concrete', (cx + L / 2 - t / 2, h - 0.6, cz), (t, 1.2, dw))                          # over the door
        self.k = 0.35; self.box('asphalt', (cx, 0.14, cz), (L - t, 0.04, W - t))                        # the floor inside
        self.k = 0.25; self.box('dark', (cx - L / 2 + t + 0.02, h / 2, cz), (0.04, h - 0.2, W - 2 * t))  # dark inside
        self.k = 1.0
        for sv in (-1, 1): self.k = 1.0; self.box('body', (cx, h - 0.25, cz + sv * (W / 2 + 0.02)), (L, 0.3, 0.06))  # blue band
        self.windows(cx - L / 2 + 2, cx + L / 2 - 2, h * 0.62, cz + W / 2, max(2, int(L / 4)), 1.4, 0.8, 1)
        self.windows(cx - L / 2 + 2, cx + L / 2 - 2, h * 0.62, cz - W / 2, max(2, int(L / 4)), 1.4, 0.8, -1)
        self.roof(cx, cz, L, W, h, roof_h, 0.5, 'body', 1.0, 'x')
        # (lean-to porches over the side doors)
        for sv in (-1, 1):
            px = cx + L / 2 - 2.0
            self.hull('body', [(px + du, h * 0.55 + e, cz + sv * (W / 2 + dv)) for du in (-1.2, 1.2) for dv, e in ((0, 0.4), (1.6, 0)) for e2 in (0,)] +
                      [(px + du, h * 0.55 + e + 0.1, cz + sv * (W / 2 + dv)) for du in (-1.2, 1.2) for dv, e in ((0, 0.4), (1.6, 0))])
            self.k = 0.4; self.box('dark', (px, 1.1, cz + sv * (W / 2 + 0.03)), (1.1, 2.1, 0.06)); self.k = 1.0
        if inside: inside(self)
        return self


# ---- the buildings ----
def b_hq(seed=1):
    M = B(seed); L = 34
    M.pad(L, L).wall_ring(L, L, 7.0)
    # (the command building: two storeys, a raised block on top, blue roofs and a band of blue)
    M.block('concrete', (-3, 3.2, -1), (13, 6.4, 12), 0.03)
    M.k = 1.0; M.box('body', (-3, 6.55, -1), (13.4, 0.3, 12.4)); M.box('concrete', (-3, 6.9, -1), (12.6, 0.4, 11.6))
    M.k = 0.95; M.box('body', (-3, 6.75, -1), (12.2, 0.12, 11.2))
    M.block('concrete', (-5, 8.2, -2), (6, 3, 5.5), 0.04)
    M.roof(-5, -2, 6, 5.5, 9.7, 1.0, 0.3, 'body', 0.8)
    M.windows(-6.5, -3.5, 8.3, 0.75, 2, 1.0, 0.9, 1)
    for y in (1.6, 4.6):
        M.windows(-8.5, 2.5, y, 5.0, 5, 1.3, 1.1, 1); M.windows(-8.5, 2.5, y, -7.0, 5, 1.3, 1.1, -1)
        M.windows(-6.0, 4.0, y, 3.5, 4, 1.3, 1.1, 1, 'z')
    M.k = 0.5; M.box('dark', (3.55, 1.2, -1), (0.1, 2.4, 2.0)); M.k = 1.0                       # the door
    M.hull('body', [(3.5 + du, 2.6 + e, -1 + dv) for du, e in ((0, 0.3), (2.0, 0)) for dv in (-1.6, 1.6)] + [(3.5 + du, 2.75 + e, -1 + dv) for du, e in ((0, 0.3), (2.0, 0)) for dv in (-1.6, 1.6)])
    M.mast(-1.0, -5.0, 8.0, 7.1, 3)
    for i in range(3): M.ac(-0.5 + i * 1.4, 7.1, 3.2)
    M.flag(12.5, 4.0, 8.5)
    M.car(9.0, -10.5, 0.1).car(9.5, -6.5, 0.05).car(-12.0, 11.0, 1.6, 6.0, 2.4).car(-12.5, -11.5, 1.5)
    M.crates(-14.5, -3.0, 2, 3, 2).crates(10.0, 10.5, 3, 2, 2, 0.9, 'wood').barrels(5.5, 12.5, 6)
    M.sandbags(13.0, -12.0, 1.6, 9)
    return [('hull', M, None)]

def b_fhq(seed=2):
    M = B(seed); L, W = 22, 20
    M.pad(L, W).wall_ring(L, W, 5.0)
    M.ridge_tent(-3.5, -4.0, 8.0, 5.0, 1.5, 3.0).ridge_tent(-3.5, 4.5, 7.0, 4.6, 1.4, 2.8)
    M.block('concrete', (5.0, 1.5, -4.5), (5.0, 3.0, 4.2), 0.05)                                  # the cabin
    M.roof(5.0, -4.5, 5.0, 4.2, 3.0, 0.7, 0.35, 'body', 0.7)
    M.windows(3.5, 6.5, 1.8, -2.4, 2, 0.9, 0.7, 1)
    M.mast(7.0, 3.0, 11.0, 0.0, 2)
    M.net(4.5, 4.0, 5.0, 4.0, 2.3).car(4.5, 4.0, 0.0).crates(-9.0, -8.0, 2, 1, 2, 0.9).barrels(-8.5, 7.5, 4)
    return [('hull', M, None)]

def tent_base(seed, extra):
    M = B(seed); L, W = 18, 16
    M.pad(L, W, 'concrete', 0.08).wall_ring(L, W, 4.0, 1.1, 1.0)
    M.ridge_tent(-1.0, 0.0, 10.0, 7.0, 1.6, 3.6)
    extra(M); return [('hull', M, None)]

def b_tent(seed=3):
    def x(M):
        M.crates(5.0, -6.0, 2, 1, 2, 0.9).barrels(5.5, 5.5, 3)
        M.block('concrete', (-6.0, 1.1, -6.0), (2.4, 2.2, 2.2), 0.05); M.roof(-6.0, -6.0, 2.4, 2.2, 2.2, 0.4, 0.2, 'body', 0.6)
        M.strut('metal', np.array((5.8, 0, -2.0)), np.array((5.8, 6.5, -2.0)), 0.05)
    return tent_base(seed, x)

def b_atpost(seed=4):
    def x(M):
        for i in range(3):  # (launcher tubes on a rack: anti-tank missiles)
            M.k = 1.0; M.cyl('warn', (5.0, 0.6 + i * 0.4, -4.0), 0.18, 2.4, 'x', 10)
        M.crates(4.0, 3.5, 2, 2, 2, 0.8).sandbags(-6.5, -5.5, 1.4, 8)
        M.k = 1.0; M.cyl('olive', (-6.5, 0.9, -5.5), 0.15, 1.6, 'x', 8, tilt=0.15)
    return tent_base(seed, x)

def b_aapost(seed=5):
    def x(M):
        M.sandbags(5.0, 3.5, 2.0, 12, 2)
        M.k = 1.0; M.cyl('metal', (5.0, 0.6, 3.5), 0.6, 0.5, 'y', 10)                              # an AA gun in a pit
        M.block('olive', (5.0, 1.2, 3.5), (1.2, 0.8, 1.3), 0.1)
        for sz in (-0.25, 0.25): M.cyl('dark', (5.8, 1.9, 3.5 + sz), 0.07, 2.2, 'x', 6, tilt=0.7)
        M.crates(4.5, -6.5, 2, 1, 2, 0.8)
        M.k = 1.0; M.cyl('white', (-6.5, 2.4, -5.5), 0.7, 0.15, 'x', 14, r2=0.15, tilt=0.7)       # a radar dish
        M.strut('metal', np.array((-6.5, 0, -5.5)), np.array((-6.5, 2.3, -5.5)), 0.08)
    return tent_base(seed, x)

def b_clinic(seed=6):
    def x(M):
        for sv in (-1, 1):  # (a white panel and a red cross on each slope)
            nrm = np.array((0, 3.5, sv * 2.0)) / np.hypot(3.5, 2.0)
            def at(f, du, lift): return np.array((-1.0 + du, 1.6 + 2.0 * f, sv * 3.5 * (1 - f))) + nrm * lift
            def patch(mat, f0, f1, u0, u1, lift):
                M.k = 1.0; M.hull(mat, [at(f, du, l) for f in (f0, f1) for du in (u0, u1) for l in (lift, lift + 0.03)])
            patch('white', 0.25, 0.8, -1.7, 1.7, 0.03)
            patch('red', 0.3, 0.75, -0.3, 0.3, 0.07); patch('red', 0.46, 0.59, -1.2, 1.2, 0.07)
        M.strut('metal', np.array((5.5, 0, 4.5)), np.array((5.5, 5.0, 4.5)), 0.05)
        M.k = 1.0; M.box('white', (5.0, 4.4, 4.5), (1.0, 0.8, 0.04)); M.box('red', (5.0, 4.4, 4.53), (0.6, 0.18, 0.03)); M.box('red', (5.0, 4.4, 4.54), (0.18, 0.6, 0.03))
        M.crates(4.0, -6.0, 2, 1, 1, 0.8, 'white').crates(-6.5, 5.5, 2, 1, 2, 0.8)
        for i in range(3): M.k = 1.0; M.box('canvas', (5.5, 0.45, -1.5 + i * 1.0), (2.0, 0.15, 0.7)); M.box('metal', (5.5, 0.2, -1.5 + i * 1.0), (1.8, 0.4, 0.05))  # stretchers
    return tent_base(seed, x)

def b_commandopost(seed=7):
    def x(M):
        M.net(-1.0, 0.0, 12.0, 9.0, 4.2)
        M.crates(5.0, -6.0, 1, 2, 2, 0.8, 'dark').car(5.0, 4.5, 0.2, 4.2, 1.9, 'dark').sandbags(-6.5, -5.5, 1.3, 8)
    return tent_base(seed, x)

def workshop(seed, L, W, inside, yard):
    M = B(seed); PL, PW = L + 12, W + 12
    M.pad(PL, PW).wall_ring(PL, PW, W * 0.7)
    M.hangar(-3.0, 0.0, L, W, 6.0, 2.8, 0.62, inside)
    yard(M, L, W); return [('hull', M, None)]

def b_tankshop(seed=8):
    def inside(M):  # (a tank in there: hull, turret and gun, dark)
        M.k = 0.55; M.block('olive', (-2.0, 1.1, 0), (7.0, 1.4, 3.4), 0.1); M.block('olive', (-2.5, 2.2, 0), (3.0, 0.9, 2.4), 0.15)
        M.cyl('olive', (1.0, 2.2, 0), 0.12, 4.0, 'x', 8); M.k = 1.0
        M.box('warn', (-3.0, 5.6, 0), (0.3, 0.3, 14.0))                                                         # crane rail
    def yard(M, L, W):
        M.k = 1.0; M.cyl('tank', (10.0, 1.3, -9.0), 1.2, 4.0, 'x', 14); M.cyl('tank', (10.0, 1.3, -6.2), 1.2, 4.0, 'x', 14)  # fuel tanks
        M.crates(9.0, 8.0, 2, 2, 2).barrels(13.0, 4.5, 5)
    return workshop(seed, 22, 16, inside, yard)

def jeep_inside(M):
    M.k = 0.55; M.block('olive', (-2.5, 1.0, 0), (4.4, 1.2, 2.0), 0.1); M.k = 1.0

def jeepyard(extra):
    def yard(M, L, W):
        M.car(8.5, -6.5, 0.3).crates(7.5, 6.0, 2, 2, 2, 0.9, 'wood').barrels(11.0, 1.5, 4)
        extra(M)
    return yard

def b_jeepshop(seed=9): return workshop(seed, 16, 13, jeep_inside, jeepyard(lambda M: M.car(10.5, 5.0, -0.2)))

def b_jeepat(seed=10):
    def x(M):
        M.car(10.5, 5.0, -0.2)
        for i in range(2): M.k = 1.0; M.cyl('warn', (11.0, 2.3 + i * 0.35, 5.0), 0.15, 1.6, 'x', 8)
    return workshop(seed, 16, 13, jeep_inside, jeepyard(x))

def b_jeepaa(seed=11):
    def x(M):
        M.car(10.5, 5.0, -0.2)
        for sz in (-0.2, 0.2): M.k = 1.0; M.cyl('dark', (10.8, 2.6, 5.0 + sz), 0.06, 1.8, 'x', 6, tilt=0.7)
    return workshop(seed, 16, 13, jeep_inside, jeepyard(x))

def b_garage(seed=12):
    def inside(M):
        M.k = 0.55; M.block('olive', (-2.0, 1.0, -1.5), (4.4, 1.2, 2.0), 0.1); M.k = 1.0
        for sv in (-1, 1): M.strut('warn', np.array((0.5, 0, sv * 6.5)), np.array((0.5, 5.4, sv * 6.5)), 0.12)
        M.box('warn', (0.5, 5.4, 0), (0.3, 0.3, 13.2))                                                         # a gantry crane
        M.k = 1.0; M.cyl('dark', (0.5, 4.2, 0), 0.03, 2.4, 'y', 4)
    def yard(M, L, W):
        for i in range(5): M.k = 1.0; M.cyl('dark', (9.0, 0.2 + i * 0.32, -6.5), 0.55, 0.3, 'y', 12)       # a stack of tyres
        M.car(9.5, 4.0, 0.4).crates(7.0, -9.0, 3, 1, 1, 0.9, 'metal').barrels(12.0, -2.0, 4)
    return workshop(seed, 18, 14, inside, yard)

def b_depot(seed=13):
    M = B(seed); L, W = 26, 22
    M.pad(L, W).wall_ring(L, W, 6.0)
    for (x, z) in ((-8, -6), (-8, -1), (-3, -6)): M.crates(x, z, 3, 3, 3)                         # ammunition stacks
    M.net(-5.5, -3.5, 10.0, 9.5, 3.2)
    M.crates(4.0, -7.0, 3, 2, 2, 1.0, 'wood').crates(-9.0, 5.0, 4, 2, 2, 0.9)
    M.k = 1.0  # (a fuel bladder: a flattened dome)
    a = np.linspace(0, 2 * np.pi, 16, endpoint=False)
    M.hull('dark', [(4.5 + 3.0 * np.cos(t), 0.12, 5.0 + 2.0 * np.sin(t)) for t in a] + [(4.5 + 2.4 * np.cos(t), 0.9, 5.0 + 1.5 * np.sin(t)) for t in a] + [(4.5 + 1.2 * np.cos(t), 1.25, 5.0 + 0.7 * np.sin(t)) for t in a])
    M.block('concrete', (8.5, 1.3, -1.5), (3.0, 2.6, 4.0), 0.05); M.roof(8.5, -1.5, 3.0, 4.0, 2.6, 0.5, 0.25, 'body', 0.6, 'z')
    M.car(9.0, 6.5, 0.0, 6.0, 2.4).barrels(-2.0, 7.5, 6)
    return [('hull', M, None)]

KINDS = {'b_hq': b_hq, 'b_decoy': lambda: b_hq(1), 'b_fhq': b_fhq, 'b_tent': b_tent, 'b_atpost': b_atpost, 'b_aapost': b_aapost,
         'b_clinic': b_clinic, 'b_commandopost': b_commandopost, 'b_tankshop': b_tankshop, 'b_jeepshop': b_jeepshop,
         'b_jeepat': b_jeepat, 'b_jeepaa': b_jeepaa, 'b_garage': b_garage, 'b_depot': b_depot}

if __name__ == '__main__':
    for k in (['b_' + a.removeprefix('b_') for a in sys.argv[1:]] or KINDS):
        write(k, KINDS[k](), GEN)
