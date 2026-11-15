import type { Role } from "@quack/contracts/identity/user";

export const isAdmin = (user: { readonly role: Role }) => user.role === "admin";
