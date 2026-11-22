export const isFunction = <T>(value: T): value is Extract<T, Function> =>
  typeof value === "function";

export const isText = (value: unknown): value is string => typeof value === "string";
