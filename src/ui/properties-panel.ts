import type { vec3 } from "gl-matrix";
import { Panel } from "./panel";

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

            input.addEventListener("input", () => {
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


