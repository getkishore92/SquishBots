import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
let child,base;
before(async()=>{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 child=spawn(process.execPath,['server/server.mjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 base=await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('Server startup timed out')),5000);child.stdout.on('data',b=>{const m=b.toString().match(/http:\/\/127.0.0.1:\d+/);if(m){clearTimeout(timer);ok(m[0])}});child.once('error',fail);child.once('exit',c=>{if(!base)fail(new Error(`Server exited ${c}`))})});
});
after(()=>child?.kill('SIGTERM'));
const config={seed:'same seed',options:{traits:{shape:.99,'eye.gap':.2}},material:{preset:'clay'},render:{resolution:64,samples:1,transparent:true}};
const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test('catalog and exact config resolution agree',async()=>{
 const catalog=await(await fetch(base+'/api/catalog')).json();assert.equal(catalog.allKeys.length,44);assert.equal(catalog.shapes.length,11);assert.ok(catalog.shapes.some(s=>s.name==='ghost'||s.id==='ghost'));assert.ok(!catalog.shapes.some(s=>s.name==='sun'||s.id==='sun'));
 const response=await post('/api/resolve',config);assert.equal(response.status,200);const data=await response.json();assert.equal(data.resolved.shape,'triangle');assert.equal(data.traitValues['eye.gap'],.2);assert.equal(data.resolved.material.preset,'clay');assert.match(data.svg,/<svg/);
});
test('invalid material and cross-origin mutation are rejected',async()=>{
 assert.equal((await post('/api/resolve',{...config,material:{preset:'script'}})).status,400);
 assert.equal((await post('/api/resolve',config,{Origin:'https://another-origin.example'})).status,403);
 assert.equal((await post('/api/render',{...config,render:{resolution:4096}})).status,400);
});
test('removed widget is unavailable and local Three module is served',async()=>{
 const page=await fetch(base+'/embed.html');assert.equal(page.status,404);
 const module=await fetch(base+'/vendor/three/build/three.module.js');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
});
test('Blender export completes through the render queue', {timeout:120000},async()=>{
 const response=await post('/api/render',config);assert.equal(response.status,202);const created=await response.json();let job=created;
 for(let i=0;i<110&&!['completed','failed','cancelled'].includes(job.status);i++){await new Promise(r=>setTimeout(r,500));job=await(await fetch(base+'/api/jobs/'+created.id)).json()}
 assert.equal(job.status,'completed',job.error);const png=await fetch(base+job.pngUrl);assert.equal(png.status,200);const bytes=new Uint8Array(await png.arrayBuffer());assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
 const repeat=await(await post('/api/render',config)).json();assert.equal(repeat.id,created.id,'same config reuses completed output');
});
