import * as THREE from 'three';
import {surfaceDepth} from './geometry.js';

export function furEyeDimensions(layout){
 const gap=Math.abs(layout.eyes[1].cx-layout.eyes[0].cx)/32;
 return {radius:Math.max(.055,Math.min(.21,gap*.32,layout.face.ry/32*.6))};
}
export function eyeOpening(pose,index,blink=1){
 return Math.max(.045,Math.min(1,pose.esy+index*pose.esy2))*blink;
}
export function createFurEye(radius,color,coatLength=.22){
 const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshPhysicalMaterial({color:'#101419',roughness:.32,clearcoat:.3,clearcoatRoughness:.25}));group.add(mesh);group.scale.setScalar(radius);
 return {group,mesh,radius,coatLength};
}
export function updateFurEye(item,eye,index,g,pose,frame,gaze){
 const side=index?1:-1,x=(eye.cx+pose.edx*side-g.cx)/32+gaze.dx*.08,y=(g.cy-eye.cy-pose.edy-index*pose.edy2)/32-gaze.dy*.08;
 item.group.position.set(x,y,surfaceDepth(x,y,g)+item.coatLength*.95+.025);
 item.group.rotation.z=-(pose.tilt+index*pose.tilt2)*side*Math.PI/180;
 item.mesh.scale.set(Math.max(.65,Math.min(1.15,pose.esx+index*pose.esx2)),Math.max(.04,eyeOpening(pose,index,frame.blink)),.68);
 return {x,y,radius:item.radius};
}
