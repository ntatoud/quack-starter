import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { EmailAlreadyTaken, InvalidCredentials } from "#/identity/identity-errors.ts";
import { Email, Password, User } from "#/identity/user.ts";

/** What a visitor sends to sign up. The sign-up form validates with it, so the form and the API agree. */
export const SignUpPayload = Schema.Struct({ email: Email, password: Password });

/**
 * What a User sends to sign in. The sign-in form validates with it, so the form and the API agree.
 * It holds the rules of a sign-up: a password no User can have is refused before it is checked.
 */
export const SignInPayload = Schema.Struct({ email: Email, password: Password });

export class IdentityApi extends HttpApiGroup.make("identity").add(
  // Answers with the User and sets the session cookie: a visitor is signed in as soon as they sign up.
  HttpApiEndpoint.post("signUp", "/sign-up", {
    payload: SignUpPayload,
    success: User,
    error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
  }),
  // Answers with the User and sets the session cookie. The Session is a new one, whatever cookie the request carries.
  HttpApiEndpoint.post("signIn", "/sign-in", {
    payload: SignInPayload,
    success: User,
    error: InvalidCredentials.pipe(HttpApiSchema.status(401)),
  }),
  // Not protected, and always succeeds: it revokes the Session of the request if there is one, and clears the cookie.
  HttpApiEndpoint.post("signOut", "/sign-out"),
  HttpApiEndpoint.get("me", "/me", {
    success: User,
  }).middleware(Authentication),
) {}
