
import "./styles/style.css";
import "./styles/panels.css";
import { Renderer } from "./core/renderer";
import { Object, PrimitiveType } from "./core/object";
import { Camera } from "./core/camera";
import { SceneManagerPanel, ScenePanel, ToolboxPanel, PropertiesPanel, type SceneItem, type ToolItem } from "./ui/panels";


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


// --- Panels ---
const sceneRoot = document.getElementById("scene")!;
const scenePanel = new ScenePanel(sceneRoot);
scenePanel.init();
scenePanel.loaded();

const sceneManagerRoot = document.getElementById("scene-manager")!;
const sceneManagerPanel = new SceneManagerPanel(sceneManagerRoot);
sceneManagerPanel.init();
sceneManagerPanel.loaded();

const toolboxRoot = document.getElementById("toolbox")!;
const toolboxPanel = new ToolboxPanel(toolboxRoot);
toolboxPanel.init();

const propertiesRoot = document.getElementById("properties")!;
const propertiesPanel = new PropertiesPanel(propertiesRoot);
propertiesPanel.init();

const tools: ToolItem[] = [
    { id: PrimitiveType.SPHERE,   label: "Sphere" },
    { id: PrimitiveType.CUBE,     label: "Cube" },
    { id: PrimitiveType.TORUS,    label: "Torus" },
    { id: PrimitiveType.CYLINDER, label: "Cylinder" },
    { id: PrimitiveType.CONE,     label: "Cone" },
    { id: PrimitiveType.CAPSULE,  label: "Capsule" },
];

function onClickItem(item: SceneItem) {
    const obj = item.data as Object;

    renderer.selectObject(obj);
    propertiesPanel.setTarget(obj as any);
}

function onDeleteItem(item: SceneItem) {
    const obj = item.data as Object;

    renderer.removeObject(obj);

}
function onLeaveItem() {
    renderer.selectObject(null);
    propertiesPanel.setTarget(null);
}

function getNextObjectName(base: string, primitiveId: number, sceneItems: SceneItem[]): string {
    let maxIndex = -1;

    for (const item of sceneItems) {
        const name = item.text; 
        if (name.startsWith(base)) {
            const suffix = name.slice(base.length);
            const num = parseInt(suffix);
            if (!isNaN(num)) {
                maxIndex = Math.max(maxIndex, num);
            }
        }
    }

    return `${base}${maxIndex + 1}`;
}

toolboxPanel.setItems(tools);

toolboxPanel.onSelect = (tool) => {
    const base = tool.label.toLowerCase().replace(/\s+/g, "");
    const nextName = getNextObjectName(base, tool.id, sceneManagerPanel.items);

    const obj = new Object({
        name:nextName, 
        primitive: tool.id,
        position: [0, 0.5, 0] as any,
        scale: [0.5, 0.5, 0.5] as any,
    });

    addObject(obj);
    propertiesPanel.setTarget(obj as any);
}

propertiesPanel.onFieldChange = (_field, obj) => {
    (obj as any).update?.();   
};


// --- Globals ---
const canvas = scenePanel.canvas;
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

    if (e.button === 0) isLeftDown = true;
    if (e.button === 2) isRightDown = true;

    // Disable right-click menu
    if (e.button === 2) e.preventDefault();
});

canvas.addEventListener("mouseup", (e: MouseEvent) => {
    if (e.button === 0) isLeftDown = false;
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
    scenePanel.resize();
    renderer.updateGlobals({
        resolution: [canvas.width, canvas.height] as any,
    });
}
resize();
window.addEventListener("resize", resize);


//--- Scene objects ---
addObject(new Object({
    name: "sphere0",
    primitive: PrimitiveType.SPHERE,
    position: [0, 0.5, 0] as any,
    scale: [0.5, 0.5, 0.5] as any,
}));

function addObject(obj: Object) {
    renderer.addObject(obj);

    const item = {
        text: obj.name,
        data: obj,
        onClick: onClickItem,
        onActivate: onClickItem,
        onLeave: onLeaveItem,
        onDelete: onDeleteItem,
    } as SceneItem;

    sceneManagerPanel.addItem(item);
}


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
