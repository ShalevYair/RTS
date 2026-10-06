"""3D models for the 3D view: art/models/<kind>.glb -> js/ui/models.js (MODELS), so the game loads them from file://
too (a fetch of a local file is refused there; the sprites go the same way, sprites.py).

Each model is baked flat: every mesh in its rest pose (the node transforms applied; skins ignored), turned so its
front is +X and up is +Y, its length along X scaled to 1, standing on y = 0, centred on its hull. The parts:
  hull    everything but the turret
  turret  the nodes named *Turret* / *Gun* (a tank), around its own pivot (the turret's middle) — `pivot` is where
          that sits on the hull
Each part is two lists of triangles: `team` (the main paint — Main, Main_Light…: tinted with the side's colour in the
game) and `rest` (dark details, wheels, tracks: as they are), each vertex x y z nx ny nz r g b, packed in 12 bytes (`pack`: the place as Int16 ×POS_Q, the normal Int8, the
colour Uint8 — a third of Float32: the buildings made models.js 12 MB), as base64.

  python tools/models.py            every art/models/*.glb
  python tools/models.py --slim <big.glb> <kind>
                                    a heavy model (an AI-made one: hundreds of thousands of triangles, 4K textures)
                                    made light first: its texture's colours baked into its points, cut down to
                                    SLIM_TRI triangles (pymeshlab), written as art/models/<kind>.glb (the big one
                                    stays out of git: GLB/); then everything is baked as usual
Tracks: a skinned mesh named *Track* (left/right by .L/.R) with an animation named *Forward* is baked into TRACK_F
poses over one turn of that clip (`trackL0`…, `trackR0`…, not in the hull); `track` = {frames, cycle: how far the
links move in one turn, zl / zr: each track's distance from the middle, across} — the game shows the pose for how far each track has
gone, so they run with no skinning in the game.
Front: the model's gun (or its longest side) is taken as the front; FRONT below turns one that comes out the other way.
"""
import base64, json, os, struct, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC, OUT = os.path.join(ROOT, 'art', 'models'), os.path.join(ROOT, 'js', 'ui', 'models.js')
# (the turn round the up axis that brings each model's front to +X, degrees; a model not here: its gun's way)
FRONT = {'jeep': 180}  # (the AI-made jeep: its bonnet at -X; the ones built in code — tools/build_models.py — are +X already)
TEAM = ('main', 'main_light', 'body', 'paint', 'slim')  # materials painted in the side's colour (slim: a slimmed model, all of it)
TURRET = ('turret', 'gun', 'barrel', 'cannon')
TRACK_F = 8  # poses of a running track
SLIM_TRI = 5000  # a slimmed model's triangles
# materials painted again (sRGB): the Nature Kit's teal leaves and orange bark, in the map's own greens and browns
RECOLOR = {'leafsgreen': '#5a8a32', 'leafsdark': '#3f6a2c', 'grass': '#6c8c3a', 'woodbark': '#6e4c30', 'woodbarkdark': '#4f3a26',
           'dirt': '#8c8476', 'stone': '#8e8b85'}
def linear(h):
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

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


def trs_matrix(T, R, S): return node_matrix({'translation': T, 'rotation': R, 'scale': S})


def pose(J, B, anim, t):
    """every node's world matrix with `anim` at time t (None: the rest pose)"""
    N = J['nodes']; parent = {c: i for i, n in enumerate(N) for c in n.get('children', [])}
    loc = {i: [list(n.get('translation', [0, 0, 0])), list(n.get('rotation', [0, 0, 0, 1])), list(n.get('scale', [1, 1, 1]))] for i, n in enumerate(N)}
    if anim is not None:
        for ch in anim['channels']:
            s = anim['samplers'][ch['sampler']]; ti = accessor(J, B, s['input'])[:, 0]; v = accessor(J, B, s['output'])
            k = min(max(np.searchsorted(ti, t, side='right') - 1, 0), len(ti) - 2); f = np.clip((t - ti[k]) / (ti[k + 1] - ti[k]), 0, 1)
            val = v[k] * (1 - f) + v[k + 1] * f
            if ch['target']['path'] == 'rotation': val = val / np.linalg.norm(val)
            loc[ch['target']['node']][{'translation': 0, 'rotation': 1, 'scale': 2}[ch['target']['path']]] = list(val)
    G = {}
    def g(i):
        if i not in G: m = trs_matrix(*loc[i]); G[i] = g(parent[i]) @ m if i in parent else m
        return G[i]
    for i in range(len(N)): g(i)
    return G


