(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=n(i);fetch(i.href,r)}})();const A=`struct Globals {
    resolution: vec2<f32>,
    _pad0: vec2<f32>,
    camPos: vec3<f32>,
    _pad1: f32,
    camFwd: vec3<f32>,
    _pad2: f32,
    camRight: vec3<f32>,
    _pad3: f32,
    camUp: vec3<f32>,
    _pad4: f32,
    time: f32,
    deltaTime: f32,
    objectCount: f32,
    _pad5: f32,
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

@group(0) @binding(2)
var<storage, read_write> activeObject: f32;

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

    // Spherical - Cartesian using yaw/pitch
    let cam_pos = uniforms.camPos;
    let cam_forward = uniforms.camFwd;
    let cam_right = uniforms.camRight;
    let cam_up = uniforms.camUp;

    let focal_length = 1.0;
    let rd = normalize(cam_right * uv.x - cam_up * uv.y + cam_forward * focal_length);

    // Ray march
    let result = ray_march(cam_pos, rd);

   // grid overlay 
    var gridColor = vec3<f32>(0.0, 0.0, 0.0);
    var hasGrid = false;

    // Only compute grid if ray is not pointing exactly horizontal
    if abs(rd.y) > 1e-4 {
        let tGrid = (GRID_HEIGHT - cam_pos.y) / rd.y;

        if tGrid > 0.0 {
            if tGrid < result.x {
                let pGrid = cam_pos + rd * tGrid;
                let xz = pGrid.xz;

                if abs(xz.x) <= GRID_EXTENT && abs(xz.y) <= GRID_EXTENT {

                    // Axis lines
                    if abs(xz.x) < GRID_AXIS_WIDTH {
                        gridColor = GRID_AXIS_X_COLOR;
                        hasGrid = true;
                    } else if abs(xz.y) < GRID_AXIS_WIDTH {
                        gridColor = GRID_AXIS_Z_COLOR;
                        hasGrid = true;
                    } else {
                        // Normal grid lines
                        let coord = xz / GRID_CELL_SIZE;
                        let fx_raw = fract(coord.x);
                        let fx = min(fx_raw, 1.0 - fx_raw); 

                        let fz_raw = fract(coord.y);
                        let fz = min(fz_raw, 1.0 - fz_raw);


                        if fx < GRID_LINE_WIDTH || fz < GRID_LINE_WIDTH {
                            gridColor = GRID_LINE_COLOR;
                            hasGrid = true;
                        }
                    }
                }
            }
        }
    }

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

        if hasGrid {
            return vec4<f32>(gridColor, 1.0);
        }
        return vec4<f32>(gamma_correct(color), 1.0);
    }

    // Sky gradient
    let sky = mix(MAT_SKY_COLOR, MAT_SKY_COLOR * 0.9, uv.y * 0.5 + 0.5);

    if hasGrid {
        return vec4<f32>(gridColor, 1.0);
    }
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

// Material Colors
const MAT_SKY_COLOR: vec3<f32> = vec3<f32>(0.05, 0.05, 0.05);

// Grid settings
const GRID_HEIGHT     : f32 = 0.0;
const GRID_EXTENT     : f32 = 10.0;   
const GRID_CELL_SIZE  : f32 = 1.0;
const GRID_LINE_WIDTH : f32 = 0.01;
const GRID_AXIS_WIDTH : f32 = 0.01;

// Colors
const GRID_BG_COLOR      : vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);  
const GRID_LINE_COLOR    : vec3<f32> = vec3<f32>(0.30, 0.30, 0.30);
const GRID_AXIS_X_COLOR  : vec3<f32> = vec3<f32>(1.0, 0.1, 0.1);
const GRID_AXIS_Z_COLOR  : vec3<f32> = vec3<f32>(0.1, 1.0, 0.1);


fn get_material_color(mat_id: f32, p: vec3<f32>) -> vec3<f32> {
    let obj = objects[u32(mat_id)];
    var color = obj.color;

    if obj.id == activeObject {
        color = mix(color, vec3<f32>(1.0, 0.0, 0.0), 0.4);
    }

    return color;
}


// SDF Primitives
fn sd_ellipsoid(p: vec3<f32>, r: vec3<f32>) -> f32 {
    let k0 = length(p / r);
    let k1 = length(p / (r * r));
    return k0 * (k0-1.0)/k1;
}

fn sd_box(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sd_torus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

fn sd_cylinder(p: vec3<f32>, r: f32, h: f32) -> f32 {
    let d = abs(vec2<f32>(length(p.xz), p.y)) - vec2<f32>(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0, 0.0)));
}

fn sd_cone(p: vec3<f32>, c: vec2<f32>, h: f32) -> f32 {
    let q = length(p.xz);
    return max(dot(c, vec2<f32>(q, p.y)), -h - p.y);
}

fn sd_capsule(p: vec3<f32>, h: f32, r: f32) -> f32 {
    var q = p;
    q.y = q.y - clamp(q.y, 0.0, h);
    return length(q) - r;
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
    for (var i = 0u; i < u32(uniforms.objectCount); i++) {
        var q = p - objects[i].position;
        if objects[i].rotation.x != 0.0 {
            q = rotateX(q, objects[i].rotation.x);
        }
        if objects[i].rotation.y != 0.0 {
            q = rotateY(q, objects[i].rotation.y);
        }
        if objects[i].rotation.z != 0.0 {
            q = rotateZ(q, objects[i].rotation.z);
        }
        var obj_dist = MAX_DIST;
        let primitiveId = u32(objects[i].primitive);
        if primitiveId == 0u {
            obj_dist = sd_ellipsoid(q, objects[i].scale);
        } else if primitiveId == 1u {
            obj_dist = sd_box(q, objects[i].scale);
        } else if primitiveId == 2u {
            obj_dist = sd_torus(q, objects[i].scale.xy);
        } else if primitiveId == 3u {
            obj_dist = sd_cylinder(q, objects[i].scale.x, objects[i].scale.y);
        } else if primitiveId == 4u {
            obj_dist = sd_cone(q, objects[i].scale.xy, objects[i].scale.z);
        } else if primitiveId == 5u {
            obj_dist = sd_capsule(q, objects[i].scale.x, objects[i].scale.y);
        }
        if obj_dist < res.x {
            res = vec2<f32>(obj_dist, f32(i));
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


fn rotateX(p: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(
        p.x,
        c * p.y - s * p.z,
        s * p.y + c * p.z
    );
}

fn rotateY(p: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(
        c * p.x + s * p.z,
        -s * p.x + c * p.z,
        p.y
    );
}

fn rotateZ(p: vec3<f32>, a: f32) -> vec3<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec3<f32>(
        c * p.x - s * p.y,
        s * p.x + c * p.y,
        p.z
    );
}
`;var E=typeof Float32Array<"u"?Float32Array:Array;function d(){var t=new E(3);return E!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function O(t){var e=t[0],n=t[1],s=t[2];return Math.sqrt(e*e+n*n+s*s)}function p(t,e,n){var s=new E(3);return s[0]=t,s[1]=e,s[2]=n,s}function S(t,e,n){return t[0]=e[0]+n[0],t[1]=e[1]+n[1],t[2]=e[2]+n[2],t}function m(t,e,n){return t[0]=e[0]-n[0],t[1]=e[1]-n[1],t[2]=e[2]-n[2],t}function U(t,e,n){return t[0]=e[0]*n,t[1]=e[1]*n,t[2]=e[2]*n,t}function v(t,e,n,s){return t[0]=e[0]+n[0]*s,t[1]=e[1]+n[1]*s,t[2]=e[2]+n[2]*s,t}function _(t,e){var n=e[0],s=e[1],i=e[2],r=n*n+s*s+i*i;return r>0&&(r=1/Math.sqrt(r)),t[0]=e[0]*r,t[1]=e[1]*r,t[2]=e[2]*r,t}function g(t,e,n){var s=e[0],i=e[1],r=e[2],o=n[0],a=n[1],l=n[2];return t[0]=i*l-r*a,t[1]=r*o-s*l,t[2]=s*a-i*o,t}(function(){var t=d();return function(e,n,s,i,r,o){var a,l;for(n||(n=3),s||(s=0),i?l=Math.min(i*n+s,e.length):l=e.length,a=s;a<l;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],r(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2];return e}})();const P={SPHERE:0,CUBOID:1};let u=class I{static OBJECT_GPU_WPAD_SIZE_BYTES=80;name;_id;primitive;position;rotation;scale;color;_device;_objectBuffer;constructor(e){this.name=e.name??String(this.id),this.primitive=e.primitive??P.SPHERE,this.position=e.position??p(0,.5,0),this.rotation=e.rotation??p(0,0,0),this.scale=e.scale??p(.5,.5,.5),this.color=e.color??p(1,1,1)}get id(){return this._id}update(){const e=new Float32Array(I.OBJECT_GPU_WPAD_SIZE_BYTES/4);e.set([this._id,this.primitive],0),e.set(this.position??[0,0,0],4),e.set(this.rotation??[0,0,0],8),e.set(this.scale??[1,1,1],12),e.set(this.color??[1,1,1],16),this._device.queue.writeBuffer(this._objectBuffer,this._id*I.OBJECT_GPU_WPAD_SIZE_BYTES,e.buffer)}};class B{static GLOBALS_WPAD_SIZE_BYTES=96;device;context;format;bindGroup;vertexBuffer;globalsBuffer;objectsBuffer;activeObjectBuffer;activeObjectStagingBuffer;renderPipeline;lastGlobals={};objects=[];constructor(e){this.device=e.device,this.context=e.context,this.format=e.format,this.initPipelineAndBuffers()}getObjectCount(){return this.objects.length}initPipelineAndBuffers(){const{device:e}=this,n=new Float32Array([-1,-1,3,-1,-1,3]);this.vertexBuffer=e.createBuffer({size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.vertexBuffer,0,n);const s=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}];this.globalsBuffer=e.createBuffer({size:B.GLOBALS_WPAD_SIZE_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.objectsBuffer=e.createBuffer({size:u.OBJECT_GPU_WPAD_SIZE_BYTES*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.activeObjectBuffer=e.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.selectObject(null),this.activeObjectStagingBuffer=e.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const i=e.createShaderModule({code:A});this.renderPipeline=e.createRenderPipeline({vertex:{module:i,entryPoint:"vs_main",buffers:s},fragment:{module:i,entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"},layout:"auto"}),this.bindGroup=e.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.activeObjectBuffer}}]})}render(){const e=this.device.createCommandEncoder(),n={colorAttachments:[{loadOp:"clear",storeOp:"store",view:this.context.getCurrentTexture().createView()}]},s=e.beginRenderPass(n);s.setPipeline(this.renderPipeline),s.setVertexBuffer(0,this.vertexBuffer),s.setBindGroup(0,this.bindGroup),s.draw(3),s.end(),this.device.queue.submit([e.finish()])}addObject(e){const n=this.device;if(this.objects.length*u.OBJECT_GPU_WPAD_SIZE_BYTES>=this.objectsBuffer.size){const r=n.createBuffer({size:this.objectsBuffer.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),o=n.createCommandEncoder();o.copyBufferToBuffer(this.objectsBuffer,0,r,0,this.objectsBuffer.size),n.queue.submit([o.finish()]),this.objectsBuffer.destroy(),this.objectsBuffer=r;for(const a of this.objects)a._objectBuffer=this.objectsBuffer;this.bindGroup=n.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.activeObjectBuffer}}]})}const s=this.objects.length;this.objects.push(e);const i=e;i._id=s,i._device=this.device,i._objectBuffer=this.objectsBuffer,e.update(),this.updateGlobals({objectCount:this.objects.length})}removeObject(e){if(e.id!=this.objects.length){const n=this.objects[this.objects.length-1];n._id=e.id,this.objects[e.id]=n;const s=this.device.createBuffer({size:u.OBJECT_GPU_WPAD_SIZE_BYTES,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),i=this.device.createCommandEncoder();i.copyBufferToBuffer(this.objectsBuffer,(this.objects.length-1)*u.OBJECT_GPU_WPAD_SIZE_BYTES,s,0,u.OBJECT_GPU_WPAD_SIZE_BYTES),i.copyBufferToBuffer(s,0,this.objectsBuffer,e.id*u.OBJECT_GPU_WPAD_SIZE_BYTES,u.OBJECT_GPU_WPAD_SIZE_BYTES),this.device.queue.submit([i.finish()])}this.objects.pop(),this.updateGlobals({objectCount:this.objects.length})}selectObject(e){this.device.queue.writeBuffer(this.activeObjectBuffer,0,new Float32Array([e?.id??-1]))}updateObjectOnGPU(e){const n=this.objects[e];if(!n)throw new Error("Object id does not exist");n.update()}updateGlobals(e){for(const s in e){const i=e[s];i!==void 0&&(this.lastGlobals[s]=i)}const n=new Float32Array(B.GLOBALS_WPAD_SIZE_BYTES/4);n.set(this.lastGlobals.resolution??[0,0],0),n.set(this.lastGlobals.camPos??[0,3,4],4),n.set(this.lastGlobals.camFwd??[0,0,-1],8),n.set(this.lastGlobals.camRight??[1,0,0],12),n.set(this.lastGlobals.camUp??[0,1,0],16),n.set([this.lastGlobals.time??0,this.lastGlobals.deltaTime??0,this.lastGlobals.objectCount??0],20),this.device.queue.writeBuffer(this.globalsBuffer,0,n)}}class L{position=p(1,3,3);target=p(0,0,0);up=p(0,1,0);forward=d();right=d();upVec=d();constructor(){this.updateMatrices()}updateMatrices(){m(this.forward,this.target,this.position),_(this.forward,this.forward),g(this.right,this.forward,this.up),_(this.right,this.right),g(this.upVec,this.right,this.forward),_(this.upVec,this.upVec)}orbit(e,n,s=.005){const i=d();m(i,this.position,this.target);let r=O(i);r<1e-4&&(r=1e-4);let o=Math.atan2(i[2],i[0]),a=Math.acos(i[1]/r);o+=e*s,a-=n*s;const l=.1;a=Math.max(l,Math.min(Math.PI-l,a)),i[0]=r*Math.sin(a)*Math.cos(o),i[1]=r*Math.cos(a),i[2]=r*Math.sin(a)*Math.sin(o),S(this.position,this.target,i)}pan(e,n,s=.01){const i=d();m(i,this.target,this.position),_(i,i);const r=d();g(r,i,this.up),_(r,r);const o=d();g(o,r,i),v(this.position,this.position,r,-e*s),v(this.target,this.target,r,-e*s),v(this.position,this.position,o,n*s),v(this.target,this.target,o,n*s)}zoom(e,n=.05,s=1,i=50){const r=d();m(r,this.position,this.target);let o=O(r);o<1e-4&&(o=1e-4),o+=e*n,o=Math.max(s,Math.min(i,o)),_(r,r),U(r,r,o),S(this.position,this.target,r)}}class T{_element;constructor(e){this._element=e??document.createElement("div")}loaded(){this.resize()}get element(){return this._element}}class z extends T{canvas;init(){this.canvas=this._element.querySelector("canvas"),this.resize()}resize(){const e=this._element.getBoundingClientRect();this.canvas.width=e.width,this.canvas.height=e.height}}class q extends T{items=[];activeItem=null;init(){this._element.addEventListener("click",()=>{this.activeItem&&this.activateItem(null)})}resize(){}addItem(e){const n=document.createElement("div");n.classList.add("scene-panel-item"),n.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),e.onClick(e),this.activateItem(e)});const s=document.createElement("div");s.textContent=e.text;const i=document.createElement("button");i.textContent="X",i.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),this.removeItem(e)}),n.append(s,i),this._element.appendChild(n),e.html=n,this.items.push(e)}removeItem(e){console.log(this.items);const n=this.items.findIndex(s=>s===e);n>=0&&(this.activeItem===e&&this.activateItem(null),e.onDelete(e),e.html.remove(),this.items.splice(n,1))}activateItem(e){this.activeItem&&(this.activeItem.html.classList.remove("activate"),this.activeItem.onLeave(this.activeItem)),e&&e.html.classList.add("activate"),this.activeItem=e}}async function M(t){if(!navigator.gpu)throw Error("WebGPU not supported.");const e=await navigator.gpu.requestAdapter();if(!e)throw Error("Couldn't request WebGPU adapter.");const n=await e.requestDevice(),s=t.getContext("webgpu");if(!s)throw Error("Couldn't request WebGPU context.");const i=navigator.gpu.getPreferredCanvasFormat();return s.configure({device:n,format:i,alphaMode:"premultiplied"}),{context:s,device:n,format:i}}const Y=document.getElementById("scene"),x=new z(Y);x.init();x.loaded();const X=document.getElementById("scene-manager"),j=new q(X);j.init();j.loaded();const c=x.canvas,{device:W,context:F,format:Z}=await M(c),h=new B({device:W,context:F,format:Z}),f=new L;let y=!1,G=!1,b=[0,0];c.addEventListener("mousedown",t=>{const e=c.getBoundingClientRect();b=[t.clientX-e.left,t.clientY-e.top],t.button===0&&(y=!0),t.button===2&&(G=!0),t.button===2&&t.preventDefault()});c.addEventListener("mouseup",t=>{t.button===0&&(y=!1),t.button===2&&(G=!1)});c.addEventListener("mouseleave",()=>{y=!1,G=!1});c.addEventListener("contextmenu",t=>t.preventDefault());c.addEventListener("mousemove",t=>{const e=c.getBoundingClientRect(),n=t.clientX-e.left,s=t.clientY-e.top,i=n-b[0],r=s-b[1];b=[n,s];const o=.005,a=.01;y&&(f.orbit(i,r,o),f.updateMatrices()),G&&(f.pan(i,r,a),f.updateMatrices())});c.addEventListener("wheel",t=>{f.zoom(t.deltaY),f.updateMatrices()},{passive:!1});function w(){x.resize(),h.updateGlobals({resolution:[c.width,c.height]})}w();window.addEventListener("resize",w);D(new u({name:"Sphere0",primitive:P.SPHERE,position:[0,.5,0],scale:[.5,.5,.5]}));D(new u({name:"LABITE",primitive:P.CUBOID,position:[-1,.5,0],scale:[.5,.5,.5]}));function k(t){const e=t.data;h.selectObject(e)}function H(t){const e=t.data;h.removeObject(e)}function N(t){h.selectObject(null)}function D(t){h.addObject(t);const e={text:t.name,data:t,onClick:k,onLeave:N,onDelete:H};j.addItem(e)}let C=performance.now();function R(t){const e=t/1e3,n=(t-C)/1e3;C=t,h.updateGlobals({resolution:[c.width,c.height],camPos:f.position,camFwd:f.forward,camRight:f.right,camUp:f.upVec,time:e,deltaTime:n,objectCount:h.getObjectCount()}),h.render(),requestAnimationFrame(R)}requestAnimationFrame(R);
