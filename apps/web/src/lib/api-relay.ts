interface RelayOptions {
  /** Origin of the API, such as `http://localhost:3001`. */
  readonly apiUrl: URL;
  /** Address of the client as this server sees it, when it sees one. */
  readonly clientIp: string | undefined;
}

// Headers that describe one connection, not the message: each side of the relay has its own.
const hopByHopHeaders = [
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

// Not sent to the API. `fetch` sets `host` and `content-length` itself, from the target URL and the body,
// and it refuses to send `expect`: the body is streamed without waiting for a 100 Continue.
const droppedFromRequest = [...hopByHopHeaders, "host", "content-length", "expect"];

// `fetch` hands an encoded body over decoded, so the headers that describe its encoding no longer hold.
const encodingHeaders = ["content-encoding", "content-length"];

const without = (source: Headers, names: ReadonlyArray<string>) => {
  // Copying keeps each `Set-Cookie` as its own header.
  const headers = new Headers(source);
  for (const name of names) headers.delete(name);
  return headers;
};

/**
 * Relays a request to the API and returns its response: same path, query, method, headers, and body.
 * The browser calls the web app's origin only, so a cookie set by the API belongs to that origin.
 *
 * `X-Forwarded-For` is the one header it rewrites. The API trusts it to name the client,
 * so the value sent by the client is never kept: it is replaced by the address seen here.
 *
 * It checks no authentication: the API does.
 */
export const relayToApi = async (
  request: Request,
  { apiUrl, clientIp }: RelayOptions,
): Promise<Response> => {
  const { pathname, search } = new URL(request.url);

  const headers = without(request.headers, droppedFromRequest);
  if (clientIp === undefined) headers.delete("x-forwarded-for");
  else headers.set("x-forwarded-for", clientIp);

  // `duplex` is required by `fetch` to send a body as a stream; the DOM types do not have it yet.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers,
    body: request.body,
    duplex: "half",
    // A redirect is for the browser to follow.
    redirect: "manual",
    signal: request.signal,
  };

  let upstream: Response;
  try {
    upstream = await fetch(new URL(pathname + search, apiUrl), init);
  } catch {
    // No answer from the API: it is down, or the client went away before it answered.
    return new Response("The API did not answer.", { status: 502 });
  }

  const decoded = upstream.headers.has("content-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: without(upstream.headers, [...hopByHopHeaders, ...(decoded ? encodingHeaders : [])]),
  });
};
