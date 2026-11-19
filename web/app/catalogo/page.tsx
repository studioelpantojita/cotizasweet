import CatalogBrowser from '@/components/catalog-browser';
import {SweetHeader,SweetFooter} from '@/components/sweet-shell';
export const metadata={title:{absolute:'Catálogo | E&A Cotiza'},description:'Descubre presentaciones de pastelería, macarons y chocolates. Consulta los packs, cajas y fichas de insumos de E&A Cotiza.'};
export default function CatalogPage(){return <div className="sweet-site"><SweetHeader active="catalog"/><main id="contenido"><CatalogBrowser/></main><SweetFooter/></div>;}
