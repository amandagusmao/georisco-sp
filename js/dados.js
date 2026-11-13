// Carregamento (com cache) dos arquivos de dados e utilitários comuns.
const VERSAO = 4;
const cache = {};

export function carregar(nome) {
  if (!cache[nome]) {
    cache[nome] = fetch(`data/${nome}?v=${VERSAO}`).then((r) => {
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
  "areas_contaminadas.geojson", "ocorrencias.geojson", "carta_geotecnica.geojson",
  "drenagem.geojson", "aterros.geojson",
];

export const NIVEIS = [
  { n: 0, nome: "Baixo", cor: "#22c55e", clara: true },
  { n: 1, nome: "Atenção", cor: "#d4b106", clara: true },
  { n: 2, nome: "Médio", cor: "#e07b24", clara: false },
  { n: 3, nome: "Alto", cor: "#dc3c3c", clara: false },
  { n: 4, nome: "Muito alto", cor: "#9b1c1c", clara: false },
];

export const NIVEL_DISTRITO = {
  "Baixo": "#16a34a", "Moderado": "#c9a227", "Alto": "#d9642a", "Muito alto": "#c0392b",
};
export function corIndice(v) {
  return v >= 65 ? NIVEL_DISTRITO["Muito alto"] : v >= 50 ? NIVEL_DISTRITO["Alto"]
    : v >= 35 ? NIVEL_DISTRITO["Moderado"] : NIVEL_DISTRITO["Baixo"];
}
export function nivelIndice(v) {
  return v >= 65 ? "Muito alto" : v >= 50 ? "Alto" : v >= 35 ? "Moderado" : "Baixo";
}

export const COR_GRAU_GEO = { R1: "#e3c443", R2: "#e07b24", R3: "#dc3c3c", R4: "#a51d1d" };
export const COR_GRAU_HID = { R1: "#a5f3fc", R2: "#22d3ee", R3: "#0891b2", R4: "#155e75" };
export const COR_CONT = {
  "Contaminada": "#c2410c", "Contaminada Sob Investigação": "#d9a441",
  "Em Processo de Monitoramento para Reabilitação": "#a8a29e", "Reabilitada": "#57534e",
};
export const COR_OCORR = { "Alagamento": "#67e8f9", "Inundação": "#0891b2", "Deslizamento": "#dc3c3c", "Erosão (chamado)": "#a8a29e", "Queda de árvore": "#84cc16" };
export const COR_SUSC = { 1: "#14532d", 2: "#4d7c0f", 3: "#a16207", 4: "#9a3412" };

export const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function dataBR(iso) {
  if (!iso) return "não informada";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export const icone = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

export function toast(msg, ms = 4000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

export const COR_INUND = { 1: "#1d4ed8", 2: "#3b82f6", 3: "#93c5fd" };
export const COR_DREN = { "Em operação": "#22c55e", "Planejada": "#a3e635", "Planejado": "#a3e635" };
export const COR_ATERRO = { "Ativo": "#f59e0b", "Desativado": "#b45309" };
