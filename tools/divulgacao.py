"""
Gera o material de divulgação do GeoRisco SP (cartaz A4, folheto A5 e imagem para WhatsApp)
com QR Code para o site.

Uso:  python tools/divulgacao.py
Requer: pip install qrcode  e o Google Chrome (ou Microsoft Edge) instalado.
Saídas em assets/divulgacao/
"""
import os
import subprocess
import tempfile
from pathlib import Path

import qrcode
import qrcode.image.svg

URL = "https://amandagusmao.github.io/georisco-sp/"
URL_CURTA = "amandagusmao.github.io/georisco-sp"
RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "assets" / "divulgacao"
SAIDA.mkdir(parents=True, exist_ok=True)
NAVEGADORES = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
               r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
               "google-chrome", "chromium", "msedge"]
NAV = next((n for n in NAVEGADORES if os.path.exists(n)), NAVEGADORES[2])


def qr_svg(cor="#050807"):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(URL)
    q.make(fit=True)
    m = q.get_matrix()
    n = len(m)
    rects = "".join(f'<rect x="{x}" y="{y}" width="1.02" height="1.02"/>' for y, linha in enumerate(m) for x, v in enumerate(linha) if v)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges"><g fill="{cor}">{rects}</g></svg>'


LOGO = """<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset=".5" stop-color="#16a34a"/><stop offset="1" stop-color="#065f46"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="#050807"/><path d="M10 46 L25 21 L33 33 L40 25 L54 46 Z" fill="url(#lg)"/><path d="M10 52 c5 0 5-3 11-3 s6 3 11 3 6-3 11-3 6 3 11 3" fill="none" stroke="#86efac" stroke-width="3" stroke-linecap="round"/></svg>"""

FONTES = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet">'

