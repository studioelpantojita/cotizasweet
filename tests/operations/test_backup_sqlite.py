import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'backup_sqlite.py'
SPEC = importlib.util.spec_from_file_location('sweet_backup', SCRIPT)
backup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='sweet-backup-')
        self.root = Path(self.temp.name)
        self.source = self.root / 'synthetic.sqlite'
        with contextlib.closing(sqlite3.connect(self.source)) as connection:
            connection.execute('CREATE TABLE synthetic(id INTEGER PRIMARY KEY, label TEXT)')
            connection.execute('INSERT INTO synthetic(label) VALUES (?)', ('SYNTHETIC_ONLY',))
            connection.commit()

    def tearDown(self):
        self.temp.cleanup()

    def test_online_backup_includes_committed_wal_and_restore_is_verified(self):
        with contextlib.closing(sqlite3.connect(self.source)) as writer:
            writer.execute('PRAGMA journal_mode=WAL')
            writer.execute('PRAGMA wal_autocheckpoint=0')
            writer.execute('INSERT INTO synthetic(label) VALUES (?)', ('COMMITTED_WAL',))
            writer.commit()
            writer.execute('INSERT INTO synthetic(label) VALUES (?)', ('UNCOMMITTED',))
            snapshot = self.root / 'snapshot.sqlite'
            result = backup.backup(self.source, snapshot)
            self.assertEqual(result['status'], 'ok')
            self.assertEqual(backup.verify(snapshot)['sha256'], result['sha256'])
            restored = self.root / 'restore.sqlite'
            recovery = backup.restore(snapshot, restored)
            self.assertEqual(recovery['sha256'], result['sha256'])
            with contextlib.closing(sqlite3.connect(restored)) as read:
                self.assertEqual(read.execute('SELECT label FROM synthetic ORDER BY id').fetchall(), [('SYNTHETIC_ONLY',), ('COMMITTED_WAL',)])
            writer.rollback()

    def test_existing_destination_and_sidecar_are_never_overwritten(self):
        snapshot = self.root / 'snapshot.sqlite'
        snapshot.write_bytes(b'PRESERVE_ME')
        with self.assertRaises(backup.OperationError):
            backup.backup(self.source, snapshot)
        self.assertEqual(snapshot.read_bytes(), b'PRESERVE_ME')
        snapshot.unlink()
        backup.metadata_path(snapshot).write_text('PRESERVE_METADATA', encoding='utf-8')
        with self.assertRaises(backup.OperationError):
            backup.backup(self.source, snapshot)
        self.assertEqual(backup.metadata_path(snapshot).read_text(), 'PRESERVE_METADATA')
        self.assertFalse(snapshot.exists())

    def test_restore_refuses_existing_destination_and_preserves_its_data(self):
        snapshot = self.root / 'snapshot.sqlite'
        backup.backup(self.source, snapshot)
        before = self.source.read_bytes()
        with self.assertRaises(backup.OperationError):
            backup.restore(snapshot, self.source)
        self.assertEqual(self.source.read_bytes(), before)

    def test_corruption_and_metadata_tampering_block_restore(self):
        snapshot = self.root / 'snapshot.sqlite'
        backup.backup(self.source, snapshot)
        with snapshot.open('ab') as output:
            output.write(b'CORRUPTION')
        restored = self.root / 'restored.sqlite'
        with self.assertRaises(backup.OperationError) as result:
            backup.restore(snapshot, restored)
        self.assertEqual(result.exception.code, 'checksum_mismatch')
        self.assertFalse(restored.exists())
        backup.metadata_path(snapshot).write_text('{}', encoding='utf-8')
        with self.assertRaises(backup.OperationError) as result:
            backup.verify(snapshot)
        self.assertEqual(result.exception.code, 'metadata_invalid')

    def test_metadata_contains_no_rows_or_paths_and_missing_source_is_not_created(self):
        snapshot = self.root / 'snapshot.sqlite'
        backup.backup(self.source, snapshot)
        raw = backup.metadata_path(snapshot).read_text(encoding='utf-8')
        self.assertNotIn('SYNTHETIC_ONLY', raw)
        self.assertNotIn(str(self.source), raw)
        self.assertEqual(set(json.loads(raw)), {'schemaVersion', 'operation', 'createdAtUtc', 'bytes', 'sha256', 'sqliteIntegrity'})
        missing = self.root / 'missing.sqlite'
        with contextlib.redirect_stdout(io.StringIO()) as output:
            code = backup.main(['backup', str(missing), str(self.root / 'new.sqlite')])
        self.assertEqual(code, 1)
        self.assertNotIn(str(self.root), output.getvalue())
        self.assertFalse(missing.exists())
        self.assertFalse((self.root / 'new.sqlite').exists())

    def test_non_sqlite_input_cannot_publish_an_invalid_snapshot(self):
        self.source.write_bytes(b'not a sqlite database')
        snapshot = self.root / 'snapshot.sqlite'
        with contextlib.redirect_stdout(io.StringIO()) as output:
            code = backup.main(['backup', str(self.source), str(snapshot)])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(output.getvalue())['code'], 'operation_failed')
        self.assertFalse(snapshot.exists())
        self.assertFalse(list(self.root.glob('.sqlite-snapshot-*')))


if __name__ == '__main__':
    unittest.main()
