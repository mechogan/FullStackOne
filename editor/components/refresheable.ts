import { createElement, ElementComponent } from "./element";

export function createRefresheable<T>(
    elementRenderer: (args: T) => ElementComponent | Promise<ElementComponent>
) {
    const refresheable = {
        element: createElement("div"),
        refresh: (newArgs: T) => {
            refresheable.element.destroy();
            const updatedElement = elementRenderer(newArgs);
            if(updatedElement instanceof Promise) {
                updatedElement.then(e => {
                    refresheable.element.replaceWith(e);
                    refresheable.element = e;
                })
            } else {
                refresheable.element.replaceWith(updatedElement);
                refresheable.element = updatedElement;
            }
        }
    };

    return refresheable;
}
