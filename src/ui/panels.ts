
export abstract class Panel {
    protected _element: HTMLElement;

    constructor(rootElement?: HTMLElement) {
        this._element = rootElement ?? document.createElement("div");
    }

    abstract init(): void;
    abstract resize(): void;

    loaded(): void {
        this.resize();
    }

    get element() {
        return this._element;
    }
}

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

