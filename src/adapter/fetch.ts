export type fetch = (
    url: string,
    body?: string | Uint8Array,
    options?: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELETE";
        encoding?: string;
        timeout?: number;
    }
) => Promise<{
    headers: Record<string, string>;
    statusCode: number;
    statusMessage: string;
    body: string | Uint8Array;
}>;
