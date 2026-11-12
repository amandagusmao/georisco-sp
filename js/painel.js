// Painel (dashboard) por região, subprefeitura e distrito.
import { carregar, corIndice, nivelIndice, NIVEL_DISTRITO, COR_GRAU_GEO, COR_GRAU_HID, COR_OCORR, COR_CONT, fmt, esc } from "./dados.js?v=3";
import { exportarPainelXLSX, exportarPainelPDF } from "./exportar.js?v=3";
import { corVulneravel } from "./mapa.js?v=3";

const REGIOES = ["Centro", "Norte", "Sul", "Leste", "Oeste"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
let D = [], OC = [], graficos = {}, ord = { k: "ranking", asc: true }, iniciado = false;
const f = { regiao: "", sub: "", distrito: "" };
const $ = (id) => document.getElementById(id);

const soma = (lista, k) => lista.reduce((s, d) => s + (d[k] || 0), 0);
const media = (lista, k) => (lista.length ? Math.round(soma(lista, k) / lista.length) : 0);

export async function iniciarPainel() {
  if (iniciado) { desenhar(); return; }
  iniciado = true;
  const [res, oc] = await Promise.all([carregar("resumo.json"), carregar("ocorrencias.geojson")]);
  D = res.distritos;
  OC = oc.features.map((x) => x.properties);
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.color = "#9fb1a9";
  Chart.defaults.borderColor = "#1c2a25";

  $("f-regiao").innerHTML = `<option value="">Cidade toda</option>` + REGIOES.map((r) => `<option>${r}</option>`).join("");
  $("f-regiao").onchange = (e) => { f.regiao = e.target.value; f.sub = ""; f.distrito = ""; opcoes(); desenhar(); };
  $("f-sub").onchange = (e) => { f.sub = e.target.value; f.distrito = ""; opcoes(); desenhar(); };
  $("f-distrito").onchange = (e) => { f.distrito = e.target.value; desenhar(); };
  $("busca-tabela").oninput = tabela;
  document.querySelectorAll("#tabela-distritos th").forEach((th) => (th.onclick = () => {
    const k = th.dataset.ord;
    ord = { k, asc: ord.k === k ? !ord.asc : ["nome", "regiao", "ranking"].includes(k) };
    tabela();
  }));
  $("tabela-distritos").querySelector("tbody").onclick = (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) selecionarDistrito(tr.dataset.id);
  };
  $("painel-xlsx").onclick = () => exportarPainelXLSX(contexto());
  $("painel-pdf").onclick = () => exportarPainelPDF(contexto(), graficos);
  opcoes();
  desenhar();
}

