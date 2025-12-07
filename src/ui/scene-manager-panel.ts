import { Panel } from "./panel";

export type SceneItem = {
    text: string;
    data: any;
    html?: HTMLElement;
    onClick: (item: SceneItem) => void;
    onActivate: (item: SceneItem) => void;
    onCopy: (item: SceneItem) => void;
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
        const header = document.createElement("div");
        header.textContent = "Scene";
        this._element.prepend(header);
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

        const btnDiv = document.createElement("div");
        btnDiv.classList.add("buttons");

        const cpyBtn = document.createElement("div");
        cpyBtn.textContent = "⎘";
        cpyBtn.classList.add("copy-button");
        cpyBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onCopy(item);
        });

        const delBtn = document.createElement("div");
        delBtn.textContent = "x";
        delBtn.classList.add("del-button");
        delBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.removeItem(item);
        });
        btnDiv.append(cpyBtn, delBtn);

        itemElmt.append(textElmt, btnDiv);
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

        this.activeItem = item;

        if (item) {
            item.html!.classList.add("activate");
            item.onActivate(item);
        }
    }
}

