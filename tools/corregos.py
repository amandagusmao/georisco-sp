"""
Prepara a rede de córregos e rios (camada "drenagem" do GeoSampa) para o GeoRisco SP.

Uso:  python tools/corregos.py <pasta_bruta> data      (rodar depois de tools/rasters.py)
Saídas:
  data/corregos/<i>_<j>.json   blocos de ~3 km com os trechos (consulta e mapa aproximado)
  data/corregos/indice.json    tamanho e lista dos blocos
  data/raster/corregos.png     imagem leve para o mapa afastado (20 m)
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw
from shapely.geometry import shape, mapping, box

SRC, OUT = sys.argv[1], sys.argv[2]
CDIR = os.path.join(OUT, "corregos")
os.makedirs(CDIR, exist_ok=True)
for f in os.listdir(CDIR):
    os.remove(os.path.join(CDIR, f))

PASSO = 0.03  # graus (~3 km)
ACENTOS = {"Corrego": "Córrego", "Ribeirao": "Ribeirão", "Tiete": "Tietê", "Guacu": "Guaçu", "Tamanduatei": "Tamanduateí",
           "Cabucu": "Cabuçu", "Pirajucara": "Pirajuçara", "Jaguare": "Jaguaré", "Sao": "São", "Joao": "João",
           "Agua": "Água", "Jacu": "Jacu", "Capao": "Capão", "Angela": "Ângela", "Jose": "José", "Antonio": "Antônio",
           "Conceicao": "Conceição", "Uniao": "União", "Itaquera": "Itaquera", "Ipiranga": "Ipiranga", "Mandaqui": "Mandaqui",
           "Lajeado": "Lajeado", "Inhuma": "Inhumã", "Cacula": "Caçula", "Maranhao": "Maranhão", "Moinho": "Moinho"}
BAIXAS = {"da", "de", "do", "das", "dos", "e"}


def titulo(s):
    if not s:
        return ""
    out = []
    for i, w in enumerate(s.strip().split()):
        if i and w.lower() in BAIXAS:
            out.append(w.lower())
        else:
            out.append("-".join(ACENTOS.get(x.capitalize(), x.capitalize()) for x in w.split("-")))
    return " ".join(out)


TIPO = {"Trecho em estado natural": "n", "Trecho canalizado a céu aberto": "a",
        "Trecho canalizado subterrâneo": "s", "Trecho em lago ou reservatório": "l"}

feats = json.load(open(os.path.join(SRC, "drenagem.json"), encoding="utf8"))["features"]
blocos = {}
linhas = []
for f in feats:
    p = f["properties"]
    t = TIPO.get(p["nm_tipo_curso_hidrografia"], "n")
    if p.get("nm_tipo_trecho") == "Trecho fechado" and t == "a":
        t = "s"
    g = shape(f["geometry"]).simplify(0.00003, preserve_topology=False)
    if g.is_empty or g.length == 0:
        continue
    coords = [[round(x, 5), round(y, 5)] for x, y in g.coords]
    props = {"t": t}
    nome = titulo(p.get("nm_acidente"))
    if nome:
        props["n"] = nome
    via = titulo(p.get("nm_via_proximo"))
    if via:
        props["v"] = via
    feat = {"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": coords}}
    linhas.append((t, f["geometry"]["coordinates"]))
    a, b, c, d = g.bounds
    for i in range(math.floor(a / PASSO), math.floor(c / PASSO) + 1):
        for j in range(math.floor(b / PASSO), math.floor(d / PASSO) + 1):
            if g.intersects(box(i * PASSO, j * PASSO, (i + 1) * PASSO, (j + 1) * PASSO)):
                blocos.setdefault(f"{i}_{j}", []).append(feat)

for k, lista in blocos.items():
    with open(os.path.join(CDIR, k + ".json"), "w", encoding="utf8") as fh:
        json.dump({"type": "FeatureCollection", "features": lista}, fh, ensure_ascii=False, separators=(",", ":"))
json.dump({"passo": PASSO, "blocos": sorted(blocos)}, open(os.path.join(CDIR, "indice.json"), "w"), separators=(",", ":"))
tam = sum(os.path.getsize(os.path.join(CDIR, x)) for x in os.listdir(CDIR))
print(len(blocos), "blocos,", round(tam / 1024), "KB")

# ---------------------------------------------- imagem para o mapa afastado
meta = json.load(open(os.path.join(OUT, "raster", "meta.json")))
R = 6378137.0
RES2 = meta["res"] * 2
W2, H2 = meta["w"] // 2, meta["h"] // 2


def px(lon, lat):
    x = R * math.radians(lon)
    y = R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return (x - meta["x0"]) / RES2, (meta["y1"] - y) / RES2


img = Image.new("P", (W2, H2), 0)
dr = ImageDraw.Draw(img)
ORDEM = [("s", 3, 1), ("n", 1, 1), ("a", 2, 2)]  # (tipo, cor da paleta, largura)
for tipo, cor, larg in ORDEM:
    for t, coords in linhas:
        if t == tipo:
            dr.line([px(x, y) for x, y in coords], fill=cor, width=larg)
pal = [0, 0, 0] * 256
alfa = [0] * 256
for k, (rgb, a) in {1: ((56, 189, 248), 230), 2: ((14, 165, 233), 255), 3: ((100, 116, 139), 170)}.items():
    pal[k * 3: k * 3 + 3] = rgb
    alfa[k] = a
img.putpalette(pal)
img.save(os.path.join(OUT, "raster", "corregos.png"), optimize=True, transparency=bytes(alfa))
print("imagem", round(os.path.getsize(os.path.join(OUT, "raster", "corregos.png")) / 1024), "KB")
