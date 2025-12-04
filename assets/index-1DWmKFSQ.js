(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))i(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function n(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(t){if(t.ep)return;t.ep=!0;const o=n(t);fetch(t.href,o)}})();const S=`struct Globals {
    resolution: vec2<f32>,
    mouse: vec3<f32>,
    _pad1: f32,
    time: f32,
    deltaTime: f32,
    objectCount: f32,
}

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

  // Camera Coords
    let cam_target = vec3<f32>(0.0, 0.0, 0.0);
    let cam_pos = vec3<f32>(0.0, 2.0, 4.0);

  // Camera Matrix
    let cam_forward = normalize(cam_target - cam_pos);
    let cam_right = normalize(cross(cam_forward, vec3<f32>(0.0, 1.0, 0.0)));
    let cam_up = cross(cam_right, cam_forward); // Re-orthogonalized up

  // Ray Direction
  // 1.5 is the "focal length" or distance to the projection plane
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

`;var h=typeof Float32Array<"u"?Float32Array:Array;function x(){var r=new h(3);return h!=Float32Array&&(r[0]=0,r[1]=0,r[2]=0),r}function f(r,e,n){var i=new h(3);return i[0]=r,i[1]=e,i[2]=n,i}(function(){var r=x();return function(e,n,i,t,o,a){var s,p;for(n||(n=3),i||(i=0),t?p=Math.min(t*n+i,e.length):p=e.length,s=i;s<p;s+=n)r[0]=e[s],r[1]=e[s+1],r[2]=e[s+2],o(r,r,a),e[s]=r[0],e[s+1]=r[1],e[s+2]=r[2];return e}})();const l={SPHERE:0,CUBOID:1,TORUS:2};let u=class m{static OBJECT_GPU_WPAD_SIZE_BYTES=80;name;_id;primitive;position;rotation;scale;color;_device;_objectBuffer;constructor(e){this.name=e.name??String(this.id),this.primitive=e.primitive??l.SPHERE,this.position=e.position??f(0,0,0),this.rotation=e.rotation??f(0,0,0),this.scale=e.scale??f(1,1,1),this.color=e.color??f(1,1,1)}get id(){return this._id}updateObject(){this.primitive||(this.primitive=l.SPHERE);const e=new Float32Array(m.OBJECT_GPU_WPAD_SIZE_BYTES/4);e.set([this._id,this.primitive],0),e.set(this.position??[0,0,0],4),e.set(this.rotation??[0,0,0],8),e.set(this.scale??[1,1,1],12),e.set(this.color??[1,1,1],16),this._device.queue.writeBuffer(this._objectBuffer,this._id*m.OBJECT_GPU_WPAD_SIZE_BYTES,e.buffer)}};class d{static GLOBALS_WPAD_SIZE_BYTES=48;device;context;format;bindGroup;vertexBuffer;globalsBuffer;objectsBuffer;renderPipeline;lastGlobals={};objects=[];constructor(e){this.device=e.device,this.context=e.context,this.format=e.format,this.initPipelineAndBuffers()}initPipelineAndBuffers(){const{device:e}=this,n=new Float32Array([-1,-1,3,-1,-1,3]);this.vertexBuffer=e.createBuffer({size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.vertexBuffer,0,n);const i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}];this.globalsBuffer=e.createBuffer({size:d.GLOBALS_WPAD_SIZE_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.objectsBuffer=e.createBuffer({size:u.OBJECT_GPU_WPAD_SIZE_BYTES*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const t=e.createShaderModule({code:S});this.renderPipeline=e.createRenderPipeline({vertex:{module:t,entryPoint:"vs_main",buffers:i},fragment:{module:t,entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"},layout:"auto"}),this.bindGroup=e.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}}]})}render(){const e=this.device.createCommandEncoder(),n={colorAttachments:[{loadOp:"clear",storeOp:"store",view:this.context.getCurrentTexture().createView()}]},i=e.beginRenderPass(n);i.setPipeline(this.renderPipeline),i.setVertexBuffer(0,this.vertexBuffer),i.setBindGroup(0,this.bindGroup),i.draw(3),i.end(),this.device.queue.submit([e.finish()])}addObject(e){const n=this.device;if(this.objects.length*u.OBJECT_GPU_WPAD_SIZE_BYTES>=this.objectsBuffer.size){const o=n.createBuffer({size:this.objectsBuffer.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),a=n.createCommandEncoder();a.copyBufferToBuffer(this.objectsBuffer,0,o,0,this.objectsBuffer.size),n.queue.submit([a.finish()]),this.objectsBuffer.destroy(),this.objectsBuffer=o;for(const s of this.objects)s._objectBuffer=this.objectsBuffer;this.bindGroup=n.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}}]})}const i=this.objects.length;this.objects.push(e);const t=e;t._id=i,t._device=this.device,t._objectBuffer=this.objectsBuffer,e.updateObject(),this.updateGlobals({objectCount:this.objects.length})}updateObjectOnGPU(e){const n=this.objects[e];if(!n)throw new Error("Object id does not exist");n.updateObject()}updateGlobals(e){for(const i in e){const t=e[i];t!==void 0&&(this.lastGlobals[i]=t)}const n=new Float32Array(d.GLOBALS_WPAD_SIZE_BYTES/4);n.set(this.lastGlobals.resolution??[0,0],0),n.set(this.lastGlobals.mouse??[0,0,0],4),n.set([this.lastGlobals.time??0,this.lastGlobals.deltaTime??0,this.lastGlobals.objectCount??0],8),this.device.queue.writeBuffer(this.globalsBuffer,0,n)}}async function O(r){if(!navigator.gpu)throw Error("WebGPU not supported.");const e=await navigator.gpu.requestAdapter();if(!e)throw Error("Couldn't request WebGPU adapter.");const n=await e.requestDevice(),i=r.getContext("webgpu");if(!i)throw Error("Couldn't request WebGPU context.");const t=navigator.gpu.getPreferredCanvasFormat();return i.configure({device:n,format:t,alphaMode:"premultiplied"}),{context:i,device:n,format:t}}let g,b,B;const E=document.querySelector("#app"),c=document.createElement("canvas");E.appendChild(c);const v=await O(c);B=v.device;g=v.context;b=v.format;const _=new d({device:B,context:g,format:b});function P(r){_.render(),requestAnimationFrame(P)}requestAnimationFrame(P);let j=new u({name:"Maili",primitive:l.TORUS,position:[-1,0,0],scale:[.5,.2,1]}),A=new u({name:"Maili",primitive:l.CUBOID,position:[1,0,0],scale:[.5,.2,1]});_.addObject(j);_.addObject(A);function y(){c.width=window.innerWidth,c.height=window.innerHeight,_.updateGlobals({resolution:[c.width,c.height]})}y();window.addEventListener("resize",y);
