"""
Pré-processamento dos dados abertos do GeoSampa (Prefeitura de São Paulo)
para o site GeoRisco SP.

Uso:
    python tools/baixar_dados.py  <pasta_bruta>        (baixa as camadas WFS)
    python tools/preprocess.py    <pasta_bruta> data   (gera os arquivos do site)

Gera GeoJSON simplificados (coordenadas com 5 casas decimais) e um resumo
estatístico por distrito (data/distritos.geojson + data/resumo.json).
"""
import json
import math
import re
import os
import sys
from collections import Counter, defaultdict

from shapely.geometry import shape, mapping, Point
from shapely.validation import make_valid
from shapely.strtree import STRtree
from shapely.ops import unary_union

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)


def load(name):
    with open(os.path.join(SRC, name + ".json"), encoding="utf8") as f:
        return json.load(f)["features"]


def geom(f):
    g = shape(f["geometry"])
    if not g.is_valid:
        g = make_valid(g)
    if g.geom_type == "GeometryCollection":
        polys = [p for p in g.geoms if p.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys)
    return g


def rnd(obj, nd=5):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [rnd(o, nd) for o in obj]
    return obj


def to_feature(g, props, tol=None, nd=5):
    if tol:
        g = g.simplify(tol, preserve_topology=True)
    if g.is_empty:
        return None
    gm = mapping(g)
    gm = {"type": gm["type"], "coordinates": rnd(gm["coordinates"], nd)}
    return {"type": "Feature", "properties": props, "geometry": gm}


