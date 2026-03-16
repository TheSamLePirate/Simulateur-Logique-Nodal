export interface HttpRequest {
  method: "GET" | "POST";
  url: string;
  body?: string;
}

export async function defaultHttpFetch(request: HttpRequest): Promise<string> {
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

  if (text.length > 0) {
    return text;
  }

  if (!response.ok) {
    return `HTTP ${response.status} ${response.statusText}`.trim();
  }

  return "";
}
