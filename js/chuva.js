// Previsão e acumulado de chuva (Open-Meteo, gratuito e sem chave).
import { esc } from "./dados.js";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function obterChuva(lat = -23.55, lng = -46.63) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=7&timezone=America%2FSao_Paulo`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Previsão indisponível no momento.");
  const d = (await r.json()).daily;
  const passado = d.precipitation_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0);
  const dias = d.time.slice(3).map((t, i) => ({ data: t, mm: d.precipitation_sum[i + 3] ?? 0, prob: d.precipitation_probability_max[i + 3] ?? 0 }));
  return { acumulado72h: Math.round(passado), dias };
}

export function classeChuva(mm) {
  if (mm >= 50) return { nome: "Muito forte", cor: "#6a1b9a" };
  if (mm >= 30) return { nome: "Forte", cor: "#d32f2f" };
  if (mm >= 10) return { nome: "Moderada", cor: "#ef6c00" };
  if (mm >= 0.5) return { nome: "Fraca", cor: "#29b6f6" };
  return { nome: "Sem chuva", cor: "#9ccc65" };
}

export function alertaChuva(c) {
  const max48 = Math.max(c.dias[0]?.mm || 0, c.dias[1]?.mm || 0);
  const acum = c.acumulado72h + (c.dias[0]?.mm || 0);
  if (max48 >= 50 || acum >= 120) return { nivel: 3, cor: "#6a1b9a", titulo: "Alerta: chuva muito forte", texto: "Alto risco de alagamentos, inundações e deslizamentos. Quem mora em encostas ou perto de córregos deve se preparar para sair preventivamente. Acompanhe a Defesa Civil (199)." };
  if (max48 >= 30 || acum >= 80) return { nivel: 2, cor: "#d32f2f", titulo: "Atenção: chuva forte ou solo encharcado", texto: "Risco de alagamentos e de deslizamentos em encostas. Observe rachaduras, evite áreas alagadas e mantenha documentos em local seguro." };
  if (max48 >= 10) return { nivel: 1, cor: "#ef6c00", titulo: "Observação: chuva moderada prevista", texto: "Podem ocorrer alagamentos pontuais. Evite jogar lixo na rua e fique atento aos avisos." };
  return { nivel: 0, cor: "#2e7d32", titulo: "Sem alerta de chuva forte", texto: "Não há previsão de chuva forte nas próximas 48 horas. Aproveite para limpar calhas e verificar a drenagem." };
}

export function chuvaHTML(c, local = "São Paulo (centro)") {
  const a = alertaChuva(c);
  return `<div class="chuva-alerta" style="--c:${a.cor}"><h2>${a.titulo}</h2><p style="margin:0">${a.texto}</p>
    <p style="margin:.5em 0 0;opacity:.9;font-size:.92rem">Local: ${esc(local)} · Chuva acumulada nos últimos 3 dias: <b>${c.acumulado72h} mm</b></p></div>
    <div class="dias">${c.dias.map((d) => {
      const k = classeChuva(d.mm);
      const dt = new Date(d.data + "T12:00:00");
      return `<div class="dia" style="--c:${k.cor}"><small>${DIAS[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}</small><b>${Math.round(d.mm)} mm</b><small>${k.nome}</small><small>${d.prob}% de chance</small></div>`;
    }).join("")}</div>
    <p class="nota">Referência: acima de 30 mm em um dia é chuva forte; acima de 80 mm acumulados em 3 dias o solo das encostas fica saturado e o risco de deslizamento aumenta.</p>`;
}

export async function iniciarChuva() {
  const el = document.getElementById("chuva-conteudo");
  try {
    el.innerHTML = chuvaHTML(await obterChuva());
  } catch (e) {
    el.innerHTML = `<div class="vazio">${esc(e.message)}</div>`;
  }
}
