import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('railway_preflight',Path(__file__).resolve().parents[2]/'scripts/preflight.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class RailwayOrigins(unittest.TestCase):
    def test_exact_private_names(self):
        for host in ('api-dotnet.railway.internal','api-python.railway.internal'):
            self.assertTrue(module._service_url('http://'+host+':8000'))
    def test_unapproved_origins(self):
        for value in ('http://evil.railway.internal:8000','http://api-python.railway.internal.evil.example:8000','http://api-python.railway.internal:1234','http://user:pass@api-python.railway.internal:8000','http://api-python.railway.internal:8000/path'):
            self.assertFalse(module._service_url(value))
