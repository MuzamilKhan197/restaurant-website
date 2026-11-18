// Refresh the existing isolated build without copying dependencies again.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const target=path.resolve(fs.readFileSync('phase4-build-target.txt','utf8').trim());
const allowed=['C:/workspace','C:/Users/dell/AppData/Local/Temp'].map(p=>path.resolve(p));
if(!allowed.includes(path.dirname(target))||!path.basename(target).startsWith('restaurant-phase4-build-'))throw new Error('Unapproved build target');
if(!fs.existsSync(path.join(target,'node_modules/next/package.json')))throw new Error('Run prepare-build-check.mjs first');
for(const name of ['src','public','tests','scripts','supabase','package.json','package-lock.json','next.config.ts','tsconfig.json','.env.local']){
 fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
}
const config=path.join(target,'next.config.ts');
fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace('reactStrictMode: true,','reactStrictMode: true, cleanDistDir: false,'));
function outputs(directory){
 const relative=path.relative(path.join(target,'src/app'),directory);
 for(const base of ['.next/server/app','.next/static/chunks/app','.next/types/app'])fs.mkdirSync(path.join(target,base,relative),{recursive:true});
 for(const entry of fs.readdirSync(directory,{withFileTypes:true}))if(entry.isDirectory())outputs(path.join(directory,entry.name));
}
outputs(path.join(target,'src/app'));
console.log('Refreshed isolated build source: '+target);
