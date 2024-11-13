export function PackagesInstallProgress() {
    const container = document.createElement("div");
    container.classList.add("packages-install-progress");

    const title = document.createElement("h3");
    title.innerText = "Dependencies";

    container.append(title);

    const installList = document.createElement("ul");

    container.append(installList);

    const addPackage = (name: string) => {
        const item = document.createElement("li");

        const packageName = document.createElement("div");
        packageName.innerText = name;
        item.append(packageName);

        const status = document.createElement("div");
        item.append(status);

        const progress = document.createElement("div");
        progress.classList.add("progress-bar");
        item.append(progress);

        installList.append(item);

        const setters = {
            setStatus: (text: string) => {
                status.innerText = text;
                return setters;
            },
            setProgress: (loaded: number, total: number) => {
                progress.style.width =
                    ((loaded / total) * 100).toFixed(2) + "%";
                return setters;
            },
            remove: () => item.remove()
        };

        return setters;
    };

    return {
        container,
        addPackage
    };
}
