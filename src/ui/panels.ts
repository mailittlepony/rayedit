
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


export type SceneItem = {
    text: string;
    data: any;
    html?: HTMLElement;
    onClick: (item: SceneItem) => void;
    onLeave: (item: SceneItem) => void;
    onDelete: (item: SceneItem) => void;
};

export class SceneManagerPanel extends Panel {

    items: SceneItem[] = [];
    activeItem: SceneItem | null = null;

    init() {
        this._element.addEventListener("click", () => {
            if (this.activeItem) {
                this.activateItem(null);
            }
        })
    }

    resize() {

    }

    addItem(item: SceneItem) {
        const itemElmt = document.createElement("div");
        itemElmt.classList.add("scene-panel-item");

        itemElmt.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onClick(item);
            this.activateItem(item);
        })

        const textElmt = document.createElement("div");
        textElmt.textContent = item.text;

        const delBtn = document.createElement("button");
        delBtn.textContent = "X";
        delBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.removeItem(item);
        });

        itemElmt.append(textElmt, delBtn);
        this._element.appendChild(itemElmt);

        item.html = itemElmt;
        this.items.push(item);
    }

    removeItem(item: SceneItem) {
        console.log(this.items);
        const idx = this.items.findIndex((x) => x === item);

        if (idx >= 0) {
            if (this.activeItem === item) {
                this.activateItem(null);
            }
            item.onDelete(item);
            item.html!.remove();
            this.items.splice(idx, 1);
        }
    }

    activateItem(item: SceneItem | null) {
        if (this.activeItem) {
            this.activeItem.html!.classList.remove("activate");
            this.activeItem.onLeave(this.activeItem);
        }

        if (item) {
            item.html!.classList.add("activate");
        }

        this.activeItem = item;
    }
}





