import puppeteer from "puppeteer";
import { sleep, throwError } from "../utils";

await import("./index");

// Launch the browser
const browser = await puppeteer.launch({
    headless: false
});
const page = await browser.newPage();
await page.goto("http://localhost:9000");

let iframeCount;
const maxWait = 60000; // 60s
const start = Date.now();
// 1 iframe is stackblitz corp stuff
// 1 for the editor
// 1 for the running demo
while (iframeCount !== 3) {
    if (Date.now() - start > maxWait) {
        throwError("Never spawned 2 iframes");
    }
    await sleep(1000);
    iframeCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("iframe")).length;
    });
}

process.exit(0);
