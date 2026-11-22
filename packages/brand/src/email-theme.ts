// Mail clients read no CSS variable and no `oklch`: these are the light values of `theme.css`, in hex and pixels.
// A change of the theme there is made here too.
export const emailTheme = {
  colors: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    primary: "#171717",
    "primary-foreground": "#fafafa",
    muted: "#f5f5f5",
    "muted-foreground": "#737373",
    border: "#e5e5e5",
  },
  // `--radius`, in pixels at 16 to the rem.
  radius: 4,
} as const;
