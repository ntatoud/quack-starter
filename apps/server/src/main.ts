import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { Database } from "#/database/database.ts";
import { AiClientHttpClient, IdentityPostgres } from "#/modules/identity/index.ts";
import { MailSmtp } from "#/modules/mail/index.ts";
import { TodosPostgres } from "#/modules/todos/index.ts";
import { ServerLayer } from "#/server.ts";

const Storage = Layer.mergeAll(IdentityPostgres, TodosPostgres);

Layer.launch(
  ServerLayer.pipe(Layer.provide([Storage, AiClientHttpClient, MailSmtp]), Layer.provide(Database)),
).pipe(NodeRuntime.runMain);
