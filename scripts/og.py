"""Render Open Graph images (public/og/<lang>.png) and PNG icons.

Dev-only step; the PNGs are committed so CI doesn't need a browser.
Requires: pip install playwright && playwright install chromium
          fonts from @fontsource (npm i @fontsource/jua @fontsource/ibm-plex-sans-kr @fontsource/fredoka
          @fontsource/ibm-plex-sans @fontsource/m-plus-rounded-1c @fontsource/ibm-plex-sans-jp
          @fontsource/noto-sans-sc @fontsource/ibm-plex-mono @fontsource/silkscreen) in FONTS_DIR.
Usage:    FONTS_DIR=/path/with/node_modules python3 scripts/og.py [lang ...]
"""
import html
import json
import os
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(os.environ.get("FONTS_DIR", ROOT)) / "node_modules" / "@fontsource"
OUT = ROOT / "public" / "og"
LANGS = ["en", "ko", "es", "pt-BR", "fr", "de", "ja", "zh-CN"]
FACE = {
    "latin": ("'Fredoka'", 600, "'IBM Plex Sans'", ["fredoka/600.css", "ibm-plex-sans/400.css", "ibm-plex-sans/500.css"]),
    "ko": ("'Jua'", 400, "'IBM Plex Sans KR'", ["jua/400.css", "ibm-plex-sans-kr/400.css", "ibm-plex-sans-kr/500.css"]),
    "ja": ("'M PLUS Rounded 1c'", 700, "'IBM Plex Sans JP'", ["m-plus-rounded-1c/700.css", "ibm-plex-sans-jp/400.css", "ibm-plex-sans-jp/500.css"]),
    "zh-CN": ("'Noto Sans SC'", 700, "'Noto Sans SC'", ["noto-sans-sc/400.css", "noto-sans-sc/700.css"]),
}
COMMON_CSS = ["ibm-plex-mono/600.css", "silkscreen/400.css"]


def load(lang):
    en = json.loads((ROOT / "src/i18n/en.json").read_text())
    p = ROOT / f"src/i18n/{lang}.json"
    return {**en, **(json.loads(p.read_text()) if p.exists() else {})}


def card(lang):
    d = load(lang)
    disp, w, body, css = FACE.get(lang, FACE["latin"])
    links = "".join(f'<link rel="stylesheet" href="{(FONTS / c).as_uri()}">' for c in css + COMMON_CSS)
    e = lambda k, **v: html.escape(d[k].format(**v) if v else d[k])
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8">{links}<style>
*{{box-sizing:border-box}} body{{margin:0;width:1200px;height:630px;background:#E7EEF5;color:#16212D;font-family:{body},sans-serif;
display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:center;padding:64px 72px;overflow:hidden}}
.px{{font-family:'Silkscreen',monospace;font-size:20px;letter-spacing:.08em;color:#A3410D}}
h1{{font-family:{disp},sans-serif;font-weight:{w};font-size:76px;line-height:1.08;margin:18px 0 20px;text-wrap:balance}}
.tag{{font-size:32px;color:#586777;line-height:1.35}}
.url{{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:20px;color:#586777;margin-top:34px}}
.win{{background:#fff;border:2px solid #CAD5E0;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(22,33,45,.10)}}
.bar{{display:flex;justify-content:space-between;align-items:baseline;padding:16px 24px;border-bottom:2px solid #CAD5E0}}
.bar b{{font-family:{disp},sans-serif;font-weight:{w};font-size:28px}} .bar span{{font-family:'Silkscreen';font-size:16px;color:#586777}}
.in{{padding:22px 24px 26px;display:grid;gap:10px}}
.k{{font-size:22px;color:#586777}}
.v{{font-family:{disp},sans-serif;font-weight:{w};font-size:150px;line-height:.95;color:#D2581B}}
.rows{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}}
.rows div{{background:#F1F5F9;border:2px solid #CAD5E0;border-radius:12px;padding:8px 12px;font-family:'IBM Plex Mono';font-weight:600;font-size:22px}}
.rows small{{display:block;font-family:'Silkscreen';font-size:13px;color:#586777;font-weight:400}}
.chips{{display:flex;gap:10px;margin-top:6px}}
.chip{{font-size:20px;font-weight:500;padding:6px 14px;border-radius:999px;background:#DDF1E5;color:#1F7D4C}}
</style></head><body>
<div><div class="px">MAPLESTORY CLASSIC WORLD · GMS</div><h1>{e('calc.h1')}</h1>
<div class="tag">{e('meta.ogTagline')}</div><div class="url">sungbae-dev.github.io/maple-classic-calc</div></div>
<div class="win"><div class="bar"><b>{e('panel.result')}</b><span>RESULT</span></div><div class="in">
<span class="k">{e('res.conv')}</span><span class="v">402</span>
<div class="rows"><div><small>STR</small>337</div><div><small>W.ATK</small>105</div><div><small>ACC</small>100</div></div>
<div class="chips"><span class="chip">{e('rep.hitPct', v='100')}</span><span class="chip">{e('rep.st.n', n='2')}</span></div>
</div></div></body></html>"""


ICON_SQUARE = (ROOT / "public/favicon.svg").read_text().replace('rx="7"', 'rx="0"')


def main(langs):
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1200, "height": 630})
        for lang in langs:
            f = Path(tmp) / f"{lang}.html"
            f.write_text(card(lang))
            pg.goto(f.as_uri())
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(300)
            pg.screenshot(path=str(OUT / f"{lang}.png"))
            print("og", lang)
        for size, svg, name in [(32, (ROOT / "public/favicon.svg").read_text(), "favicon-32.png"), (180, ICON_SQUARE, "apple-touch-icon.png")]:
            ip = b.new_page(viewport={"width": size, "height": size})
            ip.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ")}</body></html>')
            ip.screenshot(path=str(ROOT / "public" / name), omit_background=True)
            print("icon", name)
        b.close()


if __name__ == "__main__":
    main(sys.argv[1:] or LANGS)
