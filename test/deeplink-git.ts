import child_process, { ChildProcess } from "child_process";
import puppeteer from "puppeteer";
import { sleep, throwError } from "./utils";
import { PROJECT_TITLE_ID, RUN_PROJECT_ID } from "../editor/constants";

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
const page = await browser.newPage();
await page.goto("http://localhost:9000");

// wait for title
await page.waitForSelector(`h1`);
await sleep(3000);

await page.evaluate(async () => {
    const getDemoProject = () => {
        const demoProjects = Array.from(
            document.querySelectorAll("article")
        ).filter((article) => {
            const title = article.querySelector("h3")?.innerText;
            return (
                title &&
                (title === "Demo" ||
                    title === "fullstackedorg/editor-sample-demo")
            );
        });
        return demoProjects?.at(0);
    };

    while (getDemoProject()) {
        getDemoProject().querySelector("button").click();
        await new Promise((res) => setTimeout(res, 1000));
    }
});
await sleep(3000);

editorProcess1.kill();

const DEMO_TITLE = "Demo";
editorProcess2 = child_process.exec(
    `node index.js https://github.com/fullstackedorg/editor-sample-demo.git?title=${DEMO_TITLE}`,
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

await page.reload();

await page.waitForSelector(`#${RUN_PROJECT_ID}`);

await page.waitForSelector(`#${PROJECT_TITLE_ID}`);
const actualDemoTitle = await (
    await (await page.$(`#${PROJECT_TITLE_ID}`)).getProperty("textContent")
).jsonValue();

if (actualDemoTitle !== DEMO_TITLE) {
    throwError(
        `Didn't find the right title for Demo opened by deep link. Expected [${DEMO_TITLE}] Found [${actualDemoTitle}]`
    );
}

cleanup();
process.exit(0);
