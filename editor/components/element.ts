export type ElementComponent<T = HTMLElement> = T & {
    destroy: () => void;
    ondestroy: () => void;
};

export function createElement<T extends keyof HTMLElementTagNameMap>(element: T) {
    const e = document.createElement(element) as ElementComponent<HTMLElementTagNameMap[T]>;
    e.destroy = () => e.ondestroy?.();
    return e;
}
