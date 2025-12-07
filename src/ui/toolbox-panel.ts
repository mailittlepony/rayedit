import { Panel } from "./panel";
import { PrimitiveType } from "../core/object";


export type ToolItem = {
    id: PrimitiveType;
    label: string;
};

export class ToolboxPanel extends Panel {
    items: ToolItem[] = [];
    selectedItem: ToolItem | null = null;

    onSelect: ((item: ToolItem) => void) | null = null;

    init() {
        const header = document.createElement("div");
        header.textContent = "Toolbox";
        this._element.prepend(header);
        this._element.classList.add("toolbox-panel");
        this.render();
    }

    resize() {}

    setItems(items: ToolItem[]) {
        this.items = items;
        this.render();
    }

    private render() {
        const header = this._element.firstElementChild;
        this._element.innerHTML = "";
        if (header) this._element.appendChild(header);

        const list = document.createElement("div");
        list.className = "toolbox-list";

        this.items.forEach((item) => {
            const card = document.createElement("div");
            card.classList.add("scene-panel-item", "toolbox-card");

            if (this.selectedItem === item) {
                card.classList.add("activate"); 
            }

            const icon = this.getIconForTool(item.id);
            icon.className = "toolbox-icon";

            const label = document.createElement("div");
            label.className = "toolbox-label";
            label.textContent = item.label;

            card.append(icon, label);

            card.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.selectedItem = item;
                this.onSelect?.(item);
                this.render(); 
            });

            list.appendChild(card);
        });

        this._element.appendChild(list);
    }

    private getIconForTool(id: PrimitiveType): HTMLImageElement {
        const img = document.createElement("img");
        img.className = "toolbox-icon"
        switch (id) {
            case PrimitiveType.SPHERE:
                img.src = "icons/sphere.png";
                break;
            case PrimitiveType.CUBE: 
                img.src = "icons/cube.png";
                break;
            case PrimitiveType.TORUS:
                img.src = "icons/torus.png";
                break;
            case PrimitiveType.CYLINDER:
                img.src = "icons/cylinder.png";
                break;
            case PrimitiveType.CONE:
                img.src = "icons/cone.png";
                break;
            case PrimitiveType.CAPSULE: 
                img.src = "icons/capsule.png";
                break;
        }
        return img;
    }
}

