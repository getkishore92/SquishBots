// Same source-path sampling and monotonic radial inflation as renderer/render.py.
export const TAU = Math.PI * 2;
export function pathPoints(d, steps = 20) {
 const tokens=d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];let i=0,cmd,p=[0,0],start=p;const out=[];
 const take=n=>tokens.slice(i,i+=n).map(Number);
 while(i<tokens.length){if(/^[A-Za-z]$/.test(tokens[i]))cmd=tokens[i++];
  if(cmd==='M'){p=take(2);start=p;out.push(p);cmd='L'}
  else if(cmd==='L'){p=take(2);out.push(p)}
  else if(cmd==='H'){p=[take(1)[0],p[1]];out.push(p)}
  else if(cmd==='V'){p=[p[0],take(1)[0]];out.push(p)}
  else if(cmd==='C'||cmd==='Q'){const old=p,v=take(cmd==='C'?6:4),end=v.slice(-2);for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;out.push([0,1].map(k=>cmd==='C'?u**3*old[k]+3*u*u*t*v[k]+3*u*t*t*v[k+2]+t**3*end[k]:u*u*old[k]+2*u*t*v[k]+t*t*end[k]))}p=end}
  else if(cmd==='Z'){p=start;cmd=null}else throw new Error(`Unsupported source path command ${cmd}`);
 }
 if(out.length>1&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<1e-8)out.pop();return out;
}
function polygonContains(p,x,y){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function rayIntervals(poly,cx,cy,angle){const dx=Math.cos(angle),dz=Math.sin(angle),hits=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ax=p[0]-cx,az=cy-p[1],ex=q[0]-p[0],ez=p[1]-q[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-10)continue;const t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>=0&&u>=-1e-8&&u<=1+1e-8)hits.push(t)}
 hits.sort((a,b)=>a-b);const bounds=[0,...hits.filter((t,i)=>!i||t-hits[i-1]>1e-7)],intervals=[];for(let i=0;i<bounds.length-1;i++){const mid=(bounds[i]+bounds[i+1])/2;if(polygonContains(poly,cx+dx*mid,cy-dz*mid))intervals.push([bounds[i],bounds[i+1]])}return intervals;
}
export function resolveGeometry(scene,n=160){
 const polys=scene.marks.slice(0,-2).map(m=>m.kind==='circle'?Array.from({length:160},(_,i)=>[m.cx+m.r*Math.cos(TAU*i/160),m.cy+m.r*Math.sin(TAU*i/160)]):pathPoints(m.d));
 const {cx,cy}=scene.layout.body,depth=scene.render?.depth??(.95*Math.min(scene.layout.body.rx,scene.layout.body.ry)/32);
 function component(ps,x,y,d){const rs=[];for(let i=0;i<n;i++){const intervals=ps.flatMap(p=>rayIntervals(p,x,y,TAU*i/n)).sort((a,b)=>a[0]-b[0]);let reach=0;for(const [a,b]of intervals){if(a>reach+1e-5)return null;reach=Math.max(reach,b)}if(!reach)return null;rs.push(reach/32)}const mean=rs.reduce((a,b)=>a+b,0)/n;return {polys:ps,cx:x,cy:y,rs,pole:Math.min(mean,Math.min(...rs)*1.3),depth:d}}
 const joined=component(polys,cx,cy,depth);if(joined)return joined;
 // Composite source marks may contain genuine gaps. Preserve each mark instead
 // of bridging empty SVG space with an invented radial envelope.
 const ordered=[polys.at(-1),...polys.slice(0,-1)];const parts=ordered.map((p,i)=>{const x=i?p.reduce((v,q)=>v+q[0],0)/p.length:cx,y=i?p.reduce((v,q)=>v+q[1],0)/p.length:cy;const radius=Math.min(Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1])))/64;const g=component([p],x,y,i?Math.min(depth,radius*.95):depth);if(!g)throw new Error('Unsupported non-radial individual source mark');return g});return {...parts[0],polys,parts};
}