export async function selecionarDistrito(id) {
  if (!iniciado) await iniciarPainel();
  const d = D.find((x) => x.id === id);
  if (!d) return;
  f.regiao = d.regiao; f.sub = d.subprefeitura; f.distrito = d.id;
  $("f-regiao").value = d.regiao;
  opcoes();
  desenhar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function opcoes() {
  const subs = [...new Set(D.filter((d) => !f.regiao || d.regiao === f.regiao).map((d) => d.subprefeitura))].sort((a, b) => a.localeCompare(b, "pt"));
  $("f-sub").innerHTML = `<option value="">Todas</option>` + subs.map((s) => `<option ${s === f.sub ? "selected" : ""}>${esc(s)}</option>`).join("");
  const ds = D.filter((d) => (!f.regiao || d.regiao === f.regiao) && (!f.sub || d.subprefeitura === f.sub)).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  $("f-distrito").innerHTML = `<option value="">Todos</option>` + ds.map((d) => `<option value="${d.id}" ${d.id === f.distrito ? "selected" : ""}>${esc(d.nome)}</option>`).join("");
}

function selecao() {
  return D.filter((d) => (!f.regiao || d.regiao === f.regiao) && (!f.sub || d.subprefeitura === f.sub) && (!f.distrito || d.id === f.distrito));
}

function rotuloSelecao() {
  if (f.distrito) return `Distrito ${D.find((d) => d.id === f.distrito).nome}`;
  if (f.sub) return `Subprefeitura ${f.sub}`;
  if (f.regiao) return `Região ${f.regiao}`;
  return "Cidade de São Paulo";
}

function contexto() {
  const sel = selecao();
  return { rotulo: rotuloSelecao(), sel, todos: D, kpis: kpis(sel), ocorrencias: OC.filter((o) => sel.some((d) => d.nome === o.distrito)) };
}

function kpis(sel) {
  return [
    { v: soma(sel, "geo_total"), t: "setores de risco de deslizamento ou solapamento" },
    { v: soma(sel, "hid_total"), t: "setores de risco de alagamento ou inundação" },
    { v: soma(sel, "moradias_alto"), t: "moradias em setores de risco alto ou muito alto (R3 e R4)" },
    { v: soma(sel, "cont_contaminada") + soma(sel, "cont_investigacao") + soma(sel, "cont_monitoramento"), t: "áreas contaminadas ainda não reabilitadas" },
    { v: soma(sel, "oc_total") + soma(sel, "sac_erosao"), t: "ocorrências em 2026 e chamados de erosão" },
  ];
}

export function kpisHTML(lista) {
  return lista.map((k) => `<div class="kpi"><b>${fmt(k.v)}</b><span>${k.t}</span></div>`).join("");
}

function desenhar() {
  const sel = selecao();
  $("kpis-painel").innerHTML = kpisHTML(kpis(sel));
  painelDistrito(sel);
  g1(sel); g2(sel); g3(sel); g4(sel); g5(sel); g6(sel);
  tabela();
}

function painelDistrito(sel) {
  const el = $("painel-distrito");
  if (!f.distrito) { el.hidden = true; return; }
  const d = sel[0];
  const linha = (nome, k) => `<div class="indice-linha"><span>${nome}</span>
      <span class="trilho" title="Linha branca: média da cidade (${media(D, k)})"><i style="width:${d[k]}%;--c:${corIndice(d[k])}"></i><s style="left:${media(D, k)}%"></s></span><b>${d[k]}</b></div>`;
  el.hidden = false;
  el.innerHTML = `<div class="cartao">
    <div class="pd-cab"><div><h2>${esc(d.nome)}</h2><p class="nota">Subprefeitura ${esc(d.subprefeitura)} · Região ${esc(d.regiao)} · ${fmt(d.area_km2)} km² · Terreno predominante: ${esc(d.terreno_predominante)}</p></div>
    <span class="tag-nivel" style="--c:${NIVEL_DISTRITO[d.nivel]}">Risco ${d.nivel.toLowerCase()} · ${d.ranking}º de 96</span></div>
    <div class="grade-2" style="margin-top:12px">
      <div class="indices">${linha("Índice geral", "idx_geral")}${linha("Deslizamento", "idx_deslizamento")}${linha("Alagamento e inundação", "idx_alagamento")}${linha("Erosão e solapamento", "idx_erosao")}${linha("Solo contaminado", "idx_contaminacao")}
        <p class="nota">Barras de 0 a 100. A linha branca marca a média dos 96 distritos.</p></div>
      <ul class="lista-simples">
        <li><b>${fmt(d.geo_total)}</b> setores de risco geológico (R4: ${d.geo_R4}, R3: ${d.geo_R3}, R2: ${d.geo_R2}, R1: ${d.geo_R1})</li>
        <li><b>${fmt(d.hid_total)}</b> setores de risco hidrológico (R4: ${d.hid_R4}, R3: ${d.hid_R3}, R2: ${d.hid_R2}, R1: ${d.hid_R1})</li>
        <li><b>${fmt(d.moradias_alto)}</b> moradias em setores de risco alto ou muito alto</li>
        <li><b>${fmt(d.pct_inundavel)}%</b> da área pode alagar em chuva extrema (100 anos) ·<b>${fmt(d.pct_encosta)}%</b> são encostas (morros/serras) · <b>${fmt(d.pct_planicie)}%</b> várzeas</li>
        <li><b>${d.cont_total}</b> áreas contaminadas cadastradas (${d.cont_contaminada} contaminadas, ${d.cont_investigacao} sob investigação, ${d.cont_monitoramento} em monitoramento, ${d.cont_reabilitada} reabilitadas)</li>
        <li><b>${d.oc_total}</b> ocorrências em 2026 (${d.oc_alagamento} alagamentos, ${d.oc_inundacao} inundações, ${d.oc_deslizamento} deslizamentos), ${d.sac_erosao} chamados de erosão e ${d.oc_queda_arvore} quedas de árvore</li>
        <li><b>${fmt(d.pct_alaga_5)}%</b> da área alaga a cada 5 anos, em média · <b>${fmt(d.pct_declive_25)}%</b> tem inclinação acima de 25%</li>
        <li><b>${d.dren_existente}</b> piscinões em operação e <b>${d.dren_planejada}</b> obras de drenagem planejadas</li>
        <li><b>${fmt(d.pct_vulneravel)}%</b> da população (${fmt(d.pop_vulneravel)} de ${fmt(d.populacao)} pessoas) em alta ou muito alta vulnerabilidade social</li>
        ${d.sede_endereco ? `<li>Atendimento: <b>Subprefeitura ${esc(d.subprefeitura)}</b>, ${esc(d.sede_endereco)}, telefone ${esc(d.sede_telefone)}</li>` : ""}
      </ul>
    </div>
    <div class="acoes-res" style="margin:14px 0 0"><a class="btn btn-sec" href="#mapa" data-ver-mapa="${d.id}">Ver no mapa</a><button class="btn btn-sec" data-limpar>Voltar à visão geral</button></div>
  </div>`;
  el.querySelector("[data-limpar]").onclick = () => { f.distrito = ""; opcoes(); desenhar(); };
}

function grafico(id, cfg) {
  graficos[id]?.destroy();
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, cfg.options);
  graficos[id] = new Chart($(id), cfg);
}

