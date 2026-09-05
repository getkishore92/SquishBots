import {GIFEncoder,quantize,applyPalette} from 'gifenc';
export const supportsMP4=()=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported('video/mp4');
export async function hostedAnimation(source,format,onProgress){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=format==='gif'?384:768;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const paint=()=>{ctx.fillStyle='#fafafa';ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/source.width,canvas.height/source.height);ctx.drawImage(source,(canvas.width-source.width*scale)/2,(canvas.height-source.height*scale)/2,source.width*scale,source.height*scale)};
 if(format==='gif'){const gif=GIFEncoder();for(let i=0;i<48;i++){onProgress(`Recording GIF… ${Math.round(i/48*100)}%`);paint();const data=ctx.getImageData(0,0,384,384).data,palette=quantize(data,128);gif.writeFrame(applyPalette(data,palette),384,384,{palette,delay:1000/12,repeat:0});await new Promise(r=>setTimeout(r,1000/12))}gif.finish();return new Blob([gif.bytes()],{type:'image/gif'})}
 const mime=format==='mp4'?'video/mp4':'video/webm';if(!MediaRecorder.isTypeSupported(mime))throw new Error(`${format.toUpperCase()} recording is unavailable in this browser.`);
 const stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];let raf;const tick=()=>{paint();raf=requestAnimationFrame(tick)};tick();
 try{return await new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onerror=()=>reject(new Error('Video recording failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));onProgress('Recording 4 seconds…');recorder.start();setTimeout(()=>recorder.stop(),4000)})}finally{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop())}
}
