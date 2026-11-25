import { Effect } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { ServerConfig } from "#/config.ts";
import { sha256Hex } from "#/modules/identity/application/sha256-hex.ts";
import { linkTokenBytes } from "#/modules/identity/domain/link-token.ts";

/**
 * Makes the links sent by email: a page of the web app with a fresh token, and the SHA-256 the store keeps in place
 * of it.
 */
export const makeLinkMaker = Effect.gen(function* () {
  const random = yield* SecureRandom.SecureRandom;
  const digest = yield* Digest.Digest;
  const publicOrigin = yield* ServerConfig.publicOrigin;

  return Effect.fn("makeLink")(function* (pathname: string) {
    const token = Base64Url.encode(yield* random.randomBytes(linkTokenBytes));
    const url = new URL(pathname, publicOrigin);
    url.searchParams.set("token", token);

    return { url: url.href, tokenHash: yield* sha256Hex(digest, token) };
  });
});
