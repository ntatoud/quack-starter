export type Permission = "todos:list" | "todos:write" | "todos:delete";

export type Grant = {
  id: string;
  clientName: string;
  origin: string;
  loopbackOnly: boolean;
  permissions: Permission[];
  givenAt: number;
  lastUsedAt: number;
  expiresAt: number;
};

export const scenarios = ["none", "one", "several"] as const;
export type Scenario = (typeof scenarios)[number];

export const mcpUrl = "https://api.quack.example/mcp";

const hour = 3_600_000;
const day = 24 * hour;
const lifetime = 30 * day;

const grant = (
  id: string,
  clientName: string,
  origin: string,
  loopbackOnly: boolean,
  permissions: Permission[],
  givenDaysAgo: number,
  usedAgo: number,
): Grant => {
  const now = Date.now();
  return {
    id,
    clientName,
    origin,
    loopbackOnly,
    permissions,
    givenAt: now - givenDaysAgo * day,
    lastUsedAt: now - usedAgo,
    expiresAt: now - usedAgo + lifetime,
  };
};

export const makeGrants = (scenario: Scenario): Grant[] => {
  if (scenario === "none") return [];
  const claude = grant(
    "claude",
    "Claude",
    "claude.ai",
    false,
    ["todos:list", "todos:write", "todos:delete"],
    41,
    2 * hour,
  );
  if (scenario === "one") return [claude];
  return [
    claude,
    grant("chatgpt", "ChatGPT", "chatgpt.com", false, ["todos:list"], 60, 25 * day),
    grant("agent", "My Agent", "example.dev", true, ["todos:list", "todos:write"], 9, day),
  ];
};

export const permissionLabel: Record<Permission, string> = {
  "todos:list": "See your todos",
  "todos:write": "Create and complete todos",
  "todos:delete": "Delete todos",
};

const verbs: Record<Permission, string[]> = {
  "todos:list": ["see"],
  "todos:write": ["create", "complete"],
  "todos:delete": ["delete"],
};

const join = (words: string[]) =>
  words.length < 3
    ? words.join(" and ")
    : `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;

/** "see, create, complete, and delete your todos" */
export const actions = (permissions: Permission[]) =>
  `${join(permissions.flatMap((permission) => verbs[permission]))} your todos`;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const relative = (at: number) => {
  const diff = at - Date.now();
  const abs = Math.abs(diff);
  if (abs < hour) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  return rtf.format(Math.round(diff / day), "day");
};

export const absolute = (at: number) =>
  new Date(at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

export const daysLeft = (grant: Grant) => (grant.expiresAt - Date.now()) / day;
export const idleDays = (grant: Grant) => (Date.now() - grant.lastUsedAt) / day;

export const consequence = (grant: Grant) =>
  `${grant.clientName} loses access at once and can no longer ${actions(grant.permissions)}. There is no undo: it has to ask for your consent again.`;
