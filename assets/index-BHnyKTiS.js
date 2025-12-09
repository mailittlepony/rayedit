(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function t(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=t(i);fetch(i.href,o)}})();const ee=`struct Globals {
    resolution: vec2<f32>,
    mouse: vec2<f32>,
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
    activeObjectIdx: f32
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

struct Collision {
    t: f32,
    index: f32,
    _pad0: vec2<f32>,
    position: vec3<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms : Globals;

@group(0) @binding(1)
var<storage, read> objects : array<Object>;

@group(0) @binding(2)
var<storage, read_write> collisionBuffer: Collision;

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

    // Convert to integer pixel coords
    let frag_px = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
    let mouse_px = vec2<i32>(i32(uniforms.mouse.x), i32(uniforms.mouse.y));

    if all(frag_px == mouse_px) {
        var col: Collision;
        var res = pick(cam_pos, rd, 0u);
        let g_res = pick(cam_pos, rd, 1u);
        if g_res.x < MAX_DIST {
            res = g_res;
        }

        col.t = res.z;
        col.index = res.y;
        col.position = cam_pos + rd * res.x;
        collisionBuffer = col;
    }

    // Ray march
    var result = ray_march(cam_pos, rd, 0u);
    let res_gizmo = ray_march(cam_pos, rd, 1u);
    if res_gizmo.x < MAX_DIST {
        result = res_gizmo;
    }

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
                        gridColor = GRID_AXIS_Z_COLOR;
                        hasGrid = true;
                    } else if abs(xz.y) < GRID_AXIS_WIDTH {
                        gridColor = GRID_AXIS_X_COLOR;
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
        let shadow_result = ray_march(shadow_origin, light_dir, 0u);
        let shadow = select(0.3, 1.0, shadow_result.x > length(light_pos - shadow_origin));

        // Phong Shading
        let ambient = 0.2;
        var albedo = get_material_color(result.z, result.y, hit_pos);
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

        if result.z == TYPE_OBJ && obj.id == uniforms.activeObjectIdx {
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
const PI = 3.14159265358;

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
const GRID_AXIS_Z_COLOR  : vec3<f32> = vec3<f32>(0.1, 0.1, 1.0);

const TYPE_OBJ = 0.0;
const TYPE_GIZMO = 1.0;


fn get_material_color(typ: f32, id: f32, p: vec3<f32>) -> vec3<f32> {
    var color: vec3<f32>;

    if typ == TYPE_OBJ {
        let obj = objects[u32(id)];
        color = obj.color;
    } else if typ == TYPE_GIZMO {
        if id == 3.0 {
            color = vec3<f32>(1.0, 1.0, 1.0); 
        } else {
            color[u32(id)] = 1.0;

        }
        if collisionBuffer.t == TYPE_GIZMO && collisionBuffer.index == id {
            color = mix(color, vec3<f32>(0.9, 0.5, 0.0), 0.5);
        }
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
    let d = abs(vec2<f32>(length(p.xz), p.y)) - vec2<f32>(r, h / 2.0);
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0, 0.0)));
}

fn sd_cone(p: vec3<f32>, r: f32, h: f32) -> f32 {
    // c = normalize( vec2(h, r) )
    let hh = h * 2.0;
    let invLen = inverseSqrt(hh * hh + r * r);
    let c = vec2<f32>(hh * invLen, r * invLen);

    let q = length(vec2<f32>(p.x, p.z));

    // max( distance-to-side, distance-to-base-plane )
    return max(dot(c, vec2<f32>(q, p.y - h)), -hh - p.y + h);
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


// Scene description - returns (distance, index)
fn get_dist_obj(p: vec3<f32>) -> vec3<f32> {
    var res = vec3<f32>(MAX_DIST, -1.0, -1.0);

    // Objects
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
            obj_dist = sd_cone(q, objects[i].scale.x, objects[i].scale.y);
        } else if primitiveId == 5u {
            obj_dist = sd_capsule(q, objects[i].scale.x, objects[i].scale.y);
        }
        if obj_dist < res.x {
            res = vec3<f32>(obj_dist, f32(i), TYPE_OBJ);
        }
    }

    return res;
}

fn get_dist_gizmo(p: vec3<f32>) -> vec3<f32> {
    var res = vec3<f32>(MAX_DIST, -1.0, -1.0);

    if uniforms.activeObjectIdx < 0.0 {
        return res;
    }
    
    let q = p - objects[u32(uniforms.activeObjectIdx)].position;

    // Gizmos
    // center sphere
    let gizmo_sphere = sd_ellipsoid(q, vec3<f32>(0.06));
    if gizmo_sphere < res.x {
        res = vec3<f32>(gizmo_sphere, 3.0, TYPE_GIZMO);
    }


    // X Cone
    let x_cone_pos = vec3<f32>(0.5, 0.0, 0.0);
    let cone_size = vec2<f32>(0.04);
    let x_gizmo_cone_d = sd_cone(rotateZ(q - x_cone_pos, PI / 2.0), 0.04, 0.04);
    if x_gizmo_cone_d < res.x {
        res = vec3<f32>(x_gizmo_cone_d, 0.0, TYPE_GIZMO);
    }

    // X Axe
    let x_gizmo_cyl_d = sd_cylinder(rotateZ(q - vec3<f32>(0.25, 0.0, 0.0), PI / 2.0), 0.02, 0.5);
    if x_gizmo_cyl_d < res.x {
        res = vec3<f32>(x_gizmo_cyl_d, 0.0, TYPE_GIZMO);
    }
    
    // Y Cone
    let y_cone_pos = vec3<f32>(0.0, 0.5, 0.0);
    let y_gizmo_cone_d = sd_cone(q - y_cone_pos, 0.04, 0.04);
    if y_gizmo_cone_d < res.x {
        res = vec3<f32>(y_gizmo_cone_d, 1.0, TYPE_GIZMO);
    }

    // Y Axe
    let y_gizmo_cyl_d = sd_cylinder(q - vec3<f32>(0.0, 0.25, 0.0), 0.02, 0.5);
    if y_gizmo_cyl_d < res.x {
        res = vec3<f32>(y_gizmo_cyl_d, 1.0, TYPE_GIZMO);
    }

    // Z Cone
    let z_cone_pos = vec3<f32>(0.0, 0.0, 0.5);
    let z_gizmo_d = sd_cone(rotateX(q - z_cone_pos, -PI / 2.0), 0.04, 0.04);
    if z_gizmo_d < res.x {
        res = vec3<f32>(z_gizmo_d, 2.0, TYPE_GIZMO);
    }

    // Z Axe
    let z_gizmo_cyl_d = sd_cylinder(rotateX(q - vec3<f32>(0.0, 0.0, 0.25), PI / 2.0), 0.02, 0.5);
    if z_gizmo_cyl_d < res.x {
        res = vec3<f32>(z_gizmo_cyl_d, 2.0, TYPE_GIZMO);
    }

    return res;
}

fn get_dist(p: vec3<f32>) -> vec3<f32> {
    var res = vec3<f32>(MAX_DIST, -1.0, -1.0);

    let o = get_dist_obj(p);
    if o.x < res.x {
        res = o;
    }

    let g = get_dist_gizmo(p);
    if g.x < res.x {
        res = g;
    }

    return res;
}

// Ray marching function - returns (distance, index)
fn ray_march(ro: vec3<f32>, rd: vec3<f32>, mode: u32) -> vec3<f32> {
    var d = 0.0;
    var id = -1.0;
    var typ = -1.0;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * d;
        var dist_mat: vec3<f32>;

        if mode == 0u {
            dist_mat = get_dist_obj(p);
        } else if mode == 1u {
            dist_mat = get_dist_gizmo(p);
        }

        d += dist_mat.x;
        id = dist_mat.y;
        typ = dist_mat.z;

        if dist_mat.x < SURF_DIST || d > MAX_DIST {
            break;
        }
    }

    return vec3<f32>(d, id, typ);
}

// Picking function - returns index
fn pick(ro: vec3<f32>, rd: vec3<f32>, mode: u32) -> vec3<f32> {
    var d = 0.0;
    var id = -1.0;
    var typ = -1.0;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * d;
        // let dist_mat = get_dist(p);
        var dist_mat: vec3<f32>;

        if mode == 0u {
            dist_mat = get_dist_obj(p);
        } else if mode == 1u {
            dist_mat = get_dist_gizmo(p);
        }

        if dist_mat.x < SURF_DIST {
            id = dist_mat.y;
            typ = dist_mat.z;
            break;
        }

        d += dist_mat.x;

        if d > MAX_DIST {
            break;
        }
    }

    return vec3<f32>(d, id, typ);
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
`;var C=typeof Float32Array<"u"?Float32Array:Array;function p(){var n=new C(3);return C!=Float32Array&&(n[0]=0,n[1]=0,n[2]=0),n}function k(n){var e=n[0],t=n[1],s=n[2];return Math.sqrt(e*e+t*t+s*s)}function y(n,e,t){var s=new C(3);return s[0]=n,s[1]=e,s[2]=t,s}function I(n,e){return n[0]=e[0],n[1]=e[1],n[2]=e[2],n}function te(n,e,t,s){return n[0]=e,n[1]=t,n[2]=s,n}function W(n,e,t){return n[0]=e[0]+t[0],n[1]=e[1]+t[1],n[2]=e[2]+t[2],n}function T(n,e,t){return n[0]=e[0]-t[0],n[1]=e[1]-t[1],n[2]=e[2]-t[2],n}function $(n,e,t){return n[0]=e[0]*t,n[1]=e[1]*t,n[2]=e[2]*t,n}function S(n,e,t,s){return n[0]=e[0]+t[0]*s,n[1]=e[1]+t[1]*s,n[2]=e[2]+t[2]*s,n}function ne(n,e){var t=e[0]-n[0],s=e[1]-n[1],i=e[2]-n[2];return Math.sqrt(t*t+s*s+i*i)}function E(n,e){var t=e[0],s=e[1],i=e[2],o=t*t+s*s+i*i;return o>0&&(o=1/Math.sqrt(o)),n[0]=e[0]*o,n[1]=e[1]*o,n[2]=e[2]*o,n}function F(n,e){return n[0]*e[0]+n[1]*e[1]+n[2]*e[2]}function z(n,e,t){var s=e[0],i=e[1],o=e[2],r=t[0],c=t[1],a=t[2];return n[0]=i*a-o*c,n[1]=o*r-s*a,n[2]=s*c-i*r,n}(function(){var n=p();return function(e,t,s,i,o,r){var c,a;for(t||(t=3),s||(s=0),i?a=Math.min(i*t+s,e.length):a=e.length,c=s;c<a;c+=t)n[0]=e[c],n[1]=e[c+1],n[2]=e[c+2],o(n,n,r),e[c]=n[0],e[c+1]=n[1],e[c+2]=n[2];return e}})();function J(){var n=new C(2);return C!=Float32Array&&(n[0]=0,n[1]=0),n}function ie(n,e){var t=new C(2);return t[0]=n,t[1]=e,t}function se(n,e,t){return n[0]=e,n[1]=t,n}function oe(n,e,t){return n[0]=e[0]*t,n[1]=e[1]*t,n}function re(n){var e=n[0],t=n[1];return Math.sqrt(e*e+t*t)}function ce(n,e){return n[0]*e[0]+n[1]*e[1]}(function(){var n=J();return function(e,t,s,i,o,r){var c,a;for(t||(t=2),s||(s=0),i?a=Math.min(i*t+s,e.length):a=e.length,c=s;c<a;c+=t)n[0]=e[c],n[1]=e[c+1],o(n,n,r),e[c]=n[0],e[c+1]=n[1];return e}})();const l={SPHERE:0,CUBE:1,TORUS:2,CYLINDER:3,CONE:4,CAPSULE:5};let g=class D{static OBJECT_GPU_WPAD_SIZE_BYTES=80;name;_id;primitive;position;rotation;scale;color;_device;_objectBuffer;constructor(e){this.name=e.name??String(this.id),this.primitive=e.primitive??l.SPHERE,this.position=e.position??y(0,.5,0),this.rotation=e.rotation??y(0,0,0),this.scale=e.scale??y(.5,.5,.5),this.color=e.color??y(1,1,1)}get id(){return this._id}update(){const e=new Float32Array(D.OBJECT_GPU_WPAD_SIZE_BYTES/4),t=p();$(t,this.rotation,Math.PI/180),e.set([this._id,this.primitive],0),e.set(this.position??[0,0,0],4),e.set(t??[0,0,0],8),e.set(this.scale??[1,1,1],12),e.set(this.color??[1,1,1],16),this._device.queue.writeBuffer(this._objectBuffer,this._id*D.OBJECT_GPU_WPAD_SIZE_BYTES,e.buffer)}copy(){const e=new D({name:`${this.name}Copy`,primitive:this.primitive});return I(e.position,this.position),I(e.rotation,this.rotation),I(e.scale,this.scale),I(e.color,this.color),e}};class b{static GLOBALS_WPAD_SIZE_BYTES=96;static COLLISION_WPAD_SIZE_BYTES=32;device;context;format;bindGroup;vertexBuffer;globalsBuffer;objectsBuffer;collisionBuffer;collisionStagingBuffer;collisionPending=!1;lastCollision=null;renderPipeline;lastGlobals={};objects=[];_activeObject=null;get activeObject(){return this._activeObject}constructor(e){this.device=e.device,this.context=e.context,this.format=e.format,this.initPipelineAndBuffers()}getObjectCount(){return this.objects.length}initPipelineAndBuffers(){const{device:e}=this,t=new Float32Array([-1,-1,3,-1,-1,3]);this.vertexBuffer=e.createBuffer({size:t.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.vertexBuffer,0,t);const s=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}],stepMode:"vertex"}];this.globalsBuffer=e.createBuffer({size:b.GLOBALS_WPAD_SIZE_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.objectsBuffer=e.createBuffer({size:g.OBJECT_GPU_WPAD_SIZE_BYTES*1,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.collisionBuffer=e.createBuffer({size:b.COLLISION_WPAD_SIZE_BYTES,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.selectObject(null),this.collisionStagingBuffer=e.createBuffer({size:b.COLLISION_WPAD_SIZE_BYTES,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const i=e.createShaderModule({code:ee});this.renderPipeline=e.createRenderPipeline({vertex:{module:i,entryPoint:"vs_main",buffers:s},fragment:{module:i,entryPoint:"fs_main",targets:[{format:this.format}]},primitive:{topology:"triangle-list"},layout:"auto"}),this.bindGroup=e.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.collisionBuffer}}]})}render(){const e=this.device.createCommandEncoder(),t={colorAttachments:[{loadOp:"clear",storeOp:"store",view:this.context.getCurrentTexture().createView()}]},s=e.beginRenderPass(t);s.setPipeline(this.renderPipeline),s.setVertexBuffer(0,this.vertexBuffer),s.setBindGroup(0,this.bindGroup),s.draw(3),s.end(),this.device.queue.submit([e.finish()]),this.readCollisionBuffer()}addObject(e){const t=this.device;if(this.objects.length*g.OBJECT_GPU_WPAD_SIZE_BYTES>=this.objectsBuffer.size){const o=t.createBuffer({size:this.objectsBuffer.size*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),r=t.createCommandEncoder();r.copyBufferToBuffer(this.objectsBuffer,0,o,0,this.objectsBuffer.size),t.queue.submit([r.finish()]),this.objectsBuffer.destroy(),this.objectsBuffer=o;for(const c of this.objects)c._objectBuffer=this.objectsBuffer;this.bindGroup=t.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.globalsBuffer}},{binding:1,resource:{buffer:this.objectsBuffer}},{binding:2,resource:{buffer:this.collisionBuffer}}]})}const s=this.objects.length;this.objects.push(e);const i=e;i._id=s,i._device=this.device,i._objectBuffer=this.objectsBuffer,e.update(),this.updateGlobals({objectCount:this.objects.length})}removeObject(e){if(e.id!=this.objects.length){const t=this.objects[this.objects.length-1];t._id=e.id,this.objects[e.id]=t;const s=this.device.createBuffer({size:g.OBJECT_GPU_WPAD_SIZE_BYTES,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),i=this.device.createCommandEncoder();i.copyBufferToBuffer(this.objectsBuffer,(this.objects.length-1)*g.OBJECT_GPU_WPAD_SIZE_BYTES,s,0,g.OBJECT_GPU_WPAD_SIZE_BYTES),i.copyBufferToBuffer(s,0,this.objectsBuffer,e.id*g.OBJECT_GPU_WPAD_SIZE_BYTES,g.OBJECT_GPU_WPAD_SIZE_BYTES),this.device.queue.submit([i.finish()])}this.objects.pop(),this.updateGlobals({objectCount:this.objects.length})}selectObject(e){this.updateGlobals({activeObjectIdx:e?.id??-1}),this._activeObject=e}checkCollision(){return this.lastCollision}async readCollisionBuffer(){if(this.collisionPending)return;const e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.collisionBuffer,0,this.collisionStagingBuffer,0,b.COLLISION_WPAD_SIZE_BYTES),this.collisionPending=!0,this.device.queue.submit([e.finish()]),await this.collisionStagingBuffer.mapAsync(GPUMapMode.READ,0,b.COLLISION_WPAD_SIZE_BYTES),this.collisionPending=!1;const s=this.collisionStagingBuffer.getMappedRange(0,b.COLLISION_WPAD_SIZE_BYTES).slice();this.collisionStagingBuffer.unmap();const i=new Float32Array(s);let o=null;i[0]==0?o="object":i[0]==1&&(o="gizmo");const r=i[1],c={type:o,index:r,object:this.objects[r]??null,position:i.slice(4,7)};this.lastCollision=c}updateObjectOnGPU(e){const t=this.objects[e];if(!t)throw new Error("Object id does not exist");t.update()}updateGlobals(e){for(const s in e){const i=e[s];i!==void 0&&(this.lastGlobals[s]=i)}const t=new Float32Array(b.GLOBALS_WPAD_SIZE_BYTES/4);t.set(this.lastGlobals.resolution??[0,0],0),t.set(this.lastGlobals.mouse??[0,0],2),t.set(this.lastGlobals.camPos??[0,3,4],4),t.set(this.lastGlobals.camFwd??[0,0,-1],8),t.set(this.lastGlobals.camRight??[1,0,0],12),t.set(this.lastGlobals.camUp??[0,1,0],16),t.set([this.lastGlobals.time??0,this.lastGlobals.deltaTime??0,this.lastGlobals.objectCount??0,this.lastGlobals.activeObjectIdx??0],20),this.device.queue.writeBuffer(this.globalsBuffer,0,t)}}class ae{position=y(1,3,3);target=y(0,0,0);up=y(0,1,0);forward=p();right=p();upVec=p();constructor(){this.updateMatrices()}updateMatrices(){T(this.forward,this.target,this.position),E(this.forward,this.forward),z(this.right,this.forward,this.up),E(this.right,this.right),z(this.upVec,this.right,this.forward),E(this.upVec,this.upVec)}orbit(e,t,s=.005){const i=p();T(i,this.position,this.target);let o=k(i);o<1e-4&&(o=1e-4);let r=Math.atan2(i[2],i[0]),c=Math.acos(i[1]/o);r+=e*s,c-=t*s;const a=.1;c=Math.max(a,Math.min(Math.PI-a,c)),i[0]=o*Math.sin(c)*Math.cos(r),i[1]=o*Math.cos(c),i[2]=o*Math.sin(c)*Math.sin(r),W(this.position,this.target,i)}pan(e,t,s=.01){const i=p();T(i,this.target,this.position),E(i,i);const o=p();z(o,i,this.up),E(o,o);const r=p();z(r,o,i),S(this.position,this.position,o,-e*s),S(this.target,this.target,o,-e*s),S(this.position,this.position,r,t*s),S(this.target,this.target,r,t*s)}zoom(e,t=.05,s=1,i=50){const o=p();T(o,this.position,this.target);let r=k(o);r<1e-4&&(r=1e-4),r+=e*t,r=Math.max(s,Math.min(i,r)),E(o,o),$(o,o,r),W(this.position,this.target,o)}}class A{_element;title="";constructor(e,t){this._element=e??document.createElement("div"),t&&(this.title=t)}loaded(){this.resize()}get element(){return this._element}}class le extends A{canvas;init(){this.canvas=this._element.querySelector("canvas"),this.resize()}resize(){const e=this._element.getBoundingClientRect();this.canvas.width=e.width,this.canvas.height=e.height}}class de extends A{items=[];activeItem=null;init(){this._element.addEventListener("click",()=>{this.activeItem&&this.activateItem(null)});const e=document.createElement("div");e.textContent="Scene",this._element.prepend(e)}resize(){}addItem(e){const t=document.createElement("div");t.classList.add("scene-panel-item"),t.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation(),e.onClick(e),this.activateItem(e)});const s=document.createElement("div");s.textContent=e.text;const i=document.createElement("div");i.classList.add("buttons");const o=document.createElement("div");o.textContent="⎘",o.classList.add("copy-button"),o.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation(),e.onCopy(e)});const r=document.createElement("div");r.textContent="x",r.classList.add("del-button"),r.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation(),this.removeItem(e)}),i.append(o,r),t.append(s,i),this._element.appendChild(t),e.html=t,this.items.push(e)}removeItem(e){console.log(this.items);const t=this.items.findIndex(s=>s===e);t>=0&&(this.activeItem===e&&this.activateItem(null),e.onDelete(e),e.html.remove(),this.items.splice(t,1))}activateItem(e){this.activeItem&&(this.activeItem.html.classList.remove("activate"),this.activeItem.onLeave(this.activeItem)),this.activeItem=e,e&&(e.html.classList.add("activate"),e.onActivate(e))}}class fe extends A{items=[];selectedItem=null;onSelect=null;init(){const e=document.createElement("div");e.textContent="Toolbox",this._element.prepend(e),this._element.classList.add("toolbox-panel"),this.render()}resize(){}setItems(e){this.items=e,this.render()}render(){const e=this._element.firstElementChild;this._element.innerHTML="",e&&this._element.appendChild(e);const t=document.createElement("div");t.className="toolbox-list",this.items.forEach(s=>{const i=document.createElement("div");i.classList.add("scene-panel-item","toolbox-card"),this.selectedItem===s&&i.classList.add("activate");const o=this.getIconForTool(s.id);o.className="toolbox-icon";const r=document.createElement("div");r.className="toolbox-label",r.textContent=s.label,i.append(o,r),i.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation(),this.selectedItem=s,this.onSelect?.(s),this.render()}),t.appendChild(i)}),this._element.appendChild(t)}getIconForTool(e){const t=document.createElement("img");switch(t.className="toolbox-icon",e){case l.SPHERE:t.src="icons/sphere.png";break;case l.CUBE:t.src="icons/cube.png";break;case l.TORUS:t.src="icons/torus.png";break;case l.CYLINDER:t.src="icons/cylinder.png";break;case l.CONE:t.src="icons/cone.png";break;case l.CAPSULE:t.src="icons/capsule.png";break}return t}}class ue extends A{_target=null;onFieldChange=null;init(){const e=document.createElement("div");e.textContent="Properties",e.className="panel-titlebar",this._element.appendChild(e);const t=document.createElement("p");t.className="properties-empty",t.innerText="No object selected",t.style.color="gray",this._element.appendChild(t)}resize(){}setTarget(e){this._target=e,this.render()}render(){const e=this._element.firstElementChild;if(this._element.innerHTML="",e&&this._element.appendChild(e),!this._target){const t=document.createElement("p");t.className="properties-empty",t.textContent="No object selected",t.style.color="gray",this._element.appendChild(t);return}this._element.appendChild(this.createVec3Section("Position","position",this._target.position)),this._element.appendChild(this.createVec3Section("Rotation","rotation",this._target.rotation)),this._element.appendChild(this.createVec3Section("Scale","scale",this._target.scale)),this._element.appendChild(this.createColorSection("Color","color",this._target.color))}createVec3Section(e,t,s){const i=document.createElement("div");i.classList.add("scene-panel-item","prop-section");const o=document.createElement("div");o.className="prop-title",o.textContent=e,i.appendChild(o);const r=document.createElement("div");return r.className="prop-row",["X","Y","Z"].forEach((a,h)=>{const _=document.createElement("div");_.className="prop-input-wrapper";const G=document.createElement("label");G.textContent=a,G.className="prop-label";const v=document.createElement("input");v.type="number",v.step="0.5",v.value=s[h].toString(),v.className="prop-input",v.addEventListener("input",()=>{if(!this._target)return;const X=parseFloat(v.value);Number.isNaN(X)||(this._target[t][h]=X,this.onFieldChange?.(t,this._target))}),_.append(G,v),r.appendChild(_)}),i.appendChild(r),i}createColorSection(e,t,s){const i=document.createElement("div");i.classList.add("scene-panel-item","prop-section");const o=document.createElement("div");o.className="prop-title",o.textContent=e,i.appendChild(o);const r=document.createElement("div");r.className="prop-row";const c=document.createElement("div");c.className="prop-input-wrapper";const a=document.createElement("label");a.textContent="Color",a.className="prop-label";const h=document.createElement("input");return h.type="color",h.className="prop-color-input",h.value=this.vec3ToHex(s),h.addEventListener("input",()=>{if(!this._target)return;const _=this.hexToVec3(h.value);this._target.color[0]=_[0],this._target.color[1]=_[1],this._target.color[2]=_[2],this.onFieldChange?.(t,this._target)}),c.append(a,h),r.appendChild(c),i.appendChild(r),i}vec3ToHex(e){const t=Math.round(Math.min(Math.max(e[0],0),1)*255),s=Math.round(Math.min(Math.max(e[1],0),1)*255),i=Math.round(Math.min(Math.max(e[2],0),1)*255),o=r=>r.toString(16).padStart(2,"0");return`#${o(t)}${o(s)}${o(i)}`}hexToVec3(e){const t=e.replace("#",""),s=parseInt(t.slice(0,2),16)/255,i=parseInt(t.slice(2,4),16)/255,o=parseInt(t.slice(4,6),16)/255;return[s,i,o]}}async function pe(n){if(!navigator.gpu)throw Error("WebGPU not supported.");const e=await navigator.gpu.requestAdapter();if(!e)throw Error("Couldn't request WebGPU adapter.");const t=await e.requestDevice(),s=n.getContext("webgpu");if(!s)throw Error("Couldn't request WebGPU context.");const i=navigator.gpu.getPreferredCanvasFormat();return s.configure({device:t,format:i,alphaMode:"premultiplied"}),{context:s,device:t,format:i}}const he=document.getElementById("scene"),w=new le(he);w.init();w.loaded();const me=document.getElementById("scene-manager"),x=new de(me);x.init();x.loaded();const _e=document.getElementById("toolbox"),N=new fe(_e);N.init();const ve=document.getElementById("properties"),M=new ue(ve);M.init();const ge=[{id:l.SPHERE,label:"Sphere"},{id:l.CUBE,label:"Cube"},{id:l.TORUS,label:"Torus"},{id:l.CYLINDER,label:"Cylinder"},{id:l.CONE,label:"Cone"},{id:l.CAPSULE,label:"Capsule"}];function H(n){const e=n.data;f.selectObject(e),M.setTarget(e)}function be(n){const e=n.data;Z(e.copy())}function xe(n){const e=n.data;f.removeObject(e)}function ye(){f.selectObject(null),M.setTarget(null)}function Ee(n,e,t){let s=-1;for(const i of t){const o=i.text;if(o.startsWith(n)){const r=o.slice(n.length),c=parseInt(r);isNaN(c)||(s=Math.max(s,c))}}return`${n}${s+1}`}N.setItems(ge);N.onSelect=n=>{const e=n.label.toLowerCase().replace(/\s+/g,""),t=Ee(e,n.id,x.items),s=new g({name:t,primitive:n.id,position:[0,.5,0],scale:[.5,.5,.5]});Z(s)};M.onFieldChange=(n,e)=>{e.update?.()};const u=w.canvas,{device:Ce,context:Ie,format:Se}=await pe(u),f=new b({device:Ce,context:Ie,format:Se}),d=new ae;let R=!1,U=!1,m,j=[0,0],P=[0,0];p();let L=null,Y=p(),B=p(),O=J(),q=0;u.addEventListener("mousedown",async n=>{const e=u.getBoundingClientRect(),t=n.clientX-e.left,s=n.clientY-e.top;if(j=[t,s],P=j,n.button===0&&(R=!0),n.button===2&&(U=!0),n.button===2&&n.preventDefault(),f.updateGlobals({mouse:[t,s]}),m=f.checkCollision(),m&&m.position,n.button===0&&m&&m.type==="gizmo"){const i=f.activeObject;if(!i)return;d.updateMatrices();const o=m.index;L=o,q=0,I(Y,i.position),te(B,0,0,0),B[o]=1;const r=F(B,d.right),c=-F(B,d.upVec);se(O,r,c);const a=re(O);if(a<1e-4){L=null;return}oe(O,O,1/a)}});u.addEventListener("mouseup",async n=>{const e=u.getBoundingClientRect(),t=n.clientX-e.left,s=n.clientY-e.top;if(n.button===0&&(R=!1,L=null),n.button===2&&(U=!1),t>P[0]-5&&t<P[0]+5&&s>P[1]-5&&s<P[1]+5)if(m=f.checkCollision(),console.log(m),m?.type=="object"){const i=m.object,o=x.items.find(r=>r.data===i)??null;x.activateItem(o)}else m?.type==null&&x.activateItem(null)});u.addEventListener("mouseleave",()=>{R=!1,U=!1});u.addEventListener("contextmenu",n=>n.preventDefault());u.addEventListener("mousemove",async n=>{const e=u.getBoundingClientRect(),t=n.clientX-e.left,s=n.clientY-e.top,i=t-j[0],o=s-j[1];j=[t,s],f.updateGlobals({mouse:[t,s]});const r=.005,c=.01;if(R)if(L!==null){const a=f.activeObject;if(!a)return;const h=ie(i,o),_=ce(h,O);q+=_;const v=ne(d.position,Y)*.002;S(a.position,Y,B,q*v),a.update()}else d.orbit(i,o,r),d.updateMatrices();U&&(d.pan(i,o,c),d.updateMatrices())});u.addEventListener("wheel",n=>{d.zoom(n.deltaY),d.updateMatrices()},{passive:!1});function K(){w.resize(),f.updateGlobals({resolution:[u.width,u.height]})}K();window.addEventListener("resize",K);Z(new g({name:"sphere0",primitive:l.SPHERE,position:[0,.5,0],scale:[.5,.5,.5]}),!1);function Z(n,e=!0){f.addObject(n);const t={text:n.name,data:n,onClick:H,onCopy:be,onActivate:H,onLeave:ye,onDelete:xe};x.addItem(t),e&&x.activateItem(t)}let V=performance.now();function Q(n){const e=n/1e3,t=(n-V)/1e3;V=n,f.updateGlobals({resolution:[u.width,u.height],camPos:d.position,camFwd:d.forward,camRight:d.right,camUp:d.upVec,time:e,deltaTime:t,objectCount:f.getObjectCount()}),f.render(),requestAnimationFrame(Q)}requestAnimationFrame(Q);
