const iconsDirectory = "/icons";

export function Icon(name: string) {
    const container = document.createElement("div");
    container.classList.add("icon");
    loadIcon(name).then((svgData) => (container.innerHTML = svgData));
    return container;
}

const iconCache = new Map<string, Promise<string>>();
function loadIcon(name: string) {
    let icon = iconCache.get(name);

    if (!icon) {
        icon = fetchIcon(name);
        iconCache.set(name, icon);
    }

    return icon;
}

async function fetchIcon(name: string) {
    const response = await fetch(`${iconsDirectory}/${name}.svg`);
    return response.text();
}
