"""Build individual BeamNG mod ZIPs and one release bundle from source."""
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent


def zip_bytes(files):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,content in sorted(files.items()):
            path=Path(name)
            if path.is_absolute() or '..' in path.parts or '\\' in name:
                raise ValueError('Unsafe archive path: '+name)
            entry=zipfile.ZipInfo(name, (2026,1,1,0,0,0))
            entry.compress_type=zipfile.ZIP_DEFLATED
            entry.external_attr=0o100644 << 16
            archive.writestr(entry,content)
    return output.getvalue()


def build(destination=None):
    manifest=json.loads((ROOT/'modpack.json').read_text())
    target=Path(destination) if destination is not None else ROOT/'dist'
    target.mkdir(parents=True,exist_ok=True)
    packages={}
    for mod in manifest['mods']:
        source=ROOT/'mods'/mod['id']
        files={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
        if not files or not any(name.startswith(('ui/','lua/','scripts/')) for name in files):
            raise ValueError('Missing BeamNG source for '+mod['id'])
        forbidden={'.zip','.vcl','.exe','.dll','.pyc','.log','.tmp'}
        for name in files:
            if Path(name).suffix.lower() in forbidden or Path(name).name.lower() in {'settings.json','.env'}:
                raise ValueError('Local/generated file in mod source: '+name)
        data=zip_bytes(files)
        filename=mod['id']+'.zip'
        (target/filename).write_bytes(data)
        packages[filename]=data
    sums=''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name,data in sorted(packages.items()))
    packages['SHA256SUMS.txt']=sums.encode()
    packages['INSTALL.txt']=(ROOT/'INSTALL.txt').read_bytes()
    packages['modpack.json']=(ROOT/'modpack.json').read_bytes()
    release=target/('MiNini-BeamNG-Toolkit-v'+manifest['version']+'.zip')
    release.write_bytes(zip_bytes(packages))
    (target/'SHA256SUMS.txt').write_text(sums+hashlib.sha256(release.read_bytes()).hexdigest()+'  '+release.name+'\n',encoding='utf-8')
    print(f'Built {len(manifest["mods"])} mods and {release.name}')
    return release


if __name__=='__main__': build()
