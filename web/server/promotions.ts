import {db,readState} from './store';
import {promotionCampaignId,promotionOfferActive} from '@/lib/promotion';

export type OfferIntent={campaignId:typeof promotionCampaignId;acceptedAt:string};
function connection(){
 const connection=db();
 connection.exec(`CREATE TABLE IF NOT EXISTS promotion_enrollments (
 account_id TEXT NOT NULL,campaign_id TEXT NOT NULL,accepted_at TEXT NOT NULL,registered_at TEXT NOT NULL,
 PRIMARY KEY(account_id,campaign_id));`);
 return connection;
}
export function readOfferIntent(token:string|undefined,now=new Date()):OfferIntent|null{
 if(!token||!promotionOfferActive(now))return null;
 const intent=readState<OfferIntent>(token,'promotion');
 return intent?.campaignId===promotionCampaignId&&Number.isFinite(Date.parse(intent.acceptedAt))?intent:null;
}
/** Called inside the synchronous account-creation transaction, after hashing. */
export function enrollNewAccount(accountId:string,token:string,now=new Date()){
 const intent=readOfferIntent(token,now);
 if(!intent)throw new Error('La invitación de la promoción venció.');
 const consumed=readState<OfferIntent>(token,'promotion',true);
 if(!consumed)throw new Error('La invitación ya fue utilizada.');
 const account=db().prepare('SELECT role,created_at FROM accounts WHERE id=?').get(accountId);
 if(!account||account.role!=='customer'||Math.abs(now.getTime()-Date.parse(String(account.created_at)))>60_000)throw new Error('La promoción requiere una cuenta nueva.');
 connection().prepare('INSERT INTO promotion_enrollments VALUES (?,?,?,?)').run(accountId,promotionCampaignId,intent.acceptedAt,now.toISOString());
}
export function hasPromotionEnrollment(accountId:string){return !!connection().prepare('SELECT 1 FROM promotion_enrollments WHERE account_id=? AND campaign_id=?').get(accountId,promotionCampaignId);}
