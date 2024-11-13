import { createSubscribable } from ".";

let sidePanelClosed = false;
const sidePanel = createSubscribable(() => sidePanelClosed);

const fileTreeOpenedDirectories = new Set<string>();
const openedDirectories = createSubscribable(() => fileTreeOpenedDirectories);

let fileTreeActiveItem: string;
const activeItem = createSubscribable(() => fileTreeActiveItem);

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

    fileTree: {
        openedDirectories: openedDirectories.subscription,
        toggleDirectory,
        clearOpenedDirectories,

        activeItem: activeItem.subscription,
        setActiveItem
    },

    codeEditor: {
        openedFiles: openedFiles.subscription,
        openFile,
        closeFile,

        focusedFile: focusedFile.subscription,
        focusFile,

        clearFiles,

        buildErrors: buildErrors.subscription,
        addBuildError,
        clearAllBuildErrors
    }
};

function setSidePanelClosed(closed: boolean) {
    sidePanelClosed = closed;
    sidePanel.notify();
}

function toggleDirectory(directory: string) {
    if (fileTreeOpenedDirectories.has(directory)) {
        fileTreeOpenedDirectories.delete(directory);
    } else {
        fileTreeOpenedDirectories.add(directory);
    }
    openedDirectories.notify();
}

function clearOpenedDirectories() {
    fileTreeOpenedDirectories.clear();
    openedDirectories.notify();
}

function setActiveItem(item: string) {
    fileTreeActiveItem = item;
    activeItem.notify();
}

function openFile(path: string) {
    codeEditorOpenedFiles.add(path);
    openedFiles.notify();
}

function closeFile(path: string) {
    codeEditorOpenedFiles.delete(path);
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

function addBuildError(error: BuildError) {
    codeEditorBuildErrors.push(error);
    buildErrors.notify();
}

function clearAllBuildErrors() {
    codeEditorBuildErrors = [];
    buildErrors.notify();
}
