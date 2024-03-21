(Uint8Array.prototype as any).toJSON = function () {
    return {
        type: "Uint8Array",
        data: Array.from(this)
    };
};
