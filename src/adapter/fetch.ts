export type fetch = (
    url: string,
    options?: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELTE";
        body?: string | Uint8Array;
        encoding?: string;
    }
) => Promise<{
    headers: Record<string, string>;
    statusCode: number;
    statusMessage: string;
    body: string | Uint8Array;
}>;
