"""Build a local review sheet from Blender outputs; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html
ROOT = Path(__file__).resolve().parents[1]
materials = [('material-resin', 'Shiny resin'), ('material-clay', 'Matte clay'), ('material-fur', 'Fluffy fur')]
shapes = [('round-online', 'Round · online'), ('organic-unread', 'Organic · 3 unread'), ('triangle-thinking', 'Triangle · thinking'), ('cloud', 'Cloud'), ('sun', 'Sun'), ('boxy-mad', 'Boxy · mad')]
font_path = '/System/Library/Fonts/Helvetica.ttc'
font = ImageFont.truetype(font_path, 26)
small = ImageFont.truetype(font_path, 18)
width, cell, margin = 1440, 440, 40
sheet = Image.new('RGB', (width, 1650), '#14171c')
draw = ImageDraw.Draw(sheet)
draw.text((40, 28), 'BLOBATAR / 3D MATERIAL STUDIES', fill='#f4f5f7', font=font)
draw.text((40, 67), 'One source geometry. Three procedural Blender finishes.', fill='#aeb6c2', font=small)
for row, items in enumerate([materials, shapes[:3], shapes[3:]]):
    for col, (name, label) in enumerate(items):
        path = ROOT/'renders'/f'{name}.png'
        if not path.exists(): continue
        avatar = Image.open(path).convert('RGBA');avatar.thumbnail((cell, cell))
        x, y = margin+col*480, 108+row*505
        sheet.paste(avatar, (x, y), avatar)
        draw.text((x+8, y+445), label, fill='#eef1f5', font=font)
draw.text((40, 1610), 'Blender Cycles renders · transparent PNGs and editable .blend scenes included', fill='#aeb6c2', font=small)
sheet.save(ROOT/'review-sheet.png')
sections=[]
for title, items in [('Materials: same avatar and color', materials), ('Silhouettes and expression studies',shapes)]:
    cards=[]
    for name,label in items:
        if not (ROOT/'renders'/f'{name}.png').exists():continue
        base = name if (ROOT/'configs/resolved'/f'{name}.svg').exists() else name.split('-')[0]
        cards.append(f'''<article><h3>{html.escape(label)}</h3><div class="pair"><figure><img src="configs/resolved/{base}.svg" alt="Upstream 2D {html.escape(label)}"><figcaption>Upstream silhouette</figcaption></figure><figure><img src="renders/{name}.png" alt="Blender {html.escape(label)}"><figcaption>Blender render</figcaption></figure></div><p><a href="configs/{name}.json">Config</a> · <a href="renders/{name}.png">Transparent PNG</a> · <a href="renders/{name}.blend">Blender scene</a></p></article>''')
    sections.append('<section><h2>'+title+'</h2><div class="grid">'+''.join(cards)+'</div></section>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blobatar 3D: material studies</title><style>*{box-sizing:border-box}body{margin:0;padding:40px;font:16px/1.5 system-ui,sans-serif;background:#14171c;color:#eef1f5;max-width:1600px;margin:auto}h1{font-size:32px;letter-spacing:-1px;margin-bottom:8px}h2{font-size:22px;margin-top:48px}h3{font-size:17px;margin:0 0 16px}p{color:#b5bdc8;max-width:900px}a{color:#8bdee9;text-underline-offset:4px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{background:#1d2128;border:1px solid #323843;border-radius:16px;padding:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain}figcaption{font-size:12px;text-align:center;color:#aeb6c2}article p{font-size:12px;margin-bottom:0}.note{border-left:3px solid #8bdee9;padding-left:16px}footer{margin-top:48px;color:#aeb6c2;font-size:13px}@media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){body{padding:20px}.grid{grid-template-columns:1fr}}</style><h1>Blobatar, in three dimensions</h1><p>First milestone: upstream shapes, eyes and seed behavior, translated into configurable Blender materials. The comparisons below use the resolved source SVG for each render.</p><p class="note">Material options include roughness, texture scale and strength, plus fur length and density. Fur expands the outline by its strand length. The live editor is available at the server root.</p>'''+''.join(sections)+'''<footer>Source: <a href="https://github.com/Alain00/blobatar">Alain00/blobatar</a> 2.7.0, MIT. See <a href="README.md">README</a> and <a href="docs/reference-audit.md">feature audit</a>. Extreme sun trait combinations can need a more exact geometry union; these samples do not establish full visual coverage of all configurations.</footer></html>'''
(ROOT/'review.html').write_text(page)
