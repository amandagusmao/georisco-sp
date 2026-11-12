// GeoRisco SP: controle das páginas, busca e resultado da consulta.
import { carregar, NIVEIS, NIVEL_DISTRITO, esc, fmt, toast, icone } from "./dados.js";
import { buscarEndereco, enderecoDoPonto } from "./geocode.js";
import { analisarPonto, preCarregar } from "./analise.js";
import { iniciarMapa, focarPonto, focarDistrito, miniMapa } from "./mapa.js";
import { iniciarPainel, selecionarDistrito, kpisHTML } from "./painel.js";
import { iniciarChuva, obterChuva, chuvaHTML } from "./chuva.js";
import { exportarEnderecoPDF, exportarEnderecoXLSX } from "./exportar.js";

const PAGINAS = ["inicio", "consulta", "mapa", "painel", "chuva", "riscos", "sobre"];
let resultadoAtual = null;
let chaveAtual = "";
let chuvaIniciada = false;

// ------------------------------------------------------------ rotas
function rota() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "inicio";
  const [id, query] = hash.split("?");
  let pagina = PAGINAS.includes(id) ? id : null;
  let ancora = null;
  if (!pagina) {
    const el = document.getElementById(id);
    pagina = el?.closest("[data-pagina]")?.dataset.pagina || "inicio";
    ancora = el;
  }
  document.querySelectorAll("[data-pagina]").forEach((s) => (s.hidden = s.dataset.pagina !== pagina));
  document.querySelectorAll("[data-rota]").forEach((a) => a.classList.toggle("ativo", a.dataset.rota === pagina));
  document.getElementById("menu").classList.remove("aberto");
  document.querySelector(".menu-btn").setAttribute("aria-expanded", "false");
  if (ancora) setTimeout(() => ancora.scrollIntoView({ behavior: "smooth" }), 30);
  else if (!query) window.scrollTo(0, 0);

  if (pagina === "mapa") iniciarMapa({ onAnalisar: (lat, lng) => consultar(lat, lng, null), onDistrito: abrirDistrito }).catch(erro);
  if (pagina === "painel") iniciarPainel().catch(erro);
  if (pagina === "chuva" && !chuvaIniciada) { chuvaIniciada = true; iniciarChuva(); }
  if (pagina === "consulta" && query) {
    const p = new URLSearchParams(query);
    const lat = +p.get("lat"), lng = +p.get("lng");
    if (lat && lng && `${lat},${lng}` !== chaveAtual) consultar(lat, lng, p.get("end"));
  }
  document.title = { inicio: "GeoRisco SP | Mapa de riscos geológicos de São Paulo", consulta: "Consulta por endereço | GeoRisco SP", mapa: "Mapa de riscos | GeoRisco SP", painel: "Painel por região | GeoRisco SP", chuva: "Chuva e alerta | GeoRisco SP", riscos: "Entenda os riscos | GeoRisco SP", sobre: "Sobre | GeoRisco SP" }[pagina];
}

function erro(e) { console.error(e); toast(e.message || "Algo deu errado. Tente novamente."); }

function abrirDistrito(id) {
  location.hash = "painel";
  selecionarDistrito(id).catch(erro);
}

// ------------------------------------------------------------ busca
function mostrarSugestoes(box, lista) {
  box.hidden = false;
  box.innerHTML = `<p>Encontramos ${lista.length} resultados. Qual deles?</p>` +
    lista.map((r, i) => `<button type="button" data-i="${i}">${esc(r.rotulo)}</button>`).join("");
  box.onclick = (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    box.hidden = true;
    const r = lista[+b.dataset.i];
    consultar(r.lat, r.lng, r.rotulo);
  };
}

document.querySelectorAll("[data-busca]").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = form.q.value.trim();
    if (!q) return;
    const box = form.parentElement.querySelector("[data-sugestoes]");
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      preCarregar().catch(() => {});
      const res = await buscarEndereco(q);
      if (!res.length) {
        toast("Endereço não encontrado em São Paulo. Tente incluir o bairro ou use o CEP.", 6000);
      } else if (res.length === 1 || res[0].tipo === "cep") {
        box && (box.hidden = true);
        consultar(res[0].lat, res[0].lng, res[0].rotulo);
      } else {
        mostrarSugestoes(box, res);
      }
    } catch (err) { erro(err); } finally { btn.disabled = false; btn.innerHTML = original; }
  });
});

document.querySelectorAll("[data-gps]").forEach((b) => b.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Seu navegador não permite obter a localização.");
  toast("Obtendo sua localização...");
  navigator.geolocation.getCurrentPosition(
    (pos) => consultar(pos.coords.latitude, pos.coords.longitude, null),
    () => toast("Não foi possível obter sua localização. Verifique a permissão do navegador."),
    { enableHighAccuracy: true, timeout: 15000 },
  );
}));

