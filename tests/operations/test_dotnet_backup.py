"""Verify and restore a real .NET WAL snapshot using the Python operations API."""
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import backup_sqlite


def test_dotnet_snapshot_and_metadata_restore_with_python(tmp_path):
    check_program = ROOT / 'tests' / 'security_backend' / 'bin' / 'Release' / 'net10.0' / 'DotnetSecurityChecks.dll'
    assert check_program.is_file(), 'Build tests/security_backend/DotnetSecurityChecks.csproj in Release before this interoperability test.'
    result = subprocess.run(
        [os.environ.get('DOTNET_EXEC', 'dotnet'), str(check_program), '--backup-fixture', str(tmp_path)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        encoding='utf-8',
        timeout=30,
    )
    fixture = json.loads(result.stdout)
    assert fixture['status'] == 'ok'
    snapshot = Path(fixture['snapshot'])
    source = Path(fixture['source'])
    assert snapshot.is_relative_to(tmp_path) and source.is_relative_to(tmp_path)
    checked = backup_sqlite.verify(snapshot)
    assert checked['status'] == 'ok' and checked['sqliteIntegrity'] == 'ok'
    assert len(checked['sha256']) == 64
    restored = tmp_path / 'restored-with-python.sqlite'
    recovered = backup_sqlite.restore(snapshot, restored)
    assert recovered['status'] == 'ok' and recovered['operation'] == 'restore'
    assert backup_sqlite.verify(restored)['sha256'] == checked['sha256']
    rows = []
    for database in (source, snapshot, restored):
        with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as connection:
            assert connection.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
            rows.append(connection.execute('SELECT id,owner,payload,total_cents,created_at FROM quotes ORDER BY id').fetchall())
    assert len(rows[0]) == 4
    assert rows[0] == rows[1] == rows[2]
    assert {row[1] for row in rows[2]} == {'synthetic-fixture-owner'}
