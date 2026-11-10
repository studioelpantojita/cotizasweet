'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFDocumentLoadingTask} from 'pdfjs-dist';

/** Renders the generated PDF itself, including in WebViews without a native PDF viewer. */
export function PdfPreview({url}:{url:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[error,setError]=useState(''),[rendering,setRendering]=useState(true);
 const [fit,setFit]=useState<'page'|'width'>('page');
 useEffect(()=>{
  let disposed=false,task:PDFDocumentLoadingTask|undefined;
  setDocument(null);setPage(1);setFit('page');setError('');setRendering(true);
  void import('pdfjs-dist').then(async pdfjs=>{
   if(disposed)return;
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   task=pdfjs.getDocument({url});
   const loaded=await task.promise;if(!disposed)setDocument(loaded);
  }).catch(()=>{if(!disposed){setError('No se pudo mostrar la vista previa. Puedes descargar el PDF verificado.');setRendering(false);}});
  return()=>{disposed=true;void task?.destroy();};
 },[url]);
 useEffect(()=>{
  if(!document||!canvas.current)return;
  let disposed=false,cancel:(()=>void)|undefined;
  setRendering(true);setError('');
  void document.getPage(page).then(async pdfPage=>{
   if(disposed||!canvas.current)return;
   const viewport=pdfPage.getViewport({scale:1.5}),target=canvas.current;
   target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
   const task=pdfPage.render({canvas:target,canvasContext:target.getContext('2d')!,viewport});cancel=()=>task.cancel();
   await task.promise;if(!disposed)setRendering(false);
  }).catch(()=>{if(!disposed){setError('No se pudo dibujar esta página. Puedes descargar el PDF.');setRendering(false);}});
  return()=>{disposed=true;cancel?.();};
 },[document,page]);
 return <div className="pdf-viewer">
  <div className="pdf-viewer-controls"><button className="btn secondary small" disabled={!document||page<=1||rendering} onClick={()=>setPage(p=>p-1)}>Anterior</button><span aria-live="polite">{document?`Página ${page} de ${document.numPages}`:'Cargando PDF…'}</span><button className="btn secondary small" disabled={!document||page>=document.numPages||rendering} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
  <div className="pdf-viewer-zoom" role="group" aria-label="Tamaño de vista previa"><button type="button" aria-pressed={fit==='page'} onClick={()=>setFit('page')}>Página completa</button><button type="button" aria-pressed={fit==='width'} onClick={()=>setFit('width')}>Ampliar al ancho</button></div>
  {error&&<p role="alert" className="error">{error}</p>}
  {rendering&&<p role="status">Preparando página…</p>}
  <div className={`pdf-page-scroll fit-${fit}`} tabIndex={0} aria-label={fit==='width'?'PDF ampliado; desplázate para ver toda la página':'Página completa del PDF'}><canvas ref={canvas} role="img" aria-label={`Página ${page} del PDF de la cotización`} style={{display:document?'block':'none'}}/></div>
  <a className="text-link" href={url} download="Cotizacion-verificada.pdf">Descargar este PDF</a>
 </div>;
}
