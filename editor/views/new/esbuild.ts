import { Dialog } from "../../components/dialog";
import rpc from "../../rpc";

export const esbuildInstaller = {
    installPromise: null as Promise<void>,
    install: () => {
        esbuildInstaller.installPromise = InstallEsbuild();
        esbuildInstaller.installPromise
            .then(() => {
                esbuildInstaller.install = null;
            });
        rpc().esbuild.install();
    }
}

function InstallEsbuild() {
    const container = document.createElement("div");
    container.classList.add("esbuild-installer");

    container.innerHTML = `<h3>Esbuild Installation</h3>`;

    const stepsList = document.createElement("ul");

    container.append(stepsList);

    const addStep = (title: string, subtitle: string) => {
        const step = document.createElement("li");

        step.innerHTML = `
            <div>${title}</div>
            <div<small>${subtitle}</small></div>
        `

        const progressBar = document.createElement("div");
        progressBar.classList.add("progress");
        step.append(progressBar);

        stepsList.append(step);

        return (progress: number) => progressBar.style.width = (progress * 100).toFixed(2) + "%";
    }

    const { remove } = Dialog(container);

    return new Promise<void>(resolve => {
        const steps = [
            addStep("Package", "download"),
            addStep("Package", "unpack"),
            addStep("Binary", "download"),
            addStep("Binary", "unpack")
        ];

        globalThis.onPush["esbuildInstall"] = (message: string) => {
            const { step, progress } = JSON.parse(message);
            steps[step](progress);
            if (step === steps.length - 1 && progress === 1) {
                remove();
                resolve();
            }
        };
    })
}