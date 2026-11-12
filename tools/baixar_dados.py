"""
Baixa as camadas abertas do GeoSampa (WFS da Prefeitura de São Paulo) em GeoJSON.

Uso:  python tools/baixar_dados.py <pasta_destino>
Depois rode:  python tools/rasters.py <pasta_destino> data
        e  python tools/preprocess.py <pasta_destino> data
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
    "carta_geotecnica", "declividade", "reservatorio_amortecimento", "plano_diretor_drenagem",
    "obra_drenagem_planejada", "pde_drenagem_acao_prioritaria_linear", "aterro_sanitario", "aterro_rcc",
    "sede_subprefeitura", "indice_paulista_vulnerabilidadesocial", "risco_ocorrencia_queda_arvore",
]
# As manchas de inundação (5, 25 e 100 anos) são baixadas como imagem pelo tools/rasters.py.

destino = sys.argv[1] if len(sys.argv) > 1 else "dados_brutos"
os.makedirs(destino, exist_ok=True)
for c in CAMADAS:
    caminho = os.path.join(destino, c + ".json")
    print("Baixando", c, "...")
    urllib.request.urlretrieve(BASE + c, caminho)
    print("  ", os.path.getsize(caminho) // 1024, "KB")
