import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRailwayContext,project,validateGraph} from 'railway/iac';
const code=ts.transpileModule(readFileSync(new URL('./railway.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const program=(await import('data:text/javascript;base64,'+Buffer.from(code.replace("from 'railway/iac'",`from '${new URL('./node_modules/railway/dist/iac/index.js',import.meta.url).href}'`)).toString('base64'))).default;
process.env.COTIZA_GITHUB_REPOSITORY='synthetic-owner/cotizasweet';
process.env.COTIZA_RAILWAY_REGION='us-west2';
const definition=await program(createRailwayContext({environment:'production',command:'validate'}),project);
assert.equal(definition.name,'cotizasweet');
const resources=definition.resources.flat();
assert.equal(resources.filter(r=>r.type==='service').length,3);
assert.equal(resources.filter(r=>r.type==='volume').length,2);
for(const r of resources.filter(r=>r.type==='service')){
 assert.equal(r.build.builder,'DOCKERFILE');
 assert.equal(r.deploy.numReplicas,1);
 assert.ok(r.deploy.healthcheckPath);
}
console.log(JSON.stringify({status:'passed',services:3,volumes:2,replicas_per_service:1,scope:'Offline SDK graph validation; no account, resources or deployment created.'}));
