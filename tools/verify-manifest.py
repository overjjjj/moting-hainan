"""Verify a source handoff manifest; --write refreshes it using Git's tracked files."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'FILE-MANIFEST.json'
TEXT_EXTENSIONS={'.js','.cjs','.mjs','.json','.html','.css','.md','.py','.yml','.yaml','.go','.sh','.ps1','.cmd'}
def entry(rel):
    p=ROOT/rel
    data=p.read_bytes()
    if p.suffix in TEXT_EXTENSIONS: data=data.replace(b'\r\n',b'\n')
    return {'path':rel,'canonical_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
if '--write' in sys.argv:
    git=os.environ.get('GIT_EXECUTABLE','git')
    raw=subprocess.check_output([git,'ls-files','-z'],cwd=ROOT)
    paths=sorted(p.decode('utf-8') for p in raw.split(b'\0') if p and p!=b'FILE-MANIFEST.json')
    entries=[entry(p) for p in paths]
    MANIFEST.write_text(json.dumps({'date':'2026-10-28','version':'1.2.0','normalization':'Explicit text extensions in .gitattributes: CRLF -> LF','files':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Manifest written: %d files, %d canonical bytes'%(len(entries),sum(e['canonical_bytes'] for e in entries)))
else:
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    problems=[]
    for expected in manifest['files']:
        try:
            if entry(expected['path']) != expected: problems.append(expected['path'])
        except FileNotFoundError: problems.append(expected['path']+' (missing)')
    if problems:
        print('Manifest mismatch: '+', '.join(problems));sys.exit(1)
    print('Verified %d files'%len(manifest['files']))
