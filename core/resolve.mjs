import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { _layout, _marks, blobatar } from './vendor/blobatar/blobatar.ts';
import * as expressions from './vendor/blobatar/expression.ts';
import { motionSeeds } from './vendor/blobatar/animate.ts';
import { traits } from './vendor/blobatar/traits.ts';
export const SOURCE = {version:'2.7.0', commit:'ebb7ea4808b1263629fc8fa65e2398b9cbdb6f6b'};
export const MATERIAL_DEFAULTS = {
 resin:{preset:'resin',roughness:.22,textureScale:24,textureStrength:0},
 clay:{preset:'clay',roughness:.78,textureScale:35,textureStrength:.045},
 fur:{preset:'fur',roughness:.75,textureScale:30,textureStrength:.1,furLength:.22,furDensity:28000},
 glass:{preset:'glass',roughness:.06,textureScale:24,textureStrength:0}
};
export const MATERIAL_PRESETS = Object.keys(MATERIAL_DEFAULTS);
export const EXPRESSION_NAMES = ['idle','happy','sad','mad','surprised','wink','sleepy','smug','unsure','scared','love','shy','sick','thinking'];
export const SHAPES = {round:.11,organic:.35,boxy:.54,capsule:.65,nub:.745,cloud:.825,droplet:.888,hexagon:.933,ghost:.96,monster:.978,triangle:.995,claude:.997,codex:.999};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v);
function assert(ok, message) {if(!ok) throw new TypeError(message)}
export function validateConfig(input) {
 assert(object(input),'Config must be an object');
 assert(typeof input.seed==='string','seed must be a string');
 assert(input.seed.length<=4096,'seed is too long');
 const c=structuredClone(input), o=c.options??={};
 assert(object(o),'options must be an object');
 if(o.size!==undefined)assert(Number.isInteger(o.size)&&o.size>0&&o.size<=4096,'size must be an integer 1..4096');
 if(o.title!==undefined)assert(typeof o.title==='string'&&o.title.length<=4096,'title must be a string up to 4096 characters');
 if(o.animate!==undefined)assert(['hover','always'].includes(o.animate),'animate must be hover or always');
 if(o.traits!==undefined) {assert(object(o.traits),'traits must be an object');for(const [k,v] of Object.entries(o.traits)) assert(finite(v)||(Array.isArray(v)&&v.length<=256&&v.every(finite)),`Invalid trait ${k}`)}
 for(const k of ['hue','tone'])if(o[k]!==undefined)assert(finite(o[k]),`${k} must be finite`);
 for(const k of ['normalize','contrast'])if(o[k]!==undefined)assert(typeof o[k]==='boolean',`${k} must be boolean`);
 // Migrate legacy backdrop settings; the editor no longer supports plates.
 if(o.background!==undefined)o.background=false;
 if(o.palette!==undefined){assert(object(o.palette),'palette must be an object');for(const [k,v] of Object.entries(o.palette))assert(['head','eye','bg'].includes(k)&&typeof v==='string'&&/^#[\da-f]{6}$/i.test(v),'Palette colors must be six-digit hex for Blender')}
 if(o.expression!==undefined)assert(EXPRESSION_NAMES.includes(o.expression),'Unknown expression');
 delete c.status;delete c.badge;
 const m=c.material??={preset:'resin'};assert(object(m),'material must be an object');
 assert(MATERIAL_PRESETS.includes(m.preset),'Unknown material preset');
 const bounds={roughness:[0,1],textureScale:[.1,100],textureStrength:[0,1],furLength:[.001,.3],furDensity:[100,50000]};
 for(const [key,value] of Object.entries(m)){
  if(key==='preset')continue;
  assert(Object.hasOwn(bounds,key),`Unknown material property ${key}`);
  const [min,max]=bounds[key];assert(finite(value)&&value>=min&&value<=max,`${key} must be ${min}..${max}`);
  if(key==='furDensity')assert(Number.isInteger(value),'furDensity must be an integer');
 }
 c.material={...MATERIAL_DEFAULTS[m.preset],...m};
 const r=c.render??={};assert(object(r),'render must be an object');
 if(r.transparent!==undefined)assert(typeof r.transparent==='boolean','transparent must be boolean');
 if(r.resolution!==undefined)assert(Number.isInteger(r.resolution)&&r.resolution>=64&&r.resolution<=4096,'resolution must be 64..4096');
 if(r.samples!==undefined)assert(Number.isInteger(r.samples)&&r.samples>=1&&r.samples<=4096,'samples must be 1..4096');
 if(r.depth!==undefined)assert(finite(r.depth)&&r.depth>0&&r.depth<=2,'Invalid depth');
 if(r.roughness!==undefined){
  assert(finite(r.roughness)&&r.roughness>=0&&r.roughness<=1,'Invalid roughness');
  if(!Object.hasOwn(input.material??{},'roughness'))c.material.roughness=r.roughness;
 }
 return c;
}
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export function shuffleConfig(config, seed=randomBytes(12).toString('hex')) {return validateConfig({...config,seed})}
// Upstream palettes already select eye polarity for seeded tones. A custom
// head bypasses that palette construction, so adapt only that override case.
// Keep the automatic eye out of the saved config: changing the head must remain
// automatic until the user explicitly picks an eye color.
// SquishBots happy face keeps open eyes and adds raised brows outside source marks.
const happyExpression={...expressions.happy,p:{...expressions.happy.p,esx:.95,esy:.85,esx2:0,esy2:0,tilt:0,tilt2:0}};
function expressionBrows(layout,expression){
 return layout.eyes.map((eye,i)=>{const side=i?1:-1,w=Math.max(2.8,eye.rx*1.15),x=eye.cx,y=eye.cy-eye.ry-(expression==='wink'&&!i?5:4),arch=expression==='wink'?(i?1.8:4):3;
 const left=y-side*.7,right=y+side*.7;
 return {kind:'path',fill:layout.palette.eye,d:`M ${x-w} ${left} Q ${x} ${y-arch} ${x+w} ${right} Q ${x+w+.5} ${right+1.2} ${x+w-.5} ${right+1.4} Q ${x} ${y-arch+2.3} ${x-w+.5} ${left+1.4} Q ${x-w-.5} ${left+1.2} ${x-w} ${left} Z`};
 });
}
function renderOptions(config) {
 const options=config.options;
 let palette=options.palette;
 if(palette?.head && palette.eye===undefined){
  const luminance=hex=>{
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
   return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  const head=luminance(palette.head),softWhite='#f5f5f2',dark='#111318';
  const contrast=hex=>{const eye=luminance(hex);return (Math.max(head,eye)+.05)/(Math.min(head,eye)+.05)};
  palette={...palette,eye:contrast(softWhite)>contrast(dark)?softWhite:dark};
 }
 if(!options.palette?.eye&&_layout(config.seed,{...options,expression:expressions.idle}).shape==='codex')palette={...palette,eye:'#a7f4ff'};
 return {...options,...(palette?{palette}:{}),expression:options.expression==='happy'?happyExpression:expressions[options.expression??'idle']};
}
function screenPath(b){const x=b.cx-b.rx*.62,y=b.cy-b.ry*.48,w=b.rx*1.24,h=b.ry*.78,r=b.rx*.16;return `M ${x+r} ${y} L ${x+w-r} ${y} Q ${x+w} ${y} ${x+w} ${y+r} L ${x+w} ${y+h-r} Q ${x+w} ${y+h} ${x+w-r} ${y+h} L ${x+r} ${y+h} Q ${x} ${y+h} ${x} ${y+h-r} L ${x} ${y+r} Q ${x} ${y} ${x+r} ${y} Z`}
export function resolveConfig(input) {
 const config=validateConfig(input), opts=renderOptions(config);
 const layout=_layout(config.seed,opts), {marks,transform,bg}=_marks(config.seed,opts);
 const body=marks.slice(0,-2), eyes=marks.slice(-2);
 const baseOpts={...opts,expression:expressions.idle};
 const baseLayout=_layout(config.seed,baseOpts),baseMarks=_marks(config.seed,baseOpts).marks;
 const motion={reactionPoses:{press:expressions.happy.p,drag:expressions.surprised.p,edge:expressions.scared.p},seeds:motionSeeds(traits(config.seed,opts.normalize??true,opts.traits)),pose:opts.expression.p,baseLayout,baseMarks,baseColors:{head:baseLayout.palette.head,eye:baseLayout.palette.eye,bg:baseLayout.palette.bg}};
 return {schemaVersion:1,source:SOURCE,name:config.seed,seed:config.seed,config,
  configHash:createHash('sha256').update(canonical({source:SOURCE,config})).digest('hex'),
  shape:layout.shape, marks, transform, bg, layout, motion,
  brows:['happy','wink'].includes(config.options.expression)?expressionBrows(layout,config.options.expression):[],
  facePlate:layout.shape==='codex'?{kind:'path',fill:'#102137',d:screenPath(layout.body)}:null,
  bodyPaths:body.filter(m=>m.kind==='path').map(m=>m.d),
  bodyCircles:body.filter(m=>m.kind==='circle'), eyes,
  colors:{head:layout.palette.head,eye:layout.palette.eye,bg:layout.palette.bg},
  material:config.material,render:{...config.render,depth:config.render.depth??(layout.shape==='claude'?.40:.95*Math.min(layout.body.rx,layout.body.ry)/32)}};
}
export function referenceSvg(config){const c=validateConfig(config);return blobatar(c.seed,renderOptions(c))}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output,svg]=process.argv.slice(2);if(!input)throw new Error('Usage: node core/resolve.mjs config.json [resolved.json] [reference.svg]');
 const config=JSON.parse(readFileSync(input,'utf8'));const result=JSON.stringify(resolveConfig(config),null,2)+'\n';
 if(output)writeFileSync(output,result);else process.stdout.write(result);if(svg)writeFileSync(svg,referenceSvg(config));
}
