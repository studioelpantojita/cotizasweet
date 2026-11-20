import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'preflight.py'
SPEC = importlib.util.spec_from_file_location('sweet_preflight', SCRIPT)
preflight = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preflight)


def synthetic_configuration():
    return {
        'APP_ORIGIN': 'https://cotizasweet.production-check.io',
        'OIDC_ISSUER': 'https://accounts.production-check.io/realms/sweet',
        'OIDC_ALLOW_LOCAL_HTTP': 'false',
        'OIDC_CLIENT_ID': 'sweet-app',
        'OIDC_CLIENT_SECRET': 'SYNTHETIC_CLIENT_CREDENTIAL_123',
        'OIDC_AUDIENCE': 'sweet-api',
        'OIDC_SCOPE': 'openid profile email quotes:read quotes:write',
        'SESSION_SECRET': '0123456789abcdef' * 4,
        'INTEGRATION_SERVICE_KEY': 'SYNTHETIC_INTEGRATION_CREDENTIAL_123',
        'RUC_PROVIDER': 'decolecta',
        'RUC_API_TOKEN': 'SYNTHETIC_RUC_CREDENTIAL_123',
        'API_BACKEND': 'dotnet',
        'API_BASE_URL': 'http://api-dotnet:8000',
        'RUC_SERVICE_URL': 'http://api-python:8000',
    }


class PreflightTests(unittest.TestCase):
    def test_complete_synthetic_config_passes_without_echoing_credentials(self):
        config = synthetic_configuration()
        result = preflight.evaluate(config)
        self.assertEqual(result['status'], 'passed')
        encoded = json.dumps(result)
        for field in ('OIDC_CLIENT_SECRET', 'SESSION_SECRET', 'INTEGRATION_SERVICE_KEY', 'RUC_API_TOKEN', 'APP_ORIGIN'):
            self.assertNotIn(config[field], encoded)
        self.assertTrue(result['limitations'])

    def test_missing_values_and_every_production_safeguard_are_enforced(self):
        cases = {
            'APP_ORIGIN': ['http://sweet.production-check.io', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.2', 'https://example.com', 'https://sweet.production-check.io/path', 'https://user:private@sweet.production-check.io'],
            'OIDC_ISSUER': ['http://identity.production-check.io', 'https://127.0.0.1:9200', 'https://identity.example.com', 'https://identity.production-check.io/?token=private'],
            'OIDC_ALLOW_LOCAL_HTTP': ['', 'true'],
            'OIDC_CLIENT_ID': ['', '<client-id>'],
            'OIDC_CLIENT_SECRET': ['', 'changemechangemechangeme'],
            'OIDC_AUDIENCE': [''],
            'OIDC_SCOPE': ['openid', 'quotes:read quotes:write'],
            'SESSION_SECRET': ['a' * 64, 'x' * 64, '0123456789abcdef'],
            'INTEGRATION_SERVICE_KEY': ['a' * 48, 'short', 'has spaces ' * 4],
            'RUC_PROVIDER': ['demo', 'disabled'],
            'RUC_API_TOKEN': ['', 'Bearer token', 'token with spaces'],
            'API_BACKEND': ['invalid', ''],
            'API_BASE_URL': ['http://public.production-check.io', 'http://localhost:8000', 'http://api-dotnet:8000/path'],
            'TRUSTED_CLIENT_IP_HEADER': ['authorization'],
            'RUC_DAILY_LIMIT': ['0', '-5', 'abc', '100001', '1.5'],
            'BACKUP_INTERVAL_HOURS': ['-1', '169', 'x', '1.5'],
            'BACKUP_KEEP': ['0', '366', 'x'],
            'NODE_ENV': ['development'],
            'APP_ENV': ['development'],
            'ASPNETCORE_ENVIRONMENT': ['Development'],
        }
        for key, values in cases.items():
            for value in values:
                with self.subTest(key=key):
                    config = synthetic_configuration()
                    config[key] = value
                    self.assertEqual(preflight.evaluate(config)['status'], 'failed')
        self.assertEqual(preflight.evaluate({})['status'], 'failed')

    def test_backup_settings_are_optional_and_bounded(self):
        for key, values in (('BACKUP_INTERVAL_HOURS', ('', '0', '24', '168')), ('BACKUP_KEEP', ('', '1', '7', '365'))):
            for value in values:
                with self.subTest(key=key, value=value):
                    config = synthetic_configuration()
                    config[key] = value
                    self.assertEqual(preflight.evaluate(config)['status'], 'passed')

    def test_ruc_daily_limit_is_optional_and_bounded(self):
        for value in ('', '1', '500', '100000'):
            with self.subTest(value=value):
                config = synthetic_configuration()
                config['RUC_DAILY_LIMIT'] = value
                self.assertEqual(preflight.evaluate(config)['status'], 'passed')

    def test_secret_keys_must_be_independent(self):
        config = synthetic_configuration()
        config['INTEGRATION_SERVICE_KEY'] = config['SESSION_SECRET']
        self.assertEqual(preflight.evaluate(config)['status'], 'failed')

    def test_env_file_is_explicit_and_environment_has_precedence(self):
        with tempfile.TemporaryDirectory(prefix='sweet-preflight-') as temporary:
            path = Path(temporary) / 'synthetic.env'
            config = synthetic_configuration()
            path.write_text('\n'.join(f'{key}={value}' for key, value in config.items()), encoding='utf-8')
            with patch.dict('os.environ', {}, clear=True), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(preflight.main(['--env-file', str(path)]), 0)
            for secret in ('SYNTHETIC_CLIENT_CREDENTIAL_123', 'SYNTHETIC_RUC_CREDENTIAL_123'):
                self.assertNotIn(secret, output.getvalue())
            with patch.dict('os.environ', {'OIDC_ALLOW_LOCAL_HTTP': 'true'}, clear=True), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(preflight.main(['--env-file', str(path)]), 1)
            with patch.dict('os.environ', {}, clear=True), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(preflight.main([]), 1)

    def test_env_parser_does_not_execute_or_expand_values(self):
        with tempfile.TemporaryDirectory(prefix='sweet-preflight-') as temporary:
            path = Path(temporary) / 'synthetic.env'
            path.write_text('# comment\nexport ONE="literal $(command)" # ignored\nTWO=abc=def # comment\nTHREE=\'literal ${ONE}\'\n', encoding='utf-8')
            self.assertEqual(preflight.read_env(path), {'ONE': 'literal $(command)', 'TWO': 'abc=def', 'THREE': 'literal ${ONE}'})
            for content in ('TOKEN=one\nTOKEN=two', 'TOKEN="unterminated', 'NOT AN ASSIGNMENT'):
                path.write_text(content, encoding='utf-8')
                with self.assertRaises(preflight.ConfigurationError):
                    preflight.read_env(path)


if __name__ == '__main__':
    unittest.main()
