struct Globals {
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
        let res = pick(cam_pos, rd);
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
        color[u32(id)] = 1.0;
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
    // X Cone
    let x_cone_pos = vec3<f32>(1.0, 0.0, 0.0);
    let x_gizmo_cone_d = sd_cone(rotateZ(q - x_cone_pos, PI / 2.0), 0.08, 0.08);
    if x_gizmo_cone_d < res.x {
        res = vec3<f32>(x_gizmo_cone_d, 0.0, TYPE_GIZMO);
    }

    // X Axe
    let x_gizmo_cyl_d = sd_cylinder(rotateZ(q - vec3<f32>(0.5, 0.0, 0.0), PI / 2.0), 0.02, 1.0);
    if x_gizmo_cyl_d < res.x {
        res = vec3<f32>(x_gizmo_cyl_d, 0.0, TYPE_GIZMO);
    }
    
    // Y Cone
    let y_cone_pos = vec3<f32>(0.0, 1.0, 0.0);
    let y_gizmo_cone_d = sd_cone(q - y_cone_pos, 0.08, 0.08);
    if y_gizmo_cone_d < res.x {
        res = vec3<f32>(y_gizmo_cone_d, 1.0, TYPE_GIZMO);
    }

    // Y Axe
    let y_gizmo_cyl_d = sd_cylinder(q - vec3<f32>(0.0, 0.5, 0.0), 0.02, 1.0);
    if y_gizmo_cyl_d < res.x {
        res = vec3<f32>(y_gizmo_cyl_d, 1.0, TYPE_GIZMO);
    }

    // Z Cone
    let z_cone_pos = vec3<f32>(0.0, 0.0, 1.0);
    let z_gizmo_d = sd_cone(rotateX(q - z_cone_pos, -PI / 2.0), 0.08, 0.08);
    if z_gizmo_d < res.x {
        res = vec3<f32>(z_gizmo_d, 2.0, TYPE_GIZMO);
    }

    // Z Axe
    let z_gizmo_cyl_d = sd_cylinder(rotateX(q - vec3<f32>(0.0, 0.0, 0.5), PI / 2.0), 0.02, 1.0);
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
fn pick(ro: vec3<f32>, rd: vec3<f32>) -> vec3<f32> {
    var d = 0.0;
    var id = -1.0;
    var typ = -1.0;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * d;
        let dist_mat = get_dist(p);

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
