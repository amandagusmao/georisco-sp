// Mapa interativo (Leaflet) e mini-mapa do resultado.
const VERSAO = 4;
import {
  carregar, corIndice, NIVEL_DISTRITO, COR_GRAU_GEO, COR_GRAU_HID, COR_CONT,
  COR_OCORR, COR_SUSC, COR_INUND, COR_DREN, COR_ATERRO, esc, fmt, dataBR,
} from "./dados.js?v=4";
import { limitesRaster } from "./raster.js?v=4";
import { blocosNaArea, blocoCorregos, TIPO_CORREGO, COR_CORREGO, nomeCorrego } from "./corregos.js?v=4";

const CENTRO = [-23.62, -46.62];
const BASE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BASE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Dados: <a href="https://geosampa.prefeitura.sp.gov.br/">GeoSampa/PMSP</a>';

const NOMES_INDICE = {
  idx_geral: "Índice geral de risco", idx_deslizamento: "Deslizamento de terra",
  idx_alagamento: "Alagamento e inundação", idx_erosao: "Erosão e solapamento", idx_contaminacao: "Solo contaminado",
  pct_vulneravel: "População em alta vulnerabilidade social",
};

// cores e faixas da vulnerabilidade social (% da população nos grupos 5 e 6 do IPVS)
export function corVulneravel(v) {
  return v >= 40 ? NIVEL_DISTRITO["Muito alto"] : v >= 25 ? NIVEL_DISTRITO["Alto"] : v >= 10 ? NIVEL_DISTRITO["Moderado"] : NIVEL_DISTRITO["Baixo"];
}
const corDistrito = (k, v) => (k === "pct_vulneravel" ? corVulneravel(v) : corIndice(v));

export const popups = {
  geo: (p) => `<h4>${esc(p.nome)}</h4>Risco geológico <b>${p.grau}</b>, ${esc(p.processo)}<br>Setor ${esc(p.setor)} · ${esc(p.distrito)}<br>Moradias no setor: <b>${fmt(p.moradias)}</b><br><small>Vistoria: ${dataBR(p.vistoria)}</small>`,
  hid: (p) => `<h4>${esc(p.nome)}</h4>Risco hidrológico <b>${p.grau}</b>, ${esc(p.processo)}<br>Bacia: ${esc(p.bacia)} · ${esc(p.distrito)}<br>Moradias no setor: <b>${fmt(p.moradias)}</b><br><small>Vistoria: ${dataBR(p.vistoria)}</small>`,
  cont: (p) => `<h4>Área ${esc(p.classe.toLowerCase())}</h4>${esc(p.endereco)}<br>Contaminantes: ${esc(p.contaminantes)}<br>Uso anterior: ${esc(p.uso_anterior || "não informado")}<br><small>Fonte: SVMA/PMSP</small>`,
  oc: (p) => `<h4>${esc(p.tipo)}</h4>Data: ${dataBR(p.data)}${p.local ? `<br>${esc(p.local)}` : ""}<br>${esc(p.distrito)}`,
  carta: (p) => `<h4>Terreno: ${esc(p.tipo)}</h4>${esc(p.explicacao)}<br><small>Unidade ${esc(p.unidade)} · ${esc(p.relevo)} · ${esc(p.rocha)}</small>`,
  dren: (p) => `<h4>${esc(p.nome)}</h4><b>${esc(p.situacao)}</b> · ${esc(p.tipo)}${p.detalhe ? `<br>${esc(p.detalhe)}` : ""}${p.endereco ? `<br>${esc(p.endereco)}` : ""}<br><small>${esc(p.fonte || "Reservatórios de amortecimento (PMSP)")} · ${esc(p.distrito)}</small>`,
  aterro: (p) => `<h4>${esc(p.nome)}</h4>${esc(p.tipo)} · <b>${p.situacao === "Desativado" ? "desativado" : "em operação"}</b><br>${esc(p.endereco)}<br><small>${p.situacao === "Desativado" ? "Antigos aterros podem liberar gás metano e sofrer recalque por décadas." : "Pode haver odor, gases e tráfego de caminhões nas proximidades."}</small>`,
  corr: (p) => `<h4>${esc(nomeCorrego(p))}</h4>${esc(TIPO_CORREGO[p.t].charAt(0).toUpperCase() + TIPO_CORREGO[p.t].slice(1))}${p.v ? `<br>Próximo a ${esc(p.v)}` : ""}<br><small>Fonte: rede de drenagem, GeoSampa</small>`,
  sede: (p) => `<h4>Subprefeitura ${esc(p.subprefeitura)}</h4>${esc(p.endereco)}, ${esc(p.bairro)}<br>CEP ${esc(p.cep)}<br>Telefone: <b>${esc(p.telefone)}</b><br><small>${esc(p.horario)}</small>`,
};

