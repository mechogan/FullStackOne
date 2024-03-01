export declare var fetch: (
    url: string,
    options: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELTE";
        body?: string | Uint8Array;
        encoding?: string;
    }
) => Promise<{
    url: string;
    headers: Record<string, string>;
    method: "GET" | "POST" | "PUT" | "DELTE";
    statusCode: number;
    statusMessage: string;
    body: string | Uint8Array;
}>;
