import { editor } from "./editor";
import { projects } from "./projects";
import { preferences } from "./preferences";

export const Store = {
    preferences,
    projects,
    editor
};

export function createSequential<T extends any[], R extends Promise<any>>(
    fn: (...args: T) => R
) {
    let toRun: {
        args: T;
        fn: (...args: T) => R;
        resolve: (args: Awaited<R>) => void;
    }[] = [];

    let lock = false;

    const execute = async () => {
        if (lock) return;

        lock = true;

        while (toRun.length) {
            const toExecute = toRun.shift();
            const result = await toExecute.fn(...toExecute.args);
            toExecute.resolve(result);
        }

        lock = false;
    };

    return (...args: T) => {
        const promise = new Promise<Awaited<R>>((resolve) => {
            toRun.push({
                args,
                fn,
                resolve
            });
        });

        execute();

        return promise;
    };
}

export function createSubscribable<T>(
    getter: () => T,
    placeolderValue?: Awaited<T>
): {
    notify: () => void;
    subscription: {
        check: () => T;
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
            check: () => value,
            subscribe,
            unsubscribe
        }
    };
}
