// Mapa interativo (Leaflet) e mini-mapa do resultado.
import {
  carregar, corIndice, nivelIndice, NIVEL_DISTRITO, COR_GRAU_GEO, COR_GRAU_HID, COR_CONT,
  COR_OCORR, COR_SUSC, esc, fmt, dataBR,
} from "./dados.js";

const CENTRO = [-23.62, -46.62];
const BASE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BASE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Dados: <a href="https://geosampa.prefeitura.sp.gov.br/">GeoSampa/PMSP</a>';

const NOMES_INDICE = {
  idx_geral: "Índice geral de risco", idx_deslizamento: "Deslizamento de terra",
  idx_alagamento: "Alagamento e inundação", idx_erosao: "Erosão e solapamento", idx_contaminacao: "Solo contaminado",
};

export const popups = {
  geo: (p) => `<h4>${esc(p.nome)}</h4>Risco geológico <b>${p.grau}</b> – ${esc(p.processo)}<br>Setor ${esc(p.setor)} · ${esc(p.distrito)}<br>Moradias no setor: <b>${fmt(p.moradias)}</b><br><small>Vistoria: ${dataBR(p.vistoria)}</small>`,
  hid: (p) => `<h4>${esc(p.nome)}</h4>Risco hidrológico <b>${p.grau}</b> – ${esc(p.processo)}<br>Bacia: ${esc(p.bacia)} · ${esc(p.distrito)}<br>Moradias no setor: <b>${fmt(p.moradias)}</b><br><small>Vistoria: ${dataBR(p.vistoria)}</small>`,
  cont: (p) => `<h4>Área ${esc(p.classe.toLowerCase())}</h4>${esc(p.endereco)}<br>Contaminantes: ${esc(p.contaminantes)}<br>Uso anterior: ${esc(p.uso_anterior || "—")}<br><small>Fonte: SVMA/PMSP</small>`,
  oc: (p) => `<h4>${esc(p.tipo)}</h4>Data: ${dataBR(p.data)}${p.local ? `<br>${esc(p.local)}` : ""}<br>${esc(p.distrito)}`,
  carta: (p) => `<h4>Terreno: ${esc(p.tipo)}</h4>${esc(p.explicacao)}<br><small>Unidade ${esc(p.unidade)} · ${esc(p.relevo)} · ${esc(p.rocha)}</small>`,
  inund: () => `<h4>Área inundável</h4>Mancha de inundação para chuva extrema (período de retorno de 100 anos).`,
};

export const estilos = {
  geo: (f) => ({ color: COR_GRAU_GEO[f.properties.grau], weight: 1, fillColor: COR_GRAU_GEO[f.properties.grau], fillOpacity: 0.55 }),
  hid: (f) => ({ color: COR_GRAU_HID[f.properties.grau], weight: 1, fillColor: COR_GRAU_HID[f.properties.grau], fillOpacity: 0.5 }),
  cont: (f) => ({ color: COR_CONT[f.properties.classe] || "#555", weight: 1.5, fillColor: COR_CONT[f.properties.classe] || "#555", fillOpacity: 0.6 }),
  inund: () => ({ color: "#0288d1", weight: 0.5, fillColor: "#4fc3f7", fillOpacity: 0.35 }),
  carta: (f) => ({ color: "#8d6e63", weight: 0.4, fillColor: COR_SUSC[f.properties.susc], fillOpacity: 0.55 }),
};

const CAMADAS = [
  { id: "geo", nome: "Risco de deslizamento e solapamento", arquivo: "risco_geologico.geojson", cor: "#e53935", ativo: true, pane: "risco" },
  { id: "hid", nome: "Risco de alagamento e inundação", arquivo: "risco_hidrologico.geojson", cor: "#2171b5", ativo: true, pane: "risco" },
  { id: "inund", nome: "Área inundável (cheia de 100 anos)", arquivo: "area_inundavel.geojson", cor: "#4fc3f7", ativo: false, pane: "fundo2" },
  { id: "cont", nome: "Áreas contaminadas", arquivo: "areas_contaminadas.geojson", cor: "#6d1f12", ativo: false, pane: "risco" },
  { id: "oc", nome: "Ocorrências e chamados (2026)", arquivo: "ocorrencias.geojson", cor: "#c62828", ativo: false, pane: "pontos" },
  { id: "carta", nome: "Tipo de terreno (carta geotécnica)", arquivo: "carta_geotecnica.geojson", cor: "#e9a86b", ativo: false, pane: "fundo1" },
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
  if (def.id === "oc") {
    opts.pointToLayer = (f, ll) => L.circleMarker(ll, {
      radius: 5, color: "#fff", weight: 1, fillColor: COR_OCORR[f.properties.tipo], fillOpacity: 0.9,
      pane: def.pane, renderer: renderers[def.pane], bubblingMouseEvents: false,
    });
  } else {
    opts.style = estilos[def.id];
  }
  return L.geoJSON(dados, opts);
}

let mapa, distritosLayer, indiceAtual = "idx_geral", marcador;
const ativas = {};

export function mapaPrincipal() { return mapa; }