export const estilos = {
  geo: (f) => ({ color: COR_GRAU_GEO[f.properties.grau], weight: 1, fillColor: COR_GRAU_GEO[f.properties.grau], fillOpacity: 0.55 }),
  hid: (f) => ({ color: COR_GRAU_HID[f.properties.grau], weight: 1, fillColor: COR_GRAU_HID[f.properties.grau], fillOpacity: 0.5 }),
  cont: (f) => ({ color: COR_CONT[f.properties.classe] || "#555", weight: 1.5, fillColor: COR_CONT[f.properties.classe] || "#555", fillOpacity: 0.6 }),
  carta: (f) => ({ color: "#0b0f0e", weight: 0.4, fillColor: COR_SUSC[f.properties.susc], fillOpacity: 0.55 }),
  corr: (f) => ({ color: COR_CORREGO[f.properties.t], weight: f.properties.t === "s" ? 2 : 3, opacity: 0.95, dashArray: f.properties.t === "s" ? "4 5" : null }),
  dren: (f) => ({ color: COR_DREN[f.properties.situacao] || "#a3e635", weight: 3, fillColor: COR_DREN[f.properties.situacao] || "#a3e635", fillOpacity: 0.55, dashArray: f.properties.situacao === "Em operação" ? null : "5 4" }),
};

const pontos = {
  oc: (p) => ({ radius: 5, fillColor: COR_OCORR[p.tipo] }),
  aterro: (p) => ({ radius: 8, fillColor: COR_ATERRO[p.situacao] || "#f59e0b" }),
  sede: () => ({ radius: 7, fillColor: "#e9f1ed" }),
};

const CAMADAS = [
  { id: "geo", nome: "Risco de deslizamento e solapamento", arquivo: "risco_geologico.geojson", cor: "#dc3c3c", ativo: true, pane: "risco" },
  { id: "hid", nome: "Risco de alagamento e inundação", arquivo: "risco_hidrologico.geojson", cor: "#22d3ee", ativo: true, pane: "risco" },
  { id: "inund", nome: "Manchas de inundação (5, 25 e 100 anos)", imagem: `data/raster/inundacao.png?v=${VERSAO}`, cor: "#3b82f6", ativo: false, pane: "fundo2" },
  { id: "decl", nome: "Inclinação forte do terreno", imagem: `data/raster/declividade.png?v=${VERSAO}`, cor: "#d9a441", ativo: false, pane: "fundo1" },
  { id: "cont", nome: "Áreas contaminadas", arquivo: "areas_contaminadas.geojson", cor: "#c2410c", ativo: false, pane: "risco" },
  { id: "aterro", nome: "Aterros sanitários e de entulho", arquivo: "aterros.geojson", cor: "#f59e0b", ativo: false, pane: "pontos" },
  { id: "dren", nome: "Piscinões e obras de drenagem", arquivo: "drenagem.geojson", cor: "#22c55e", ativo: false, pane: "risco" },
  { id: "corr", nome: "Córregos e rios", imagem: `data/raster/corregos.png?v=${VERSAO}`, cor: "#38bdf8", ativo: false, pane: "fundo2" },
  { id: "oc", nome: "Ocorrências 2026 (inclui queda de árvore)", arquivo: "ocorrencias.geojson", cor: "#e3c443", ativo: false, pane: "pontos" },
  { id: "carta", nome: "Tipo de terreno (carta geotécnica)", arquivo: "carta_geotecnica.geojson", cor: "#4d7c0f", ativo: false, pane: "fundo1" },
  { id: "sede", nome: "Sedes das subprefeituras", arquivo: "subprefeituras.geojson", cor: "#e9f1ed", ativo: false, pane: "pontos" },
];

