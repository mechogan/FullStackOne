// https://rosettacode.org/wiki/UTF-8_encode_and_decode#JavaScript
const utf8encode = (n: string) =>
    ((m: number) =>
        m < 0x80
            ? Uint8Array.from([((m >> 0) & 0x7f) | 0x00])
            : m < 0x800
              ? Uint8Array.from([
                    ((m >> 6) & 0x1f) | 0xc0,
                    ((m >> 0) & 0x3f) | 0x80
                ])
              : m < 0x10000
                ? Uint8Array.from([
                      ((m >> 12) & 0x0f) | 0xe0,
                      ((m >> 6) & 0x3f) | 0x80,
                      ((m >> 0) & 0x3f) | 0x80
                  ])
                : m < 0x110000
                  ? Uint8Array.from([
                        ((m >> 18) & 0x07) | 0xf0,
                        ((m >> 12) & 0x3f) | 0x80,
                        ((m >> 6) & 0x3f) | 0x80,
                        ((m >> 0) & 0x3f) | 0x80
                    ])
                  : (() => {
                        throw "Invalid Unicode Code Point!";
                    })())(
        typeof n === "string" ? (n.codePointAt(0) as number) : n & 0x1fffff
    );

export class TextEncoder {
    encode(str: string) {
        const strArr = Array.from(str);
        let uint8arr: number[] = [];
        for (let i = 0; i < strArr.length; i++) {
            uint8arr.push(...utf8encode(strArr[i]));
        }
        return new Uint8Array(uint8arr);
    }
}

export class TextDecoder {
    // https://stackoverflow.com/a/44614927
    decode(strBytes: Uint8Array) {
        let MAX_SIZE = 0x4000;
        let codeUnits: number[] = [];
        let highSurrogate: number;
        let lowSurrogate: number;
        let index = -1;

        let result = "";

        while (++index < strBytes.length) {
            let codePoint = Number(strBytes[index]);

            if (codePoint === (codePoint & 0x7f)) {
            } else if (0xf0 === (codePoint & 0xf0)) {
                codePoint ^= 0xf0;
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
            } else if (0xe0 === (codePoint & 0xe0)) {
                codePoint ^= 0xe0;
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
            } else if (0xc0 === (codePoint & 0xc0)) {
                codePoint ^= 0xc0;
                codePoint = (codePoint << 6) | (strBytes[++index] ^ 0x80);
            }

            if (
                !isFinite(codePoint) ||
                codePoint < 0 ||
                codePoint > 0x10ffff ||
                Math.floor(codePoint) != codePoint
            )
                throw "Invalid code point: " + codePoint;

            if (codePoint <= 0xffff) codeUnits.push(codePoint);
            else {
                codePoint -= 0x10000;
                highSurrogate = (codePoint >> 10) | 0xd800;
                lowSurrogate = codePoint % 0x400 | 0xdc00;
                codeUnits.push(highSurrogate, lowSurrogate);
            }
            if (index + 1 == strBytes.length || codeUnits.length > MAX_SIZE) {
                result += String.fromCharCode.apply(null, codeUnits);
                codeUnits.length = 0;
            }
        }

        return result;
    }
}
