import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { Database } from "#/database/database.ts";
import { AiClientHttpClient, IdentityPostgres } from "#/modules/identity/index.ts";
import { MailerSmtp } from "#/modules/mail/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";
import { ServerLayer } from "#/server.ts";

const Storage = Layer.mergeAll(IdentityPostgres, TransactionPostgres);

Layer.launch(
  ServerLayer.pipe(
    Layer.provide([Storage, AiClientHttpClient, MailerSmtp]),
    Layer.provide(Database),
  ),
).pipe(NodeRuntime.runMain);