def dump(name, feats):
    feats = [f for f in feats if f]
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf8") as fh:
        json.dump({"type": "FeatureCollection", "features": feats}, fh,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{name}: {len(feats)} feições, {os.path.getsize(path)/1024:.0f} KB")


ACENTOS = {"Agua": "Água", "Angela": "Ângela", "Belem": "Belém", "Bras": "Brás",
           "Brasilandia": "Brasilândia", "Butanta": "Butantã", "Capao": "Capão", "Carrao": "Carrão",
           "Cangaiba": "Cangaíba", "Consolacao": "Consolação", "Grajau": "Grajaú", "Jacana": "Jaçanã",
           "Jaragua": "Jaraguá", "Jaguare": "Jaguaré", "Sao": "São", "Luis": "Luís", "Jose": "José",
           "Bonifacio": "Bonifácio", "Lider": "Líder", "Sacoma": "Sacomã", "Cecilia": "Cecília",
           "Republica": "República", "Saude": "Saúde", "Tremembe": "Tremembé", "Curuca": "Curuçá",
           "Jacui": "Jacuí", "Sonia": "Sônia", "Tatuape": "Tatuapé", "Limao": "Limão",
           "Corrego": "Córrego", "Ribeirao": "Ribeirão", "Joao": "João", "Antonio": "Antônio",
           "Conceicao": "Conceição", "Uniao": "União", "Vitoria": "Vitória", "Pirajussara": "Pirajuçara"}
FIXOS = {"Se": "Sé", "M Boi Mirim": "M'Boi Mirim", "Freguesia do O": "Freguesia do Ó",
         "Freguesia-brasilândia": "Freguesia-Brasilândia"}


def title(s):
    if not s:
        return s
    low = {"da", "de", "do", "das", "dos", "e"}

    def cap(w, first):
        if w.lower() in low and not first:
            return w.lower()
        return "-".join(ACENTOS.get(x.capitalize(), x.capitalize()) for x in w.split("-"))
    out = " ".join(cap(w, i == 0) for i, w in enumerate(s.strip().split()))
    out = re.sub(r"([/(])(\w)", lambda m: m.group(1) + m.group(2).upper(), out)
    return FIXOS.get(out, out)


# ---------------------------------------------------------------- distritos
subs = {f["properties"]["cd_identificador_subprefeitura"]: f["properties"]
        for f in load("subprefeitura")}
dist_feats = load("distrito_municipal")
D = []
for f in dist_feats:
    p = f["properties"]
    sp = subs.get(p["cd_identificador_subprefeitura"], {})
    D.append({
        "id": p["sg_distrito_municipal"],
        "nome": title(p["nm_distrito_municipal"]),
        "subprefeitura": title(sp.get("nm_subprefeitura", "")),
        "regiao": p["nm_regiao_05"],
        "regiao8": p["nm_regiao_08"],
        "area_km2": round(p["qt_area_quilometro"], 2),
        "g": geom(f),
    })
tree = STRtree([d["g"] for d in D])


def district_of(g):
    pt = g if g.geom_type == "Point" else g.representative_point()
    for i in tree.query(pt, predicate="intersects"):
        return int(i)
    # fora (borda): o mais próximo
    return int(tree.nearest(pt))


stats = [defaultdict(float) for _ in D]

# ------------------------------------------------- risco geológico (IPT/PMSP)
GRAU = {"r1": "R1", "r2": "R2", "r3": "R3", "r4": "R4"}
PESO = {"R1": 1, "R2": 2, "R3": 4, "R4": 8}
geo_out = []
for f in load("area_risco_geologico"):
    p = f["properties"]
    grau = GRAU.get(p["tx_grau_de_risco_geologico"])
    if not grau:          # áreas encerradas / em monitoramento ficam de fora
        continue
    g = geom(f)
    i = district_of(g)
    proc = p["tx_tipo_processo_geologico"]
    s = stats[i]
    s[f"geo_{grau}"] += 1
    s["geo_total"] += 1
    s["moradias_geo"] += p["qt_moradia"] or 0
    if grau in ("R3", "R4"):
        s["moradias_alto"] += p["qt_moradia"] or 0
    if "ESCORREGAMENTO" in proc:
        s["raw_desl"] += PESO[grau]
        s["setores_escorregamento"] += 1
    if "SOLAPAMENTO" in proc:
        s["raw_eros"] += PESO[grau]
        s["setores_solapamento"] += 1
    geo_out.append(to_feature(g, {
        "nome": title(p["nm_area_risco"]), "grau": grau,
        "processo": proc.title().replace("/", " / "),
        "setor": p["sg_setor_risco"], "moradias": p["qt_moradia"] or 0,
        "vistoria": (p["dt_vistoria"] or "")[:10],
        "distrito": D[i]["nome"]}, tol=0.00003))
dump("risco_geologico.geojson", geo_out)

# ----------------------------------------------- risco hidrológico (PMSP)
hid_out = []
for f in load("risco_hidrologico"):
    p = f["properties"]
    grau = (p["tx_grau_risco_hidrologico"] or "").strip().upper()
    if grau not in PESO:
        continue
    g = geom(f)
    i = district_of(g)
    s = stats[i]
    s[f"hid_{grau}"] += 1
    s["hid_total"] += 1
    s["moradias_hid"] += p["qt_moradia"] or 0
    if grau in ("R3", "R4"):
        s["moradias_alto"] += p["qt_moradia"] or 0
    s["raw_alag"] += PESO[grau]
    proc = (p["tx_tipo_processo"] or "").strip().upper().replace("INUNDAÇÃO", "INUNDACAO").replace("INUDACAO", "INUNDACAO")
    hid_out.append(to_feature(g, {
        "nome": title(p["nm_area_risco_hidrologico"]), "grau": grau,
        "processo": proc.title().replace("Inundacao", "Inundação").replace("/", " / "),
        "setor": p["sg_setor_risco_hidrologico"], "moradias": p["qt_moradia"] or 0,
        "bacia": title(p["nm_bacia_hidrografica"]),
        "vistoria": (p["dt_vistoria"] or "")[:10],
        "distrito": D[i]["nome"]}, tol=0.00003))
dump("risco_hidrologico.geojson", hid_out)

# ------------------------------------------------ áreas contaminadas (SVMA)
CLS = {"Contaminada": 3, "Contaminada Sob Investigação": 2,
       "Em Processo de Monitoramento para Reabilitação": 1, "Reabilitada": 0.3}
cont_out = []
for f in load("area_contaminada_reabilitada_svma"):
    p = f["properties"]
    cls = p["dc_classificacao_area_contaminada"]
    g = geom(f)
    i = district_of(g)
    s = stats[i]
    key = {"Contaminada": "cont_contaminada", "Contaminada Sob Investigação": "cont_investigacao",
           "Em Processo de Monitoramento para Reabilitação": "cont_monitoramento",
           "Reabilitada": "cont_reabilitada"}.get(cls, "cont_outros")
    s[key] += 1
    s["cont_total"] += 1
    s["raw_cont"] += CLS.get(cls, 1)
    cont_out.append(to_feature(g, {
        "endereco": p["tx_endereco_area_contaminada"], "classe": cls,
        "contaminantes": p["tx_contaminante"] or "Não informado",
        "uso_anterior": p["dc_uso_anterior_geral"] or "",
        "restricao": p["tx_restricao"] or "",
        "distrito": D[i]["nome"]}, tol=0.00002))
dump("areas_contaminadas.geojson", cont_out)

# -------------------------------------- ocorrências 2026 (Defesa Civil/SIGRC)
oc_out = []
for layer, tipo in (("risco_ocorrencia_alagamento", "Alagamento"),
                    ("risco_ocorrencia_inundacao", "Inundação"),
                    ("risco_ocorrencia_deslizamento", "Deslizamento")):
    for f in load(layer):
        g = geom(f)
        if g.is_empty:
            continue
        i = district_of(g)
        s = stats[i]
        s["oc_total"] += 1
        s["oc_" + tipo.lower().replace("ç", "c").replace("ã", "a")] += 1
        if tipo == "Deslizamento":
            s["raw_desl"] += 2
        else:
            s["raw_alag"] += 1.5
        oc_out.append(to_feature(g, {"tipo": tipo, "data": f["properties"]["dt_ocorrencia"][:10],
                                     "distrito": D[i]["nome"]}))
# chamados de erosão (SP156 / Defesa Civil)
for f in load("sac_erosao_urgencia"):
    g = geom(f)
    if g.is_empty:
        continue
    i = district_of(g)
    s = stats[i]
    s["sac_erosao"] += 1
    s["raw_eros"] += 2
    p = f["properties"]
    oc_out.append(to_feature(g, {"tipo": "Erosão (chamado)", "data": (p["dt_abertura"] or "")[:10],
                                 "local": p["nm_logradouro"] or "", "distrito": D[i]["nome"]}))
# quedas de árvore (Defesa Civil, 2026): informativo, não entra nos índices geológicos
for f in load("risco_ocorrencia_queda_arvore"):
    g = geom(f)
    if g.is_empty:
        continue
    i = district_of(g)
    stats[i]["oc_queda_arvore"] += 1
    oc_out.append(to_feature(g, {"tipo": "Queda de árvore", "data": f["properties"]["dt_ocorrencia"][:10],
                                 "distrito": D[i]["nome"]}))
dump("ocorrencias.geojson", oc_out)

# --------------------- manchas de inundação e declividade (tools/rasters.py)
RAST = json.load(open(os.path.join(SRC, "stats_raster.json"), encoding="utf8"))
for i, d in enumerate(D):
    r = RAST[d["id"]]
    s = stats[i]
    s["pct_alaga_5"] = r["pct_alaga_5"]
    s["pct_alaga_25"] = r["pct_alaga_25"]
    s["pct_inundavel"] = r["pct_alaga_100"]
    s["pct_declive_25"] = r["pct_declive_25"]
    s["pct_declive_60"] = r["pct_declive_60"]
    s["raw_alag"] += r["pct_alaga_5"] * 1.0 + r["pct_alaga_100"] * 0.3
    s["raw_desl"] += r["pct_declive_25"] * 0.1
    s["raw_eros"] += r["pct_declive_25"] * 0.05
antigo = os.path.join(OUT, "area_inundavel.geojson")
if os.path.exists(antigo):
    os.remove(antigo)

# ------------------------------------------------ obras de drenagem
dren_out = []


def add_dren(g, props, chave):
    i = district_of(g)
    stats[i][chave] += 1
    props["distrito"] = D[i]["nome"]
    dren_out.append(to_feature(g, props, tol=0.00003))


for f in load("reservatorio_amortecimento"):
    p = f["properties"]
    vol = p.get("qt_volume_metro")
    add_dren(geom(f), {
        "nome": f"Reservatório {title(p['nm_reservatorio'] or '')} ({p['cd_reservatorio'] or 's/ código'})".strip(),
        "situacao": "Em operação", "tipo": "Reservatório (piscinão)",
        "detalhe": ", ".join(x for x in [
            f"capacidade de {int(float(vol)):,} m³".replace(",", ".") if vol not in (None, "None", "") else "",
            f"córrego {title(p['nm_corrego'])}" if p.get("nm_corrego") else "",
            f"construído em {p['an_construcao']}" if p.get("an_construcao") else ""] if x),
        "endereco": p.get("nm_endereco") or ""}, "dren_existente")
for f in load("plano_diretor_drenagem"):
    p = f["properties"]
    add_dren(geom(f), {
        "nome": p["nm_obra"], "situacao": "Planejada", "tipo": p.get("dc_tipo_obra") or "Obra de drenagem",
        "detalhe": ", ".join(x for x in [
            f"bacia {p['nm_bacia']}" if p.get("nm_bacia") else "",
            f"{int(float(p['qt_populacao_beneficiada'])):,} pessoas beneficiadas".replace(",", ".") if p.get("qt_populacao_beneficiada") not in (None, "", "-") and float(p["qt_populacao_beneficiada"]) > 0 else "",
            f"custo estimado {p['vl_instalacao']}" if p.get("vl_instalacao") else ""] if x),
        "endereco": "", "fonte": "Plano Diretor de Drenagem"}, "dren_planejada")
for f in load("obra_drenagem_planejada"):
    p = f["properties"]
    add_dren(geom(f), {"nome": p["nm_intervencao"], "situacao": "Planejada", "tipo": "Obra de drenagem",
                       "detalhe": f"bacia {p['nm_bacia']}" if p.get("nm_bacia") else "",
                       "endereco": p.get("nm_endereco") or "", "fonte": "Obras planejadas (PMSP)"}, "dren_planejada")
for f in load("pde_drenagem_acao_prioritaria_linear"):
    if not f["geometry"]:
        continue
    p = f["properties"]
    add_dren(geom(f), {"nome": p["nm_obra"], "situacao": "Planejada" if (p.get("tx_tipo_situacao_projeto") or "planej").lower().startswith("planej") else p["tx_tipo_situacao_projeto"].capitalize(),
                       "tipo": p.get("tx_tipo_intervencao") or "Obra de drenagem", "detalhe": "",
                       "endereco": "", "fonte": "Plano Diretor Estratégico"}, "dren_planejada")


def chave_obra(nome):
    import unicodedata
    n = unicodedata.normalize("NFD", nome or "").encode("ascii", "ignore").decode().lower()
    n = re.sub(r"\(.*?\)", "", n)
    return " ".join(n.replace("+", " ").split())


# remove obras planejadas que já constam como concluídas/em operação e duplicatas entre as fontes
em_operacao = {chave_obra(f["properties"]["nome"].replace("Reservatório ", "Reservatorio ")) for f in dren_out if f and f["properties"]["situacao"] == "Em operação"}
vistos = set()
dren_final = []
for f in dren_out:
    if not f:
        continue
    p = f["properties"]
    k = chave_obra(p["nome"])
    if p["situacao"] != "Em operação":
        if "conclu" in (p["nome"] or "").lower() or k in em_operacao or k in vistos:
            stats[[d["nome"] for d in D].index(p["distrito"])]["dren_planejada"] -= 1
            continue
        vistos.add(k)
    dren_final.append(f)
dump("drenagem.geojson", dren_final)

# ------------------------------------------------------------ aterros
aterro_out = []
for camada, tipo in (("aterro_sanitario", "Aterro sanitário"), ("aterro_rcc", "Aterro de entulho (RCC)")):
    for f in load(camada):
        p = f["properties"]
        g = geom(f)
        nome = p.get("nm_aterro_sanitario") or p.get("nm_aterro_rcc")
        situacao = p.get("tx_status_aterro_sanitario") or "Ativo"
        dentro = any(dd["g"].contains(g) for dd in D)
        if dentro:
            i = district_of(g)
            stats[i]["raw_cont"] += 3 if situacao == "Desativado" else 1
        aterro_out.append(to_feature(g, {"nome": " ".join(nome.split()), "tipo": tipo, "situacao": situacao,
                                         "endereco": p.get("nm_endereco") or "",
                                         "distrito": D[district_of(g)]["nome"] if dentro else "fora do município"}))
dump("aterros.geojson", aterro_out)

# ------------------------------------------------ sedes das subprefeituras
sub_geo = [(title(f["properties"]["nm_subprefeitura"]), geom(f)) for f in load("subprefeitura")]
sedes = {}
sede_out = []
for f in load("sede_subprefeitura"):
    p = f["properties"]
    g = geom(f)
    sub = next((n for n, sg in sub_geo if sg.contains(g)), None)
    if not sub:
        continue
    info = {"subprefeitura": sub, "endereco": title(p["tx_endereco_equipamento"] or ""),
            "bairro": title(p["nm_bairro_equipamento"] or ""), "cep": p.get("cd_cep_equipamento") or "",
            "telefone": f"(11) {p['tx_numero_telefone']}" if p.get("tx_numero_telefone") else "",
            "horario": (p.get("tx_horario_funcionamento") or "").replace("Seg a Sex", "Segunda a sexta")}
    sedes[sub] = info
    sede_out.append(to_feature(g, info))
dump("subprefeituras.geojson", sede_out)

# --------------------------------------------- vulnerabilidade social (IPVS)
pop = [Counter() for _ in D]
for f in load("indice_paulista_vulnerabilidadesocial"):
    p = f["properties"]
    if not f["geometry"] or p.get("cd_indice_vulnerabilidade_social") is None:
        continue
    i = district_of(geom(f))
    pop[i][int(p["cd_indice_vulnerabilidade_social"])] += int(p.get("qt_populacao") or 0)
for i in range(len(D)):
    tot = sum(pop[i].values()) or 1
    stats[i]["populacao"] = sum(pop[i].values())
    stats[i]["pop_vulneravel"] = pop[i][5] + pop[i][6]
    stats[i]["pct_vulneravel"] = round(100 * (pop[i][5] + pop[i][6]) / tot, 1)

# ------------------------------------------------------- carta geotécnica
REL_PLANO = {
    "Planícies e terraços baixos": ("Planície de rio", "Terreno baixo e plano, perto de rios e córregos. Sujeito a enchentes, lençol freático raso e solo mole (pode afundar/recalcar)."),
    "Terraços altos": ("Terraço", "Terreno plano um pouco acima das várzeas. Risco de enchente menor, mas pode alagar em chuvas fortes."),
    "Colinas": ("Colina", "Relevo suave, com morros baixos e arredondados. Em geral bom para construir; atenção a cortes e aterros mal feitos."),
    "Morrotes baixos": ("Morrote baixo", "Relevo ondulado com encostas moderadas. Cortes no terreno podem provocar pequenos deslizamentos e erosão."),
    "Morrotes": ("Morrote", "Relevo ondulado com encostas inclinadas. Atenção a deslizamentos e erosão em cortes, aterros e ocupações sem drenagem."),
    "Morrotes altos": ("Morrote alto", "Encostas inclinadas. Potencial importante para deslizamentos e erosão quando ocupadas sem obras adequadas."),
    "Morros baixos": ("Morro baixo", "Encostas íngremes. Alta suscetibilidade a deslizamentos, especialmente após chuvas fortes."),
    "Morros altos": ("Morro alto", "Encostas muito íngremes. Muito suscetível a deslizamentos e queda de blocos; ocupação exige cuidados técnicos."),
    "Serras": ("Serra", "Relevo montanhoso, muito íngreme (extremo sul). Áreas de proteção ambiental com alto potencial de deslizamentos."),
}
SUSC = {"Planícies e terraços baixos": 3, "Terraços altos": 1, "Colinas": 1, "Morrotes baixos": 2,
        "Morrotes": 2, "Morrotes altos": 3, "Morros baixos": 3, "Morros altos": 4, "Serras": 4}
carta_out = []
carta_geoms = []
for f in load("carta_geotecnica"):
    p = f["properties"]
    g = geom(f)
    rel = p["tx_tipo_relevo"]
    nome, leigo = REL_PLANO.get(rel, (rel, ""))
    props = {"unidade": p["tx_unidade_geotecnica"], "relevo": rel, "rocha": p["tx_tipo_rocha"],
             "tipo": nome, "explicacao": leigo, "susc": SUSC.get(rel, 2),
             "aptidao": p["tx_aptidao_geotecnica_urbanizacao"]}
    carta_geoms.append((g, props))
    carta_out.append(to_feature(g, props, tol=0.0004, nd=4))
dump("carta_geotecnica.geojson", carta_out)
for i, d in enumerate(D):
    areas = Counter()
    for g, props in carta_geoms:
        if g.envelope.intersects(d["g"].envelope):
            a = g.intersection(d["g"]).area
            if a:
                areas[props["tipo"]] += a
    tot = sum(areas.values()) or 1
    stats[i]["terreno_predominante"] = areas.most_common(1)[0][0] if areas else "não identificado"
    stats[i]["pct_encosta"] = round(100 * sum(v for k, v in areas.items()
                                              if k in ("Morro baixo", "Morro alto", "Serra", "Morrote alto")) / tot, 1)
    stats[i]["pct_planicie"] = round(100 * areas.get("Planície de rio", 0) / tot, 1)
    stats[i]["raw_desl"] += stats[i]["pct_encosta"] * 0.1
    stats[i]["raw_eros"] += stats[i]["pct_encosta"] * 0.1

# --------------------------------------------------------- índices de 0 a 100
def scale(key):
    mx = max(s[key] for s in stats) or 1
    return [round(100 * math.log1p(s[key]) / math.log1p(mx)) for s in stats]


idx = {k: scale("raw_" + k) for k in ("desl", "alag", "eros", "cont")}
W = {"desl": 0.30, "alag": 0.30, "eros": 0.20, "cont": 0.20}


def nivel(v):
    return "Muito alto" if v >= 65 else "Alto" if v >= 50 else "Moderado" if v >= 35 else "Baixo"


INT_KEYS = ["geo_R1", "geo_R2", "geo_R3", "geo_R4", "geo_total", "hid_R1", "hid_R2", "hid_R3",
            "hid_R4", "hid_total", "moradias_geo", "moradias_hid", "moradias_alto",
            "setores_escorregamento", "setores_solapamento", "cont_contaminada",
            "cont_investigacao", "cont_monitoramento", "cont_reabilitada", "cont_total",
            "oc_total", "oc_alagamento", "oc_inundacao", "oc_deslizamento", "sac_erosao",
            "oc_queda_arvore", "dren_existente", "dren_planejada", "populacao", "pop_vulneravel"]
dist_out = []
resumo = []
for i, d in enumerate(D):
    s = stats[i]
    rec = {k: d[k] for k in ("id", "nome", "subprefeitura", "regiao", "regiao8", "area_km2")}
    for k in INT_KEYS:
        rec[k] = int(s.get(k, 0))
    for k in ("pct_inundavel", "pct_alaga_5", "pct_alaga_25", "pct_declive_25", "pct_declive_60", "pct_vulneravel"):
        rec[k] = s[k]
    sede = sedes.get(d["subprefeitura"], {})
    rec["sede_endereco"] = ", ".join(x for x in [sede.get("endereco"), sede.get("bairro"), f"CEP {sede['cep']}" if sede.get("cep") else ""] if x)
    rec["sede_telefone"] = sede.get("telefone", "")
    rec["sede_horario"] = sede.get("horario", "")
    rec["pct_encosta"] = s["pct_encosta"]
    rec["pct_planicie"] = s["pct_planicie"]
    rec["terreno_predominante"] = s["terreno_predominante"]
    rec["idx_deslizamento"] = idx["desl"][i]
    rec["idx_alagamento"] = idx["alag"][i]
    rec["idx_erosao"] = idx["eros"][i]
    rec["idx_contaminacao"] = idx["cont"][i]
    geral = round(sum(idx[k][i] * w for k, w in W.items()))
    rec["idx_geral"] = geral
    rec["nivel"] = nivel(geral)
    resumo.append(rec)
    dist_out.append(to_feature(d["g"], rec, tol=0.0002, nd=5))
resumo.sort(key=lambda r: -r["idx_geral"])
for pos, r in enumerate(resumo, 1):
    r["ranking"] = pos
rank = {r["id"]: r["ranking"] for r in resumo}
for f in dist_out:
    f["properties"]["ranking"] = rank[f["properties"]["id"]]
dump("distritos.geojson", dist_out)
with open(os.path.join(OUT, "resumo.json"), "w", encoding="utf8") as fh:
    json.dump({"atualizado_em": "2026-11-12", "distritos": resumo}, fh, ensure_ascii=False, indent=0)
print("Níveis:", Counter(r["nivel"] for r in resumo))
print("Top 10:", [(r["nome"], r["idx_geral"]) for r in resumo[:10]])
print("Últimos 5:", [(r["nome"], r["idx_geral"]) for r in resumo[-5:]])