// ------------------------------------------------------------ consulta
async function consultar(lat, lng, rotulo) {
  const params = new URLSearchParams({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
  if (rotulo) params.set("end", rotulo);
  chaveAtual = `${+lat.toFixed(6)},${+lng.toFixed(6)}`;
  const novoHash = `#consulta?${params}`;
  if (location.hash !== novoHash) history.pushState(null, "", novoHash);
  rota();
  const el = document.getElementById("resultado");
  el.innerHTML = `<div class="vazio"><span class="spinner"></span>Analisando os riscos deste local...</div>`;
  try {
    if (!rotulo) rotulo = (await enderecoDoPonto(lat, lng)) || `Ponto ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const res = await analisarPonto(lat, lng, rotulo);
    if (res.fora) {
      el.innerHTML = `<div class="vazio"><b>Este local fica fora do município de São Paulo.</b><br>O GeoRisco SP cobre apenas a capital. Para outras cidades, procure a Defesa Civil municipal.</div>`;
      return;
    }
    resultadoAtual = res;
    renderizar(res);
    focarPonto(lat, lng, rotulo);
  } catch (e) {
    erro(e);
    el.innerHTML = `<div class="vazio">Não foi possível concluir a análise. Verifique sua conexão e tente novamente.</div>`;
  }
}

function medidor(n, cor) {
  return `<div class="medidor" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? "on" : ""}" style="--c:${cor}"></i>`).join("")}</div>`;
}

function renderizar(res) {
  const d = res.distrito;
  const z = res.zona;
  const el = document.getElementById("resultado");
  const prox = [
    ...res.perto.geo.map((x) => ({ d: x.d, t: `Risco de ${x.p.processo.toLowerCase()} ${x.p.grau}`, n: `${x.p.nome} (setor ${x.p.setor}) · ${fmt(x.p.moradias)} moradias` })),
    ...res.perto.hid.map((x) => ({ d: x.d, t: `Risco de ${x.p.processo.toLowerCase()} ${x.p.grau}`, n: `${x.p.nome} (setor ${x.p.setor})` })),
    ...res.perto.cont.map((x) => ({ d: x.d, t: `Área ${x.p.classe.toLowerCase()}`, n: `${x.p.endereco} · ${x.p.contaminantes}` })),
  ].sort((a, b) => a.d - b.d).slice(0, 12);
  const ocs = res.perto.oc.reduce((m, x) => ((m[x.p.tipo] = (m[x.p.tipo] || 0) + 1), m), {});

  el.innerHTML = `
  <div class="res-cab">
    <div class="zona" style="--c:${z.cor}">
      <p class="rotulo">Resultado da consulta</p>
      <p class="end">${esc(res.endereco)}</p>
      <div class="nivel-grande"><h2>${z.nome}</h2><span class="tag-nivel" style="--c:${z.cor}">Risco ${z.nivelNome.toLowerCase()}</span></div>
      <p>${esc(z.frase)}</p>
      <div class="tipo">
        <div><span>Tipo de zona</span>${esc(z.tipo)}</div>
        ${res.terreno ? `<div><span>Terreno</span>${esc(res.terreno.tipo)}. ${esc(res.terreno.explicacao)}</div>` : ""}
        <div><span>Localização</span>Distrito ${esc(d.nome)} · Subprefeitura ${esc(d.subprefeitura)} · Região ${esc(d.regiao)}</div>
      </div>
    </div>
    <div id="mini-mapa" class="mini-mapa" aria-label="Mapa do local consultado"></div>
  </div>

  <div class="acoes-res">
    <button class="btn btn-pri" data-pdf>${icone("i-baixar")}Relatório em PDF</button>
    <button class="btn btn-sec" data-xlsx>${icone("i-baixar")}Planilha Excel</button>
    <button class="btn btn-sec" data-share>${icone("i-compartilhar")}Compartilhar</button>
    <a class="btn btn-sec" href="#mapa" data-mapa>${icone("i-mapa")}Ver no mapa</a>
    <button class="btn btn-sec" data-distrito>${icone("i-grafico")}Painel do distrito</button>
  </div>

  <div class="titulo-bloco"><h2>Riscos para este endereço</h2><span class="nota">Escala de 0 (baixo) a 4 (muito alto)</span></div>
  <div class="riscos-lista">
    ${res.riscos.map((r) => {
      const nv = NIVEIS[r.nivel];
      return `<article class="risco-item">
        <h3><span>${icone(r.icone)}${r.nome}</span><span class="tag-nivel" style="--c:${nv.cor}">${nv.nome}</span></h3>
        ${medidor(r.nivel, nv.cor)}
        <p class="porque">Por quê</p><ul>${r.motivos.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
        <p class="porque">O que fazer</p><ul class="recomendacoes">${r.dicas.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      </article>`;
    }).join("")}
  </div>

  <div class="grade-2">
    <div class="cartao"><h3>${icone("i-chuva")}Chuva prevista para este local</h3><div id="res-chuva"><span class="spinner"></span>Carregando...</div></div>
    <div class="cartao">
      <h3>${icone("i-grafico")}Seu distrito: ${esc(d.nome)}</h3>
      <p><span class="tag-nivel" style="--c:${NIVEL_DISTRITO[d.nivel]}">Índice ${d.idx_geral} de 100 · ${d.nivel}</span> <span class="nota">&nbsp;${d.ranking}º entre os 96 distritos</span></p>
      <ul class="lista-simples">
        <li><b>${d.geo_total}</b> setores de risco de deslizamento ou solapamento (${d.geo_R3 + d.geo_R4} de grau alto ou muito alto)</li>
        <li><b>${d.hid_total}</b> setores de risco de alagamento ou inundação (${d.hid_R3 + d.hid_R4} de grau alto ou muito alto)</li>
        <li><b>${fmt(d.moradias_alto)}</b> moradias em setores de risco alto ou muito alto</li>
        <li><b>${d.cont_total}</b> áreas contaminadas cadastradas</li>
        <li><b>${d.oc_total}</b> ocorrências registradas em 2026</li>
      </ul>
      <h3 style="margin-top:16px">Histórico num raio de 500 m (2026)</h3>
      <p class="nota">${Object.keys(ocs).length ? Object.entries(ocs).map(([t, n]) => `${n} ${esc(t.toLowerCase())}`).join(" · ") : "Nenhuma ocorrência registrada."}</p>
    </div>
  </div>

  <div class="cartao">
    <h3>${icone("i-pin")}Áreas de risco e áreas contaminadas próximas</h3>
    ${prox.length ? `<ul class="lista-simples">${prox.map((p) => `<li><span class="dist">${p.d === 0 ? "No local" : p.d + " m"}</span>${esc(p.t)}<br><small class="nota">${esc(p.n)}</small></li>`).join("")}</ul>`
      : `<p class="nota">Nenhuma área de risco mapeada num raio de 300 m, nem área contaminada num raio de 500 m.</p>`}
  </div>

  <p class="alerta">Resultado informativo, baseado nos dados públicos da Prefeitura. A posição do endereço pode ter imprecisão de dezenas de metros. Não substitui a vistoria da Defesa Civil (<b>199</b>) ou laudo de profissional habilitado.</p>`;

  miniMapa(document.getElementById("mini-mapa"), res);
  el.querySelector("[data-pdf]").onclick = () => { try { exportarEnderecoPDF(res); } catch (e) { erro(e); } };
  el.querySelector("[data-xlsx]").onclick = () => { try { exportarEnderecoXLSX(res); } catch (e) { erro(e); } };
  el.querySelector("[data-distrito]").onclick = () => abrirDistrito(d.id);
  el.querySelector("[data-mapa]").onclick = (e) => {
    e.preventDefault();
    location.hash = "mapa";
    setTimeout(() => focarPonto(res.lat, res.lng, res.endereco), 400);
  };
  el.querySelector("[data-share]").onclick = async () => {
    const url = location.href;
    const texto = `GeoRisco SP: ${res.endereco}. ${z.nome}, risco ${z.nivelNome.toLowerCase()}.`;
    try {
      if (navigator.share) await navigator.share({ title: "GeoRisco SP", text: texto, url });
      else { await navigator.clipboard.writeText(url); toast("Link copiado! Cole onde quiser compartilhar."); }
    } catch { /* cancelado */ }
  };
  obterChuva(res.lat, res.lng)
    .then((c) => (document.getElementById("res-chuva").innerHTML = chuvaHTML(c, d.nome)))
    .catch(() => (document.getElementById("res-chuva").textContent = "Previsão indisponível no momento."));
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------ início
async function kpisInicio() {
  try {
    const { distritos: D } = await carregar("resumo.json");
    const s = (k) => D.reduce((a, d) => a + d[k], 0);
    document.getElementById("kpis-inicio").innerHTML = kpisHTML([
      { v: s("geo_total"), t: "setores com risco de deslizamento ou solapamento" },
      { v: s("hid_total"), t: "setores com risco de alagamento ou inundação" },
      { v: s("moradias_alto"), t: "moradias em setores de risco alto ou muito alto" },
      { v: s("cont_contaminada") + s("cont_investigacao") + s("cont_monitoramento"), t: "áreas contaminadas ainda não reabilitadas" },
    ]);
  } catch (e) { console.error(e); }
}

// ------------------------------------------------------------ geral
document.querySelector(".menu-btn").addEventListener("click", (e) => {
  const m = document.getElementById("menu");
  m.classList.toggle("aberto");
  e.currentTarget.setAttribute("aria-expanded", m.classList.contains("aberto"));
});
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-ver-mapa]");
  if (a) { e.preventDefault(); location.hash = "mapa"; setTimeout(() => focarDistrito(a.dataset.verMapa), 500); }
});
window.addEventListener("hashchange", rota);
window.addEventListener("popstate", rota);
rota();
kpisInicio();
