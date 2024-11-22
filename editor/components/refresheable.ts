import { createElement, ElementComponent } from "./element";

export function createRefresheable<
    T extends (...args: any) => ElementComponent | Promise<ElementComponent>,
    P extends Parameters<T>
>(
    elementRenderer: (
        ...args: P
    ) => ElementComponent | Promise<ElementComponent>,
    placeholder?: ElementComponent
) {
    const refresheable = {
        element: placeholder || (createElement("div") as ElementComponent<any>),
        refresh: (...newArgs: P) => {
            refresheable.element.destroy();
            const updatedElement = elementRenderer(...newArgs);
            if (updatedElement instanceof Promise) {
                updatedElement.then((e) => {
                    refresheable.element.replaceWith(e);
                    refresheable.element = e;
                });
            } else {
                refresheable.element.replaceWith(updatedElement);
                refresheable.element = updatedElement;
            }
        }
    };

    return refresheable;
}
