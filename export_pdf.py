from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
os.environ["FONTCONFIG_FILE"]=str(root/"fonts.conf")
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":1280,"height":900},device_scale_factor=1)
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto("http://127.0.0.1:18768/",wait_until="networkidle")
 page.locator("img").evaluate_all("(imgs)=>imgs.forEach(i=>i.loading='eager')")
 page.evaluate("Promise.all([...document.images].map(i=>i.decode()))")
 page.add_style_tag(path=str(root/"print.css"))
 page.emulate_media(media="print")
 for clean,name in [(False,"NOFACE3D-project-page-annotated.pdf"),(True,"NOFACE3D-project-page-preview.pdf")]:
  page.evaluate("(v)=>document.body.classList.toggle('clean',v)",clean)
  label="Clean layout preview" if clean else "Annotated layout preview"
  page.pdf(path=str(root/name),print_background=True,prefer_css_page_size=True,
   display_header_footer=True,
   header_template='<div style="font-size:8px;width:100%;margin:0 46px;color:#626b61;display:flex;justify-content:space-between"><span>NOFACE3D — '+label+'</span><span>October 5, 2026 · Draft</span></div>',
   footer_template='<div style="font-size:8px;width:100%;text-align:right;margin:0 46px;color:#626b61"><span class="pageNumber"></span> / <span class="totalPages"></span></div>')
  print(name,(root/name).stat().st_size)
 page.emulate_media(media="screen")
 page.evaluate("document.body.classList.remove('clean')")
 page.screenshot(path=str(root/"preview-desktop.png"),full_page=True)
 print("JS errors:",errors)
 assert not errors
 browser.close()
