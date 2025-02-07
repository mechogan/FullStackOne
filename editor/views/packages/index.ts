import prettyBytes from "pretty-bytes";
import { Dialog } from "../../components/dialog";
import { createElement } from "../../components/element";
import { PackageInfoProgress } from "../../lib/packages";

let packagesView: {
    dialog: ReturnType<typeof Dialog>;
    view: ReturnType<typeof createPackagesView>;
};
let displayedPackages: {
    name: string;
    view: ReturnType<typeof createPackageInfoView>;
}[] = [];

export function updatePackagesView(packagesInfos: [string, PackageInfoProgress][]) {
    if (!packagesView) {
        const view = createPackagesView();
        packagesView = {
            dialog: Dialog(view.container),
            view
        };
    }

    if (removePackagesViewDialogTimeout) {
        clearTimeout(removePackagesViewDialogTimeout)
    }

    if (packagesInfos.length === 0) {
        removePackagesViewDialogTimeout = setTimeout(removePackagesViewDialog, 200)
    } else {
        for (const [name, info] of packagesInfos) {
            let packageView = displayedPackages.find(p => p.name === name);
            if (!packageView) {
                packageView = {
                    name,
                    view: createPackageInfoView(name)
                }
                packagesView.view.list.append(packageView.view.container);
                displayedPackages.push(packageView);
            }
            packageView.view.setProgress(info)
        }
    
        for (let i = displayedPackages.length - 1; i >= 0; i--) {
            const stillActive = packagesInfos.find(([name]) => name === displayedPackages[i].name);
            if (!stillActive) {
                displayedPackages[i].view.container.remove();
                displayedPackages.splice(i, 1);
            }
        }
    }
}

let removePackagesViewDialogTimeout: ReturnType<typeof setTimeout>;

function removePackagesViewDialog() {
    displayedPackages.forEach((p) => p.view.container.remove());
    packagesView.view.container.remove();
    packagesView.dialog.remove();
    displayedPackages = [];
    packagesView = null;
    removePackagesViewDialogTimeout = null;
}

function createPackagesView() {
    const container = createElement("div");
    container.classList.add("packages-view");
    const title = document.createElement("h3");
    title.innerText = "Dependencies";
    container.append(title);
    const list = document.createElement("ul");
    container.append(list);
    return { container, list };
}

function createPackageInfoView(packageName: string) {
    const container = createElement("li");

    const name = document.createElement("div");
    name.innerText = packageName;

    const status = document.createElement("div");

    const progressLine = document.createElement("div");
    progressLine.classList.add("progress-bar");

    container.append(name, status, progressLine);

    const setProgress = (progress: PackageInfoProgress) => {
        let statusText = progress.stage;

        if (progress.stage === "downloading" && progress.loaded !== 0) {
            statusText = `(${prettyBytes(progress.loaded)}/${prettyBytes(progress.total)}) ${statusText}`;
        } else if (progress.stage === "unpacking" && progress.loaded !== 0) {
            statusText = `(${progress.loaded}/${progress.total}) ${statusText}`;
        } else if (progress.stage === "done") {
            statusText = "installed";
        } else {
            statusText = progress.stage;
        }

        status.innerText = statusText;
        progressLine.style.width =
            ((progress.loaded / progress.total) * 100).toFixed(2) + "%";
    };

    return { container, setProgress };
}
