"""
Gera rasters leves (PNG) de manchas de inundação e declividade para o GeoRisco SP.

- Manchas de inundação (períodos de retorno de 5, 25 e 100 anos): baixadas do WMS do
  GeoSampa (as camadas vetoriais têm centenas de milhares de polígonos).
- Declividade: rasterizada a partir da camada vetorial (WFS) baixada por baixar_dados.py.

Uso:  python tools/rasters.py <pasta_bruta> data
Saídas:
  data/raster/inundacao.png     sobreposição colorida para o mapa (20 m)
  data/raster/declividade.png   sobreposição colorida para o mapa (20 m)
  data/raster/t/<i>_<j>.png     blocos de consulta (10 m): valor = inundação + 4 * declividade
  data/raster/meta.json         grade (Web Mercator) e lista de blocos
  <pasta_bruta>/stats_raster.json  estatísticas por distrito usadas por preprocess.py
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape

SRC, OUT = sys.argv[1], sys.argv[2]
RDIR = os.path.join(OUT, "raster")
TDIR = os.path.join(RDIR, "t")
CACHE = os.path.join(SRC, "wms_cache")
for d in (RDIR, TDIR, CACHE):
    os.makedirs(d, exist_ok=True)

R = 6378137.0
RES = 10.0          # metros (Web Mercator) por pixel na grade de consulta
TILE_WMS = 1024
TILE = 512
WMS = "https://wms.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wms"


def merc(lon, lat):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


# ------------------------------------------------------------------ grade
dist = json.load(open(os.path.join(SRC, "distrito_municipal.json"), encoding="utf8"))["features"]
minx = miny = 1e18
maxx = maxy = -1e18
geoms = []
for f in dist:
    g = shape(f["geometry"])
    geoms.append((f["properties"]["sg_distrito_municipal"], g))
    a, b, c, d = g.bounds
    minx, miny, maxx, maxy = min(minx, a), min(miny, b), max(maxx, c), max(maxy, d)
X0, Y0 = merc(minx - 0.005, miny - 0.005)
X1, Y1 = merc(maxx + 0.005, maxy + 0.005)
W = int(math.ceil((X1 - X0) / RES / TILE)) * TILE
H = int(math.ceil((Y1 - Y0) / RES / TILE)) * TILE
X1, Y0 = X0 + W * RES, Y1 - H * RES
print(f"grade {W} x {H} px")


def px(lon, lat):
    x, y = merc(lon, lat)
    return (x - X0) / RES, (Y1 - y) / RES


# ------------------------------------------------------------ inundação
def baixar_wms(camada):
    arr = np.zeros((H, W), dtype=bool)
    for j in range(0, H, TILE_WMS):
        for i in range(0, W, TILE_WMS):
            w, h = min(TILE_WMS, W - i), min(TILE_WMS, H - j)
            bx0, by1 = X0 + i * RES, Y1 - j * RES
            bbox = f"{bx0},{by1 - h * RES},{bx0 + w * RES},{by1}"
            arq = os.path.join(CACHE, f"{camada}_{i}_{j}.png")
            if not os.path.exists(arq):
                q = urllib.parse.urlencode({
                    "service": "WMS", "version": "1.1.1", "request": "GetMap", "layers": f"geoportal:{camada}",
                    "styles": "", "srs": "EPSG:3857", "bbox": bbox, "width": w, "height": h,
                    "format": "image/png", "transparent": "true", "format_options": "antialias:none"})
                for tentativa in range(4):
                    try:
                        urllib.request.urlretrieve(f"{WMS}?{q}", arq)
                        Image.open(arq).verify()
                        break
                    except Exception as e:
                        print("  repetindo", camada, i, j, e)
                        time.sleep(3)
                time.sleep(0.2)
            img = np.array(Image.open(arq).convert("RGBA"))
            arr[j:j + h, i:i + w] = img[:, :, 3] > 0
    print(camada, int(arr.sum()), "pixels")
    return arr


m100 = baixar_wms("mancha_inundacao_100")
m25 = baixar_wms("mancha_inundacao_25")
m5 = baixar_wms("mancha_inundacao_5")
inund = np.zeros((H, W), dtype=np.uint8)
inund[m100] = 3
inund[m25] = 2
inund[m5] = 1
del m100, m25, m5

# ------------------------------------------------------------ declividade
decl_img = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(decl_img)
feats = json.load(open(os.path.join(SRC, "declividade.json"), encoding="utf8"))["features"]
polys = []
for f in feats:
    g = f["geometry"]
    if not g:
        continue
    cls = int(f["properties"]["cd_classe_declividade"])
    partes = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for p in partes:
        anel = [px(x, y) for x, y in p[0]]
        polys.append((shape({"type": "Polygon", "coordinates": [p[0]]}).area, cls, anel))
polys.sort(key=lambda t: -t[0])   # maiores primeiro: os menores (que preenchem os buracos) ficam por cima
for _, cls, anel in polys:
    if len(anel) >= 3:
        dr.polygon(anel, fill=cls)
decl = np.array(decl_img, dtype=np.uint8)
del decl_img, polys, feats
print("declividade pronta")

# ------------------------------------------------------- distritos (zonal)
dist_img = Image.new("L", (W, H), 0)
dd = ImageDraw.Draw(dist_img)
ids = {}
for k, (sg, g) in enumerate(geoms, start=1):
    ids[k] = sg
    partes = [g] if g.geom_type == "Polygon" else list(g.geoms)
    for p in partes:
        dd.polygon([px(x, y) for x, y in p.exterior.coords], fill=k)
dist_arr = np.array(dist_img, dtype=np.uint8)
del dist_img
stats = {}
for k, sg in ids.items():
    m = dist_arr == k
    n = int(m.sum()) or 1
    stats[sg] = {
        "pct_alaga_5": round(100 * int((inund[m] == 1).sum()) / n, 1),
        "pct_alaga_25": round(100 * int(((inund[m] >= 1) & (inund[m] <= 2)).sum()) / n, 1),
        "pct_alaga_100": round(100 * int((inund[m] >= 1).sum()) / n, 1),
        "pct_declive_25": round(100 * int((decl[m] >= 3).sum()) / n, 1),
        "pct_declive_60": round(100 * int((decl[m] == 4).sum()) / n, 1),
    }
json.dump(stats, open(os.path.join(SRC, "stats_raster.json"), "w", encoding="utf8"), ensure_ascii=False)
dentro = dist_arr > 0
del dist_arr

# ------------------------------------------------------ blocos de consulta
cod = (inund + 4 * decl).astype(np.uint8)
cod[~dentro] = 0
for f in os.listdir(TDIR):
    os.remove(os.path.join(TDIR, f))
blocos = []
for j in range(0, H, TILE):
    for i in range(0, W, TILE):
        b = cod[j:j + TILE, i:i + TILE]
        if b.any():
            nome = f"{i // TILE}_{j // TILE}"
            Image.fromarray(b, "L").save(os.path.join(TDIR, nome + ".png"), optimize=True)
            blocos.append(nome)
print(len(blocos), "blocos")

# --------------------------------------------------- sobreposições (20 m)
def sobrepor(classes, cores, arq):
    h2, w2 = H // 2, W // 2
    c = classes[: h2 * 2, : w2 * 2].reshape(h2, 2, w2, 2)
    # mantém a classe "mais grave" (menor código diferente de zero) de cada bloco 2x2
    c = np.where(c == 0, 255, c).min(axis=(1, 3))
    c[c == 255] = 0
    pal = Image.fromarray(c.astype(np.uint8), "P")
    paleta = [0, 0, 0] * 256
    alfa = [0] * 256
    for k, (rgb, a) in cores.items():
        paleta[k * 3: k * 3 + 3] = rgb
        alfa[k] = a
    pal.putpalette(paleta)
    pal.info["transparency"] = bytes(alfa)
    pal.save(os.path.join(RDIR, arq), optimize=True, transparency=bytes(alfa))


inund_v = inund.copy()
inund_v[~dentro] = 0
sobrepor(inund_v, {1: ((29, 78, 216), 215), 2: ((59, 130, 246), 175), 3: ((147, 197, 253), 130)}, "inundacao.png")
decl_v = np.where(decl >= 3, decl - 2, 0).astype(np.uint8)   # só mostra declive forte
decl_v = np.where(decl_v == 0, 0, 3 - decl_v)                 # 1 = >60%, 2 = 25 a 60%
decl_v[~dentro] = 0
sobrepor(decl_v, {1: ((180, 83, 9), 200), 2: ((217, 164, 65), 120)}, "declividade.png")


def lonlat(x, y):
    return math.degrees(x / R), math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)


sw = lonlat(X0, Y0)
ne = lonlat(X1, Y1)
json.dump({
    "x0": X0, "y1": Y1, "res": RES, "tile": TILE, "w": W, "h": H,
    "sul": sw[1], "oeste": sw[0], "norte": ne[1], "leste": ne[0], "blocos": blocos,
}, open(os.path.join(RDIR, "meta.json"), "w"), separators=(",", ":"))
print("ok")
