// Exercise the actual production bundle through an ephemeral local TLS proxy.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'web/package.json'));
const {chromium}=require('playwright');
const artifacts=resolve(root,'tests/artifacts/production-browser');
mkdirSync(artifacts,{recursive:true});
const checks=[],violations=[],errors=[];
const browser=await chromium.launch({headless:true,...(process.env.E2E_BROWSER_CHANNEL?{channel:process.env.E2E_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
await context.exposeBinding('__qaReportCsp',(_source,violation)=>violations.push(violation));
await context.addInitScript(()=>window.addEventListener('securitypolicyviolation',event=>window.__qaReportCsp({directive:event.effectiveDirective,blocked:event.blockedURI,line:event.lineNumber,source:event.sourceFile,sample:event.sample})));
const quote=JSON.parse(readFileSync(resolve(root,'contracts/example-quote.json'),'utf8'));
await context.addInitScript(value=>sessionStorage.setItem('ea-pastry-draft',JSON.stringify(value)),quote);
const page=await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror',error=>errors.push(error.message));
function checked(name,condition=true){assert.ok(condition,name);checks.push(name);}
try{
 const response=await page.goto(process.env.E2E_ORIGIN);
 const policy=response.headers()['content-security-policy'];
 checked('Production script policy has a nonce and strict-dynamic',/nonce-[A-Za-z0-9+/]+=*/.test(policy)&&policy.includes("'strict-dynamic'"));
 checked('Production policy excludes unsafe-eval',!policy.includes("'unsafe-eval'"));
 checked('HTTPS response carries two-year HSTS',response.headers()['strict-transport-security']==='max-age=63072000');
 await page.getByRole('img',{name:'E&A Cotiza',exact:true}).first().waitFor();
 checked('Official brand renders in the production bundle');
 const staticContext=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true,javaScriptEnabled:false});
 try{
  const staticPage=await staticContext.newPage();
  await staticPage.goto(process.env.E2E_ORIGIN+'/cotizar');
  const labels=await staticPage.locator('button[role=combobox]').allTextContents();
  checked('Selected field labels render before JavaScript',labels.includes('Bodas')&&labels.includes('Persona Natural')&&labels.includes('PEN · Soles')&&labels.includes('Recojo en el negocio - sin movilidad.'));
 }finally{await staticContext.close();}
 await page.goto(process.env.E2E_ORIGIN+'/cotizar');
 await page.locator('#client-document').waitFor();
 await page.waitForFunction(name=>document.querySelector('#client-name')?.value===name,quote.client);
 checked('Draft hydrates in production',await page.locator('#client-name').inputValue()===quote.client);
 await page.getByRole('button',{name:'Ver PDF',exact:true}).click();
 await page.getByRole('img',{name:'Página 1 del PDF de la cotización'}).waitFor({state:'visible'});
 await page.getByText(/Página 1 de \d/).waitFor();
 checked('PDF.js renders the generated PDF under the production CSP');
 await page.screenshot({path:resolve(artifacts,'pdf-preview.png')});
 await page.keyboard.press('Escape');
 const downloading=page.waitForEvent('download');
 await page.getByRole('button',{name:'Descargar cotización PDF',exact:true}).click();
 const download=await downloading;
 const pdf=resolve(artifacts,'cotizacion-qa.pdf');
 await download.saveAs(pdf);
 checked('Production browser downloads a valid PDF',readFileSync(pdf).subarray(0,5).toString()==='%PDF-');
 await page.screenshot({path:resolve(artifacts,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 checked('Production mobile layout fits the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await page.screenshot({path:resolve(artifacts,'mobile.png'),fullPage:true});
 checked('Production browser reports no uncaught errors',errors.length===0);
 checked('Production browser reports no CSP violations',violations.length===0);
 const report={status:'passed',checks,errors,violations,tls:'ephemeral self-signed localhost certificate accepted by the test browser'};
 writeFileSync(resolve(artifacts,'results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({productionBrowser:'passed',checks:checks.length}));
}catch(error){
 const scriptState=await page.evaluate(()=>Array.from(document.scripts,script=>({external:!!script.src,nonce:!!script.nonce}))).catch(()=>[]);
 writeFileSync(resolve(artifacts,'results.json'),JSON.stringify({status:'failed',checks,errors,violations,scriptState,error:String(error)},null,2));
 throw error;
}finally{await context.close();await browser.close();}
