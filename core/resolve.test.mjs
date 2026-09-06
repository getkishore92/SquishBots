import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveConfig,validateConfig,shuffleConfig,canonical,SHAPES,EXPRESSION_NAMES} from './resolve.mjs';
test('normalization agrees across Unicode and case',()=>{
 const a=resolveConfig({seed:' ÉLISE '}),b=resolveConfig({seed:'e\u0301lise'});
 assert.deepEqual(a.marks,b.marks);
 assert.notDeepEqual(a.marks,resolveConfig({seed:' ÉLISE ',options:{normalize:false}}).marks);
});
test('all eleven supported shapes retain exact eye and body marks',()=>{
 for(const [shape,at] of Object.entries(SHAPES)){
 const r=resolveConfig({seed:'review',options:{traits:{shape:at}}});
 assert.equal(r.shape,shape);assert.equal(r.eyes.length,2);assert.ok(r.bodyPaths.length);assert.ok(r.marks.every(m=>m.kind==='path'?m.d.length>10:Number.isFinite(m.r)));
 }
});
test('shuffle changes seed while preserving sparse pins and narrowing',()=>{
 const c={seed:'old',options:{traits:{shape:[.11,.99],'eye.gap':.7}}};
 const next=shuffleConfig(c,'next');assert.deepEqual(next.options,c.options);assert.equal(next.seed,'next');
 for(let i=0;i<30;i++)assert.ok(['round','triangle'].includes(resolveConfig(shuffleConfig(c,String(i))).shape));
});
test('empty arrays match absent override; upstream clamps preserved',()=>{
 assert.deepEqual(resolveConfig({seed:'test'}).marks,resolveConfig({seed:'test',options:{traits:{shape:[]}}}).marks);
 assert.equal(resolveConfig({seed:'test',options:{traits:{shape:1}}}).shape,'triangle');
});
test('every expression resolves serializable geometry and body transforms',()=>{
 for(const expression of EXPRESSION_NAMES){const r=resolveConfig({seed:'review',options:{expression}});assert.doesNotThrow(()=>JSON.parse(JSON.stringify(r)));assert.equal(r.eyes.length,2)}
 const idle=resolveConfig({seed:'review'}),sad=resolveConfig({seed:'review',options:{expression:'sad'}});assert.notDeepEqual(idle.marks,sad.marks);
});
test('deterministic config hash ignores object insertion order',()=>{
 const a={seed:'a',options:{hue:30,traits:{'eye.gap':.5,shape:.11}}};
 const b={options:{traits:{shape:.11,'eye.gap':.5},hue:30},seed:'a'};
 assert.equal(resolveConfig(a).configHash,resolveConfig(b).configHash);assert.equal(canonical(a),canonical(b));
});
test('rejects invalid render inputs before Blender runs',()=>{
 for(const c of [{seed:1},{seed:'a',options:{traits:{shape:NaN}}},{seed:'a',options:{expression:'invented'}},{seed:'a',render:{resolution:99999}},{seed:'a',options:{palette:{head:'red'}}}])assert.throws(()=>validateConfig(c));
});
test('material variants preserve original avatar geometry and change cache identity',()=>{
 const base={seed:'same-avatar',options:{traits:{shape:.11,'eye.gap':.7}}};
 const variants=['resin','clay','fur'].map(preset=>resolveConfig({...base,material:{preset}}));
 for(const r of variants){assert.deepEqual(r.marks,variants[0].marks);assert.equal(r.config.options.traits['eye.gap'],.7)}
 assert.equal(new Set(variants.map(r=>r.configHash)).size,3);
 assert.equal(resolveConfig(base).material.preset,'resin');
});
test('material validation rejects unknown presets and unsafe texture bounds',()=>{
 for(const material of [{preset:'metal'},{preset:'fur',furDensity:50001},{preset:'fur',furDensity:100.5},{preset:'fur',furLength:-1},{preset:'clay',textureScale:0},{preset:'clay',textureStrength:NaN},{preset:'resin',roughness:1.1},{preset:'resin',script:'x'}])assert.throws(()=>validateConfig({seed:'a',material}));
 assert.doesNotThrow(()=>validateConfig({seed:'a',material:{preset:'fur',furDensity:50000,furLength:.3,roughness:0,textureScale:100,textureStrength:1}}));
});
test('legacy roughness maps to material unless explicitly overridden',()=>{
 assert.equal(resolveConfig({seed:'a',render:{roughness:.4}}).material.roughness,.4);
 assert.equal(resolveConfig({seed:'a',render:{roughness:.4},material:{preset:'clay',roughness:.8}}).material.roughness,.8);
});

test('SVG size attributes reject executable text',()=>{
 assert.throws(()=>resolveConfig({seed:'test',options:{size:'1" onload="alert(1)'}}),/size/);
 assert.throws(()=>resolveConfig({seed:'test',options:{title:{}}}),/title/);
 assert.equal(resolveConfig({seed:'test',options:{size:512}}).config.options.size,512);
});

