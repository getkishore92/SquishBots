import './build-api.mjs';
import {cp,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const build=spawnSync('npm',['run','build'],{stdio:'inherit',env:{...process.env,VITE_HOSTED:'true'}});if(build.status!==0)process.exit(build.status??1);
await mkdir('web-dist/vendor/three',{recursive:true});
for(const name of ['preview.js','geometry.js','motion.js','animation-export.js'])await cp(`web/${name}`,`web-dist/${name}`);
for(const name of ['build','examples/jsm','examples/fonts'])await cp(`node_modules/three/${name}`,`web-dist/vendor/three/${name}`,{recursive:true});
