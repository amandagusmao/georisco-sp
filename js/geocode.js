// Conversão de endereço/CEP em coordenadas (serviços gratuitos: ViaCEP + Nominatim/OSM).
const VIEWBOX = "-46.83,-23.35,-46.35,-24.01"; // município de São Paulo
const NOMINATIM = "https://nominatim.openstreetmap.org";

let ultimaChamada = 0;
async function nominatim(path, params) {
  // Política de uso do Nominatim: no máximo 1 requisição por segundo.
  const espera = 1100 - (Date.now() - ultimaChamada);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaChamada = Date.now();
  const url = `${NOMINATIM}/${path}?${new URLSearchParams({ format: "jsonv2", "accept-language": "pt-BR", ...params })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Serviço de endereços indisponível. Tente novamente em instantes.");
  return r.json();
}

function rotulo(item) {
  const a = item.address || {};
  const rua = [a.road, a.house_number].filter(Boolean).join(", ");
  const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
  const partes = [rua || item.name, bairro, "São Paulo - SP"].filter(Boolean);
  return [...new Set(partes)].join(" – ");
}

export async function buscarEndereco(texto) {
  texto = texto.trim();
  const cep = texto.replace(/\D/g, "");
  if (/^\d{8}$/.test(cep) && /^\s*\d{5}-?\d{3}\s*$/.test(texto)) return buscarCEP(cep);

  const base = { q: `${texto}, São Paulo, SP, Brasil`, countrycodes: "br", viewbox: VIEWBOX, bounded: 1, addressdetails: 1, limit: 6 };
  let res = await nominatim("search", base);
  if (!res.length) {
    // tenta sem o número da casa
    const semNumero = texto.replace(/,?\s*\d+[a-z]?\s*$/i, "");
    if (semNumero !== texto) res = await nominatim("search", { ...base, q: `${semNumero}, São Paulo, SP, Brasil` });
  }
  const vistos = new Set();
  return res.map((i) => ({ lat: +i.lat, lng: +i.lon, rotulo: rotulo(i), tipo: i.type }))
    .filter((r) => !vistos.has(r.rotulo) && vistos.add(r.rotulo));
}

async function buscarCEP(cep) {
  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!r.ok) throw new Error("Não foi possível consultar o CEP.");
  const d = await r.json();
  if (d.erro) throw new Error("CEP não encontrado.");
  if (d.localidade !== "São Paulo") throw new Error(`Esse CEP é de ${d.localidade}/${d.uf}. O GeoRisco SP cobre apenas o município de São Paulo.`);
  const rua = d.logradouro || "";
  const tentativas = [
    { street: rua, city: "São Paulo", state: "SP", country: "Brasil" },
    { q: `${rua}, ${d.bairro}, São Paulo, SP` },
    { q: `${d.bairro}, São Paulo, SP` },
  ];
  for (const t of tentativas) {
    if (!rua && (t.street || t.q?.startsWith(","))) continue;
    const res = await nominatim("search", { ...t, countrycodes: "br", viewbox: VIEWBOX, bounded: 1, addressdetails: 1, limit: 1 });
    if (res.length) {
      const i = res[0];
      return [{ lat: +i.lat, lng: +i.lon, rotulo: `${[rua, d.bairro].filter(Boolean).join(" – ")} – São Paulo - SP – CEP ${d.cep}`, tipo: "cep" }];
    }
  }
  throw new Error("Não conseguimos localizar esse CEP no mapa. Tente digitar o endereço com número.");
}

export async function enderecoDoPonto(lat, lng) {
  try {
    const i = await nominatim("reverse", { lat, lon: lng, zoom: 18, addressdetails: 1 });
    return i && !i.error ? rotulo(i) : null;
  } catch { return null; }
}
