from pathlib import Path
import pdfplumber,json,sys
root=Path(__file__).resolve().parent / 'output'
pdf_path=Path(sys.argv[1]) if len(sys.argv)>1 else root/'变频器租赁与电机监控平台完整设计说明书及方案策划_V3.0.pdf'
if not pdf_path.is_file(): raise SystemExit('PDF not found: '+str(pdf_path))
summary=[]
with pdfplumber.open(pdf_path) as pdf:
 for i,page in enumerate(pdf.pages):
    text=page.extract_text() or ''
    chars=[c for c in page.chars if c['bottom'] < page.height-35 and c['top']>38]
    summary.append({'page':i+1,'size':[page.width,page.height],'chars':len(text),'start':text[:82].replace('\n',' '),'end':text[-90:].replace('\n',' '),'bodyBottom':round(max([c['bottom'] for c in chars],default=0),1)})
print(json.dumps(summary,ensure_ascii=False))


