const esbuild=require('esbuild');
const original=esbuild.build;
module.exports={...esbuild,build:options=>original({...options,plugins:[...(options.plugins||[]),{name:'test-environment',setup(build){
 build.onLoad({filter:/server\/env\.ts$/},()=>({contents:'export const env = key => globalThis.testEnvironment?.env?.get(key);',loader:'js'}));
}}]})};
