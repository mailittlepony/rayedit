
import "./styles/style.css";
import "./styles/panels.css";
import { Renderer, type Collision } from "./core/renderer";
import { Object, PrimitiveType } from "./core/object";
import { Camera } from "./core/camera";
import { ScenePanel } from "./ui/scene-panel";
import { SceneManagerPanel, type SceneItem } from "./ui/scene-manager-panel";
import { ToolboxPanel, type ToolItem } from "./ui/toolbox-panel";
import { PropertiesPanel } from "./ui/properties-panel";
import { mat4, vec2, vec3, vec4 } from "gl-matrix";


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
    { id: PrimitiveType.SPHERE, label: "Sphere" },
    { id: PrimitiveType.CUBE, label: "Cube" },
    { id: PrimitiveType.TORUS, label: "Torus" },
    { id: PrimitiveType.CYLINDER, label: "Cylinder" },
    { id: PrimitiveType.CONE, label: "Cone" },
    { id: PrimitiveType.CAPSULE, label: "Capsule" },
];

function onClickItem(item: SceneItem) {
    const obj = item.data as Object;

    renderer.selectObject(obj);
    propertiesPanel.setTarget(obj as any);
}

function onCopyItem(item: SceneItem) {
    const obj = item.data as Object;

    addObject(obj.copy());
}

function onDeleteItem(item: SceneItem) {
    const obj = item.data as Object;

    renderer.removeObject(obj);

}
function onLeaveItem() {
    renderer.selectObject(null);
    propertiesPanel.setTarget(null);
}

function getNextObjectName(base: string, _primitiveId: number, sceneItems: SceneItem[]): string {
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
        name: nextName,
        primitive: tool.id,
        position: [0, 0.5, 0] as any,
        scale: [0.5, 0.5, 0.5] as any,
    });

    addObject(obj);
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
let col: Collision | null;
let lastMouse: [number, number] = [0, 0];
let lastClickPos: [number, number] = [0, 0];
let lastHitPos: vec3 = vec3.create();

let draggingAxis: 0 | 1 | 2 | null = null;
let dragStartObjPos = vec3.create();
let dragAxisWorld = vec3.create();
let dragAxisScreenDir = vec2.create();
let dragAmount = 0; 

canvas.addEventListener("mousedown", async (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMouse = [x, y];
    lastClickPos = lastMouse;

    if (e.button === 0) isLeftDown = true;
    if (e.button === 2) isRightDown = true;
    if (e.button === 2) e.preventDefault();

    renderer.updateGlobals({ mouse: [x, y] });

    col = renderer.checkCollision();
    if (col) lastHitPos = col.position;

    // ---- Gizmo drag ----
    if (e.button === 0 && col && col.type === "gizmo") {
        const obj = renderer.activeObject;
        if (!obj) return;

        camera.updateMatrices();

        const axisIndex = col.index as 0 | 1 | 2;
        draggingAxis = axisIndex;
        dragAmount = 0;

        vec3.copy(dragStartObjPos, obj.position);

        vec3.set(dragAxisWorld, 0, 0, 0);
        dragAxisWorld[axisIndex] = 1.0;

        // project axis to screen camera base
        const sx = vec3.dot(dragAxisWorld, camera.right);
        const sy = -vec3.dot(dragAxisWorld, camera.upVec); 

        vec2.set(dragAxisScreenDir, sx, sy);
        const len = vec2.length(dragAxisScreenDir);
        if (len < 1e-4) {
            draggingAxis = null;
            return;
        }
        vec2.scale(dragAxisScreenDir, dragAxisScreenDir, 1.0 / len);
    }

});

canvas.addEventListener("mouseup", async (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top;
    if (e.button === 0){
        isLeftDown = false;
        draggingAxis = null;
    }
    if (e.button === 2) isRightDown = false;

    if (x > lastClickPos[0] - 5 && x < lastClickPos[0] + 5
        && y > lastClickPos[1] - 5 && y < lastClickPos[1] + 5) {
        col = renderer.checkCollision();
        console.log(col);
        if (col?.type == "object") {
            const obj = col.object!;
            const item = sceneManagerPanel.items.find((item) => item.data === obj) ?? null;
            sceneManagerPanel.activateItem(item);
        }
        else if (col?.type == null) {
            sceneManagerPanel.activateItem(null);
        }
    }
});

canvas.addEventListener("mouseleave", () => {
    isLeftDown = false;
    isRightDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousemove", async (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - lastMouse[0];
    const dy = y - lastMouse[1];
    lastMouse = [x, y];

    renderer.updateGlobals({ mouse: [x, y] });

    const orbitSpeed = 0.005;
    const panSpeed = 0.01;

    if (isLeftDown) {
        if (draggingAxis !== null) {
            const obj = renderer.activeObject;
            if (!obj) return;

            // Project mouse movement on screen 
            const delta2D = vec2.fromValues(dx, dy);
            const delta1D = vec2.dot(delta2D, dragAxisScreenDir);
            dragAmount += delta1D;

            // Convert pixels to world units
            const distance = vec3.distance(camera.position, dragStartObjPos);
            const scale = distance * 0.002; 

            vec3.scaleAndAdd(obj.position, dragStartObjPos, dragAxisWorld, dragAmount * scale);
            obj.update();
        } else {
            // no gizmo drag
            camera.orbit(dx, dy, orbitSpeed);
            camera.updateMatrices();
        }
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
}), false);

function addObject(obj: Object, active: boolean = true) {
    renderer.addObject(obj);

    const item = {
        text: obj.name,
        data: obj,
        onClick: onClickItem,
        onCopy: onCopyItem,
        onActivate: onClickItem,
        onLeave: onLeaveItem,
        onDelete: onDeleteItem,
    } as SceneItem;

    sceneManagerPanel.addItem(item);
    if (active) sceneManagerPanel.activateItem(item);
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
