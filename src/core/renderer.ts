
import raymarchWGSL from "./shaders/raymarch.wgsl?raw";
import type { vec2, vec3 } from "gl-matrix";
import { Object as SceneObject } from "./object";

export type Globals = {
    resolution?: vec2;

    camPos?: vec3;
    camFwd?: vec3;
    camRight?: vec3;
    camUp?: vec3;

    time?: number;
    deltaTime?: number;
    objectCount?: number;
};

export class Renderer {
    static readonly GLOBALS_WPAD_SIZE_BYTES = 96;

    private device: GPUDevice;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private bindGroup!: GPUBindGroup;
    private vertexBuffer!: GPUBuffer;
    private globalsBuffer!: GPUBuffer;
    private objectsBuffer!: GPUBuffer;
    private renderPipeline!: GPURenderPipeline;

    private lastGlobals: Globals = {};
    private objects: SceneObject[] = [];

    constructor(params: {
        device: GPUDevice;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }) {
        this.device = params.device;
        this.context = params.context;
        this.format = params.format;
        this.initPipelineAndBuffers();
        const cube0 = new SceneObject({ name: "cube0"});
        this.addObject(cube0);

    }
    
    getObjectCount(): number {
        return this.objects.length;
    }

    private initPipelineAndBuffers() {
        const { device } = this;

        //Fullscreen triangle vertex buffer
        const vertices = new Float32Array([
            -1.0, -1.0, // bottom-left
            3.0, -1.0, // bottom-right
            -1.0,  3.0, // top-left
        ]);

        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

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

        // globals uniform buffer
        this.globalsBuffer = device.createBuffer({
            size: Renderer.GLOBALS_WPAD_SIZE_BYTES,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        // Objects storage buffer 
        this.objectsBuffer = device.createBuffer({
            size: SceneObject.OBJECT_GPU_WPAD_SIZE_BYTES * 1,
            usage:
                GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });

        const shader = device.createShaderModule({
            code: raymarchWGSL,
        });

        this.renderPipeline = device.createRenderPipeline({
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

        this.bindGroup = device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.globalsBuffer } },
                { binding: 1, resource: { buffer: this.objectsBuffer } },
            ],
        });
    }

    render() {
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
                ],
            });
        }

        const id = this.objects.length;
        this.objects.push(obj);

        const anyObj = obj as any;
        anyObj._id = id;
        anyObj._device = this.device;
        anyObj._objectBuffer = this.objectsBuffer;

        obj.updateObject();

        this.updateGlobals({ objectCount: this.objects.length });
    }

    updateObjectOnGPU(id: number) {
        const obj = this.objects[id];
        if (!obj) throw new Error("Object id does not exist");
        obj.updateObject();
    }


    updateGlobals(globals: Globals): void {
    for (const key in globals) {
        const value = globals[key as keyof Globals];
        if (value !== undefined) {
            this.lastGlobals[key as keyof Globals] = value;
        }
    }

    const data = new Float32Array(Renderer.GLOBALS_WPAD_SIZE_BYTES / 4);

    data.set(this.lastGlobals.resolution ?? [0, 0], 0);
    data.set(this.lastGlobals.camPos ?? [0, 3, 4], 4);
    data.set(this.lastGlobals.camFwd ?? [0, 0, -1], 8);
    data.set(this.lastGlobals.camRight ?? [1, 0, 0], 12);
    data.set(this.lastGlobals.camUp ?? [0, 1, 0], 16);
    data.set([
        this.lastGlobals.time ?? 0,
        this.lastGlobals.deltaTime ?? 0,
        this.lastGlobals.objectCount ?? 0,
    ], 20);

    this.device.queue.writeBuffer(this.globalsBuffer, 0, data);
    }

}

