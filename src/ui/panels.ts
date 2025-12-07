import { PrimitiveType } from "../core/object";
import type { vec3 } from "gl-matrix";

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
    onActivate: (item: SceneItem) => void;
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

        this.activeItem = item;

        if (item) {
            item.html!.classList.add("activate");
            item.onActivate(item);
        }
    }
}


export type InspectableObject = {
    position: vec3;
    rotation: vec3;
    scale: vec3;
    color: vec3;
};

type FieldName = "position" | "rotation" | "scale" | "color";

export class PropertiesPanel extends Panel {
    private _target: InspectableObject | null = null;

    onFieldChange: ((field: FieldName, obj: InspectableObject) => void) | null = null;

    init() {
        // header
        const header = document.createElement("div");
        header.textContent = "Properties";
        header.className = "panel-titlebar";
        this._element.appendChild(header);

        // initial content
        const p = document.createElement("p");
        p.className = "properties-empty";
        p.innerText = "No object selected";
        p.style.color = "gray";
        this._element.appendChild(p);
    }

    resize() {}

    setTarget(target: InspectableObject | null) {
        this._target = target;
        this.render();
    }

    private render() {
        const header = this._element.firstElementChild;
        this._element.innerHTML = "";
        if (header) this._element.appendChild(header);

        if (!this._target) {
            const p = document.createElement("p");
            p.className = "properties-empty";
            p.textContent = "No object selected";
            p.style.color = "gray";
            this._element.appendChild(p);
            return;
        }

        this._element.appendChild(this.createVec3Section("Position", "position", this._target.position));
        this._element.appendChild(this.createVec3Section("Rotation", "rotation", this._target.rotation));
        this._element.appendChild(this.createVec3Section("Scale",    "scale",    this._target.scale));
        this._element.appendChild(this.createColorSection("Color", "color", this._target.color));
    }

    private createVec3Section(label: string, field: FieldName, v: vec3): HTMLElement {
        const section = document.createElement("div");
        section.classList.add("scene-panel-item", "prop-section");

        const title = document.createElement("div");
        title.className = "prop-title";
        title.textContent = label;
        section.appendChild(title);

        const row = document.createElement("div");
        row.className = "prop-row";

        const comps = ["X", "Y", "Z"];

        comps.forEach((c, idx) => {
            const wrapper = document.createElement("div");
            wrapper.className = "prop-input-wrapper";

            const lab = document.createElement("label");
            lab.textContent = c;
            lab.className = "prop-label";

            const input = document.createElement("input");
            input.type = "number";
            input.step = "0.1";
            input.value = v[idx].toString();
            input.className = "prop-input";

            input.addEventListener("change", () => {
                if (!this._target) return;
                const val = parseFloat(input.value);
                if (!Number.isNaN(val)) {
                    this._target[field][idx] = val;
                    this.onFieldChange?.(field, this._target);
                }
            });

            wrapper.append(lab, input);
            row.appendChild(wrapper);
        });

        section.appendChild(row);
        return section;
    }

    private createColorSection(label: string, field: FieldName, v: vec3): HTMLElement {
        const section = document.createElement("div");
        section.classList.add("scene-panel-item", "prop-section");

        const title = document.createElement("div");
        title.className = "prop-title";
        title.textContent = label;
        section.appendChild(title);

        const row = document.createElement("div");
        row.className = "prop-row";

        const wrapper = document.createElement("div");
        wrapper.className = "prop-input-wrapper";

        const lab = document.createElement("label");
        lab.textContent = "Color";
        lab.className = "prop-label";

        const input = document.createElement("input");
        input.type = "color";
        input.className = "prop-color-input";
        input.value = this.vec3ToHex(v);

        input.addEventListener("input", () => {
            if (!this._target) return;
            const col = this.hexToVec3(input.value);
            this._target.color[0] = col[0];
            this._target.color[1] = col[1];
            this._target.color[2] = col[2];
            this.onFieldChange?.(field, this._target);
        });

        wrapper.append(lab, input);
        row.appendChild(wrapper);
        section.appendChild(row);

        return section;
    }

    private vec3ToHex(v: vec3): string {
        const r = Math.round(Math.min(Math.max(v[0], 0), 1) * 255);
        const g = Math.round(Math.min(Math.max(v[1], 0), 1) * 255);
        const b = Math.round(Math.min(Math.max(v[2], 0), 1) * 255);

        const toHex = (n: number) => n.toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    private hexToVec3(hex: string): vec3 {
        const clean = hex.replace("#", "");
        const r = parseInt(clean.slice(0, 2), 16) / 255;
        const g = parseInt(clean.slice(2, 4), 16) / 255;
        const b = parseInt(clean.slice(4, 6), 16) / 255;
        return [r, g, b] as vec3;
    }
}


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

