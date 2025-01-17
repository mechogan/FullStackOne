import prettyBytes from "pretty-bytes";
import { Dialog } from "../../components/dialog";
import { Store } from "../../store";
import { Progress } from "../../store/packages";
import { createElement } from "../../components/element";

let packageInstallView: {
    remove: ReturnType<typeof Dialog>["remove"];
    updateList: ([string, Progress]) => void;
};
export function PackagesInstallProgress(
    installingPackages: Parameters<
        Parameters<typeof Store.packages.installingPackages.subscribe>[0]
    >[0]
) {
    if (installingPackages.size === 0) {
        packageInstallView?.remove();
        packageInstallView = null;
        installingPackageViews.clear();
        return;
    }

    if (!packageInstallView) {
        const { container, packagesList } = CreatePackagesInstallView();
        packageInstallView = {
            remove: Dialog(container).remove,
            updateList: ([packageName, progress]) => {
                UpdatePackageInstallProgress(
                    packagesList,
                    packageName,
                    progress
                );
            }
        };
    }

    for (const installingPackage of installingPackages.entries()) {
        packageInstallView.updateList(installingPackage);
    }
}

function CreatePackagesInstallView() {
    const container = createElement("div");
    container.classList.add("packages-install-progress");
    const title = document.createElement("h3");
    title.innerText = "Dependencies";
    container.append(title);
    const packagesList = document.createElement("ul");
    container.append(packagesList);
    return { container, packagesList };
}

const installingPackageViews = new Map<
    string,
    ReturnType<typeof CreatePackageInstallProgressView>
>();
function UpdatePackageInstallProgress(
    list: HTMLUListElement,
    packageName: string,
    progress: Progress
) {
    let progressView = installingPackageViews.get(packageName);

    if (!progressView) {
        progressView = CreatePackageInstallProgressView(packageName);
        list.append(progressView.container);
        installingPackageViews.set(packageName, progressView);
    }

    progressView.setProgress(progress);
}

function CreatePackageInstallProgressView(packageName: string) {
    const container = document.createElement("li");

    const name = document.createElement("div");
    name.innerText = packageName;
    const version = document.createElement("span");
    name.append(version);

    const status = document.createElement("div");

    const progressLine = document.createElement("div");
    progressLine.classList.add("progress-bar");

    container.append(name, status, progressLine);

    const setProgress = (progress: Progress) => {
        version.innerText = "@" + progress.Version;
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
