import { packages } from "./packages";
import { editor } from "./editor";
import { projects } from "./projects";

export const Store = {
    projects,
    editor,
    packages
};

export function createSubscribable<T>(
    getter: () => T,
    placeolderValue?: Awaited<T>
): {
    notify: () => void;
    subscription: {
        subscribe: (onUpdate: (value: Awaited<T>) => void) => void;
        unsubscribe: (onUpdate: (value: Awaited<T>) => void) => void;
    };
} {
    const subscribers = new Set<(value: Awaited<T>) => void>();

    let value: Awaited<T> = placeolderValue;

    const notifySubscribers = (updatedValue: Awaited<T> | undefined) => {
        value = updatedValue;
        subscribers.forEach((subscriber) => subscriber(value));
    };

    const notify = () => {
        const maybePromise = getter();

        if (maybePromise instanceof Promise) {
            maybePromise.then(notifySubscribers);
        } else {
            notifySubscribers(maybePromise as Awaited<T>);
        }
    };

    const subscribe = (onUpdate: (value: Awaited<T>) => void) => {
        subscribers.add(onUpdate);
        onUpdate(value);
    };

    const unsubscribe = (onUpdate: (value: Awaited<T>) => void) => {
        subscribers.delete(onUpdate);
    };

    const initialValue = getter();
    if (initialValue instanceof Promise) {
        initialValue.then(notifySubscribers);
    } else {
        value = initialValue as Awaited<T>;
    }

    return {
        notify,
        subscription: {
            subscribe,
            unsubscribe
        }
    };
}
