
export abstract class Panel {
    protected _element: HTMLElement;
    title: string = "";

    constructor(rootElement?: HTMLElement, title?: string) {
        this._element = rootElement ?? document.createElement("div");
        if (title) this.title = title;
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

