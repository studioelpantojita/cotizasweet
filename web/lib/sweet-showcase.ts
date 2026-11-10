// Visual references are intentionally separate from priced, saleable services.
// A quote may reference a photograph only after the user defines its scope and price.
export type ShowcaseCategory = 'cakes' | 'macarons' | 'chocolates';
export type ShowcasePiece = {id:string; name:string; category:ShowcaseCategory; image:string; description:string; format:string};
export const showcaseCategories = [
 {id:'cakes', label:'Tortas y postres'},
 {id:'macarons', label:'Macarons'},
 {id:'chocolates', label:'Chocolates'},
] as const;
export const showcase:ShowcasePiece[] = [
 {id:'delicia-fresas',name:'Delicia de fresas',category:'cakes',image:'sweet-delicia-fresas.png',description:'Capas abiertas, fresas protagonistas y una presentación que invita a compartir.',format:'Torta · presentación de muestra'},
 {id:'macarons-napoleon',name:'Coffret Napoléon',category:'macarons',image:'sweet-macarons-napoleon.png',description:'Una composición de macarons en un estuche de líneas clásicas y detalles ornamentales.',format:'Estuche de 24 macarons · referencia visual'},
 {id:'chocolates-royale',name:'Coffret 16 Royale',category:'chocolates',image:'sweet-chocolates-royale.png',description:'Dieciséis chocolates en una caja de tonos dorados, pensada como referencia de obsequio.',format:'Estuche de 16 chocolates · referencia visual'},
 {id:'tarta-pistacho',name:'Sinfonía de pistacho',category:'cakes',image:'sweet-tarta-pistacho.png',description:'Tonos de cacao, un contorno delicado y el contraste visual del pistacho.',format:'Tarta · presentación de muestra'},
 {id:'cheesecake-frutos-rojos',name:'Cheesecake frío de frutos rojos',category:'cakes',image:'sweet-cheesecake-frutos-rojos.jpg',description:'Una silueta suave coronada con frutos rojos y pequeños detalles de crema.',format:'Cheesecake · presentación de muestra'},
 {id:'macarons-valentin',name:'Coffret Saint-Valentin',category:'macarons',image:'sweet-macarons-valentin.png',description:'Un estuche ilustrado en rosa y rojo que convierte la presentación en parte del detalle.',format:'Estuche de 18 macarons · referencia visual'},
 {id:'ositos-leche',name:'Dúo de ositos · chocolate con leche',category:'chocolates',image:'sweet-ositos-leche.png',description:'Dos pequeñas figuras con lazos claros y estuches en verde suave.',format:'Dúo de figuras · referencia visual'},
 {id:'cheesecake-new-york',name:'New York style cheesecake',category:'cakes',image:'sweet-cheesecake-new-york.jpg',description:'Una presentación clásica, con una corona de frutos y un acabado limpio.',format:'Cheesecake · presentación de muestra'},
 {id:'tarta-frutos-rojos',name:'Sinfonía de frutos rojos',category:'cakes',image:'sweet-tarta-frutos-rojos.jpg',description:'Una tarta de perfil bajo donde los frutos rojos aportan color y movimiento.',format:'Tarta · presentación de muestra'},
 {id:'macarons-eugenie',name:'Coffret Eugénie',category:'macarons',image:'sweet-macarons-eugenie.png',description:'Un estuche desplegable que revela una selección de colores y pequeñas piezas.',format:'Composición de 32 macarons · referencia visual'},
 {id:'chocolates-champs',name:'Coffret 75 Champs',category:'chocolates',image:'sweet-chocolates-champs.png',description:'Chocolates dispuestos en una retícula precisa, con una presentación sobria y cálida.',format:'Estuche de 16 chocolates · referencia visual'},
 {id:'lucuma',name:'Pasión de lúcuma',category:'cakes',image:'sweet-lucuma.jpg',description:'Tonos caramelo y detalles de chocolate en una composición de líneas redondeadas.',format:'Torta · presentación de muestra'},
 {id:'macarons-intemporel',name:'Coffret Intemporel',category:'macarons',image:'sweet-macarons-intemporel.png',description:'Un estuche amplio en tonos suaves para una selección de macarons para compartir.',format:'Estuche de 35 macarons · referencia visual'},
 {id:'ositos-oscuro',name:'Dúo de ositos · chocolate oscuro',category:'chocolates',image:'sweet-ositos-oscuro.png',description:'El contraste del chocolate oscuro y los lazos rosados en una presentación de regalo.',format:'Dúo de figuras · referencia visual'},
 {id:'tocino-cielo',name:'Tocino de cielo',category:'cakes',image:'sweet-tocino-cielo.jpg',description:'Un acabado brillante de caramelo y una forma clásica para el centro de la mesa.',format:'Postre · presentación de muestra'},
 {id:'osito-xxl',name:'Osito de chocolate XXL',category:'chocolates',image:'sweet-osito-xxl.png',description:'Una figura de gran formato acompañada por pequeñas piezas de la misma colección.',format:'Figura de chocolate · referencia visual'},
 {id:'pera-tropical',name:'Torta pera tropical',category:'cakes',image:'sweet-pera-tropical.jpg',description:'Frutas, colores vivos y una composición abundante que celebra la mesa compartida.',format:'Torta · presentación de muestra'},
];
export const normalizeSearch=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function filterShowcase(category:string,query:string){
 const terms=normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
 return showcase.filter(p=>(category==='selection'||p.category===category)&&terms.every(t=>normalizeSearch(`${p.name} ${p.description} ${p.format} ${showcaseCategories.find(c=>c.id===p.category)?.label}`).includes(t)));
}
