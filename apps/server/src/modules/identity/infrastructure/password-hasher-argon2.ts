import type { Password } from "@quack/contracts/identity/user";
import { Effect, Layer, Option, Redacted, Result } from "effect";
import { Kdf, Mac, SecureRandom } from "effect/crypto";
import { Base64 } from "effect/encoding";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";

interface Costs {
  /** In KiB. */
  readonly memory: number;
  readonly passes: number;
  readonly parallelism: number;
}

/** The costs OWASP recommends for argon2id: 19 MiB of memory, 2 passes, 1 lane. */
const currentCosts: Costs = { memory: 19_456, passes: 2, parallelism: 1 };
const saltLength = 16;
const tagLength = 32;

/** What a PHC string carries: enough to derive the tag again. */
interface Argon2Hash {
  readonly costs: Costs;
  readonly salt: Uint8Array;
  readonly tag: Uint8Array;
}

// The base64 of a PHC string has no padding.
const encodeBase64 = (bytes: Uint8Array) => Base64.encode(bytes).replace(/=+$/, "");
const decodeBase64 = (text: string) =>
  Result.getOrUndefined(Base64.decode(text.padEnd(Math.ceil(text.length / 4) * 4, "=")));

/** `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<tag>`. Version 19 (0x13) is Argon2 1.3, the only one in use. */
const formatPhc = ({ costs, salt, tag }: Argon2Hash) =>
  `$argon2id$v=19$m=${costs.memory},t=${costs.passes},p=${costs.parallelism}` +
  `$${encodeBase64(salt)}$${encodeBase64(tag)}`;

const phc = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

const parsePhc = (hash: string): Option.Option<Argon2Hash> => {
  const match = phc.exec(hash);
  if (match === null) return Option.none();
  const [, memory, passes, parallelism, salt = "", tag = ""] = match;
  const saltBytes = decodeBase64(salt);
  const tagBytes = decodeBase64(tag);
  if (saltBytes === undefined || tagBytes === undefined) return Option.none();
  return Option.some({
    costs: { memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism) },
    salt: saltBytes,
    tag: tagBytes,
  });
};

/**
 * Argon2id through Effect's `Kdf`, stored as a PHC string, with no pepper.
 * The costs travel in the string, so they can be raised later without breaking the stored hashes.
 *
 * Needs a `Kdf` that provides Argon2id: `NodeCrypto.layerKdf`.
 */
export const PasswordHasherArgon2 = Layer.effect(
  PasswordHasher,
  Effect.gen(function* () {
    const kdf = yield* Kdf.Kdf;
    const random = yield* SecureRandom.SecureRandom;

    // A failure here is a runtime without Argon2id or a cost out of bounds: a defect, not a wrong password.
    const derive = (password: Password, costs: Costs, salt: Uint8Array, length: number) =>
      kdf
        .derive(Kdf.argon2id(costs), new TextEncoder().encode(Redacted.value(password)), {
          salt,
          length,
        })
        .pipe(Effect.orDie);

    const hash = Effect.fn("PasswordHasher.hash")(function* (password: Password) {
      const salt = yield* random.randomBytes(saltLength);
      const tag = yield* derive(password, currentCosts, salt, tagLength);
      return formatPhc({ costs: currentCosts, salt, tag });
    });

    const verify = Effect.fn("PasswordHasher.verify")(function* (
      password: Password,
      storedHash: string,
    ) {
      const stored = parsePhc(storedHash);
      if (Option.isNone(stored)) return false;
      const { costs, salt, tag } = stored.value;
      const derived = yield* derive(password, costs, salt, tag.length);
      // Constant time: how long the comparison takes says nothing about the stored tag.
      return Mac.timingSafeEqual(derived, tag);
    });

    return PasswordHasher.of({ hash, verify });
  }),
);
