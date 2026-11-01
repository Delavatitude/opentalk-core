import {spawn} from 'node:child_process';
const children=[spawn(process.execPath,['--env-file-if-exists=.env','--watch','server/index.ts'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit'})];
let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children)child.on('exit',code=>stop(code||0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
