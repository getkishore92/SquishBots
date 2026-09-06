/** Blobatar 2.7.0 editor vocabulary, transcribed from the pinned upstream axes. */
import { traits } from './vendor/blobatar/traits.ts';
import { validateConfig, EXPRESSION_NAMES, MATERIAL_DEFAULTS, MATERIAL_PRESETS } from './resolve.mjs';

const shapeRows = [['round',.11],['organic',.35],['boxy',.54],['capsule',.65],['nub',.745],['cloud',.825],['droplet',.888],['hexagon',.933],['ghost',.96],['monster',.978],['triangle',.995],['claude',.997],['codex',.999]];
const toneRows = [['pastel',.1],['pale',.28],['mid',.49],['deep',.71],['bright',.865],['ink',.965]];
const choice = ([id,value]) => ({id,label:id,value,name:id,at:value});
const control = (key,label,group,kind='slider',when,bands) => ({key,label,group,kind,...(when?{when}:{}),...(bands?{bands}:{})});
const controls = [
 control('shape','Silhouette','shape','shape'),
 control('body.r','Size','body'),
 control('body.ratio','Proportion','body'),
 control('body.n','Squareness','body'),
 control('body.rot','Tilt','body','slider',['boxy','triangle','hexagon']),
 control('eye.rx','Size','eyes'),
 control('eye.ratio','Roundness','eyes'),
 control('eye.n','Squareness','eyes'),
 control('eye.gap','Separation','eyes'),
 control('eye.lean','Lean','eyes'),
 control('gaze.x','Gaze x','eyes'),
 control('gaze.y','Gaze y','eyes'),
 control('tone','Tone','color','tone'),
 control('hue','Hue','color'),
 control('nub.n','Nubs','decoration','slider',['nub'],2),
 control('nub.a0','Nub angle','decoration','slider',['nub']),
 control('nub.r0','Nub size','decoration','slider',['nub']),
 control('capsule.squat','Squat','body','slider',['capsule']),
 control('poly.round','Corner rounding','body','slider',['triangle','hexagon']),
 control('droplet.tip','Tip length','decoration','slider',['droplet']),
];
const allKeys = [
 'shape','hue','tone','body.r','body.ratio','body.x','body.y','body.n','body.rot','body.pts',
 ...Array.from({length:8},(_,i)=>`body.r${i}`),
 'gaze.x','gaze.y','eye.rx','eye.ratio','eye.scale','eye.stretch','eye.gap','eye.n','eye.lean','eye.lean2','eye.dy',
 'nub.n','nub.a0','nub.a1','nub.r0','nub.r1','poly.round','capsule.squat','droplet.tip',
];
const curated = new Set(controls.map(c=>c.key));
const advancedControls = allKeys.filter(key=>!curated.has(key)).map(key=>{
 let when;
 if(/^body\.(pts|r\d)$/.test(key))when=['organic'];
 if(key.startsWith('nub.'))when=['nub'];
 return control(key,key,'advanced','slider',when,key==='body.pts'?3:undefined);
});
export const CATALOG = {
 sourceVersion:'2.7.0',materialDefaults:MATERIAL_DEFAULTS,materialPresets:MATERIAL_PRESETS,
 shapes:shapeRows.map(choice),tones:toneRows.map(choice),
 groups:['shape','body','eyes','color','decoration'],
 controls,axes:controls,allKeys,traitKeys:allKeys,advancedControls,
 expressions:[...EXPRESSION_NAMES],
 traitPosition:{min:0,max:.999,step:.001},
 statuses:['none','online','away','offline','thinking'],
};

/** Normalized slider readback uses the original independent trait streams. */
export function getTraitValues(input) {
 const config=validateConfig(input),o=config.options;
 const reader=traits(config.seed,o.normalize??true,o.traits);
 const values=Object.fromEntries(allKeys.map(key=>[key,reader(key)]));
 // These two public options override their corresponding traits in upstream.
 // Hue wraps in palette construction; out-of-band tone falls back to pastel.
 if(o.hue!==undefined)values.hue=((o.hue%360)+360)%360/360;
 if(o.tone!==undefined)values.tone=o.tone>=0&&o.tone<1?o.tone:0;
 return values;
}
