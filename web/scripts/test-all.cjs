const {spawnSync}=require('node:child_process');
const {writeFileSync,mkdirSync}=require('node:fs');
const suites=['domain.test.ts','catalog.test.ts','presentations.test.ts','custom-service.test.ts','http-security.test.ts','service-urls.test.ts'];
const results=[];
for(const suite of suites){
 const started=performance.now();
 const r=spawnSync(process.execPath,['scripts/run-ts.cjs','tests/'+suite],{encoding:'utf8',env:process.env});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 results.push({suite,status:r.status===0?'passed':'failed',tests:Number(/tests (\d+)/.exec(r.stdout||'')?.[1]||0),milliseconds:Math.round(performance.now()-started)});
 if(r.status!==0){process.exitCode=1;break;}
}
mkdirSync('../tests/artifacts',{recursive:true});
writeFileSync('../tests/artifacts/unit-results.json',JSON.stringify({status:process.exitCode?'failed':'passed',suites:results},null,2));