function g1(sel) {
  let grupos, chave, titulo;
  if (f.distrito) {
    const d = sel[0];
    $("t-g1").textContent = "Setores de risco por grau";
    grafico("g1", {
      type: "bar",
      data: {
        labels: ["R1 (baixo)", "R2 (médio)", "R3 (alto)", "R4 (muito alto)"],
        datasets: [
          { label: "Deslizamento e solapamento", data: ["R1", "R2", "R3", "R4"].map((g) => d["geo_" + g]), backgroundColor: "#22c55e" },
          { label: "Alagamento e inundação", data: ["R1", "R2", "R3", "R4"].map((g) => d["hid_" + g]), backgroundColor: "#22d3ee" },
        ],
      },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
    return;
  }
  if (f.sub) { chave = "nome"; titulo = "distrito"; }
  else if (f.regiao) { chave = "subprefeitura"; titulo = "subprefeitura"; }
  else { chave = "regiao"; titulo = "região"; }
  grupos = [...new Set(sel.map((d) => d[chave]))];
  if (chave === "regiao") grupos = REGIOES;
  $("t-g1").textContent = `Setores de risco geológico por grau e ${titulo}`;
  grafico("g1", {
    type: "bar",
    data: {
      labels: grupos,
      datasets: ["R1", "R2", "R3", "R4"].map((g) => ({
        label: g, backgroundColor: COR_GRAU_GEO[g],
        data: grupos.map((gr) => soma(sel.filter((d) => d[chave] === gr), "geo_" + g)),
      })),
    },
    options: { scales: { x: { stacked: true, ticks: { autoSkip: false, maxRotation: 60 } }, y: { stacked: true, beginAtZero: true } } },
  });
}

function g2(sel) {
  if (f.distrito) {
    const d = sel[0];
    $("t-g2").textContent = "Índices do distrito e média da cidade";
    const ks = ["idx_geral", "idx_deslizamento", "idx_alagamento", "idx_erosao", "idx_contaminacao"];
    grafico("g2", {
      type: "bar",
      data: {
        labels: ["Geral", "Deslizamento", "Alagamento", "Erosão", "Contaminação"],
        datasets: [
          { label: d.nome, data: ks.map((k) => d[k]), backgroundColor: ks.map((k) => corIndice(d[k])) },
          { label: "Média da cidade", data: ks.map((k) => media(D, k)), backgroundColor: "#3a4d45" },
        ],
      },
      options: { scales: { y: { min: 0, max: 100 } } },
    });
    return;
  }
  const top = [...sel].sort((a, b) => b.idx_geral - a.idx_geral).slice(0, 10);
  $("t-g2").textContent = `Distritos com maior índice de risco (${rotuloSelecao()})`;
  grafico("g2", {
    type: "bar",
    data: { labels: top.map((d) => d.nome), datasets: [{ label: "Índice geral (0 a 100)", data: top.map((d) => d.idx_geral), backgroundColor: top.map((d) => corIndice(d.idx_geral)) }] },
    options: { indexAxis: "y", scales: { x: { min: 0, max: 100 } }, plugins: { legend: { display: false } } },
  });
}

function g3(sel) {
  const nomes = new Set(sel.map((d) => d.nome));
  const oc = OC.filter((o) => nomes.has(o.distrito) && o.data?.startsWith("2026"));
  const ultimo = Math.max(8, ...oc.map((o) => +o.data.slice(5, 7) - 1));
  const meses = MESES.slice(0, ultimo + 1);
  const tipos = ["Alagamento", "Inundação", "Deslizamento", "Queda de árvore", "Erosão (chamado)"];
  grafico("g3", {
    type: "bar",
    data: {
      labels: meses,
      datasets: tipos.map((t) => ({
        label: t, backgroundColor: COR_OCORR[t],
        data: meses.map((_, i) => oc.filter((o) => o.tipo === t && +o.data.slice(5, 7) === i + 1).length),
      })),
    },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function g4(sel) {
  const cls = [["Contaminada", "cont_contaminada"], ["Contaminada Sob Investigação", "cont_investigacao"], ["Em Processo de Monitoramento para Reabilitação", "cont_monitoramento"], ["Reabilitada", "cont_reabilitada"]];
  const rot = { "Contaminada Sob Investigação": "Sob investigação", "Em Processo de Monitoramento para Reabilitação": "Em monitoramento" };
  grafico("g4", {
    type: "doughnut",
    data: { labels: cls.map(([c]) => rot[c] || c), datasets: [{ data: cls.map(([, k]) => soma(sel, k)), backgroundColor: cls.map(([c]) => COR_CONT[c]), borderWidth: 2, borderColor: "#0f1715" }] },
    options: { plugins: { legend: { position: "right" } }, cutout: "55%" },
  });
}

function g5(sel) {
  const marcados = new Set(sel.map((d) => d.id));
  grafico("g5", {
    type: "scatter",
    data: {
      datasets: [
        { label: "Distritos selecionados", data: D.filter((d) => marcados.has(d.id)).map((d) => ({ x: d.idx_geral, y: d.pct_vulneravel, nome: d.nome })), backgroundColor: "#22c55e", pointRadius: 5, pointHoverRadius: 7 },
        { label: "Demais distritos", data: D.filter((d) => !marcados.has(d.id)).map((d) => ({ x: d.idx_geral, y: d.pct_vulneravel, nome: d.nome })), backgroundColor: "#3a4d45", pointRadius: 3 },
      ],
    },
    options: {
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "Índice geral de risco (0 a 100)" } },
        y: { min: 0, title: { display: true, text: "% da população em alta vulnerabilidade" } },
      },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.raw.nome}: risco ${c.raw.x}, ${fmt(c.raw.y)}% vulnerável` } } },
    },
  });
}

function g6(sel) {
  let chave = "regiao", grupos = REGIOES;
  if (f.distrito || f.sub) { chave = "nome"; grupos = sel.map((d) => d.nome); }
  else if (f.regiao) { chave = "subprefeitura"; grupos = [...new Set(sel.map((d) => d.subprefeitura))]; }
  grafico("g6", {
    type: "bar",
    data: {
      labels: grupos,
      datasets: [
        { label: "Piscinões em operação", backgroundColor: "#22c55e", data: grupos.map((g) => soma(sel.filter((d) => d[chave] === g), "dren_existente")) },
        { label: "Obras planejadas", backgroundColor: "#a3e635", data: grupos.map((g) => soma(sel.filter((d) => d[chave] === g), "dren_planejada")) },
      ],
    },
    options: { scales: { x: { ticks: { autoSkip: false, maxRotation: 60 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function tabela() {
  const q = $("busca-tabela").value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const sel = (f.distrito ? D.filter((d) => (!f.regiao || d.regiao === f.regiao) && (!f.sub || d.subprefeitura === f.sub)) : selecao())
    .filter((d) => !q || d.nome.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(q));
  const k = ord.k;
  sel.sort((a, b) => {
    const r = typeof a[k] === "string" ? a[k].localeCompare(b[k], "pt") : a[k] - b[k];
    return ord.asc ? r : -r;
  });
  document.querySelectorAll("#tabela-distritos th").forEach((th) => {
    th.classList.toggle("asc", th.dataset.ord === k && ord.asc);
    th.classList.toggle("desc", th.dataset.ord === k && !ord.asc);
  });
  const barra = (v) => `<span class="barra-idx"><i style="width:${Math.max(4, v * 0.6)}px;--c:${corIndice(v)}"></i>${v}</span>`;
  $("tabela-distritos").querySelector("tbody").innerHTML = sel.map((d) => `<tr data-id="${d.id}" class="${d.id === f.distrito ? "sel" : ""}" tabindex="0">
    <td>${d.ranking}</td><td><b>${esc(d.nome)}</b><br><small>${esc(d.subprefeitura)}</small></td><td>${d.regiao}</td>
    <td><span class="tag-nivel" style="--c:${corIndice(d.idx_geral)}">${d.idx_geral} · ${d.nivel}</span></td>
    <td>${barra(d.idx_deslizamento)}</td><td>${barra(d.idx_alagamento)}</td><td>${barra(d.idx_erosao)}</td><td>${barra(d.idx_contaminacao)}</td>
    <td>${fmt(d.moradias_alto)}</td><td><span class="barra-idx"><i style="width:${Math.max(4, d.pct_vulneravel * 0.6)}px;--c:${corVulneravel(d.pct_vulneravel)}"></i>${fmt(d.pct_vulneravel)}%</span></td></tr>`).join("") || `<tr><td colspan="10">Nenhum distrito encontrado.</td></tr>`;
}

export { nivelIndice };
