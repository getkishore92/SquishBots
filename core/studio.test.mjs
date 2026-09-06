import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIAL_LABELS,shuffleAvatar,makeDefault,EMPTY_LOCKS} from '../frontend/src/studio.js';
import {MATERIAL_DEFAULTS,resolveConfig} from './resolve.mjs';
test('editor material choices match renderer and shuffle preserves locks and pins',()=>{
 assert.deepEqual(Object.keys(MATERIAL_LABELS),Object.keys(MATERIAL_DEFAULTS));
 const config=makeDefault();config.options.traits={'shape':.11,'eye.gap':.7};config.options.palette={head:'#EF4444',eye:'#ffffff'};config.options.expression='happy';
 const locked=shuffleAvatar(config,{material:true,color:true,expression:true},['idle','happy','sad'],MATERIAL_DEFAULTS);
 assert.notEqual(locked.seed,config.seed);assert.deepEqual(locked.material,config.material);assert.deepEqual(locked.options,config.options);assert.deepEqual(locked.render,config.render);
 const shuffled=shuffleAvatar(config,EMPTY_LOCKS,['idle','happy','sad'],MATERIAL_DEFAULTS);
 assert.notEqual(shuffled.material.preset,config.material.preset);assert.notEqual(shuffled.options.palette.head,config.options.palette.head);assert.equal(shuffled.options.palette.eye,'#ffffff');assert.deepEqual(shuffled.options.traits,config.options.traits);assert.deepEqual(shuffled.render,config.render);assert.doesNotThrow(()=>resolveConfig(shuffled));
});

test('legacy presence is removed from both resolved and shuffled avatars',()=>{
 const config={...makeDefault(),status:'thinking',badge:42};
 const resolved=resolveConfig(config);
 assert.equal(resolved.status,undefined);assert.equal(resolved.badge,undefined);
 assert.equal(resolved.config.status,undefined);assert.equal(resolved.config.badge,undefined);
 const shuffled=shuffleAvatar(config,EMPTY_LOCKS,['idle','happy'],MATERIAL_DEFAULTS);
 assert.equal(shuffled.status,undefined);assert.equal(shuffled.badge,undefined);
});
