"""Docker output decoding must preserve process status on Windows consoles."""
import importlib.util
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / 'container_smoke.py'
SPEC = importlib.util.spec_from_file_location('container_output_checks', SCRIPT)
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)


def test_docker_utf8_and_invalid_bytes_do_not_break_capture():
    run = subprocess.run

    def synthetic_docker(_command, **options):
        assert options['encoding'] == 'utf-8'
        assert options['errors'] == 'replace'
        program = "import sys; sys.stdout.buffer.write('Construcción correcta'.encode('utf-8')+b'\\x81'); sys.stderr.buffer.write(b'progress\\x81')"
        return run([sys.executable, '-c', program], **options)

    with patch.object(smoke.subprocess, 'run', side_effect=synthetic_docker):
        assert smoke.docker('build') == 'Construcción correcta\ufffd'


def test_docker_failure_still_fails_and_redacts_credentials():
    result = subprocess.CompletedProcess(['docker'], 1, '', 'failed ' + smoke.KEY)
    with patch.object(smoke.subprocess, 'run', return_value=result):
        with pytest.raises(RuntimeError) as error:
            smoke.docker('build')
    assert smoke.KEY not in str(error.value)
    assert '[redacted]' in str(error.value)
