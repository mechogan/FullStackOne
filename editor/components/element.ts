export type ElementComponent = HTMLElement & {
    destroy: () => void
    ondestroy: () => void
}

export function createElement(element: keyof HTMLElementTagNameMap) {
    const e = document.createElement(element) as ElementComponent;
    e.destroy = () => e.ondestroy?.();
    return e;
}