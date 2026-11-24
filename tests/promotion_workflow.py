"""Local promotion acceptance with synthetic customers; no external email or secrets output.

Creates two customer accounts, one ordinary and one enrolled through a real offer
intent. Saves one promoted quotation and submits its immutable PDF to the admin.
Only that synthetic record is checked read-only in the .NET quotation database.
"""
import copy,hashlib,json,secrets,sqlite3,time,uuid
from contextlib import closing
from pathlib import Path
import httpx,jwt
from acceptance_config import acceptance_configuration,acceptance_database

ROOT=Path(__file__).resolve().parents[1]
CONFIG=acceptance_configuration()
ORIGIN=CONFIG['origin']
CAMPAIGN='navidad-2026'
HEADERS={'Origin':ORIGIN}
checks=[]
def check(condition,label):
    if not condition:raise AssertionError(label)
    checks.append(label)
def client():return httpx.Client(base_url=ORIGIN,trust_env=False,timeout=60,follow_redirects=False)
def registration(label):
    password=secrets.token_urlsafe(24)
    return {'username':'qa_'+label+'_'+secrets.token_hex(5),'password':password,'confirmation':password,'displayName':'QA navidad '+label}
def quote(event_date='2026-11-30'):
    value=json.loads((ROOT/'contracts/example-quote.json').read_text(encoding='utf8'))
    value.update(client='QA SINTÉTICA — promoción navideña',projectBrief='Prueba del beneficio por registro y de la recepción del mismo PDF.',event='Evento QA navideño',issued='2026-11-23',validUntil='2026-12-14',eventDate=event_date)
    return value
def validate(connection,value):return connection.post('/api/quotes/validate',json=value,headers=HEADERS)

