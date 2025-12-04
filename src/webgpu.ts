
export interface initWebGPU{
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
}

export async function initWebGPU(canvas: HTMLCanvasElement)
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
