"""Private loopback acceptance settings; CI supplies a disposable configuration."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def acceptance_configuration():
    path = Path(os.environ.get('E2E_CREDENTIALS_FILE', str(ROOT / '.local/review-accounts.json')))
    value = json.loads(path.read_text(encoding='utf-8'))
    origin = urlsplit(value['origin'])
    assert (origin.scheme == 'http' and origin.hostname in ('127.0.0.1', 'localhost')
            and origin.port and origin.path in ('', '/') and not origin.query
            and not origin.fragment and not origin.username and not origin.password), 'Acceptance is restricted to loopback.'
    return value


def acceptance_database(configuration, name, fallback):
    path = Path(configuration.get(name, str(ROOT / fallback)))
    assert path.is_absolute(), 'Acceptance database must use an absolute path.'
    return path
