import { createStart } from "@tanstack/react-start";

import { userSerialization } from "#/features/identity/user-serialization.ts";

export const startInstance = createStart(() => ({
  serializationAdapters: [userSerialization],
}));
