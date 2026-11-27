import { Api } from "@quack/contracts/api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

export const SystemModule = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers.handleAll({
    health: () => Effect.void,
  }),
);
