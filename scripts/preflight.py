"""Offline production configuration checks. Secret values are never printed."""
from __future__ import annotations

import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit


class ConfigurationError(Exception):
    pass


def read_env(path: str | Path) -> dict[str, str]:
    source = Path(path)
    if source.stat().st_size > 65536:
        raise ConfigurationError('El archivo de configuración supera el tamaño permitido.')
    result: dict[str, str] = {}
    for line in source.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)', line)
        if not match or match[1] in result:
            raise ConfigurationError('El archivo contiene una asignación inválida o una clave duplicada.')
        value = match[2].strip()
        if value.startswith(('"', "'")):
            quote = value[0]
            end = value.find(quote, 1)
            if end < 0 or (value[end+1:].strip() and not value[end+1:].strip().startswith('#')):
                raise ConfigurationError('El archivo contiene un valor entre comillas inválido.')
            value = value[1:end]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
        if '\x00' in value:
            raise ConfigurationError('El archivo contiene un carácter inválido.')
        result[match[1]] = value
    return result


def _set(value: str) -> bool:
    normalized = value.strip().lower()
    return bool(normalized) and not any(marker in normalized for marker in ('changeme', 'change-me', 'replace-me', 'placeholder', 'your_secret', 'your-token', 'reemplazar', '<', '>'))


def _public_host(host: str | None) -> bool:
    if not host:
        return False
    host = host.lower().rstrip('.')
    if host in ('localhost', 'example.com', 'example.net', 'example.org') or host.endswith(('.localhost', '.local', '.internal', '.invalid', '.test', '.example', '.example.com', '.example.net', '.example.org')):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return '.' in host and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in host.encode('idna').decode('ascii').split('.'))


def _https(value: str, origin: bool = False) -> bool:
    try:
        url = urlsplit(value)
        return (url.scheme == 'https' and _public_host(url.hostname) and url.username is None and url.password is None
                and not url.query and not url.fragment and (not origin or url.path in ('', '/'))
                and (url.port is None or 1 <= url.port <= 65535))
    except (ValueError, UnicodeError):
        return False


def _service_url(value: str) -> bool:
    try:
        url = urlsplit(value)
        return (_https(value) or (url.scheme == 'http' and url.hostname in ('api-dotnet', 'api-python', 'api-dotnet.railway.internal', 'api-python.railway.internal') and url.port in (None, 8000))) and url.username is None and url.password is None and not url.query and not url.fragment and url.path in ('', '/')
    except (ValueError, UnicodeError):
        return False