export function surfaceDepth(x,y,g){let k=(Math.atan2(y,x)+TAU)%TAU/TAU*g.rs.length,lo=Math.floor(k);const r=g.rs[lo]*(1-k+lo)+g.rs[(lo+1)%g.rs.length]*(k-lo),target=Math.hypot(x,y);let a=0,b=1;for(let i=0;i<20;i++){const mid=(a+b)/2;if(mid*(g.pole+(r-g.pole)*mid**3)<target)a=mid;else b=mid}const q=Math.min(.999,(a+b)/2);return g.depth*Math.sqrt(Math.max(.001,1-q*q));}
export function bodyMeshData(g,m=48){if(g.parts){const vertices=[],indices=[];for(const part of g.parts){const data=bodyMeshData(part,m),offset=vertices.length/3;for(let i=0;i<data.vertices.length;i+=3)vertices.push(data.vertices[i]+(part.cx-g.cx)/32,data.vertices[i+1]+(g.cy-part.cy)/32,data.vertices[i+2]);indices.push(...data.indices.map(i=>i+offset))}return {vertices,indices}}const {rs,pole,depth}=g,n=rs.length,vertices=[0,0,depth],indices=[];
 for(let j=1;j<m;j++){const lat=Math.PI*j/m,s=Math.sin(lat),z=depth*Math.cos(lat);for(let i=0;i<n;i++){const a=TAU*i/n,r=s*(pole+(rs[i]-pole)*s**3);vertices.push(r*Math.cos(a),r*Math.sin(a),z)}}const back=vertices.length/3;vertices.push(0,0,-depth);
 for(let i=0;i<n;i++)indices.push(0,1+i,1+(i+1)%n);
 for(let j=0;j<m-2;j++)for(let i=0;i<n;i++){const a=1+j*n+i,b=1+j*n+(i+1)%n;indices.push(a,a+n,b+n,a,b+n,b)}
 const last=1+(m-2)*n;for(let i=0;i<n;i++)indices.push(back,last+(i+1)%n,last+i);return {vertices,indices};
}
export function eyeMeshData(mark,g){const p=pathPoints(mark.d,12).reverse(),n=p.length,ecx=p.reduce((a,v)=>a+v[0],0)/n,ecy=p.reduce((a,v)=>a+v[1],0)/n,vertices=[],indices=[];
 for(let layer=0;layer<6;layer++){const a=Math.PI*.5*layer/6,s=Math.cos(a),bump=.029*Math.sin(a);for(const [px,py]of p){const x=(ecx+(px-ecx)*s-g.cx)/32,y=(g.cy-(ecy+(py-ecy)*s))/32;vertices.push(x,y,surfaceDepth(x,y,g)+.009+bump)}}
 for(let j=0;j<5;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;indices.push(a,b,b+n,a,b+n,a+n)}const center=[0,1,2].map(k=>{let sum=0;for(let i=0;i<n;i++)sum+=vertices[(5*n+i)*3+k];return sum/n}),cap=vertices.length/3;vertices.push(...center);for(let i=0;i<n;i++)indices.push(5*n+i,5*n+(i+1)%n,cap);return {vertices,indices};
}

// Apply the pinned source's pose, blink, glance and gaze channels in its SVG
// transform order, then lift every eye vertex back onto the 3D body surface.
export function deformEye(base, out, eye, index, g, pose, frame, gaze, face) {
 const side=index?1:-1,sel=index?1:0,lean=eye.rot*Math.PI/180,cl=Math.cos(lean),sl=Math.sin(lean);
 const ph=sel*(1-pose.rock)+pose.rock*((1+side*frame.rockp)/2),theta=((pose.tilt+sel*pose.tilt2)*side+eye.rot*(1-pose.lock))*Math.PI/180,ct=Math.cos(theta),st=Math.sin(theta);
 const turn=(frame.wrap.rot*side+gaze.t)*Math.PI/180,cw=Math.cos(turn),sw=Math.sin(turn),sx=(1+frame.wrap.mx+frame.wrap.side*side)*gaze.sx,sy=(1+frame.wrap.sy)*gaze.sy;
 const centerX=eye.cx+pose.edx*side+gaze.dx*face.rx+frame.saccade[0],centerY=eye.cy+pose.edy+ph*pose.edy2+gaze.dy*face.ry+frame.saccade[1];
 for(let i=0;i<base.length;i+=3){const bx=base[i],by=base[i+1],relief=base[i+2]-surfaceDepth(bx,by,g);let x=bx*32+g.cx-eye.cx,y=g.cy-by*32-eye.cy;
  let u=cl*x+sl*y,v=(-sl*x+cl*y)*frame.blink;x=(cl*u-sl*v)*sx;y=(sl*u+cl*v)*sy;const wx=cw*x-sw*y,wy=sw*x+cw*y;
  u=(cl*wx+sl*wy)*(pose.esx+sel*pose.esx2);v=(-sl*wx+cl*wy)*(pose.esy+sel*pose.esy2);x=(centerX+ct*u-st*v-g.cx)/32;y=(g.cy-centerY-st*u-ct*v)/32;
  out[i]=x;out[i+1]=y;out[i+2]=surfaceDepth(x,y,g)+relief;
 }
}
