import { Api } from "@quack/contracts/Api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

export const SystemHandlers = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers.handleAll({
    health: () => Effect.void,
  }),
);
