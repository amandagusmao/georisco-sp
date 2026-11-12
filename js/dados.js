// Carregamento (com cache) dos arquivos de dados e utilitários comuns.
const cache = {};

export function carregar(nome) {
  if (!cache[nome]) {
    cache[nome] = fetch(`data/${nome}`).then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar ${nome}`);
      return r.json();
    }).then((d) => {
      if (d.type === "FeatureCollection") {
        for (const f of d.features) f.bbox = turf.bbox(f);
      }
      return d;
    }).catch((e) => { delete cache[nome]; throw e; });
  }
  return cache[nome];
}

export const CAMADAS_ANALISE = [
  "distritos.geojson", "risco_geologico.geojson", "risco_hidrologico.geojson",
  "areas_contaminadas.geojson", "ocorrencias.geojson", "area_inundavel.geojson",
  "carta_geotecnica.geojson",
];

export const NIVEIS = [
  { n: 0, nome: "Baixo", cor: "#2e7d32", clara: false },
  { n: 1, nome: "Atenção", cor: "#f9a825", clara: true },
  { n: 2, nome: "Médio", cor: "#ef6c00", clara: false },
  { n: 3, nome: "Alto", cor: "#d32f2f", clara: false },
  { n: 4, nome: "Muito alto", cor: "#6a1b9a", clara: false },
];

export const NIVEL_DISTRITO = {
  "Baixo": "#ffd966", "Moderado": "#f6a04d", "Alto": "#e3572b", "Muito alto": "#9e1b1b",
};
export function corIndice(v) {
  return v >= 65 ? NIVEL_DISTRITO["Muito alto"] : v >= 50 ? NIVEL_DISTRITO["Alto"]
    : v >= 35 ? NIVEL_DISTRITO["Moderado"] : NIVEL_DISTRITO["Baixo"];
}
export function nivelIndice(v) {
  return v >= 65 ? "Muito alto" : v >= 50 ? "Alto" : v >= 35 ? "Moderado" : "Baixo";
}

export const COR_GRAU_GEO = { R1: "#fdd835", R2: "#fb8c00", R3: "#e53935", R4: "#8e24aa" };
export const COR_GRAU_HID = { R1: "#9ecae1", R2: "#4292c6", R3: "#2171b5", R4: "#08306b" };
export const COR_CONT = {
  "Contaminada": "#6d1f12", "Contaminada Sob Investigação": "#b5562b",
  "Em Processo de Monitoramento para Reabilitação": "#c79a3a", "Reabilitada": "#7f8c8d",
};
export const COR_OCORR = { "Alagamento": "#29b6f6", "Inundação": "#1565c0", "Deslizamento": "#c62828", "Erosão (chamado)": "#795548" };
export const COR_SUSC = { 1: "#d9f0d3", 2: "#f3e2a9", 3: "#e9a86b", 4: "#b5654a" };

export const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function toast(msg, ms = 4000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}
