import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { Button } from "../../../components/primitives/button";

export function Editor() {
    const container = document.createElement("div");
    container.classList.add("editor");

    const editorContainer = document.createElement("div");

    container.append(FileTabs(), editorContainer);

    new EditorView({
        doc: "Hello World",
        extensions: [basicSetup, oneDark],
        parent: editorContainer
    });

    return container;
}

function FileTabs() {
    const container = document.createElement("ul");
    container.classList.add("file-tabs");

    [
        "index.ts",
        "index.scss",
        "index.html",
        "index.html",
        "index.html"
    ].forEach((item) => {
        const li = document.createElement("li");

        const closeButton = Button({
            style: "icon-small",
            iconLeft: "Close"
        });

        li.append(item, closeButton);

        container.append(li);
    });

    return container;
}
