
import { vec3 } from "gl-matrix";

export class Camera {
    position: vec3 = vec3.fromValues(1, 3, 3);
    target: vec3   = vec3.fromValues(0, 0, 0);
    up: vec3       = vec3.fromValues(0, 1, 0);

    forward: vec3  = vec3.create();
    right: vec3    = vec3.create();
    upVec: vec3    = vec3.create();

    constructor() {
        this.update();
    }

    update() {
        // forward 
        vec3.subtract(this.forward, this.target, this.position);
        vec3.normalize(this.forward, this.forward);

        // right 
        vec3.cross(this.right, this.forward, this.up);
        vec3.normalize(this.right, this.right);

        // upVec
        vec3.cross(this.upVec, this.right, this.forward);
        vec3.normalize(this.upVec, this.upVec);
    }

    orbit(dx: number, dy: number, orbitSpeed: number = 0.005) {
        const offset = vec3.create();
        vec3.subtract(offset, this.position, this.target);

        let radius = vec3.length(offset);
        if (radius < 1e-4) radius = 1e-4;

        // spherical coordinates
        let theta = Math.atan2(offset[2], offset[0]);     
        let phi   = Math.acos(offset[1] / radius);       

        theta += dx * orbitSpeed;      
        phi   -= dy * orbitSpeed;     
        const eps = 0.1;
        phi = Math.max(eps, Math.min(Math.PI - eps, phi));

        // back to cartesian
        offset[0] = radius * Math.sin(phi) * Math.cos(theta);
        offset[1] = radius * Math.cos(phi);
        offset[2] = radius * Math.sin(phi) * Math.sin(theta);

        vec3.add(this.position, this.target, offset);
    }

    pan(dx: number, dy: number, panSpeed: number = 0.01) {
        const forward = vec3.create();
        vec3.subtract(forward, this.target, this.position);
        vec3.normalize(forward, forward);

        const right = vec3.create();
        vec3.cross(right, forward, this.up);  
        vec3.normalize(right, right);

        const up = vec3.create();
        vec3.cross(up, right, forward);        

        // move both position and target 
        vec3.scaleAndAdd(this.position, this.position, right, -dx * panSpeed);
        vec3.scaleAndAdd(this.target,   this.target,   right, -dx * panSpeed);

        vec3.scaleAndAdd(this.position, this.position, up, dy * panSpeed);
        vec3.scaleAndAdd(this.target,   this.target,   up, dy * panSpeed);
    }

    zoom(delta: number, zoomSpeed: number = 0.05, minRadius: number = 1.0, maxRadius: number = 50.0) {
        const offset = vec3.create();
        vec3.subtract(offset, this.position, this.target);

        let radius = vec3.length(offset);
        if (radius < 1e-4) radius = 1e-4;

        radius += delta * zoomSpeed;
        radius = Math.max(minRadius, Math.min(maxRadius, radius));

        vec3.normalize(offset, offset);
        vec3.scale(offset, offset, radius);
        vec3.add(this.position, this.target, offset);
    }
}

