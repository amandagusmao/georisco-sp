"""
Baixa as camadas abertas do GeoSampa (WFS da Prefeitura de São Paulo) em GeoJSON.

Uso:  python tools/baixar_dados.py <pasta_destino>
Depois rode:  python tools/preprocess.py <pasta_destino> data
"""
import os
import sys
import urllib.request

BASE = ("http://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0"
        "&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:")
CAMADAS = [
    "distrito_municipal", "subprefeitura", "area_risco_geologico", "risco_hidrologico",
    "area_contaminada_reabilitada_svma", "risco_ocorrencia_alagamento",
    "risco_ocorrencia_inundacao", "risco_ocorrencia_deslizamento", "sac_erosao_urgencia",
    "area_inundavel", "carta_geotecnica",
]

destino = sys.argv[1] if len(sys.argv) > 1 else "dados_brutos"
os.makedirs(destino, exist_ok=True)
for c in CAMADAS:
    caminho = os.path.join(destino, c + ".json")
    print("Baixando", c, "...")
    urllib.request.urlretrieve(BASE + c, caminho)
    print("  ", os.path.getsize(caminho) // 1024, "KB")
