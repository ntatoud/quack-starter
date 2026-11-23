# Identity

The rules of `modules/identity` that its code does not show on its own. The durations and limits are in the code (`domain/session.ts`) and in `.env.example`.

## Sessions

- The Session travels in the `session` cookie, `HttpOnly`. Every write of the cookie goes through `SessionCookie` (`http/session-cookie.ts`), so it is set and cleared with the same attributes. `COOKIE_SECURE` makes it `Secure`, true unless set.
- A Session expires `sessionLifetime` after its last extension, with no other limit. The middleware extends it when a request finds it under `sessionExtensionThreshold`, and sets the cookie again. When it refuses a request, it clears the cookie.

## Sign-in

- Only a User whose Status lets them (`canSignIn` in `domain/user.ts`) signs in. Another one gets `InvalidCredentials` after the check of their password, so the refusal tells nothing to whoever does not know it, and their Session ends at its next request.
- A sign-in records `lastSignInAt`.

## Onboarding

- A User is onboarded once `onboardedAt` is set, whatever their Profile: a Profile filled in for them does not spare them the onboarding.
- `completeOnboarding` sets the name of the Profile, creating it with nothing else filled in, and records `onboardedAt` (`onboarded` in `domain/user.ts`). A second one changes the name and keeps the first date.
- Only the web app holds a User who is not onboarded back; the API answers them as any other.

## Password Reset

A link by email to choose a new password: `docs/password-reset.md`.

## AttemptLimiter

Slows down the guessing of passwords and of OAuth secrets (port: `domain/attempt-limiter.ts`). The use cases `signIn` and `signUp` call it with the client's address, which the handler reads in `X-Forwarded-For` (`http/client-ip.ts`); there is no HTTP middleware for it. For the OAuth routes, see `docs/ai-clients.md`.

- It counts the failed sign-ins per email and per address, the sign-ups per address, failed ones included, and the Password Resets asked per email and per address. The limits and windows are in `ServerConfig` (`attemptLimits`).
- Past a limit the use case fails with `TooManyAttempts` (429) and its `retryAfter` in seconds, before the password is hashed, and the same whether a User has the email or not.
- A window is fixed: it opens at the first attempt counted and starts again from zero when it ends, so nothing locks a User out for good.
- A sign-in is counted as a failure before its password is checked, in one step with the refusal (`take`), so concurrent sign-ins do not all get through. One that succeeds resets the counter of its email and is taken off the counter of its address.
- The adapter is a counter in memory rather than Effect's `RateLimiter`, which cannot reset a counter.

## Seed

`IdentitySeed` (`application/identity-seed.ts`) creates the Users of `devUsers()` through `UserRepository.create` and logs their credentials. It gives the same Users at every run (ids from a seeded faker, dates spread over the two years before the fixed `seedDate` of `database/seed-date.ts`, which the Todos share, every Status, some with no Profile or never signed in; onboarded when they have a Profile and signed in), so the data is in a known state. Every seeded User has the hash `devPasswordHash`, computed once from the dev password, so seeding hashes nothing; a test checks it still verifies. The `user` and `admin` accounts are in `@quack/contracts/identity/dev-accounts`, which the sign-in page reads for its one-click sign-in in dev.

The identity module exports `devAccountIds()`, the ids of those two accounts, the first draws of the faker, so they do not change with the random Users. `seedDatabase` passes them to `TodosSeed`: the todos module gives each a few fixed Todos, some completed, with ids hashed from their owner, and knows nothing of identity's seed. The random Users get no Todos.
