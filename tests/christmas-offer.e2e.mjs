// Guest-facing Christmas announcement. No customer account or quotation is created.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const origin=process.env.E2E_ORIGIN||'http://127.0.0.1:3370';
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),'This guest UI test is restricted to loopback');
const {chromium}=createRequire(resolve(root,'web/package.json'))('playwright');
const artifacts=resolve(root,'tests/artifacts/christmas-offer');mkdirSync(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.E2E_BROWSER_CHANNEL?{channel:process.env.E2E_BROWSER_CHANNEL}:{})});
const contexts=[],checks=[],errors=[];
function check(name,condition=true){assert.ok(condition,name);checks.push(name);}
async function openPage(viewport={width:1440,height:1000},project='empresas'){
 const context=await browser.newContext({viewport,locale:'es-PE',timezoneId:'America/Lima'});contexts.push(context);
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(origin+'/cotizar?proyecto='+project);
 const dialog=page.getByRole('dialog').filter({has:page.locator('.christmas-offer-title')});
 await dialog.waitFor({state:'visible'});
 return {context,page,dialog};
}
async function waitForGuest(page){
 await page.locator('.christmas-offer').waitFor({state:'hidden'});
 await page.locator('.guest-quote-notice').waitFor({state:'visible'});
 await page.waitForFunction(()=>localStorage.getItem('ea-choice-navidad-2026')==='guest');
}
async function dismissCase(name,action){
 const {page,dialog}=await openPage({width:1280,height:900},'cumpleanos');
 const started=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/guest/start'&&response.request().method()==='POST');
 await action(page,dialog);assert.equal((await started).status(),200);
 await waitForGuest(page);
 check(name,new URL(page.url()).pathname==='/cotizar');
 check(name+' preserves the selected occasion',await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ea-pastry-draft')||'{}').projectType)==='cumpleanos');
}

try{
 const {context,page,dialog}=await openPage();
 check('A new customer can open the public quotation page without a login redirect',new URL(page.url()).pathname==='/cotizar');
 check('A first visit displays the Christmas announcement',await dialog.isVisible());
 const copy=(await dialog.innerText()).replace(/\s+/g,' ');
 check('The announcement states the 20 percent discount',/20\s*%/.test(copy));
 check('The event window includes both years and inclusive dates',/30 de noviembre de 2026 al 2 de enero de 2027/.test(copy)&&copy.includes('Ambas fechas incluidas'));
 check('The optional account history benefit is explained',copy.includes('historial de tus cotizaciones'));
 check('The discount basis and subsequent mobility and IGV are visible',copy.includes('se aplica a servicios; movilidad e IGV se calculan después'));
 const register=dialog.getByRole('button',{name:'Registrarme y aprovechar el 20 %',exact:true}),guest=dialog.getByRole('button',{name:'Continuar sin registro',exact:true});
 const controls=await Promise.all([register.boundingBox(),guest.boundingBox()]);
 check('Both choices have usable touch targets',controls.every(box=>box&&box.height>=48));
 check('The official brand is visible inside the announcement',await dialog.getByRole('img',{name:'E&A Cotiza',exact:true}).isVisible());
 await page.waitForFunction(()=>document.activeElement?.closest('.christmas-offer'));
 check('Keyboard focus starts inside the modal');
 await page.screenshot({path:resolve(artifacts,'desktop.png'),fullPage:false});
 await dialog.screenshot({path:resolve(artifacts,'desktop-dialog.png')});
 const started=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/guest/start'&&response.request().method()==='POST');
 await guest.click();assert.equal((await started).status(),200);await waitForGuest(page);
 check('Continuing as guest closes the announcement without leaving the quotation',new URL(page.url()).pathname==='/cotizar');
 check('The collection selected on entry survives the choice',await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ea-pastry-draft')||'{}').projectType)==='empresas');
 check('Guests do not see the account history tab',await page.getByRole('tab',{name:'Presupuestos guardados',exact:true}).count()===0);
 check('A guest cannot read private account history',(await context.request.get(origin+'/api/quotes')).status()===401);
 const guestCookie=(await context.cookies()).find(cookie=>cookie.name.endsWith('_guest'));
 check('Guest access uses a temporary HttpOnly cookie',!!guestCookie&&guestCookie.httpOnly&&guestCookie.sameSite==='Lax');
 await page.reload();await page.locator('.guest-quote-notice').waitFor({state:'visible'});
 check('Refreshing after declining does not repeat the advertisement',await page.locator('.christmas-offer').count()===0);
 const refreshedCookie=(await context.cookies()).find(cookie=>cookie.name.endsWith('_guest'));
 check('Refreshing does not replace the guest context',!!refreshedCookie&&refreshedCookie.value===guestCookie.value);

 await dismissCase('The close control continues as guest',(_page,modal)=>modal.getByRole('button',{name:'Cerrar anuncio y continuar sin registro',exact:true}).click());
 await dismissCase('Escape continues as guest',(_page)=>_page.keyboard.press('Escape'));
 await dismissCase('Clicking the backdrop continues as guest',(_page)=>_page.mouse.click(5,5));

 const mobile=await openPage({width:390,height:844},'fitness');
 const mobileBox=await mobile.dialog.boundingBox();
 check('The mobile announcement stays within the viewport',!!mobileBox&&mobileBox.x>=10&&mobileBox.x+mobileBox.width<=380&&mobileBox.y>=10&&mobileBox.y+mobileBox.height<=834);
 check('Mobile content has no horizontal overflow',await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&(()=>{const modal=document.querySelector('.christmas-offer');return modal.scrollWidth<=modal.clientWidth+1;})()));
 await mobile.page.screenshot({path:resolve(artifacts,'mobile-top.png'),fullPage:false});
 await mobile.dialog.screenshot({path:resolve(artifacts,'mobile-dialog.png')});
 const mobileGuest=mobile.dialog.getByRole('button',{name:'Continuar sin registro',exact:true});
 await mobileGuest.scrollIntoViewIfNeeded();
 const mobileButtons=await Promise.all(['Registrarme y aprovechar el 20 %','Continuar sin registro'].map(name=>mobile.dialog.getByRole('button',{name,exact:true}).boundingBox()));
 check('Both mobile choices remain accessible together',mobileButtons.every(box=>box&&box.y>=0&&box.y+box.height<=844&&box.height>=48));
 await mobile.page.screenshot({path:resolve(artifacts,'mobile-actions.png'),fullPage:false});
 await mobileGuest.click();await waitForGuest(mobile.page);
 check('The mobile customer can choose the complete guest flow',new URL(mobile.page.url()).pathname==='/cotizar');

 const signup=await openPage();
 const accepted=signup.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/promotion/accept'&&response.request().method()==='POST');
 await signup.dialog.getByRole('button',{name:'Registrarme y aprovechar el 20 %',exact:true}).click();
 assert.equal((await accepted).status(),200);
 await signup.page.waitForURL(url=>url.pathname==='/auth/register'&&url.searchParams.get('promocion')==='navidad-2026');
 check('Accepting the offer opens registration for this campaign');
 const signupCopy=(await signup.page.locator('main').innerText()).replace(/\s+/g,' ');
 check('Registration keeps the offered rate and event window',/20\s*%/.test(signupCopy)&&/30 de noviembre de 2026 al 2 de enero de 2027/.test(signupCopy));
 check('The campaign is backed by a server registration intent',await signup.page.locator('input[name="promotionCampaign"]').inputValue()==='navidad-2026');
 check('Registration retains the original quotation draft',await signup.page.evaluate(()=>JSON.parse(sessionStorage.getItem('ea-pastry-draft')||'{}').projectType)==='empresas');
 check('Registration still offers a way to continue without an account',await signup.page.getByRole('link',{name:'Continuar sin registro',exact:true}).isVisible());
 await signup.page.screenshot({path:resolve(artifacts,'registration-offer.png'),fullPage:true});
 const resumed=signup.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/guest/start'&&response.request().method()==='POST');
 await signup.page.getByRole('link',{name:'Continuar sin registro',exact:true}).click();
 await signup.page.waitForURL(url=>url.pathname==='/cotizar');
 assert.equal((await resumed).status(),200);
 check('Leaving registration returns to quotation rather than forcing login',new URL(signup.page.url()).pathname==='/cotizar'&&await signup.page.locator('.christmas-offer').count()===0);
 check('No uncaught browser errors occurred',errors.length===0);
 const report={status:'passed',scope:'Christmas offer choices, guest access and optional registration; no accounts created, quotes saved or external messages sent.',origin,checks,errors};
 writeFileSync(resolve(artifacts,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'passed',checks:checks.length,report:resolve(artifacts,'report.json')}));
}catch(error){
 writeFileSync(resolve(artifacts,'report.json'),JSON.stringify({status:'failed',origin,checks,errors,error:error.message},null,2));
 throw error;
}finally{for(const context of contexts)await context.close();await browser.close();}
