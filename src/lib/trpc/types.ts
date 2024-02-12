import { type inferReactQueryProcedureOptions } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { type AppRouter as AppRouterFromServer } from "@/server/router";

export type AppRouter = AppRouterFromServer;

export type RouterOutputs = inferRouterOutputs<AppRouterFromServer>;
export type RouterInputs = inferRouterInputs<AppRouterFromServer>;

/**
 * Inference helper for react query options.
 *
 * @example type HelloQueryOptions = ReactQueryOptions['example']['hello']
 */
export type ReactQueryOptions =
  inferReactQueryProcedureOptions<AppRouterFromServer>;
