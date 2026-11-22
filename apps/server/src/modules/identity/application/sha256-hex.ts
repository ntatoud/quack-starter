import { Digest } from "effect/crypto";

/** How a secret handed out once (a session token, an authorization code) is stored: a leaked store opens nothing. */
export const sha256Hex = (digest: Digest.Digest["Service"], secret: string) =>
  digest.digestHex(Digest.sha256, new TextEncoder().encode(secret));
