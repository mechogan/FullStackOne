type PopoverOpts = {
    anchor: HTMLElement,
    content: HTMLElement,
    align: {
        y: "top" | "center" | "bottom",
        x: "left" | "center" | "right"
    }
}

export function Popover(opts: PopoverOpts) {
    const anchorStyle = getComputedStyle(opts.anchor);

    opts.anchor.style.position = anchorStyle.position || "relative";

    const container = document.createElement("div");
    container.classList.add("popover");

    switch (opts.align.x) {
        case "left":
            container.classList.add("left");
            break;
        case "center":
            container.classList.add("center-x");
            break;
        case "right":
            container.classList.add("right");
            break;
    }

    switch (opts.align.y) {
        case "top":
            container.classList.add("top");
            break;
        case "center":
            container.classList.add("center-y");
            break;
        case "bottom":
            container.classList.add("bottom");
            break;
    }

    const overlay = document.createElement("div");
    overlay.classList.add("popover-overlay");

    container.append(opts.content);

    const remove = () => {
        overlay.remove();
        container.remove();
        unlockScroll(opts.anchor);
    }

    container.addEventListener("click", e => {
        e.stopPropagation();
        remove()
    });

    container.addEventListener("scroll", e => {
        e.stopPropagation();
        remove()
    });

    overlay.onclick = () => remove();

    lockScroll(opts.anchor);
    opts.anchor.append(
        overlay,
        container
    );
}

const lockedScroll = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
};

const keys = ["ArrowDown", "ArrowUp", "PageUp", "PageDown"];
const lockedKeys = (e: KeyboardEvent) => {
    if(keys.includes(e.key)) {
        return lockedScroll(e);
    }
}



function lockScroll(el: HTMLElement){
    el.addEventListener("scroll", lockedScroll);
    el.addEventListener("wheel", lockedScroll);
    el.addEventListener("touchmove", lockedScroll);
    el.addEventListener("keydown", lockedKeys);
    if(el.parentElement) {
        lockScroll(el.parentElement)
    }
}

function unlockScroll(el: HTMLElement){
    el.removeEventListener("scroll", lockedScroll);
    el.removeEventListener("wheel", lockedScroll);
    el.removeEventListener("touchmove", lockedScroll);
    el.removeEventListener("keydown", lockedKeys);
    if(el.parentElement) {
        unlockScroll(el.parentElement)
    }
}