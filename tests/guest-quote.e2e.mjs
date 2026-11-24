// Complete guest journey from an empty browser: no login, registration or seeded draft.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const origin=process.env.E2E_ORIGIN||'http://127.0.0.1:3370';
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),'Guest acceptance is limited to loopback.');
const require=createRequire(resolve(root,'web/package.json')),{chromium}=require('playwright');
const out=resolve(root,'tests/artifacts/guest-quote');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.E2E_BROWSER_CHANNEL?{channel:process.env.E2E_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();page.setDefaultTimeout(30000);await page.emulateMedia({reducedMotion:'reduce'});
const checks=[],errors=[],navigations=[],accountRequests=[];
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
page.on('pageerror',error=>errors.push(error.message));
page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
page.on('request',request=>{const path=new URL(request.url()).pathname;if(['/api/auth/register','/api/auth/credentials'].includes(path))accountRequests.push(path);});
let quoteId='',receiptId='',pdfSha256='';
try{
 const initial=await page.goto(origin+'/cotizar');
 check('A new visitor opens the quotation page without authentication',initial.status()===200&&new URL(page.url()).pathname==='/cotizar');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const announcement=page.getByRole('dialog');
 if(today>='2026-11-23'&&today<='2027-01-02'){
  await announcement.waitFor({state:'visible'});
  check('Christmas announcement offers registration and its dates',await announcement.getByRole('button',{name:'Registrarme y aprovechar el 20 %',exact:true}).isVisible()&&(await announcement.innerText()).includes('30 de noviembre de 2026')&&(await announcement.innerText()).includes('2 de enero de 2027'));
  const started=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/guest/start'&&response.request().method()==='POST');
  await announcement.getByRole('button',{name:'Continuar sin registro',exact:true}).click();
  check('Declining the offer prepares a guest visit',(await started).status()===200);
  await announcement.waitFor({state:'hidden'});
 }else{
  await page.locator('.guest-quote-notice').waitFor({state:'visible'});
  check('Outside the campaign a visitor can quote directly without a seasonal announcement',await announcement.count()===0);
 }
 check('Declining does not redirect to login or registration',new URL(page.url()).pathname==='/cotizar'&&accountRequests.length===0);
 check('Guest has no account history tab',await page.getByRole('tab',{name:'Presupuestos guardados',exact:true}).count()===0);
 check('Guest starts from an empty form',await page.locator('#project-detail').inputValue()===''&&await page.locator('#client-document').inputValue()==='');
 const marker=randomUUID().slice(0,8).toUpperCase(),client='QA invitado formulario '+marker;
 await page.locator('#project-detail').fill('Evento sintético de invitado '+marker+'. Paquete referencial sin registro.');
 await page.locator('#client-document').fill('12345678');await page.locator('#client-name').fill(client);await page.locator('#business-phone').fill('900000000');
 await page.locator('[data-field="eventDate"] input').fill('2026-12-15');
 await page.getByRole('button',{name:'Revisar contenido: Esencial',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Elegir este paquete',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.package-card.is-selected h3')?.textContent==='Esencial');
 check('Guest explicitly selects the optional Essential package');
 await page.getByRole('navigation',{name:'Pasos de la cotización'}).getByRole('button').nth(3).click();await page.locator('#quote-step-3').waitFor({state:'visible'});
 const send=page.getByRole('button',{name:'Enviar Cotización',exact:true});check('Guest must save before sending',await send.isDisabled());
 const stored=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/quotes'&&response.request().method()==='POST'),downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Guardar y descargar PDF',exact:true}).click();
 const response=await stored,record=await response.json();check('Guest saves successfully without an account',response.status()===201);
 quoteId=record.id;check('Guest pays the undiscounted reference amount',record.totalCents===16992&&record.quote.promotion===undefined&&record.quote.items.length===1);
 check('Saved guest request preserves client and event date',record.quote.client===client&&record.quote.eventDate==='2026-12-15');
 const pdfPath=resolve(out,'guest-quote.pdf');await (await downloaded).saveAs(pdfPath);const bytes=readFileSync(pdfPath);pdfSha256=sha256(bytes);
 check('Guest downloads a valid PDF',bytes.subarray(0,5).toString()==='%PDF-'&&bytes.length>1000);
 const archived=await context.request.get(origin+'/api/quotes/'+quoteId+'/pdf');
 check('Downloaded guest PDF matches the server archive',archived.status()===200&&sha256(await archived.body())===pdfSha256&&archived.headers()['x-document-sha256']===pdfSha256);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()==='Enviar Cotización'&&!button.disabled));
 check('Saving enables Send for the guest',await send.isEnabled());
 const submitted=page.waitForResponse(result=>new URL(result.url()).pathname==='/api/quotes/'+quoteId+'/submit'&&result.request().method()==='POST');await send.click();
 const delivered=await submitted,body=await delivered.json();receiptId=body.receipt?.id;
 check('Guest explicitly sends the quotation to the business',delivered.status()===200&&typeof receiptId==='string');
 check('Guest receipt identifies the exact downloaded PDF',body.receipt.pdfSha256===pdfSha256&&body.receipt.emailStatus==='not_configured');
 await page.getByRole('status').filter({hasText:'Enviada al administrador'}).waitFor({state:'visible'});
 check('Guest sees successful submission feedback');
 check('Guest still cannot access account history',(await context.request.get(origin+'/api/quotes')).status()===401);
 const cookies=await context.cookies();check('Guest quotation does not create an authenticated account session',!cookies.some(cookie=>/(?:^|_)session$/.test(cookie.name))&&cookies.some(cookie=>cookie.name.endsWith('_guest')&&cookie.httpOnly));
 check('The entire journey stays on the quotation page',new URL(page.url()).pathname==='/cotizar'&&navigations.every(url=>!new URL(url).pathname.startsWith('/auth/'))&&accountRequests.length===0);
 check('Guest journey has no uncaught browser errors',errors.length===0);
 await page.screenshot({path:resolve(out,'guest-saved-and-sent.png'),fullPage:true});
 writeFileSync(resolve(out,'report.json'),JSON.stringify({status:'passed',scope:'Fresh guest UI, Christmas popup declined, one synthetic request saved and sent; no account or external email.',origin,checks,errors,quoteId,receiptId,pdfSha256},null,2));
 console.log(JSON.stringify({status:'passed',checks:checks.length,totalCents:16992,accountCreated:false,report:resolve(out,'report.json')}));
}catch(error){
 await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});
 writeFileSync(resolve(out,'report.json'),JSON.stringify({status:'failed',checks,errors,error:error.message,quoteId},null,2));throw error;
}finally{await context.close();await browser.close();}
