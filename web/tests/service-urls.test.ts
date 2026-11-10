import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceBaseUrl} from '../server/config';
test('Railway and Compose service origins are permitted explicitly',()=>{
 for(const host of ['api-python.railway.internal','api-dotnet.railway.internal','api-python','api-dotnet','127.0.0.1','localhost'])assert.equal(serviceBaseUrl(`http://${host}:8000`).hostname,host);
 assert.equal(serviceBaseUrl('https://api.example.com').protocol,'https:');
});
test('Private service allowlist rejects spoofed suffixes, credentials, paths and non-HTTP protocols',()=>{
 for(const url of ['http://api-python.railway.internal.evil.example','http://evil.railway.internal','http://api.example.com','ftp://api-python.railway.internal','https://user:secret@api.example.com','https://api.example.com/path','https://api.example.com/?secret=x','https://api.example.com/#x','http://api-python:0'])assert.throws(()=>serviceBaseUrl(url),url);
});
