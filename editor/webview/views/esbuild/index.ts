import "./index.css";

export class EsbuildInstall {
    onComplete: () => void;

    constructor() {
        (window as any).onPush["esbuildInstall"] = () => {

        }
    }

    render() {
        const container = document.createElement("div");
        container.classList.add("esbuild-install")

        const image = document.createElement("img");
        image.src = "assets/dev-icon.png";
        container.append(image);

        const stepsList = document.createElement("ol");
        const steps = [
            "Downloading esbuild package",
            "Extracting esbuild package",
            "Downloading esbuild binary",
            "Extracting esbuild binary"
        ]
        steps.forEach(step => {
            const li = document.createElement("li");
            li.innerText = step;
            stepsList.append(li);
        });
        container.append(stepsList);

        return container;
    }
}