BASE_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, Arial, sans-serif; color: #0b1411; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, .marca, .num { font-family: Manrope, Inter, Arial, sans-serif; letter-spacing: -.02em; }
.faixa { background: linear-gradient(120deg, #030605 0%, #06150f 40%, #0d3b26 75%, #15803d 100%); color: #fff; }
.marca { display: flex; align-items: center; gap: 10px; font-weight: 800; }
.marca svg { flex: none; }
.marca em { font-style: normal; color: #4ade80; margin-left: 4px; }
.verde { color: #15803d; }
.qr { background: #fff; border: 2px solid #0b1411; border-radius: 14px; }
.passos { list-style: none; counter-reset: p; }
.passos li { counter-increment: p; position: relative; }
.passos li::before { content: counter(p); position: absolute; left: 0; top: 0; background: linear-gradient(135deg, #22c55e, #065f46); color: #fff; border-radius: 50%; font-family: Manrope, Arial; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.sinais li { list-style: none; position: relative; }
.sinais li::before { content: ""; position: absolute; left: 0; border-left: 2.5px solid #15803d; border-bottom: 2.5px solid #15803d; transform: rotate(-45deg); }
.emerg { display: flex; justify-content: space-between; gap: 8px; }
.emerg div { text-align: center; }
.emerg b { display: block; font-family: Manrope, Arial; font-weight: 800; color: #4ade80; }
.creditos { color: #4b5c58; }
"""

QR = qr_svg()
QR_CLARO = qr_svg("#050807")


def cartaz():
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">{FONTES}<style>{BASE_CSS}
@page {{ size: A4; margin: 0; }}
html, body {{ width: 210mm; height: 296mm; overflow: hidden; }}
body {{ display: flex; flex-direction: column; }}
.topo {{ padding: 12mm 14mm 10mm; }}
.topo .marca {{ font-size: 20pt; }}
.topo .marca svg {{ width: 13mm; height: 13mm; }}
.topo p {{ margin-top: 3mm; color: #cfe3dc; font-size: 11pt; }}
main {{ flex: 1; padding: 9mm 14mm 6mm; display: flex; flex-direction: column; gap: 6mm; justify-content: space-between; }}
h1 {{ font-size: 34pt; line-height: 1.05; font-weight: 800; }}
.sub {{ font-size: 13pt; line-height: 1.45; color: #233; max-width: 175mm; }}
.meio {{ display: grid; grid-template-columns: 72mm 1fr; gap: 10mm; align-items: center; }}
.qr {{ padding: 6mm; }}
.qr svg {{ width: 100%; display: block; }}
.qr p {{ text-align: center; font-size: 9.5pt; margin-top: 3mm; font-weight: 600; }}
.passos {{ display: grid; gap: 5mm; }}
.passos li {{ padding-left: 13mm; font-size: 13pt; line-height: 1.35; min-height: 9mm; }}
.passos li::before {{ width: 9mm; height: 9mm; font-size: 13pt; }}
.passos b {{ display: block; font-size: 14pt; }}
.url {{ font-size: 12pt; font-weight: 700; margin-top: 2mm; }}
.alerta {{ border: 2px solid #15803d; border-radius: 12px; padding: 5mm 6mm; }}
.alerta h2 {{ font-size: 15pt; margin-bottom: 3mm; }}
.sinais {{ display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; }}
.sinais li {{ padding-left: 7mm; font-size: 11pt; line-height: 1.35; }}
.sinais li::before {{ top: 1.3mm; width: 3.2mm; height: 1.6mm; }}
.rodape {{ padding: 7mm 14mm 8mm; }}
.emerg b {{ font-size: 22pt; }}
.emerg span {{ font-size: 9pt; color: #cfe3dc; }}
.creditos {{ font-size: 8pt; padding: 3mm 14mm 5mm; text-align: center; }}
</style></head><body>
<div class="faixa topo"><div class="marca">{LOGO}<span>GeoRisco<em>SP</em></span></div>
<p>Mapa gratuito de riscos geológicos e ambientais da cidade de São Paulo</p></div>
<main>
<h1>Sua casa está em <span class="verde">área de risco?</span></h1>
<p class="sub">Descubra em um minuto, de graça, se o seu endereço tem risco de <b>alagamento</b>, <b>deslizamento de terra</b>, <b>erosão</b> ou <b>solo contaminado</b>, e saiba o que fazer.</p>
<div class="meio">
  <div class="qr">{QR}<p>Aponte a câmera do celular</p></div>
  <div>
    <ol class="passos">
      <li><b>Aponte a câmera</b>para o código ao lado.</li>
      <li><b>Digite seu endereço ou CEP</b>ou use a localização do celular.</li>
      <li><b>Veja a zona de risco</b>e as orientações. Dá para baixar em PDF.</li>
    </ol>
    <p class="url">{URL_CURTA}</p>
  </div>
</div>
<div class="alerta"><h2>Sinais de perigo: saia de casa e ligue 199</h2>
<ul class="sinais">
<li>Trincas novas em paredes, muros ou no chão</li>
<li>Portas e janelas que começam a emperrar</li>
<li>Árvores, postes ou muros inclinando</li>
<li>Água barrenta minando do barranco</li>
<li>Córrego subindo rápido ou água entrando em casa</li>
<li>Estalos ou barulho de terra se movendo</li>
</ul></div>
</main>
<div class="faixa rodape"><div class="emerg">
<div><b>199</b><span>Defesa Civil</span></div><div><b>193</b><span>Bombeiros</span></div><div><b>192</b><span>SAMU</span></div><div><b>156</b><span>Prefeitura</span></div><div><b>40199</b><span>SMS com seu CEP<br>para receber alertas</span></div>
</div></div>
<p class="creditos">Dados oficiais da Prefeitura de São Paulo (GeoSampa). Projeto de extensão universitária desenvolvido por João Batista de Gusmão Neto, com orientação técnica da Eng.ª Ambiental Amanda Ferreira Gusmão. Ferramenta informativa: não substitui a Defesa Civil.</p>
</body></html>"""


def folheto_unico():
    return f"""<section class="folheto">
<div class="faixa ftopo"><div class="marca">{LOGO}<span>GeoRisco<em>SP</em></span></div></div>
<div class="fcorpo">
<h1>Sua casa está em <span class="verde">área de risco?</span></h1>
<p class="sub">Consulte de graça os riscos de alagamento, deslizamento, erosão e solo contaminado do seu endereço.</p>
<div class="fmeio"><div class="qr">{QR}</div>
<ol class="passos"><li>Aponte a câmera para o código</li><li>Digite seu endereço ou CEP</li><li>Veja a zona de risco e o que fazer</li></ol></div>
<p class="url">{URL_CURTA}</p>
<p class="perigo"><b>Trincas novas, portas emperrando, muros inclinando ou água barrenta no barranco?</b> Saia de casa e ligue 199.</p>
</div>
<div class="faixa frodape"><div class="emerg"><div><b>199</b><span>Defesa Civil</span></div><div><b>193</b><span>Bombeiros</span></div><div><b>192</b><span>SAMU</span></div><div><b>40199</b><span>SMS com o CEP</span></div></div></div>
</section>"""


def folheto():
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">{FONTES}<style>{BASE_CSS}
@page {{ size: A4 landscape; margin: 0; }}
html, body {{ width: 297mm; height: 209mm; overflow: hidden; }}
body {{ display: grid; grid-template-columns: 1fr 1fr; }}
.folheto {{ height: 209mm; display: flex; flex-direction: column; border-right: 1px dashed #9ca3af; }}
.folheto:last-child {{ border-right: 0; }}
.ftopo {{ padding: 7mm 9mm; }}
.ftopo .marca {{ font-size: 15pt; }}
.ftopo .marca svg {{ width: 10mm; height: 10mm; }}
.fcorpo {{ flex: 1; padding: 8mm 9mm 6mm; display: flex; flex-direction: column; gap: 5mm; justify-content: space-between; }}
h1 {{ font-size: 27pt; line-height: 1.08; font-weight: 800; }}
.sub {{ font-size: 11.5pt; line-height: 1.4; color: #233; }}
.fmeio {{ display: grid; grid-template-columns: 62mm 1fr; gap: 6mm; align-items: center; }}
.qr {{ padding: 3.5mm; }}
.qr svg {{ width: 100%; display: block; }}
.passos {{ display: grid; gap: 3.5mm; }}
.passos li {{ padding-left: 9mm; font-size: 11.5pt; line-height: 1.3; min-height: 6.5mm; display: flex; align-items: center; }}
.passos li::before {{ width: 6.5mm; height: 6.5mm; font-size: 10pt; }}
.url {{ font-size: 11.5pt; font-weight: 700; }}
.perigo {{ font-size: 10.5pt; line-height: 1.4; border-left: 3px solid #15803d; padding-left: 3mm; }}
.frodape {{ padding: 5mm 9mm; }}
.emerg b {{ font-size: 15pt; }}
.emerg span {{ font-size: 7.5pt; color: #cfe3dc; }}
</style></head><body>{folheto_unico()}{folheto_unico()}</body></html>"""


def whatsapp():
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">{FONTES}<style>{BASE_CSS}
body {{ width: 1080px; height: 1350px; overflow: hidden; color: #fff;
  background: radial-gradient(70% 55% at 85% 8%, rgba(34,197,94,.30), rgba(34,197,94,0) 60%), linear-gradient(160deg, #030605 0%, #06150f 45%, #0a2a1c 75%, #0d3b26 100%);
  padding: 80px 80px 70px; display: flex; flex-direction: column; gap: 40px; }}
.marca {{ font-size: 44px; }}
.marca svg {{ width: 76px; height: 76px; }}
h1 {{ font-size: 96px; line-height: 1.02; font-weight: 800; }}
h1 span {{ background: linear-gradient(90deg, #86efac, #22c55e 55%, #10b981); -webkit-background-clip: text; background-clip: text; color: transparent; }}
.sub {{ font-size: 36px; line-height: 1.4; color: #c9d6d0; }}
.linha {{ display: grid; grid-template-columns: 340px 1fr; gap: 50px; align-items: center; }}
.qr {{ padding: 26px; border: 0; border-radius: 26px; }}
.qr svg {{ width: 100%; display: block; }}
.passos {{ display: grid; gap: 26px; }}
.passos li {{ padding-left: 74px; font-size: 34px; line-height: 1.25; min-height: 54px; display: flex; align-items: center; }}
.passos li::before {{ width: 54px; height: 54px; font-size: 30px; }}
.url {{ font-size: 34px; font-weight: 700; color: #86efac; }}
.emerg {{ margin-top: auto; border-top: 1px solid #26382f; padding-top: 34px; }}
.emerg b {{ font-size: 64px; }}
.emerg span {{ font-size: 24px; color: #9fb1a9; }}
</style></head><body>
<div class="marca">{LOGO}<span>GeoRisco<em>SP</em></span></div>
<h1>Sua casa está em <span>área de risco?</span></h1>
<p class="sub">Consulte de graça os riscos de alagamento, deslizamento, erosão e solo contaminado do seu endereço em São Paulo.</p>
<div class="linha"><div class="qr">{QR_CLARO}</div>
<ol class="passos"><li>Abra o link ou aponte a câmera</li><li>Digite seu endereço ou CEP</li><li>Veja a zona de risco e o que fazer</li></ol></div>
<p class="url">{URL_CURTA}</p>
<div class="emerg"><div><b>199</b><span>Defesa Civil</span></div><div><b>193</b><span>Bombeiros</span></div><div><b>192</b><span>SAMU</span></div><div><b>40199</b><span>SMS com o CEP</span></div></div>
</body></html>"""


def rodar(args):
    subprocess.run([NAV, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--hide-scrollbars",
                    "--virtual-time-budget=8000", *args], check=True, capture_output=True, timeout=180)


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    for nome, html in (("cartaz", cartaz()), ("folheto", folheto()), ("whatsapp", whatsapp())):
        (tmp / f"{nome}.html").write_text(html, encoding="utf8")
    rodar([f"--print-to-pdf={SAIDA / 'cartaz-georisco-sp.pdf'}", (tmp / "cartaz.html").as_uri()])
    rodar([f"--print-to-pdf={SAIDA / 'folheto-georisco-sp.pdf'}", (tmp / "folheto.html").as_uri()])
    rodar([f"--screenshot={SAIDA / 'georisco-sp-whatsapp.png'}", "--window-size=1080,1350", (tmp / "whatsapp.html").as_uri()])
(SAIDA / "qrcode-georisco-sp.svg").write_text(qr_svg(), encoding="utf8")
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=4)
q.add_data(URL)
q.make(fit=True)
q.make_image(fill_color="#050807", back_color="white").save(SAIDA / "qrcode-georisco-sp.png")
for f in sorted(SAIDA.iterdir()):
    print(f.name, round(f.stat().st_size / 1024), "KB")
