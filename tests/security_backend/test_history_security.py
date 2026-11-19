"""History regressions with a real temporary SQLite store and synthetic identity."""
import base64
from contextlib import asynccontextmanager
import json
from pathlib import Path
import sys

from fastapi import Request
from fastapi.testclient import TestClient
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'api-python'))
import main

TIMESTAMP = '2026-11-01T12:00:00.000Z'


def quote_id(number):
    return f'00000000-0000-4000-8000-{number:012d}'


def cursor_for(created_at, identifier):
    return 'v1.' + base64.urlsafe_b64encode((created_at + '|' + identifier).encode()).decode().rstrip('=')


@pytest.fixture
def history_client(monkeypatch, tmp_path):
    monkeypatch.setattr(main, 'DATABASE', tmp_path / 'history.sqlite')
    monkeypatch.setattr(main, '_rate_buckets', {})
    monkeypatch.setattr(main, '_rate_cleanup', 0)

    @asynccontextmanager
    async def isolated_lifespan(app):
        main.initialize_database()
        yield

    def synthetic_identity(request: Request):
        return request.headers.get('x-test-owner', 'alice'), request.headers.get('x-test-scope', 'quotes:read').split()

    monkeypatch.setattr(main.app.router, 'lifespan_context', isolated_lifespan)
    previous_overrides = dict(main.app.dependency_overrides)
    main.app.dependency_overrides[main.identity] = synthetic_identity
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(previous_overrides)


def seed_quotes(count=45):
    quote = json.loads((ROOT / 'contracts' / 'example-quote.json').read_text(encoding='utf-8'))
    legacy = {**quote, 'projectType': 'navidad'}
    with main.connection() as database:
        for number in range(1, count + 1):
            payload = '{' if number == 7 else json.dumps(legacy if number == 8 else quote)
            if number == 9:
                payload = 'x' * (main.HISTORY_PAYLOAD_LIMIT + 1)
            total = 'invalid-total' if number == 10 else 12345
            database.execute('INSERT INTO quotes VALUES (?,?,?,?,?)', (quote_id(number), 'alice', payload, total, TIMESTAMP))
        database.execute('INSERT INTO quotes VALUES (?,?,?,?,?)', (quote_id(count + 1), 'bob', json.dumps(quote), 12345, TIMESTAMP))
    return quote


def test_keyset_pages_preserve_ties_and_existing_rows_after_new_head_insert(history_client):
    seed_quotes()
    first_response = history_client.get('/api/quotes')
    assert first_response.status_code == 200
    assert first_response.headers['cache-control'] == 'no-store'
    first = first_response.json()
    assert [row['id'] for row in first['quotes']] == [quote_id(i) for i in range(45, 25, -1)]
    assert first['nextCursor'] == cursor_for(TIMESTAMP, quote_id(26))
    with main.connection() as database:
        database.execute('INSERT INTO quotes VALUES (?,?,?,?,?)',
                         (quote_id(99), 'alice', '{}', 0, '2026-11-02T12:00:00.000Z'))
    second_response = history_client.get('/api/quotes', params={'cursor': first['nextCursor']})
    assert second_response.status_code == 200
    second = second_response.json()
    assert [row['id'] for row in second['quotes']] == [quote_id(i) for i in range(25, 5, -1)]
    assert second['nextCursor'] == cursor_for(TIMESTAMP, quote_id(6))
    third = history_client.get('/api/quotes', params={'cursor': second['nextCursor']}).json()
    assert [row['id'] for row in third['quotes']] == [quote_id(i) for i in range(5, 0, -1)]
    assert third['nextCursor'] is None
    identifiers = [row['id'] for page in (first, second, third) for row in page['quotes']]
    assert len(identifiers) == len(set(identifiers)) == 45
    assert quote_id(99) not in identifiers
    assert history_client.get('/api/quotes').json()['quotes'][0]['id'] == quote_id(99)


def test_each_invalid_or_legacy_payload_preserves_other_quotes(history_client):
    seed_quotes(count=12)
    response = history_client.get('/api/quotes')
    assert response.status_code == 200
    page = response.json()
    assert len(page['quotes']) == 12 and page['nextCursor'] is None
    records = {row['id']: row for row in page['quotes']}
    assert records[quote_id(7)]['quote'] is None
    assert records[quote_id(9)]['quote'] is None
    assert records[quote_id(10)]['totalCents'] is None
    assert records[quote_id(8)]['quote']['projectType'] == 'navidad'
    assert records[quote_id(6)]['quote']['client']


def test_cursor_never_changes_owner_or_required_scope(history_client):
    seed_quotes()
    first = history_client.get('/api/quotes').json()
    bob = history_client.get('/api/quotes', headers={'x-test-owner': 'bob'}).json()
    assert [row['id'] for row in bob['quotes']] == [quote_id(46)]
    assert bob['nextCursor'] is None
    foreign = history_client.get('/api/quotes', params={'cursor': first['nextCursor']}, headers={'x-test-owner': 'bob'})
    assert foreign.status_code == 200 and foreign.json()['quotes'] == []
    injection = history_client.get('/api/quotes', headers={'x-test-owner': "alice' OR 1=1 --"})
    assert injection.status_code == 200 and injection.json()['quotes'] == []
    denied = history_client.get('/api/quotes', headers={'x-test-scope': 'quotes:write'})
    assert denied.status_code == 403
    empty = history_client.get('/api/quotes', headers={'x-test-owner': 'absent'}).json()
    assert empty == {'quotes': [], 'nextCursor': None}


@pytest.mark.parametrize('cursor', [
    '',
    'v0.' + 'A' * 82,
    'v1.' + 'A' * 82,
    cursor_for(TIMESTAMP, quote_id(1)) + '=',
    cursor_for('2026-02-30T12:00:00.000Z', quote_id(1)),
    cursor_for(TIMESTAMP, '00000000-0000-4000-8000-INVALIDVALUE'),
])
def test_invalid_cursor_returns_a_sanitized_bad_request(history_client, cursor):
    response = history_client.get('/api/quotes', params={'cursor': cursor})
    assert response.status_code == 400
    assert response.json() == {'error': 'Cursor del historial inválido.'}
    assert response.headers['cache-control'] == 'no-store'


def test_duplicate_cursor_is_rejected(history_client):
    cursor = cursor_for(TIMESTAMP, quote_id(1))
    response = history_client.get('/api/quotes', params=[('cursor', cursor), ('cursor', cursor)])
    assert response.status_code == 400
    assert response.json() == {'error': 'Cursor del historial inválido.'}
