import {convertAnimation} from './animation.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolveConfig,referenceSvg} from '../core/resolve.mjs';
import {CATALOG,getTraitValues} from '../core/catalog.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const jobsRoot=resolve(root,'renders/jobs');
const jobs=new Map(),queue=[];let running=false;
const port=Number(process.env.PORT??8879);
const mime={'.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.blend':'application/octet-stream','.woff2':'font/woff2','.md':'text/plain; charset=utf-8'};
function reply(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
async function json(req){
 if(!(req.headers['content-type']??'').startsWith('application/json'))throw Object.assign(new Error('Send application/json'),{status:415});
 let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw Object.assign(new Error('Config exceeds 64 KB'),{status:413});chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new Error('Invalid JSON')}
}
function terminate(child){if(!child)return;const signal=s=>{try{if(process.platform==='win32')child.kill(s);else process.kill(-child.pid,s)}catch{}};signal('SIGTERM');const kill=setTimeout(()=>signal('SIGKILL'),1500);kill.unref();child.once('close',()=>clearTimeout(kill))}
function snapshot(j){return {id:j.id,status:j.status,progress:j.progress,configHash:j.configHash,error:j.error,createdAt:j.createdAt,...(j.status==='completed'?{url:`/renders/jobs/${j.id}/avatar.png`,pngUrl:`/renders/jobs/${j.id}/avatar.png`,blendUrl:`/renders/jobs/${j.id}/avatar.blend`,configUrl:`/renders/jobs/${j.id}/config.json`,result:{png:`/renders/jobs/${j.id}/avatar.png`,blend:`/renders/jobs/${j.id}/avatar.blend`,config:`/renders/jobs/${j.id}/config.json`}}:{})}}
async function work(){
 if(running)return;const j=queue.shift();if(!j)return;running=true;j.status='rendering';j.progress=1;
 try{
  const dir=resolve(jobsRoot,j.id);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'config.json'),JSON.stringify(j.config,null,2));
  if(j.status==='cancelled')return;
  const child=spawn(process.execPath,[resolve(root,'tools/render.mjs'),resolve(dir,'config.json'),resolve(dir,'avatar.png')],{cwd:root,stdio:['ignore','pipe','pipe'],shell:false,detached:process.platform!=='win32'});j.child=child;let log='';
  const add=b=>{log=(log+b.toString()).slice(-16000);const all=[...log.matchAll(/Sample (\d+)\/(\d+)/g)];if(all.length){const a=all.at(-1);j.progress=Math.min(98,Math.round(Number(a[1])/Number(a[2])*98))}};child.stdout.on('data',add);child.stderr.on('data',add);
  const timeout=setTimeout(()=>{j.error='Render exceeded five minutes';terminate(child)},300000);
  const code=await new Promise((ok,fail)=>{child.once('error',fail);child.once('close',ok)}).finally(()=>clearTimeout(timeout));
  await writeFile(resolve(dir,'render.log'),log);
  if(j.status==='cancelled')return;
  if(code!==0||!existsSync(resolve(dir,'avatar.png')))throw new Error(j.error??(log.includes('non-star')||log.includes('star-shaped')?'This shape combination has gaps the current 3D renderer cannot preserve. Change the sun petal spacing or size.':'Blender could not render this configuration.'));
  j.status='completed';j.progress=100;
 }catch(error){if(j.status!=='cancelled'){j.status='failed';j.error=error.message}}
 finally{delete j.child;running=false;void work()}
}
async function staticFile(pathname,req,res){
 let base,relative;
 if(pathname.startsWith('/vendor/three/')){base=resolve(root,'node_modules/three');relative=pathname.slice('/vendor/three/'.length)}
 else if(pathname==='/'||pathname==='/index.html'){base=resolve(root,existsSync(resolve(root,'web-dist/index.html'))?'web-dist':'web');relative='index.html'}
 else if(pathname.startsWith('/assets/')){base=resolve(root,'web-dist');relative=pathname.slice(1)}
 else if(/^\/(renders|configs|docs)\//.test(pathname)||['/review.html','/review-sheet.png','/README.md','/CREDITS.md'].includes(pathname)){base=root;relative=pathname.slice(1)}
 else{base=resolve(root,'web');relative=pathname.slice(1)}
 const path=resolve(base,relative);if(!path.startsWith(base+sep)||relative.split('/').some(p=>p.startsWith('.')))return reply(res,404,{error:'Not found'});
 try{const s=await stat(path);if(!s.isFile())throw new Error();res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res)}catch{reply(res,404,{error:'Not found'})}
}
export const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path.startsWith('/api/')&&req.method==='POST'){
   const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return reply(res,403,{error:'Use the editor on this host'});
  }
  if(req.method==='GET'&&path==='/api/catalog')return reply(res,200,CATALOG);
  if(req.method==='GET'&&path==='/api/health')return reply(res,200,{ok:true,renderer:'Blender Cycles',preview:'Three.js',queued:queue.length,running});
  if(req.method==='POST'&&path==='/api/resolve'){
   const input=await json(req);const resolved=resolveConfig(input.config??input);return reply(res,200,{resolved,svg:referenceSvg(resolved.config),traitValues:getTraitValues(resolved.config)});
  }
  if(req.method==='POST'&&path==='/api/animation')return reply(res,200,await convertAnimation(req,url.searchParams.get('format'),root));
  if(req.method==='POST'&&path==='/api/render'){
   const input=await json(req);const scene=resolveConfig(input.config??input);
   if((scene.render.resolution??768)>2048||(scene.render.samples??64)>256)return reply(res,400,{error:'Web exports support up to 2048 px and 256 samples. Use the CLI for larger renders.'});
   const cached=[...jobs.values()].find(j=>j.configHash===scene.configHash&&['completed','queued','rendering'].includes(j.status));if(cached)return reply(res,200,snapshot(cached));
   if(queue.length>=4)return reply(res,429,{error:'The render queue is full. Try again after a render finishes.'});
   const id=randomUUID();const j={id,config:scene.config,configHash:scene.configHash,status:'queued',progress:0,createdAt:new Date().toISOString()};jobs.set(id,j);queue.push(j);void work();return reply(res,202,snapshot(j));
  }
  const match=path.match(/^\/api\/jobs\/([a-f0-9-]+)$/);
  if(match&&req.method==='GET'){const j=jobs.get(match[1]);return j?reply(res,200,snapshot(j)):reply(res,404,{error:'Render not found'})}
  if(match&&req.method==='POST'){
   const j=jobs.get(match[1]);if(!j)return reply(res,404,{error:'Render not found'});
   if(['queued','rendering'].includes(j.status)){const i=queue.indexOf(j);if(i>=0)queue.splice(i,1);j.status='cancelled';terminate(j.child)};return reply(res,200,snapshot(j));
  }
  if(req.method==='GET'||req.method==='HEAD')return await staticFile(path,req,res);
  reply(res,405,{error:'Method not allowed'});
 }catch(error){reply(res,error.status??400,{error:error.message})}
});
server.listen(port,'127.0.0.1',()=>console.log(`SquishBots editor: http://127.0.0.1:${server.address().port}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const j of jobs.values())terminate(j.child);server.close(()=>process.exit());setTimeout(()=>process.exit(),2000).unref()});
