// Exportação para Excel (SheetJS) e PDF (jsPDF + autoTable).
import { fmt, dataBR, NIVEIS } from "./dados.js?v=5";
import { INUND_TXT, DECL_TXT } from "./analise.js?v=5";
import { TIPO_CORREGO, nomeCorrego } from "./corregos.js?v=5";

const VERDE = [6, 78, 59];
const VERDE_VIVO = [34, 197, 94];
const PRETO = [5, 8, 7];
const hoje = () => new Date().toLocaleDateString("pt-BR");
const agora = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const nomeArquivo = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 50);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const COLUNAS = [
  ["ranking", "Ranking (1 = maior risco)"], ["nome", "Distrito"], ["subprefeitura", "Subprefeitura"], ["regiao", "Região"],
  ["area_km2", "Área (km²)"], ["idx_geral", "Índice geral (0-100)"], ["nivel", "Nível"],
  ["idx_deslizamento", "Índice deslizamento"], ["idx_alagamento", "Índice alagamento/inundação"], ["idx_erosao", "Índice erosão/solapamento"], ["idx_contaminacao", "Índice solo contaminado"],
  ["geo_total", "Setores risco geológico (total)"], ["geo_R1", "Geológico R1"], ["geo_R2", "Geológico R2"], ["geo_R3", "Geológico R3"], ["geo_R4", "Geológico R4"],
  ["setores_escorregamento", "Setores c/ escorregamento"], ["setores_solapamento", "Setores c/ solapamento"],
  ["hid_total", "Setores risco hidrológico (total)"], ["hid_R1", "Hidrológico R1"], ["hid_R2", "Hidrológico R2"], ["hid_R3", "Hidrológico R3"], ["hid_R4", "Hidrológico R4"],
  ["moradias_geo", "Moradias em setores geológicos"], ["moradias_hid", "Moradias em setores hidrológicos"], ["moradias_alto", "Moradias em setores R3/R4"],
  ["pct_inundavel", "% área inundável"], ["pct_encosta", "% encostas (morros/serras)"], ["pct_planicie", "% várzeas"], ["terreno_predominante", "Terreno predominante"],
  ["cont_total", "Áreas contaminadas (total)"], ["cont_contaminada", "Contaminadas"], ["cont_investigacao", "Sob investigação"], ["cont_monitoramento", "Em monitoramento"], ["cont_reabilitada", "Reabilitadas"],
  ["oc_total", "Ocorrências 2026 (total)"], ["oc_alagamento", "Alagamentos 2026"], ["oc_inundacao", "Inundações 2026"], ["oc_deslizamento", "Deslizamentos 2026"], ["sac_erosao", "Chamados de erosão"],
  ["oc_queda_arvore", "Quedas de árvore 2026"], ["pct_alaga_5", "% área que alaga a cada 5 anos"], ["pct_inundavel", "% área que alaga a cada 100 anos"],
  ["pct_declive_25", "% área com inclinação acima de 25%"], ["dren_existente", "Piscinões em operação"], ["dren_planejada", "Obras de drenagem planejadas"],
  ["populacao", "População (Censo 2022)"], ["pop_vulneravel", "População em alta vulnerabilidade"], ["pct_vulneravel", "% população em alta vulnerabilidade"],
  ["sede_endereco", "Sede da subprefeitura"], ["sede_telefone", "Telefone da subprefeitura"],
];

function linhaDistrito(d) {
  const o = {};
  for (const [k, n] of COLUNAS) o[n] = d[k];
  return o;
}

function folha(rows, larguras) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (larguras) ws["!cols"] = larguras.map((w) => ({ wch: w }));
  return ws;
}
function folhaKV(pares) {
  const ws = XLSX.utils.aoa_to_sheet(pares);
  ws["!cols"] = [{ wch: 34 }, { wch: 90 }];
  return ws;
}

