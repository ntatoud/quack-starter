import type { Permission } from "@quack/contracts/permission";
import { TodosPermission } from "@quack/contracts/todos/todos-permissions";

/** The Permissions a Grant may hold: those of the contexts exposed to AI Clients, never `users:*`. */
export const grantablePermissions = TodosPermission.literals;

/** What an AI Client asks for when nothing says what it needs: the least that lets it do anything. */
export const basicPermissions = ["todos:list"] as const;

/** What a Grant was given for: what a request must match for the User's consent to be remembered. */
export interface GrantTerms {
  readonly aiClientId: string;
  readonly resource: string;
  readonly redirectUri: string;
  readonly permissions: ReadonlyArray<Permission>;
}

/** The active Grant already holds all the request asks for: asking the User again would tell them nothing. */
export const remembersConsent = (grant: GrantTerms, request: GrantTerms) =>
  grant.aiClientId === request.aiClientId &&
  grant.resource === request.resource &&
  grant.redirectUri === request.redirectUri &&
  request.permissions.every((permission) => grant.permissions.includes(permission));