with client() as enrolled,client() as ordinary,client() as visitor,client() as forged,client() as administrator:
    check(enrolled.post('/api/promotion/accept',headers={'Origin':'https://evil.example'}).status_code==403,'Offer acceptance rejects a cross-site origin')
    unproved=registration('unproved')
    check(forged.post('/api/auth/register',json={**unproved,'promotionCampaign':CAMPAIGN},headers=HEADERS).status_code==409,'Claiming the campaign without offer proof does not create an enrolled account')
    acceptance=enrolled.post('/api/promotion/accept',headers=HEADERS)
    check(acceptance.status_code==200 and acceptance.json().get('next')=='/auth/register?promocion='+CAMPAIGN,'Offer acceptance creates the registration invitation')
    check('httponly' in acceptance.headers.get('set-cookie','').lower() and 'samesite=lax' in acceptance.headers.get('set-cookie','').lower(),'Offer invitation uses protected cookies')
    promotion_registration=registration('enrolled')
    registered=enrolled.post('/api/auth/register',json={**promotion_registration,'promotionCampaign':CAMPAIGN},headers=HEADERS)
    check(registered.status_code==201 and registered.json().get('promotionEnrolled') is True,'New account is enrolled through accepted invitation')
    check(registered.json().get('signedIn') is True and enrolled.get('/api/quotes').status_code==200,'Registration establishes a customer account session with private history')
    check(not any(name.endswith('_promotion') and value for name,value in enrolled.cookies.items()),'Registration consumes the invitation cookie')
    check(enrolled.post('/api/promotion/accept',headers=HEADERS).status_code==409,'An existing signed-in account cannot enroll through the new-customer offer')
    ordinary_registration=registration('ordinary')
    ordinary_result=ordinary.post('/api/auth/register',json=ordinary_registration,headers=HEADERS)
    check(ordinary_result.status_code==201 and ordinary_result.json().get('promotionEnrolled') is False,'Ordinary registration does not grant the campaign')

    for event_date in ('2026-11-30','2027-01-02'):
        response=validate(enrolled,quote(event_date))
        check(response.status_code==200 and response.json()['quote'].get('promotion')=={'campaignId':CAMPAIGN,'percent':20},'Inclusive event date '+event_date+' receives the authorized discount')
    for event_date in ('2026-11-29','2027-01-03'):
        response=validate(enrolled,quote(event_date))
        check(response.status_code==200 and not response.json()['quote'].get('promotion'),'Event date '+event_date+' remains quoted without campaign discount')
    normal=validate(ordinary,quote())
    check(normal.status_code==200 and not normal.json()['quote'].get('promotion'),'Unenrolled customer gets ordinary prices for an otherwise eligible event')
    claimed={**quote(),'promotion':{'campaignId':CAMPAIGN,'percent':20}}
    check(validate(ordinary,claimed).status_code==400,'Unenrolled customer cannot self-assign a promotion in JSON')
    check(visitor.post('/api/guest/start',headers=HEADERS).status_code==200,'Visitor can begin a quotation without a registered account')
    check(validate(visitor,claimed).status_code==400,'Guest cannot self-assign registered-customer discount')
    check(visitor.get('/api/quotes').status_code==401,'Guest context does not open registered account history')
    for percent in (0,21,100):
        altered={**quote(),'promotion':{'campaignId':CAMPAIGN,'percent':percent}}
        check(validate(enrolled,altered).status_code==400,'Discount percent '+str(percent)+' cannot be supplied by the browser')

    # A new account login reissues its server JWT using the persisted enrollment.
    check(enrolled.post('/api/auth/logout',headers=HEADERS).status_code==200,'Enrolled customer can sign out')
    login=enrolled.post('/api/auth/credentials',json={key:promotion_registration[key] for key in ('username','password')},headers=HEADERS)
    check(login.status_code==200,'Enrolled account can sign in again')
    check(validate(enrolled,quote()).json()['quote'].get('promotion',{}).get('percent')==20,'Campaign entitlement persists across a new login')

    saved_response=enrolled.post('/api/quotes',json=quote(),headers=HEADERS)
    check(saved_response.status_code==201,'Promoted quotation is accepted by the configured quotation backend')
    saved=saved_response.json();quote_id=saved['id']
    check(saved['quote'].get('promotion')=={'campaignId':CAMPAIGN,'percent':20} and saved['totalCents']==27187,'Saved quotation carries exactly twenty percent before IGV')
    with closing(sqlite3.connect(acceptance_database(CONFIG,'apiDatabase','data/quotes.sqlite').as_uri()+'?mode=ro',uri=True,timeout=10)) as database:
        stored=database.execute('SELECT payload,total_cents FROM quotes WHERE id=?',(quote_id,)).fetchone()
    check(stored is not None and stored[1]==27187 and json.loads(stored[0])==saved['quote'],'Actual .NET quotation storage matches the promoted BFF snapshot')
    history=enrolled.get('/api/quotes').json()['quotes']
    check(any(row['id']==quote_id and row['totalCents']==27187 and row['quote'].get('promotion',{}).get('percent')==20 for row in history),'Registered customer history retains the discounted total')
    check(ordinary.get('/api/quotes').json()['quotes']==[],'Another account cannot see the promoted quotation history')
    pdf_path=f'/api/quotes/{quote_id}/pdf'
    document=enrolled.get(pdf_path)
    check(document.status_code==200 and document.content.startswith(b'%PDF-'),'Promoted PDF can be downloaded by its customer')
    digest=hashlib.sha256(document.content).hexdigest()
    check(document.headers.get('x-document-sha256')==digest,'Promoted PDF digest matches archived bytes')
    check(ordinary.get(pdf_path).status_code==404 and visitor.get(pdf_path).status_code==404,'Other customer and guest cannot read the promoted PDF')
    submitted=enrolled.post(f'/api/quotes/{quote_id}/submit',headers=HEADERS)
    check(submitted.status_code==200,'Promoted quotation can be explicitly submitted to the business')
    receipt=submitted.json()['receipt']
    check(receipt['pdfSha256']==digest and receipt['emailStatus']=='not_configured','Submission confirms the archived PDF and does not claim external email')
    repeated=enrolled.post(f'/api/quotes/{quote_id}/submit',headers=HEADERS)
    check(repeated.status_code==200 and repeated.json()['receipt']==receipt,'Repeated promoted submission is idempotent')
    admin=next(account for account in CONFIG['accounts'] if account['role']=='admin')
    admin_login=administrator.post('/api/auth/credentials',json={key:admin[key] for key in ('username','password')},headers=HEADERS)
    check(admin_login.status_code==200,'Owner can access the administrator inbox')
    admin_document=administrator.get(f"/api/admin/submissions/{receipt['id']}/pdf")
    check(admin_document.status_code==200 and admin_document.content==document.content,'Administrator receives exactly the same discounted PDF')
    check(administrator.get('/admin').status_code==200,'Administrator inbox is available after discounted submission')
    check(enrolled.get('/api/admin/accounts').status_code==403,'Promotional enrollment does not elevate the customer role')

    # The API still rejects a forged account token even if it claims campaign entitlement.
    now=int(time.time())
    counterfeit=jwt.encode({'iss':ORIGIN+'/accounts','aud':'ea-cotiza-api','sub':str(uuid.uuid4()),'role':'customer','promotion':CAMPAIGN,'scope':'quotes:read quotes:write','iat':now,'exp':now+300},secrets.token_bytes(32),algorithm='HS256',headers={'typ':'JWT'})
    external=httpx.post(CONFIG.get('apiOrigin','http://127.0.0.1:8370')+'/api/quotes',json=claimed,headers={'Authorization':'Bearer '+counterfeit},trust_env=False,timeout=30)
    check(external.status_code==401,'Direct .NET API rejects forged campaign-bearing JWT')

    artifacts=ROOT/'tests/artifacts';artifacts.mkdir(exist_ok=True)
    (artifacts/'navidad-promotion-workflow.pdf').write_bytes(document.content)
    report={'status':'passed','scope':'Local actual .NET backend; two new synthetic accounts, one submitted promoted quotation, no external email.','checks':checks,'check_count':len(checks),'campaign':CAMPAIGN,'eligible_events':['2026-11-30','2027-01-02'],'outside_events':['2026-11-29','2027-01-03'],'quotation_total_cents':saved['totalCents'],'quote_id':quote_id,'pdf_sha256':digest,'backend_sqlite_record_verified':True,'email':'not_configured'}
    (artifacts/'navidad-promotion-workflow.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
    print(json.dumps({'status':'passed','checks':len(checks),'backend':'dotnet','total_cents':saved['totalCents'],'pdf_sha256':digest,'external_email':'not_configured'}))
