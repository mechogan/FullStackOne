import child_process, { ChildProcess } from "child_process";
import puppeteer from "puppeteer";
import { sleep, throwError } from "./utils";
import { PROJECT_VIEW_ID, RUN_PROJECT_ID } from "../editor/constants";

let editorProcess1: ChildProcess, editorProcess2: ChildProcess;

const cleanup = () => {
    editorProcess1?.kill();
    editorProcess2?.kill();
};

const onError = (e) => {
    console.log(e);
    cleanup();
    throwError("Deep Link/git test failed");
};

process.on("uncaughtException", onError);
process.on("unhandledRejection", onError);

editorProcess1 = child_process.exec("node index.js", {
    cwd: process.cwd() + "/platform/node",
    env: {
        ...process.env,
        NO_OPEN: "1"
    }
});
editorProcess1.stdout.pipe(process.stdout);
editorProcess1.stderr.pipe(process.stderr);
editorProcess1.on("error", onError);
await sleep(7000);

// Lets go delete our Demo projects
const browser = await puppeteer.launch({
    headless: false
});
let page = await browser.newPage();
await page.goto("http://localhost:9000");

// wait for title
await page.waitForSelector(`h1`);
await sleep(3000);

await page.evaluate(async () => {
    const getDemoProject = () => {
        const demoProjects = Array.from(
            document.querySelectorAll(".project-tile")
        ).filter((projectTile) => {
            const title = projectTile.querySelector("h2")?.innerText;
            return (
                title &&
                (title.toLocaleLowerCase() === "demo" ||
                    title === "fullstackedorg/editor-sample-demo")
            );
        });
        return demoProjects?.at(0);
    };

    while (getDemoProject()) {
        getDemoProject().querySelector("button").click();
        await new Promise((res) => setTimeout(res, 100));
        document
            .querySelector<HTMLButtonElement>(
                ".button-group > button:first-child"
            )
            .click();
        await new Promise((res) => setTimeout(res, 100));
        document
            .querySelector<HTMLButtonElement>(".dialog button:last-child")
            .click();
        await new Promise((res) => setTimeout(res, 1000));
    }
});
await sleep(3000);

await page.close();
page = await browser.newPage();

editorProcess1.kill();

await sleep(2000);

const DEMO_TITLE = "Demo";
editorProcess2 = child_process.exec(
    `node index.js https://github.com/fullstackedorg/editor-sample-demo.git`,
    {
        cwd: process.cwd() + "/platform/node",
        env: {
            ...process.env,
            NO_OPEN: "1"
        }
    }
);
editorProcess2.stdout.pipe(process.stdout);
editorProcess2.stderr.pipe(process.stderr);
editorProcess2.on("error", onError);
await sleep(3000);

await page.goto("http://localhost:9000");

await page.waitForSelector(`#${RUN_PROJECT_ID}`);

await page.waitForSelector(`#${PROJECT_VIEW_ID} h1`);
const actualDemoTitle = await (
    await (await page.$(`#${PROJECT_VIEW_ID} h1`)).getProperty("textContent")
).jsonValue();

if (actualDemoTitle !== DEMO_TITLE) {
    throwError(
        `Didn't find the right title for Demo opened by deep link. Expected [${DEMO_TITLE}] Found [${actualDemoTitle}]`
    );
}

cleanup();
process.exit(0);
