import fs from "fs";

const title = document.createElement("h1");
title.innerText = await fs.readFile("text.txt", { encoding: "utf8" });
document.body.append(title);
