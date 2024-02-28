import child_process from "child_process";
import puppeteer, { ElementHandle } from "puppeteer";
import {
    IMPORT_PROJECT_FILE_INPUT_ID,
    NEW_PROJECT_ID,
    PROJECTS_TITLE,
    RUN_PROJECT_ID
} from "./editor/constants";

const throwError = (message: string) => {
    const error = Error(message);
    console.error(error);
    process.exit(1);
};

// typecheck
child_process.execSync("npm run typecheck", {
    stdio: "inherit"
});

// test build
await import("./build");

// test node build
child_process.execSync("npm run build", {
    cwd: "platform/node",
    stdio: "inherit"
});

// make esbuild ios
child_process.execSync("make ios", {
    stdio: "inherit",
    cwd: "platform/ios/esbuild"
});

// build ios
child_process.execSync(
    "xcodebuild -project ./FullStacked.xcodeproj -scheme FullStacked build",
    {
        stdio: "inherit",
        cwd: "platform/ios/xcode"
    }
);

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

// import demo project
const newProjectTile = await page.waitForSelector(`#${NEW_PROJECT_ID}`);
await newProjectTile.click();
const importProjectFileInput = (await page.waitForSelector(
    `#${IMPORT_PROJECT_FILE_INPUT_ID}`
)) as ElementHandle<HTMLInputElement>;
await importProjectFileInput.uploadFile("Demo.zip");
const runProjectButton = await page.waitForSelector(`#${RUN_PROJECT_ID}`);
await runProjectButton.click();
let tries = 3;
while (tries) {
    tries--;
    try {
        await page.goto("http://localhost:9001");
    } catch (e) {
        if (!tries) throwError(e);
    }
}

const demoHeadingText = await page.evaluate(getHeadingText);
const expected = "Welcome to FullStacked";
if (demoHeadingText !== expected) {
    const errorMsg = `Projects title does not match. Expected [${expected}] Found [${demoHeadingText}]`;
    throwError(errorMsg);
}

process.exit(0);
