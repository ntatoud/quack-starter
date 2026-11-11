import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", {
    success: HttpApiSchema.NoContent,
  }),
) {}
