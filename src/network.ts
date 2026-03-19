export interface HttpRequest {
  method: "GET" | "POST";
  url: string;
  body?: string;
}

export interface HttpFetchResult {
  text: string;
  status: number;
  ok: boolean;
  statusText: string;
  statusLabel: string;
}

export async function defaultHttpFetchDetailed(
  request: HttpRequest,
): Promise<HttpFetchResult> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch API unavailable in this environment.");
  }

  const response = await globalThis.fetch(request.url, {
    method: request.method,
    headers:
      request.method === "POST"
        ? { "Content-Type": "application/json; charset=UTF-8" }
        : undefined,
    body: request.method === "POST" ? request.body ?? "" : undefined,
  });
  const text = await response.text();
  const statusLabel = `HTTP ${response.status} ${response.statusText}`.trim();

  return {
    text,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    statusLabel,
  };
}

export async function defaultHttpFetch(request: HttpRequest): Promise<string> {
  const { text, ok, statusLabel } = await defaultHttpFetchDetailed(request);

  if (text.length > 0) {
    return text;
  }

  if (!ok) {
    return statusLabel;
  }

  return "";
}
