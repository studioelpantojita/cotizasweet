"""Local acceptance: protected accounts, immutable documents and administrator inbox.

Reads ignored local credentials without printing them. Writes one synthetic review
quotation to the customer's history, clearly labelled QA. No email is sent.
"""
import copy,hashlib,json,secrets,time,uuid
from pathlib import Path
import httpx
from acceptance_config import acceptance_configuration

ROOT=Path(__file__).resolve().parents[1]
configuration=acceptance_configuration()
origin=configuration['origin']
checks=0
def check(condition,message):
    global checks
    checks+=1
    if not condition:raise AssertionError(message)
def client():return httpx.Client(base_url=origin,timeout=60,trust_env=False)
def sign_in(connection,role):
    account=next(a for a in configuration['accounts'] if a['role']==role)
    response=connection.post('/api/auth/credentials',json={k:account[k] for k in ('username','password')},headers={'Origin':origin})
    check(response.status_code==200,'Configured account could not sign in.')
    check('httponly' in response.headers.get('set-cookie','').lower(),'Session cookie must be HttpOnly.')

with client() as anonymous,client() as customer,client() as administrator,client() as other:
    check(anonymous.get('/cotizar').status_code==200,'Anonymous quotation page access.')
    check(anonymous.get('/api/quotes').status_code==401,'Anonymous history access.')
    check(anonymous.post('/api/quotes/validate',json={},headers={'Origin':origin}).status_code==401,'Anonymous validation access.')
    check(anonymous.post('/api/auth/credentials',json={},headers={'Origin':'https://evil.example'}).status_code==403,'Login CSRF.')
    password=secrets.token_urlsafe(24)
    user='qa_'+secrets.token_hex(6)
    registration={'username':user,'password':password,'confirmation':password,'displayName':'QA temporal de aislamiento'}
    check(other.post('/api/auth/register',json={**registration,'role':'admin'},headers={'Origin':origin}).status_code==400,'Public registration escalated role.')
    check(other.post('/api/auth/register',json=registration,headers={'Origin':origin}).status_code==201,'Customer registration failed.')
    check(other.post('/api/auth/credentials',json={'username':user,'password':password},headers={'Origin':origin}).status_code==200,'Registered account could not sign in.')
    sign_in(customer,'customer');sign_in(administrator,'admin')
    check(customer.get('/api/admin/accounts').status_code in (403,405),'Customer accessed account administration.')
    check(customer.post('/api/admin/accounts',json={},headers={'Origin':origin}).status_code==403,'Customer created an account as admin.')
    quote=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
    quote.update(client='QA SINTÉTICA — revisión de envío',projectBrief='Celebración de prueba para validar sabores, documento e historial.',event='Celebración de prueba',eventDate=time.strftime('%Y-%m-%d'),issued=time.strftime('%Y-%m-%d'))
    from datetime import date,timedelta
    quote['validUntil']=(date.fromisoformat(quote['issued'])+timedelta(days=21)).isoformat()
    pricing=json.loads((ROOT/'contracts/product-pricing.json').read_text(encoding='utf-8'))
    rate=pricing['portfolio']['delicia-fresas']
    item={'id':str(uuid.uuid4()),'name':'Delicia de fresas','image':'none','category':'pack','portfolioId':'delicia-fresas','unit':rate['unit'],'priceCents':rate['prices']['PEN'],'quantity':2,'flavors':['vainilla','chocolate'],'presentation':'Caja marfil de prueba','scope':'Unknown.','description':'Contenido: vainilla, chocolate\nPresentación: Caja marfil de prueba\nAlcance: Unknown.'}
    quote['items']=[item]
    for patch in [{'eventDate':''},{'advancePercent':49},{'documentType':'ruc','clientType':'persona_natural','clientDocument':'10999999994'}]:
        check(customer.post('/api/quotes/validate',json={**quote,**patch},headers={'Origin':origin}).status_code==400,'New quotation accepted invalid required field.')
    for patch in [{'priceCents':1},{'unit':'litros'},{'flavors':pricing['flavors'][:5]},{'presentation':''},{'description':'Manipulado'}]:
        check(customer.post('/api/quotes',json={**quote,'items':[{**item,**patch}]},headers={'Origin':origin}).status_code==400,'Server accepted modified product rules.')
    saved_response=customer.post('/api/quotes',json=quote,headers={'Origin':origin})
    check(saved_response.status_code==201,'Could not save valid quotation.')
    saved=saved_response.json();quote_id=saved['id'];document_path=f'/api/quotes/{quote_id}/pdf';submit_path=f'/api/quotes/{quote_id}/submit'
    document=customer.get(document_path)
    check(document.status_code==200 and document.content.startswith(b'%PDF-'),'Saved PDF unavailable.')
    sha=hashlib.sha256(document.content).hexdigest()
    check(document.headers.get('x-document-sha256')==sha,'Stored PDF digest mismatch.')
    check(anonymous.get(document_path).status_code==401,'Anonymous PDF leak.')
    check(other.get(document_path).status_code==404,'Cross-account PDF leak.')
    check(other.post(submit_path,headers={'Origin':origin}).status_code==404,'Cross-account quotation submission.')
    check(other.get(submit_path).json()['receipt'] is None,'Cross-account submission receipt leak.')
    check(customer.post(submit_path,headers={'Origin':'https://evil.example'}).status_code==403,'Submission CSRF.')
    first=customer.post(submit_path,headers={'Origin':origin});second=customer.post(submit_path,headers={'Origin':origin})
    check(first.status_code==200 and second.status_code==200,'Administrator inbox submission failed.')
    receipt=first.json()['receipt'];check(receipt==second.json()['receipt'],'Duplicate submission was not idempotent.')
    check(receipt['pdfSha256']==sha and receipt['emailStatus']=='not_configured','False email confirmation or different PDF.')
    admin_path=f"/api/admin/submissions/{receipt['id']}/pdf"
    check(customer.get(admin_path).status_code==403,'Customer accessed administrator document endpoint.')
    admin_document=administrator.get(admin_path)
    check(admin_document.status_code==200 and admin_document.content==document.content,'Customer and administrator PDFs differ.')
    inbox=administrator.get('/admin');check(inbox.status_code==200 and admin_path in inbox.text,'Administrator inbox omitted submitted record.')
    history=customer.get('/api/quotes').json();check(any(row['id']==quote_id for row in history['quotes']),'Saved document absent from account history.')
    check(other.get('/api/quotes').json()['quotes']==[],'Cross-account history leak.')
    cookie=dict(customer.cookies)
    check(customer.post('/api/auth/logout',headers={'Origin':origin}).status_code==200,'Logout failed.')
    customer.cookies.update(cookie);check(customer.get('/api/quotes').status_code==401,'Revoked cookie replay accepted.')
    artifacts=ROOT/'tests/artifacts';artifacts.mkdir(exist_ok=True)
    (artifacts/'account-workflow.pdf').write_bytes(document.content)
    report={'status':'passed','checks':checks,'backend':'dotnet','scope':'Local customer account, administrator inbox, server-side PDF snapshot; synthetic data; no external email.','pdf_sha256':sha,'idempotent_submission':True,'cross_account_isolation':True,'email':'not_configured'}
    (artifacts/'account-workflow.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
