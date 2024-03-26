(Uint8Array.prototype as any).toJSON = function () {
    return {
        type: "Uint8Array",
        data: Array.from(this)
    };
};

export function decodeUint8Array(key: string, value: any) {
    if (
        value &&
        typeof value === "object" &&
        value.hasOwnProperty("type") &&
        value.type === "Uint8Array"
    ) {
        return new Uint8Array(value.data);
    }
    return value;
}
