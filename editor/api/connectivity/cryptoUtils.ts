// for large strings, use this from https://stackoverflow.com/a/49124600
export const toBase64 = (data: ArrayBufferLike) =>
    btoa(
        new Uint8Array(data).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
        )
    );

export const fromBase64 = (data: string) =>
    Uint8Array.from(atob(data), (c) => c.charCodeAt(null));

export const generateHash = (byteLength: number) =>
    toBase64(crypto.getRandomValues(new Uint8Array(byteLength)));

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function encrypt(data: string, key: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "encrypt");
    const encryptedContent = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        derivedKey,
        textEncoder.encode(data)
    );

    const encryptedContentArr = new Uint8Array(encryptedContent);
    let buff = new Uint8Array(
        salt.byteLength + iv.byteLength + encryptedContentArr.byteLength
    );
    buff.set(salt, 0);
    buff.set(iv, salt.byteLength);
    buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);
    return toBase64(buff);
}

export async function decrypt(base64: string, key: string) {
    const encryptedDataBuff = fromBase64(base64);
    const salt = encryptedDataBuff.slice(0, 16);
    const iv = encryptedDataBuff.slice(16, 16 + 12);
    const data = encryptedDataBuff.slice(16 + 12);
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "decrypt");
    const decryptedContent = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv
        },
        derivedKey,
        data
    );
    return textDecoder.decode(decryptedContent);
}

const importKey = (key: string) =>
    crypto.subtle.importKey("raw", textEncoder.encode(key), "PBKDF2", false, [
        "deriveKey"
    ]);

const deriveKey = (
    cryptoKey: CryptoKey,
    salt: ArrayBufferLike,
    keyUsage: "encrypt" | "decrypt"
) =>
    crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 250000,
            hash: "SHA-256"
        },
        cryptoKey,
        { name: "AES-GCM", length: 256 },
        false,
        [keyUsage]
    );
