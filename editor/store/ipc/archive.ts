import ipc from "../../../src";
import { serializeArgs } from "../../../src/serialization";

export const archive = {
    zip,
    unzip
}

function zip(){

}


// 30
function unzip(destination: string, data: Uint8Array){
    const payload = new Uint8Array([
        30,
        ...serializeArgs([destination, data])
    ]);

    return ipc.bridge(payload, ([success]) => success);
}
