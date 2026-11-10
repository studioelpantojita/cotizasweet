import CatalogBrowser from '@/components/catalog-browser';
import {SweetHeader,SweetFooter} from '@/components/sweet-shell';
export const metadata={title:'Catálogo | CotizaSweet',description:'Descubre presentaciones de pastelería, macarons y chocolates. Consulta los packs, cajas y fichas de insumos de CotizaSweet.'};
export default function CatalogPage(){return <div className="sweet-site"><SweetHeader active="catalog"/><main id="contenido"><CatalogBrowser/></main><SweetFooter/></div>;}
