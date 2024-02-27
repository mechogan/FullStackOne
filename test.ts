import child_process from "child_process";
import puppeteer from "puppeteer";
import { PROJECTS_TITLE } from "./editor/webview/views/projects/constants";

// test build
await import("./build");

// test node build
child_process.execSync("npm run build", {
    cwd: "platform/node",
    stdio: "inherit",
});

// test functionalities with node
process.env.NO_OPEN = "1";
await import(process.cwd() + "/platform/node/index.js");

// Launch the browser
const browser = await puppeteer.launch({
    headless: false,
});
const page = await browser.newPage();
await page.goto("http://localhost:9000");
await page.waitForSelector("h1");
const projectsTitle = await page.evaluate(() => {
    return document.querySelector("h1")?.textContent;
});
if (projectsTitle !== PROJECTS_TITLE) {
    throw Error(
        `Projects title does not math. Expected [${PROJECTS_TITLE}] Found [${projectsTitle}]`,
    );
}

process.exit(0);
