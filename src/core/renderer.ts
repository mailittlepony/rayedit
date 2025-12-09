
import raymarchWGSL from "./shaders/raymarch.wgsl?raw";
import type { vec2, vec3 } from "gl-matrix";
import { Object as SceneObject } from "./object";


export type Globals = {
    resolution?: vec2;
    mouse?: vec2;

    camPos?: vec3;
    camFwd?: vec3;
    camRight?: vec3;
    camUp?: vec3;

    time?: number;
    deltaTime?: number;
    objectCount?: number;
    activeObjectIdx?: number;
};

export type Collision = {
    type: "object" | "gizmo" | null;
    index: number;
    object: SceneObject | null;
    position: vec3;
}

export class Renderer {
    static readonly GLOBALS_WPAD_SIZE_BYTES = 96;
    static readonly COLLISION_WPAD_SIZE_BYTES = 32;

    private device: GPUDevice;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private bindGroup!: GPUBindGroup;
    private vertexBuffer!: GPUBuffer;
    private globalsBuffer!: GPUBuffer;
    private objectsBuffer!: GPUBuffer;
    private collisionBuffer!: GPUBuffer;
    private collisionStagingBuffer!: GPUBuffer;
    private collisionPending: boolean = false;
    private lastCollision: Collision | null = null;

    private renderPipeline!: GPURenderPipeline;

    private lastGlobals: Globals = {};
    private objects: SceneObject[] = [];
    private _activeObject: SceneObject | null = null;
    get activeObject() { return this._activeObject; }

    constructor(params: {
        device: GPUDevice;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }) {
        this.device = params.device;
        this.context = params.context;
        this.format = params.format;
    }

    getObjectCount(): number {
        return this.objects.length;
    }

