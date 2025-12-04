
import "./style.css"
import raymarchWGSL from "./shaders/raymarch.wgsl?raw"
import { vec2, vec3 } from "gl-matrix"

async function initWebGPU(canvas: HTMLCanvasElement)
    : Promise<{ context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat }> {
    if (!navigator.gpu) {
        throw Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw Error("Couldn't request WebGPU adapter.");
    }

    const device = await adapter.requestDevice();

    const context = canvas.getContext("webgpu");
    if (!context) {
        throw Error("Couldn't request WebGPU context.");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: format,
        alphaMode: "premultiplied",
    });

    return { context, device, format };
}

let device: GPUDevice;
let context: GPUCanvasContext;
let format: GPUTextureFormat;

let bindGroup: GPUBindGroup;
let vertexBuffer: GPUBuffer;
let globalsBuffer: GPUBuffer;
let objectsBuffer: GPUBuffer;
let renderPipeline: GPURenderPipeline;

let lastGlobals: Globals = {};
let objects: Object[] = [];

const GLOBALS_WPAD_SIZE_BYTES = 48;
type Globals = {
    resolution?: vec2,
    mouse?: vec3,
    time?: number,
    deltaTime?: number;
    objectCount?: number;
};

const PrimitiveType = {
    SPHERE: 0.0,
    CUBOID: 1.0,
    TORUS: 2.0,
} as const;

type PrimitiveType = typeof PrimitiveType[keyof typeof PrimitiveType];

const OBJECT_GPU_WPAD_SIZE_BYTES = 80;
type Object = {
    // CPU fields
    name?: string,

    // GPU fields
    id?: number,
    primitive?: PrimitiveType,
    position?: vec3,
    rotation?: vec3,
    scale?: vec3,
    color?: vec3,
};

async function start() {
    const vertexBuffers: GPUVertexBufferLayout = [
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

    const vertices = new Float32Array([
        -1.0, -1.0, // bottom-left
        3.0, -1.0, // bottom-right
        -1.0, 3.0, // top-left
    ]);

    vertexBuffer = device.createBuffer({
        size: 3 * 2 * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

    // Buffers
    globalsBuffer = device.createBuffer({
        size: GLOBALS_WPAD_SIZE_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    objectsBuffer = device.createBuffer({
        size: OBJECT_GPU_WPAD_SIZE_BYTES * 1,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    const shader = device.createShaderModule({
        code: raymarchWGSL,
    });

    const pipelineDescriptor: GPURenderPipelineDescriptor = {
        vertex: {
            module: shader,
            entryPoint: "vs_main",
            buffers: vertexBuffers,
        },
        fragment: {
            module: shader,
            entryPoint: "fs_main",
            targets: [
                {
                    format: format,
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
        },
        layout: "auto",
    };

    renderPipeline = device.createRenderPipeline(pipelineDescriptor);

    bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0, resource: { buffer: globalsBuffer },
            },
            {
                binding: 1, resource: { buffer: objectsBuffer },
            },
        ],
    });
}

function animate(t: number) {
    const commandEncoder = device.createCommandEncoder();

    const renderPassDescriptor = {
        colorAttachments: [
            {
                loadOp: "clear",
                storeOp: "store",
                view: context.getCurrentTexture().createView(),
            },
        ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    updateGlobals({
        time: t / 1000,
    });

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);

    passEncoder.setBindGroup(0, bindGroup);

    passEncoder.draw(3);

    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(animate);
}

function updateGlobals(globals: Globals): void {
    for (const key in globals) {
        const value = globals[key as keyof Globals];

        if (value !== undefined) {
            lastGlobals[key as keyof Globals] = value;
        }
    }

    const data = new Float32Array(GLOBALS_WPAD_SIZE_BYTES / 4);

    data.set(lastGlobals.resolution ?? [0, 0], 0);
    data.set(lastGlobals.mouse ?? [0, 0, 0], 4);
    data.set([lastGlobals.time ?? 0, lastGlobals.deltaTime ?? 0, lastGlobals.objectCount ?? 0], 8);

    device.queue.writeBuffer(globalsBuffer, 0, data.buffer);
}

function addObject(obj: Object): void {
    // Resize buffer
    if (objects.length * OBJECT_GPU_WPAD_SIZE_BYTES >= objectsBuffer.size) {
        const newBuffer = device.createBuffer({
            size: objectsBuffer.size * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(
            objectsBuffer,
            0,
            newBuffer,
            0,
            objectsBuffer.size
        );
        device.queue.submit([encoder.finish()]);

        objectsBuffer.destroy();
        objectsBuffer = newBuffer;

        bindGroup = device.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: globalsBuffer } },
                { binding: 1, resource: { buffer: objectsBuffer } },
            ],
        });
    }

    obj.id = objects.length;
    objects.push(obj);
    updateObject(obj.id, obj);

    updateGlobals({
        objectCount: objects.length
    });
}

function updateObject(id: number, newparams: Object): void {
    const obj = objects[id];
    if (!obj) throw new Error("Object id does not exists");

    for (const key in newparams) {
        if (key === "id") continue;

        const value = newparams[key as keyof Object];

        if (value !== undefined) {
            obj[key as keyof Object] = value;
        }
    }
    if (!obj.primitive) obj.primitive = PrimitiveType.SPHERE;

    const data = new Float32Array(OBJECT_GPU_WPAD_SIZE_BYTES / 4);

    data.set([obj.id!, obj.primitive], 0)
    data.set(obj.position ?? [0, 0, 0], 4);
    data.set(obj.rotation ?? [0, 0, 0], 8);
    data.set(obj.scale ?? [1, 1, 1], 12);
    data.set(obj.color ?? [1, 1, 1], 16);

    device.queue.writeBuffer(objectsBuffer, obj.id! * OBJECT_GPU_WPAD_SIZE_BYTES, data.buffer);
}

function removeObject(obj: Object): void {

}

// --- Entry Point ---
const app = document.querySelector("#app")!;

const canvas = document.createElement("canvas");
app.appendChild(canvas);

const gpu = await initWebGPU(canvas);
device = gpu.device;
context = gpu.context;
format = gpu.format;

await start();
requestAnimationFrame(animate);

addObject({
    name: "Maili",
    primitive: PrimitiveType.TORUS,
    position: [-1, 0, 0],
    scale: [0.5, 0.2, 1.0]
});

const obj = addObject({
    name: "Maili",
    primitive: PrimitiveType.CUBOID,
    position: [1, 0, 0],
    scale: [0.5, 0.2, 1.0]
});

addObject({
    name: "Maili",
    primitive: PrimitiveType.CUBOID,
    position: [1, 0, -0.8],
    scale: [0.5, 0.8, 0.1]
});

updateObject(1, {
    position: [0, 0, 0]
})

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    updateGlobals({
        resolution: [canvas.width, canvas.height]
    });
}
resize();

window.addEventListener("resize", resize);
