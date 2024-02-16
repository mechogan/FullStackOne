import "./index.css";

import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export class EsbuildInstall {
    onComplete: () => void;
    stepsList: HTMLOListElement = document.createElement("ol");

    constructor() {
        (window as any).onPush["esbuildInstall"] = (message: string) => {
            const { step, progress } = JSON.parse(message);
            const li = this.stepsList.children[step];
            let span = li.querySelector("span");
            if(!span) {
                span = document.createElement("span");
                li.append(span);
            }
            span.innerText = Math.floor(progress * 100).toString() + "%";

            if(step === this.stepsList.children.length - 1 && progress === 1)
                this.onComplete();
        }
    }

    install(){
        rpc().esbuild.install();
    }

    render() {
        const container = document.createElement("div");
        container.classList.add("esbuild-install")

        const image = document.createElement("img");
        image.src = "assets/dev-icon.png";
        container.append(image);

        const steps = [
            "Downloading esbuild package",
            "Extracting esbuild package",
            "Downloading esbuild binary",
            "Extracting esbuild binary"
        ]
        steps.forEach(step => {
            const li = document.createElement("li");
            li.innerText = step;
            this.stepsList.append(li);
        });
        container.append(this.stepsList);

        return container;
    }
}