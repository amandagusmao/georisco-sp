// Análise de risco de um ponto (endereço) cruzando as camadas oficiais.
import { carregar, CAMADAS_ANALISE, NIVEIS, fmt, dataBR } from "./dados.js";

const GRAU_NIVEL = { R1: 1, R2: 2, R3: 3, R4: 4 };
const GRAU_TXT = { R1: "R1 (baixo)", R2: "R2 (médio)", R3: "R3 (alto)", R4: "R4 (muito alto)" };

function proximos(feats, lng, lat, raio) {
  const dLat = raio / 111320;
  const dLng = raio / (111320 * Math.cos((lat * Math.PI) / 180));
  return feats.filter((f) => lng >= f.bbox[0] - dLng && lng <= f.bbox[2] + dLng && lat >= f.bbox[1] - dLat && lat <= f.bbox[3] + dLat);
}

function distancia(pt, f) {
  const g = f.geometry;
  if (g.type === "Point") return turf.distance(pt, g.coordinates, { units: "meters" });
  if (turf.booleanPointInPolygon(pt, f)) return 0;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let min = Infinity;
  for (const p of polys) for (const anel of p) {
    if (anel.length < 2) continue;
    const d = turf.pointToLineDistance(pt, turf.lineString(anel), { units: "meters" });
    if (d < min) min = d;
  }
  return min;
}

function comDistancia(feats, pt, lng, lat, raio) {
  return proximos(feats, lng, lat, raio)
    .map((f) => ({ f, p: f.properties, d: Math.round(distancia(pt, f)) }))
    .filter((x) => x.d <= raio)
    .sort((a, b) => a.d - b.d);
}

export async function preCarregar() {
  return Promise.all(CAMADAS_ANALISE.map(carregar));
}

