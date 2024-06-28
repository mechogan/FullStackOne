export type fetch = (
    url: string,
    options?: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELETE";
        body?: string | Uint8Array;
        encoding?: string;
        timeout?: number;
    }
) => Promise<{
    headers: Record<string, string>;
    statusCode: number;
    statusMessage: string;
    body: string | Uint8Array;
}>;