export async function iniciarMapa({ onAnalisar, onDistrito }) {
  if (mapa) { setTimeout(() => mapa.invalidateSize(), 50); return mapa; }
  mapa = L.map("mapa-leaflet", { zoomControl: true, minZoom: 9, maxZoom: 19 }).setView(CENTRO, 11);
  L.tileLayer(BASE_URL, { attribution: BASE_ATTR, maxZoom: 19 }).addTo(mapa);
  criarPanes(mapa);
  const renderers = {};
  ["distritos", "fundo1", "fundo2", "risco", "pontos"].forEach((p) => (renderers[p] = L.canvas({ pane: p, tolerance: 3 })));
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

  // painel de camadas
  const box = document.getElementById("camadas");
  box.innerHTML = CAMADAS.map((c) => `<label><input type="checkbox" data-camada="${c.id}" ${c.ativo ? "checked" : ""}><span class="amostra" style="background:${c.cor}"></span>${c.nome}</label>`).join("");
  box.addEventListener("change", (e) => {
    const id = e.target.dataset.camada;
    if (id) alternar(id, e.target.checked, renderers);
  });
  for (const c of CAMADAS) if (c.ativo) alternar(c.id, true, renderers);

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

async function alternar(id, ligar, renderers) {
  const def = CAMADAS.find((c) => c.id === id);
  if (!ligar) { ativas[id]?.remove(); legenda(); return; }
  if (!ativas[id]) {
    try {
      const dados = await carregar(def.arquivo);
      ativas[id] = camadaGeoJSON(def, dados, renderers);
    } catch (e) { console.error(e); return; }
  }
  const chk = document.querySelector(`[data-camada="${id}"]`);
  if (chk?.checked) ativas[id].addTo(mapa);
  legenda();
}

function estiloDistrito(f) {
  if (indiceAtual === "nenhum") return { color: "#37474f", weight: 1, fillOpacity: 0, opacity: 0.6 };
  return { color: "#455a64", weight: 0.8, opacity: 0.7, fillColor: corIndice(f.properties[indiceAtual]), fillOpacity: 0.45 };
}

function legenda() {
  const el = document.getElementById("legenda");
  const linha = (cor, txt, borda) => `<div class="linha"><span class="cx" style="background:${cor}${borda ? `;border-color:${borda}` : ""}"></span>${txt}</div>`;
  let h = "";
  if (indiceAtual !== "nenhum") {
    h += `<h4>Distritos – ${NOMES_INDICE[indiceAtual]}</h4>`;
    h += [["Baixo", "0–34"], ["Moderado", "35–49"], ["Alto", "50–64"], ["Muito alto", "65–100"]].map(([n, f]) => linha(NIVEL_DISTRITO[n], `${n} (${f})`)).join("");
  }
  const on = (id) => document.querySelector(`[data-camada="${id}"]`)?.checked;
  if (on("geo")) h += "<h4>Risco de deslizamento/solapamento</h4>" + Object.entries(COR_GRAU_GEO).map(([g, c]) => linha(c, `${g} – ${{ R1: "baixo", R2: "médio", R3: "alto", R4: "muito alto" }[g]}`)).join("");
  if (on("hid")) h += "<h4>Risco de alagamento/inundação</h4>" + Object.entries(COR_GRAU_HID).map(([g, c]) => linha(c, `${g} – ${{ R1: "baixo", R2: "médio", R3: "alto", R4: "muito alto" }[g]}`)).join("");
  if (on("inund")) h += "<h4>Área inundável</h4>" + linha("#4fc3f7", "Cheia de 100 anos");
  if (on("cont")) h += "<h4>Áreas contaminadas</h4>" + Object.entries(COR_CONT).map(([g, c]) => linha(c, g)).join("");
  if (on("oc")) h += "<h4>Ocorrências 2026</h4>" + Object.entries(COR_OCORR).map(([g, c]) => linha(c, g)).join("");
  if (on("carta")) h += "<h4>Tipo de terreno (suscetibilidade)</h4>" + [[1, "Colinas e terraços – baixa"], [2, "Morrotes – moderada"], [3, "Várzeas / morros baixos – alta"], [4, "Morros altos e serras – muito alta"]].map(([k, t]) => linha(COR_SUSC[k], t)).join("");
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
export function miniMapa(el, res) {
  mini?.remove();
  mini = L.map(el, { scrollWheelZoom: false }).setView([res.lat, res.lng], 16);
  L.tileLayer(BASE_URL, { attribution: BASE_ATTR, maxZoom: 19 }).addTo(mini);
  L.circle([res.lat, res.lng], { radius: 300, color: "#0b5d4b", weight: 1, dashArray: "4 4", fill: false, interactive: false }).addTo(mini);
  const add = (lista, id) => lista.forEach((x) => {
    const l = id === "oc"
      ? L.circleMarker([x.f.geometry.coordinates[1], x.f.geometry.coordinates[0]], { radius: 6, color: "#fff", weight: 1, fillColor: COR_OCORR[x.p.tipo], fillOpacity: 0.9 })
      : L.geoJSON(x.f, { style: estilos[id] });
    l.bindPopup(popups[id](x.p)).addTo(mini);
  });
  add(res.perto.hid, "hid");
  add(res.perto.geo, "geo");
  add(res.perto.cont, "cont");
  add(res.perto.oc, "oc");
  L.marker([res.lat, res.lng]).addTo(mini).bindPopup(esc(res.endereco || "Local consultado"));
  setTimeout(() => mini.invalidateSize(), 60);
}
