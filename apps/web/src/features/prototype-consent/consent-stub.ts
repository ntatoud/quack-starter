import type { Scenario } from "#/features/prototype-consent/consent-search.ts";

export type PermissionName = "todos:list" | "todos:write" | "todos:delete";
export type Risk = "read" | "change" | "delete";

export const permissions: Record<
  PermissionName,
  { summary: string; detail: string; risk: Risk; verb: string }
> = {
  "todos:list": {
    summary: "See your todos",
    detail: "Read the titles and completed state of every todo you own.",
    risk: "read",
    verb: "see",
  },
  "todos:write": {
    summary: "Create and complete todos",
    detail: "Add new todos and mark existing ones as completed, as you would.",
    risk: "change",
    verb: "create and complete",
  },
  "todos:delete": {
    summary: "Delete todos",
    detail: "Permanently remove your todos. A deleted todo cannot be recovered.",
    risk: "delete",
    verb: "delete",
  },
};

export const riskTitles: Record<Risk, string> = {
  read: "Read",
  change: "Change",
  delete: "Delete",
};

export type ConsentRequest = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  requested: PermissionName[];
  alreadyGranted: PermissionName[];
};

export const currentUserEmail = "noe@example.com";

const all: PermissionName[] = ["todos:list", "todos:write", "todos:delete"];

export const requests: Record<Scenario, ConsentRequest> = {
  claude: {
    clientId: "https://claude.ai/oauth/claude-code-client-metadata",
    clientName: "Claude",
    redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    requested: all,
    alreadyGranted: [],
  },
  localhost: {
    clientId: "https://example.dev/client.json",
    clientName: "My Agent",
    redirectUris: ["http://localhost:6274/callback"],
    requested: ["todos:list"],
    alreadyGranted: [],
  },
  "step-up": {
    clientId: "https://claude.ai/oauth/claude-code-client-metadata",
    clientName: "Claude",
    redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    requested: all,
    alreadyGranted: ["todos:list"],
  },
};

export const hostOf = (url: string) => new URL(url).hostname;

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isLoopback = (url: string) => loopbackHosts.has(hostOf(url));

export const allLoopback = (request: ConsentRequest) => request.redirectUris.every(isLoopback);

export const newPermissions = (request: ConsentRequest) =>
  request.requested.filter((name) => !request.alreadyGranted.includes(name));

export const redirectHosts = (request: ConsentRequest) => [
  ...new Set(request.redirectUris.map(hostOf)),
];

/** What the sentence of variant C says: "see, create and complete, and delete". */
export const verbPhrase = (names: PermissionName[]) => {
  const verbs = names.map((name) => permissions[name].verb);
  if (verbs.length <= 1) return verbs.join("");
  return `${verbs.slice(0, -1).join(", ")}, and ${verbs.at(-1)}`;
};

export const warningCopy = {
  loopback:
    "This AI Client runs on this machine. Any program running on it could claim to be this one. Approve only if you started it yourself.",
  unverifiedName: (hostname: string) =>
    `The name is what the AI Client says it is. Only ${hostname} is verified.`,
};

export const fakeCallback = (request: ConsentRequest, outcome: "code" | "denied") => {
  const base = request.redirectUris[0] ?? "";
  return outcome === "code" ? `${base}?code=stub-code-123` : `${base}?error=access_denied`;
};
