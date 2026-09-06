import test from 'node:test';
import assert from 'node:assert/strict';
import * as port from '../web/motion.js';
import {idleAt, idleSeeds} from './vendor/blobatar/idle.ts';
import {project,step,pursuit} from './vendor/blobatar/gaze.ts';
import {lerpPose,IDENT} from './vendor/blobatar/morph.ts';
import * as expressions from './vendor/blobatar/expression.ts';
import {_marks} from './vendor/blobatar/blobatar.ts';
import {resolveConfig,EXPRESSION_NAMES} from './resolve.mjs';

test('browser idle frames match upstream across seeds, blink boundaries and amplitudes',()=>{
 for(const name of ['alain00',' 😀 Café ','reaction']){
  const seeds=idleSeeds(name);
  for(const t of [0,123,2800,6500,123456,seeds.blink*.986-seeds.blinkPhase]){
   for(const amp of [0,.3,1])assert.deepEqual(port.idleAt(seeds,t,amp,.6),idleAt(seeds,t,amp,.6));
  }
 }
 const seeds={phase:0,bob:0,blink:5000,blinkPhase:0,saccade:6000,saccadePhase:0,lookX:1.4,lookY:1.1,lookMX:1.4,lookMY:1.1};
 assert.ok(Math.abs(port.idleAt(seeds,4930,1).blink-.08)<1e-10);
 assert.equal(port.idleAt(seeds,4800,1).blink,1);
});

test('browser gaze matches canonical projection and pursuit near the limb',()=>{
 for(const mark of [{x:0,y:0},{x:-.3,y:-.1},{x:.4,y:.2},{x:1.1,y:.4}]){
  for(const yaw of [-1.5,-.4,0,.4,1.5])for(const pitch of [-1,0,1])assert.deepEqual(port.project(mark,yaw,pitch),project(mark,yaw,pitch));
 }
 for(const dx of [-300,0,10,300]){
  const input={x:.1,y:.1,dx,dy:20,radius:100,k:pursuit(16),gain:.8};
  assert.deepEqual(port.step(input),step(input));
 }
 assert.equal(port.pursuit(16),pursuit(16));
});

test('motion contract uses unposed eyes and matches static expression marks',()=>{
 for(const expression of EXPRESSION_NAMES){
  const config={seed:'expression-test',options:{expression,traits:{shape:.99}}};
  const resolved=resolveConfig(config);
  if(expression==='happy'){assert.ok(resolved.motion.pose.esy>.7);assert.equal(resolved.brows.length,2)}else{assert.deepEqual(resolved.motion.pose,expressions[expression].p);if(expression==='wink')assert.equal(resolved.brows.length,2);else assert.deepEqual(resolved.brows,[])}
  assert.deepEqual(resolved.motion.reactionPoses,{press:expressions.happy.p,drag:expressions.surprised.p,edge:expressions.scared.p});
  assert.deepEqual(resolved.motion.seeds,idleSeeds(config.seed,config.options));
  assert.deepEqual(resolved.marks,_marks(config.seed,{...config.options,expression:{...expressions[expression],p:resolved.motion.pose}}).marks);
  assert.deepEqual(resolved.motion.baseMarks,_marks(config.seed,{...config.options,expression:expressions.idle}).marks);
  assert.deepEqual(port.lerpPose(IDENT,expressions[expression].p,.4),lerpPose(IDENT,expressions[expression].p,.4));
 }
});

test('natural blink closes briefly and returns to fully open eyes',()=>{
 assert.equal(port.naturalBlink(-1),1);
 assert.equal(port.naturalBlink(0),1);
 assert.ok(port.naturalBlink(65)<.07);
 assert.ok(port.naturalBlink(120)>port.naturalBlink(65));
 assert.equal(port.naturalBlink(190),1);
 assert.equal(port.naturalBlink(6000),1);
 for(let t=0;t<190;t++)assert.ok(port.naturalBlink(t)>=.05&&port.naturalBlink(t)<=1);
});

test('fur eyes use round geometry with bounded blink and expression scales',async()=>{
 const {furEyeDimensions,eyeOpening}=await import('../web/fur-eyes.js');
 for(const shape of [.11,.997,.999]){
  const resolved=resolveConfig({seed:'fur-test',options:{traits:{shape}}});const {radius}=furEyeDimensions(resolved.motion.baseLayout);
  assert.ok(radius>=.055&&radius<=.21);
 }
 assert.equal(eyeOpening(IDENT,0,1),1);assert.equal(eyeOpening(IDENT,0,0),0);
 assert.ok(eyeOpening(expressions.wink.p,1,1)<eyeOpening(expressions.wink.p,0,1));
});
