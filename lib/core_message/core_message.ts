import { SnackBar } from "../components/snackbar";

const coreMessageListeners = new Map<string, Set<(message: string) => void>>();
export const addListener = (
    messageType: string,
    cb: (message: string) => void
) => {
    let listeners = coreMessageListeners.get(messageType);
    if (!listeners) {
        listeners = new Set<typeof cb>();
        coreMessageListeners.set(messageType, listeners);
    }
    listeners.add(cb);
};
export const removeListener = (
    messageType: string,
    cb: (message: string) => void
) => {
    let listeners = coreMessageListeners.get(messageType);
    listeners?.delete(cb);
    if (listeners?.size === 0) {
        coreMessageListeners.delete(messageType);
    }
};

globalThis.oncoremessage = (messageType: string, message: string) => {
    const listeners = coreMessageListeners.get(messageType);
    if (!listeners?.size) {
        console.log(
            `No core message listener for message of type [${messageType}]`
        );
    } else {
        listeners.forEach((cb) => cb(message));
    }
};

addListener("log", console.log);
addListener("alert", (message) => {
    SnackBar({
        message,
        autoDismissTimeout: 4000
    })
});