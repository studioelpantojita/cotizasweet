"""Ephemeral loopback HTTPS proxy for production-browser QA, with no access logs."""
from contextlib import contextmanager
import datetime as dt
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
from pathlib import Path
import ssl
import threading

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
import httpx


@contextmanager
def local_https_proxy(folder: Path, upstream: str, port: int):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
    now = dt.datetime.now(dt.timezone.utc)
    certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1)).not_valid_after(now + dt.timedelta(hours=1))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),
            x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]), critical=False)
        .sign(key, hashes.SHA256()))
    certificate_path, key_path = folder / 'qa-cert.pem', folder / 'qa-key.pem'
    certificate_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    key_path.chmod(0o600)
    client = httpx.Client(timeout=60, trust_env=False, follow_redirects=False)
    hop_headers = {'connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length'}

    class Proxy(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def forward(self):
            length = int(self.headers.get('Content-Length', '0'))
            if length > 70000:
                self.send_error(413)
                return
            # Prefixing a fixed loopback origin keeps request paths from selecting another host.
            if not self.path.startswith('/') or self.path.startswith('//'):
                self.send_error(400)
                return
            headers = {k: v for k, v in self.headers.items() if k.lower() not in hop_headers}
            response = client.request(self.command, upstream + self.path, headers=headers,
                content=self.rfile.read(length) if length else None)
            self.send_response(response.status_code)
            for header, value in response.headers.multi_items():
                if header.lower() not in hop_headers:
                    self.send_header(header, value)
            self.send_header('Content-Length', str(len(response.content)))
            self.end_headers()
            self.wfile.write(response.content)

        do_GET = forward
        do_POST = forward

    server = ThreadingHTTPServer(('127.0.0.1', port), Proxy)
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain(certificate_path, key_path)
    server.socket = tls.wrap_socket(server.socket, server_side=True)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f'https://localhost:{port}'
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        client.close()
