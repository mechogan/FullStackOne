import child_process from "child_process";
import puppeteer, { ElementHandle, KeyInput } from "puppeteer";
import {
    BACK_BUTTON_ID,
    DELETE_ALL_PACKAGES_ID,
    IMPORT_PROJECT_FILE_INPUT_ID,
    NEW_FILE_ID,
    NEW_PROJECT_ID,
    PACKAGES_BUTTON_ID,
    PROJECTS_TITLE,
    RUN_PROJECT_ID,
    SETTINGS_BUTTON_ID
} from "../editor/constants";
import { sleep, throwError } from "./utils";

// test build
await import("../build");

// test node build
child_process.execSync("npm run build", {
    cwd: "platform/node",
    stdio: "inherit"
});

// test functionalities with node
process.env.NO_OPEN = "1";
await import(process.cwd() + "/platform/node/index.js");

// Launch the browser
const browser = await puppeteer.launch({
    headless: false
});
const page = await browser.newPage();
await page.goto("http://localhost:9000");

// Check the Projects Title
await page.waitForSelector("h1");
const getHeadingText = () => document.querySelector("h1")?.textContent;
const projectsTitle = await page.evaluate(getHeadingText);
if (projectsTitle !== PROJECTS_TITLE) {
    const errorMsg = `Projects title does not match. Expected [${PROJECTS_TITLE}] Found [${projectsTitle}]`;
    throwError(errorMsg);
}

// delete all packages to test download
const settingsButton = await page.waitForSelector(`#${SETTINGS_BUTTON_ID}`);
await settingsButton.click();
const packagesButton = await page.waitForSelector(`#${PACKAGES_BUTTON_ID}`);
await packagesButton.click();
const deleteAllPackagesButton = await page.waitForSelector(
    `#${DELETE_ALL_PACKAGES_ID}`
);
await deleteAllPackagesButton.click();
const backButton = await page.waitForSelector(`#${BACK_BUTTON_ID}`);
await backButton.click();

// import demo project
const newProjectTile = await page.waitForSelector(`#${NEW_PROJECT_ID}`);
await newProjectTile.click();
const importProjectFileInput = (await page.waitForSelector(
    `#${IMPORT_PROJECT_FILE_INPUT_ID}`
)) as ElementHandle<HTMLInputElement>;
await importProjectFileInput.uploadFile("editor/build/Demo.zip");

// add file
const newFileButton = await page.waitForSelector(`#${NEW_FILE_ID}`);
await newFileButton.click();
const testFileName = "test.txt";
for (let i = 0; i < testFileName.length; i++) {
    await page.keyboard.press(testFileName[i] as KeyInput);
}
await page.keyboard.press("Enter");
let tries = 3;
while (tries) {
    tries--;
    const getFileTreeItemsTitle = () =>
        Array.from(document.querySelectorAll("ul.file-tree li span") ?? []).map(
            (e) => e.textContent.trim()
        );
    const fileTreeItems = await page.evaluate(getFileTreeItemsTitle);

    if (!fileTreeItems.includes(testFileName)) {
        if (!tries) {
            const errorMsg = `Could not found file in file tree. Searching [${testFileName}] in [${fileTreeItems.join(", ")}] `;
            throwError(errorMsg);
        } else {
            await sleep(200);
        }
    } else {
        break;
    }
}

const runProjectButton = await page.waitForSelector(`#${RUN_PROJECT_ID}`);
await runProjectButton.click();

// wait for dependencies to load
let caughtDependencies = false;
tries = 3;
while (tries) {
    tries--;

    const dependenciesDialogTitle = await page.evaluate(getHeadingText);
    if (dependenciesDialogTitle === "Dependencies") {
        caughtDependencies = true;
    } else {
        await sleep(200);
    }

    if (caughtDependencies) {
        break;
    } else if (tries === 0) {
        throwError("Never caught installing dependencies");
    }
}
tries = 5;
while (tries) {
    tries--;
    const dependenciesDialogTitle = await page.evaluate(getHeadingText);
    if (dependenciesDialogTitle === "Dependencies") {
        await sleep(3000); // max 15sec to load react
    } else {
        break;
    }
}

// try to go to launched demo
tries = 3;
while (tries) {
    tries--;
    try {
        await page.goto("http://localhost:9001");
    } catch (e) {
        if (!tries) throwError(e);

        const dependenciesDialogTitle = await page.evaluate(getHeadingText);
        console.log(dependenciesDialogTitle);
        if (dependenciesDialogTitle === "Dependencies") {
            await sleep(5000);
        } else {
            await sleep(100);
        }
    }
}

const demoHeadingText = await page.evaluate(getHeadingText);
const expected = "Welcome to FullStacked";
if (demoHeadingText !== expected) {
    const errorMsg = `Projects title does not match. Expected [${expected}] Found [${demoHeadingText}]`;
    throwError(errorMsg);
}

process.exit(0);
