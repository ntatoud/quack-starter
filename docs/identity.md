# Identity

The rules of `modules/identity` that its code does not show on its own. The durations and limits are in the code (`domain/session.ts`, `domain/app-auth.ts`) and in `.env.example`.

## Yielded Auth

[Yielded Auth](https://yielded.dev/auth/) holds the credentials and the Sessions (`AppAuth`, `domain/app-auth.ts`). Identity keeps the User, their Role and Status, and the rules of sign-up and sign-in around them (`application/identity.ts`).

- Its storage is mapped onto Quack's tables (`infrastructure/app-auth-postgres.ts`, migration `0004`): the subject is the User (`users`, `status = 'active'`, `security_revision`), and its own tables are `auth_*`, which name the User as text, with no foreign key. Removing a User deletes their `auth_*` rows (`UserRepository.remove`).
- A new `users.security_revision` ends every Session of the User: a password set by a Password Reset (`PasswordCredentials`), and a User who stops being `active` (`UserRepository.update`), so a Session does not open again on reactivation.
- Its request boundary (`withAppAuthRequests`, `http/app-auth-http.ts`) wraps the routes of the `Api` and of MCP: it reads the Session cookie and writes the one its answer sets. A sign-up, sign-in, or sign-out is refused unless it comes from `PUBLIC_URL` with the header `x-effect-auth-csrf: 1`, which the web app's API client sends.
- It refuses to sign up inside a transaction it does not own: the seed signs its Users up outside one.
- It keeps the clock it is built with, and refuses a Session verified at the instant it was issued: tests build it on the real clock (`testing/identity-pglite.ts`), never a TestClock.
- It has no memory adapter that signs up: identity's tests run on Postgres in the process (PGlite), through `appAuthTestClient` (`testing/app-auth-test-client.ts`) where `HttpApiTest` cannot host the boundary.

## Sessions

- The Session travels in the `__Host-quack-session` cookie (`quack-session` on an http `PUBLIC_URL`, which Yielded allows on loopback only), `HttpOnly`, `Secure`, `SameSite=Lax`. Only Yielded writes it.
- A Session expires `sessionLifetime` after the sign-in. Yielded renews a Session only when asked, and nothing asks yet. A refused request leaves the cookie as it is.

## Sign-in

- Only an `active` User signs in: Yielded refuses another one as it refuses a wrong password, after the check, so the refusal tells nothing to whoever does not know it.
- A sign-up for an email already taken: Yielded creates nothing and says nothing; Quack answers `EmailAlreadyTaken`, as the User row proves the account was not created.
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
- Yielded counts sign-ins too, every attempt: its limits per email and per User are raised to a ceiling far above these (`domain/app-auth.ts`), and its limit of 1000 sign-ins a minute per server stays.
- The adapter is a counter in memory rather than Effect's `RateLimiter`, which cannot reset a counter.

## Seed

`IdentitySeed` (`application/identity-seed.ts`) creates the Users of `devUsers()` through `UserRepository.create` and logs their credentials. It gives the same Users at every run (ids from a seeded faker, dates spread over the two years before the fixed `seedDate` of `database/seed-date.ts`, which the Todos share, every Status, some with no Profile or never signed in; onboarded when they have a Profile and signed in), so the data is in a known state. Every seeded User signs up through `AppAuth.register` with the dev password, which costs a hash each (about 15 seconds for the seed), then gets the rest of their seeded state with `UserRepository.update`. The `user` and `admin` accounts are in `@quack/contracts/identity/dev-accounts`, which the sign-in page reads for its one-click sign-in in dev.

The identity module exports `devAccountIds()`, the ids of those two accounts, the first draws of the faker, so they do not change with the random Users. `seedDatabase` passes them to `TodosSeed`: the todos module gives each a few fixed Todos, some completed, with ids hashed from their owner, and knows nothing of identity's seed. The random Users get no Todos.