def evaluate(config: dict[str, str]) -> dict:
    checks: list[dict] = []
    def check(name: str, passed: bool, message: str) -> None:
        checks.append({'id': name, 'status': 'passed' if passed else 'failed', 'message': message})

    check('app_origin', _https(config.get('APP_ORIGIN', ''), True), 'APP_ORIGIN debe ser un origen HTTPS público, sin ruta, credenciales ni valores de ejemplo.')
    check('oidc_issuer', _https(config.get('OIDC_ISSUER', '')), 'OIDC_ISSUER debe ser un emisor HTTPS público real; no se admite la identidad local de desarrollo.')
    check('oidc_local_http_disabled', config.get('OIDC_ALLOW_LOCAL_HTTP') == 'false', 'OIDC_ALLOW_LOCAL_HTTP debe establecerse explícitamente en false.')
    check('production_modes', all(config.get(key, expected).lower() == expected for key, expected in (('NODE_ENV', 'production'), ('APP_ENV', 'production'), ('ASPNETCORE_ENVIRONMENT', 'production'))), 'Los modos de entorno declarados deben ser de producción.')
    check('oidc_client_id', _set(config.get('OIDC_CLIENT_ID', '')), 'OIDC_CLIENT_ID debe estar configurado sin marcadores de ejemplo.')
    client_secret = config.get('OIDC_CLIENT_SECRET', '')
    check('oidc_client_secret', _set(client_secret) and len(client_secret) >= 16, 'OIDC_CLIENT_SECRET debe estar presente y tener al menos 16 caracteres.')
    check('oidc_audience', _set(config.get('OIDC_AUDIENCE', '')), 'OIDC_AUDIENCE debe corresponder al API registrado en el proveedor.')
    scopes = set(config.get('OIDC_SCOPE', '').split())
    check('oidc_scopes', {'openid', 'quotes:read', 'quotes:write'} <= scopes, 'OIDC_SCOPE debe incluir openid, quotes:read y quotes:write.')
    session = config.get('SESSION_SECRET', '')
    check('session_secret', re.fullmatch(r'[a-fA-F0-9]{64}', session) is not None and len(set(session.lower())) >= 8, 'SESSION_SECRET debe contener 32 bytes aleatorios codificados en 64 dígitos hexadecimales, sin valores triviales.')
    service = config.get('INTEGRATION_SERVICE_KEY', '')
    check('integration_key', _set(service) and 32 <= len(service) <= 256 and len(set(service)) >= 8 and all(33 <= ord(char) <= 126 for char in service) and service != session, 'INTEGRATION_SERVICE_KEY debe ser independiente, aleatoria y de 32 a 256 caracteres ASCII sin espacios.')
    check('ruc_provider', config.get('RUC_PROVIDER') == 'decolecta', 'RUC_PROVIDER debe ser decolecta para verificar RUC reales; demo y disabled bloquean esta validación de producción.')
    token = config.get('RUC_API_TOKEN', '')
    check('ruc_token', _set(token) and not token.lower().startswith('bearer ') and not any(char.isspace() for char in token), 'RUC_API_TOKEN debe estar presente sin el prefijo Bearer ni espacios.')
    backend = config.get('API_BACKEND', '')
    check('api_backend', backend in ('next', 'dotnet', 'python'), 'API_BACKEND debe seleccionarse explícitamente.')
    if backend in ('dotnet', 'python'):
        check('api_base_url', _service_url(config.get('API_BASE_URL', '')), 'API_BASE_URL debe ser HTTPS o el servicio interno de Compose, sin credenciales ni rutas adicionales.')
    if backend != 'dotnet' or 'RUC_SERVICE_URL' in config:
        check('ruc_service_url', _service_url(config.get('RUC_SERVICE_URL', '')), 'RUC_SERVICE_URL debe ser HTTPS o el servicio interno de Compose, sin credenciales ni rutas adicionales.')
    proxy_header = config.get('TRUSTED_CLIENT_IP_HEADER', '')
    check('trusted_proxy_header', proxy_header in ('', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'), 'La cabecera de dirección de proxy, si se configura, debe ser una opción admitida y ser reemplazada por el proxy confiable.')
    return {
        'status': 'passed' if all(item['status'] == 'passed' for item in checks) else 'failed',
        'checks': checks,
        'limitations': [
            'Comprobación estática sin red: no confirma DNS, TLS, disponibilidad, registro OIDC, permisos ni validez de tokens.',
            'La longitud y variedad de las claves no prueban su aleatoriedad; deben generarse con una fuente criptográfica.',
            'No sustituye la revisión comercial, el respaldo y restauración, la configuración del proxy ni las pruebas del despliegue.',
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Validar configuración de producción sin imprimir valores ni realizar consultas externas.')
    parser.add_argument('--env-file', help='Archivo explícito opcional. Las variables del proceso tienen precedencia.')
    args = parser.parse_args(argv)
    try:
        config = read_env(args.env_file) if args.env_file else {}
        config.update(os.environ)
        result = evaluate(config)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result['status'] == 'passed' else 1
    except ConfigurationError as error:
        message = str(error)
    except (OSError, UnicodeError):
        message = 'No se pudo leer el archivo de configuración solicitado.'
    print(json.dumps({'status': 'error', 'message': message}, ensure_ascii=False))
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
