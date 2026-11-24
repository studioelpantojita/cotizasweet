"""Rebuild the current local source delivery; never publishes or includes private data."""
import argparse,hashlib,io,json,subprocess,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VERSION=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
def git(*args):
    return subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}',*args],cwd=ROOT)

def index_contents():
    entries=[]
    for row in git('ls-files','--stage','-z').decode('utf-8').split('\0'):
        if not row:continue
        metadata,name=row.split('\t',1)
        mode,oid,stage=metadata.split()
        if mode not in ('100644','100755') or stage!='0':raise RuntimeError('Only regular, unconflicted source files may be packaged.')
        entries.append((name,oid))
    request=''.join(oid+'\n' for _,oid in entries).encode('ascii')
    batch=subprocess.run(['git','-c',f'safe.directory={ROOT.as_posix()}','cat-file','--batch'],cwd=ROOT,input=request,capture_output=True,check=True).stdout
    stream=io.BytesIO(batch);contents={}
    for name,oid in entries:
        header=stream.readline().decode('ascii').strip().split()
        if len(header)!=3 or header[:2]!=[oid,'blob']:raise RuntimeError('Unexpected Git source object.')
        data=stream.read(int(header[2]))
        if stream.read(1)!=b'\n':raise RuntimeError('Incomplete Git source object.')
        contents[name]=data
    return contents

def main(from_index=False):
    canonical=index_contents() if from_index else None
    files=list(canonical) if canonical is not None else git('ls-files','-z','--cached','--others','--exclude-standard').decode('utf-8').split('\0')
    selected=[]
    for name in sorted(set(files)):
        if not name or name in ('SHA256SUMS.txt','web/next-env.d.ts'):continue
        path=ROOT/name
        if canonical is None and not path.is_file():continue
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT.resolve()):raise RuntimeError('Source path leaves the project.')
        parts=Path(name).parts
        if any(p in ('.git','.local','.venv','node_modules','data','logs','bin','obj','artifacts','__pycache__') or p.startswith('.next') for p in parts):raise RuntimeError('Private or generated source path selected.')
        if path.name.startswith('.env') and path.name not in ('.env.example','.env.ruc.example'):raise RuntimeError('Private environment file selected.')
        if path.name in ('local.settings.json',) or path.suffix.lower() in ('.db','.sqlite','.log','.pfx','.key'):raise RuntimeError('Private data file selected.')
        selected.append((name,canonical[name] if canonical is not None else path.read_bytes()))
    manifest=''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name,data in selected)
    (ROOT/'SHA256SUMS.txt').write_text(manifest,encoding='utf-8')
    selected.append(('SHA256SUMS.txt',manifest.encode('utf-8')))
    secrets=[]
    for private in (ROOT/'.local/accounts-settings.json',ROOT/'.local/review-accounts.json'):
        if private.exists():
            value=json.loads(private.read_text(encoding='utf-8'))
            if 'jwtSecret' in value:secrets.append(value['jwtSecret'].encode())
            secrets.extend(row['password'].encode() for row in value.get('accounts',[]))
    for name,data in selected:
        if any(secret and secret in data for secret in secrets):raise RuntimeError('A private configured value was found in source.')
    output=ROOT.parent/f'EACotiza_v{VERSION}_Revision_Local.zip'
    # A single named current-version artifact is replaced; no source directory is copied.
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name,data in selected:archive.writestr(f'EACotiza_v{VERSION}/'+name,data)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip():raise RuntimeError('ZIP integrity verification failed.')
        for name,data in selected:
            if archive.read(f'EACotiza_v{VERSION}/'+name)!=data:raise RuntimeError('ZIP content differs from current source.')
    report={'status':'passed','version':VERSION,'source_files':len(selected),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'source_bytes':'git-index' if from_index else 'working-tree','configured_credentials_included':False,'private_databases_included':False,'published':False}
    (ROOT/'.local').mkdir(exist_ok=True,mode=0o700)
    (ROOT/'.local/package-current.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-index',action='store_true',help='Package the staged Git source bytes for a reproducible remote release.')
    main(parser.parse_args().from_index)
