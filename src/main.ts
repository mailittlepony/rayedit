
import "./style.css"
import { Renderer } from "./renderer";
import { Object, PrimitiveType } from "./object";


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

let context: GPUCanvasContext;
let format: GPUTextureFormat;
let device: GPUDevice;


// --- Entry Point ---
const app = document.querySelector("#app")!;

const canvas = document.createElement("canvas");
app.appendChild(canvas);

const gpu = await initWebGPU(canvas);
device = gpu.device;
context = gpu.context;
format = gpu.format;

const renderer = new Renderer({ device, context, format });

function animate(t: number) {
    
    renderer.render();
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let boule = new Object({
    name: "Maili",
    primitive: PrimitiveType.TORUS,
    position: [-1, 0, 0],
    scale: [0.5, 0.2, 1.0]
});

let caca = new Object({
    name: "Maili",
    primitive: PrimitiveType.CUBOID,
    position: [1, 0, 0],
    scale: [0.5, 0.2, 1.0]
})

renderer.addObject(boule);

renderer.addObject(caca);

// obj.updateObject(1, {
//     position: [0, 0, 0]
// })

//--- Event Listeners---
//
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    renderer.updateGlobals({
        resolution: [canvas.width, canvas.height]
    });
}
resize();

window.addEventListener("resize", resize);
