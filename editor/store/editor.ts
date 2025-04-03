import { createSubscribable } from ".";

let sidePanelClosed = false;
const sidePanel = createSubscribable(() => sidePanelClosed);

const codeEditorOpenedFiles = new Set<string>();
const openedFiles = createSubscribable(() => codeEditorOpenedFiles);

let codeEditorFocusedFile: string;
const focusedFile = createSubscribable(() => codeEditorFocusedFile);

export type BuildError = {
    file: string;
    line: number;
    col: number;
    length: number;
    message: string;
};
let codeEditorBuildErrors: BuildError[] = [];
const buildErrors = createSubscribable(() => codeEditorBuildErrors);

export const editor = {
    sidePanelClosed: sidePanel.subscription,
    setSidePanelClosed,

    codeEditor: {
        openedFiles: openedFiles.subscription,
        openFile,
        closeFile,
        closeFilesUnderDirectory,

        focusedFile: focusedFile.subscription,
        focusFile,

        clearFiles,

        buildErrors: buildErrors.subscription,
        addBuildErrors,
        clearAllBuildErrors
    }
};

function setSidePanelClosed(closed: boolean) {
    sidePanelClosed = closed;
    sidePanel.notify();
}

function openFile(path: string) {
    codeEditorOpenedFiles.add(path);
    openedFiles.notify();
}

function closeFile(path: string) {
    codeEditorOpenedFiles.delete(path);
    if (path === codeEditorFocusedFile) {
        if (codeEditorOpenedFiles.size > 0) {
            codeEditorFocusedFile = Array.from(codeEditorOpenedFiles).at(-1);
        } else {
            codeEditorFocusedFile = null;
        }
        focusedFile.notify();
    }
    openedFiles.notify();
}

function closeFilesUnderDirectory(path: string) {
    for (const openedFile of codeEditorOpenedFiles.values()) {
        if (openedFile.startsWith(path)) {
            codeEditorOpenedFiles.delete(openedFile);
        }
    }
    openedFiles.notify();
}

function focusFile(path: string) {
    codeEditorFocusedFile = path;
    focusedFile.notify();
}

function clearFiles() {
    codeEditorOpenedFiles.clear();
    codeEditorFocusedFile = null;
    openedFiles.notify();
    focusedFile.notify();
}

function addBuildErrors(errors: BuildError[]) {
    codeEditorBuildErrors.push(...errors);
    buildErrors.notify();
}

function clearAllBuildErrors() {
    codeEditorBuildErrors = [];
    buildErrors.notify();
}
