import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { ServerLayer } from "#/server.ts";

Layer.launch(ServerLayer).pipe(NodeRuntime.runMain);
