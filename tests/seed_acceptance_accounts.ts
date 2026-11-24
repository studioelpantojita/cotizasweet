/** Test-only CLI. Seeds only the explicitly configured disposable database. */
import {readFileSync} from 'node:fs';
import {createAccount} from '../web/server/accounts';
import {closeDatabase} from '../web/server/store';

async function main(){
 if(process.env.EA_EPHEMERAL_ACCEPTANCE!=='1'||!process.env.E2E_CREDENTIALS_FILE)throw new Error('Disposable acceptance configuration required.');
 const configuration=JSON.parse(readFileSync(process.env.E2E_CREDENTIALS_FILE,'utf8'));
 if(configuration.webDatabase!==process.env.DATABASE_PATH||!configuration.synthetic)throw new Error('Disposable database mismatch.');
 for(const account of configuration.accounts)await createAccount(account.username,account.password,'QA synthetic '+account.role,account.role);
 closeDatabase();
 console.log('Disposable synthetic administrator and customer created. No credentials printed.');
}
void main().catch(()=>{console.error('Disposable account setup failed.');process.exitCode=1;});
