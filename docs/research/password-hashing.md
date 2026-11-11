# Password hashing without a native dependency

Research for issue #21 (map #18). Facts only; the decision belongs to #26.
Date of research: 2026-11-11. Runtime: Node 26.13.0 (`.node-version`).

## 1. Options on a Node server

| Option | Native code | In `node:crypto` | Stored-format helper |
| --- | --- | --- | --- |
| `crypto.argon2` / `argon2Sync` | No (built into Node) | Yes, since v24.7.0 | None: returns raw bytes |
| `crypto.scrypt` / `scryptSync` | No | Yes, since v10.5.0 | None: returns raw bytes |
| `argon2` (node-argon2) | Yes, C binding, prebuilt binaries or node-gyp | No | PHC string, `verify`, rehash check |
| `@node-rs/argon2` | Yes, Rust via napi-rs, no node-gyp or postinstall | No | PHC-style string, `hash`, `verify`, `parseOptions` |
| `hash-wasm` | No, WebAssembly bundled as base64 | No | `outputType: 'encoded'`, `argon2Verify` |
| `bcryptjs` | No, pure JS, zero dependencies | No | 60 character bcrypt string |

Sources:

- Node crypto API, `crypto.argon2` and `crypto.scrypt`: https://nodejs.org/docs/latest-v26.x/api/crypto.html (markdown source: https://nodejs.org/docs/latest-v26.x/api/crypto.md)
- node-argon2 README: https://github.com/ranisalt/node-argon2
- @node-rs/argon2 README: https://github.com/napi-rs/node-rs/tree/main/packages/argon2
- hash-wasm README: https://github.com/Daninet/hash-wasm
- bcryptjs README: https://github.com/dcodeIO/bcrypt.js

## 2. OWASP recommendations

Source: OWASP Password Storage Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

Order of preference: Argon2id first; scrypt when Argon2id is unavailable; bcrypt for legacy systems only; PBKDF2 when FIPS-140 compliance is required.

Argon2id minimum configurations (all declared equivalent in defense, differing in CPU/RAM trade-off; m in KiB, t passes, p lanes):

| m | t | p |
| --- | --- | --- |
| 47104 (46 MiB) | 1 | 1 |
| 19456 (19 MiB) | 2 | 1 |
| 12288 (12 MiB) | 3 | 1 |
| 9216 (9 MiB) | 4 | 1 |
| 7168 (7 MiB) | 5 | 1 |

The sheet's summary pick is m=19456, t=2, p=1.

scrypt minimums (r=8 in all rows):

| N | p |
| --- | --- |
| 2^17 (128 MiB) | 1 |
| 2^16 (64 MiB) | 2 |
| 2^15 (32 MiB) | 3 |
| 2^14 (16 MiB) | 5 |
| 2^13 (8 MiB) | 10 |

Other points from the same page:

- bcrypt: work factor of at least 10; enforce a maximum password length of 72 bytes.
- PBKDF2: 600,000 iterations with HMAC-SHA256, 220,000 with HMAC-SHA512.
- Each password gets a unique salt.
- A pepper is optional defense in depth; it is shared, stored apart from the hash database, and replacing a compromised one forces affected users to reset.
- Upgrading: re-hash at the user's next successful authentication; store the algorithm and work factor with each hash, using the PHC string format; support mixed algorithms during the transition.
- The hashing library must accept a wide range of characters, including NULL bytes.

RFC 9106 (Argon2), section 4, gives two heavier recommended configurations, both Argon2id with a 128-bit salt and 256-bit tag: t=1, p=4, m=2^21 KiB (2 GiB), and t=3, p=4, m=2^16 KiB (64 MiB). Section 3.1 recommends a 16-byte salt, unique per password. Section 7.4 suggests Argon2id as the default for all environments. Source: https://www.rfc-editor.org/rfc/rfc9106.html

## 3. `node:crypto` API facts (v26 docs)

Source: https://nodejs.org/docs/latest-v26.x/api/crypto.html

`crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync(algorithm, parameters)`, added in v24.7.0.

- `algorithm`: `"argon2d"`, `"argon2i"` or `"argon2id"`.
- Required parameters: `message` (the password), `nonce` (the salt, at least 8 bytes; the docs recommend random and at least 16 bytes), `parallelism` (1 to 2^24-1), `tagLength` (4 to 2^32-1), `memory` (KiB blocks, at least `8 * parallelism`, rounded down to a multiple of `4 * parallelism`), `passes` (1 to 2^32-1).
- Optional: `secret` (documented as the pepper, not stored with the key) and `associatedData`.
- Returns a `Buffer`. It produces the raw derived key only: no PHC encoding, no verification helper, no default parameters.
- The v26 entry carries no experimental stability marker in the markdown source read.
- Measured here: a 4 byte nonce throws `ERR_OUT_OF_RANGE` (must be >= 8).

`crypto.scrypt(password, salt, keylen[, options], callback)` and `scryptSync`, added in v10.5.0.

- Options: `cost`/`N` (power of two greater than one, default 16384), `blockSize`/`r` (default 8), `parallelization`/`p` (default 1), `maxmem` (default 32 MiB; error when approximately `128 * N * r > maxmem`).
- The docs recommend a random salt of at least 16 bytes.
- Consequence: OWASP's minimum N=2^17, r=8 needs 128 MiB, above the default `maxmem`. Measured here: with defaults, N=131072 fails with `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` (memory limit exceeded). `maxmem` must be raised.

`crypto.timingSafeEqual(a, b)`:

- Constant-time comparison of two `ArrayBuffer`, `Buffer`, `TypedArray` or `DataView` values.
- Both inputs must have the same byte length; otherwise an error is thrown.
- The docs state it does not make the surrounding code timing-safe.

