import {useEffect,useRef,useState} from 'react';

const clips=import.meta.glob('./assets/audio/*.wav',{eager:true,query:'?url',import:'default'});
const urls=Object.fromEntries(Object.entries(clips).map(([path,url])=>[path.split('/').at(-1).replace('.wav',''),url]));
export function useAvatarAudio(){
 const [muted,setMuted]=useState(()=>{try{return localStorage.getItem('squish-muted')==='true'}catch{return false}});
 const state=useRef({context:null,source:null,buffers:new Map(),sequence:0,muted});
 const stop=()=>{const s=state.current;s.sequence++;try{s.source?.stop()}catch{}s.source=null};
 const unlock=()=>{const s=state.current;if(s.muted)return;try{const AudioContext=window.AudioContext||window.webkitAudioContext;s.context??=new AudioContext();if(s.context.state==='suspended')void s.context.resume().catch(()=>{})}catch{}};
 const play=async(shape,emotion)=>{
  const s=state.current,url=urls[`${shape}-${emotion}`];
  stop();if(s.muted||document.hidden||!url)return;
  unlock();if(!s.context)return;const sequence=s.sequence;
  try{
   let buffer=s.buffers.get(url);
   if(!buffer){const response=await fetch(url);if(!response.ok)return;buffer=await s.context.decodeAudioData(await response.arrayBuffer());s.buffers.set(url,buffer)}
   if(s.sequence!==sequence||s.muted||document.hidden||s.context.state!=='running')return;
   const source=s.context.createBufferSource(),gain=s.context.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(s.context.destination);s.source=source;
   source.onended=()=>{source.disconnect();gain.disconnect();if(s.source===source)s.source=null};source.start();
  }catch{/* Audio failure must not interrupt the editor. */}
 };
 const toggle=()=>{const next=!state.current.muted;state.current.muted=next;stop();setMuted(next);try{localStorage.setItem('squish-muted',String(next))}catch{}if(!next)unlock()};
 useEffect(()=>{const onHidden=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',onHidden);return()=>{document.removeEventListener('visibilitychange',onHidden);stop();void state.current.context?.close().catch(()=>{});state.current.context=null}},[]);
 return {muted,toggle,play,unlock,stop};
}
