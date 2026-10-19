import json, math
from PIL import Image, ImageDraw, ImageFont
Z=19; X0=444757; Y0=190644
def tx(lon): return (lon+180)/360*2**Z
def ty(lat): r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z
def px(lat,lon): return ((tx(lon)-X0)*256,(ty(lat)-Y0)*256)
d=json.load(open('osm.json'))
im=Image.open('/tmp/mosaic_full.png').convert('RGB'); g=ImageDraw.Draw(im)
f=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',44)
for e in d['elements']:
    t=e.get('tags',{}); 
    if e['type']!='way' or 'geometry' not in e: continue
    pts=[px(p['lat'],p['lon']) for p in e['geometry']]
    if 'building' in t: g.line(pts+[pts[0]],fill=(255,0,0),width=6); 
    if 'building' in t and 'name' in t:
        g.text(pts[0],t['name'].replace('长春工业大学',''),fill=(255,255,0),font=f)
    elif 'highway' in t: g.line(pts,fill=(0,255,255),width=4)
    elif 'leisure' in t or 'natural' in t: g.line(pts,fill=(255,0,255),width=6)
    elif t.get('amenity')=='university': g.line(pts+[pts[0]],fill=(0,255,0),width=8)
im.resize((1600,1216)).save('/tmp/ov.jpg',quality=88)
