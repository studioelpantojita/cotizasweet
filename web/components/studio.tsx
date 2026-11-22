'use client';
import {useEffect,useRef,useState} from 'react';
import {ValidationProvider,ValidationSummary,FieldError,focusQuoteField} from './quote-validation';
import {clientDocumentType} from '@/lib/identity';
import {ArrowLeft,ArrowRight,CakeSlice,Download,FileText,FolderOpen,Plus,Save,Share2,Sparkles,Clock,CheckCheck} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {catalog,addons,projectTypes,newMaterials,projectInfo,addDays,materialSelected,materialConditions,locationLabel,locationDetail,initialQuote,money,totals,quoteSchema,createQuoteSchema,paymentConditions,draftSchema,displayDate,type Quote,type QuoteItem,type ProjectType,type SavedQuote} from '@/lib/quote';
import {normalizeProjectDetails,projectDetails} from '@/lib/project-details';
import {downloadPdf,quotePdfBlob} from '@/lib/pdf';
import {referenceBusiness} from '@/lib/reference-business';
import {ServiceQuickAdd} from './commerce';
import {PortfolioServicePicker} from './portfolio-service-picker';
import {QuoteServiceEditor} from './quote-service-editor';
import {quoteItemPhoto} from '@/lib/custom-service';
import {pickupPatch} from '@/lib/pickup-location';
import {IngredientFields} from './ingredient-fields';
import {PackageChooser} from './proposal-packages';
import {ClientFields} from './client-fields';
import {PdfPreview} from './pdf-preview';
import {packagePatch,type PackageId} from '@/lib/packages';
import {orderNotes} from '@/lib/ingredients';
import {LocationFields,ValidityFields,ConditionsFields} from './logistics';
import {CurrencyField} from './currency-field';
import {BrandMark} from './brand-mark';
import {SweetHeader} from './sweet-shell';
import {mergeHistoryEntries,parseHistoryPage,type HistoryEntry} from '@/lib/history';
import './history.css';
import '../app/quote-wizard.css';

const lineId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const steps=[
 {title:'Proyecto y cliente',description:'Define la idea y los datos de tu cliente.',eyebrow:'EL PUNTO DE PARTIDA'},
 {title:'Servicios e insumos',description:'Elige un paquete o compón una selección a medida.',eyebrow:'DA FORMA A TU PROPUESTA'},
 {title:'Entrega y condiciones',description:'Acuerda la locación, las fechas y las condiciones.',eyebrow:'LOS DETALLES DEL SERVICIO'},
 {title:'Revisar propuesta',description:'Revisa los importes y prepara el documento final.',eyebrow:'TU PROPUESTA, LISTA PARA REVISAR'},
];
function stepForField(path:string){
 const field=path.split('.')[0];
 if(['items','currency','materials','materialNotes','dietaryRequirements','allergenNotes','allergenReviewed','packageId','packageName'].includes(field))return 1;
 if(['locationMode','provinceId','districtId','address','deliveryCents','issued','validUntil','taxPercent','advancePercent','notes','pricingVersion','formVersion'].includes(field))return 2;
 return 0;
}