const FONTES = [
  ["Fontes", "GeoSampa, Prefeitura de São Paulo (áreas de risco geológico e hidrológico, área inundável, áreas contaminadas SVMA, ocorrências Defesa Civil/SIGRC, chamados SP156, Carta Geotécnica, distritos)."],
  ["Aviso", "Ferramenta informativa. Não substitui vistoria da Defesa Civil, laudo técnico ou alertas oficiais. Emergência: Defesa Civil 199, Bombeiros 193, SAMU 192."],
  ["Gerado por", "GeoRisco SP, https://amandagusmao.github.io/georisco-sp/"],
];

// ===================================================== endereço
function linhasProximidades(res) {
  const out = [];
  res.perto.geo.forEach((x) => out.push(["Risco geológico", `${x.p.nome} (setor ${x.p.setor})`, `${x.p.grau}, ${x.p.processo}`, x.d]));
  res.perto.hid.forEach((x) => out.push(["Risco hidrológico", `${x.p.nome} (setor ${x.p.setor})`, `${x.p.grau}, ${x.p.processo}`, x.d]));
  res.perto.cont.forEach((x) => out.push(["Área contaminada", x.p.endereco, `${x.p.classe}: ${x.p.contaminantes}`, x.d]));
  res.perto.oc.forEach((x) => out.push([`Ocorrência: ${x.p.tipo}`, x.p.local || x.p.distrito, dataBR(x.p.data), x.d]));
  (res.corrego?.lista || []).filter((x) => x.p.t !== "l").slice(0, 4).forEach((x) => out.push(["Córrego", nomeCorrego(x.p), TIPO_CORREGO[x.p.t], x.d]));
  res.perto.aterros.forEach((x) => out.push([x.p.tipo, `${x.p.nome} (${x.p.endereco})`, x.p.situacao === "Desativado" ? "Desativado" : "Em operação", x.d]));
  res.perto.dren.slice(0, 8).forEach((x) => out.push(["Obra de drenagem", x.p.nome, `${x.p.situacao}, ${x.p.tipo}`, x.d]));
  return out.sort((a, b) => a[3] - b[3]);
}

export function exportarEnderecoXLSX(res) {
  const wb = XLSX.utils.book_new();
  const d = res.distrito;
  XLSX.utils.book_append_sheet(wb, folhaKV([
    ["GeoRisco SP: relatório do endereço", ""],
    ["Data da consulta", agora()],
    ["Endereço", res.endereco || "Ponto selecionado no mapa"],
    ["Coordenadas (lat, long)", `${res.lat.toFixed(6)}, ${res.lng.toFixed(6)}`],
    ["Distrito", d.nome], ["Subprefeitura", d.subprefeitura], ["Região", d.regiao],
    ["Zona", `${res.zona.nome}, risco ${res.zona.nivelNome.toLowerCase()}`],
    ["Tipo de zona", res.zona.tipo],
    ["Resumo", res.zona.frase],
    ["Tipo de terreno", res.terreno ? `${res.terreno.tipo}. ${res.terreno.explicacao}` : "não informado"],
    ["Aptidão geotécnica (Carta da Prefeitura)", res.terreno?.aptidao || "não informado"],
    ["Mancha de inundação", res.ras.inund ? `Sim: pode alagar ${INUND_TXT[res.ras.inund]}` : res.ras.inundPerto ? `A menos de 30 m de área que alaga ${INUND_TXT[res.ras.inundPerto]}` : "Fora das manchas mapeadas"],
    ["Inclinação do terreno", res.ras.decl ? `Terreno ${DECL_TXT[res.ras.decl]}` : "sem dado"],
    ["Córrego a céu aberto mais próximo", res.corrego?.aberto ? `${nomeCorrego(res.corrego.aberto.p)}, ${TIPO_CORREGO[res.corrego.aberto.p.t]}, a ${res.corrego.aberto.d} m` : "Nenhum num raio de 200 m"],
    ["Quedas de árvore em 2026 (500 m)", res.quedasArvore],
    ["Atendimento", d.sede_endereco ? `Subprefeitura ${d.subprefeitura}: ${d.sede_endereco}, telefone ${d.sede_telefone}, ${d.sede_horario}` : "SP156: telefone 156"],
    [], ...FONTES,
  ]), "Resumo");
  XLSX.utils.book_append_sheet(wb, folha(res.riscos.map((r) => ({
    "Risco": r.nome, "Nível": NIVEIS[r.nivel].nome, "Nível (0 a 4)": r.nivel,
    "Por quê": r.motivos.join(" | "), "O que fazer": r.dicas.join(" | "),
  })), [26, 12, 12, 90, 90]), "Riscos");
  const prox = linhasProximidades(res).map(([t, n, c, dist]) => ({ "Tipo": t, "Nome / local": n, "Grau / classe / data": c, "Distância (m)": dist }));
  XLSX.utils.book_append_sheet(wb, folha(prox.length ? prox : [{ "Tipo": "Nenhum item de risco num raio de 300 a 500 m" }], [24, 60, 50, 14]), "Proximidades");
  XLSX.utils.book_append_sheet(wb, folha([linhaDistrito(d)]), "Distrito");
  XLSX.writeFile(wb, `georisco-sp-${nomeArquivo(res.endereco || d.nome)}.xlsx`);
}

