import type { User } from "@quack/contracts/identity/user";

export const canSignIn = (user: User) => user.status === "active";
