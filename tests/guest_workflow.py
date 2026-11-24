"""Loopback-only guest acceptance, using synthetic quotations and private admin access.

Expires only the opaque guest state created by this script. Account/history data
and submitted documents remain intact; no email or external identity is used.
"""
from pathlib import Path
from datetime import date,timedelta
import hashlib,json,secrets,sqlite3,time
import httpx
from acceptance_config import acceptance_configuration,acceptance_database
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
configuration=acceptance_configuration()
origin=configuration['origin']
count=0
def check(condition,message):
    global count
    count+=1
    if not condition:raise AssertionError(message)
def client():return httpx.Client(base_url=origin,timeout=60,trust_env=False)
def account_login(connection,role):
    account=next(row for row in configuration['accounts'] if row['role']==role)
    result=connection.post('/api/auth/credentials',json={key:account[key] for key in ('username','password')},headers={'Origin':origin})
    check(result.status_code==200,'Prepared account did not authenticate.')

with client() as visitor,client() as other,client() as anonymous,client() as administrator,client() as customer:
    check(visitor.post('/api/guest/start',headers={'Origin':'https://other.example'}).status_code==403,'Guest start accepted another origin.')
    first=visitor.post('/api/guest/start',headers={'Origin':origin})
    check(first.status_code==200 and first.json()['kind']=='guest','Guest start failed.')
    check(set(first.json())=={'kind','expiresAt'},'Guest response exposed an owner or token.')
    check('httponly' in first.headers.get('set-cookie','').lower() and 'samesite=lax' in first.headers.get('set-cookie','').lower(),'Guest cookie lacks browser protections.')
    repeated=visitor.post('/api/guest/start',headers={'Origin':origin})
    check(repeated.status_code==200 and repeated.json()==first.json() and 'set-cookie' not in repeated.headers,'Guest visit was rotated or extended.')
    check(other.post('/api/guest/start',headers={'Origin':origin}).status_code==200,'Second guest start failed.')
    check(visitor.get('/api/quotes').status_code==401,'Guest accessed account history.')
    check(visitor.get('/api/admin/accounts').status_code==401,'Guest accessed administration.')
    check(visitor.get('/api/clients/ruc/20999999990',headers={'X-Cotiza-Request':'ruc'}).status_code==200,'Guest could not query the synthetic RUC.')
    quote=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf-8'))
    today=date.today()
    quote.update(client='QA INVITADO — prueba '+secrets.token_hex(4),projectBrief='Cotización sintética sin registro para revisar PDF y recepción en el negocio.',event='Cotización de invitado de prueba',issued=today.isoformat(),validUntil=(today+timedelta(days=21)).isoformat(),eventDate=(today+timedelta(days=10)).isoformat())
    validated=visitor.post('/api/quotes/validate',json=quote,headers={'Origin':origin})
    check(validated.status_code==200,'Guest quote validation failed.')
    check(not validated.json()['quote'].get('promotion'),'Guest obtained a registration promotion.')
    forged=visitor.post('/api/quotes/validate',json={**quote,'promotion':{'campaignId':'navidad-2026','percent':20}},headers={'Origin':origin})
    check(forged.status_code==400,'Guest forged a registration promotion.')
    check(visitor.post('/api/quotes',json=quote,headers={'Origin':'https://other.example'}).status_code==403,'Guest quote write accepted another origin.')
    tampered={**quote,'items':[{**quote['items'][0],'priceCents':1}]}
    check(visitor.post('/api/quotes',json=tampered,headers={'Origin':origin}).status_code==400,'Guest modified a protected product price.')
    saved=visitor.post('/api/quotes',json=quote,headers={'Origin':origin})
    check(saved.status_code==201,'Guest could not save a quotation.')
    record=saved.json();quote_id=record['id'];pdf_path=f'/api/quotes/{quote_id}/pdf';submit_path=f'/api/quotes/{quote_id}/submit'
    document=visitor.get(pdf_path)
    check(document.status_code==200 and document.content.startswith(b'%PDF-'),'Guest archived PDF unavailable.')
    sha=hashlib.sha256(document.content).hexdigest()
    check(document.headers.get('x-document-sha256')==sha,'Guest PDF digest mismatch.')
    check(anonymous.get(pdf_path).status_code==401,'Anonymous browser read a guest document.')
    check(other.get(pdf_path).status_code==404,'Another guest read the document.')
    check(other.post(submit_path,headers={'Origin':origin}).status_code==404,'Another guest sent the quotation.')
    check(other.get(submit_path).json()['receipt'] is None,'Another guest read the receipt.')
    check(visitor.post(submit_path,headers={'Origin':'https://other.example'}).status_code==403,'Guest submission accepted another origin.')
    sent=visitor.post(submit_path,headers={'Origin':origin});again=visitor.post(submit_path,headers={'Origin':origin})
    check(sent.status_code==200 and again.status_code==200,'Guest could not send the quotation.')
    receipt=sent.json()['receipt'];check(receipt==again.json()['receipt'],'Guest submission was duplicated.')
    check(receipt['pdfSha256']==sha and receipt['emailStatus']=='not_configured','Guest receipt or email status is incorrect.')
    admin_path=f"/api/admin/submissions/{receipt['id']}/pdf"
    check(visitor.get(admin_path).status_code==401,'Guest opened the administrative document endpoint.')
    account_login(customer,'customer')
    check(customer.get(pdf_path).status_code==404,'Customer inherited a guest document without proof.')
    account_login(administrator,'admin')
    admin_document=administrator.get(admin_path)
    check(admin_document.status_code==200 and admin_document.content==document.content,'Administrator received a different PDF.')
    inbox=administrator.get('/admin')
    check(inbox.status_code==200 and admin_path in inbox.text,'Guest request missing from administrator inbox.')
    # Only this script's freshly issued opaque state is expired; no user account is changed.
    token=visitor.cookies.get(f'ea_v230_{urlsplit(origin).port}_guest')
    check(isinstance(token,str) and len(token)==43,'Guest cookie format changed.')
    with sqlite3.connect(acceptance_database(configuration,'webDatabase','data/sessions.sqlite'),timeout=10) as database:
        affected=database.execute('UPDATE secure_state SET expires=? WHERE id=? AND kind=?',(int(time.time()*1000)-1,hashlib.sha256(token.encode()).hexdigest(),'guest')).rowcount
        check(affected==1,'Synthetic guest state did not match exactly one row.')
    check(visitor.get(pdf_path).status_code==401,'Expired guest could still read the document.')
    check(visitor.get(submit_path).status_code==401,'Expired guest could still read the receipt.')
    check(administrator.get(admin_path).content==document.content,'Guest expiry removed the submitted business document.')
    check(visitor.post('/api/guest/start',headers={'Origin':origin}).status_code==200,'Guest could not start a new visit after expiry.')
    check(visitor.get(pdf_path).status_code==404,'A new visit inherited an expired visit document.')
    artifacts=ROOT/'tests/artifacts';artifacts.mkdir(exist_ok=True)
    (artifacts/'guest-workflow.pdf').write_bytes(document.content)
    result={'status':'passed','checks':count,'scope':'Synthetic local guest quotation, isolated temporary visit, immutable PDF and administrator inbox; no registration or external email.','pdf_sha256':sha,'idempotent_submission':True,'guest_history_access':False,'guest_access_expiry_verified':True}
    (artifacts/'guest-workflow.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))
