import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from build_release import build

ROOT=Path(__file__).resolve().parents[1]


class ReleaseTests(unittest.TestCase):
    def test_bundle_has_all_five_mods_and_exact_source_bytes(self):
        manifest=json.loads((ROOT/'modpack.json').read_text())
        with tempfile.TemporaryDirectory() as temp:
            release=build(temp)
            first=release.read_bytes()
            with zipfile.ZipFile(release) as outer:
                self.assertIsNone(outer.testzip())
                names=[mod['id']+'.zip' for mod in manifest['mods']]
                self.assertEqual(len(names),5)
                self.assertEqual(set(outer.namelist()),set(names+['INSTALL.txt','modpack.json','SHA256SUMS.txt']))
                checksums=dict(line.split('  ')[::-1] for line in outer.read('SHA256SUMS.txt').decode().splitlines())
                for mod in manifest['mods']:
                    data=outer.read(mod['id']+'.zip')
                    self.assertEqual(hashlib.sha256(data).hexdigest(),checksums[mod['id']+'.zip'])
                    with zipfile.ZipFile(io.BytesIO(data)) as archive:
                        self.assertIsNone(archive.testzip())
                        source=ROOT/'mods'/mod['id']
                        expected={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
                        self.assertEqual({name:archive.read(name) for name in archive.namelist()},expected)
                        self.assertFalse(any(name.endswith('.zip') or '..' in Path(name).parts for name in archive.namelist()))
            self.assertEqual(build(temp).read_bytes(),first)
