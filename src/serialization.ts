const te = new TextEncoder();
const td = new TextDecoder();

enum DataType {
    UNDEFINED = 0,
    BOOLEAN = 1,
    STRING = 2,
    NUMBER = 3,
    JSON = 4,
    UINT8ARRAY = 5
}

function serializeNumber(n: number) {
    const negative = n < 0;

    n = Math.abs(n);
    const bytesNeeded = Math.ceil(Math.log(n + 1) / Math.log(2) / 8);
    const uint8Array = new Uint8Array(bytesNeeded + 1);
    uint8Array[0] = negative ? 1 : 0;

    for (let i = 1; i <= bytesNeeded; i++) {
        const mask = Math.pow(2, i * 8) - 1;
        uint8Array[i] = (n & mask) >>> ((i - 1) * 8);
    }

    return uint8Array;
}

function deserializeNumber(bytes: Uint8Array) {
    const negative = bytes[0] === 1;

    let n = 0;

    for (let i = 1; i <= bytes.byteLength; i++) {
        n += (bytes[i] << ((i - 1) * 8)) >>> 0;
    }

    return negative ? 0 - n : n;
}

function numberTo4Bytes(n: number) {
    const uint8Array = new Uint8Array(4);
    uint8Array[0] = n & 0x000000ff;
    uint8Array[1] = (n & 0x0000ff00) >> 8;
    uint8Array[2] = (n & 0x00ff0000) >> 16;
    uint8Array[3] = (n & 0xff000000) >> 24;
    return uint8Array;
}

function bytesToNumber(bytes: Uint8Array) {
    return (
        (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0
    );
}

/*

1 byte for type
4 bytes for length
n bytes for data

*/

export function serializeArgs(args: any[]) {
    const parts = args.map((arg) => {
        let data: Uint8Array, type: DataType;
        if (typeof arg === "undefined" || arg === null) {
            type = DataType.UNDEFINED;
            data = new Uint8Array(0);
        } else if (arg.constructor === Uint8Array) {
            type = DataType.UINT8ARRAY;
            data = arg;
        } else if (typeof arg === "boolean") {
            type = DataType.BOOLEAN;
            data = new Uint8Array([arg ? 1 : 0]);
        } else if (typeof arg === "string") {
            type = DataType.STRING;
            data = te.encode(arg);
        } else if (typeof arg === "number") {
            type = DataType.NUMBER;
            data = serializeNumber(arg);
        } else if (typeof arg === "object") {
            type = DataType.JSON;
            data = te.encode(JSON.stringify(arg));
        } else {
            console.error("Using unknown type with IPC call");
            return null;
        }

        return new Uint8Array([
            type,
            ...numberTo4Bytes(data.byteLength),
            ...data
        ]);
    });

    const totalLength = parts.reduce(
        (total, part) => total + part.byteLength,
        0
    );
    const data = new Uint8Array(totalLength);
    parts.forEach((part, i) => {
        const offset = parts
            .slice(0, i)
            .reduce((total, b) => total + b.byteLength, 0);
        data.set(part, offset);
    });

    return data;
}

export function deserializeArgs(data: Uint8Array) {
    const args = [];

    let cursor = 0;
    while (cursor < data.byteLength) {
        const type = data[cursor] as DataType;
        cursor += 1;
        const length = bytesToNumber(data.slice(cursor, cursor + 4));
        cursor += 4;
        const arg = data.slice(cursor, cursor + length);
        cursor += length;

        switch (type) {
            case DataType.UNDEFINED:
                args.push(undefined);
                break;
            case DataType.BOOLEAN:
                args.push(arg ? true : false);
                break;
            case DataType.STRING:
                args.push(td.decode(arg));
                break;
            case DataType.NUMBER:
                args.push(deserializeNumber(arg));
                break;
            case DataType.JSON:
                args.push(JSON.parse(td.decode(arg)));
                break;
            case DataType.UINT8ARRAY:
                args.push(arg);
                break;
        }
    }

    return args;
}
