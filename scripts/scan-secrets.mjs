import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const skip=new Set(['.git','.agents','.release','node_modules','dist','data']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(skip.has(e.name))return [];
 const p=path.join(dir,e.name);
 if(e.isSymbolicLink())throw Error('Symlink excluded from release: '+p);
 return e.isDirectory()?walk(p):[p];
});}
const files=walk('.');
const result=spawnSync(process.execPath,['node_modules/secretlint/bin/secretlint.js','--secretlintrc','.secretlintrc.json',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status ?? 1);
