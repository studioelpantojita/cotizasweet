"""Consistent SQLite snapshots and verified restores; standard library only.

No application database is selected implicitly. All paths must be supplied by
the operator. Restore always creates a new file and refuses to overwrite.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import tempfile
import time


class OperationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def metadata_path(path: Path) -> Path:
    return path.with_name(path.name + '.metadata.json')


def _existing(path: str | Path) -> Path:
    target = Path(path).resolve(strict=True)
    if not target.is_file():
        raise OperationError('invalid_source', 'La fuente debe ser un archivo SQLite existente.')
    return target


def _new_target(path: str | Path, with_metadata: bool = True) -> Path:
    requested = Path(path).absolute()
    parent = requested.parent.resolve(strict=True)
    target = parent / requested.name
    # lexists also rejects a broken symlink; the exclusive open below closes races.
    if os.path.lexists(target) or (with_metadata and os.path.lexists(metadata_path(target))):
        raise OperationError('target_exists', 'El destino y su metadato deben ser rutas nuevas; no se sobrescribe ningún archivo.')
    return target


def _integrity(path: Path) -> None:
    # mode=ro prevents both accidental database creation and database modification.
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=10)) as connection:
        if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise OperationError('integrity_failed', 'SQLite no confirmó la integridad del archivo.')


def _publish(source: Path, target: Path) -> None:
    created = False
    try:
        # O_EXCL, used by xb, refuses existing files and symlinks atomically.
        with target.open('xb') as output:
            created = True
            with source.open('rb') as input_stream:
                shutil.copyfileobj(input_stream, output, 1024 * 1024)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(target, 0o600)
    except BaseException:
        if created:
            target.unlink(missing_ok=True)
        raise


def _write_metadata(target: Path, operation: str) -> dict:
    metadata = {
        'schemaVersion': 1,
        'operation': operation,
        'createdAtUtc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'bytes': target.stat().st_size,
        'sha256': sha256(target),
        'sqliteIntegrity': 'ok',
    }
    sidecar = metadata_path(target)
    created = False
    try:
        with sidecar.open('x', encoding='utf-8') as output:
            created = True
            json.dump(metadata, output, ensure_ascii=False, indent=2)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        os.chmod(sidecar, 0o600)
    except BaseException:
        if created:
            sidecar.unlink(missing_ok=True)
        raise
    return metadata


def backup(source: str | Path, destination: str | Path, timeout: float = 60) -> dict:
    origin = _existing(source)
    target = _new_target(destination)
    if not 0 < timeout <= 3600:
        raise OperationError('invalid_timeout', 'El tiempo límite debe estar entre 0 y 3600 segundos.')
    deadline = time.monotonic() + timeout
    handle, temporary_name = tempfile.mkstemp(prefix='.sqlite-snapshot-', suffix='.tmp', dir=target.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    published = False
    try:
        def progress(_status: int, _remaining: int, _total: int) -> None:
            if time.monotonic() > deadline:
                raise OperationError('backup_timeout', 'El respaldo excedió el tiempo límite; no se publicó un archivo parcial.')

        with closing(sqlite3.connect(origin.as_uri() + '?mode=ro', uri=True, timeout=10)) as input_db:
            with closing(sqlite3.connect(temporary, timeout=10)) as snapshot:
                input_db.backup(snapshot, pages=256, progress=progress, sleep=0.05)
        _integrity(temporary)
        _publish(temporary, target)
        published = True
        metadata = _write_metadata(target, 'backup')
        return {'status': 'ok', **metadata}
    except BaseException:
        if published:
            target.unlink(missing_ok=True)
        raise
    finally:
        temporary.unlink(missing_ok=True)


def verify(source: str | Path) -> dict:
    origin = _existing(source)
    sidecar = metadata_path(origin)
    if not sidecar.is_file() or sidecar.stat().st_size > 16384:
        raise OperationError('metadata_missing', 'Falta un metadato válido del respaldo.')
    try:
        metadata = json.loads(sidecar.read_text(encoding='utf-8'))
        if (not isinstance(metadata, dict) or metadata.get('schemaVersion') != 1
            or metadata.get('operation') not in ('backup', 'restore')
            or metadata.get('sqliteIntegrity') != 'ok'
            or type(metadata.get('bytes')) is not int
            or not isinstance(metadata.get('sha256'), str)
            or re.fullmatch(r'[a-f0-9]{64}', metadata['sha256']) is None):
            raise ValueError('metadata')
    except (ValueError, TypeError, UnicodeError):
        raise OperationError('metadata_invalid', 'El metadato del respaldo es inválido.') from None
    if metadata['bytes'] != origin.stat().st_size or metadata['sha256'] != sha256(origin):
        raise OperationError('checksum_mismatch', 'El tamaño o SHA-256 no coincide con el respaldo registrado.')
    _integrity(origin)
    return {'status': 'ok', 'schemaVersion': 1, 'bytes': metadata['bytes'], 'sha256': metadata['sha256'], 'sqliteIntegrity': 'ok'}


def restore(source: str | Path, destination: str | Path) -> dict:
    origin = _existing(source)
    target = _new_target(destination)
    checked = verify(origin)
    published = False
    try:
        _publish(origin, target)
        published = True
        # Detect a source changed during the copy instead of publishing a mixed file.
        if target.stat().st_size != checked['bytes'] or sha256(target) != checked['sha256']:
            raise OperationError('source_changed', 'El respaldo cambió durante la restauración; se descartó el destino nuevo.')
        _integrity(target)
        return {'status': 'ok', **_write_metadata(target, 'restore')}
    except BaseException:
        if published:
            target.unlink(missing_ok=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Respaldar, verificar o restaurar SQLite sin sobrescribir destinos.')
    commands = parser.add_subparsers(dest='command', required=True)
    save = commands.add_parser('backup'); save.add_argument('source'); save.add_argument('destination'); save.add_argument('--timeout', type=float, default=60)
    check = commands.add_parser('verify'); check.add_argument('source')
    recover = commands.add_parser('restore'); recover.add_argument('source'); recover.add_argument('destination')
    args = parser.parse_args(argv)
    try:
        if args.command == 'backup':
            result = backup(args.source, args.destination, args.timeout)
        elif args.command == 'restore':
            result = restore(args.source, args.destination)
        else:
            result = verify(args.source)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except OperationError as error:
        print(json.dumps({'status': 'error', 'code': error.code, 'message': str(error)}, ensure_ascii=False))
    except (OSError, sqlite3.Error):
        # SQLite/OS messages can contain paths or data: intentionally omit them.
        print(json.dumps({'status': 'error', 'code': 'operation_failed', 'message': 'No se pudo completar la operación. Revisa permisos, rutas y formato SQLite.'}, ensure_ascii=False))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