    async init() {
        const { device } = this;

        //Fullscreen triangle vertex buffer
        const vertices = new Float32Array([
            -1.0, -1.0, // bottom-left
            3.0, -1.0, // bottom-right
            -1.0, 3.0, // top-left
        ]);

        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        // globals uniform buffer
        this.globalsBuffer = device.createBuffer({
            size: Renderer.GLOBALS_WPAD_SIZE_BYTES,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Objects storage buffer 
        this.objectsBuffer = device.createBuffer({
            size: SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES * 1,
            usage:
                GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        // Active object index buffers
        this.collisionBuffer = device.createBuffer({
            size: Renderer.COLLISION_WPAD_SIZE_BYTES,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        this.selectObject(null);

        this.collisionStagingBuffer = device.createBuffer({
            size: Renderer.COLLISION_WPAD_SIZE_BYTES,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        await this.compileShader();
    }

    async compileShader(user_sdf?: string): Promise<readonly GPUCompilationMessage[]> {
        const vertexBuffers: GPUVertexBufferLayout[] = [
            {
                arrayStride: 2 * 4,
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2",
                    },
                ],
                stepMode: "vertex",
            },
        ];

        const splitShader1 = raymarchWGSL.split("// SDF User-Custom - Begin");
        const splitShader2 = splitShader1[1].split("// SDF User-Custom - End");
        const defaultUserSdf = splitShader2[0];
        const topPartShader = splitShader1[0];
        const bottomPartShader = splitShader2[1];

        const insertedShder = topPartShader + (user_sdf ?? defaultUserSdf) + bottomPartShader;

        // Create pipeline
        const shader = this.device.createShaderModule({
            code: insertedShder,
        });

        const shaderLog = await shader.getCompilationInfo();

        let error = shaderLog.messages.find((msg: GPUCompilationMessage) => msg.type === "error") != undefined ? true: false;

        if (error) {
            return shaderLog.messages;
        }

        this.renderPipeline = this.device.createRenderPipeline({
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: "triangle-list",
            },
            layout: "auto",
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.globalsBuffer } },
                { binding: 1, resource: { buffer: this.objectsBuffer } },
                { binding: 2, resource: { buffer: this.collisionBuffer } },
            ],
        });

        return [];
    }

    render(time: number) {
        this.updateGlobals({
            time
        });

        const commandEncoder = this.device.createCommandEncoder();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.context.getCurrentTexture().createView(),
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.draw(3);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);

        this.readCollisionBuffer();
    }

    addObject(obj: SceneObject): void {
        const device = this.device;

        // Resize buffer
        if (
            this.objects.length * SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES >=
            this.objectsBuffer.size
        ) {
            const newBuffer = device.createBuffer({
                size: this.objectsBuffer.size * 2,
                usage:
                    GPUBufferUsage.STORAGE |
                    GPUBufferUsage.COPY_DST |
                    GPUBufferUsage.COPY_SRC,
            });

            const encoder = device.createCommandEncoder();
            encoder.copyBufferToBuffer(
                this.objectsBuffer,
                0,
                newBuffer,
                0,
                this.objectsBuffer.size
            );
            device.queue.submit([encoder.finish()]);

            this.objectsBuffer.destroy();
            this.objectsBuffer = newBuffer;

            for (const o of this.objects) {
                (o as any)._objectBuffer = this.objectsBuffer;
            }

            this.bindGroup = device.createBindGroup({
                layout: this.renderPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.globalsBuffer } },
                    { binding: 1, resource: { buffer: this.objectsBuffer } },
                    { binding: 2, resource: { buffer: this.collisionBuffer } },
                ],
            });
        }

        const id = this.objects.length;
        this.objects.push(obj);

        const anyObj = obj as any;
        anyObj._id = id;
        anyObj._device = this.device;
        anyObj._objectBuffer = this.objectsBuffer;

        obj.update();

        this.updateGlobals({ objectCount: this.objects.length });
    }

    removeObject(obj: SceneObject): void {
        if (obj.id != this.objects.length) {
            const lastObj = this.objects[this.objects.length - 1];
            (lastObj as any)._id = obj.id;
            this.objects[obj.id] = lastObj;

            const temp = this.device.createBuffer({
                size: SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
            });

            const encoder = this.device.createCommandEncoder();
            encoder.copyBufferToBuffer(
                this.objectsBuffer,
                (this.objects.length - 1) * SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES,
                temp,
                0,
                SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES,
            );
            encoder.copyBufferToBuffer(
                temp,
                0,
                this.objectsBuffer,
                obj.id * SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES,
                SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES,
            );
            this.device.queue.submit([encoder.finish()]);
        }

        this.objects.pop();
        this.updateGlobals({
            objectCount: this.objects.length
        });

    }

    selectObject(obj: SceneObject | null): void {
        // this.device.queue.writeBuffer(this.activeObjectBuffer, 0, new Float32Array([obj?.id ?? -1]));
        this.updateGlobals({
            activeObjectIdx: obj?.id ?? -1
        });
        this._activeObject = obj;
    }

    checkCollision(): Collision | null {
        return this.lastCollision;
    }

    async readCollisionBuffer(): Promise<void> {
        if (this.collisionPending) {
            return;
        }

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(
            this.collisionBuffer,
            0,
            this.collisionStagingBuffer,
            0,
            Renderer.COLLISION_WPAD_SIZE_BYTES,
        );

        this.collisionPending = true;
        this.device.queue.submit([encoder.finish()]);

        await this.collisionStagingBuffer.mapAsync(
            GPUMapMode.READ,
            0,
            Renderer.COLLISION_WPAD_SIZE_BYTES,
        );

        this.collisionPending = false;

        const copyArrayBuffer = this.collisionStagingBuffer.getMappedRange(0, Renderer.COLLISION_WPAD_SIZE_BYTES);
        const data = copyArrayBuffer.slice();
        this.collisionStagingBuffer.unmap();
        const dataArr = new Float32Array(data);

        let type: "object" | "gizmo" | null = null;
        if (dataArr[0] == 0) type = "object";
        else if (dataArr[0] == 1) type = "gizmo";

        const index = dataArr[1];

        const col = {
            type: type,
            index: index,
            object: this.objects[index] ?? null,
            position: dataArr.slice(4, 7) as vec3,
        };

        this.lastCollision = col;
    }

    updateObjectOnGPU(id: number): void {
        const obj = this.objects[id];
        if (!obj) throw new Error("Object id does not exist");
        obj.update();
    }


    updateGlobals(globals: Globals): void {
        for (const key in globals) {
            const value = globals[key as keyof Globals];
            if (value !== undefined) {
                (this.lastGlobals as any)[key as keyof Globals] = value;
            }
        }

        const data = new Float32Array(Renderer.GLOBALS_WPAD_SIZE_BYTES / 4);

        data.set(this.lastGlobals.resolution ?? [0, 0], 0);
        data.set(this.lastGlobals.mouse ?? [0, 0], 2);
        data.set(this.lastGlobals.camPos ?? [0, 3, 4], 4);
        data.set(this.lastGlobals.camFwd ?? [0, 0, -1], 8);
        data.set(this.lastGlobals.camRight ?? [1, 0, 0], 12);
        data.set(this.lastGlobals.camUp ?? [0, 1, 0], 16);
        data.set([
            this.lastGlobals.time ?? 0,
            this.lastGlobals.deltaTime ?? 0,
            this.lastGlobals.objectCount ?? 0,
            this.lastGlobals.activeObjectIdx ?? 0,
        ], 20);

        this.device.queue.writeBuffer(this.globalsBuffer, 0, data);
    }

}

