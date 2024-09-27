import child_process from "child_process";
import crypto from "crypto";
import puppeteer from "puppeteer";
import { sleep, throwError, waitForStackNavigation } from "./utils";
import {
    PEERS_ICON_ID,
    PEER_CONNECTIVITY_BACK_BUTTON_ID,
    PEER_DISCONNECT_BUTTON_CLASS,
    PEER_PAIRING_CODE_CLASS,
    PEER_PAIR_BUTTON_CLASS,
    PEER_TRUST_BUTTON_ID,
    RUN_PROJECT_ID
} from "../editor/constants";
import fs from "fs";
import os from "os";

const configDir1 = crypto.randomUUID();
const port1 = 9100;
const process1 = child_process.exec("node index.js", {
    cwd: process.cwd() + "/platform/node",
    env: {
        ...process.env,
        NO_OPEN: "1",
        PORT: port1.toString(),
        CONFIG_DIR: configDir1
    }
});
process1.stdout.pipe(process.stdout);
process1.stderr.pipe(process.stderr);
const browser1 = await puppeteer.launch({
    headless: false
});

const configDir2 = crypto.randomUUID();
const port2 = 9500;
const process2 = child_process.exec("node index.js", {
    cwd: process.cwd() + "/platform/node",
    env: {
        ...process.env,
        NO_OPEN: "1",
        PORT: port2.toString(),
        CONFIG_DIR: configDir2,
        WSS_PORT: "14001"
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

    fs.rmSync(os.homedir() + "/" + configDir1, { recursive: true });
    fs.rmSync(os.homedir() + "/" + configDir2, { recursive: true });

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
await waitForStackNavigation(page1, `#${PEERS_ICON_ID}`);

const page2 = await browser2.newPage();
await page2.goto(`http://localhost:${port2}`);
await waitForStackNavigation(page2, `#${PEERS_ICON_ID}`);

const pairButton = await page2.waitForSelector(`.${PEER_PAIR_BUTTON_CLASS}`);
await pairButton.click();

await page2.waitForSelector(`.${PEER_PAIRING_CODE_CLASS}`);
const getPairingCode2 = () =>
    document.querySelector(`.peer-pairing-code`)?.textContent;
const pairingCode2 = await page2.evaluate(getPairingCode2);

await page1.waitForSelector(`.code span`);
const getPairingCode1 = () => document.querySelector(`.code span`)?.textContent;
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

await waitForStackNavigation(page1, `#${PEER_CONNECTIVITY_BACK_BUTTON_ID}`);
await waitForStackNavigation(page2, `#${PEER_CONNECTIVITY_BACK_BUTTON_ID}`);

await waitForStackNavigation(page1, `article`);
await waitForStackNavigation(page2, `article`);

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
    if(count === "-1") break;

    tries--;

    await demoPage1.bringToFront();

    if (!tries) throwError("Unable to decrement");
}

await demoPage2.bringToFront();

await sleep(5000);

const result1 = await demoPage1.evaluate(getResult);
const result2 = await demoPage2.evaluate(getResult);

if (result1 !== "-1" || result2 !== "-1") {
    onError(
        `Failed to broacast result. Results: Page 1 [${result1}], Page 2 [${result2}]`
    );
}

await cleanup();

process.exit(0);
