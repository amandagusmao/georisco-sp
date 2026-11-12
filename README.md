# GeoRisco SP 🗺️

**Mapa gratuito de riscos geológicos, hidrológicos e ambientais da cidade de São Paulo, feito para qualquer pessoa entender.**

🔗 **Acesse:** https://amandagusmao.github.io/georisco-sp/

Digite seu endereço ou CEP e descubra, em linguagem simples, se o local está em área de risco de:

- 🌊 **Alagamento e inundação**
- ⛰️ **Deslizamento de terra** (escorregamento)
- 🕳️ **Erosão e solapamento** de margens de córregos
- ☣️ **Solo contaminado**

## Funcionalidades

| Recurso | Descrição |
|---|---|
| **Consulta por endereço/CEP** | Indica a *zona* do endereço (Verde, Amarela, Laranja, Vermelha ou Roxa), o *tipo de zona* (setor de risco mapeado, várzea, encosta…), o tipo de terreno e o nível de cada risco, com explicação e o que fazer. |
| **Exportação** | Relatório do endereço e dados do painel em **PDF** e **Excel (.xlsx)**. |
| **Mapa interativo** | Setores de risco R1–R4, área inundável, áreas contaminadas, ocorrências de 2026 e carta geotécnica. Clique em qualquer ponto para analisá-lo. |
| **Painel por região e distrito** | Indicadores e gráficos das 5 regiões, 32 subprefeituras e 96 distritos, com ranking e índice comparativo de 0 a 100. |
| **Chuva agora** | Previsão de 7 dias e chuva acumulada (Open-Meteo), com nível de alerta. |
| **Entenda os riscos** | Explicações para leigos, sinais de alerta, o que fazer antes/durante/depois, kit de emergência e contatos (199, 193, 192, 156, SMS 40199). |
| **Link compartilhável** | Cada consulta gera um link que pode ser enviado pelo WhatsApp. |

## Dados (todos públicos e gratuitos)

- [GeoSampa – Prefeitura de São Paulo](https://geosampa.prefeitura.sp.gov.br/): áreas de risco geológico (IPT/PMSP), áreas de risco hidrológico, área inundável (TR 100 anos), áreas contaminadas e reabilitadas (SVMA), ocorrências da Defesa Civil (SIGRC) de 2026, chamados de erosão (SP156), Carta Geotécnica de Aptidão à Urbanização, distritos e subprefeituras.
- Endereços: OpenStreetMap/Nominatim e ViaCEP. Mapa base: OpenStreetMap. Chuva: Open-Meteo.

## Tecnologia

Site 100% estático (HTML, CSS e JavaScript), hospedado gratuitamente no GitHub Pages:
[Leaflet](https://leafletjs.com/) (mapas), [Turf.js](https://turfjs.org/) (análise espacial no navegador), [Chart.js](https://www.chartjs.org/) (gráficos), [SheetJS](https://sheetjs.com/) (Excel), [jsPDF](https://github.com/parallax/jsPDF) + AutoTable (PDF).

```
index.html          página única (SPA com rotas por #hash)
css/style.css       estilos
js/app.js           rotas, busca e resultado da consulta
js/analise.js       motor de análise de risco do ponto
js/mapa.js          mapa interativo e mini-mapa
js/painel.js        dashboards por região/distrito
js/chuva.js         previsão de chuva e alerta
js/exportar.js      exportação PDF/Excel
js/geocode.js       endereço/CEP → coordenadas
data/               camadas simplificadas + resumo por distrito
tools/              scripts Python para baixar e processar os dados
```

### Atualizar os dados

```bash
pip install shapely
python tools/baixar_dados.py dados_brutos
python tools/preprocess.py dados_brutos data
```

### Rodar localmente

```bash
python -m http.server 8000
# abra http://localhost:8000
```

## Metodologia (resumo)

- **Endereço:** nível 0–4 por risco. Dentro de setor mapeado → segue o grau oficial (R1–R4); até 150 m de setor R3/R4, dentro da área inundável, tipo de terreno (várzea, morros) e ocorrências de 2026 num raio de 500 m elevam o nível. A zona é o maior nível encontrado.
- **Distrito:** índice comparativo 0–100 (escala logarítmica) combinando setores de risco ponderados pelo grau (R1=1, R2=2, R3=4, R4=8), ocorrências, chamados de erosão, % de área inundável, % de encostas e áreas contaminadas. Geral = 30% deslizamento + 30% alagamento + 20% erosão + 20% contaminação.

> ⚠️ Ferramenta **informativa e educativa**. Não substitui vistoria da Defesa Civil, laudo técnico de profissional habilitado nem alertas oficiais. Em caso de perigo ligue **199**.

## Créditos

Projeto de Extensão II – CST em Análise e Desenvolvimento de Sistemas.
Desenvolvimento: **João Batista de Gusmão Neto**.
Organização parceira e orientação técnica: **Eng.ª Ambiental Amanda Ferreira Gusmão** (CREA-SP 5070209182).

Licença: MIT (código). Os dados pertencem às respectivas fontes públicas.
