import { createTRPCRouter } from "@/server/config/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /src/server/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({});

// export type definition of API
export type AppRouter = typeof appRouter;
