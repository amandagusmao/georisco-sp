# GeoRisco SP

**Mapa gratuito de riscos geológicos, hidrológicos e ambientais da cidade de São Paulo, feito para qualquer pessoa entender.**

**Acesse:** https://amandagusmao.github.io/georisco-sp/

Digite seu endereço ou CEP e descubra, em linguagem simples, se o local está em área de risco de:

- **Alagamento e inundação**
- **Deslizamento de terra** (escorregamento)
- **Erosão e solapamento** de margens de córregos
- **Solo contaminado**

## Funcionalidades

| Recurso | Descrição |
|---|---|
| **Consulta por endereço ou CEP** | Indica a zona do endereço (Verde, Amarela, Laranja, Vermelha ou Crítica), o tipo de zona (setor de risco mapeado, várzea, encosta, margem de córrego etc.) e o nível de cada risco, com explicação e orientações. Mostra também a frequência de inundação (5, 25 ou 100 anos), a inclinação do terreno, o córrego mais próximo, aterros, piscinões e obras de drenagem por perto e o contato da subprefeitura. |
| **Exportação** | Relatório do endereço e dados do painel em **PDF** e **Excel (.xlsx)**. |
| **Mapa interativo** | Setores de risco R1 a R4, manchas de inundação, inclinação do terreno, córregos e rios, áreas contaminadas, aterros, piscinões e obras de drenagem, ocorrências de 2026, carta geotécnica e sedes das subprefeituras. Clique em qualquer ponto para analisá-lo. |
| **Painel por região e distrito** | Indicadores e gráficos das 5 regiões, 32 subprefeituras e 96 distritos, com ranking, índice comparativo de 0 a 100, vulnerabilidade social (IPVS) e obras de drenagem. |
| **Chuva e alerta** | Previsão de 7 dias e chuva acumulada (Open-Meteo), com nível de alerta. |
| **Entenda os riscos** | Explicações para leigos, sinais de alerta, o que fazer antes, durante e depois, kit de emergência e contatos (199, 193, 192, 156, SMS 40199). |
| **Vai comprar ou alugar?** | Roteiro do que verificar antes de fechar negócio. |
| **Material de divulgação** | Cartaz A4, folheto A5 e imagem para WhatsApp com QR Code (pasta `assets/divulgacao`). |
| **Link compartilhável** | Cada consulta gera um link que pode ser enviado por mensagem. |

## Dados (todos públicos e gratuitos)

- [GeoSampa, Prefeitura de São Paulo](https://geosampa.prefeitura.sp.gov.br/): áreas de risco geológico (IPT e PMSP), áreas de risco hidrológico, manchas de inundação (TR 5, 25 e 100 anos), declividade, rede de drenagem (córregos e rios), áreas contaminadas e reabilitadas (SVMA), aterros sanitários e de entulho, reservatórios de amortecimento, Plano Diretor de Drenagem e obras planejadas, ocorrências da Defesa Civil (SIGRC) de 2026, chamados de erosão (SP156), Carta Geotécnica de Aptidão à Urbanização, Índice Paulista de Vulnerabilidade Social (Seade, Censo 2022), distritos, subprefeituras e suas sedes.
- Endereços: OpenStreetMap/Nominatim e ViaCEP. Mapa base: OpenStreetMap. Chuva: Open-Meteo.

## Tecnologia

Site 100% estático (HTML, CSS e JavaScript), hospedado gratuitamente no GitHub Pages:
[Leaflet](https://leafletjs.com/) (mapas), [Turf.js](https://turfjs.org/) (análise espacial no navegador), [Chart.js](https://www.chartjs.org/) (gráficos), [SheetJS](https://sheetjs.com/) (Excel), [jsPDF](https://github.com/parallax/jsPDF) e AutoTable (PDF).

```
index.html          página única (SPA com rotas por #hash)
css/style.css       estilos
js/app.js           rotas, busca e resultado da consulta
js/analise.js       motor de análise de risco do ponto
js/mapa.js          mapa interativo e mini-mapa
js/painel.js        painéis por região e distrito
js/chuva.js         previsão de chuva e alerta
js/exportar.js      exportação PDF e Excel
js/geocode.js       endereço ou CEP para coordenadas
js/raster.js        consulta às manchas de inundação e à declividade
js/corregos.js      consulta aos córregos (blocos de ~3 km)
data/               camadas simplificadas, rasters, córregos e resumo por distrito
assets/divulgacao/  cartaz, folheto, imagem e QR Code
tools/              scripts Python para baixar e processar os dados
```

### Atualizar os dados

```bash
pip install shapely numpy pillow qrcode
python tools/baixar_dados.py dados_brutos
python tools/rasters.py dados_brutos data
python tools/corregos.py dados_brutos data
python tools/preprocess.py dados_brutos data
python tools/divulgacao.py   # opcional: refaz cartaz, folheto e imagem
```

### Rodar localmente

```bash
python -m http.server 8000
```

Depois abra http://localhost:8000 no navegador.

## Metodologia (resumo)

- **Endereço:** nível de 0 a 4 por risco. Dentro de setor mapeado, segue o grau oficial (R1 a R4). Proximidade de até 150 m de setor R3 ou R4, manchas de inundação, inclinação do terreno, córrego a até 30 m, aterros, tipo de terreno (várzea, morros) e ocorrências de 2026 num raio de 500 m elevam o nível. A zona é o maior nível encontrado.
- **Distrito:** índice comparativo de 0 a 100 (escala logarítmica) que combina setores de risco ponderados pelo grau (R1=1, R2=2, R3=4, R4=8), ocorrências, chamados de erosão, porcentagem da área que alaga a cada 5 e 100 anos, porcentagem de encostas e de terreno acima de 25% de inclinação, áreas contaminadas e aterros. Geral = 30% deslizamento + 30% alagamento + 20% erosão + 20% contaminação.

> **Aviso:** ferramenta informativa e educativa. Não substitui vistoria da Defesa Civil, laudo técnico de profissional habilitado nem alertas oficiais. Em caso de perigo, ligue **199**.

## Créditos

Projeto de Extensão II, CST em Análise e Desenvolvimento de Sistemas.
Desenvolvimento: **João Batista de Gusmão Neto**.
Organização parceira e orientação técnica: **Eng.ª Ambiental Amanda Ferreira Gusmão** (CREA-SP 5070209182).

Licença: MIT (código). Os dados pertencem às respectivas fontes públicas.