function cabecalhoPDF(doc, titulo, subtitulo) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PRETO);
  doc.rect(0, 0, W, 24, "F");
  // faixa em degradê verde
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    doc.setFillColor(Math.round(34 + (6 - 34) * t), Math.round(197 + (95 - 197) * t), Math.round(94 + (70 - 94) * t));
    doc.rect((W / 60) * i, 24, W / 60 + 0.3, 1.6, "F");
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("GeoRisco", 12, 10);
  doc.setTextColor(...VERDE_VIVO);
  doc.text("SP", 12 + doc.getTextWidth("GeoRisco "), 10);
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(titulo, 12, 17);
  doc.text(subtitulo, W - 12, 17, { align: "right" });
  doc.setTextColor(30);
  return 32;
}

function rodapePDF(doc) {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5); doc.setTextColor(110);
    doc.text("Ferramenta informativa. Não substitui vistoria da Defesa Civil, laudo técnico ou alertas oficiais. Emergência: 199 Defesa Civil · 193 Bombeiros · 192 SAMU.", 12, H - 9);
    doc.text(`Dados: GeoSampa/Prefeitura de São Paulo · amandagusmao.github.io/georisco-sp · Página ${i} de ${n}`, 12, H - 5);
  }
}

function paragrafo(doc, texto, x, y, larg, tam = 10, cor = 30) {
  doc.setFontSize(tam); doc.setTextColor(cor);
  const linhas = doc.splitTextToSize(texto, larg);
  doc.text(linhas, x, y);
  return y + linhas.length * tam * 0.42 + 2;
}

function garantir(doc, y, h) {
  if (y + h > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); return 18; }
  return y;
}

