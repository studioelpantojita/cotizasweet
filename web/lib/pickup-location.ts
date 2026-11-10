import type {Quote} from './quote';

// Business pickup reference confirmed by the owner. No street address has been supplied.
export const pickupLocation={name:'Tiendita “LosPantojados”',address:'Santiago de Surco'};
export const pickupAddress=[pickupLocation.name,pickupLocation.address].filter(Boolean).join(' · ');
export function pickupPatch():Pick<Quote,'locationMode'|'provinceId'|'districtId'|'address'>{
 return {locationMode:'pickup',provinceId:'',districtId:'',address:pickupAddress};
}
