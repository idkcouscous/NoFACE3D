from pathlib import Path
import fitz,base64,shutil
from compress_previews import compress_previews
root=Path(__file__).resolve().parent
compress_previews(root)
p=fitz.open(root/"paper.pdf")
selections={"hero":(0,0),"method":(3,0),"comparisons":(6,0),"objects":(7,0),"ablation":(8,0),"hat":(8,1),"wings":(18,0),"car":(18,1)}
t=(root/"template.html").read_text()
for name,(page,n) in selections.items():
 b=[b for b in p[page].get_text("dict")["blocks"] if b["type"]==1][n]
 pix=p[page].get_pixmap(matrix=fitz.Matrix(3.5,3.5),clip=fitz.Rect(b["bbox"]),alpha=False)
 data=pix.tobytes("jpeg",jpg_quality=90)
 t=t.replace("{{"+name+"}}","data:image/jpeg;base64,"+base64.b64encode(data).decode())
t=t.replace("{{bigdetail_manifest}}",(root/"comparison-manifest.json").read_text().strip())
(root/"index.html").write_text(t)
(root/"bigdetail-360.html").write_text(t)
(root/"comparisons-360.html").write_text(t)

print("Built",root/"index.html",len(t),"bytes")