function criarPanes(map) {
  [["distritos", 300], ["fundo1", 320], ["fundo2", 340], ["risco", 420], ["pontos", 460]].forEach(([n, z]) => {
    map.createPane(n).style.zIndex = z;
  });
}

function camadaGeoJSON(def, dados, renderers) {
  const opts = {
    pane: def.pane,
    renderer: renderers[def.pane],
    bubblingMouseEvents: false,
    onEachFeature: (f, l) => l.bindPopup(popups[def.id](f.properties), { maxWidth: 300 }),
  };
  if (pontos[def.id]) {
    opts.pointToLayer = (f, ll) => L.circleMarker(ll, {
      color: "#050807", weight: 1.5, fillOpacity: 0.95, ...pontos[def.id](f.properties),
      pane: def.pane, renderer: renderers[def.pane], bubblingMouseEvents: false,
    });
  } else {
    opts.style = estilos[def.id];
  }
  return L.geoJSON(dados, opts);
}

let mapa, distritosLayer, indiceAtual = "idx_geral", marcador, renderersGlobais;
const ativas = {};

export function mapaPrincipal() { return mapa; }

export async function iniciarMapa({ onAnalisar, onDistrito }) {
  if (mapa) { setTimeout(() => mapa.invalidateSize(), 50); return mapa; }
  mapa = L.map("mapa-leaflet", { zoomControl: true, minZoom: 9, maxZoom: 19 }).setView(CENTRO, 11);
  mapa.getContainer().classList.add("mapa-escuro");
  L.tileLayer(BASE_URL, { attribution: BASE_ATTR, maxZoom: 19 }).addTo(mapa);
  criarPanes(mapa);
  const renderers = {};
  ["distritos", "fundo1", "fundo2", "risco", "pontos"].forEach((p) => (renderers[p] = L.canvas({ pane: p, tolerance: 3 })));
  renderersGlobais = renderers;
  L.control.scale({ imperial: false }).addTo(mapa);

  // distritos (coroplético)
  const dist = await carregar("distritos.geojson");
  distritosLayer = L.geoJSON(dist, { pane: "distritos", renderer: renderers.distritos, interactive: false, style: estiloDistrito }).addTo(mapa);
  const rotulos = L.layerGroup();
  dist.features.forEach((f) => {
    const c = turf.pointOnFeature(f).geometry.coordinates;
    L.marker([c[1], c[0]], { interactive: false, icon: L.divIcon({ className: "rot-distrito", html: esc(f.properties.nome), iconSize: null }) }).addTo(rotulos);
  });
  const atualizarRotulos = () => (mapa.getZoom() >= 13 ? rotulos.addTo(mapa) : rotulos.remove());
  mapa.on("zoomend", atualizarRotulos);
  mapa.on("moveend", atualizarCorregos);

  // painel de camadas
  const box = document.getElementById("camadas");
  box.innerHTML = CAMADAS.map((c) => `<label><input type="checkbox" data-camada="${c.id}" ${c.ativo ? "checked" : ""}><span class="amostra" style="background:${c.cor}"></span>${c.nome}</label>`).join("");
  box.addEventListener("change", (e) => {
    const id = e.target.dataset.camada;
    if (id) alternar(id, e.target.checked);
  });
  for (const c of CAMADAS) if (c.ativo) alternar(c.id, true);

  document.getElementById("indice-mapa").addEventListener("change", (e) => {
    indiceAtual = e.target.value;
    distritosLayer.setStyle(estiloDistrito);
    legenda();
  });
  legenda();

  // clique em qualquer ponto
  mapa.on("click", (e) => {
    const { lat, lng } = e.latlng;
    const pt = turf.point([lng, lat]);
    const d = dist.features.find((f) => turf.booleanPointInPolygon(pt, f));
    if (!d) {
      L.popup().setLatLng(e.latlng).setContent("Fora do município de São Paulo.").openOn(mapa);
      return;
    }
    const p = d.properties;
    const div = document.createElement("div");
    div.innerHTML = `<h4>${esc(p.nome)}</h4>Subprefeitura ${esc(p.subprefeitura)} · Região ${esc(p.regiao)}<br>Índice geral: <b>${p.idx_geral}</b> (${p.nivel}) · ${p.ranking}º de 96
      <button class="btn btn-pri popup-btn" data-a>Analisar este ponto</button>
      <button class="btn btn-sec popup-btn" data-d>Ver painel do distrito</button>`;
    div.querySelector("[data-a]").onclick = () => onAnalisar(lat, lng);
    div.querySelector("[data-d]").onclick = () => onDistrito(p.id);
    L.popup().setLatLng(e.latlng).setContent(div).openOn(mapa);
  });
  setTimeout(() => mapa.invalidateSize(), 50);
  return mapa;
}

