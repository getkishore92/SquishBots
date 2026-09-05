// Records the interactive preview. Blender PNG export remains a separate path.
export async function recordAnimation(source,format,{onProgress=()=>{},duration=4000,background='#f8f8fc'}={}){
 if(!source?.captureStream||!window.MediaRecorder)throw new Error('This browser cannot record video. Try Chrome.');
 const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw new Error('WebM recording is unavailable in this browser.');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const ctx=canvas.getContext('2d');let raf;
 const paint=()=>{ctx.fillStyle=background;ctx.fillRect(0,0,768,768);const scale=Math.min(768/source.width,768/source.height);ctx.drawImage(source,(768-source.width*scale)/2,(768-source.height*scale)/2,source.width*scale,source.height*scale);raf=requestAnimationFrame(paint)};paint();
 const stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:5000000}),chunks=[];
 try{
  onProgress('Recording 4 seconds…');const blob=await new Promise((ok,fail)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=e=>fail(e.error??new Error('Recording failed'));recorder.onstop=()=>ok(new Blob(chunks,{type:'video/webm'}));recorder.start();setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},duration)});
  if(format==='webm')return {blob,extension:'webm'};
  onProgress(`Converting ${format.toUpperCase()}…`);const response=await fetch('/api/animation?format='+format,{method:'POST',headers:{'Content-Type':'video/webm'},body:blob});const result=await response.json();if(!response.ok)throw new Error(result.error??'Conversion failed');const file=await fetch(result.url);if(!file.ok)throw new Error('Download failed');return {blob:await file.blob(),extension:format};
 }finally{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop())}
}
