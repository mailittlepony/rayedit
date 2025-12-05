
import { vec3 } from "gl-matrix";

export class Camera {
    position: vec3 = vec3.fromValues(0, 2, 4);
    target: vec3   = vec3.fromValues(0, 0, 0);
    up: vec3       = vec3.fromValues(0, 1, 0);

    viewDir: vec3  = vec3.create();
    forward: vec3  = vec3.create(); 
    right: vec3    = vec3.create();
    upVec: vec3    = vec3.create();

    constructor() {
        this.updateMatrices();
    }

    updateMatrices() {
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

    orbit(dx: number, dy: number, speed: number) {
        const orbitSpeed = speed;
        const offset = vec3.create();
        vec3.subtract(offset, this.position, this.target);

        // Horizontal 
        const angleY = dx * orbitSpeed;      
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);

        const ox = offset[0];
        const oz = offset[2];
        offset[0] = ox * cosY - oz * sinY;
        offset[2] = ox * sinY + oz * cosY;

        // Vertical 
        const angleX = dy * orbitSpeed;

        const forward = vec3.create();
        vec3.normalize(forward, offset);
        const right = vec3.create();
        vec3.cross(right, forward, this.up);
        vec3.normalize(right, right);
        const rotUp = vec3.create();
        vec3.cross(rotUp, right, forward);
        vec3.scaleAndAdd(offset, offset, rotUp, angleX * 5.0); 
        vec3.add(this.position, this.target, offset);
    }

    pan(dx: number, dy: number, speed: number) {
        const panSpeed = speed;
        const forward = vec3.create();
        vec3.subtract(forward, this.target, this.position);
        vec3.normalize(forward, forward);

        const right = vec3.create();
        vec3.cross(right, forward, this.up);
        vec3.normalize(right, right);

        const up = vec3.fromValues(0, 1, 0);
        vec3.scaleAndAdd(this.position, this.position, right, -dx * panSpeed);
        vec3.scaleAndAdd(this.target,   this.target,   right, -dx * panSpeed);
        vec3.scaleAndAdd(this.position, this.position, up, dy * panSpeed);
        vec3.scaleAndAdd(this.target,   this.target,   up, dy * panSpeed);
    }

    zoom(delta: number) {
        const zoomAmount = delta * 0.01;
        const dir = vec3.create();
        vec3.subtract(dir, this.position, this.target);
        let dist = vec3.length(dir);
        if (dist < 0.0001) return;
        vec3.normalize(dir, dir);
        dist += zoomAmount;
        dist = Math.max(1.0, Math.min(30.0, dist)); 

        vec3.scale(dir, dir, dist);
        vec3.add(this.position, this.target, dir);
    }
}