// córregos: imagem leve com o mapa afastado e traçado real (por blocos) a partir do zoom 15
let corrVetor, corrCarregados = new Set();
async function atualizarCorregos() {
  const ligado = document.querySelector('[data-camada="corr"]')?.checked;
  if (!ligado) return;
  const perto = mapa.getZoom() >= 15;
  if (!perto) { corrVetor?.remove(); ativas.corr?.addTo(mapa); return; }
  ativas.corr?.remove();
  if (!corrVetor) corrVetor = L.geoJSON(null, { pane: "fundo2", renderer: renderersGlobais.fundo2, style: estilos.corr, bubblingMouseEvents: false, onEachFeature: (f, l) => l.bindPopup(popups.corr(f.properties)) });
  corrVetor.addTo(mapa);
  const b = mapa.getBounds();
  const chaves = await blocosNaArea(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
  for (const k of chaves) {
    if (corrCarregados.has(k)) continue;
    corrCarregados.add(k);
    try { corrVetor.addData(await blocoCorregos(k)); } catch { corrCarregados.delete(k); }
  }
}

async function alternar(id, ligar) {
  const def = CAMADAS.find((c) => c.id === id);
  if (!ligar) { ativas[id]?.remove(); if (id === "corr") corrVetor?.remove(); legenda(); return; }
  if (!ativas[id]) {
    try {
      if (def.imagem) {
        ativas[id] = L.imageOverlay(def.imagem, await limitesRaster(), { pane: def.pane, interactive: false, className: "raster-nitido" });
      } else {
        ativas[id] = camadaGeoJSON(def, await carregar(def.arquivo), renderersGlobais);
      }
    } catch (e) { console.error(e); return; }
  }
  const chk = document.querySelector(`[data-camada="${id}"]`);
  if (chk?.checked) {
    if (id === "corr") atualizarCorregos(); else ativas[id].addTo(mapa);
  }
  legenda();
}

function estiloDistrito(f) {
  if (indiceAtual === "nenhum") return { color: "#6f837a", weight: 1, fillOpacity: 0, opacity: 0.6 };
  return { color: "#0b0f0e", weight: 1, opacity: 0.9, fillColor: corDistrito(indiceAtual, f.properties[indiceAtual]), fillOpacity: 0.38 };
}

function legenda() {
  const el = document.getElementById("legenda");
  const linha = (cor, txt) => `<div class="linha"><span class="cx" style="background:${cor}"></span>${txt}</div>`;
  const GRAUS = { R1: "baixo", R2: "médio", R3: "alto", R4: "muito alto" };
  let h = "";
  if (indiceAtual === "pct_vulneravel") {
    h += `<h4>Distritos: ${NOMES_INDICE[indiceAtual]}</h4>`;
    h += [["Baixo", "menos de 10%"], ["Moderado", "10% a 24%"], ["Alto", "25% a 39%"], ["Muito alto", "40% ou mais"]].map(([n, f]) => linha(NIVEL_DISTRITO[n], f)).join("");
  } else if (indiceAtual !== "nenhum") {
    h += `<h4>Distritos: ${NOMES_INDICE[indiceAtual]}</h4>`;
    h += [["Baixo", "0 a 34"], ["Moderado", "35 a 49"], ["Alto", "50 a 64"], ["Muito alto", "65 a 100"]].map(([n, f]) => linha(NIVEL_DISTRITO[n], `${n} (${f})`)).join("");
  }
  const on = (id) => document.querySelector(`[data-camada="${id}"]`)?.checked;
  if (on("geo")) h += "<h4>Risco de deslizamento e solapamento</h4>" + Object.entries(COR_GRAU_GEO).map(([g, c]) => linha(c, `${g} (${GRAUS[g]})`)).join("");
  if (on("hid")) h += "<h4>Risco de alagamento e inundação</h4>" + Object.entries(COR_GRAU_HID).map(([g, c]) => linha(c, `${g} (${GRAUS[g]})`)).join("");
  if (on("inund")) h += "<h4>Manchas de inundação</h4>" + linha(COR_INUND[1], "Alaga a cada 5 anos, em média") + linha(COR_INUND[2], "A cada 25 anos") + linha(COR_INUND[3], "A cada 100 anos (chuva extrema)");
  if (on("decl")) h += "<h4>Inclinação do terreno</h4>" + linha("#b45309", "Acima de 60%") + linha("#d9a441", "De 25% a 60%");
  if (on("cont")) h += "<h4>Áreas contaminadas</h4>" + Object.entries(COR_CONT).map(([g, c]) => linha(c, g)).join("");
  if (on("aterro")) h += "<h4>Aterros</h4>" + linha(COR_ATERRO.Ativo, "Em operação") + linha(COR_ATERRO.Desativado, "Desativado");
  if (on("dren")) h += "<h4>Drenagem</h4>" + linha(COR_DREN["Em operação"], "Piscinão em operação") + linha(COR_DREN.Planejada, "Obra planejada");
  if (on("corr")) h += "<h4>Córregos e rios</h4>" + linha(COR_CORREGO.n, "Leito natural") + linha(COR_CORREGO.a, "Canalizado a céu aberto") + linha(COR_CORREGO.s, "Canalizado subterrâneo");
  if (on("oc")) h += "<h4>Ocorrências 2026</h4>" + Object.entries(COR_OCORR).map(([g, c]) => linha(c, g)).join("");
  if (on("carta")) h += "<h4>Tipo de terreno (suscetibilidade)</h4>" + [[1, "Colinas e terraços: baixa"], [2, "Morrotes: moderada"], [3, "Várzeas e morros baixos: alta"], [4, "Morros altos e serras: muito alta"]].map(([k, t]) => linha(COR_SUSC[k], t)).join("");
  if (on("sede")) h += "<h4>Atendimento</h4>" + linha("#e9f1ed", "Sede da subprefeitura");
  el.innerHTML = h || "<p class='nota'>Nenhuma camada ativa.</p>";
}

export function focarPonto(lat, lng, rotulo) {
  if (!mapa) return;
  marcador?.remove();
  marcador = L.marker([lat, lng]).addTo(mapa).bindPopup(esc(rotulo || "Local consultado"));
  mapa.setView([lat, lng], 16);
}

export function focarDistrito(id) {
  if (!mapa || !distritosLayer) return;
  distritosLayer.eachLayer((l) => { if (l.feature.properties.id === id) mapa.fitBounds(l.getBounds()); });
}

// --------------------------------------------------------------- mini-mapa
let mini;
export async function miniMapa(el, res) {
  mini?.remove();
  mini = L.map(el, { scrollWheelZoom: false }).setView([res.lat, res.lng], 16);
  mini.getContainer().classList.add("mapa-escuro");
  L.tileLayer(BASE_URL, { attribution: BASE_ATTR, maxZoom: 19 }).addTo(mini);
  try { L.imageOverlay(`data/raster/inundacao.png?v=${VERSAO}`, await limitesRaster(), { interactive: false, className: "raster-nitido" }).addTo(mini); } catch { /* sem raster */ }
  L.circle([res.lat, res.lng], { radius: 300, color: "#22c55e", weight: 1, dashArray: "4 4", fill: false, interactive: false }).addTo(mini);
  const add = (lista, id) => lista.forEach((x) => {
    const l = pontos[id] && x.f.geometry.type === "Point"
      ? L.circleMarker([x.f.geometry.coordinates[1], x.f.geometry.coordinates[0]], { color: "#050807", weight: 1.5, fillOpacity: 0.95, ...pontos[id](x.p) })
      : L.geoJSON(x.f, { style: estilos[id] });
    l.bindPopup(popups[id](x.p)).addTo(mini);
  });
  add((res.corrego?.lista || []).filter((x) => x.p.t !== "l"), "corr");
  add(res.perto.dren, "dren");
  add(res.perto.hid, "hid");
  add(res.perto.geo, "geo");
  add(res.perto.cont, "cont");
  add(res.perto.aterros, "aterro");
  add(res.perto.oc, "oc");
  L.marker([res.lat, res.lng]).addTo(mini).bindPopup(esc(res.endereco || "Local consultado"));
  setTimeout(() => mini.invalidateSize(), 60);
}
