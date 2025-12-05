
import "./style.css";
import { Renderer } from "./core/renderer";
import { Object, PrimitiveType } from "./core/object";
import { Camera } from "./core/camera";


// --- WebGPU init ---
async function initWebGPU(canvas: HTMLCanvasElement)
: Promise<{ context: GPUCanvasContext; device: GPUDevice; format: GPUTextureFormat }> {

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
        format,
        alphaMode: "premultiplied",
    });

    return { context, device, format };
}


// --- Globals ---
const app = document.querySelector("#app")! as HTMLDivElement;

const canvas = document.createElement("canvas");
app.appendChild(canvas);

const { device, context, format } = await initWebGPU(canvas);

const renderer = new Renderer({ device, context, format });
const camera = new Camera();


// --- Mouse state ---
let isLeftDown = false;
let isRightDown = false;
let lastMouse: [number, number] = [0, 0];

canvas.addEventListener("mousedown", (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    lastMouse = [e.clientX - rect.left, e.clientY - rect.top];

    if (e.button === 0) isLeftDown  = true; 
    if (e.button === 2) isRightDown = true; 

    // Disable right-click menu
    if (e.button === 2) e.preventDefault();
});

canvas.addEventListener("mouseup", (e: MouseEvent) => {
    if (e.button === 0) isLeftDown  = false;
    if (e.button === 2) isRightDown = false;
});

canvas.addEventListener("mouseleave", () => {
    isLeftDown = false;
    isRightDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousemove", (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - lastMouse[0];
    const dy = y - lastMouse[1];
    lastMouse = [x, y];

    const orbitSpeed = 0.005;
    const panSpeed = 0.01;

    if (isLeftDown) {
        camera.orbit(dx, dy, orbitSpeed);
        camera.updateMatrices();
    }

    if (isRightDown) {
        camera.pan(dx, dy, panSpeed);
        camera.updateMatrices();
    }
});

canvas.addEventListener("wheel", (e: WheelEvent) => {
    camera.zoom(e.deltaY);
    camera.updateMatrices();
}, { passive: false });


// --- Resize handling ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    renderer.updateGlobals({
        resolution: [canvas.width, canvas.height] as any,
    });
}
resize();
window.addEventListener("resize", resize);


//--- Schene objects ---
// const boule = new Object({
//     name: "Maili",
//     primitive: PrimitiveType.TORUS,
//     position: [-1, 0, 0] as any,
//     scale: [0.5, 0.2, 1.0] as any,
// });

const caca = new Object({
    name: "Maili",
    primitive: PrimitiveType.CYLINDER,
    position: [3, 0.5, 0] as any,
    rotation: [1, 0, 0],
    scale: [0.5, 1, 1.0] as any,
    color: [1, 0, 0],
});

// renderer.addObject(boule);
renderer.addObject(caca);

// caca.position[0] -= 2;
caca.updateObject();


// --- Animation loop ---
let lastTime = performance.now();

function animate(now: number) {
    const t = now / 1000;                   
    const dt = (now - lastTime) / 1000;    
    lastTime = now;

    renderer.updateGlobals({
        resolution: [canvas.width, canvas.height] as any,
        camPos: camera.position,
        camFwd: camera.forward,
        camRight: camera.right,
        camUp: camera.upVec,
        time: t,
        deltaTime: dt,
        objectCount: renderer.getObjectCount(),
    });


    renderer.render();
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