export function exportarEnderecoPDF(res) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), L = W - 24;
  const d = res.distrito;
  let y = cabecalhoPDF(doc, "Relatório de risco do endereço", `Consulta em ${agora()}`);

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  y = paragrafo(doc, res.endereco || "Ponto selecionado no mapa", 12, y, L, 12);
  doc.setFont("helvetica", "normal");
  y = paragrafo(doc, `Distrito ${d.nome} · Subprefeitura ${d.subprefeitura} · Região ${d.regiao} · Coordenadas ${res.lat.toFixed(5)}, ${res.lng.toFixed(5)}`, 12, y, L, 9, 90);

  // caixa da zona
  y += 2;
  doc.setFontSize(10.5);
  const caixaTxt = doc.splitTextToSize(res.zona.frase, L - 10);
  const hCaixa = 22 + caixaTxt.length * 4.4;
  doc.setFillColor(...hex(res.zona.cor));
  doc.roundedRect(12, y, L, hCaixa, 3, 3, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(`${res.zona.nome}, risco ${res.zona.nivelNome.toLowerCase()}`, 17, y + 9);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(doc.splitTextToSize(`Tipo de zona: ${res.zona.tipo}`, L - 10)[0], 17, y + 15.5);
  doc.text(caixaTxt, 17, y + 21.5);
  y += hCaixa + 6;
  doc.setTextColor(30);

  if (res.terreno) {
    doc.setFont("helvetica", "bold");
    y = paragrafo(doc, `Tipo de terreno: ${res.terreno.tipo}`, 12, y, L, 11);
    doc.setFont("helvetica", "normal");
    y = paragrafo(doc, res.terreno.explicacao, 12, y, L, 9.5, 60);
    y = paragrafo(doc, `Carta Geotécnica (Prefeitura): ${res.terreno.aptidao}`, 12, y, L, 8.5, 100);
  }

  doc.autoTable({
    startY: y + 2,
    head: [["Risco", "Nível", "Por quê"]],
    body: res.riscos.map((r) => [r.nome, NIVEIS[r.nivel].nome, r.motivos.join("\n")]),
    styles: { fontSize: 9, cellPadding: 2.2, valign: "middle" },
    headStyles: { fillColor: VERDE },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" }, 1: { cellWidth: 24, halign: "center", fontStyle: "bold" } },
    didParseCell: (c) => {
      if (c.section === "body" && c.column.index === 1) {
        const n = res.riscos[c.row.index].nivel;
        c.cell.styles.fillColor = hex(NIVEIS[n].cor);
        c.cell.styles.textColor = NIVEIS[n].clara ? 20 : 255;
      }
    },
    margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 8;

  y = garantir(doc, y, 30);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("O que fazer", 12, y); y += 5;
  doc.autoTable({
    startY: y,
    body: res.riscos.filter((r) => r.nivel > 0).concat(res.riscos.every((r) => r.nivel === 0) ? [res.riscos[0]] : [])
      .map((r) => [r.nome, r.dicas.map((t) => "• " + t).join("\n")]),
    styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
    theme: "grid", margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 8;

  const prox = linhasProximidades(res).slice(0, 25);
  y = garantir(doc, y, 30);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("Itens de risco próximos (até 300 m; ocorrências e áreas contaminadas até 500 m)", 12, y); y += 3;
  doc.autoTable({
    startY: y + 2,
    head: [["Tipo", "Nome / local", "Grau / classe / data", "Distância"]],
    body: prox.length ? prox.map(([t, n, c, dist]) => [t, n, c, dist === 0 ? "no local" : `${dist} m`]) : [["", "Nenhum item de risco encontrado nas proximidades", "", ""]],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: VERDE },
    columnStyles: { 3: { halign: "right", cellWidth: 20 } },
    margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 8;

  y = garantir(doc, y, 40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text(`Distrito ${d.nome}`, 12, y); y += 2;
  doc.autoTable({
    startY: y + 2,
    body: [
      ["Índice geral de risco (0 a 100)", `${d.idx_geral}, ${d.nivel} (${d.ranking}º de 96 distritos)`],
      ["Setores de risco geológico", `${d.geo_total} (R4: ${d.geo_R4} · R3: ${d.geo_R3} · R2: ${d.geo_R2} · R1: ${d.geo_R1})`],
      ["Setores de risco hidrológico", `${d.hid_total} (R4: ${d.hid_R4} · R3: ${d.hid_R3} · R2: ${d.hid_R2} · R1: ${d.hid_R1})`],
      ["Moradias em setores R3/R4", fmt(d.moradias_alto)],
      ["Áreas contaminadas cadastradas", `${d.cont_total} (${d.cont_contaminada} contaminadas, ${d.cont_investigacao} sob investigação, ${d.cont_monitoramento} em monitoramento, ${d.cont_reabilitada} reabilitadas)`],
      ["Ocorrências em 2026", `${d.oc_total} (${d.oc_alagamento} alagamentos, ${d.oc_inundacao} inundações, ${d.oc_deslizamento} deslizamentos) e ${d.oc_queda_arvore} quedas de árvore`],
      ["Drenagem", `${d.dren_existente} piscinões em operação e ${d.dren_planejada} obras planejadas`],
      ["Vulnerabilidade social", `${fmt(d.pct_vulneravel)}% da população em alta ou muito alta vulnerabilidade (IPVS, Censo 2022)`],
      ["Subprefeitura", d.sede_endereco ? `${d.subprefeitura}: ${d.sede_endereco}, telefone ${d.sede_telefone}` : d.subprefeitura],
    ],
    styles: { fontSize: 9, cellPadding: 2 }, theme: "striped",
    columnStyles: { 0: { cellWidth: 62, fontStyle: "bold" } }, margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 8;

  y = garantir(doc, y, 32);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("Contatos úteis", 12, y); y += 5;
  doc.setFont("helvetica", "normal");
  y = paragrafo(doc, "Defesa Civil: 199 · Corpo de Bombeiros: 193 · SAMU: 192 · Prefeitura (SP156): 156 · Alertas por SMS: envie seu CEP para 40199 · CETESB (áreas contaminadas): cetesb.sp.gov.br", 12, y, L, 9.5);
  rodapePDF(doc);
  doc.save(`georisco-sp-${nomeArquivo(res.endereco || d.nome)}.pdf`);
}

// ===================================================== painel
export function exportarPainelXLSX(ctx) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, folhaKV([
    ["GeoRisco SP: painel de riscos", ""],
    ["Seleção", ctx.rotulo], ["Gerado em", agora()], ["Distritos na seleção", ctx.sel.length],
    ...ctx.kpis.map((k) => [k.t.charAt(0).toUpperCase() + k.t.slice(1), k.v]),
    [], ...FONTES,
    ["Metodologia do índice", "Índices de 0 a 100, comparativos entre os 96 distritos (escala logarítmica). Geral = 30% deslizamento + 30% alagamento/inundação + 20% erosão + 20% contaminação. Faixas: Baixo <35, Moderado 35-49, Alto 50-64, Muito alto 65+."],
  ]), "Resumo");
  const ordenados = [...ctx.sel].sort((a, b) => a.ranking - b.ranking);
  XLSX.utils.book_append_sheet(wb, folha(ordenados.map(linhaDistrito)), "Distritos");
  const grupo = (chave, nomeCol) => [...new Set(ctx.sel.map((d) => d[chave]))].map((g) => {
    const l = ctx.sel.filter((d) => d[chave] === g);
    const s = (k) => l.reduce((a, d) => a + d[k], 0);
    return {
      [nomeCol]: g, "Distritos": l.length, "Índice geral médio": Math.round(s("idx_geral") / l.length),
      "Setores geológicos": s("geo_total"), "Geológico R3+R4": s("geo_R3") + s("geo_R4"),
      "Setores hidrológicos": s("hid_total"), "Hidrológico R3+R4": s("hid_R3") + s("hid_R4"),
      "Moradias em setores R3/R4": s("moradias_alto"), "Áreas contaminadas": s("cont_total"),
      "Ocorrências 2026": s("oc_total"), "Chamados de erosão": s("sac_erosao"), "Quedas de árvore 2026": s("oc_queda_arvore"),
      "Piscinões em operação": s("dren_existente"), "Obras de drenagem planejadas": s("dren_planejada"),
      "População": s("populacao"), "% população em alta vulnerabilidade": Math.round(1000 * s("pop_vulneravel") / (s("populacao") || 1)) / 10,
    };
  });
  XLSX.utils.book_append_sheet(wb, folha(grupo("regiao", "Região")), "Por região");
  XLSX.utils.book_append_sheet(wb, folha(grupo("subprefeitura", "Subprefeitura")), "Por subprefeitura");
  XLSX.utils.book_append_sheet(wb, folha(ctx.ocorrencias.map((o) => ({ "Tipo": o.tipo, "Data": dataBR(o.data), "Distrito": o.distrito, "Local": o.local || "" })), [20, 12, 24, 40]), "Ocorrências");
  XLSX.writeFile(wb, `georisco-sp-painel-${nomeArquivo(ctx.rotulo)}.xlsx`);
}

export function exportarPainelPDF(ctx, graficos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), L = W - 24;
  let y = cabecalhoPDF(doc, `Painel de riscos: ${ctx.rotulo}`, `Gerado em ${hoje()}`);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(ctx.rotulo, 12, y); y += 4;
  doc.autoTable({
    startY: y + 2,
    body: ctx.kpis.map((k) => [fmt(k.v), k.t]),
    styles: { fontSize: 10, cellPadding: 2.2 }, theme: "plain",
    columnStyles: { 0: { cellWidth: 28, fontStyle: "bold", halign: "right", textColor: VERDE } },
    margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 6;

  const titulos = { g1: document.getElementById("t-g1").textContent, g2: document.getElementById("t-g2").textContent, g3: "Ocorrências registradas em 2026, por mês", g4: "Situação das áreas contaminadas", g5: "Risco e vulnerabilidade social por distrito", g6: "Piscinões e obras de drenagem" };
  const larg = (L - 6) / 2, alt = larg * 0.62;
  ["g1", "g2", "g3", "g4", "g5", "g6"].forEach((id, i) => {
    const g = graficos[id];
    if (!g) return;
    const col = i % 2, x = 12 + col * (larg + 6);
    if (col === 0) y = garantir(doc, y, alt + 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30);
    doc.text(doc.splitTextToSize(titulos[id], larg)[0], x, y);
    const c = g.canvas;
    const h = Math.min(alt, larg * (c.height / c.width));
    doc.addImage(g.toBase64Image("image/png", 1), "PNG", x, y + 2, larg, h, undefined, "FAST");
    if (col === 1) y += alt + 10;
  });

  doc.addPage();
  y = 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text("Distritos da seleção (ordenados pelo índice geral)", 12, y);
  const lista = [...ctx.sel].sort((a, b) => a.ranking - b.ranking);
  doc.autoTable({
    startY: y + 4,
    head: [["#", "Distrito", "Região", "Geral", "Desliz.", "Alag.", "Erosão", "Contam.", "Set. geo", "Set. hid", "Moradias R3/R4"]],
    body: lista.map((d) => [d.ranking, d.nome, d.regiao, `${d.idx_geral} ${d.nivel}`, d.idx_deslizamento, d.idx_alagamento, d.idx_erosao, d.idx_contaminacao, d.geo_total, d.hid_total, fmt(d.moradias_alto)]),
    styles: { fontSize: 7.8, cellPadding: 1.6 },
    headStyles: { fillColor: VERDE, fontSize: 7.5 },
    margin: { left: 12, right: 12 },
  });
  y = doc.lastAutoTable.finalY + 6;
  y = garantir(doc, y, 24);
  doc.setFont("helvetica", "normal");
  paragrafo(doc, "Metodologia: índices de 0 a 100, comparativos entre os 96 distritos. Consideram setores de risco ponderados pelo grau (R1=1, R2=2, R3=4, R4=8), ocorrências de 2026, chamados de erosão, % de área inundável, % de encostas e áreas contaminadas. Índice geral = 30% deslizamento + 30% alagamento/inundação + 20% erosão + 20% contaminação. O índice compara distritos; não é a probabilidade de acidente.", 12, y, L, 8.5, 80);
  rodapePDF(doc);
  doc.save(`georisco-sp-painel-${nomeArquivo(ctx.rotulo)}.pdf`);
}
