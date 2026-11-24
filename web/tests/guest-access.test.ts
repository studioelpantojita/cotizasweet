import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {issueGuestContext,readGuestContext,quoteActorCan,guestOperationLimit,guestStartLimit,guestContextSeconds,type QuoteActor} from '../server/quote-actor';
import {closeDatabase,db,digest,putState} from '../server/store';

const folder=resolve('../tests/artifacts');mkdirSync(folder,{recursive:true});
process.env.DATABASE_PATH=resolve(folder,'guest-access-'+randomUUID()+'.sqlite');
process.env.SESSION_SECRET='67'.repeat(32);
delete process.env.TRUSTED_CLIENT_IP_HEADER;
after(()=>closeDatabase());

test('guest context is opaque, unique, namespaced and fixed to four hours',()=>{
 const before=Date.now(),first=issueGuestContext(),second=issueGuestContext();
 assert.equal(guestContextSeconds,14400);assert.match(first.token,/^[A-Za-z0-9_-]{43}$/);
 assert.match(first.actor.owner,/^guest:[0-9a-f]{64}$/);assert.notEqual(first.actor.owner,second.actor.owner);assert.notEqual(first.token,second.token);
 assert.ok(Date.parse(first.actor.expiresAt)>=before+14_400_000&&Date.parse(first.actor.expiresAt)<=Date.now()+14_400_000);
 assert.deepEqual(readGuestContext(first.token),first.actor);assert.deepEqual(readGuestContext(first.token),first.actor);
 assert.equal('session' in first.actor,false);assert.equal('scopes' in first.actor,false);assert.equal('role' in first.actor,false);
});

test('guest token cannot substitute account state, malformed state or expired context',()=>{
 const current=issueGuestContext();
 const accountToken=putState('session',current.actor,guestContextSeconds);
 assert.equal(readGuestContext(accountToken),null);assert.equal(readGuestContext('forged'),null);
 const malformed=putState('guest',{...current.actor,owner:'account-owner'},guestContextSeconds);
 assert.equal(readGuestContext(malformed),null);
 const expired=putState('guest',{...current.actor,expiresAt:new Date(Date.now()-1).toISOString()},guestContextSeconds);
 assert.equal(readGuestContext(expired),null);
 db().prepare('UPDATE secure_state SET expires=? WHERE id=?').run(Date.now()-1,digest(current.token));
 assert.equal(readGuestContext(current.token),null);
});

test('account scopes stay authoritative while guests receive only explicit quotation operations',()=>{
 const guest=issueGuestContext().actor;
 assert.equal(quoteActorCan(guest,'write'),true);assert.equal(quoteActorCan(guest,'document'),true);
 const account:QuoteActor={kind:'account',owner:'account',displayName:'Account',session:{owner:'account',displayName:'Account',accessToken:'synthetic',scopes:['quotes:read']}};
 assert.equal(quoteActorCan(account,'write'),false);assert.equal(quoteActorCan(account,'document'),true);
 assert.equal(quoteActorCan({...account,session:{...account.session,scopes:[]}},'document'),false);
});

test('guest write quota is persistent and separate for each server-issued owner',()=>{
 db().prepare('DELETE FROM request_limits').run();
 const first=issueGuestContext().actor,second=issueGuestContext().actor;
 for(let i=0;i<5;i++)assert.equal(guestOperationLimit(first,'write'),null);
 const blocked=guestOperationLimit(first,'write');assert.equal(blocked?.status,429);assert.ok(Number(blocked?.headers.get('Retry-After'))>0);
 assert.equal(guestOperationLimit(second,'write'),null);
 assert.ok(Number(db().prepare('SELECT count(*) AS n FROM request_limits').get()?.n)>0);
});

test('guest start has a global budget even when forwarded addresses are untrusted',()=>{
 db().prepare('DELETE FROM request_limits').run();
 for(let i=0;i<100;i++)assert.equal(guestStartLimit(new Request('https://qa.example.test/api/guest/start',{headers:{'x-forwarded-for':'192.0.2.'+(i%254+1)}})),null);
 const blocked=guestStartLimit(new Request('https://qa.example.test/api/guest/start',{headers:{'x-forwarded-for':'198.51.100.4'}}));
 assert.equal(blocked?.status,429);assert.equal(blocked?.headers.get('Cache-Control'),'no-store');
});
