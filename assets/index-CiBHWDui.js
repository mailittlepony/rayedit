(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function t(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=t(i);fetch(i.href,r)}})();const F=`struct Globals {
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
        var finalColor = gamma_correct(color);

        let objIndex = u32(result.y);
        let obj = objects[objIndex];

        if obj.id == activeObject {
            let viewDir = normalize(cam_pos - hit_pos);
            let ndv = abs(dot(normal, viewDir));
            let rim = 1.0 - ndv;
            let rimMask = smoothstep(0.0, 1.0, rim);
            let outlineColor = vec3<f32>(1.0, 1.0, 0.0);
            finalColor = mix(finalColor, outlineColor, rimMask);
        }

        return vec4<f32>(gamma_correct(finalColor), 1.0);
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
`;var w=typeof Float32Array<"u"?Float32Array:Array;function h(){var n=new w(3);return w!=Float32Array&&(n[0]=0,n[1]=0,n[2]=0),n}function U(n){var e=n[0],t=n[1],s=n[2];return Math.sqrt(e*e+t*t+s*s)}function g(n,e,t){var s=new w(3);return s[0]=n,s[1]=e,s[2]=t,s}function A(n,e,t){return n[0]=e[0]+t[0],n[1]=e[1]+t[1],n[2]=e[2]+t[2],n}function E(n,e,t){return n[0]=e[0]-t[0],n[1]=e[1]-t[1],n[2]=e[2]-t[2],n}function X(n,e,t){return n[0]=e[0]*t,n[1]=e[1]*t,n[2]=e[2]*t,n}function C(n,e,t,s){return n[0]=e[0]+t[0]*s,n[1]=e[1]+t[1]*s,n[2]=e[2]+t[2]*s,n}function b(n,e){var t=e[0],s=e[1],i=e[2],r=t*t+s*s+i*i;return r>0&&(r=1/Math.sqrt(r)),n[0]=e[0]*r,n[1]=e[1]*r,n[2]=e[2]*r,n}function y(n,e,t){var s=e[0],i=e[1],r=e[2],o=t[0],a=t[1],c=t[2];return n[0]=i*c-r*a,n[1]=r*o-s*c,n[2]=s*a-i*o,n}(function(){var n=h();return function(e,t,s,i,r,o){var a,c;for(t||(t=3),s||(s=0),i?c=Math.min(i*t+s,e.length):c=e.length,a=s;a<c;a+=t)n[0]=e[a],n[1]=e[a+1],n[2]=e[a+2],r(n,n,o),e[a]=n[0],e[a+1]=n[1],e[a+2]=n[2];return e}})();const l={SPHERE:0,CUBE:1,TORUS:2,CYLINDER:3,CONE:4,CAPSULE:5};let p=class D{static OBJECT_GPU_WPAD_SIZE_BYTES=80;name;_id;primitive;position;rotation;scale;color;_device;_objectBuffer;constructor(e){this.name=e.name??String(this.id),this.primitive=e.primitive??l.SPHERE,this.position=e.position??g(0,.5,0),this.rotation=e.rotation??g(0,0,0),this.scale=e.scale??g(.5,.5,.5),this.color=e.color??g(1,1,1)}get id(){return this._id}update(){const e=new Float32Array(D.OBJECT_GPU_WPAD_SIZE_BYTES/4);e.set([this._id,this.primitive],0),e.set(this.position??[0,0,0],4),e.set(this.rotation??[0,0,0],8),e.set(this.scale??[1,1,1],12),e.set(this.color??[1,1,1],16),this._device.queue.writeBuffer(this._objectBuffer,this._id*D.OBJECT_GPU_WPAD_SIZE_BYTES,e.buffer)}};class I{static GLOBALS_WPAD_SIZE_BYTES=96;device;context;format;bindGroup;vertexBuffer;globalsBuffer;objectsBuffer;activeObjectBuffer;activeObjectStagingBuffer;renderPipeline;lastGlobals={};objects=[];constructor(e){this.device=e.device,this.context=e.context,this.format=e.format,this.initPipelineAndBuffers()}getObjectCount(){return this.objects.length}initPipelineAndBuffers(){const{device:e}=this,t=new Float32Array([-1,-1,3,-1,-1,3]);this.vertexBuffer=e.createBuffer({size:t.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.vertexBuffer,0,t);const s=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}];this.globalsBuffer=e.createBuffer({size:I.GLOBALS_WPAD_SIZE_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.objectsBuffer=e.createBuffer({size:p.OBJECT_GPU_WPAD_SIZE_BYTES*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.activeObjectBuffer=e.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.selectObject(null),this.activeObjectStagingBuffer=e.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const i=e.createShaderModule({code:F});this.renderPipeline=e.createRenderPipeline({vertex:{module:i,entryPoint:"vs_main",buffers:s},fragment:{module:i,entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"},layout:"auto"}),this.bindGroup=e.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.activeObjectBuffer}}]})}render(){const e=this.device.createCommandEncoder(),t={colorAttachments:[{loadOp:"clear",storeOp:"store",view:this.context.getCurrentTexture().createView()}]},s=e.beginRenderPass(t);s.setPipeline(this.renderPipeline),s.setVertexBuffer(0,this.vertexBuffer),s.setBindGroup(0,this.bindGroup),s.draw(3),s.end(),this.device.queue.submit([e.finish()])}addObject(e){const t=this.device;if(this.objects.length*p.OBJECT_GPU_WPAD_SIZE_BYTES>=this.objectsBuffer.size){const r=t.createBuffer({size:this.objectsBuffer.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),o=t.createCommandEncoder();o.copyBufferToBuffer(this.objectsBuffer,0,r,0,this.objectsBuffer.size),t.queue.submit([o.finish()]),this.objectsBuffer.destroy(),this.objectsBuffer=r;for(const a of this.objects)a._objectBuffer=this.objectsBuffer;this.bindGroup=t.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.activeObjectBuffer}}]})}const s=this.objects.length;this.objects.push(e);const i=e;i._id=s,i._device=this.device,i._objectBuffer=this.objectsBuffer,e.update(),this.updateGlobals({objectCount:this.objects.length})}removeObject(e){if(e.id!=this.objects.length){const t=this.objects[this.objects.length-1];t._id=e.id,this.objects[e.id]=t;const s=this.device.createBuffer({size:p.OBJECT_GPU_WPAD_SIZE_BYTES,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),i=this.device.createCommandEncoder();i.copyBufferToBuffer(this.objectsBuffer,(this.objects.length-1)*p.OBJECT_GPU_WPAD_SIZE_BYTES,s,0,p.OBJECT_GPU_WPAD_SIZE_BYTES),i.copyBufferToBuffer(s,0,this.objectsBuffer,e.id*p.OBJECT_GPU_WPAD_SIZE_BYTES,p.OBJECT_GPU_WPAD_SIZE_BYTES),this.device.queue.submit([i.finish()])}this.objects.pop(),this.updateGlobals({objectCount:this.objects.length})}selectObject(e){this.device.queue.writeBuffer(this.activeObjectBuffer,0,new Float32Array([e?.id??-1]))}updateObjectOnGPU(e){const t=this.objects[e];if(!t)throw new Error("Object id does not exist");t.update()}updateGlobals(e){for(const s in e){const i=e[s];i!==void 0&&(this.lastGlobals[s]=i)}const t=new Float32Array(I.GLOBALS_WPAD_SIZE_BYTES/4);t.set(this.lastGlobals.resolution??[0,0],0),t.set(this.lastGlobals.camPos??[0,3,4],4),t.set(this.lastGlobals.camFwd??[0,0,-1],8),t.set(this.lastGlobals.camRight??[1,0,0],12),t.set(this.lastGlobals.camUp??[0,1,0],16),t.set([this.lastGlobals.time??0,this.lastGlobals.deltaTime??0,this.lastGlobals.objectCount??0],20),this.device.queue.writeBuffer(this.globalsBuffer,0,t)}}class W{position=g(1,3,3);target=g(0,0,0);up=g(0,1,0);forward=h();right=h();upVec=h();constructor(){this.updateMatrices()}updateMatrices(){E(this.forward,this.target,this.position),b(this.forward,this.forward),y(this.right,this.forward,this.up),b(this.right,this.right),y(this.upVec,this.right,this.forward),b(this.upVec,this.upVec)}orbit(e,t,s=.005){const i=h();E(i,this.position,this.target);let r=U(i);r<1e-4&&(r=1e-4);let o=Math.atan2(i[2],i[0]),a=Math.acos(i[1]/r);o+=e*s,a-=t*s;const c=.1;a=Math.max(c,Math.min(Math.PI-c,a)),i[0]=r*Math.sin(a)*Math.cos(o),i[1]=r*Math.cos(a),i[2]=r*Math.sin(a)*Math.sin(o),A(this.position,this.target,i)}pan(e,t,s=.01){const i=h();E(i,this.target,this.position),b(i,i);const r=h();y(r,i,this.up),b(r,r);const o=h();y(o,r,i),C(this.position,this.position,r,-e*s),C(this.target,this.target,r,-e*s),C(this.position,this.position,o,t*s),C(this.target,this.target,o,t*s)}zoom(e,t=.05,s=1,i=50){const r=h();E(r,this.position,this.target);let o=U(r);o<1e-4&&(o=1e-4),o+=e*t,o=Math.max(s,Math.min(i,o)),b(r,r),X(r,r,o),A(this.position,this.target,r)}}class S{_element;title="";constructor(e,t){this._element=e??document.createElement("div"),t&&(this.title=t)}loaded(){this.resize()}get element(){return this._element}}class k extends S{canvas;init(){this.canvas=this._element.querySelector("canvas"),this.resize()}resize(){const e=this._element.getBoundingClientRect();this.canvas.width=e.width,this.canvas.height=e.height}}class H extends S{items=[];activeItem=null;init(){this._element.addEventListener("click",()=>{this.activeItem&&this.activateItem(null)});const e=document.createElement("div");e.textContent="Scene",this._element.prepend(e)}resize(){}addItem(e){const t=document.createElement("div");t.classList.add("scene-panel-item"),t.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),e.onClick(e),this.activateItem(e)});const s=document.createElement("div");s.textContent=e.text;const i=document.createElement("button");i.textContent="X",i.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),this.removeItem(e)}),t.append(s,i),this._element.appendChild(t),e.html=t,this.items.push(e)}removeItem(e){console.log(this.items);const t=this.items.findIndex(s=>s===e);t>=0&&(this.activeItem===e&&this.activateItem(null),e.onDelete(e),e.html.remove(),this.items.splice(t,1))}activateItem(e){this.activeItem&&(this.activeItem.html.classList.remove("activate"),this.activeItem.onLeave(this.activeItem)),this.activeItem=e,e&&(e.html.classList.add("activate"),e.onActivate(e))}}class Z extends S{_target=null;onFieldChange=null;init(){const e=document.createElement("div");e.textContent="Properties",e.className="panel-titlebar",this._element.appendChild(e);const t=document.createElement("p");t.className="properties-empty",t.innerText="No object selected",t.style.color="gray",this._element.appendChild(t)}resize(){}setTarget(e){this._target=e,this.render()}render(){const e=this._element.firstElementChild;if(this._element.innerHTML="",e&&this._element.appendChild(e),!this._target){const t=document.createElement("p");t.className="properties-empty",t.textContent="No object selected",t.style.color="gray",this._element.appendChild(t);return}this._element.appendChild(this.createVec3Section("Position","position",this._target.position)),this._element.appendChild(this.createVec3Section("Rotation","rotation",this._target.rotation)),this._element.appendChild(this.createVec3Section("Scale","scale",this._target.scale)),this._element.appendChild(this.createColorSection("Color","color",this._target.color))}createVec3Section(e,t,s){const i=document.createElement("div");i.classList.add("scene-panel-item","prop-section");const r=document.createElement("div");r.className="prop-title",r.textContent=e,i.appendChild(r);const o=document.createElement("div");return o.className="prop-row",["X","Y","Z"].forEach((c,u)=>{const _=document.createElement("div");_.className="prop-input-wrapper";const T=document.createElement("label");T.textContent=c,T.className="prop-label";const v=document.createElement("input");v.type="number",v.step="0.1",v.value=s[u].toString(),v.className="prop-input",v.addEventListener("change",()=>{if(!this._target)return;const L=parseFloat(v.value);Number.isNaN(L)||(this._target[t][u]=L,this.onFieldChange?.(t,this._target))}),_.append(T,v),o.appendChild(_)}),i.appendChild(o),i}createColorSection(e,t,s){const i=document.createElement("div");i.classList.add("scene-panel-item","prop-section");const r=document.createElement("div");r.className="prop-title",r.textContent=e,i.appendChild(r);const o=document.createElement("div");o.className="prop-row";const a=document.createElement("div");a.className="prop-input-wrapper";const c=document.createElement("label");c.textContent="Color",c.className="prop-label";const u=document.createElement("input");return u.type="color",u.className="prop-color-input",u.value=this.vec3ToHex(s),u.addEventListener("input",()=>{if(!this._target)return;const _=this.hexToVec3(u.value);this._target.color[0]=_[0],this._target.color[1]=_[1],this._target.color[2]=_[2],this.onFieldChange?.(t,this._target)}),a.append(c,u),o.appendChild(a),i.appendChild(o),i}vec3ToHex(e){const t=Math.round(Math.min(Math.max(e[0],0),1)*255),s=Math.round(Math.min(Math.max(e[1],0),1)*255),i=Math.round(Math.min(Math.max(e[2],0),1)*255),r=o=>o.toString(16).padStart(2,"0");return`#${r(t)}${r(s)}${r(i)}`}hexToVec3(e){const t=e.replace("#",""),s=parseInt(t.slice(0,2),16)/255,i=parseInt(t.slice(2,4),16)/255,r=parseInt(t.slice(4,6),16)/255;return[s,i,r]}}class V extends S{items=[];selectedItem=null;onSelect=null;init(){const e=document.createElement("div");e.textContent="Toolbox",this._element.prepend(e),this._element.classList.add("toolbox-panel"),this.render()}resize(){}setItems(e){this.items=e,this.render()}render(){const e=this._element.firstElementChild;this._element.innerHTML="",e&&this._element.appendChild(e);const t=document.createElement("div");t.className="toolbox-list",this.items.forEach(s=>{const i=document.createElement("div");i.classList.add("scene-panel-item","toolbox-card"),this.selectedItem===s&&i.classList.add("activate");const r=this.getIconForTool(s.id);r.className="toolbox-icon";const o=document.createElement("div");o.className="toolbox-label",o.textContent=s.label,i.append(r,o),i.addEventListener("click",a=>{a.preventDefault(),a.stopPropagation(),this.selectedItem=s,this.onSelect?.(s),this.render()}),t.appendChild(i)}),this._element.appendChild(t)}getIconForTool(e){const t=document.createElement("img");switch(t.className="toolbox-icon",e){case l.SPHERE:t.src="icons/sphere.png";break;case l.CUBE:t.src="icons/cube.png";break;case l.TORUS:t.src="icons/torus.png";break;case l.CYLINDER:t.src="icons/cylinder.png";break;case l.CONE:t.src="icons/cone.png";break;case l.CAPSULE:t.src="icons/capsule.png";break}return t}}async function J(n){if(!navigator.gpu)throw Error("WebGPU not supported.");const e=await navigator.gpu.requestAdapter();if(!e)throw Error("Couldn't request WebGPU adapter.");const t=await e.requestDevice(),s=n.getContext("webgpu");if(!s)throw Error("Couldn't request WebGPU context.");const i=navigator.gpu.getPreferredCanvasFormat();return s.configure({device:t,format:i,alphaMode:"premultiplied"}),{context:s,device:t,format:i}}const $=document.getElementById("scene"),P=new k($);P.init();P.loaded();const K=document.getElementById("scene-manager"),j=new H(K);j.init();j.loaded();const Q=document.getElementById("toolbox"),R=new V(Q);R.init();const ee=document.getElementById("properties"),x=new Z(ee);x.init();const te=[{id:l.SPHERE,label:"Sphere"},{id:l.CUBE,label:"Cube"},{id:l.TORUS,label:"Torus"},{id:l.CYLINDER,label:"Cylinder"},{id:l.CONE,label:"Cone"},{id:l.CAPSULE,label:"Capsule"}];function M(n){const e=n.data;m.selectObject(e),x.setTarget(e)}function ne(n){const e=n.data;m.removeObject(e)}function ie(){m.selectObject(null),x.setTarget(null)}function se(n,e,t){let s=-1;for(const i of t){const r=i.text;if(r.startsWith(n)){const o=r.slice(n.length),a=parseInt(o);isNaN(a)||(s=Math.max(s,a))}}return`${n}${s+1}`}R.setItems(te);R.onSelect=n=>{const e=n.label.toLowerCase().replace(/\s+/g,""),t=se(e,n.id,j.items),s=new p({name:t,primitive:n.id,position:[0,.5,0],scale:[.5,.5,.5]});q(s),x.setTarget(s)};x.onFieldChange=(n,e)=>{e.update?.()};const d=P.canvas,{device:re,context:oe,format:ae}=await J(d),m=new I({device:re,context:oe,format:ae}),f=new W;let G=!1,O=!1,B=[0,0];d.addEventListener("mousedown",n=>{const e=d.getBoundingClientRect();B=[n.clientX-e.left,n.clientY-e.top],n.button===0&&(G=!0),n.button===2&&(O=!0),n.button===2&&n.preventDefault()});d.addEventListener("mouseup",n=>{n.button===0&&(G=!1),n.button===2&&(O=!1)});d.addEventListener("mouseleave",()=>{G=!1,O=!1});d.addEventListener("contextmenu",n=>n.preventDefault());d.addEventListener("mousemove",n=>{const e=d.getBoundingClientRect(),t=n.clientX-e.left,s=n.clientY-e.top,i=t-B[0],r=s-B[1];B=[t,s];const o=.005,a=.01;G&&(f.orbit(i,r,o),f.updateMatrices()),O&&(f.pan(i,r,a),f.updateMatrices())});d.addEventListener("wheel",n=>{f.zoom(n.deltaY),f.updateMatrices()},{passive:!1});function N(){P.resize(),m.updateGlobals({resolution:[d.width,d.height]})}N();window.addEventListener("resize",N);q(new p({name:"sphere0",primitive:l.SPHERE,position:[0,.5,0],scale:[.5,.5,.5]}));function q(n){m.addObject(n);const e={text:n.name,data:n,onClick:M,onActivate:M,onLeave:ie,onDelete:ne};j.addItem(e)}let z=performance.now();function Y(n){const e=n/1e3,t=(n-z)/1e3;z=n,m.updateGlobals({resolution:[d.width,d.height],camPos:f.position,camFwd:f.forward,camRight:f.right,camUp:f.upVec,time:e,deltaTime:t,objectCount:m.getObjectCount()}),m.render(),requestAnimationFrame(Y)}requestAnimationFrame(Y);
