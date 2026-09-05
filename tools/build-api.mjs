import {build} from 'esbuild';
await build({entryPoints:['serverless/entry.mjs'],outfile:'serverless/runtime.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
