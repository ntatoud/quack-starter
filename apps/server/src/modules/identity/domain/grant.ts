import { TodosPermission } from "@quack/contracts/todos/todos-permissions";

/** The Permissions a Grant may hold: those of the contexts exposed to AI Clients, never `users:*`. */
export const grantablePermissions = TodosPermission.literals;

/** What an AI Client asks for when nothing says what it needs: the least that lets it do anything. */
export const basicPermissions = ["todos:list"] as const;
