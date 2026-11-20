/** A select holds `""` until an option is chosen, which the Base UI components call `null`. */
export const chosen = (value: string) => (value === "" ? null : value);

export const choiceOf = (value: string | null) => value ?? "";
