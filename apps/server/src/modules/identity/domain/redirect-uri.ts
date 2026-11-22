// RFC 8252 s7.3: an app on this machine picks its port when it starts.
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isLoopback = (url: URL) => loopbackHosts.has(url.hostname);

/** The same redirect URI: exactly, or on this machine on any port (RFC 8252 s7.3). */
export const redirectUriMatches = (listed: string, requested: string) => {
  if (listed === requested) return true;
  const a = URL.parse(listed);
  const b = URL.parse(requested);

  if (a === null || b === null || !isLoopback(a) || !isLoopback(b)) return false;
  a.port = "";
  b.port = "";

  return a.href === b.href;
};
