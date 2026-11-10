export const rucWeights = [5,4,3,2,7,6,5,4,3,2] as const;
export function isValidRuc(value:string):boolean {
 if(!/^(10|15|16|17|20)\d{9}$/.test(value))return false;
 const sum=rucWeights.reduce((total,weight,i)=>total+Number(value[i])*weight,0);
 return (11-sum%11)%10===Number(value[10]);
}
export function clientDocumentType(q:{documentType?:'dni'|'ruc';clientType:string;clientDocument:string}):'dni'|'ruc' {
 return q.documentType??(q.clientType==='empresa'||q.clientDocument.length===11?'ruc':'dni');
}
export type RucIdentity={ruc:string;legalName:string;status:string;condition:string;source:string;checkedAt:string;dataDate?:string;demo:boolean};
