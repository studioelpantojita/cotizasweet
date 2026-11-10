// In-process TypeScript runner for contract exports and tests. Run typecheck separately.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {pathToFileURL}=require('node:url');
const web=path.resolve(__dirname,'..');
const ts=require(web+'/node_modules/typescript');
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return originalResolve.call(this,request.startsWith('@/')?path.join(web,request.slice(2)):request,...args)};
require.extensions['.ts']=function(mod,filename){
 const source=fs.readFileSync(filename,'utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(filename).href));
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 mod._compile(output,filename);
};
require(path.resolve(process.argv[2]));
