import { Theme } from "#/features/preferences/preferences.ts";

export const themeOptions = Theme.literals.map((theme) => ({
  value: theme,
  label: theme.slice(0, 1).toUpperCase() + theme.slice(1),
}));
