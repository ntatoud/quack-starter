import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { EmailAlreadyTaken } from "#/identity/identity-errors.ts";
import { Email, Password, User } from "#/identity/user.ts";

/** What a visitor sends to sign up. The sign-up form validates with it, so the form and the API agree. */
export const SignUpPayload = Schema.Struct({ email: Email, password: Password });

export class IdentityApi extends HttpApiGroup.make("identity").add(
  // Answers with the User and sets the session cookie: a visitor is signed in as soon as they sign up.
  HttpApiEndpoint.post("signUp", "/sign-up", {
    payload: SignUpPayload,
    success: User,
    error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
  }),
  HttpApiEndpoint.get("me", "/me", {
    success: User,
  }).middleware(Authentication),
) {}