test('custom dark bodies choose soft white eyes and light bodies choose dark eyes',()=>{
 for(const head of ['#000000','#111318','#183345','#353535']){
  const r=resolveConfig({seed:'auto-eye',options:{palette:{head}}});
  assert.equal(r.colors.eye,'#f5f5f2');assert.equal(r.motion.baseColors.eye,r.colors.eye);
  assert.ok(r.eyes.every(e=>e.fill===r.colors.eye));
  assert.ok(r.motion.baseMarks.slice(-2).every(e=>e.fill===r.colors.eye));
  assert.equal(r.config.options.palette.eye,undefined);
 }
 for(const head of ['#ffffff','#F5D770','#06C5D8'])assert.equal(resolveConfig({seed:'auto-eye',options:{palette:{head}}}).colors.eye,'#111318');
});
test('explicit eye choice survives custom head automatic contrast',()=>{
 const r=resolveConfig({seed:'manual-eye',options:{palette:{head:'#000000',eye:'#aabbcc'}}});
 assert.equal(r.colors.eye,'#aabbcc');assert.equal(r.motion.baseColors.eye,'#aabbcc');assert.equal(r.config.options.palette.eye,'#aabbcc');
});
test('automatic eye colors agree across reference SVG and static motion payloads',async()=>{
 const {referenceSvg}=await import('./resolve.mjs');
 for(const expression of EXPRESSION_NAMES){
  const config={seed:'auto-expression',options:{expression,palette:{head:'#080808'}}};
  const r=resolveConfig(config),svg=referenceSvg(config);
  assert.ok(svg.includes(`fill="${r.colors.eye}"`));
  assert.ok(r.eyes.every(e=>e.fill===r.colors.eye));
  assert.equal(r.motion.baseColors.eye,'#f5f5f2');
 }
});

test('automatic depth follows body cross-section while explicit depth remains exact',()=>{
 for(const at of Object.values(SHAPES)){
  const r=resolveConfig({seed:'full-volume',options:{traits:{shape:at}}});
  assert.equal(r.render.depth,.95*Math.min(r.layout.body.rx,r.layout.body.ry)/32);
  assert.equal(r.config.render.depth,undefined);
  const fixed=resolveConfig({seed:'full-volume',options:{traits:{shape:at}},render:{depth:.42}});
  assert.equal(fixed.render.depth,.42);assert.equal(fixed.config.render.depth,.42);
 }
});

test('all four material presets resolve distinct reproducible finishes without changing geometry',async()=>{
 const {MATERIAL_PRESETS,MATERIAL_DEFAULTS}=await import('./resolve.mjs');
 assert.equal(MATERIAL_PRESETS.length,4);
 const base={seed:'material-roster',options:{traits:{shape:.11},palette:{head:'#38bdc9'}}};
 const hashes=new Set();const baseline=resolveConfig({...base,material:{preset:'resin'}});
 for(const preset of MATERIAL_PRESETS){
  const r=resolveConfig({...base,material:{preset}});assert.deepEqual(r.material,MATERIAL_DEFAULTS[preset]);assert.deepEqual(r.marks,baseline.marks);hashes.add(r.configHash);
  assert.equal(resolveConfig(r.config).configHash,r.configHash);
 }
 assert.equal(hashes.size,4);
 for(const preset of ['glass'])assert.equal(resolveConfig({...base,material:{preset,roughness:.33,textureStrength:.12}}).material.roughness,.33);
 for(const preset of ['jelly','wool','velvet','foam','chrome','ceramic'])assert.throws(()=>resolveConfig({...base,material:{preset}}),/Unknown material/);
});

import {resolveGeometry,bodyMeshData} from '../web/geometry.js';
test('ghost and monster build closed finite surfaces across seeds; automatic shapes exclude sun',()=>{
 assert.equal(Object.keys(SHAPES).length,11);assert.equal(SHAPES.sun,undefined);
 for(let i=0;i<100;i++){
  assert.notEqual(resolveConfig({seed:'auto-'+i}).shape,'sun');
  for(const shape of ['ghost','monster']){const r=resolveConfig({seed:'shape-'+i,options:{traits:{shape:SHAPES[shape]}}});const g=resolveGeometry(r),mesh=bodyMeshData(g,12);assert.equal(r.shape,shape);assert.ok(!g.parts);assert.ok(mesh.vertices.every(Number.isFinite));assert.ok(mesh.indices.every(v=>v>=0&&v<mesh.vertices.length/3));}
 }
});

test('legacy backdrop settings resolve without a background plate',()=>{
 for(const background of [true,'square','circle','squircle']){
  const result=resolveConfig({seed:'legacy',options:{background}});
  assert.equal(result.config.options.background,false);
  assert.ok(!result.bg);
 }
});

test('cloud puff remains a connected mesh across seeded proportions',async()=>{
 const {resolveGeometry,bodyMeshData}=await import('../web/geometry.js');
 for(let i=0;i<20;i++){
  const r=resolveConfig({seed:`cloud-${i}`,options:{traits:{shape:SHAPES.cloud}}});
  assert.equal(r.bodyPaths.length,1);
  assert.equal(r.bodyCircles.length,0);
  const geometry=resolveGeometry(r);
  assert.ok(!geometry.parts);
  assert.ok(bodyMeshData(geometry).vertices.every(Number.isFinite));
 }
});
