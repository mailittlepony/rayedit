import { Panel } from "./panel";

export class ScenePanel extends Panel {
    canvas!: HTMLCanvasElement;

    init() {
        this.canvas = this._element.querySelector("canvas") as HTMLCanvasElement;
        this.resize();
    }

    resize() {
        const rect = this._element.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
}


