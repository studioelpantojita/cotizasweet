// Real browser journey against the isolated integrated test stack.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'web/package.json'));
const {chromium}=require('playwright');
const origin=process.env.E2E_ORIGIN||'http://127.0.0.1:3190';
const artifactName=process.env.OIDC_PROVIDER==='google'?'browser-google':'browser';
const artifacts=resolve(root,'tests/artifacts',artifactName);mkdirSync(artifacts,{recursive:true});
const checks=[],errors=[],cspViolations=[];
const browser=await chromium.launch({headless:true,...(process.env.E2E_BROWSER_CHANNEL?{channel:process.env.E2E_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.exposeBinding('__qaReportCsp',(_source,directive)=>{cspViolations.push(String(directive));});
await context.addInitScript(()=>{
 window.addEventListener('securitypolicyviolation',event=>window.__qaReportCsp(event.effectiveDirective));
});
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',e=>errors.push(e.message));
function checked(name,condition=true){assert.ok(condition,name);checks.push(name);}
async function amount(value){await page.locator('.grand-total b').filter({hasText:value}).waitFor();}
try{
 await page.goto(origin);await page.locator('h1').waitFor();checked('Home renders');
 await page.getByRole('link',{name:'Catálogo',exact:true}).first().click();await page.waitForURL('**/catalogo');
 await page.getByRole('searchbox',{name:'Buscar en esta categoría'}).fill('lúcuma');
 await page.locator('.sweet-results-heading').getByRole('status').filter({hasText:'1 presentación'}).waitFor();checked('Catalog search ignores accents');
 await page.goto(origin+'/cotizar?proyecto=cumpleanos');await page.locator('#client-document').waitFor();
 await page.getByRole('button',{name:'Descargar cotización PDF',exact:true}).click();
 await page.locator('#client-document[aria-invalid=true]').waitFor();checked('Incomplete form rejects PDF');
 await page.locator('#client-document').fill('12345678');await page.locator('#client-name').fill('Cliente sintético QA navegador');
 await page.locator('#business-phone').fill('900000000');await page.getByRole('textbox',{name:/^Proyecto \*/}).fill('QA navegador · servicio personalizado');
 await page.locator('#quote-currency').click();await page.getByRole('option',{name:'USD · Dólares',exact:true}).click();
 await page.getByRole('button',{name:'Explorar toda la cartera'}).click();
 await page.getByRole('button',{name:'Personalizar Delicia de fresas',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.locator('[name=content]').fill('12 porciones de prueba');
 await dialog.locator('[name=presentation]').fill('Caja de prueba marfil');
 await dialog.locator('[name=scope]').fill('Recojo, sin montaje');
 await dialog.getByRole('button',{name:'Añadir a la propuesta',exact:true}).click();
 await dialog.getByRole('alert').waitFor();checked('Portfolio requires an explicit price');
 await dialog.locator('[name=quantity]').fill('2');await dialog.locator('[name=priceCents]').fill('150');
 await dialog.getByRole('button',{name:'Añadir a la propuesta',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await amount('354.00');checked('USD total is 354.00 for 2 × 150 plus IGV');
 checked('Pickup retains confirmed location',await page.locator('[data-field="address"] input').inputValue().then(x=>x.includes('LosPantojados')));
 await page.getByRole('button',{name:'Ver PDF',exact:true}).click();
 await page.getByRole('img',{name:'Página 1 del PDF de la cotización'}).waitFor({state:'visible'});
 await page.getByText('Página 1 de 1',{exact:true}).waitFor();
 checked('PDF.js preview renders one page');await page.screenshot({path:resolve(artifacts,'pdf-preview.png')});
 await page.keyboard.press('Escape');
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar cotización PDF',exact:true}).click();
 const download=await downloading;const pdf=resolve(artifacts,'cotizacion-qa.pdf');await download.saveAs(pdf);
 checked('Browser downloads a valid PDF',readFileSync(pdf).subarray(0,5).toString()==='%PDF-');
 await page.getByRole('link',{name:'Iniciar sesión',exact:true}).first().click();await page.waitForURL('**/cotizar');
 await page.getByRole('link',{name:'Cerrar sesión',exact:true}).waitFor();checked('OIDC redirects back to signed-in UI');
 await amount('354.00');checked('Draft survives sign-in redirect');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText(/Guardado ·/).waitFor();
 await page.getByRole('tab',{name:'Presupuestos guardados'}).click();
 await page.getByRole('heading',{name:'Cliente sintético QA navegador',exact:true}).waitFor();checked('Saved quote appears in own history');
 const legacy=page.locator('.history-row').filter({has:page.getByRole('heading',{name:'QA versión anterior',exact:true})});
 await legacy.getByText('Versión anterior',{exact:true}).waitFor();
 checked('A legacy quote preserves the valid history and has no reopen action',await legacy.getByRole('button',{name:'Abrir',exact:true}).count()===0);
 await page.getByRole('button',{name:'Cargar más propuestas',exact:true}).click();
 await page.getByRole('button',{name:'Cargar más propuestas',exact:true}).waitFor({state:'hidden'});
 checked('History loads the next page without losing proposals',await page.locator('.history-row').count()===26);
 await page.locator('.history-row').filter({has:page.getByRole('heading',{name:'Cliente sintético QA navegador',exact:true})}).getByRole('button',{name:'Abrir',exact:true}).click();await amount('354.00');checked('Reopening history preserves totals');
 await page.reload();await amount('354.00');checked('Draft survives reload');
 await page.screenshot({path:resolve(artifacts,'desktop.png'),fullPage:true});
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 await mobile.exposeBinding('__qaReportCsp',(_source,directive)=>{cspViolations.push(String(directive));});
 await mobile.addInitScript(()=>window.addEventListener('securitypolicyviolation',event=>window.__qaReportCsp(event.effectiveDirective)));
 const mp=await mobile.newPage();await mp.goto(origin+'/cotizar');await mp.locator('#client-document').waitFor();
 checked('Mobile form has no horizontal overflow',await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await mp.screenshot({path:resolve(artifacts,'mobile.png'),fullPage:true});await mobile.close();
 // A new web may receive the bounded, unpaginated envelope while API 2.1 is still deployed.
 const previousApiQuote=JSON.parse(readFileSync(resolve(root,'contracts/example-quote.json'),'utf8'));
 const previousApiRows=Array.from({length:41},(_,index)=>({id:`api-21-${index}`,quote:{...previousApiQuote,client:`Compatibilidad API 2.1 ${String(index).padStart(2,'0')}`},totalCents:33984,createdAt:'2026-11-18T12:00:00.000Z'}));
 const previousApiResponse=route=>route.request().method()==='GET'?route.fulfill({status:200,json:{quotes:previousApiRows}}):route.continue();
 await page.route('**/api/quotes',previousApiResponse);
 try{
  await page.getByRole('tab',{name:'Presupuestos guardados'}).click();
  await page.getByRole('heading',{name:'Compatibilidad API 2.1 00',exact:true}).waitFor();
  checked('API 2.1 history without a cursor preserves its complete bounded result',await page.locator('.history-row').count()===41);
  checked('API 2.1 history has no load-more action',await page.getByRole('button',{name:'Cargar más propuestas',exact:true}).count()===0);
 }finally{
  await page.unroute('**/api/quotes',previousApiResponse);
  await page.getByRole('tab',{name:'Nueva cotización'}).click();
 }
 // Historical RUC identity must remain available even when its provider is down.
 const ruc=JSON.parse(readFileSync(resolve(root,'contracts/example-quote.json'),'utf8'));
 Object.assign(ruc,{clientType:'empresa',documentType:'ruc',clientDocument:'20999999990',client:'RAZÓN SOCIAL HISTÓRICA QA'});
 await context.addInitScript(value=>sessionStorage.setItem('ea-pastry-draft',JSON.stringify(value)),ruc);
 let lookups=0;await page.route('**/api/clients/ruc/**',route=>{lookups++;return route.fulfill({status:503,json:{error:'Proveedor no disponible'}});});
 await page.reload();await page.locator('#client-name').filter({visible:true}).waitFor();
 await page.getByText('Nombre conservado del presupuesto.',{exact:false}).waitFor();
 checked('Historical RUC name is preserved',await page.locator('#client-name').inputValue()==='RAZÓN SOCIAL HISTÓRICA QA');
 checked('Opening historical RUC does not issue a new lookup',lookups===0);
 await page.getByRole('button',{name:'Consultar de nuevo',exact:true}).click();await page.getByText('Proveedor no disponible',{exact:true}).waitFor();
 checked('Explicit RUC retry reports provider failure',lookups===1);
 checked('No uncaught browser errors',errors.length===0);
 checked('No Content Security Policy violations',cspViolations.length===0);
 checked('Official brand is visible',await page.getByRole('img',{name:'E&A Cotiza',exact:true}).first().isVisible());
 writeFileSync(resolve(artifacts,'results.json'),JSON.stringify({status:'passed',engine:'Chromium',provider:process.env.OIDC_PROVIDER||'standard',channel:process.env.E2E_BROWSER_CHANNEL||'bundled',checks,uncaughtErrors:errors,cspViolations},null,2));
 console.log(JSON.stringify({browser:'passed',checks:checks.length}));
}catch(error){
 await page.screenshot({path:resolve(artifacts,'failure.png'),fullPage:true}).catch(()=>{});
 writeFileSync(resolve(artifacts,'results.json'),JSON.stringify({status:'failed',checks,error:String(error),uncaughtErrors:errors},null,2));throw error;
}finally{await context.close();await browser.close();}