export async function analisarPonto(lat, lng, endereco) {
  const [dist, geo, hid, cont, oc, inund, carta] = await preCarregar();
  const pt = turf.point([lng, lat]);

  const distrito = proximos(dist.features, lng, lat, 0).find((f) => turf.booleanPointInPolygon(pt, f))?.properties;
  if (!distrito) return { fora: true, lat, lng, endereco };

  const terreno = proximos(carta.features, lng, lat, 0).find((f) => turf.booleanPointInPolygon(pt, f))?.properties || null;
  const geoPerto = comDistancia(geo.features, pt, lng, lat, 300);
  const hidPerto = comDistancia(hid.features, pt, lng, lat, 300);
  const contPerto = comDistancia(cont.features, pt, lng, lat, 500);
  const ocPerto = comDistancia(oc.features, pt, lng, lat, 500);
  const naInundavel = proximos(inund.features, lng, lat, 0).some((f) => turf.booleanPointInPolygon(pt, f));

  const contaOc = (tipo) => ocPerto.filter((x) => x.p.tipo === tipo).length;
  const relevo = terreno?.tipo || "";
  const encosta = ["Morro baixo", "Morro alto", "Serra", "Morrote alto"].includes(relevo);
  const ondulado = ["Morrote", "Morrote baixo"].includes(relevo);

  // ------------------------------------------------ deslizamento
  const desl = { id: "deslizamento", nome: "Deslizamento de terra", icone: "i-morro", nivel: 0, motivos: [] };
  const geoEsc = geoPerto.filter((x) => /Escorregamento/i.test(x.p.processo));
  for (const x of geoEsc) {
    if (x.d === 0) {
      desl.nivel = Math.max(desl.nivel, GRAU_NIVEL[x.p.grau]);
      desl.motivos.push(`Dentro do setor de risco ${x.p.setor} (“${x.p.nome}”), grau ${GRAU_TXT[x.p.grau]}, mapeado pela Prefeitura.`);
    } else if (x.d <= 150) {
      const n = GRAU_NIVEL[x.p.grau] >= 3 ? 2 : 1;
      if (n > desl.nivel) desl.nivel = n;
      if (desl.motivos.length < 3) desl.motivos.push(`Setor de risco ${x.p.grau} (“${x.p.nome}”) a ${x.d} m.`);
    }
  }
  if (encosta) { desl.nivel = Math.max(desl.nivel, 2); desl.motivos.push(`Terreno de ${relevo.toLowerCase()}: encostas inclinadas favorecem deslizamentos.`); }
  else if (ondulado) { desl.nivel = Math.max(desl.nivel, 1); desl.motivos.push(`Terreno de ${relevo.toLowerCase()}: cortes e aterros podem escorregar.`); }
  const nDesl = contaOc("Deslizamento");
  if (nDesl) { desl.nivel = Math.max(desl.nivel, nDesl >= 3 ? 2 : 1); desl.motivos.push(`${nDesl} ocorrência(s) de deslizamento registrada(s) em 2026 num raio de 500 m.`); }

  // ------------------------------------------------ alagamento / inundação
  const alag = { id: "alagamento", nome: "Alagamento e inundação", icone: "i-agua", nivel: 0, motivos: [] };
  for (const x of hidPerto) {
    if (x.d === 0) {
      alag.nivel = Math.max(alag.nivel, GRAU_NIVEL[x.p.grau]);
      alag.motivos.push(`Dentro do setor de risco hidrológico ${x.p.setor} (“${x.p.nome}”), grau ${GRAU_TXT[x.p.grau]}, ${x.p.processo.toLowerCase()}.`);
    } else if (x.d <= 150) {
      const n = GRAU_NIVEL[x.p.grau] >= 3 ? 2 : 1;
      if (n > alag.nivel) alag.nivel = n;
      if (alag.motivos.length < 3) alag.motivos.push(`Setor de risco de ${x.p.processo.toLowerCase()} (${x.p.grau}) a ${x.d} m.`);
    }
  }
  if (naInundavel) { alag.nivel = Math.max(alag.nivel, 3); alag.motivos.push("Dentro da mancha de inundação para chuvas extremas (período de retorno de 100 anos)."); }
  if (relevo === "Planície de rio") { alag.nivel = Math.max(alag.nivel, 2); alag.motivos.push("Terreno de várzea (planície de rio): área baixa e plana que naturalmente recebe a água das cheias."); }
  else if (relevo === "Terraço") { alag.nivel = Math.max(alag.nivel, 1); alag.motivos.push("Terreno de terraço, próximo às várzeas: pode alagar em chuvas fortes."); }
  const nAlag = contaOc("Alagamento") + contaOc("Inundação");
  if (nAlag) { alag.nivel = Math.max(alag.nivel, nAlag >= 3 ? 2 : 1); alag.motivos.push(`${nAlag} ocorrência(s) de alagamento/inundação registrada(s) em 2026 num raio de 500 m.`); }

  // ------------------------------------------------ erosão / solapamento
  const eros = { id: "erosao", nome: "Erosão e solapamento", icone: "i-erosao", nivel: 0, motivos: [] };
  for (const x of geoPerto.filter((y) => /Solapamento/i.test(y.p.processo))) {
    if (x.d === 0) {
      eros.nivel = Math.max(eros.nivel, GRAU_NIVEL[x.p.grau]);
      eros.motivos.push(`Dentro do setor ${x.p.setor} (“${x.p.nome}”) com risco de solapamento de margem de córrego, grau ${GRAU_TXT[x.p.grau]}.`);
    } else if (x.d <= 150) {
      const n = GRAU_NIVEL[x.p.grau] >= 3 ? 2 : 1;
      if (n > eros.nivel) eros.nivel = n;
      if (eros.motivos.length < 3) eros.motivos.push(`Margem de córrego com risco de solapamento (${x.p.grau}) a ${x.d} m.`);
    }
  }
  if (encosta || ondulado) { eros.nivel = Math.max(eros.nivel, 1); eros.motivos.push("Relevo inclinado: a água da chuva escoa com força e pode abrir sulcos e ravinas."); }
  const nEros = contaOc("Erosão (chamado)");
  if (nEros) { eros.nivel = Math.max(eros.nivel, 1); eros.motivos.push(`${nEros} chamado(s) de erosão à Prefeitura num raio de 500 m.`); }

  // ------------------------------------------------ solo contaminado
  const cont_ = { id: "contaminacao", nome: "Solo contaminado", icone: "i-frasco", nivel: 0, motivos: [] };
  const PESO = { "Contaminada": 4, "Contaminada Sob Investigação": 3, "Em Processo de Monitoramento para Reabilitação": 2, "Reabilitada": 1 };
  for (const x of contPerto) {
    const base = PESO[x.p.classe] || 1;
    let n = 0;
    if (x.d <= 30) n = base;
    else if (x.d <= 100) n = base >= 3 ? 2 : 1;
    else if (x.d <= 300 && base >= 2) n = 1;
    if (n) {
      cont_.nivel = Math.max(cont_.nivel, n);
      if (cont_.motivos.length < 4) cont_.motivos.push(`${x.d <= 30 ? "No local" : `A ${x.d} m`}: área “${x.p.classe.toLowerCase()}” (${x.p.contaminantes}).`);
    }
  }

  const riscos = [desl, alag, eros, cont_];
  for (const r of riscos) {
    if (!r.motivos.length) r.motivos.push(r.id === "contaminacao"
      ? "Nenhuma área contaminada cadastrada num raio de 300 m."
      : "Nenhum setor de risco mapeado num raio de 150 m e terreno sem predisposição importante.");
    r.dicas = DICAS[r.id][r.nivel >= 3 ? "alto" : r.nivel >= 1 ? "medio" : "baixo"];
  }

  const max = Math.max(...riscos.map((r) => r.nivel));
  const principal = riscos.reduce((a, b) => (b.nivel > a.nivel ? b : a));
  const geoDentro = geoPerto.filter((x) => x.d === 0).sort((a, b) => GRAU_NIVEL[b.p.grau] - GRAU_NIVEL[a.p.grau])[0];
  const hidDentro = hidPerto.filter((x) => x.d === 0).sort((a, b) => GRAU_NIVEL[b.p.grau] - GRAU_NIVEL[a.p.grau])[0];
  const contDentro = contPerto.find((x) => x.d <= 30 && PESO[x.p.classe] >= 2);
  let tipoZona;
  if (geoDentro) tipoZona = `Setor de risco geológico ${geoDentro.p.grau} (${geoDentro.p.processo.toLowerCase()})`;
  else if (hidDentro) tipoZona = `Setor de risco hidrológico ${hidDentro.p.grau} (${hidDentro.p.processo.toLowerCase()})`;
  else if (naInundavel) tipoZona = "Zona inundável (várzea de rio)";
  else if (contDentro) tipoZona = "Área contaminada cadastrada";
  else if (relevo === "Planície de rio") tipoZona = "Zona de várzea, suscetível a inundação";
  else if (encosta) tipoZona = "Zona de encosta, suscetível a deslizamento";
  else tipoZona = "Fora de setores de risco mapeados";

  const ZONAS = ["Zona Verde", "Zona Amarela", "Zona Laranja", "Zona Vermelha", "Zona Crítica"];
  const FRASE = [
    "Risco baixo: não encontramos situações de risco relevantes perto deste endereço.",
    "Atenção: existem fatores de risco nas proximidades. Fique atento em dias de chuva forte.",
    "Risco médio: há fatores de risco relevantes. Conheça os sinais de alerta e tenha um plano.",
    "Risco alto: o endereço está em área de risco ou muito próximo de uma. Siga as orientações da Defesa Civil.",
    "Risco muito alto: área classificada como de risco muito alto. Em chuvas fortes, saia preventivamente e ligue 199.",
  ];

  return {
    lat, lng, endereco, distrito, terreno, riscos, naInundavel,
    zona: { nivel: max, nome: ZONAS[max], cor: NIVEIS[max].cor, nivelNome: NIVEIS[max].nome, tipo: tipoZona, frase: FRASE[max], principal: max ? principal.nome : null },
    perto: { geo: geoPerto, hid: hidPerto, cont: contPerto, oc: ocPerto },
    data: new Date(),
  };
}

