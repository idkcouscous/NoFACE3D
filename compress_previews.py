"""Precompress preview GLBs for the existing hosted project page."""
from pathlib import Path
import gzip,json

def compress_previews(root=None):
 root=Path(root) if root else Path(__file__).resolve().parent
 catalog=json.loads((root/"comparison-manifest.json").read_text())
 count=0
 for collection in catalog["collections"].values():
  for sample in collection["samples"]:
   for asset in sample["models"]:
    path=root/asset["path"]
    packed=Path(str(path)+".gz")
    if not packed.exists() or packed.stat().st_mtime_ns < path.stat().st_mtime_ns:
     temporary=Path(str(packed)+".tmp")
     temporary.write_bytes(gzip.compress(path.read_bytes(),compresslevel=9,mtime=0))
     temporary.replace(packed)
    count+=1
 return count

if __name__=="__main__":
 print("Compressed preview assets:",compress_previews())
