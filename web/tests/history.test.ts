import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readHistory,readHistoryPage,appendHistory,isUnreadable} from '../lib/history';

const example=JSON.parse(readFileSync(new URL('../../contracts/example-quote.json',import.meta.url),'utf8'));
const row=(id:string,quote:unknown,totalCents:unknown=50976)=>({id,createdAt:'2026-11-13T13:51:14.815Z',totalCents,quote});

test('one quote from an older version no longer hides the valid ones',()=>{
 const history=readHistory([
  row('b0d77027-legacy',{...example,client:'Luis Gómez',projectType:'navidad'}),
  row('e029edb4',{...example,client:'Carlos Ruiz'},33984),
  row('e4dc8950',{...example,client:'Ana Torres'},16992),
  row('bc85bbf4',{...example,client:'María Pérez'}),
 ]);
 assert.equal(history.length,4);
 assert.deepEqual(history.map(h=>isUnreadable(h)),[true,false,false,false]);
 assert.deepEqual(history.map(h=>isUnreadable(h)?h.client:h.quote.client),['Luis Gómez','Carlos Ruiz','Ana Torres','María Pérez']);
 const valid=history[1];assert.ok(!isUnreadable(valid));assert.equal(valid.totalCents,33984);assert.equal(valid.quote.projectType,example.projectType);
});

test('damaged rows are marked without trusting their content',()=>{
 const history=readHistory([null,'texto',row('x',undefined),row('y',{client:'   '}),row('z',{...example,client:'Sin total'},-1),row('w',{...example,client:'Total decimal'},10.5),{quote:{client:'x'.repeat(500)}}]);
 assert.ok(history.every(isUnreadable));
 assert.deepEqual(history.map(h=>h.id),['desconocida-1','desconocida-2','x','y','z','w','desconocida-7']);
 assert.equal(history[3].client,'Propuesta sin nombre');
 assert.equal(history[4].client,'Sin total');
 assert.equal(history[6].client.length,120);
});

test('only a response that is not a list fails as a whole',()=>{
 for(const value of [undefined,null,{},'[]',42])assert.throws(()=>readHistory(value),/formato inesperado/);
 assert.deepEqual(readHistory([]),[]);
});

test('history pages carry a cursor and later pages never repeat a proposal',()=>{
 const first=readHistoryPage({quotes:[row('a',{...example,client:'A'}),row('b',{...example,client:'B'})],nextCursor:'2026-11-13T13:51:14.815Z_b'});
 assert.equal(first.nextCursor,'2026-11-13T13:51:14.815Z_b');assert.equal(first.entries.length,2);
 const last=readHistoryPage({quotes:[row('b',{...example,client:'B'}),row('c',{...example,client:'C'})],nextCursor:null});
 assert.equal(last.nextCursor,null);
 assert.deepEqual(appendHistory(first.entries,last.entries).map(h=>h.id),['a','b','c']);
 assert.equal(readHistoryPage({quotes:[]}).nextCursor,null);
 for(const body of [{quotes:[],nextCursor:42},{quotes:[],nextCursor:'x'.repeat(121)},{nextCursor:null},null])assert.throws(()=>readHistoryPage(body),/formato inesperado/);
});