const DICAS = {
  deslizamento: {
    baixo: ["Mantenha calhas e drenagem limpas.", "Evite cortes e aterros sem orientação técnica."],
    medio: ["Observe rachaduras em paredes, muros e no chão, principalmente após chuvas.", "Não jogue lixo, entulho ou água servida no barranco.", "Mantenha a vegetação das encostas (grama, arbustos)."],
    alto: ["Em chuva forte e contínua, saia preventivamente para um local seguro.", "Ao perceber trincas novas, estalos, árvores ou postes inclinando: saia e ligue 199.", "Cadastre seu CEP no SMS 40199 para receber alertas.", "Peça vistoria à Defesa Civil (199) ou pelo 156."],
  },
  alagamento: {
    baixo: ["Não jogue lixo na rua: ele entope bueiros.", "Evite estacionar em baixadas em dias de chuva forte."],
    medio: ["Guarde documentos e eletrônicos em locais altos.", "Não atravesse ruas alagadas a pé ou de carro.", "Informe bueiros entupidos ao 156."],
    alto: ["Tenha um plano de saída para um local alto e combine com a família.", "Desligue a energia elétrica se a água entrar em casa.", "Evite contato com água de enchente (risco de leptospirose).", "Cadastre seu CEP no SMS 40199 e acompanhe o CGE."],
  },
  erosao: {
    baixo: ["Direcione a água do telhado para a rede de drenagem."],
    medio: ["Não deixe água escorrer solta no terreno; use calhas e canaletas.", "Plante grama ou vegetação em áreas de solo exposto.", "Comunique buracos e sulcos crescentes ao 156."],
    alto: ["Não construa ou amplie casa na beira do córrego.", "Observe a margem: se estiver desmoronando, afaste-se e ligue 199.", "Solicite vistoria da Defesa Civil."],
  },
  contaminacao: {
    baixo: ["Não há indicação de área contaminada próxima."],
    medio: ["Não use água de poço sem análise de laboratório.", "Evite cultivar alimentos diretamente no solo sem saber a origem do terreno."],
    alto: ["Não use água de poço nem cultive alimentos no local.", "Antes de comprar, construir ou escavar, consulte a CETESB e a Prefeitura (SVMA).", "Ambientes fechados (subsolo) devem ser bem ventilados."],
  },
};

export function resumoTexto(res) {
  return `${res.zona.nome} (${res.zona.nivelNome}): ${res.zona.tipo}. Distrito ${res.distrito.nome}.`;
}

export { fmt, dataBR };
