import { createElement, ElementComponent } from "./element";

export function createRefresheable<T>(
    elementRenderer: (args: T) => ElementComponent
) {
    const refresheable = {
        element: createElement("div"),
        refresh: (newArgs: T) => {
            refresheable.element.destroy();
            const updatedElement = elementRenderer(newArgs);
            refresheable.element.replaceWith(updatedElement);
            refresheable.element = updatedElement;
        }
    };

    return refresheable;
}
