from pathlib import Path
import json, shutil, hashlib, os

root = Path(__file__).resolve().parent.parent
desktop = Path('/Users/abi/Desktop/Social Media/Content_Videos')
jobs = json.loads((root / 'revisions/handle-correction-current.json').read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
for job in jobs:
    project = Path(job['project'])
    previous = Path(job['previous'])
    report = json.loads((project / 'review/final-export-check.json').read_text())
    metadata = json.loads((project / 'workflow.json').read_text())
    old = json.loads((previous / 'workflow.json').read_text())
    assert report['fullyDecoded'] and report['vmafMeanVsRenderedMaster'] > 95
    assert not json.loads((project / 'review/layout-check.json').read_text())['errors']
    assert metadata.get('correctedHandlesVisuallyVerified') is True
    source = Path(report['file'])
    assert sha(source) == report['sha256']
    backup = project / 'superseded-do-not-post'
    backup.mkdir(exist_ok=True)
    destinations = {}
    for field, folder in [('postingCopy', '03_Bereit_zum_Posten'), ('deliveryCopy', '02_Bearbeitete_Videos')]:
        oldpath = Path(old[field])
        target = desktop / folder / f"{job['date']} - {job['name']}.mp4"
        assert oldpath.exists() and sha(oldpath) == old['deliverySha256']
        assert target == oldpath or not target.exists()
        saved = backup / (folder + ' - ' + oldpath.name)
        assert not saved.exists()
        shutil.copy2(oldpath, saved)
        assert sha(saved) == sha(oldpath)
        temporary = target.with_name('.' + target.name + '.corrected')
        assert not temporary.exists()
        shutil.copy2(source, temporary)
        assert sha(temporary) == report['sha256']
        os.replace(temporary, target)
        if oldpath != target:
            oldpath.unlink()
        assert sha(target) == report['sha256']
        destinations[field] = str(target)
        old[field] = str(saved)
    metadata.update(**destinations, deliverySha256=report['sha256'], postingCopySha256=report['sha256'], postingPackageStatus='ready_to_post')
    old['supersededBy'] = str(project)
    old['postingPackageStatus'] = 'superseded_do_not_post'
    (project / 'workflow.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    (previous / 'workflow.json').write_text(json.dumps(old, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(video=job['name'], **destinations, sha256=report['sha256']), ensure_ascii=False))
