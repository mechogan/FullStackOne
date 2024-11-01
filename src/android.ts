export function bindPassRequestBody(
    passRequestBody: (id: number, body: Uint8Array) => Promise<void> | void
) {
    const originalFetch = globalThis.fetch;
    (globalThis as typeof window).fetch = async (...args) => {
        if (args?.[1]) {
            const id = generateRandomId();
            const headers = args?.[1]?.headers || {};
            headers["request-id"] = id.toString();
            args[1].headers = headers;
            const maybePromise = passRequestBody(
                id,
                args?.[1]?.body as Uint8Array
            );
            if (maybePromise instanceof Promise) {
                await maybePromise;
            }
        }
        return originalFetch(...args);
    };
}

export function generateRandomId(min = 0, max = 99999999) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
