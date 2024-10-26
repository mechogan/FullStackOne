import child_process from "child_process";
import crypto from "crypto";
import puppeteer from "puppeteer";
import { sleep, throwError, waitForStackNavigation } from "./utils";
import {
    BACK_BUTTON_CLASS,
    PEERS_BUTTON_ID,
    PEERS_VIEW_ID,
    PEER_DISCONNECT_BUTTON_CLASS,
    PEER_PAIR_BUTTON_CLASS,
    PEER_TRUST_BUTTON_ID,
    PROJECTS_VIEW_ID,
    RUN_PROJECT_ID
} from "../editor/constants";
import fs from "fs";
import os from "os";

const rootDir1 = os.homedir() + "/" + crypto.randomUUID();
const port1 = 9100;
const process1 = child_process.exec("node index.js", {
    cwd: process.cwd() + "/platform/node",
    env: {
        ...process.env,
        NO_OPEN: "1",
        PORT: port1.toString(),
        ROOT_DIR: rootDir1
    }
});
process1.stdout.pipe(process.stdout);
process1.stderr.pipe(process.stderr);
const browser1 = await puppeteer.launch({
    headless: false
});

const rootDir2 = os.homedir() + "/" + crypto.randomUUID();
const port2 = 9500;
const process2 = child_process.exec("node index.js", {
    cwd: process.cwd() + "/platform/node",
    env: {
        ...process.env,
        NO_OPEN: "1",
        PORT: port2.toString(),
        WSS_PORT: "14001",
        ROOT_DIR: rootDir2
    }
});
process2.stdout.pipe(process.stdout);
process2.stderr.pipe(process.stderr);
const browser2 = await puppeteer.launch({
    headless: false
});

const cleanup = async () => {
    process1.kill();
    process2.kill();

    fs.rmSync(rootDir1, { recursive: true });
    fs.rmSync(rootDir2, { recursive: true });

    await browser1.close();
    await browser2.close();
};

const onError = (e) => {
    console.log(e);

    cleanup();

    throwError("Peer-2-Peer test failed");
};

process.on("uncaughtException", onError);
process.on("unhandledRejection", onError);
process1.on("error", onError);

const page1 = await browser1.newPage();
await page1.goto(`http://localhost:${port1}`);

const page2 = await browser2.newPage();
await page2.goto(`http://localhost:${port2}`);
await sleep(5000);

await waitForStackNavigation(page1, `#${PEERS_BUTTON_ID}`);
await waitForStackNavigation(page2, `#${PEERS_BUTTON_ID}`);

const pairButton = await page2.waitForSelector(`.${PEER_PAIR_BUTTON_CLASS}`);
await pairButton.click();

await page2.waitForSelector(`.code`);
const getPairingCode2 = () => document.querySelector(`.code`)?.textContent;
const pairingCode2 = await page2.evaluate(getPairingCode2);

await page1.waitForSelector(`.dialog code`);
const getPairingCode1 = () =>
    document.querySelector(`.dialog code`)?.textContent;
const pairingCode1 = await page1.evaluate(getPairingCode1);

if (pairingCode1 !== pairingCode2) {
    const errorMsg = `Pairing code does not match. Expected [${pairingCode2}] Found [${pairingCode1}]`;
    onError(errorMsg);
}

const trustButton = await page1.waitForSelector(`#${PEER_TRUST_BUTTON_ID}`);
await trustButton.click();

const trustButton2 = await page2.waitForSelector(`#${PEER_TRUST_BUTTON_ID}`);
await trustButton2.click();

await page2.waitForSelector(`.${PEER_DISCONNECT_BUTTON_CLASS}`);

await waitForStackNavigation(page1, `#${PEERS_VIEW_ID} .${BACK_BUTTON_CLASS}`);
await waitForStackNavigation(page2, `#${PEERS_VIEW_ID} .${BACK_BUTTON_CLASS}`);

await waitForStackNavigation(
    page1,
    `#${PROJECTS_VIEW_ID} .project-tile:first-child`
);
await waitForStackNavigation(
    page2,
    `#${PROJECTS_VIEW_ID} .project-tile:first-child`
);

const runProjectButton1 = await page1.waitForSelector(`#${RUN_PROJECT_ID}`);
await runProjectButton1.click();

const runProjectButton2 = await page2.waitForSelector(`#${RUN_PROJECT_ID}`);
await runProjectButton2.click();

await sleep(10000);

let tries = 3;
while (tries) {
    tries--;
    try {
        await fetch(`http://localhost:${port1 + 1}`);
    } catch (e) {
        if (!tries) throwError(e);
        else await sleep(5000);
    }
}
const demoPage1 = await browser1.newPage();
await demoPage1.goto(`http://localhost:${port1 + 1}`);

tries = 3;
while (tries) {
    tries--;
    try {
        await fetch(`http://localhost:${port2 + 1}`);
    } catch (e) {
        if (!tries) throwError(e);
        else await sleep(5000);
    }
}
const demoPage2 = await browser2.newPage();
await demoPage2.goto(`http://localhost:${port2 + 1}`);

await sleep(5000);

const getResult = () =>
    document.querySelector("#counter > div > div")?.textContent;

tries = 3;
while (tries) {
    const minusButton = await demoPage1.waitForSelector("#counter button");
    await minusButton.click();

    const count = await demoPage1.evaluate(getResult);
    if (count === "-1") break;

    tries--;

    await demoPage1.bringToFront();

    if (!tries) onError("Unable to decrement");
}

await demoPage2.bringToFront();

await sleep(5000);

tries = 3;
while (tries) {
    const count = await demoPage2.evaluate(getResult);
    if (count === "-1") break;

    tries--;

    await demoPage2.bringToFront();
    await sleep(2000);

    if (!tries) {
        onError(
            `Failed to broacast result. Results: Expected [-1], Found [${count}]`
        );
    }
}

await cleanup();

process.exit(0);