def skinned(J, B, n, G):
    """a skinned mesh's (first primitive's) points in the pose G"""
    sk = J['skins'][n['skin']]; ibm = accessor(J, B, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    JM = np.array([G[j] @ ibm[k] for k, j in enumerate(sk['joints'])])
    at = J['meshes'][n['mesh']]['primitives'][0]['attributes']
    pos = accessor(J, B, at['POSITION']); jo = accessor(J, B, at['JOINTS_0']).astype(int); w = accessor(J, B, at['WEIGHTS_0'])
    P4 = np.c_[pos, np.ones(len(pos))]; out = np.zeros((len(pos), 4))
    for c in range(4): out += w[:, c:c + 1] * np.einsum('nij,nj->ni', JM[jo[:, c]], P4)
    return out[:, :3]


POS_Q = 16000  # (a place's Int16 = x × POS_Q: ±2 lengths, to 1/16000 of one)
def pack(v):
    """vertices (n × 9: x y z, nx ny nz, r g b) -> 12 bytes each, as base64"""
    v = np.asarray(v, np.float64); n = len(v); b = np.zeros((n, 12), np.uint8)
    b[:, :6] = np.clip(np.round(v[:, :3] * POS_Q), -32767, 32767).astype('<i2').view(np.uint8).reshape(n, 6)
    b[:, 6:9] = np.clip(np.round(v[:, 3:6] * 127), -127, 127).astype(np.int8).view(np.uint8)
    b[:, 9:12] = np.clip(np.round(v[:, 6:9] * 255), 0, 255).astype(np.uint8)
    return base64.b64encode(b.tobytes()).decode()


def bake(path):
    J, B = read_glb(path)
    mats = J.get('materials', [])
    fwd = next((a for a in J.get('animations', []) if 'forward' in (a.get('name') or '').lower()), None)
    tracks = {}  # 'L'/'R' -> (node, its primitive's normals and colours from the rest walk)
    parts = {}  # (part, team) -> list of (pos, nrm, col)
    def walk(i, P, turret):
        n = J['nodes'][i]; M = P @ node_matrix(n); name = (n.get('name') or '').lower()
        turret = turret or any(k in name for k in TURRET)
        track = fwd is not None and 'skin' in n and 'track' in name and 'mesh' in n
        if 'mesh' in n:
            for p in J['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue
                at = p['attributes']; pos = accessor(J, B, at['POSITION'])
                nrm = accessor(J, B, at['NORMAL']) if 'NORMAL' in at else np.zeros_like(pos)
                idx = accessor(J, B, p['indices']).astype(int).ravel() if 'indices' in p else np.arange(len(pos))
                m = mats[p['material']] if 'material' in p else {}
                base = np.array((m.get('pbrMetallicRoughness') or {}).get('baseColorFactor', [0.6, 0.6, 0.6, 1])[:3])
                if (m.get('name') or '').lower() in RECOLOR: base = linear(RECOLOR[m['name'].lower()])
                col = np.tile(base, (len(pos), 1))
                if 'COLOR_0' in at: col = col * accessor(J, B, at['COLOR_0'])[:, :3]
                P4 = np.c_[pos, np.ones(len(pos))] @ M.T; N = nrm @ np.linalg.inv(M[:3, :3]).T
                N /= np.maximum(1e-9, np.linalg.norm(N, axis=1))[:, None]
                team = any(k == (m.get('name') or '').lower() for k in TEAM)
                if track: tracks['L' if name.endswith('.l') else 'R'] = (n, idx, N, col); continue
                parts.setdefault(('turret' if turret else 'hull', team), []).append((P4[idx, :3], N[idx], col[idx]))
        for c in n.get('children', []): walk(c, M, turret)
    for r in J['scenes'][J.get('scene', 0)]['nodes']: walk(r, np.eye(4), False)
    cat = {k: tuple(np.concatenate([v[j] for v in l]) for j in range(3)) for k, l in parts.items()}
    # (the tracks: TRACK_F poses over the clip; the first in the hull's size)
    frames = {}
    if tracks:
        T = max(accessor(J, B, s['input'])[:, 0].max() for s in fwd['samplers'])
        for side, (n, idx, N, col) in tracks.items():
            frames[side] = [skinned(J, B, n, pose(J, B, fwd, T * f / TRACK_F))[idx] for f in range(TRACK_F)]
            frames[side + 'n'], frames[side + 'c'] = N[idx], col[idx]
        # (how far a link goes in one turn: the bottom run's points, along the length)
        p0, p1 = skinned(J, B, tracks['L'][0], pose(J, B, fwd, 0)), skinned(J, B, tracks['L'][0], pose(J, B, fwd, T * 0.999))
        low = p0[:, 1] < p0[:, 1].min() + 0.15 * np.ptp(p0[:, 1])
        dx = np.abs(np.median((p1 - p0)[low], axis=0)); cycle = float(dx.max())
    hull = np.concatenate([v[0] for k, v in cat.items() if k[0] == 'hull'] + [frames[s][0] for s in ('L', 'R') if s in frames])
    gun = np.concatenate([v[0] for k, v in cat.items() if k[0] == 'turret']) if any(k[0] == 'turret' for k in cat) else None
    # the front: toward the gun's far end (on the long side), else +X — turned to +X
    name = os.path.splitext(os.path.basename(path))[0]
    lo, hi = hull.min(0), hull.max(0); mid = (lo + hi) / 2
    if name in FRONT: ang = np.radians(FRONT[name])
    elif J.get('asset', {}).get('generator', '').startswith('tools/build_'): ang = 0.0  # (built in code: +X already)
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
        out['parts'].setdefault(part, {})['team' if team else 'rest'] = pack(np.c_[q, n_, np.clip(col, 0, 1)])
    if frames:
        for side in ('L', 'R'):
            if side not in frames: continue
            for f, p in enumerate(frames[side]):  # (the first whole; the rest only where the points are — the same normals and colours)
                q = (turn(p - mid) - ctr) / L
                out['parts']['track' + side + str(f)] = {'rest': pack(np.c_[q, turn(frames[side + 'n']), np.clip(frames[side + 'c'], 0, 1)])} if f == 0 else                     {'pos': base64.b64encode(q.astype(np.float32).tobytes()).decode()}
        zl, zr = [((turn(frames[s][0] - mid) - ctr) / L)[:, 2].mean() for s in ('L', 'R')]
        out['track'] = {'frames': TRACK_F, 'cycle': round(float(cycle / L), 5), 'zl': round(float(zl), 4), 'zr': round(float(zr), 4)}
    if any(k[1] for k in cat) and all((m.get('name') or '').lower() in ('slim',) for m in mats): out['teamK'] = 0.18  # (a slimmed model: all of it its paint — only a touch of the side's colour)
    if name.startswith('b_'): out['teamK'] = 0.8  # (a building: its roofs in the side's colour, as in its picture)
    out['size'] = [1.0, round(float((hi[1] - lo[1]) / L), 4), round(float((hi[2] - lo[2]) / L), 4)]
    tri = sum(len(v[0]) for v in cat.values()) // 3
    if frames: tri += sum(len(frames[s][0]) for s in ('L', 'R') if s in frames) // 3
    print(f'{name}: {tri} triangles, front turned {np.degrees(ang):.0f}°, size {out["size"]}, pivot {out.get("pivot")}' + (f', tracks {out["track"]}' if 'track' in out else ''))
    return name, out


def srgb_linear(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def slim(src, kind):
    """a heavy model → art/models/<kind>.glb: every mesh in its rest pose, the colour of its texture at each point
    (linear, as glTF's COLOR_0), cut down to SLIM_TRI triangles"""
    import io, pymeshlab
    from PIL import Image
    J, B = read_glb(src); P, F, C = [], [], []; n0 = 0
    def tex(i):
        im = J['images'][J['textures'][i]['source']]; bv = J['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
        return np.asarray(Image.open(io.BytesIO(B[o:o + bv['byteLength']])).convert('RGB')).astype(np.float32) / 255
    def walk(i, M):
        nonlocal n0
        n = J['nodes'][i]; M = M @ node_matrix(n)
        for p in (J['meshes'][n['mesh']]['primitives'] if 'mesh' in n else []):
            at = p['attributes']; pos = accessor(J, B, at['POSITION'])
            idx = accessor(J, B, p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
            pb = (J['materials'][p['material']] if 'material' in p else {}).get('pbrMetallicRoughness', {})
            col = np.tile(np.array(pb.get('baseColorFactor', [1, 1, 1, 1])[:3]), (len(pos), 1))
            if 'baseColorTexture' in pb and 'TEXCOORD_0' in at:
                img = tex(pb['baseColorTexture']['index']); h, w = img.shape[:2]; uv = accessor(J, B, at['TEXCOORD_0'])
                col = col * srgb_linear(img[np.clip(((uv[:, 1] % 1) * h).astype(int), 0, h - 1), np.clip(((uv[:, 0] % 1) * w).astype(int), 0, w - 1)])
            P.append((np.c_[pos, np.ones(len(pos))] @ M.T)[:, :3]); F.append(idx + n0); C.append(col); n0 += len(pos)
        for c in n.get('children', []): walk(c, M)
    for r in J['scenes'][J.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    P, F, C = np.concatenate(P), np.concatenate(F), np.concatenate(C)
    ms = pymeshlab.MeshSet(); ms.add_mesh(pymeshlab.Mesh(vertex_matrix=P, face_matrix=F, v_color_matrix=np.c_[C, np.ones(len(C))]))
    ms.meshing_merge_close_vertices()
    ms.meshing_decimation_quadric_edge_collapse(targetfacenum=SLIM_TRI, preservenormal=True, optimalplacement=True, planarquadric=True)
    ms.compute_normal_per_vertex()
    m = ms.current_mesh(); v, f, c, nr = m.vertex_matrix(), m.face_matrix(), m.vertex_color_matrix()[:, :3], m.vertex_normal_matrix()
    print(f'{os.path.basename(src)}: {len(F)} -> {len(f)} triangles')
    write_glb(os.path.join(SRC, kind + '.glb'), v, nr, c, f)


def write_glb(path, v, nr, c, f):
    """one mesh: points, normals, colours (COLOR_0, linear), triangles"""
    arrs = [v.astype(np.float32), nr.astype(np.float32), c.astype(np.float32), f.astype(np.uint32).ravel()]
    blob, views, acc = b'', [], []
    for k, a in enumerate(arrs):
        b = a.tobytes(); views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(b)}); blob += b + b'\x00' * (-len(b) % 4)
        if k < 3: acc.append({'bufferView': k, 'componentType': 5126, 'count': len(a), 'type': 'VEC3', **({'min': a.min(0).tolist(), 'max': a.max(0).tolist()} if k == 0 else {})})
        else: acc.append({'bufferView': k, 'componentType': 5125, 'count': len(a), 'type': 'SCALAR'})
    J = {'asset': {'version': '2.0', 'generator': 'tools/models.py --slim'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'body', 'mesh': 0}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'COLOR_0': 2}, 'indices': 3, 'material': 0}]}],
         'materials': [{'name': 'slim', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1]}}],
         'buffers': [{'byteLength': len(blob)}], 'bufferViews': views, 'accessors': acc}
    js = json.dumps(J).encode(); js += b' ' * (-len(js) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + blob
    open(path, 'wb').write(out); print('wrote', path, len(out) // 1024, 'KB')


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == '--slim': slim(sys.argv[2], sys.argv[3])
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.glb')) if os.path.isdir(SRC) else []
    models = dict(bake(os.path.join(SRC, f)) for f in files)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// generated by tools/models.py from art/models/*.glb — 3D models for the 3D view (three3d.js)\n')
        f.write('const MODELS = ' + json.dumps(models, separators=(',', ':')) + ';\n')
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