export default function Studio({signedIn}:{signedIn:boolean}){
 const [q,setQ]=useState<Quote>(()=>initialQuote());
 const [tab,setTab]=useState('new');
 const [step,setStep]=useState(0);
 const [history,setHistory]=useState<HistoryEntry[]>([]);
 const [loading,setLoading]=useState(false);
 const [loadError,setLoadError]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(false);
 const [pdfUrl,setPdfUrl]=useState('');
 const [saved,setSaved]=useState<SavedQuote|null>(null);
 const [draftReady,setDraftReady]=useState(false);
 const [attempted,setAttempted]=useState(false);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [focusEpoch,setFocusEpoch]=useState(0);
 const mutex=useRef(false),historyRequest=useRef(false),entryApplied=useRef(false);
 const pendingFocus=useRef<string|null>(null),pendingHeading=useRef(false);
 const headingRef=useRef<HTMLHeadingElement>(null);
 const validation=attempted?createQuoteSchema.safeParse(q):null;
 const issues=validation&&!validation.success?validation.error.issues:[];
 const t=totals(q);

 useEffect(()=>{
  function revealField(event:Event){
   const path=(event as CustomEvent<unknown>).detail;
   if(typeof path!=='string')return;
   // focusQuoteField schedules focus after this React state change is committed.
   setStep(stepForField(path));setTab('new');
  }
  document.addEventListener('quote:reveal-field',revealField);
  return()=>document.removeEventListener('quote:reveal-field',revealField);
 },[]);
 useEffect(()=>{
  // Consume URL intent once, including React's development effect replay.
  if(entryApplied.current)return;
  entryApplied.current=true;
  let draft=initialQuote(),restoredStep=0;
  try{
   const raw=sessionStorage.getItem('ea-pastry-draft');
   if(raw){const parsed=draftSchema.safeParse(JSON.parse(raw));if(parsed.success)draft=parsed.data;}
   const storedStep=sessionStorage.getItem('ea-pastry-step');
   if(storedStep&&/^[0-3]$/.test(storedStep))restoredStep=Number(storedStep);
  }catch{}
  const params=new URLSearchParams(window.location.search),project=params.get('proyecto'),pack=params.get('pack');
  if(projectTypes.some(p=>p.id===project)&&draft.projectType!==project)draft={...draft,projectType:project as ProjectType,packageId:'custom',packageName:'',allergenReviewed:false};
  const item=[...catalog,...addons].find(p=>p.id===pack);
  if(item&&draft.items.length<30){draft={...draft,packageId:'custom',packageName:'',items:[...draft.items,{...item,id:lineId()}],allergenReviewed:false};restoredStep=1;}
  else if(project)restoredStep=0;
  if(draft.pricingVersion===2&&draft.locationMode==='pickup')draft={...draft,...pickupPatch()};
  setQ(normalizeProjectDetails(draft));setStep(restoredStep);setDraftReady(true);
  if(project||pack)window.history.replaceState(null,'','/cotizar');
 },[]);
 useEffect(()=>{
  if(!draftReady)return;
  try{
   const draft=draftSchema.safeParse(q);
   if(draft.success)sessionStorage.setItem('ea-pastry-draft',JSON.stringify(draft.data));
   sessionStorage.setItem('ea-pastry-step',String(step));
  }catch{}
 },[q,draftReady,step]);
 useEffect(()=>{
  if(!pendingFocus.current&&!pendingHeading.current)return;
  const frame=requestAnimationFrame(()=>{
   if(pendingFocus.current){const path=pendingFocus.current;pendingFocus.current=null;focusQuoteField(path);}
   else if(pendingHeading.current){headingRef.current?.focus({preventScroll:true});headingRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
   pendingHeading.current=false;
  });
  return()=>cancelAnimationFrame(frame);
 },[step,focusEpoch,tab]);

 function goToStep(next:number){pendingHeading.current=true;pendingFocus.current=null;setStep(next);setFocusEpoch(v=>v+1);}
 function showIssue(path:string){pendingFocus.current=path;pendingHeading.current=false;setStep(stepForField(path));setTab('new');setFocusEpoch(v=>v+1);}
 function saveDraft(){
  const draft=draftSchema.safeParse(q);
  if(!draft.success){toast.error('Corrige los formatos inválidos para guardar el borrador.');return;}
  try{sessionStorage.setItem('ea-pastry-draft',JSON.stringify(draft.data));sessionStorage.setItem('ea-pastry-step',String(step));toast.success('Borrador guardado en esta pestaña.');}
  catch{toast.error('El navegador no pudo conservar el borrador en esta pestaña.');}
 }
 function add(product:QuoteItem){
  if(q.items.length>=30){toast.error('La propuesta admite hasta 30 servicios.');return;}
  setQ(p=>({...p,packageId:'custom',packageName:'',allergenReviewed:false,items:[...p.items,{...product,id:lineId()}]}));
  setError('');toast.success(`${product.name}: añadido a la propuesta`);
 }
 function update(patch:Partial<Quote>){setQ(p=>normalizeProjectDetails({...p,...(patch.items?{packageId:'custom' as const,packageName:''}:{}),...patch}));setError('');}
 function selectPackage(id:PackageId){update(packagePatch(q,id,lineId));toast.success('Paquete cargado. Puedes ajustar los servicios.');}
 function itemChange(index:number,patch:Partial<Quote['items'][number]>){setQ(p=>({...p,packageId:'custom',packageName:'',allergenReviewed:false,items:p.items.map((item,i)=>i===index?{...item,...patch}:item)}));setError('');}
 async function loadHistory(cursor?:string){
  if(historyRequest.current)return;
  historyRequest.current=true;setLoading(true);setLoadError('');
  try{
   const url=cursor?'/api/quotes?'+new URLSearchParams({cursor}):'/api/quotes';
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok)throw new Error(response.status===401?'Inicia sesión para consultar tus presupuestos.':'No se pudo cargar el historial. Intenta nuevamente.');
   const page=parseHistoryPage(await response.json());
   setHistory(previous=>cursor?mergeHistoryEntries(previous,page.entries):page.entries);
   setNextCursor(page.nextCursor===cursor?null:page.nextCursor);
  }catch(e){setLoadError(e instanceof Error?e.message:'No se pudo cargar el historial.');}
  finally{historyRequest.current=false;setLoading(false);}
 }
 async function persist(quote:Quote):Promise<SavedQuote>{
  if(saved&&JSON.stringify(saved.quote)===JSON.stringify(quote))return saved;
  const response=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(quote)});
  const data=await response.json() as SavedQuote & {error?:string};
  if(!response.ok)throw new Error(data.error);
  setSaved(data);return data;
 }
 function validate(){
  setAttempted(true);const parsed=createQuoteSchema.safeParse(q);
  if(!parsed.success){setError('');showIssue(parsed.error.issues[0].path.join('.'));return false;}
  return true;
 }
 async function verifiedQuote(){
  const response=await fetch('/api/quotes/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo validar.');
  return quoteSchema.parse(data.quote);
 }
 async function action(mode:'save'|'pdf'|'share'){
  if(mutex.current||!validate())return;
  mutex.current=true;setBusy(true);setError('');
  try{
   const verified=await verifiedQuote();let record:SavedQuote|null=null;
   if(signedIn)record=await persist(verified);else if(mode==='save')throw new Error('Inicia sesión para guardar tu presupuesto.');
   if(mode==='save')toast.success('Presupuesto guardado. Lo encontrarás en tu historial.');
   else{await downloadPdf(record?.quote||verified,record?.id,mode==='share');toast.success(mode==='share'?'PDF preparado para compartir.':'PDF descargado.');}
  }catch(e){setError(e instanceof Error?e.message:'No pudimos completar la operación. Inténtalo nuevamente.');}
  finally{mutex.current=false;setBusy(false);}
 }
 useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
 async function previewPdf(){
  if(mutex.current||!validate())return;
  mutex.current=true;setBusy(true);setError('');
  try{const verified=await verifiedQuote();const blob=await quotePdfBlob(verified,saved&&JSON.stringify(saved.quote)===JSON.stringify(verified)?saved.id:undefined);setPdfUrl(URL.createObjectURL(blob));setPreview(true);}
  catch(e){setError(e instanceof Error?e.message:'No se pudo preparar la vista previa.');}
  finally{mutex.current=false;setBusy(false);}
 }
 useEffect(()=>{
  const ctx=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;
  if(!ctx?.registerTool)return;
  const controller=new AbortController();
  void Promise.resolve(ctx.registerTool({name:'read_pastry_quote',title:'Consultar cotización de pastelería',description:'Lee los productos, cliente e importes de la cotización visible sin guardarla ni compartirla.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No admite parámetros.');return {quote:q,totals:totals(q)};}},{signal:controller.signal})).catch(()=>{});
  return()=>controller.abort();
 },[q]);

 return <ValidationProvider issues={issues}><div className="quote-wizard-page">
  <Toaster position="bottom-right"/><SweetHeader active="quote" signedIn={signedIn}/>
  <main className="studio-main" id="contenido"><section className="workspace-section wrap" id="cotizador">
   <div className="section-heading wizard-page-heading"><div><p className="eyebrow">ATELIER DE PROPUESTAS</p><h1>Tu próxima <em>propuesta.</em></h1><p>Una idea, cuatro pasos. Tú decides cada detalle.</p></div><span className="beta-label">Versión piloto · sin cobros</span></div>
   {(q.pricingVersion===1||q.formVersion===1)&&<div className="legacy-notice"><div><strong>Presupuesto anterior</strong><p>Se mantienen los precios, el traslado y las condiciones originales. Puedes generar una nueva versión con movilidad del 5%, IGV del 18% y vigencia de hasta 21 días.</p></div><button className="btn secondary" onClick={()=>{update({formVersion:2,pricingVersion:2,taxPercent:18,deliveryCents:0,...pickupPatch(),validUntil:q.validUntil>addDays(q.issued,21)?addDays(q.issued,21):q.validUntil});setSaved(null);}}>Actualizar condiciones</button></div>}
   <Tabs value={tab} onValueChange={value=>{setTab(value);if(value==='history')void loadHistory();}}>
    <TabsList className="studio-tabs"><TabsTrigger value="new"><FileText size={16}/>Nueva cotización</TabsTrigger><TabsTrigger value="history"><FolderOpen size={16}/>Presupuestos guardados</TabsTrigger></TabsList>
    <TabsContent value="new" forceMount hidden={tab!=='new'}>
     <ValidationSummary/>
     {error&&<p className="error" role="alert">{error}</p>}
     <div className="wizard-layout">
      <aside className="wizard-sidebar">
       <nav aria-label="Pasos de la cotización"><ol>{steps.map((item,index)=><li key={item.title}><button type="button" aria-current={step===index?'step':undefined} aria-controls={'quote-step-'+index} onClick={()=>goToStep(index)}><span className="wizard-step-number">{index+1}</span><span>{item.title}</span></button></li>)}</ol></nav>
       <p className="wizard-progress" role="status">Paso {step+1} de {steps.length}</p><p className="wizard-draft-note">Tu avance se conserva en esta pestaña. Puedes volver a cualquier paso.</p>
       <div className="wizard-total"><span>Total de la propuesta</span><strong>{Number.isFinite(t.total)?money(t.total,q.currency):'Por calcular'}</strong><small>{q.items.length} {q.items.length===1?'servicio':'servicios'} · {q.currency}{q.pricingVersion===2?' · IGV incluido':''}</small></div>
      </aside>
      <div className="wizard-panel">
       <header className="wizard-panel-heading"><p className="eyebrow">{steps[step].eyebrow}</p><h2 id="wizard-heading" tabIndex={-1} ref={headingRef}>{steps[step].title}</h2><p>{steps[step].description}</p></header>
       <div className="wizard-step" id="quote-step-0" hidden={step!==0} inert={step!==0} aria-label="Proyecto y cliente">
        <PackageChooser q={q} onChange={update} onSelect={selectPackage} showPackages={false}/>
        <div className="editor"><ClientFields q={q} onChange={update}/></div>
       </div>
       <div className="wizard-step" id="quote-step-1" hidden={step!==1} inert={step!==1} aria-label="Servicios e insumos">
        <PackageChooser q={q} onChange={update} onSelect={selectPackage} showBrief={false}/>
        <div className="editor">
         <section className="form-section" data-field="items" tabIndex={-1}><FieldError path="items"/><div className="form-title"><span>02</span><h3>Servicios de la propuesta</h3></div>
          <CurrencyField q={q} onChange={update}/>{q.pricingVersion===2&&<p className="field-help service-pricing-note">Precios unitarios sin IGV. La movilidad y el impuesto se desglosan al final.</p>}
          <PortfolioServicePicker currency={q.currency} onAdd={add} disabled={q.items.length>=30}/><ServiceQuickAdd onAdd={add} disabled={q.items.length>=30}/>
          {q.items.length===0?<div className="empty-items"><CakeSlice size={32}/><h4>Tu propuesta empieza con una selección</h4><p>Combina packs, cajas temáticas y detalles personalizados.</p></div>:q.items.map((item,index)=><QuoteServiceEditor key={item.id} item={item} index={index} currency={q.currency} onChange={patch=>itemChange(index,patch)} onRemove={()=>update({items:q.items.filter((_,i)=>index!==i),allergenReviewed:false})}/>)}
          <button className="add-custom" disabled={q.items.length>=30} onClick={()=>update({allergenReviewed:false,items:[...q.items,{id:lineId(),name:'Servicio a medida',description:'',image:'none',quantity:1,priceCents:0,category:'pack',unit:'servicio'}]})}><Plus size={17}/> Añadir un servicio sin referencia</button>
         </section><IngredientFields q={q} onChange={update}/>
        </div>
       </div>
       <div className="wizard-step editor" id="quote-step-2" hidden={step!==2} inert={step!==2} aria-label="Entrega y condiciones"><LocationFields q={q} onChange={update}/><ValidityFields q={q} onChange={update}/><ConditionsFields q={q} onChange={update}/></div>
       <div className="wizard-step wizard-review" id="quote-step-3" hidden={step!==3} inert={step!==3} aria-label="Revisar propuesta">
        <div className="quote-panel"><div className="preview-bar"><span><Sparkles size={15}/> TU PROPUESTA, EN VIVO</span><button disabled={busy} onClick={()=>void previewPdf()}>Ver PDF</button></div><QuotePreview q={q}/></div>
        <div className="quote-actions"><h3>Tu siguiente paso</h3><p className="wizard-export-note">Revisa los datos y comparte la propuesta cuando esté lista.</p><button className="btn full" disabled={busy} onClick={()=>void action('pdf')}><Download size={17}/>{busy?'Preparando…':'Descargar cotización PDF'}</button><div className="action-pair"><button className="btn secondary" disabled={busy} onClick={()=>void action('save')}><Save size={16}/>Guardar</button><button className="btn secondary" disabled={busy} onClick={()=>void action('share')}><Share2 size={16}/>Compartir PDF</button></div>{signedIn?<p className="caption"><CheckCheck size={14}/> Al descargar, también se guarda una copia en tu historial.</p>:<p className="caption">Puedes probar el PDF sin cuenta. <a href="/auth/login">Inicia sesión</a> para guardar tu historial.</p>}{saved&&JSON.stringify(saved.quote)===JSON.stringify(q)&&<p className="saved-label">Guardado · {saved.id.slice(0,8).toUpperCase()}</p>}</div>
       </div>
       <footer className="wizard-controls"><button type="button" className="btn secondary wizard-save-draft" onClick={saveDraft}><Save size={16}/>Guardar borrador</button><div>{step>0&&<button type="button" className="btn secondary" onClick={()=>goToStep(step-1)}><ArrowLeft size={16}/>Anterior</button>}{step<steps.length-1&&<button type="button" className="btn" onClick={()=>goToStep(step+1)}>Continuar<ArrowRight size={16}/></button>}</div></footer>
      </div>
     </div>
    </TabsContent>
    <TabsContent value="history"><div className="history" aria-busy={loading}>
     <div className="history-heading"><h3>Tus propuestas, a mano.</h3><button className="btn secondary small" disabled={loading} onClick={()=>void loadHistory()}>Actualizar</button></div>
     <p className="caption">Cada guardado conserva una versión independiente. Las propuestas más recientes aparecen primero.</p>
     {loadError&&<p className="error" role="alert">{loadError} {!signedIn&&<a href="/auth/login">Iniciar sesión</a>}</p>}
     {history.map(entry=><HistoryResult key={entry.id} entry={entry} onOpen={record=>{setQ(normalizeProjectDetails({...record.quote,materials:record.quote.materials.length?record.quote.materials:newMaterials()}));setSaved(record);setError('');setAttempted(false);setTab('new');goToStep(0);}}/>)}
     {!loading&&!loadError&&history.length===0&&!nextCursor&&<div className="empty-items"><FolderOpen size={32}/><h4>Aquí crecerá tu historial</h4><p>Guarda tu primera cotización para volver a consultarla.</p><button className="btn small" onClick={()=>{setTab('new');goToStep(0);}}>Crear cotización</button></div>}
     {(loading||nextCursor)&&<div className="history-pagination">{loading&&<p role="status">Cargando presupuestos…</p>}{nextCursor&&<button className="btn secondary small" disabled={loading} onClick={()=>void loadHistory(nextCursor)}>Cargar más propuestas</button>}</div>}
    </div></TabsContent>
   </Tabs>
  </section></main>
  <footer className="studio-footer wrap"><BrandMark variant="compact"/><a href="/">Volver al inicio</a></footer>
  <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="preview-dialog"><DialogHeader><DialogTitle>Vista previa de tu propuesta</DialogTitle><DialogDescription>Este es el documento PDF generado con los datos validados.</DialogDescription></DialogHeader>{pdfUrl&&<PdfPreview url={pdfUrl}/>}</DialogContent></Dialog>
 </div></ValidationProvider>;
}

