import {writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import {catalogSchema,validateCatalog} from '../lib/commercial-catalog';
const root=resolve(process.cwd(),'../contracts');
validateCatalog(JSON.parse(readFileSync(resolve(root,'catalog.json'),'utf8')));
writeFileSync(resolve(root,'catalog.schema.json'),JSON.stringify(z.toJSONSchema(catalogSchema,{target:'draft-7',io:'input'}),null,2)+'\n');
console.log('Catálogo y esquema válidos.');
