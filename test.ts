import child_process from "child_process";
import puppeteer from "puppeteer";
import { PROJECTS_TITLE } from "./editor/webview/views/projects/constants";

// typecheck
child_process.execSync("npm run typecheck", {
    stdio: "inherit"
});

const throwError = (message: string) => {
    const error = Error(message);
    console.error(error);
    process.exit(1);
};

// test build
await import("./build");

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
await page.waitForSelector("h1");
const getHeadingText = () => document.querySelector("h1")?.textContent;
const projectsTitle = await page.evaluate(getHeadingText);
if (projectsTitle !== PROJECTS_TITLE) {
    const errorMsg = `Projects title does not math. Expected [${PROJECTS_TITLE}] Found [${projectsTitle}]`;
    throwError(errorMsg);
}

process.exit(0);
