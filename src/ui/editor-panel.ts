
import { EditorState } from "@codemirror/state";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { EditorView, basicSetup } from "codemirror";
import { indentUnit } from "@codemirror/language";
import { Panel } from "./panel";


const wgslStreamParser: StreamParser<null> = {
    startState() {
        return null;
    },

    token(stream, _state) {
        if (stream.eatSpace()) return null;

        // Line comment
        if (stream.match("//")) {
            stream.skipToEnd();
            return "comment";
        }

        // Block comment /* ... */
        if (stream.match("/*")) {
            while (!stream.eol()) {
                if (stream.match("*/", false)) {
                    stream.match("*/");
                    break;
                }
                stream.next();
            }
            return "comment";
        }

        // Attributes: @vertex, @fragment, ...
        if (stream.match(/@(vertex|fragment|compute|builtin|location|binding|group|stage|workgroup_size|interpolate|invariant)/)) {
            return "attribute";
        }

        // Keywords
        if (stream.match(/\b(fn|let|var|const|if|else|for|while|loop|return|break|continue|discard|switch|case|default|struct|type|alias)\b/)) {
            return "keyword";
        }

        // Types
        if (stream.match(/\b(bool|i32|u32|f32|f16|vec2|vec3|vec4|mat2x2|mat3x3|mat4x4|array|sampler|texture_2d|texture_3d)\b/)) {
            return "typeName";
        }

        // Generic vector/matrix/array<T>
        if (stream.match(/\b(vec2|vec3|vec4|mat2x2|mat3x3|mat4x4|array)<[^>]+>/)) {
            return "typeName";
        }

        // Builtins
        if (stream.match(/\b(abs|acos|all|any|asin|atan|atan2|ceil|clamp|cos|cosh|cross|degrees|determinant|distance|dot|exp|exp2|faceforward|floor|fma|fract|frexp|inversesqrt|ldexp|length|log|log2|max|min|mix|modf|normalize|pow|radians|reflect|refract|round|sign|sin|sinh|smoothstep|sqrt|step|tan|tanh|transpose|trunc)\b/)) {
            return "builtin";
        }

        // Numbers
        if (stream.match(/\b\d+\.?\d*[fu]?\b|0x[0-9a-fA-F]+[ul]?/)) {
            return "number";
        }

        // Operators
        if (stream.match(/[+\-*/%=<>!&|^~?:]/)) {
            return "operator";
        }

        // Punctuation
        if (stream.match(/[{}()\[\];,\.]/)) {
            return "punctuation";
        }

        // Otherwise, just move one char to avoid infinite loop
        stream.next();
        return null;
    },

    languageData: {
        commentTokens: {
            line: "//",
            block: { open: "/*", close: "*/" },
        },
    },
};

export const wgslLanguage = StreamLanguage.define(wgslStreamParser);

export const gruvboxDarkHard = EditorView.theme({
  "&": {
    color: "#ebdbb2",
    backgroundColor: "#1d2021"
  },
  ".cm-content": {
    caretColor: "#fe8019",
  },
  ".cm-gutters": {
    backgroundColor: "#1d2021",
    color: "#928374",
    border: "none"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 6px"
  }
}, { dark: true });

import { keymap } from "@codemirror/view";
import { indentMore, indentLess } from "@codemirror/commands";

const customTab = keymap.of([
  {
    key: "Tab",
    preventDefault: true,
    run: indentMore,   // indent selection / current line
  },
  {
    key: "Shift-Tab",
    preventDefault: true,
    run: indentLess,   // outdent
  },
]);




export type EditorPanelOptions = {
    parent: HTMLElement;
    initialCode: string;
    onChange?: (code: string) => void;
    onCompile?: (code: string) => void;
};

export class EditorPanel extends Panel {
    private view: EditorView | null = null;
    private onChange: ((code: string) => void) | null = null;

    constructor(opts: EditorPanelOptions) {
        super(opts.parent);

        this.onChange = opts.onChange ?? null;

        const compileBtn = document.createElement("button");
        compileBtn.textContent = "Compile";
        compileBtn.addEventListener("click", () => {
            opts.onCompile?.(this.getCode());
        })

        const editorContainer = document.createElement("div");
        
        editorContainer.className = "editor-container";
        editorContainer.style.width = "100%";
        editorContainer.style.height = "100%";
        editorContainer.style.overflow = "auto";
        this.element.append(compileBtn, editorContainer);

        // Initialize CodeMirror inside editorContainer
        this.view = new EditorView({
            parent: editorContainer,
            state: EditorState.create({
                doc: opts.initialCode ?? "",
                extensions: [
                    basicSetup,
                    wgslLanguage,
                    gruvboxDarkHard,
                    customTab,
                    indentUnit.of("  "),
                    EditorView.lineWrapping,
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return;
                        if (!this.onChange) return;

                        const code = update.state.doc.toString();
                        this.onChange(code);
                    })
                ],
            }),
        });
    }

    init() { };
    resize() { };

    setCode(code: string) {
        if (!this.view) return;
        const transaction = this.view.state.update({
            changes: { from: 0, to: this.view.state.doc.length, insert: code },
        });
        this.view.dispatch(transaction);
    }

    /** Get current editor content */
    getCode(): string {
        return this.view ? this.view.state.doc.toString() : "";
    }

    /** Change the callback after creation */
    setOnChange(fn: (code: string) => void) {
        this.onChange = fn;
    }

}

