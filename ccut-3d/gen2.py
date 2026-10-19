import json, math, io, base64, os
from PIL import Image, ImageDraw, ImageStat
Image.MAX_IMAGE_PIXELS = None
Z = 19; X0 = 444757; Y0 = 190644
LAT0, LON0 = 43.9927, 125.3982
def tx(lon): return (lon + 180) / 360 * 2 ** Z
def ty(lat): r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** Z
S = 156543.03392 * math.cos(math.radians(LAT0)) / 2 ** Z
cx, cy = tx(LON0), ty(LAT0)
OFX, OFZ = (cx - X0) * 256, (cy - Y0) * 256          # 原点在拼图中的像素
def px2m(p): return [round((p[0] - OFX) * S, 2), round((p[1] - OFZ) * S, 2)]
def m2px(x, z): return (x / S + OFX, z / S + OFZ)
def sp(x, y): return px2m((x * 4, y * 4))             # 1600 宽预览图坐标 -> 米
def crop_pt(ox, oy, k, x, y): return sp(ox + x / k, oy + y / k)
mos = Image.open('/tmp/mosaic_full.png').convert('RGB'); W, H = mos.size

# ---------------- 保留 OSM 数据，丢弃旧的手工建筑 ----------------
D = json.load(open('data.json'))
ext = D['ext']
keep = [b for b in D['buildings'] if not (b['kind'] == 'manual' and b['id'] in (-1, -2, -3, -4, -5))]

def roof_color(pts):
    pp = [m2px(x, z) for x, z in pts]
    xs = [p[0] for p in pp]; ys = [p[1] for p in pp]
    a, b, c, d = max(0, int(min(xs))), max(0, int(min(ys))), min(W, int(max(xs)) + 1), min(H, int(max(ys)) + 1)
    if c <= a or d <= b: return '#8a8a8a'
    cr = mos.crop((a, b, c, d)); mk = Image.new('L', cr.size, 0)
    ImageDraw.Draw(mk).polygon([(p[0] - a, p[1] - b) for p in pp], fill=255)
    r = ImageStat.Stat(cr, mk).mean
    return '#%02x%02x%02x' % tuple(int(v) for v in r[:3])
def rect(x0, z0, x1, z1): return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
def man(name, pts, h, lv, style, wall, **kw):
    d = dict(id=900 + len(keep), name=name, pts=pts, h=h, lv=lv, kind='manual', roof=roof_color(pts), wall=wall, style=style)
    d.update(kw); keep.append(d)

# ---- 体育馆（田径场西侧）：两翼 + 棕色大厅 ----
def stad(x0, y0, x1, y1): return rect(*sp(200 + x0 / 4.074, 730 + y0 / 4.074), *sp(200 + x1 / 4.074, 730 + y1 / 4.074))
man('体育馆', stad(125, 525, 240, 755), 17, 3, 'hall', '#d9d2c4', roofType='gable', roofColor='#7a4a32', axis='z')
man('', stad(125, 330, 205, 495), 11.6, 3, 'plain', '#dcd8ce')
man('', stad(125, 760, 205, 945), 11.6, 3, 'plain', '#dcd8ce')

# ---- 东南侧大楼（H 形，带前广场与停车位）----
LB = lambda x, y: crop_pt(930, 730, 6.364, x, y)
man('', [LB(205, 215), LB(1195, 215), LB(1195, 445), LB(1045, 445), LB(1045, 360), LB(435, 360), LB(435, 445), LB(205, 445)],
    20.2, 5, 'office', '#e6e0d0', entrance=True)
# ---- 红顶厂房、小型附属建筑 ----
man('', rect(*sp(1066, 596), *sp(1128, 630)), 7.2, 2, 'plain', '#d9d4c8', roofType='gable', roofColor='#c4553a', axis='x')
man('', rect(*sp(1215, 593), *sp(1237, 638)), 8, 2, 'plain', '#e6e6e2')
man('', rect(*sp(1145, 785), *sp(1175, 815)), 3.5, 1, 'plain', '#9aa6b4')
# ---- 南大门：门卫室 + 门楼 ----
man('门卫室', rect(*crop_pt(690, 940, 5.833, 750, 330), *crop_pt(690, 940, 5.833, 875, 410)), 4, 1, 'plain', '#dcd6c8')
man('', rect(*crop_pt(690, 940, 5.833, 565, 362), *crop_pt(690, 940, 5.833, 695, 400)), 6.5, 1, 'gate', '#e8e6e0')

json.dump(dict(keep=keep), open('/tmp/keep.json', 'w'))

