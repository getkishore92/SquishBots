import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
let active=false;
export async function convertAnimation(req,format,root){
 if(!['gif','mp4'].includes(format))throw new Error('Choose GIF or MP4.');
 if(active)throw new Error('Another animation is converting. Try again shortly.');
 if(!(req.headers['content-type']??'').startsWith('video/webm'))throw new Error('Send a WebM recording.');
 active=true;
 try{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw new Error('Recording exceeds 32 MB.');chunks.push(chunk)}
  const data=Buffer.concat(chunks);if(data.length<4||data.readUInt32BE(0)!==0x1a45dfa3)throw new Error('Invalid WebM recording.');
  const id=randomUUID(),dir=resolve(root,'renders/animations',id);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'source.webm'),data);
  const filters=format==='gif'?['-filter_complex','fps=15,scale=512:-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0']:['-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart'];
  await new Promise((ok,fail)=>{const child=spawn(process.env.FFMPEG_BIN??'ffmpeg',['-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-i',resolve(dir,'source.webm'),'-t','8','-an',...filters,resolve(dir,'avatar.'+format)],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error=(error+b).slice(-2000));const timeout=setTimeout(()=>child.kill('SIGKILL'),60000);child.on('error',e=>{clearTimeout(timeout);fail(new Error(e.code==='ENOENT'?'Install ffmpeg to export GIF and MP4.':e.message))});child.on('close',code=>{clearTimeout(timeout);code===0?ok():fail(new Error(error||'Animation conversion failed.'))})});
  return {url:`/renders/animations/${id}/avatar.${format}`,format};
 }finally{active=false}
}
