# Identity

The rules of `modules/identity` that its code does not show on its own. The durations and limits are in the code (`domain/session.ts`) and in `.env.example`.

## Sessions

- The Session travels in the `session` cookie, `HttpOnly`. Every write of the cookie goes through `SessionCookie` (`http/session-cookie.ts`), so it is set and cleared with the same attributes. `COOKIE_SECURE` makes it `Secure`, true unless set.
- A Session expires `sessionLifetime` after its last extension, with no other limit. The middleware extends it when a request finds it under `sessionExtensionThreshold`, and sets the cookie again. When it refuses a request, it clears the cookie.

## Sign-in

- Only a User whose Status lets them (`canSignIn` in `domain/user.ts`) signs in. Another one gets `InvalidCredentials` after the check of their password, so the refusal tells nothing to whoever does not know it, and their Session ends at its next request.
- A sign-in records `lastSignInAt`.

## AttemptLimiter

Slows down the guessing of passwords (port: `domain/attempt-limiter.ts`). The use cases `signIn` and `signUp` call it with the client's address, which the handler reads in `X-Forwarded-For`; there is no HTTP middleware for it.

- It counts the failed sign-ins per email and per address, and the sign-ups per address, failed ones included. The limits and windows are in `ServerConfig` (`attemptLimits`).
- Past a limit the use case fails with `TooManyAttempts` (429) and its `retryAfter` in seconds, before the password is hashed, and the same whether a User has the email or not.
- A window is fixed: it opens at the first attempt counted and starts again from zero when it ends, so nothing locks a User out for good.
- A sign-in is counted as a failure before its password is checked, in one step with the refusal (`take`), so concurrent sign-ins do not all get through. One that succeeds resets the counter of its email and is taken off the counter of its address.
- The adapter is a counter in memory rather than Effect's `RateLimiter`, which cannot reset a counter.

## Seed

`IdentitySeed` (`application/identity-seed.ts`) creates the Users of `devUsers()` through `UserRepository.create` and logs their credentials. It gives the same Users at every run (ids from a seeded faker, dates spread over the two years before the fixed `seedDate`, every Status, some with no Profile or never signed in), so the data is in a known state. Every seeded User has the hash `devPasswordHash`, computed once from the dev password, so seeding hashes nothing; a test checks it still verifies. The `user` and `admin` accounts are in `@quack/contracts/identity/dev-accounts`, which the sign-in page reads for its one-click sign-in in dev.
