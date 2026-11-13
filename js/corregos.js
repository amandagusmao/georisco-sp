// Córregos e rios (camada "drenagem" do GeoSampa), divididos em blocos de ~3 km por tools/corregos.py.
const VERSAO = 5;
let indiceP;
const cache = {};

export const TIPO_CORREGO = {
  n: "leito natural, a céu aberto",
  a: "canalizado a céu aberto",
  s: "canalizado sob a rua (subterrâneo)",
  l: "trecho em lago ou represa",
};
export const COR_CORREGO = { n: "#38bdf8", a: "#0ea5e9", s: "#64748b", l: "#7dd3fc" };

export function indiceCorregos() {
  if (!indiceP) indiceP = fetch(`data/corregos/indice.json?v=${VERSAO}`).then((r) => r.json()).then((ix) => ({ ...ix, set: new Set(ix.blocos) }));
  return indiceP;
}

export function blocoCorregos(k) {
  if (!cache[k]) cache[k] = fetch(`data/corregos/${k}.json?v=${VERSAO}`).then((r) => r.json()).catch((e) => { delete cache[k]; throw e; });
  return cache[k];
}

export async function blocosNaArea(oeste, sul, leste, norte) {
  const ix = await indiceCorregos();
  const p = ix.passo;
  const chaves = [];
  for (let i = Math.floor(oeste / p); i <= Math.floor(leste / p); i++) {
    for (let j = Math.floor(sul / p); j <= Math.floor(norte / p); j++) {
      const k = `${i}_${j}`;
      if (ix.set.has(k)) chaves.push(k);
    }
  }
  return chaves;
}

const chaveTrecho = (f) => `${f.geometry.coordinates[0]}|${f.geometry.coordinates.length}|${f.properties.t}`;

// Trechos a até `raio` metros do ponto, do mais próximo ao mais distante.
export async function corregosPerto(lat, lng, raio = 200) {
  const dLat = raio / 111320;
  const dLng = raio / (111320 * Math.cos((lat * Math.PI) / 180));
  const chaves = await blocosNaArea(lng - dLng, lat - dLat, lng + dLng, lat + dLat);
  const vistos = new Set();
  const pt = turf.point([lng, lat]);
  const out = [];
  for (const fc of await Promise.all(chaves.map(blocoCorregos))) {
    for (const f of fc.features) {
      const k = chaveTrecho(f);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const c = f.geometry.coordinates;
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const [x, y] of c) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      if (lng < minX - dLng || lng > maxX + dLng || lat < minY - dLat || lat > maxY + dLat) continue;
      const d = Math.round(turf.pointToLineDistance(pt, f, { units: "meters" }));
      if (d <= raio) out.push({ f, p: f.properties, d });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}

export function nomeCorrego(p) {
  return p.n || "Córrego sem nome no cadastro";
}
