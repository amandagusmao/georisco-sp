// Consulta aos rasters de inundação e declividade (gerados por tools/rasters.py).
// Cada pixel dos blocos guarda: inundação (0 nenhuma, 1 = 5 anos, 2 = 25 anos, 3 = 100 anos)
// + 4 * declividade (0 sem dado, 1 = 0 a 5%, 2 = 5 a 25%, 3 = 25 a 60%, 4 = acima de 60%).
const R = 6378137;
let metaP;
const blocos = {};

export function carregarMeta() {
  if (!metaP) metaP = fetch("data/raster/meta.json").then((r) => r.json()).then((m) => ({ ...m, set: new Set(m.blocos) }));
  return metaP;
}

function bloco(nome, tam) {
  if (!blocos[nome]) {
    blocos[nome] = new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = tam;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, tam, tam).data;
        const v = new Uint8Array(tam * tam);
        for (let i = 0; i < v.length; i++) v[i] = d[i * 4];
        ok(v);
      };
      img.onerror = () => { delete blocos[nome]; falha(new Error("bloco indisponível")); };
      img.src = `data/raster/t/${nome}.png`;
    });
  }
  return blocos[nome];
}

async function valor(m, px, py) {
  if (px < 0 || py < 0 || px >= m.w || py >= m.h) return 0;
  const nome = `${Math.floor(px / m.tile)}_${Math.floor(py / m.tile)}`;
  if (!m.set.has(nome)) return 0;
  const v = await bloco(nome, m.tile);
  return v[(py % m.tile) * m.tile + (px % m.tile)];
}

export async function consultarRaster(lat, lng) {
  const m = await carregarMeta();
  const x = R * (lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const px = Math.floor((x - m.x0) / m.res);
  const py = Math.floor((m.y1 - y) / m.res);
  const v = await valor(m, px, py);
  // vizinhança de ~30 m (a localização do endereço tem imprecisão)
  let inundPerto = 0;
  const raio = 3;
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (dx * dx + dy * dy > raio * raio) continue;
      const c = (await valor(m, px + dx, py + dy)) % 4;
      if (c && (!inundPerto || c < inundPerto)) inundPerto = c;
    }
  }
  return { inund: v % 4, decl: Math.floor(v / 4), inundPerto };
}

export async function limitesRaster() {
  const m = await carregarMeta();
  return [[m.sul, m.oeste], [m.norte, m.leste]];
}
