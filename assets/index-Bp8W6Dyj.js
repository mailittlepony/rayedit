(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const _ of s.addedNodes)_.tagName==="LINK"&&_.rel==="modulepreload"&&n(_)}).observe(document,{childList:!0,subtree:!0});function e(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=e(r);fetch(r.href,s)}})();const E=`struct Globals {
    resolution: vec2<f32>,
    _pad0: vec2<f32>,
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

`;async function T(i){if(!navigator.gpu)throw Error("WebGPU not supported.");const t=await navigator.gpu.requestAdapter();if(!t)throw Error("Couldn't request WebGPU adapter.");const e=await t.requestDevice(),n=i.getContext("webgpu");if(!n)throw Error("Couldn't request WebGPU context.");const r=navigator.gpu.getPreferredCanvasFormat();return n.configure({device:e,format:r,alphaMode:"premultiplied"}),{context:n,device:e,format:r}}let o,x,S,v,g,l,a,u,c={},d=[];const P=48,m={SPHERE:0,CUBOID:1,TORUS:2},p=80;async function A(){const i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}],t=new Float32Array([-1,-1,3,-1,-1,3]);g=o.createBuffer({size:24,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o.queue.writeBuffer(g,0,t,0,t.length),l=o.createBuffer({size:P,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a=o.createBuffer({size:p*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});const e=o.createShaderModule({code:E}),n={vertex:{module:e,entryPoint:"vs_main",buffers:i},fragment:{module:e,entryPoint:"fs_main",targets:[{format:S}]},primitive:{topology:"triangle-list"},layout:"auto"};u=o.createRenderPipeline(n),v=o.createBindGroup({layout:u.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:a}}]})}function O(i){const t=o.createCommandEncoder(),e={colorAttachments:[{loadOp:"clear",storeOp:"store",view:x.getCurrentTexture().createView()}]},n=t.beginRenderPass(e);h({time:i/1e3}),n.setPipeline(u),n.setVertexBuffer(0,g),n.setBindGroup(0,v),n.draw(3),n.end(),o.queue.submit([t.finish()]),requestAnimationFrame(O)}function h(i){for(const e in i){const n=i[e];n!==void 0&&(c[e]=n)}const t=new Float32Array(P/4);t.set(c.resolution??[0,0],0),t.set(c.mouse??[0,0,0],4),t.set([c.time??0,c.deltaTime??0,c.objectCount??0],8),o.queue.writeBuffer(l,0,t.buffer)}function b(i){if(d.length*p>=a.size){const t=o.createBuffer({size:a.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),e=o.createCommandEncoder();e.copyBufferToBuffer(a,0,t,0,a.size),o.queue.submit([e.finish()]),a.destroy(),a=t,v=o.createBindGroup({layout:u.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:a}}]})}i.id=d.length,d.push(i),w(i.id,i),h({objectCount:d.length})}function w(i,t){const e=d[i];if(!e)throw new Error("Object id does not exists");for(const r in t){if(r==="id")continue;const s=t[r];s!==void 0&&(e[r]=s)}e.primitive||(e.primitive=m.SPHERE);const n=new Float32Array(p/4);n.set([e.id,e.primitive],0),n.set(e.position??[0,0,0],4),n.set(e.rotation??[0,0,0],8),n.set(e.scale??[1,1,1],12),n.set(e.color??[1,1,1],16),o.queue.writeBuffer(a,e.id*p,n.buffer)}const B=document.querySelector("#app"),f=document.createElement("canvas");B.appendChild(f);const y=await T(f);o=y.device;x=y.context;S=y.format;await A();requestAnimationFrame(O);b({name:"Maili",primitive:m.TORUS,position:[-1,0,0],scale:[.5,.2,1]});b({name:"Maili",primitive:m.CUBOID,position:[1,0,0],scale:[.5,.2,1]});b({name:"Maili",primitive:m.CUBOID,position:[1,0,-.8],scale:[.5,.8,.1]});w(1,{position:[0,0,0]});function C(){f.width=window.innerWidth,f.height=window.innerHeight,h({resolution:[f.width,f.height]})}C();window.addEventListener("resize",C);
