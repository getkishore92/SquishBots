"""Inflate the pinned Blobatar SVG geometry into deterministic glossy Blender meshes.
Run: blender -b --python renderer/render.py -- scene.json output.png [--studio]
No Python packages beyond Blender are required.
"""
import bpy, sys, json, math, re, hashlib, os, random, bisect
from mathutils import Vector
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry_checks import assert_star_union

TAU=2*math.pi

def path_points(d, steps=24):
    tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',d)
    out=[]; i=0; cmd=None; p=(0,0); start=p
    def take(n):
        nonlocal i
        r=list(map(float,tokens[i:i+n])); i+=n; return r
    while i<len(tokens):
        if tokens[i].isalpha(): cmd=tokens[i];i+=1
        if cmd=='M': p=tuple(take(2));start=p;out.append(p);cmd='L'
        elif cmd=='L': p=tuple(take(2));out.append(p)
        elif cmd=='H': p=(take(1)[0],p[1]);out.append(p)
        elif cmd=='V': p=(p[0],take(1)[0]);out.append(p)
        elif cmd in ('C','Q'):
            old=p; v=take(6 if cmd=='C' else 4);end=tuple(v[-2:])
            for j in range(1,steps+1):
                t=j/steps;u=1-t
                if cmd=='C': q=tuple(u**3*old[k]+3*u*u*t*v[k]+3*u*t*t*v[k+2]+t**3*end[k] for k in (0,1))
                else:q=tuple(u*u*old[k]+2*u*t*v[k]+t*t*end[k] for k in (0,1))
                out.append(q)
            p=end
        elif cmd=='Z':p=start;cmd=None
        else: raise ValueError('Unsupported SVG path command '+str(cmd))
    if len(out)>1 and math.dist(out[0],out[-1])<1e-8:out.pop()
    return out

def contours(scene):
    if 'marks' in scene:
        body=scene['marks'][:-2]; eyes=scene['marks'][-2:]
    else:
        body=[{'kind':'path','d':d} for d in scene['bodyPaths']]+[dict(c,kind='circle') for c in scene.get('circles',scene.get('bodyCircles',[]))]
        eyes=scene['eyes']
    polys=[]
    for m in body:
        if m.get('kind')=='circle':p=[(m['cx']+m['r']*math.cos(TAU*i/192),m['cy']+m['r']*math.sin(TAU*i/192)) for i in range(192)]
        else:p=path_points(m.get('d',m.get('path','')))
        polys.append(p)
    return polys, eyes

def radial(poly,cx,cy,angle):
    dx=math.cos(angle);dz=math.sin(angle);hits=[]
    for p,q in zip(poly,poly[1:]+poly[:1]):
        ax=p[0]-cx;az=cy-p[1]; bx=q[0]-cx;bz=cy-q[1];ex=bx-ax;ez=bz-az
        den=dx*ez-dz*ex
        if abs(den)<1e-10:continue
        t=(ax*ez-az*ex)/den;u=(ax*dz-az*dx)/den
        if t>=0 and -1e-8<=u<=1+1e-8:hits.append(t)
    return max(hits,default=0)/32

def material(name,color,roughness=.22):
    if color.startswith('#'):
        h=color.lstrip('#');h=''.join(c*2 for c in h) if len(h)==3 else h
        rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    else:rgb=[.2,.6,.7]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    mat=bpy.data.materials.new(name);mat.use_nodes=True;n=mat.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value=(*rgb,1);n.inputs['Roughness'].default_value=roughness
    n.inputs['IOR'].default_value=1.47;n.inputs['Coat Weight'].default_value=.32;n.inputs['Coat Roughness'].default_value=.14
    return mat

