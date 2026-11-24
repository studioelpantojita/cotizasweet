import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {quoteSchema,createQuoteSchema,totals,type Quote} from '../lib/quote';
import {promotionForEvent,promotionOfferActive,promotionCreationAllowed,promotionCampaignId,applyCurrentPromotion} from '../lib/promotion';
import {createQuotePdf} from '../lib/pdf';

const now=new Date('2026-11-23T17:00:00Z');
const source=JSON.parse(readFileSync('../contracts/example-quote.json','utf8'));
const sample:Quote=quoteSchema.parse({...source,issued:'2026-11-23',validUntil:'2026-12-14',eventDate:'2026-11-30',projectBrief:'Evento de prueba con beneficio navideño por registro.'});
test('campaign dates follow Peru midnight and preserve inclusive event endpoints',()=>{
 assert.equal(promotionCampaignId,'navidad-2026');
 assert.equal(promotionOfferActive(new Date('2026-11-23T04:59:59Z')),false);
 assert.equal(promotionOfferActive(new Date('2026-11-23T05:00:00Z')),true);
 assert.equal(promotionOfferActive(new Date('2027-01-03T04:59:59Z')),true);
 assert.equal(promotionOfferActive(new Date('2027-01-03T05:00:00Z')),false);
 for(const date of ['2026-11-30','2026-12-01','2026-12-31','2027-01-02'])assert.equal(promotionForEvent(date,true,now)?.percent,20);
 for(const date of ['2026-11-29','2027-01-03','2026-11-31','invalid'])assert.equal(promotionForEvent(date,true,now),undefined);
});
test('entitlement and server clock are required independently from client quote dates',()=>{
 const promoted=applyCurrentPromotion(sample,true,now);
 assert.equal(promoted.promotion?.percent,20);
 assert.equal(applyCurrentPromotion(promoted,false,now).promotion,undefined);
 assert.equal(promotionCreationAllowed(promoted,false,now),false);
 assert.equal(promotionCreationAllowed(promoted,true,new Date('2027-01-03T05:00:00Z')),false);
 assert.equal(promotionCreationAllowed(promoted,true,now),true);
 assert.equal(createQuoteSchema.safeParse(promoted).success,true);
 for(const promotion of [{campaignId:'other',percent:20},{campaignId:'navidad-2026',percent:100},{campaignId:'navidad-2026',percent:20,extra:true}])assert.equal(quoteSchema.safeParse({...sample,promotion}).success,false);
 assert.equal(createQuoteSchema.safeParse({...promoted,eventDate:'2027-01-03'}).success,false);
});
test('20 percent reduces services before mobility, IGV and advance with cent rounding',()=>{
 const original=totals(sample),promoted=applyCurrentPromotion(sample,true,now),pickup=totals(promoted);
 assert.equal(original.total,33984);assert.equal(original.discount,0);assert.equal(original.netServices,28800);
 assert.deepEqual({discount:pickup.discount,net:pickup.netServices,mobility:pickup.mobility,tax:pickup.tax,total:pickup.total,advance:pickup.advance,balance:pickup.balance},{discount:5760,net:23040,mobility:0,tax:4147,total:27187,advance:13594,balance:13593});
 const delivered=totals({...promoted,locationMode:'on_location',provinceId:'1501',districtId:'150130',address:'Referencia sintética'});
 assert.equal(delivered.mobility,1152);assert.equal(delivered.base,24192);assert.equal(delivered.tax,4355);assert.equal(delivered.total,28547);
 const rounding=totals({...promoted,items:[{...sample.items[0],quantity:1,priceCents:101}],locationMode:'on_location'});
 assert.equal(rounding.discount,20);assert.equal(rounding.netServices,81);assert.equal(rounding.mobility,4);assert.equal(rounding.total,100);
});
test('saved promotion remains readable after campaign expiry and PDF carries the discount',()=>{
 const promoted=applyCurrentPromotion(sample,true,now);
 assert.equal(quoteSchema.safeParse(promoted).success,true);
 assert.equal(promotionForEvent(promoted.eventDate,true,new Date('2028-01-01T00:00:00Z')),undefined);
 const regular=readFileSync('public/fonts/quote-regular.ttf').toString('base64'),bold=readFileSync('public/fonts/quote-bold.ttf').toString('base64');
 const folder=resolve('../tests/artifacts');mkdirSync(folder,{recursive:true});
 const document=createQuotePdf(promoted,'navidad-demo',{regular,bold});
 writeFileSync(resolve(folder,'navidad-promocion.pdf'),Buffer.from(document.output('arraybuffer')));
});
