import {test,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {decodeJwt} from 'jose';
import {createAccount,accountExists,accountSession} from '../server/accounts';
import {putState,closeDatabase} from '../server/store';
import {enrollNewAccount,hasPromotionEnrollment,readOfferIntent} from '../server/promotions';
import {priceForActor} from '../server/quote-pricing';
import {initialQuote,catalog,type Quote} from '../lib/quote';

mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T17:00:00Z')});
Object.assign(process.env,{DATABASE_PATH:resolve('../tests/artifacts/promotion-enrollment-'+randomUUID()+'.sqlite'),SESSION_SECRET:'ab'.repeat(32),APP_ORIGIN:'http://127.0.0.1:3370',NODE_ENV:'development',ACCOUNT_AUTH_ENABLED:'true',ACCOUNT_JWT_SECRET:'ba'.repeat(32),ACCOUNT_ISSUER:'http://127.0.0.1:3370/accounts'});
after(()=>{closeDatabase();mock.timers.reset();});
const proof=()=>putState('promotion',{campaignId:'navidad-2026',acceptedAt:new Date().toISOString()},1800);
const passphrase='A long synthetic holiday passphrase';
const example=():Quote=>({...initialQuote(),client:'QA promoción',clientDocument:'12345678',contact:'900000000',event:'Prueba navideña',eventDate:'2026-12-15',items:[{...catalog[1],quantity:2}]});
test('new account plus explicit invitation enrolls once and issues a trusted campaign claim',async()=>{
 const intent=proof();
 const account=await createAccount('holiday_customer',passphrase,'QA cliente','customer',id=>enrollNewAccount(id,intent));
 assert.ok(hasPromotionEnrollment(account.id));assert.equal(readOfferIntent(intent),null);
 const {session}=await accountSession(account);assert.equal(decodeJwt(session.accessToken).promotion,'navidad-2026');
 const priced=priceForActor(example(),{kind:'account',owner:session.owner,displayName:session.displayName,session});
 assert.equal(priced.promotion?.percent,20);
});
test('ordinary registration does not silently enroll or issue a promotion claim',async()=>{
 const account=await createAccount('ordinary_customer',passphrase,'QA cliente');
 assert.equal(hasPromotionEnrollment(account.id),false);
 const {session}=await accountSession(account);assert.equal(decodeJwt(session.accessToken).promotion,undefined);
 assert.equal(priceForActor(example(),{kind:'account',owner:session.owner,displayName:session.displayName,session}).promotion,undefined);
 assert.throws(()=>priceForActor({...example(),promotion:{campaignId:'navidad-2026',percent:20}},{kind:'account',owner:session.owner,displayName:session.displayName,session}));
});
test('replayed or invalid invitation rolls back account creation without changing its first owner',async()=>{
 const intent=proof();const first=await createAccount('proof_owner',passphrase,'QA cliente','customer',id=>enrollNewAccount(id,intent));
 await assert.rejects(createAccount('proof_replay',passphrase,'QA cliente','customer',id=>enrollNewAccount(id,intent)));
 assert.equal(accountExists('proof_replay'),false);assert.ok(hasPromotionEnrollment(first.id));
 await assert.rejects(createAccount('invalid_proof',passphrase,'QA cliente','customer',id=>enrollNewAccount(id,'invalid')));
 assert.equal(accountExists('invalid_proof'),false);
});
test('administrator and guest cannot acquire this new-customer promotion',async()=>{
 const intent=proof();await assert.rejects(createAccount('admin_promo',passphrase,'QA administrador','admin',id=>enrollNewAccount(id,intent)));
 assert.equal(accountExists('admin_promo'),false);
 const guest={kind:'guest' as const,owner:'guest:'+'a'.repeat(64),displayName:'Cliente invitado',expiresAt:'2026-11-23T21:00:00Z'};
 assert.throws(()=>priceForActor({...example(),promotion:{campaignId:'navidad-2026',percent:20}},guest));
 assert.equal(priceForActor(example(),guest).promotion,undefined);
});
