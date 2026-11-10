import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {test} from 'node:test';
import {collections,projectTypes,catalog,addons} from '../lib/quote';
import {projectPresentations,presentationFor,projectsInCollection,quoteHref} from '../lib/project-presentations';

test('Every supported occasion has real images and existing service references, without inventing prices', () => {
  assert.deepEqual(Object.keys(projectPresentations).sort(), projectTypes.map(p => p.id).sort());
  const available = new Set([...catalog,...addons].map(s => s.id));
  for (const project of projectTypes) {
    const raw = projectPresentations[project.id];
    const presentation = presentationFor(project.id);
    assert.ok(existsSync('public/images/'+raw.image), project.id);
    assert.ok(raw.services.length && raw.services.every(id => available.has(id)), project.id);
    assert.equal(new Set(raw.services).size, raw.services.length);
    assert.ok(presentation.pieces.length >= 3);
    for (const piece of presentation.pieces) assert.ok(piece && existsSync('public/images/'+piece.image), project.id);
    assert.equal('priceCents' in raw, false);
  }
});

test('Collection choices partition all supported projects and put a custom project first', () => {
  const seen:string[] = [];
  for (const collection of collections) {
    const options = projectsInCollection(collection.id);
    assert.ok(options.length > 0);
    assert.ok(options.every(p => p.group === collection.id));
    seen.push(...options.map(p => p.id));
  }
  assert.deepEqual(seen.sort(),projectTypes.map(p => p.id).sort());
  assert.equal(projectsInCollection('amedida')[0].id,'custom');
});

test('Every public quotation link carries the exact project understood by the quotation form', () => {
  for (const project of projectTypes) {
    const url = new URL(quoteHref(project.id),'http://localhost');
    assert.equal(url.pathname,'/cotizar');
    assert.equal(url.searchParams.get('proyecto'),project.id);
    assert.equal(url.searchParams.has('pack'),false);
  }
  assert.equal(quoteHref(),'/cotizar?proyecto=custom');
});
