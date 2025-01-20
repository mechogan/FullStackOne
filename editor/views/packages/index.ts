import prettyBytes from "pretty-bytes";
import { Dialog } from "../../components/dialog";
import { createElement } from "../../components/element";

type PackageInfo = {
    Name: string;
    Version: string;
    Progress: {
        Stage: "error" | "downloading" | "unpacking" | "done";
        Loaded: number;
        Total: number;
    };
};

let packagesView: {
    dialog: ReturnType<typeof Dialog>;
    view: ReturnType<typeof createPackagesView>;
};
let displayedPackages: {
    name: string;
    version: string;
    done: boolean;
    view: ReturnType<typeof createPackageInfoView>;
}[] = [];

export function updatePackagesView(packageInfo: PackageInfo) {
    if (!packagesView) {
        const view = createPackagesView();
        packagesView = {
            dialog: Dialog(view.container),
            view
        };
    }

    let packageView = displayedPackages.find(
        ({ name, version }) =>
            packageInfo.Name === name && packageInfo.Version === version
    );
    if (!packageView) {
        if(removePackagesViewDialogTimeout) {
            clearTimeout(removePackagesViewDialogTimeout);
            removePackagesViewDialogTimeout = null;
        }
        packageView = {
            name: packageInfo.Name,
            version: packageInfo.Version,
            done: false,
            view: createPackageInfoView(packageInfo)
        };
        packagesView.view.list.append(packageView.view.container);
        displayedPackages.push(packageView);
    }

    packageView.view.setProgress(packageInfo.Progress);

    if (packageInfo.Progress.Stage === "done") {
        packageView.done = true;
    }

    if (displayedPackages.every((p) => p.done)) {
        if (removePackagesViewDialogTimeout) {
            clearTimeout(removePackagesViewDialogTimeout);
        }
        removePackagesViewDialogTimeout = setTimeout(
            removePackagesViewDialog,
            1000
        );
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

function createPackageInfoView(packageInfo: PackageInfo) {
    const container = createElement("li");

    const name = document.createElement("div");
    name.innerText = packageInfo.Name + "@" + packageInfo.Version;

    const status = document.createElement("div");

    const progressLine = document.createElement("div");
    progressLine.classList.add("progress-bar");

    container.append(name, status, progressLine);

    const setProgress = (progress: PackageInfo["Progress"]) => {
        let statusText = progress.Stage as string;

        if (progress.Stage === "downloading" && progress.Loaded !== 0) {
            statusText = `(${prettyBytes(progress.Loaded)}/${prettyBytes(progress.Total)}) ${statusText}`;
        } else if (progress.Stage === "unpacking" && progress.Loaded !== 0) {
            statusText = `(${progress.Loaded}/${progress.Total}) ${statusText}`;
        } else if (progress.Stage === "done") {
            statusText = "installed";
        } else {
            statusText = progress.Stage;
        }

        status.innerText = statusText;
        progressLine.style.width =
            ((progress.Loaded / progress.Total) * 100).toFixed(2) + "%";
    };

    return { container, setProgress };
}