def finish_material(mat, opts):
    preset=opts.get('preset','resin');node=mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Roughness'].default_value=opts.get('roughness',.22 if preset=='resin' else .78)
    finishes={
        'resin':{'Coat Weight':.32},'clay':{'Sheen Weight':.05},'fur':{'Sheen Weight':.28},
        'glass':{'Transmission Weight':1.,'IOR':1.45,'Coat Weight':.08}}
    node.inputs['Coat Weight'].default_value=0
    for key,value in finishes.get(preset,{}).items():node.inputs[key].default_value=value
    strength=opts.get('textureStrength',0 if preset=='resin' else .045)
    if strength:
        texture=mat.node_tree.nodes.new('ShaderNodeTexNoise');texture.inputs['Scale'].default_value=opts.get('textureScale',35);texture.inputs['Detail'].default_value=3
        bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.015
        mat.node_tree.links.new(texture.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],node.inputs['Normal'])
    return mat

def strand_hits_eyes(points, boxes):
    """Clip projected strand segments against the clear eye regions."""
    for a,b in zip(points,points[1:]):
        if min(a.y,b.y)>=0:continue
        for x0,x1,z0,z1 in boxes:
            lo,hi=0.,1.
            for start,delta,lower,upper in ((a.x,b.x-a.x,x0,x1),(a.z,b.z-a.z,z0,z1)):
                if abs(delta)<1e-10:
                    if start<lower or start>upper:lo,hi=1.,0.;break
                else:
                    t0,t1=(lower-start)/delta,(upper-start)/delta
                    lo=max(lo,min(t0,t1));hi=min(hi,max(t0,t1))
            if lo<=hi:return True
    return False

