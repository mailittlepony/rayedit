import { vec3 } from "gl-matrix";


export const PrimitiveType = {
    // Core 3D SDF primitives
    SPHERE: 0,
    ELLIPSOID: 0,

    CUBE: 1,
    CUBOID: 1,

    TORUS: 2,
    CYLINDER: 3,
    CONE: 4,
    CAPSULE: 5,
} as const;

export type PrimitiveType = typeof PrimitiveType[keyof typeof PrimitiveType];


export class Object {

    static OBJECT_GPU_WPAD_SIZE_BYTES = 80;
    // CPU fields
    public name: string;

    // GPU fields
    private _id!: number;
    public primitive: PrimitiveType;
    public position: vec3;
    public rotation: vec3;
    public scale: vec3;
    public color: vec3;

    private _device!: GPUDevice;
    private _objectBuffer!: GPUBuffer;

    constructor(params: {
        name?: string;
        primitive?: PrimitiveType;
        position?: vec3;
        rotation?: vec3;
        scale?: vec3;
        color?: vec3;

    }) {
        this.name = params.name ?? String(this.id);
        this.primitive = params.primitive ?? PrimitiveType.SPHERE;
        this.position = params.position ?? vec3.fromValues(0,0.5,0);
        this.rotation = params.rotation ?? vec3.fromValues(0, 0, 0);
        this.scale = params.scale ?? vec3.fromValues(0.5, 0.5, 0.5);
        this.color = params.color ?? vec3.fromValues(1, 1, 1);
    }

    get id() { return this._id; }

    update(): void {
        const data = new Float32Array(Object.OBJECT_GPU_WPAD_SIZE_BYTES / 4);
        const rotCpy = vec3.create();
        vec3.scale(rotCpy, this.rotation, Math.PI/180);

        data.set([this._id!, this.primitive], 0)
        data.set(this.position ?? [0, 0, 0], 4);
        data.set(rotCpy ?? [0, 0, 0], 8);
        data.set(this.scale ?? [1, 1, 1], 12);
        data.set(this.color ?? [1, 1, 1], 16);

        this._device.queue.writeBuffer(this._objectBuffer, this._id! * Object.OBJECT_GPU_WPAD_SIZE_BYTES, data.buffer);
    }

    copy(): Object {
        const obj = new Object({
            name: `${this.name}Copy`,
            primitive: this.primitive,
        })

        vec3.copy(obj.position, this.position);
        vec3.copy(obj.rotation, this.rotation);
        vec3.copy(obj.scale, this.scale);
        vec3.copy(obj.color, this.color);

        return obj;
    }
}
