import json, math, io, base64
from PIL import Image, ImageDraw, ImageStat
Z=19; X0=444757; Y0=190644
LAT0,LON0=43.9927,125.3982
def tx(lon): return (lon+180)/360*2**Z
def ty(lat): r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z
S=156543.03392*math.cos(math.radians(LAT0))/2**Z      # 米/像素(256px 瓦片)
cx,cy=tx(LON0),ty(LAT0)
def m(lat,lon): return [round((tx(lon)-cx)*256*S,2), round((ty(lat)-cy)*256*S,2)]   # x东, z南
def px2m(p): return [round((p[0]/1.0 - (cx-X0)*256)*S,2), round((p[1] - (cy-Y0)*256)*S,2)]  # 全尺寸像素->米
mos=Image.open('/tmp/mosaic_full.png').convert('RGB')
W,H=mos.size
ext=dict(minX=px2m((0,0))[0],maxX=px2m((W,H))[0],minZ=px2m((0,0))[1],maxZ=px2m((W,H))[1])
print('S',S,ext)

def roof_color(pts):
    # pts: 米坐标 -> 全尺寸像素
    pp=[((x/S)+(cx-X0)*256,(z/S)+(cy-Y0)*256) for x,z in pts]
    xs=[p[0] for p in pp]; ys=[p[1] for p in pp]
    bx0,by0,bx1,by1=int(min(xs)),int(min(ys)),int(max(xs))+1,int(max(ys))+1
    bx0=max(0,bx0);by0=max(0,by0);bx1=min(W,bx1);by1=min(H,by1)
    if bx1<=bx0 or by1<=by0: return '#8a8a8a'
    c=mos.crop((bx0,by0,bx1,by1)); mk=Image.new('L',c.size,0)
    ImageDraw.Draw(mk).polygon([(a-bx0,b-by0) for a,b in pp],fill=255)
    r=ImageStat.Stat(c,mk).mean
    return '#%02x%02x%02x'%tuple(int(v) for v in r[:3])

d=json.load(open('osm.json'))
out=dict(ext=ext,buildings=[],water=[],forest=[],pitch=[],roads=[],univ=[],places=[])
RENAME={'长春工业大学 1 栋':'1栋','长春工业大学 2 栋':'2栋','长春工业大学 3 栋':'3栋','长春工业大学 4 栋':'4栋','长春工业大学 5 栋':'5栋','长春工业大学 6 栋':'6栋','长春工业大学 7 栋':'7栋'}
def shortname(n):
    if n in RENAME: return RENAME[n]
    return n.replace('长春工业大学','')
for e in d['elements']:
    if e['type']!='way' or 'geometry' not in e: continue
    t=e.get('tags',{}); pts=[m(p['lat'],p['lon']) for p in e['geometry']]
    if 'building' in t:
        if 'train_station' == t['building']: continue
        lv=t.get('building:levels'); lv=int(float(lv)) if lv else None
        nm=shortname(t.get('name','')) if t.get('name') else ''
        if t['building']=='service': lv=lv or 1
        h=(lv or 3)*3.6+0.8 if t.get('height') is None else float(t['height'])
        if pts[0]==pts[-1]: pts=pts[:-1]
        out['buildings'].append(dict(id=e['id'],name=nm,pts=pts,h=round(h,1),lv=lv or 3,kind=t['building'],roof=roof_color(pts)))
    elif t.get('natural')=='water': out['water'].append(dict(pts=pts))
    elif t.get('landuse')=='forest': out['forest'].append(dict(pts=pts))
    elif t.get('leisure')=='pitch': out['pitch'].append(dict(pts=pts,sport=t.get('sport','')))
    elif 'highway' in t and t['highway'] in ('primary','secondary','tertiary','service','residential','footway','primary_link'):
        out['roads'].append(dict(pts=pts,kind=t['highway'],name=t.get('name','')))
    elif t.get('amenity')=='university' : out['univ'].append(dict(name=t.get('name',''),pts=pts))

