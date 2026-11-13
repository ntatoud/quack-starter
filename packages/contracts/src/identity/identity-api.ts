import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { EmailAlreadyTaken } from "#/identity/identity-errors.ts";
import { Email, Password, User } from "#/identity/user.ts";

export class IdentityApi extends HttpApiGroup.make("identity").add(
  HttpApiEndpoint.post("signUp", "/sign-up", {
    payload: Schema.Struct({ email: Email, password: Password }),
    success: User,
    error: EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
  }),
) {}
