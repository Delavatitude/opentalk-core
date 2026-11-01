import fs from 'node:fs';
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const entries=Object.entries(lock.packages).filter(([p])=>p).sort(([a],[b])=>a.localeCompare(b));
const rows=entries.map(([p,v])=>[p.replace(/^.*node_modules\//,''),v.version,v.license||'UNDECLARED',v.resolved||''].join(' | '));
fs.writeFileSync('THIRD_PARTY_NOTICES.md','# Third-party dependency inventory\n\nGenerated from package-lock.json. Licenses and full copyright notices remain in each package’s LICENSE/NOTICE files; this inventory does not replace them. No dependencies are vendored in this source distribution. UNDECLARED entries require manual review before a release.\n\nPackage | Version | Declared license | Package source\n--- | --- | --- | ---\n'+rows.join('\n')+'\n');
if(entries.some(([,v])=>/Hippocratic/i.test(v.license||'')))throw Error('Restricted-use license requires review');
console.log(entries.length+' dependency entries inventoried');
