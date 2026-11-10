import data from "./peru-ubigeo.json";
export const departments=data.departments;
export const provinces=data.provinces;
export const districts=data.districts;
export const ubigeoSource={url:data.source,version:data.version,retrieved:data.retrieved};
const plain=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-PE").trim().replace(/\s+/g," ");
export function findLegacyLocation(city:string,district:string){
 if(!city||!district)return undefined;
 const parents=new Set(provinces.filter(p=>plain(p.name)===plain(city)).map(p=>p.id));
 const matches=districts.filter(d=>parents.has(d.provinceId)&&plain(d.name)===plain(district));
 return matches.length===1?matches[0]:undefined;
}
