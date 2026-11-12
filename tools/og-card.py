#!/usr/bin/env python3
"""Renders the 1200x630 link-preview cards assets/img/og-vag-scope-{en,fr}.jpg (macOS: QuickLook + sips).

Run with `python3 -I tools/og-card.py` after changing the headline, the icon or the mileage screenshots.
QuickLook renders an SVG into a square thumbnail, so the card is drawn centred in a square and cropped."""
import base64, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = {
    'en': (['Check a used VW, Audi,', 'Seat or Škoda before', 'you buy.'],
           ['Mileage and VIN check from your phone', 'and a Bluetooth OBD adapter.']),
    'fr': (['Vérifiez une VW, Audi,', 'Seat ou Škoda d’occasion', 'avant de l’acheter.'],
           ['Kilométrage et VIN contrôlés avec votre', 'téléphone et un adaptateur OBD Bluetooth.']),
}


def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def main():
    tmp = tempfile.mkdtemp()
    img = lambda n: os.path.join(ROOT, 'assets', 'img', n)
    shots = {}
    for n in ('mileage1', 'mileage2'):
        out = os.path.join(tmp, n + '.png')
        subprocess.run(['sips', '-s', 'format', 'png', img(n + '-800.webp'), '--out', out], check=True, capture_output=True)
        shots[n] = b64(out)
    fonts = {k: b64(os.path.join(ROOT, 'assets', 'fonts', k + '.woff2')) for k in ('bricolage', 'figtree')}
    icon = open(img('vag-scope-icon.svg')).read()
    icon = re.sub(r'<!--.*?-->', '', re.search(r'<svg[^>]*>(.*)</svg>', icon, re.S).group(1), flags=re.S)
    for lang, (head, sub) in CARDS.items():
        h = ''.join(f'<text x="64" y="{245 + 68 * i}" class="h">{t}</text>' for i, t in enumerate(head))
        s = ''.join(f'<text x="64" y="{470 + 36 * i}" class="s">{t}</text>' for i, t in enumerate(sub))
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="768" height="768" viewBox="0 -285 1200 1200">
<style>@font-face{{font-family:B;src:url(data:font/woff2;base64,{fonts['bricolage']}) format("woff2");font-weight:400 800}}
@font-face{{font-family:F;src:url(data:font/woff2;base64,{fonts['figtree']}) format("woff2");font-weight:400 700}}
.h{{font-family:B;font-weight:800;font-size:58px;fill:#fff;letter-spacing:-1.6px}}.s{{font-family:F;font-weight:500;font-size:27px;fill:#a9d3d2}}.b{{font-family:B;font-weight:700;font-size:30px;fill:#fff}}</style>
<rect width="1200" height="630" fill="#0b3f4b"/><circle cx="1010" cy="300" r="330" fill="#14606f"/>
<g transform="translate(64,70)"><svg width="52" height="52" viewBox="0 0 108 108"><clipPath id="r"><rect width="108" height="108" rx="26"/></clipPath><g clip-path="url(#r)">{icon}</g></svg>
<text x="70" y="37" class="b">VAG Scope</text></g>{h}{s}<rect x="64" y="548" width="64" height="6" rx="3" fill="#4dd0c4"/>
<g transform="translate(790,70) rotate(-4)"><rect width="196" height="398" rx="30" fill="#0b1418"/><image x="6" y="6" width="184" height="374" xlink:href="data:image/png;base64,{shots['mileage1']}"/></g>
<g transform="translate(960,150) rotate(3)"><rect width="196" height="398" rx="30" fill="#0b1418"/><image x="6" y="6" width="184" height="374" xlink:href="data:image/png;base64,{shots['mileage2']}"/></g>
</svg>'''
        src = os.path.join(tmp, f'og-{lang}.svg')
        open(src, 'w').write(svg)
        subprocess.run(['qlmanage', '-t', '-s', '1200', '-o', tmp, src], check=True, capture_output=True)
        square, png = src + '.png', os.path.join(tmp, f'og-{lang}.png')
        subprocess.run(['sips', '-c', '630', '1200', square, '--out', png], check=True, capture_output=True)
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out',
                        img(f'og-vag-scope-{lang}.jpg')], check=True, capture_output=True)
        print('wrote', f'assets/img/og-vag-scope-{lang}.jpg')


if __name__ == '__main__':
    sys.exit(main())
