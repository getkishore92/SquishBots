#!/usr/bin/env node
import {accessSync,constants,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname,resolve,delimiter,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveConfig,referenceSvg} from '../core/resolve.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function executable(path){try{accessSync(path,constants.X_OK);return path}catch{return null}}
function blenderBinary(){
 if(process.env.BLENDER_BIN){const binary=executable(resolve(process.env.BLENDER_BIN));if(!binary)throw new Error('BLENDER_BIN must point to an executable Blender binary');return binary}
 const paths=[resolve(root,'../../work/blender-runtime/Blender.app/Contents/MacOS/Blender'),'/Applications/Blender.app/Contents/MacOS/Blender',...(process.env.PATH??'').split(delimiter).filter(Boolean).map(p=>resolve(p,process.platform==='win32'?'blender.exe':'blender'))];
 for(const path of paths){const binary=executable(path);if(binary)return binary}
 throw new Error('Blender was not found. Set BLENDER_BIN to its executable path or add Blender to PATH.');
}
async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')||args.length===0){console.log('Usage: npm run render -- configs/round.json renders/round.png [--studio]\nSet BLENDER_BIN to a Blender executable path when needed.');return}
 const studio=args.includes('--studio'), positional=args.filter(a=>a!=='--studio');
 if(positional.length!==2||positional.some(a=>a.startsWith('--')))throw new Error('Expected config.json output.png and optional --studio');
 const [input,output]=positional.map(p=>resolve(p));
 if(extname(output).toLowerCase()!=='.png')throw new Error('Output must have a .png extension');
 const config=JSON.parse(readFileSync(input,'utf8')),scene=resolveConfig(config),binary=blenderBinary();
 mkdirSync(dirname(output),{recursive:true});
 const base=output.slice(0,-4),resolved=`${base}.resolved.json`,reference=`${base}.reference.svg`;
 writeFileSync(resolved,JSON.stringify(scene,null,2)+'\n');writeFileSync(reference,referenceSvg(config));
 const argv=['--background','--python-exit-code','2','--python',resolve(root,'renderer/render.py'),'--',resolved,output,...(studio?['--studio']:[])];
 console.log(`Rendering ${scene.shape} / ${scene.material.preset} to ${output}`);
 const child=spawn(binary,argv,{stdio:'inherit',shell:false});
 const code=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(`Blender stopped by ${signal}`)):done(code))});
 if(code!==0)throw new Error(`Blender exited with status ${code}`);
 console.log(`Saved ${output}\nReproduction inputs: ${resolved}\n2D reference: ${reference}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
