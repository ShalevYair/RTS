"""Trees built in code, rounder and more natural than the Nature Kit's -> art/models/tree_gen<n>.glb (then
`python tools/models.py`). A trunk that leans and bends a little, branches forking up and out (twice), and the crown:
lumpy clumps of leaves (each a hull round points jittered on a ball) at the branch ends and round the top — so the
outline is ragged, not a box. Materials `woodbark` and `leafsgreen` / `leafsdark` (models.py paints them the map's
browns and greens). Seeded: the same tree every run.

  python tools/build_trees.py          every tree below
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from build_models import Mesh, MATS, write, limb  # noqa: E402

CLUMP_N, LIMB_N = 14, 4  # (points a clump, sides a branch: few — a map holds ~11,000 trees; ~300 triangles a tree)
MATS.update({'woodbark': [0.43, 0.30, 0.19], 'leafsgreen': [0.35, 0.54, 0.20], 'leafsdark': [0.25, 0.42, 0.17],
             'leafspine': [0.20, 0.36, 0.20], 'leafsolive': [0.27, 0.35, 0.20]})


def clump(M, rng, c, r, n=CLUMP_N, rough=0.22, mat='leafsgreen'):
    """a lump of leaves: a hull round n points on a squashed ball, each pushed in or out"""
    k = np.arange(n) + 0.5; phi = np.arccos(1 - 2 * k / n); th = np.pi * (1 + 5 ** 0.5) * k
    d = np.stack([np.cos(th) * np.sin(phi), np.cos(phi) * 0.85, np.sin(th) * np.sin(phi)], 1)
    d *= (1 + rng.uniform(-rough, rough, n))[:, None]
    M.k = rng.uniform(0.85, 1.15); M.hull(mat, np.asarray(c) + d * r)


def branch(M, rng, p, d, L, w, depth, ends):
    """a branch from p along d, length L, width w; forks `depth` more times; its tips go in `ends`"""
    d = d / np.linalg.norm(d); q = p + d * L
    M.k = rng.uniform(0.9, 1.1); limb(M, 'woodbark', p, q, w, w * 0.62, n=LIMB_N)
    if depth == 0: ends.append((q, L)); return
    for i in range(rng.integers(2, 4)):
        a = rng.uniform(0, 2 * np.pi); out = np.array([np.cos(a), 0, np.sin(a)])
        nd = d * rng.uniform(0.6, 0.9) + out * rng.uniform(0.45, 0.8) + np.array([0, 0.25, 0])
        branch(M, rng, q - d * L * rng.uniform(0, 0.25), nd, L * rng.uniform(0.55, 0.75), w * 0.62, depth - 1, ends)


def tree(seed, H=6.0, crown=2.6, clumps=8):
    """a broadleaf: H tall, the crown about `crown` across its radius"""
    rng = np.random.default_rng(seed); M = Mesh(); ends = []
    lean = np.array([rng.uniform(-0.12, 0.12), 1, rng.uniform(-0.12, 0.12)])
    base, mid = np.zeros(3), lean / np.linalg.norm(lean) * H * 0.42
    M.k = 1.0; limb(M, 'woodbark', base, mid, H * 0.06, H * 0.045, n=7)                      # the trunk
    for i in range(3):                                                                       # the main limbs
        a = 2 * np.pi * i / 3 + rng.uniform(-0.4, 0.4)
        d = np.array([np.cos(a) * 0.55, 1, np.sin(a) * 0.55])
        branch(M, rng, mid, d, H * 0.3, H * 0.04, 0, ends)  # (no twigs: under the crown they're unseen)
    top = mid + np.array([0, H * 0.32, 0])
    pts = [(q, H * 0.2 + l * 0.3) for q, l in ends]
    pts.sort(key=lambda e: -e[0][1])
    for q, r in pts[:clumps]:                                                                # clumps at the tips
        clump(M, rng, q + rng.uniform(-0.2, 0.2, 3) * r, r * rng.uniform(0.9, 1.2), mat='leafsgreen' if rng.random() < 0.7 else 'leafsdark')
    clump(M, rng, top, crown * 0.7, n=CLUMP_N + 6)                                                    # and the heart of the crown
    for a in np.linspace(0, 2 * np.pi, 5, endpoint=False):                                   # a ring round it, lower
        c = top + np.array([np.cos(a) * crown * 0.55, -crown * 0.35 + rng.uniform(-0.3, 0.3), np.sin(a) * crown * 0.55])
        clump(M, rng, c, crown * rng.uniform(0.38, 0.5), mat='leafsdark' if rng.random() < 0.4 else 'leafsgreen')
    return M


def pine(seed, H=8.0, R=1.9):
    """a conifer: a straight trunk, tiers of drooping clumps narrowing to a point"""
    rng = np.random.default_rng(seed); M = Mesh()
    M.k = 1.0; limb(M, 'woodbark', (0, 0, 0), (0, H * 0.35, 0), H * 0.04, H * 0.03, n=6)
    tiers = 5
    for i in range(tiers):
        f = i / (tiers - 1); y = H * (0.3 + 0.6 * f); r = R * (1 - 0.8 * f)
        for a in np.linspace(0, 2 * np.pi, 3 if i < tiers - 1 else 1, endpoint=False) + rng.uniform(0, 2):
            c = (np.cos(a) * r * 0.45, y, np.sin(a) * r * 0.45) if i < tiers - 1 else (0, y, 0)
            clump(M, rng, c, r * 0.7, n=12, rough=0.3, mat='leafspine')
    return M


def poplar(seed, H=9.0, R=1.2):
    """tall and narrow: a column of clumps"""
    rng = np.random.default_rng(seed); M = Mesh()
    M.k = 1.0; limb(M, 'woodbark', (0, 0, 0), (0, H * 0.3, 0), H * 0.035, H * 0.028, n=6)
    for i in range(5):
        f = i / 4; c = (rng.uniform(-0.2, 0.2), H * (0.32 + 0.55 * f), rng.uniform(-0.2, 0.2))
        clump(M, rng, c, R * (1.0 - 0.45 * abs(f - 0.35)), n=13, mat='leafsgreen' if i % 2 else 'leafsdark')
    return M


def olive(seed, H=4.2, R=2.6):
    """an olive / oak of the hills: a short twisted trunk, a wide low crown of grey-green"""
    rng = np.random.default_rng(seed); M = Mesh()
    k = np.array([rng.uniform(-0.6, 0.6), H * 0.45, rng.uniform(-0.6, 0.6)])
    M.k = 0.9; limb(M, 'woodbark', (0, 0, 0), k, H * 0.09, H * 0.06, n=6)
    for a in np.linspace(0, 2 * np.pi, 3, endpoint=False):
        limb(M, 'woodbark', k, k + (np.cos(a) * R * 0.5, H * 0.2, np.sin(a) * R * 0.5), H * 0.05, H * 0.03, n=4)
    top = k + (0, H * 0.35, 0)
    clump(M, rng, top, R * 0.6, n=16, mat='leafsolive')
    for a in np.linspace(0, 2 * np.pi, 6, endpoint=False) + rng.uniform(0, 1):
        clump(M, rng, top + (np.cos(a) * R * 0.6, rng.uniform(-0.5, 0.2), np.sin(a) * R * 0.6), R * rng.uniform(0.35, 0.48), n=12, mat='leafsolive')
    return M


def bush(seed, R=1.0, n=4):
    """a low bush: a few clumps on the ground, no trunk"""
    rng = np.random.default_rng(seed); M = Mesh()
    for i in range(n):
        a = rng.uniform(0, 2 * np.pi); d = 0 if i == 0 else R * rng.uniform(0.4, 0.7)
        clump(M, rng, (np.cos(a) * d, R * 0.55, np.sin(a) * d), R * rng.uniform(0.55, 0.8), n=12, mat='leafsdark' if rng.random() < 0.5 else 'leafsgreen')
    return M


def main():
    G = 'tools/build_trees.py'
    for i, (seed, H, crown) in enumerate([(1, 6.0, 2.6), (2, 5.2, 2.3), (3, 7.0, 3.0)]):
        write(f'tree_gen{i + 1}', [('hull', tree(seed, H, crown), None)], gen=G)
    write('tree_genpine1', [('hull', pine(4), None)], gen=G); write('tree_genpine2', [('hull', pine(5, 10, 2.2), None)], gen=G)
    write('tree_genpoplar', [('hull', poplar(6), None)], gen=G)
    write('tree_genolive1', [('hull', olive(7), None)], gen=G); write('tree_genolive2', [('hull', olive(8, 3.6, 2.2), None)], gen=G)
    for i in range(3): write(f'bush_gen{i + 1}', [('hull', bush(10 + i, 1.0, 3 + i), None)], gen=G)


if __name__ == '__main__':
    main()
