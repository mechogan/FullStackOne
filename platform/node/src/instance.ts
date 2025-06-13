import { numberTo4Bytes } from "../../../lib/bridge/serialization";
import { callLib } from "./call";

type InstanceOpts = { id: string; isEditor: boolean };

export function createInstance(
    id: InstanceOpts["id"],
    isEditor: InstanceOpts["isEditor"] = false
) {
    const header = createPayloadHeader({ id, isEditor });

    const call = (payload: Uint8Array) =>
        callLib(new Uint8Array([...header, ...payload]));

    return {
        id,
        isEditor,
        call
    };
}

const te = new TextEncoder();

export function createPayloadHeader(opts: InstanceOpts) {
    if (opts.isEditor) {
        return new Uint8Array([
            1, // is editor
            ...numberTo4Bytes(0) // no project id
        ]);
    }

    const idData = te.encode(opts.id);

    return new Uint8Array([
        0, // is not editor
        ...numberTo4Bytes(idData.byteLength), // project id length
        ...idData // project id
    ]);
}
