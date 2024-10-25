export function ViewScrollable() {
    const container = document.createElement("div");
    container.classList.add("view-scrollable");

    const scrollable = document.createElement("div");
    scrollable.classList.add("scrollable");

    container.append(scrollable);

    return { container, scrollable };
}