# ---------------- 核心区裁剪 ----------------
CB = dict(x0=-482, x1=362, z0=-322, z1=252)           # 米
D['buildings'] = keep
D['ext'] = dict(minX=CB['x0'], maxX=CB['x1'], minZ=CB['z0'], maxZ=CB['z1'])
def inbox(p, pad=0): return CB['x0'] - pad < p[0] < CB['x1'] + pad and CB['z0'] - pad < p[1] < CB['z1'] + pad
D['buildings'] = [b for b in D['buildings'] if any(inbox(p, 30) for p in b['pts'])]
for k in ('roads', 'forest', 'pitch', 'water'):
    D[k] = [o for o in D[k] if any(inbox(p, 60) for p in o['pts'])]

# ---------------- 植被检测 -> 树木点（用于对位真实树的位置）----------------
import numpy as np
a = np.asarray(mos).astype(np.float32)
px0, py0 = [int(v) for v in m2px(CB['x0'], CB['z0'])]; px1, py1 = [int(v) for v in m2px(CB['x1'], CB['z1'])]
sub = a[py0:py1, px0:px1]
r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
lum = (r + g + b) / 3; mx = sub.max(-1); mn = sub.min(-1); sat = (mx - mn) / (mx + 1)
# 深绿/橄榄色树冠；排除草地(亮)、足球场(很亮的绿)、阴影(过暗)
tree = (g >= r * 1.0) & (g > b * 1.18) & (lum > 30) & (lum < 95) & (sat > 0.18)
# 下采样到 2.4m 网格，统计占比
cell = int(2.4 / S)
gh, gw = tree.shape[0] // cell, tree.shape[1] // cell
t = tree[:gh * cell, :gw * cell].reshape(gh, cell, gw, cell).mean((1, 3))
pts = []
for j in range(gh):
    for i in range(gw):
        if t[j, i] > 0.72:
            pts.append([round((px0 + (i + .5) * cell - OFX) * S, 1), round((py0 + (j + .5) * cell - OFZ) * S, 1)])
# 稀疏化：每 5m 栅格最多一棵
seen = set(); trees = []
for p in pts:
    k = (int(p[0] // 5), int(p[1] // 5))
    if k in seen: continue
    seen.add(k); trees.append([round(p[0] + (hash(k) % 7 - 3) * .3, 1), round(p[1] + (hash(k[::-1]) % 7 - 3) * .3, 1)])
D['treeSeeds'] = trees
print('tree seeds', len(trees))

# ---------------- 卫星瓦片：核心区，保持原生分辨率 ----------------
core = mos.crop((px0, py0, px1, py1))
ca = np.asarray(core).astype(np.float32); cl = ca.mean(-1, keepdims=True)
w = np.clip((118 - cl) / 118, 0, 1) ** 0.8
curve = 255 * (ca / 255) ** 0.55
core = Image.fromarray(np.clip(ca * (1 - w) + curve * w, 0, 255).astype(np.uint8))
cols, rows = 4, 3
tw, th = core.width // cols, core.height // rows
tiles = []
for rr in range(rows):
    for cc in range(cols):
        x0p, y0p = cc * tw, rr * th
        x1p, y1p = (core.width if cc == cols - 1 else x0p + tw), (core.height if rr == rows - 1 else y0p + th)
        tl = core.crop((x0p, y0p, x1p, y1p)); bio = io.BytesIO(); tl.save(bio, 'JPEG', quality=86, optimize=True)
        tiles.append(dict(x0=round((px0 + x0p - OFX) * S, 2), x1=round((px0 + x1p - OFX) * S, 2), z0=round((py0 + y0p - OFZ) * S, 2), z1=round((py0 + y1p - OFZ) * S, 2),
                          src='data:image/jpeg;base64,' + base64.b64encode(bio.getvalue()).decode()))
print('core px', core.size)
D['places'] = [
    dict(key='1', name='校区南大门', p=sp(810, 1010), yaw=0),
    dict(key='2', name='主教学楼广场', p=sp(810, 690), yaw=0),
    dict(key='3', name='宿舍区', p=sp(400, 535), yaw=0),
    dict(key='4', name='田径场', p=sp(315, 890), yaw=0),
    dict(key='5', name='艺术技术楼', p=sp(570, 700), yaw=0),
    dict(key='6', name='信息传播楼', p=sp(1045, 700), yaw=0),
]
open('data.js', 'w').write('const CAMPUS_DATA=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
open('tiles.js', 'w').write('const SAT_TILES=' + json.dumps(tiles, separators=(',', ':')) + ';\n')
print(os.path.getsize('data.js'), os.path.getsize('tiles.js'))
