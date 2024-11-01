export type fetch = (
    url: string,
    body?: string | Uint8Array,
    options?: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELETE";
        encoding?: "utf8" | "base64";
        timeout?: number;
    }
) => Promise<{
    headers: Record<string, string>;
    statusCode: number;
    statusMessage: string;
    body: string;
}>;

export type fetchRaw = (
    url: string,
    body?: string | Uint8Array,
    options?: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELETE";
        timeout?: number;
    }
) => Promise<Uint8Array>;
