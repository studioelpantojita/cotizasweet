import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {jwtVerify,decodeProtectedHeader} from 'jose';
import {accountConfig,createAccount,authenticateAccount,getAccount,changePassword,disableAccount,normalizeUsername,hashPassword,checkPassword,accountSession,AccountError} from '../server/accounts';
import {db,closeDatabase,ownerKey} from '../server/store';
const folder=mkdtempSync(join(tmpdir(),'ea-account-test-'));
Object.assign(process.env,{DATABASE_PATH:join(folder,'accounts.sqlite'),APP_ORIGIN:'http://127.0.0.1:3370',NODE_ENV:'development',ACCOUNT_AUTH_ENABLED:'true',ACCOUNT_JWT_SECRET:'a'.repeat(64),ACCOUNT_ISSUER:'http://127.0.0.1:3370/accounts'});
after(()=>{closeDatabase();rmSync(folder,{recursive:true,force:true});});
test('configuration requires explicit enablement, origin-bound issuer and random-length key',()=>{
 const original=process.env.ACCOUNT_JWT_SECRET;process.env.ACCOUNT_JWT_SECRET='bad';assert.throws(accountConfig,AccountError);process.env.ACCOUNT_JWT_SECRET=original;
 process.env.ACCOUNT_ISSUER='https://attacker.example/accounts';assert.throws(accountConfig,AccountError);process.env.ACCOUNT_ISSUER='http://127.0.0.1:3370/accounts';assert.equal(accountConfig().audience,'ea-cotiza-api');
});
test('username canonicalization rejects SQL/control characters and ambiguous unicode',()=>{
 assert.equal(normalizeUsername('  Client.Example  '),'client.example');
 for(const name of ["x' OR 1=1",'admin\nuser','Ａdmin','ab'])assert.throws(()=>normalizeUsername(name));
});
test('scrypt uses unique salts, matches exact passwords and rejects malformed encodings',async()=>{
 const first=await hashPassword('This is a long sample passphrase'),second=await hashPassword('This is a long sample passphrase');assert.notEqual(first,second);assert.match(first,/^scrypt\$65536\$8\$2\$/);
 assert.equal(await checkPassword('This is a long sample passphrase',first),true);assert.equal(await checkPassword('This is a long sample passphrase ',first),false);assert.equal(await checkPassword('anything','scrypt$999999$8$2$bad$bad'),false);
});
test('create and authenticate customer and admin without returning password hashes',async()=>{
 const customer=await createAccount('sample_customer','Customer sample passphrase 123','Client'),admin=await createAccount('sample_admin','Administrator sample passphrase 123','Owner','admin');
 assert.equal(customer.role,'customer');assert.equal(admin.role,'admin');assert.equal('password_hash' in customer,false);
 assert.equal((await authenticateAccount('SAMPLE_CUSTOMER','Customer sample passphrase 123'))?.id,customer.id);assert.equal(await authenticateAccount('sample_customer','incorrect'),null);assert.equal(await authenticateAccount('missing_user','incorrect'),null);
 assert.equal(db().prepare('SELECT count(*) AS n FROM accounts WHERE password_hash=?').get('Customer sample passphrase 123')?.n,0);
});
test('password change invalidates all older session versions and inactive accounts cannot authenticate',async()=>{
 const customer=await createAccount('revocation_client','Original sample passphrase 123','Client');await changePassword(customer.id,'Changed sample passphrase 456');assert.equal(getAccount(customer.id)?.authVersion,customer.authVersion+1);assert.equal(await authenticateAccount(customer.username,'Original sample passphrase 123'),null);
 assert.ok(await authenticateAccount(customer.username,'Changed sample passphrase 456'));disableAccount(customer.id);assert.equal(await authenticateAccount(customer.username,'Changed sample passphrase 456'),null);
});
test('issued token has pinned issuer, audience, algorithm, scopes and correct owner namespace',async()=>{
 const customer=await createAccount('token_client','JWT account sample passphrase 123','Client'),{session}=await accountSession(customer),cfg=accountConfig();
 const verified=await jwtVerify(session.accessToken,cfg.key,{issuer:cfg.issuer,audience:cfg.audience,algorithms:['HS256']});assert.equal(decodeProtectedHeader(session.accessToken).alg,'HS256');assert.equal(verified.payload.sub,customer.id);assert.equal(verified.payload.scope,'quotes:read quotes:write');assert.equal(verified.payload.role,'customer');assert.equal(session.owner,ownerKey(cfg.issuer,customer.id));
 await assert.rejects(jwtVerify(session.accessToken,Buffer.from('b'.repeat(64),'hex'),{algorithms:['HS256']}));
});
test('shared derivation cap bounds registration and authentication memory pressure',async()=>{
 const first=hashPassword('First concurrency sample password'),second=hashPassword('Second concurrency sample password');await assert.rejects(hashPassword('Third concurrency sample password'),(error:unknown)=>error instanceof AccountError&&error.status===429);await Promise.all([first,second]);
});