Threadpool and event loop:

- The CLI docs list asynchronous crypto APIs "such as `crypto.pbkdf2()`, `crypto.scrypt()`, `crypto.randomBytes()`" as using libuv's threadpool (https://nodejs.org/docs/latest-v26.x/api/cli.html, `UV_THREADPOOL_SIZE`). The `crypto.argon2` entry does not state it either way; the measurements below show it does not block the event loop.
- The sync variants run on the main thread by definition.

## 4. Measured cost (this machine, not a benchmark of record)

Apple M3, arm64, 8 CPUs, Node 26.13.0, median of 5 runs after a warm-up, async API, 32-byte tag for Argon2 and 64-byte key for scrypt. The script was run once; treat the numbers as an order of magnitude.

| Configuration | Median time |
| --- | --- |
| argon2id m=47104, t=1, p=1 | 18.3 ms |
| argon2id m=19456, t=2, p=1 | 12.7 ms |
| argon2id m=12288, t=3, p=1 | 11.8 ms |
| scrypt N=2^17, r=8, p=1 | 198.3 ms |
| scrypt N=2^16, r=8, p=2 | 189.7 ms |
| scrypt N=2^14, r=8, p=5 | 113.0 ms |

Event loop:

- `argon2Sync` at m=19456, t=2 blocked the main thread for 16.2 ms.
- Async `argon2` at the same parameters ran 13.5 ms while a 1 ms timer fired 12 times, so the loop stayed responsive.
- 4 concurrent async hashes completed in 34.5 ms total and 8 in 43.7 ms total. The libuv pool default size was not found in the docs text read.

On this hardware Argon2id at the OWASP minimums is roughly 10 to 15 times faster than scrypt at its minimums. Other hardware (small containers, shared vCPUs) will differ.

## 5. Stored format

Source: PHC string format, https://github.com/C2SP/C2SP/blob/main/phc-strings.md

Grammar: `$<id>[$v=<version>][$<param>=<value>(,<param>=<value>)*][$<salt>[$<hash>]]`.

- Base64 is the RFC 4648 standard alphabet with `=` padding removed.
- Argon2 profile: ids `argon2d`, `argon2i`, `argon2id`; versions 16 and 19; parameters in order `m,t,p` (then optional `keyid`, `data`); salt 8 to 48 bytes (default 16); hash 12 to 64 bytes (default 32).
- Spec example: `$argon2id$v=19$m=65536,t=2,p=1$gZiV/M1gPc22ElAH/Jh1Hw$CWOrkoo7oJBQ/iyh7uJ0LO2aLEfrHwTWllSAxT0zRno`.
- Recommends a 16-byte salt and 32-byte output; says outputs under 80 bits should not be accepted for verification.
- No scrypt profile was found in the sections read; node-argon2 and @node-rs/argon2 emit PHC Argon2 strings.

Consequence for the `node:crypto` route: the app must itself build and parse the string (salt, parameters, version, tag), re-derive with the stored parameters at verification, compare tags with `timingSafeEqual` (tags of equal length), and decide when a stored hash needs a rehash because its parameters are below the current target.

## 6. Library facts

node-argon2 (native):

- Binds the reference Argon2 C implementation; prebuilt binaries from v0.26.0 for Linux (x86-64, ARM64, ARMv7), Alpine, macOS (x86-64, ARM64), Windows x86-64, FreeBSD; node-gyp build otherwise (needs GCC >= 5 or Clang >= 3.3).
- Tested against Node >= 22.0.0. Snap-installed Node is reported as a problem.
- Default type is Argon2id; `hash`, `verify`, and a rehash check are listed. PHC string output.
- Its README says the maintainers plan to reduce it to a thin wrapper over native crypto "once all supported Node releases include native Argon2", and notes the native API lacks PHC formatting, verification, rehash checks and default parameters.

@node-rs/argon2 (native, Rust):

- No node-gyp and no postinstall. Cross-platform; the platform list is not given on the README page.
- `hash(password, options?, abortSignal?)`, `verify(hashed, password, options?, abortSignal?)`, `parseOptions(hashed)`, all async.
- Defaults: Argon2id, version 0x13, memoryCost 19456 KiB, timeCost 2, parallelism 1, outputLen 32. These equal OWASP's recommended configuration.
- The npm page returned HTTP 403; facts are from the GitHub README.

hash-wasm (WebAssembly, no native):

- `argon2id` takes `password, salt, iterations, parallelism, memorySize (KiB), hashLength, outputType`; `outputType: 'encoded'` returns a string containing the parameters; `argon2Verify` takes an encoded hash. The README does not name the encoding as PHC.
- Also provides scrypt and bcrypt (bcrypt rejects passwords over 72 bytes or under 1 byte; salt 16 bytes; cost 4 to 31).
- The README lists multithreading for Argon2 as a future plan. It gives no guidance on running in a worker or on the main thread; whether WASM hashing blocks the event loop was not verified here.

bcryptjs (pure JS):

- Zero dependencies; about 30% slower than the C++ binding per its README.
- Maximum input is 72 bytes and is not enforced; `bcrypt.truncates(password)` reports whether a password exceeds it.
- Default rounds 10. The async API splits work into chunks queued on the event loop.
- The README makes no statement about constant-time comparison.

## 7. Not verified

- Whether Effect v4 ships any password hashing helper: the Effect ai-docs are not installed in this worktree, so they were not read.
- Argon2 stability marker in older Node 24.x docs: a search snippet described v24.8 as stability 1 (experimental); the v26 entry shows none.
- Real-world timings on the intended deployment hardware.
