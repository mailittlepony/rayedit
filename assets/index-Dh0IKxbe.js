(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function n(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=n(r);fetch(r.href,s)}})();const D=`struct Globals {
    resolution : vec2<f32>, 
    _pad0      : vec2<f32>,
    camPos     : vec3<f32>, 
    _pad1      : f32,
    camFwd     : vec3<f32>,
    _pad2      : f32,     
    camRight   : vec3<f32>,
    _pad3      : f32,     
    camUp      : vec3<f32>, 
    _pad4      : f32,
    time       : f32,      
    deltaTime  : f32,     
    objectCount: f32,    
    _pad5      : f32,   
};


struct Object {
    id: f32,
    primitive: f32,
    _pad0: vec2<f32>,

    position: vec3<f32>,
    _pad1: f32,

    rotation: vec3<f32>,
    _pad2: f32,

    scale: vec3<f32>,
    _pad3: f32,

    color: vec3<f32>,
    _pad4: f32,
};

@group(0) @binding(0)
var<uniform> uniforms : Globals;

@group(0) @binding(1)
var<storage, read> objects : array<Object>;

struct VSOut {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec2<f32>) -> VSOut {
    var out: VSOut;
    out.position = vec4<f32>(pos, 0.0, 1.0);
    return out;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = (fragCoord.xy - uniforms.resolution * 0.5) / min(uniforms.resolution.x, uniforms.resolution.y);
    
    // Camera target
    let cam_target = vec3<f32>(0.0, 0.0, 0.0);

    // Distance from camera to target
    let cam_radius = 4.0;

    // Spherical - Cartesian using yaw/pitch
    let cam_pos = uniforms.camPos;
    let cam_forward = uniforms.camFwd;
    let cam_right = uniforms.camRight;
    let cam_up = uniforms.camUp;

    let focal_length = 1.5;
    let rd = normalize(cam_right * uv.x - cam_up * uv.y + cam_forward * focal_length);

    // Ray march
    let result = ray_march(cam_pos, rd);

    if result.x < MAX_DIST {
        // Hit something - calculate lighting
        let hit_pos = cam_pos + rd * result.x;
        let normal = get_normal(hit_pos);

        // Diffuse Lighting
        let light_pos = vec3<f32>(2.0, 5.0, -1.0);
        let light_dir = normalize(light_pos - hit_pos);
        let diffuse = max(dot(normal, light_dir), 0.0);

        // Shadow Casting
        let shadow_origin = hit_pos + normal * 0.01;
        let shadow_result = ray_march(shadow_origin, light_dir);
        let shadow = select(0.3, 1.0, shadow_result.x > length(light_pos - shadow_origin));

        // Phong Shading
        let ambient = 0.2;
        var albedo = get_material_color(result.y, hit_pos);
        let phong = albedo * (ambient + diffuse * shadow * 0.8);

        // Exponential Fog
        let fog = exp(-result.x * 0.02);
        let color = mix(MAT_SKY_COLOR, phong, fog);

        return vec4<f32>(gamma_correct(color), 1.0);
    }

    // Sky gradient
    let sky = mix(MAT_SKY_COLOR, MAT_SKY_COLOR * 0.9, uv.y * 0.5 + 0.5);
    return vec4<f32>(gamma_correct(sky), 1.0);
}

// Gamma Correction
fn gamma_correct(color: vec3<f32>) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / 2.2));
}

// Constants
const MAX_DIST: f32 = 100.0;
const SURF_DIST: f32 = 0.001;
const MAX_STEPS: i32 = 256;

// Material Types
const MAT_PLANE: f32 = 0.0;
const MAT_SPHERE: f32 = 1.0;

// Material Colors
const MAT_SKY_COLOR: vec3<f32> = vec3<f32>(0.7, 0.8, 0.9);
const MAT_PLANE_COLOR: vec3<f32> = vec3<f32>(0.8, 0.8, 0.8);
const MAT_SPHERE_COLOR: vec3<f32> = vec3<f32>(1.0, 0.3, 0.3);

fn get_material_color(mat_id: f32, p: vec3<f32>) -> vec3<f32> {
    if mat_id == MAT_PLANE {
        let checker = floor(p.x) + floor(p.z);
        let col1 = vec3<f32>(0.9, 0.9, 0.9);
        let col2 = vec3<f32>(0.2, 0.2, 0.2);
        return select(col2, col1, i32(checker) % 2 == 0);
    } else if mat_id == MAT_SPHERE {
        return MAT_SPHERE_COLOR;
    }
    return vec3<f32>(0.5, 0.5, 0.5);
}

// SDF Primitives
fn sd_sphere(p: vec3<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sd_box(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sd_torus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

fn sd_plane(p: vec3<f32>, n: vec3<f32>, h: f32) -> f32 {
    return dot(p, n) + h;
}

// SDF Operations
fn op_union(d1: f32, d2: f32) -> f32 {
    return min(d1, d2);
}

fn op_subtract(d1: f32, d2: f32) -> f32 {
    return max(-d1, d2);
}

fn op_intersect(d1: f32, d2: f32) -> f32 {
    return max(d1, d2);
}

fn op_smooth_union(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Scene description - returns (distance, material_id)
fn get_dist(p: vec3<f32>) -> vec2<f32> {
    var res = vec2<f32>(MAX_DIST, -1.0);

  // Ground plane
    let plane_dist = sd_plane(p, vec3<f32>(0.0, 1.0, 0.0), 0.5);
    if plane_dist < res.x {
        res = vec2<f32>(plane_dist, MAT_PLANE);
    }

    for (var i = 0u; i < u32(uniforms.objectCount); i++) {
        var obj_dist = MAX_DIST;
        let primitiveId = u32(objects[i].primitive);
        if primitiveId == 0u {
            obj_dist = sd_sphere(p - objects[i].position, objects[i].scale.x);
        } else if primitiveId == 1u {
            obj_dist = sd_box(p - objects[i].position, objects[i].scale);
        } else if primitiveId == 2u {
            obj_dist = sd_torus(p - objects[i].position, objects[i].scale.xy);
        }
        if obj_dist < res.x {
            res = vec2<f32>(obj_dist, MAT_SPHERE);
        }
    }

    return res;
}

// Ray marching function - returns (distance, material_id)
fn ray_march(ro: vec3<f32>, rd: vec3<f32>) -> vec2<f32> {
    var d = 0.0;
    var mat_id = -1.0;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * d;
        let dist_mat = get_dist(p);
        d += dist_mat.x;
        mat_id = dist_mat.y;

        if dist_mat.x < SURF_DIST || d > MAX_DIST {
      break;
        }
    }

    return vec2<f32>(d, mat_id);
}

// Calculate normal using gradient
fn get_normal(p: vec3<f32>) -> vec3<f32> {
    let e = vec2<f32>(0.001, 0.0);
    let n = vec3<f32>(
        get_dist(p + e.xyy).x - get_dist(p - e.xyy).x,
        get_dist(p + e.yxy).x - get_dist(p - e.yxy).x,
        get_dist(p + e.yyx).x - get_dist(p - e.yyx).x
    );
    return normalize(n);
}

`;var w=typeof Float32Array<"u"?Float32Array:Array;function f(){var t=new w(3);return w!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Y(t){var e=t[0],n=t[1],i=t[2];return Math.sqrt(e*e+n*n+i*i)}function h(t,e,n){var i=new w(3);return i[0]=t,i[1]=e,i[2]=n,i}function C(t,e,n){return t[0]=e[0]+n[0],t[1]=e[1]+n[1],t[2]=e[2]+n[2],t}function v(t,e,n){return t[0]=e[0]-n[0],t[1]=e[1]-n[1],t[2]=e[2]-n[2],t}function z(t,e,n){return t[0]=e[0]*n,t[1]=e[1]*n,t[2]=e[2]*n,t}function m(t,e,n,i){return t[0]=e[0]+n[0]*i,t[1]=e[1]+n[1]*i,t[2]=e[2]+n[2]*i,t}function u(t,e){var n=e[0],i=e[1],r=e[2],s=n*n+i*i+r*r;return s>0&&(s=1/Math.sqrt(s)),t[0]=e[0]*s,t[1]=e[1]*s,t[2]=e[2]*s,t}function _(t,e,n){var i=e[0],r=e[1],s=e[2],o=n[0],a=n[1],l=n[2];return t[0]=r*l-s*a,t[1]=s*o-i*l,t[2]=i*a-r*o,t}(function(){var t=f();return function(e,n,i,r,s,o){var a,l;for(n||(n=3),i||(i=0),r?l=Math.min(r*n+i,e.length):l=e.length,a=i;a<l;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],s(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2];return e}})();const y={SPHERE:0,CUBOID:1,TORUS:2};let B=class O{static OBJECT_GPU_WPAD_SIZE_BYTES=80;name;_id;primitive;position;rotation;scale;color;_device;_objectBuffer;constructor(e){this.name=e.name??String(this.id),this.primitive=e.primitive??y.SPHERE,this.position=e.position??h(0,0,0),this.rotation=e.rotation??h(0,0,0),this.scale=e.scale??h(1,1,1),this.color=e.color??h(1,1,1)}get id(){return this._id}updateObject(){this.primitive||(this.primitive=y.SPHERE);const e=new Float32Array(O.OBJECT_GPU_WPAD_SIZE_BYTES/4);e.set([this._id,this.primitive],0),e.set(this.position??[0,0,0],4),e.set(this.rotation??[0,0,0],8),e.set(this.scale??[1,1,1],12),e.set(this.color??[1,1,1],16),this._device.queue.writeBuffer(this._objectBuffer,this._id*O.OBJECT_GPU_WPAD_SIZE_BYTES,e.buffer)}};class P{static GLOBALS_WPAD_SIZE_BYTES=96;device;context;format;bindGroup;vertexBuffer;globalsBuffer;objectsBuffer;renderPipeline;lastGlobals={};objects=[];constructor(e){this.device=e.device,this.context=e.context,this.format=e.format,this.initPipelineAndBuffers()}getObjectCount(){return this.objects.length}initPipelineAndBuffers(){const{device:e}=this,n=new Float32Array([-1,-1,3,-1,-1,3]);this.vertexBuffer=e.createBuffer({size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.vertexBuffer,0,n);const i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}];this.globalsBuffer=e.createBuffer({size:P.GLOBALS_WPAD_SIZE_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.objectsBuffer=e.createBuffer({size:B.OBJECT_GPU_WPAD_SIZE_BYTES*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const r=e.createShaderModule({code:D});this.renderPipeline=e.createRenderPipeline({vertex:{module:r,entryPoint:"vs_main",buffers:i},fragment:{module:r,entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"},layout:"auto"}),this.bindGroup=e.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}}]})}render(){const e=this.device.createCommandEncoder(),n={colorAttachments:[{loadOp:"clear",storeOp:"store",view:this.context.getCurrentTexture().createView()}]},i=e.beginRenderPass(n);i.setPipeline(this.renderPipeline),i.setVertexBuffer(0,this.vertexBuffer),i.setBindGroup(0,this.bindGroup),i.draw(3),i.end(),this.device.queue.submit([e.finish()])}addObject(e){const n=this.device;if(this.objects.length*B.OBJECT_GPU_WPAD_SIZE_BYTES>=this.objectsBuffer.size){const s=n.createBuffer({size:this.objectsBuffer.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),o=n.createCommandEncoder();o.copyBufferToBuffer(this.objectsBuffer,0,s,0,this.objectsBuffer.size),n.queue.submit([o.finish()]),this.objectsBuffer.destroy(),this.objectsBuffer=s;for(const a of this.objects)a._objectBuffer=this.objectsBuffer;this.bindGroup=n.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}}]})}const i=this.objects.length;this.objects.push(e);const r=e;r._id=i,r._device=this.device,r._objectBuffer=this.objectsBuffer,e.updateObject(),this.updateGlobals({objectCount:this.objects.length})}updateObjectOnGPU(e){const n=this.objects[e];if(!n)throw new Error("Object id does not exist");n.updateObject()}updateGlobals(e){for(const i in e){const r=e[i];r!==void 0&&(this.lastGlobals[i]=r)}const n=new Float32Array(P.GLOBALS_WPAD_SIZE_BYTES/4);n.set(this.lastGlobals.resolution??[0,0],0),n.set(this.lastGlobals.camPos??[0,2,4],4),n.set(this.lastGlobals.camFwd??[0,0,-1],8),n.set(this.lastGlobals.camRight??[1,0,0],12),n.set(this.lastGlobals.camUp??[0,1,0],16),n.set([this.lastGlobals.time??0,this.lastGlobals.deltaTime??0,this.lastGlobals.objectCount??0],20),this.device.queue.writeBuffer(this.globalsBuffer,0,n)}}class I{position=h(0,2,4);target=h(0,0,0);up=h(0,1,0);viewDir=f();forward=f();right=f();upVec=f();constructor(){this.updateMatrices()}updateMatrices(){v(this.forward,this.target,this.position),u(this.forward,this.forward),_(this.right,this.forward,this.up),u(this.right,this.right),_(this.upVec,this.right,this.forward),u(this.upVec,this.upVec)}orbit(e,n,i){const r=i,s=f();v(s,this.position,this.target);const o=e*r,a=Math.cos(o),l=Math.sin(o),A=s[0],G=s[2];s[0]=A*a-G*l,s[2]=A*l+G*a;const L=n*r,E=f();u(E,s);const g=f();_(g,E,this.up),u(g,g);const T=f();_(T,g,E),m(s,s,T,L*5),C(this.position,this.target,s)}pan(e,n,i){const r=i,s=f();v(s,this.target,this.position),u(s,s);const o=f();_(o,s,this.up),u(o,o);const a=h(0,1,0);m(this.position,this.position,o,-e*r),m(this.target,this.target,o,-e*r),m(this.position,this.position,a,n*r),m(this.target,this.target,a,n*r)}zoom(e){const n=e*.01,i=f();v(i,this.position,this.target);let r=Y(i);r<1e-4||(u(i,i),r+=n,r=Math.max(1,Math.min(30,r)),z(i,i,r),C(this.position,this.target,i))}}async function q(t){if(!navigator.gpu)throw Error("WebGPU not supported.");const e=await navigator.gpu.requestAdapter();if(!e)throw Error("Couldn't request WebGPU adapter.");const n=await e.requestDevice(),i=t.getContext("webgpu");if(!i)throw Error("Couldn't request WebGPU context.");const r=navigator.gpu.getPreferredCanvasFormat();return i.configure({device:n,format:r,alphaMode:"premultiplied"}),{context:i,device:n,format:r}}const F=document.querySelector("#app"),c=document.createElement("canvas");F.appendChild(c);const{device:W,context:V,format:X}=await q(c),p=new P({device:W,context:V,format:X}),d=new I;let S=!1,x=!1,b=[0,0];c.addEventListener("mousedown",t=>{const e=c.getBoundingClientRect();b=[t.clientX-e.left,t.clientY-e.top],t.button===0&&(S=!0),t.button===2&&(x=!0),t.button===2&&t.preventDefault()});c.addEventListener("mouseup",t=>{t.button===0&&(S=!1),t.button===2&&(x=!1)});c.addEventListener("mouseleave",()=>{S=!1,x=!1});c.addEventListener("contextmenu",t=>t.preventDefault());c.addEventListener("mousemove",t=>{const e=c.getBoundingClientRect(),n=t.clientX-e.left,i=t.clientY-e.top,r=n-b[0],s=i-b[1];b=[n,i];const o=.005,a=.01;S&&(d.orbit(r,s,o),d.updateMatrices()),x&&(d.pan(r,s,a),d.updateMatrices())});c.addEventListener("wheel",t=>{d.zoom(t.deltaY),d.updateMatrices()},{passive:!1});function U(){c.width=window.innerWidth,c.height=window.innerHeight,p.updateGlobals({resolution:[c.width,c.height]})}U();window.addEventListener("resize",U);const H=new B({name:"Maili",primitive:y.TORUS,position:[-1,0,0],scale:[.5,.2,1]}),j=new B({name:"Maili",primitive:y.CUBOID,position:[1,0,0],scale:[.5,.2,1]});p.addObject(H);p.addObject(j);j.position[0]-=2;j.updateObject();let M=performance.now();function R(t){const e=t/1e3,n=(t-M)/1e3;M=t,p.updateGlobals({resolution:[c.width,c.height],camPos:d.position,camFwd:d.forward,camRight:d.right,camUp:d.upVec,time:e,deltaTime:n,objectCount:p.getObjectCount()}),p.render(),requestAnimationFrame(R)}requestAnimationFrame(R);