function HistoryResult({entry,onOpen}:{entry:HistoryEntry;onOpen:(record:SavedQuote)=>void}){
 const reference=entry.id.slice(0,8).toUpperCase();
 if(entry.kind==='legacy')return <article className="history-row"><FileText aria-hidden="true"/><div><h4>{entry.client}</h4><p>{entry.issued&&<>{displayDate(entry.issued)} · </>}{reference}</p></div><span className="history-legacy">Versión anterior</span></article>;
 const {saved}=entry,{quote}=saved;
 return <article className="history-row"><FileText aria-hidden="true"/><div><h4>{quote.client}</h4><p>{projectDetails(quote)||projectInfo(quote.projectType).label} · {displayDate(quote.issued)} · {reference}</p></div><strong>{money(saved.totalCents,quote.currency)}</strong><button className="btn secondary small" onClick={()=>onOpen(saved)}>Abrir</button><button className="icon-button" aria-label={'Descargar presupuesto de '+quote.client} onClick={()=>void downloadPdf(quote,saved.id).catch(()=>toast.error('No se pudo descargar el PDF.'))}><Download size={19}/></button></article>;
}

function QuotePreview({q}:{q:Quote}){const t=totals(q);const info=projectInfo(q.projectType);const materials=q.materials.filter(materialSelected);const conditions=materialConditions(q);const specifications=orderNotes(q);return <div className="quote-paper"><p className="paper-reference-label">{referenceBusiness.label}</p><div className="paper-brand"><span className="paper-reference-mark">{referenceBusiness.monogram}</span><p>{referenceBusiness.name}<small>{referenceBusiness.address}<br/>Tel.: {referenceBusiness.phone}<br/>{referenceBusiness.email}<br/>{referenceBusiness.website}</small></p></div><div className="paper-title"><span>PROPUESTA COMERCIAL · {info.label.toUpperCase()}</span><h3>Una experiencia<br/><em>creada a tu medida.</em></h3></div><div className="paper-client"><p className="client-kind">Tipo de cliente: {q.clientType==='empresa'?'Empresa':'Persona Natural'}</p><span>PREPARADO PARA</span><strong>{q.client||'Nombre del cliente'}</strong><p><b>{clientDocumentType(q).toUpperCase()}:</b> {q.clientDocument||'Por completar'}</p><p><b>Contacto de tu negocio:</b> {q.contact||'Por completar'}</p><p><b>Correo del cliente:</b> {q.clientEmail.trim()||'No proporcionado'}</p>{q.clientContact&&<p>{q.clientContact}</p>}<div className="paper-project"><span>DETALLE DEL PROYECTO</span><h4>{projectDetails(q)||'Por completar'}</h4>{q.eventDate&&<p>Fecha del evento: {displayDate(q.eventDate)}</p>}</div></div><div className="paper-objective"><span>{q.packageName||'Selección personalizada'}</span><p><b>Objetivo del Proyecto:</b> {info.label}</p></div><div className="paper-dates"><div><span>Emisión</span><b>{displayDate(q.issued)}</b></div><div><span>Válida hasta</span><b>{displayDate(q.validUntil)}</b></div></div><p className="paper-currency">Moneda de la propuesta · <strong>{q.currency==='USD'?'USD · Dólares':'PEN · Soles'}</strong></p><div className="paper-location"><b>{locationLabel(q)}</b>{(locationDetail(q)||!q.address)&&<p>{locationDetail(q)||'Ubicación por coordinar'}</p>}{q.address&&<p>{q.address}</p>}</div><div className="paper-products">{q.items.length===0?<p className="caption">Tu selección de packs y adicionales aparecerá aquí.</p>:(['pack','addon'] as const).map(category=>{const items=q.items.filter(p=>p.category===category);return items.length>0&&<section className="paper-service-group" key={category}><h4>{category==='pack'?'Servicios y selecciones a medida':'Toppings y adicionales'}</h4>{items.map(p=><div key={p.id} className="paper-product">{quoteItemPhoto(p)&&<img src={quoteItemPhoto(p)!} alt=""/>}<div><b>{p.name}</b><small>{p.description}</small><span>{p.quantity} × {p.unit} · {money(p.priceCents,q.currency)}</span></div><strong>{money(p.priceCents*p.quantity,q.currency)}</strong></div>)}</section>;})}</div><div className="paper-totals"><p><span>Servicios y selecciones</span><b>{money(t.packs,q.currency)}</b></p><p><span>Toppings y adicionales</span><b>{money(t.addons,q.currency)}</b></p><p><span>Subtotal de servicios</span><b>{money(t.subtotal,q.currency)}</b></p><p><span>{q.pricingVersion===2?`Movilidad (${t.mobilityRate}%)`:'Entrega / traslado'}</span><b>{money(t.mobility,q.currency)}</b></p>{q.pricingVersion===2&&<><p><span>Base antes de impuestos</span><b>{money(t.base,q.currency)}</b></p><p><span>IGV (18%)</span><b>{money(t.tax,q.currency)}</b></p></>}<p className="grand-total"><span>Inversión total</span><b>{money(t.total,q.currency)}</b></p><p className="paper-payment"><span>Anticipo ({q.advancePercent}%)</span><b>{money(t.advance,q.currency)}</b></p><p className="paper-payment"><span>Saldo pendiente</span><b>{money(t.balance,q.currency)}</b></p></div>{(materials.length>0||specifications||conditions.length>0)&&<section className="paper-materials"><h4>Ficha de insumos</h4>{specifications&&<><h4>Notas específicas del pedido</h4><p className="paper-specifications">{specifications}</p></>}{conditions.length>0&&<div className="paper-conditions"><h4>Condiciones de los insumos</h4><ol>{conditions.map((note,i)=><li key={i}>{note}</li>)}</ol></div>}</section>}<div className="paper-valid"><Clock size={14}/>Válida hasta {displayDate(q.validUntil)}</div><div className="paper-notes"><b>Condiciones de pago</b>{paymentConditions(q).map((line,i)=><p key={i}>{line}</p>)}</div>{q.notes&&<div className="paper-notes"><b>Condiciones y notas</b><p>{q.notes}</p></div>}<div className="paper-footer"><BrandMark /></div></div>;}
