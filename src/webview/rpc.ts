import type { api } from "../api";

async function fetchCall(pathComponents: string[], ...args) {
    const url = new URL(window.location.origin);
    url.pathname = pathComponents.join("/");

    const response = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(args)
    });

    return response.headers.get("content-type")?.startsWith("application/json")
        ? response.json()
        : response.text();
}

function recurseInProxy(target: Function, pathComponents: string[] = []){
    return new Proxy(target, {
        apply: (target, _, argArray) => {
            return target(pathComponents, ...argArray);
        },
        get: (_, p) =>  {
            pathComponents.push(p as string);
            return recurseInProxy(target, pathComponents);
        }
    })
}

export const rpc = () => recurseInProxy(fetchCall) as unknown as AwaitAll<typeof api>;


type OnlyOnePromise<T> = T extends PromiseLike<any>
    ? T
    : Promise<T>;

type AwaitAll<T> = {
    [K in keyof T]:  T[K] extends ((...args: any) => any)
        ? (...args: T[K] extends ((...args: infer P) => any) ? P : never[]) =>
            OnlyOnePromise<(T[K] extends ((...args: any) => any) ? ReturnType<T[K]> : any)>
        : AwaitAll<T[K]>
}