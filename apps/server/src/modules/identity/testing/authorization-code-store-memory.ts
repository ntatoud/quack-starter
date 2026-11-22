import { Effect, Layer, Option } from "effect";

import type { AuthorizationCode } from "#/modules/identity/domain/authorization-code.ts";
import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";

export const AuthorizationCodeStoreMemory = Layer.sync(AuthorizationCodeStore, () => {
  const codes = new Map<string, AuthorizationCode>();

  return AuthorizationCodeStore.of({
    save: (code) => Effect.sync(() => void codes.set(code.codeHash, code)),
    take: (codeHash) =>
      Effect.sync(() => {
        const code = Option.fromNullishOr(codes.get(codeHash));
        codes.delete(codeHash);
        return code;
      }),
  });
});
