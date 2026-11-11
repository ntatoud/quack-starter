export type Message = { message?: string };

/** Schema validators report issues; function validators may return a plain string. */
export const toMessage = (error: unknown): Message | undefined =>
  typeof error === "string" ? { message: error } : (error as Message | undefined);