# ---- OSM 未收录、但在卫星图上清晰可见的建筑：按卫星图量取(小图像素=全图/4) ----
MAN=[ # x0,y0,x1,y1(1600宽预览图像素), 层数, 名称, 墙色
 (227,812,250,962,3,'田径场看台','#e8e8e4'),
 (1065,592,1130,630,2,'','#c9a08a'),
 (1215,593,1237,638,2,'','#e6e6e2'),
 (1145,785,1175,815,1,'','#9aa6b4'),
 (962,762,1118,830,6,'','#e0d9c8'),
 (640,230,720,250,8,'','#c98f78'),(722,230,805,250,8,'','#c98f78'),(822,230,908,250,8,'','#c98f78'),
 (722,285,805,305,8,'','#c98f78'),(822,312,938,335,8,'','#c98f78'),(543,346,805,364,8,'','#c98f78'),
 (232,60,310,80,7,'','#cfc7b8'),(232,100,310,155,9,'','#cfc7b8'),(318,125,400,148,6,'','#cfc7b8'),
 (240,195,305,250,5,'','#d4d0c4'),(235,258,325,295,8,'','#cfc7b8'),(235,340,315,362,7,'','#cfc7b8'),
 (324,280,410,360,10,'','#cfc7b8'),(40,0,128,170,5,'','#e2d6c8'),(20,1095,110,1122,6,'','#d7d2c6'),
]
for i,(a,b,c,dd,lv,nm,col) in enumerate(MAN):
    pts=[px2m((a*4,b*4)),px2m((c*4,b*4)),px2m((c*4,dd*4)),px2m((a*4,dd*4))]
    out['buildings'].append(dict(id=-(i+1),name=nm,pts=pts,h=round(lv*3.6+.8,1),lv=lv,kind='manual',roof=roof_color(pts),wall=col))

# ---- 地标/传送点（米坐标取自量测）----
def P(a,b): return px2m((a*4,b*4))
out['places']=[
 dict(key='1',name='校区南入口',p=P(810,1015),yaw=0),
 dict(key='2',name='主教学楼广场',p=P(810,700),yaw=0),
 dict(key='3',name='学生宿舍区',p=P(400,520),yaw=0),
 dict(key='4',name='田径场',p=P(315,880),yaw=0),
 dict(key='5',name='北湖公园',p=P(700,1075),yaw=0),
 dict(key='6',name='东侧空地(规划用地)',p=P(1000,520),yaw=0),
]
json.dump(out,open('data.json','w'))
print({k:len(v) for k,v in out.items() if isinstance(v,list)})

# ---- 卫星瓦片：4x4，每块 1200x912，嵌入 base64，避免 file:// 下 WebGL 跨域限制 ----
SC=0.75  # 6400->4800
im=mos.resize((int(W*SC),int(H*SC)),Image.LANCZOS)
cols=rows=4; tw,th=im.width//cols, im.height//rows
tiles=[]
for r in range(rows):
    for c in range(cols):
        t=im.crop((c*tw,r*th,(c+1)*tw,(r+1)*th)); bio=io.BytesIO(); t.save(bio,'JPEG',quality=80,optimize=True)
        x0=ext['minX']+(ext['maxX']-ext['minX'])*c/cols; x1=ext['minX']+(ext['maxX']-ext['minX'])*(c+1)/cols
        z0=ext['minZ']+(ext['maxZ']-ext['minZ'])*r/rows; z1=ext['minZ']+(ext['maxZ']-ext['minZ'])*(r+1)/rows
        tiles.append(dict(x0=x0,x1=x1,z0=z0,z1=z1,src='data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()))
with open('data.js','w') as f:
    f.write('const CAMPUS_DATA='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
with open('tiles.js','w') as f:
    f.write('const SAT_TILES='+json.dumps(tiles,separators=(',',':'))+';\n')
import os; print(os.path.getsize('data.js'),os.path.getsize('tiles.js'))