def eye_fur_mesh(eye,mat,opts,index):
    """A restrained felt pile follows the existing eye mesh; no pill deformation."""
    rng=random.Random(7301+index);me=eye.data;me.calc_loop_triangles();triangles=list(me.loop_triangles);areas=[];total=0.
    for tri in triangles:total+=tri.area;areas.append(total)
    count=max(180,min(1100,int(total*opts.get('furDensity',12000)*.45)))
    length=min(.014,opts.get('furLength',.075)*.16)
    curve=bpy.data.curves.new('Eye short pile '+str(index),'CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.00075;curve.bevel_resolution=1
    for _ in range(count):
        tri=triangles[bisect.bisect_left(areas,rng.random()*total)];vs=[me.vertices[k] for k in tri.vertices];a=math.sqrt(rng.random());b=rng.random();weights=(1-a,a*(1-b),a*b)
        p=sum((v.co*w for v,w in zip(vs,weights)),Vector());n=sum((v.normal*w for v,w in zip(vs,weights)),Vector()).normalized()
        if n.y>0:n=-n
        # Keep fibers predominantly toward the viewer so the projected pill
        # remains legible even at its thin sides and under a closed-eye pose.
        n=Vector((n.x*.10,-max(.3,abs(n.y)),n.z*.10)).normalized();h=length*rng.uniform(.6,1.)
        spline=curve.splines.new('POLY');spline.points.add(2)
        for j in range(3):
            t=j/2;q=p+n*h*t;
            spline.points[j].co=(*q,1);spline.points[j].radius=(1-t)*.65+.02
    ob=bpy.data.objects.new('Eye felt pile '+str(index),curve);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
    return ob

def fur_mesh(body,eyes,cx,cy,mat,opts):
    rng=random.Random(0);me=body.data;me.calc_loop_triangles();triangles=list(me.loop_triangles);areas=[];total=0
    for tri in triangles:total+=tri.area;areas.append(total)
    count=int(opts.get('furDensity',12000));length=opts.get('furLength',.075)
    curve=bpy.data.curves.new('Deterministic fine fur','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.0022;curve.bevel_resolution=0;curve.resolution_u=1
    boxes=[]
    for eye in eyes:
        p=path_points(eye.get('d',eye.get('path','')));xs=[(x-cx)/32 for x,z in p];zs=[(cy-z)/32 for x,z in p];boxes.append((min(xs)-.035,max(xs)+.035,min(zs)-.035,max(zs)+.035))
    for i in range(count):
        tri=triangles[bisect.bisect_left(areas,rng.random()*total)];vs=[me.vertices[k] for k in tri.vertices];a=math.sqrt(rng.random());b=rng.random();weights=(1-a,a*(1-b),a*b)
        p=sum((v.co*w for v,w in zip(vs,weights)),Vector());n=sum((v.normal*w for v,w in zip(vs,weights)),Vector()).normalized()
        if p.y<0 and any(x0<p.x<x1 and z0<p.z<z1 for x0,x1,z0,z1 in boxes):continue
        tangent=n.cross(Vector((rng.random(),rng.random(),rng.random()))).normalized();h=length*rng.uniform(.65,1.2);bend=rng.uniform(-.4,.4)*h
        points=[p+n*h*(j/3)+tangent*bend*(j/3)**2 for j in range(4)]
        if strand_hits_eyes(points,boxes):continue
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for j,q in enumerate(points):
            t=j/(len(points)-1);spline.points[j].co=(*q,1);spline.points[j].radius=(1-t)*.75+.04
    ob=bpy.data.objects.new('Fluffy coat • seeded strands',curve);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
    return ob

def mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    return ob

def inflate(polys,cx,cy,depth,mat):
    n=256;m=80;rs=[max(radial(p,cx,cy,TAU*i/n) for p in polys) for i in range(n)]
    # Latitude rings produce a smooth inflated front and back with the exact sampled silhouette at the equator.
    pole_radius=min(sum(rs)/n,min(rs)*1.30)
    verts=[(0,-depth,0)];faces=[]
    for j in range(1,m):
        lat=math.pi*j/m;s=math.sin(lat);y=-depth*math.cos(lat)
        for i in range(n):
            a=TAU*i/n;r=s*(pole_radius+(rs[i]-pole_radius)*s**3);verts.append((r*math.cos(a),y,r*math.sin(a)))
    back=len(verts);verts.append((0,depth,0))
    for i in range(n):faces.append((0,1+(i+1)%n,1+i))
    for j in range(m-2):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    last=1+(m-2)*n
    for i in range(n):faces.append((back,last+i,last+(i+1)%n))
    ob=mesh('Blobatar • exact upstream silhouette',verts,faces,mat)
    # Correct orientation independent of sampled SVG winding.
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
    return ob,rs

def eye_mesh(mark,cx,cy,rs,depth,mat,index):
    p=path_points(mark.get('d',mark.get('path','')),12);n=len(p)
    ecx=sum(x for x,z in p)/n;ecy=sum(z for x,z in p)/n
    verts=[];faces=[]
    # Raised eye follows the body surface, with a rounded bevel around the exact source outline.
    for layer in range(6):
        a=math.pi*.5*layer/6;s=math.cos(a);bump=.029*math.sin(a)
        for x,z in p:
            x=(ecx+(x-ecx)*s-cx)/32;z=(cy-(ecy+(z-ecy)*s))/32
            angle=math.atan2(z,x)%TAU;k=angle/TAU*len(rs);lo=int(k);r=rs[lo]*(1-k+lo)+rs[(lo+1)%len(rs)]*(k-lo)
            target=math.hypot(x,z);avg=min(sum(rs)/len(rs),min(rs)*1.30);loq=0.;hiq=1.
            for _ in range(20):
                mid=(loq+hiq)/2
                if mid*(avg+(r-avg)*mid**3)<target:loq=mid
                else:hiq=mid
            q=min(.999,(loq+hiq)/2);y=-depth*math.sqrt(max(.001,1-q*q))-.009-bump
            verts.append((x,y,z))
    for j in range(5):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    center=tuple(sum(v[k] for v in verts[-n:])/n for k in range(3));cap=len(verts);verts.append(center)
    for i in range(n):faces.append((5*n+i,5*n+(i+1)%n,cap))
    return mesh('Eye '+str(index),verts,faces,mat)

def light(name,location,power,size,color=(1,1,1),size_y=None):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE' if size_y else 'DISK';data.size=size
    if size_y:data.size_y=size_y
    data.color=color;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=location;ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()

def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=loc);ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    return ob

def accessory(name,color,loc,scale,opts,seed=0,badge=False):
    """Added objects share the body finish while retaining semantic colors."""
    mat=finish_material(material(name+' finish',color),opts)
    ob=sphere(name,loc,scale,mat)
    if opts.get('preset')!='fur':return ob
    rng=random.Random(9107+seed);radius=max(scale);count=max(180,min(1800,int(1000*(radius/.2)**2)))
    length=min(.022,opts.get('furLength',.075)*.24,min(scale)*.25)
    curve=bpy.data.curves.new(name+' short fur','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.0009;curve.bevel_resolution=1
    for _ in range(count):
        z=rng.uniform(-1,1);a=rng.uniform(0,TAU);r=math.sqrt(1-z*z);v=Vector((r*math.cos(a),r*math.sin(a),z))
        # Reserve a clean central face for the badge number. Fur stays on the
        # rim and back, so changing material cannot hide the count.
        if badge and v.y<0 and v.x*v.x+v.z*v.z<.78**2:continue
        p=Vector(tuple(v[i]*scale[i] for i in range(3)));n=Vector(tuple(v[i]/scale[i] for i in range(3))).normalized();h=length*rng.uniform(.6,1.)
        spline=curve.splines.new('POLY');spline.points.add(2)
        for j in range(3):
            t=j/2;q=p+n*h*t;
            spline.points[j].co=(*q,1);spline.points[j].radius=(1-t)*.65+.025
    fur=bpy.data.objects.new('Accessory pile • '+name,curve);bpy.context.collection.objects.link(fur);fur.location=loc;fur.data.materials.append(mat)
    return ob

def main():
    args=sys.argv[sys.argv.index('--')+1:];src=Path(args[0]);out=Path(args[1]);scene=json.loads(src.read_text());opts=scene.get('render',scene.get('config',{}).get('render',{}));studio='--studio' in args;transparent=opts.get('transparent',True) and not studio
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    polys,eyes=contours(scene);layout=scene.get('layout',{});body=layout.get('body',scene.get('body',{}));cx=body.get('cx',50);cy=body.get('cy',50)
    composite=False
    try:assert_star_union(polys,cx,cy)
    except ValueError:composite=True
    colors=scene.get('colors',{});head=scene.get('marks',[{}])[0].get('fill',colors.get('head','#36cfd9'));eye=eyes[0].get('fill',colors.get('eye','#091819'))
    depth=float(opts.get('depth',.95*min(body.get('rx',32),body.get('ry',32))/32));rough=float(opts.get('roughness',.22));mopts=scene.get('material',scene.get('config',{}).get('material',{}));mat=finish_material(material('Body • '+mopts.get('preset','resin'),head,rough),mopts);ob,rs=inflate(polys[-1:] if composite else polys,cx,cy,depth,mat)
    if composite:
        for p in polys[:-1]:
            px=sum(x for x,y in p)/len(p);py=sum(y for x,y in p)/len(p)
            pd=min(depth,.95*min(max(x for x,y in p)-min(x for x,y in p),max(y for x,y in p)-min(y for x,y in p))/64)
            part,_=inflate([p],px,py,pd,mat)
            if mopts.get('preset')=='fur':fur_mesh(part,[],px,py,mat,mopts)
            part.location.x+=(px-cx)/32;part.location.z+=(cy-py)/32
    if mopts.get('preset')=='fur':fur_mesh(ob,eyes,cx,cy,mat,mopts)
    emat=finish_material(material('Eyes • '+mopts.get('preset','resin'),eye,rough),mopts)
    for i,e in enumerate(eyes):
        eye_ob=eye_mesh(e,cx,cy,rs,depth,emat,i)
        if mopts.get('preset')=='fur':eye_fur_mesh(eye_ob,emat,mopts,i)
    # Preserve source canvas placement and baked expression body wrapper translation.
    wrap=scene.get('transform','');dy=0
    match=re.search(r'translate\(\s*0[ ,]+([-\d.]+)\s*\)',wrap)
    if match:dy=float(match.group(1))
    for ob in list(bpy.context.scene.objects):ob.location.x+=(cx-50)/32;ob.location.z+=(50-cy-dy)/32
    bg=scene.get('bg')
    if bg:
        points=path_points(bg['d']);mesh('Source background plate',[((x-50)/32,depth+.12,(50-z)/32) for x,z in points],[tuple(range(len(points)))],material('Background plate',bg['fill'],.78))
    status=scene.get('status',scene.get('config',{}).get('status','none'))
    if status in ('online','away','offline','busy'):
        accessory('Status • '+status,{'online':'#31efa9','away':'#ffb900','offline':'#787884','busy':'#fb676b'}[status],(.82,-.30,.89),(.20,.20,.20),mopts,1)
    if status=='thinking':
        for i in range(3):accessory('Thinking dot '+str(i),'#88889a',(-.24+i*.24,-.32,-1.15),(.075,.075,.075),mopts,10+i)
    badge=scene.get('badge',scene.get('config',{}).get('badge',0))
    if badge:
        accessory('Unread badge','#ffffff',(.80,-.84,-.67),(.31,.085,.31),mopts,20,badge=True)
        cv=bpy.data.curves.new('Unread count','FONT');cv.body='99+' if int(badge)>99 else str(badge);cv.align_x='CENTER';cv.align_y='CENTER';cv.size=.24 if int(badge)>99 else .30;cv.extrude=.014;cv.bevel_depth=.0018;cv.bevel_resolution=3;cv.resolution_u=12
        text=bpy.data.objects.new('Unread count',cv);bpy.context.collection.objects.link(text);text.location=(.80,-.942,-.67);text.rotation_euler=(math.pi/2,0,0);text.data.materials.append(finish_material(material('Readable badge ink','#111318'),{'preset':'clay','roughness':.65,'textureStrength':0}))
    light('Key • broad softbox',(-3,-4,4),420,3.0,size_y=4.0);light('Cool edge',(3,.5,3),520,2.5,(.77,.86,1));light('Front fill',(2,-4,.1),95,3,(1,.9,.82));light('Top strip',(-1,1,3),230,2,size_y=.8)
    world=bpy.data.worlds.new('Studio ambience');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.16,.20,1);world.node_tree.nodes['Background'].inputs[1].default_value=.32
    if studio:
        bottom=min((cy-y)/32+(50-cy-dy)/32 for p in polys for x,y in p)
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,bottom-.015));floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('Charcoal cyclorama','#191b20',.28))
    sc=bpy.context.scene;camera=bpy.data.cameras.new('Orthographic portrait');cam=bpy.data.objects.new('Orthographic portrait',camera);bpy.context.collection.objects.link(cam);cam.location=(0,-8,0) if not studio else (0,-14,2);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=3.125;sc.camera=cam
    sc.render.engine='CYCLES';sc.cycles.samples=int(opts.get('samples',64));sc.cycles.use_denoising=True;sc.cycles.seed=0;sc.cycles.use_animated_seed=False
    sc.render.resolution_x=sc.render.resolution_y=int(opts.get('resolution',768));sc.render.resolution_percentage=100;sc.render.film_transparent=transparent;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA';sc.render.image_settings.color_depth='8';sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast';sc.render.filepath=str(out.resolve());out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend').resolve()));bpy.ops.render.render(write_still=True)
    metadata={'blenderVersion':bpy.app.version_string,'engine':sc.render.engine,'samples':sc.cycles.samples,'renderSeed':0,'configSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceConfig':src.name,'resolution':[sc.render.resolution_x,sc.render.resolution_y],'transparent':transparent,'shape':scene.get('shape'),'projection':'orthographic','material':mopts,'eyeFinish':{'inheritsMaterial':True,'preset':mopts.get('preset','resin'),'pileStrands':sum(len(o.data.splines) for o in bpy.context.scene.objects if o.name.startswith('Eye felt pile'))},'accessoryFinish':{'inheritsMaterial':True,'pileStrands':sum(len(o.data.splines) for o in bpy.context.scene.objects if o.name.startswith('Accessory pile'))},'sourceGeometry':'pinned Blobatar SVG paths sampled and radially inflated','argv':args}
    out.with_suffix('.metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')

if __name__=='__main__':main()
