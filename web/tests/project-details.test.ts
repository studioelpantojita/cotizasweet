import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuoteSchema,quoteSchema,totals} from '../lib/quote';
import {normalizeProjectDetails,projectBriefPatch,projectDetails} from '../lib/project-details';

const fixture=quoteSchema.parse(JSON.parse(readFileSync('../contracts/example-quote.json','utf-8')));

test('the full project detail takes precedence over the former title',()=>{
  assert.equal(projectDetails({...fixture,event:'Título anterior',projectBrief:'  Detalle completo\nCon dos líneas.  '}),'Detalle completo\nCon dos líneas.');
  assert.equal(projectDetails({...fixture,event:'  Título conservado  ',projectBrief:' \n '}),'Título conservado');
});

test('a long multiline detail keeps its complete content and a bounded compatibility title',()=>{
  const brief=('Celebración para invitados.\n'.repeat(24)).slice(0,589)+'FIN-DETALLE';
  assert.equal(brief.length,600);
  const patch=projectBriefPatch(brief);
  assert.equal(patch.projectBrief,brief);
  assert.equal(patch.event.length,120);
  assert.ok(!/[\r\n]/.test(patch.event));
  const quote={...fixture,...patch};
  assert.ok(createQuoteSchema.safeParse(quote).success);
  assert.deepEqual(totals(quote),totals(fixture));
});

test('compatibility titles do not cut a UTF-16 surrogate pair',()=>{
  const brief='A'.repeat(119)+'😀 celebración';
  const patch=projectBriefPatch(brief);
  assert.equal(patch.event,'A'.repeat(119));
  assert.equal(patch.projectBrief,brief);
});

test('reopening an old proposal populates the detail from its former title',()=>{
  const old={...fixture,event:'Celebración histórica conservada',projectBrief:''};
  const normalized=normalizeProjectDetails(old);
  assert.equal(normalized.projectBrief,old.event);
  assert.equal(normalized.event,old.event);
  assert.equal(normalized.items,old.items);
  assert.equal(old.projectBrief,'');
});

test('normalizing an existing detail preserves the former metadata and typed whitespace',()=>{
  const quote={...fixture,event:'Título histórico independiente',projectBrief:'Proyecto en curso '};
  assert.equal(normalizeProjectDetails(quote),quote);
  assert.equal(normalizeProjectDetails(quote).projectBrief,'Proyecto en curso ');
});

test('clearing the detail clears its compatibility title and remains invalid for creation',()=>{
  const quote=normalizeProjectDetails({...fixture,...projectBriefPatch('')});
  assert.equal(quote.event,'');
  assert.equal(quote.projectBrief,'');
  const parsed=createQuoteSchema.safeParse(quote);
  assert.ok(!parsed.success);
  if(!parsed.success)assert.ok(parsed.error.issues.some(issue=>issue.path[0]==='event'));
});

test('server-facing validation still rejects details longer than 600 units',()=>{
  assert.ok(!createQuoteSchema.safeParse({...fixture,...projectBriefPatch('X'.repeat(601))}).success);
});
