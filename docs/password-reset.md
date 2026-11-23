# Password Reset

How a User who forgot their password chooses a new one, through a link sent by email. The use case is `PasswordResets` (`apps/server/src/modules/identity/application/password-resets.ts`); the words are those of `GLOSSARY.md`.

## The flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as Web
    participant A as API
    participant M as Mailer
    U->>W: /sign-in, "Forgot password?"
    U->>W: /forgot-password, their email
    W->>A: POST /api/password-reset {email}
    A-->>W: 202, whoever has the email
    W-->>U: "If an account exists for ..., we sent it a link"
    A--)M: in the background: the link, to an active User only
    M--)U: <PUBLIC_URL>/reset-password?token=...
    U->>W: opens the link, a new password
    W->>A: POST /api/password-reset/confirm {token, password}
    A-->>W: success, or 410 ExpiredLink
    W-->>U: /sign-in, toast "Password changed"
```

## Asking for a link

`PasswordResets.request(email, ip)`. The answer says nothing of whether a User has the email: the same status, in the same time.

```mermaid
flowchart TD
    R["POST /api/password-reset"] --> L{"Past a limit?<br/>per email, per address"}
    L -- yes --> T["429 TooManyAttempts, Retry-After"]
    L -- no --> F["fork sendLink(email)"]
    F --> OK["202"]
    F -.-> U{"A User who<br/>can sign in?"}
    U -- no --> N["no mail"]
    U -- yes --> D["remove their earlier links"]
    D --> S["save SHA-256 of a random token,<br/>expiring in 1 hour"]
    S --> E["mail the link"]
```

- The limits count every request, whoever has the email, so a 429 tells nothing either: `PASSWORD_RESETS_PER_EMAIL` (5 an hour) and `PASSWORD_RESETS_PER_IP` (20 an hour), in `ServerConfig.attemptLimits`.
- `sendLink` runs in a fiber of the server's scope (`Effect.forkIn`), not of the request: a User who gets the mail would otherwise get a slower answer. A failure is logged, the 202 already sent.
- The token is `linkTokenBytes` random bytes in base64url; only its SHA-256 is stored. The link starts from `ServerConfig.publicOrigin`, never from the request.
- The template is imported on the first mail, so the scripts that load the identity module (the seed) need no `.tsx` hook.

## Confirming

`PasswordResets.confirm(token, password)`.

```mermaid
flowchart TD
    C["POST /api/password-reset/confirm"] --> K["take the link by its SHA-256:<br/>removed as it is read"]
    K --> X{"Found, and<br/>not expired?"}
    X -- no --> G["410 ExpiredLink"]
    X -- yes --> Y{"Its User can<br/>still sign in?"}
    Y -- no --> G
    Y -- yes --> P["set the password hash"]
    P --> Q["remove every Session of the User"]
    Q --> Z["success, no Session opened"]
```

- `take` is one `DELETE ... RETURNING`: two confirms of one link at once, one wins.
- Every Session ends, an intruder's included. The User signs in with the new password.
- A User suspended since they asked is refused as a stranger.

## A link

```mermaid
stateDiagram-v2
    [*] --> Valid: asked
    Valid --> Used: confirm
    Valid --> Replaced: asked again
    Valid --> Expired: 1 hour later
    Used --> [*]
    Replaced --> [*]
    Expired --> [*]: removed by the next confirm (410) or request
```

| `link_tokens` |                                                                   |
| ------------- | ----------------------------------------------------------------- |
| `token_hash`  | SHA-256 of the token, primary key                                 |
| `user_id`     | the User, `ON DELETE CASCADE`                                     |
| `purpose`     | `password_reset`; the table is meant for every link sent by email |
| `expires_at`  | asked + `passwordResetLifetime` (1 hour)                          |

An index on `(user_id, purpose)` serves the removal of a User's earlier links. Nothing sweeps expired links.

## The web app

```mermaid
flowchart LR
    SI["/sign-in"] -- "Forgot password?" --> FP["/forgot-password"]
    FP -- submit --> MSG["neutral message"]
    MAIL(["mail"]) --> RP["/reset-password?token="]
    RP -- success --> SI2["/sign-in, toast"]
    RP -- "410, or no token" --> EX["expired link"]
    EX -- "Ask for a new link" --> FP
```

Both pages are under `_guest`: a signed-in User goes to `/app`. `/reset-password` checks the token on submit only (`features/identity/reset-password-form.tsx`).

## Left open

- The confirm writes are not in one transaction: a crash between them can spend the link and keep the old password, or keep old Sessions.
- Two requests at the same instant may each leave a valid link.
