import ts from "typescript"

import rpc from "../rpc";

let i = 0;

function timedCount() {
  i += 1;
  postMessage(rpc(true).platform())
  postMessage(ts.version);
  setTimeout(timedCount, 1000);
}

timedCount();