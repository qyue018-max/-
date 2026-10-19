import math, os, sys, urllib.request, concurrent.futures as cf
from PIL import Image
Z=19
def tx(lon): return (lon+180)/360*2**Z
def ty(lat): r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z
W,E,S,N=125.3905,125.4075,43.9895,43.9985
x0,x1=int(tx(W)),int(tx(E)); y0,y1=int(ty(N)),int(ty(S))
print(x0,x1,y0,y1,(x1-x0+1)*(y1-y0+1))
def get(a):
    x,y=a
    u=f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{Z}/{y}/{x}"
    for _ in range(3):
        try:
            req=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"})
            return a,urllib.request.urlopen(req,timeout=30).read()
        except Exception as e: err=e
    return a,None
tiles=[(x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)]
os.makedirs('/tmp/tl',exist_ok=True)
im=Image.new('RGB',((x1-x0+1)*256,(y1-y0+1)*256))
import io
with cf.ThreadPoolExecutor(12) as ex:
    for (x,y),b in ex.map(get,tiles):
        if b: im.paste(Image.open(io.BytesIO(b)).convert('RGB'),((x-x0)*256,(y-y0)*256))
        else: print('fail',x,y)
im.save('/tmp/mosaic_full.png')
# 记录拼图地理范围（tile 空间 → 经纬度）
def lon_of(x): return x/2**Z*360-180
def lat_of(y): n=math.pi-2*math.pi*y/2**Z; return math.degrees(math.atan(math.sinh(n)))
import json
json.dump({'west':lon_of(x0),'east':lon_of(x1+1),'north':lat_of(y0),'south':lat_of(y1+1),'w':im.width,'h':im.height},open('mosaic.json','w'))
print(im.size, open('mosaic.json').read())
