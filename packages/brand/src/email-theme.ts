// Mail clients read no CSS variable and no `oklch`: these are the light values of `theme.css`, in hex and pixels.
// A change of the theme there is made here too.
// `--radius`, in pixels at 16 to the rem.
const radius = 4;

export const emailTheme = {
  colors: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    primary: "#2e2e2e",
    "primary-foreground": "#fafafa",
    muted: "#f5f5f5",
    "muted-foreground": "#737373",
    border: "#e5e5e5",
  },
  // The scale `@quack/ui/globals.css` draws from `--radius`.
  radii: { md: `${radius * 0.8}px`, lg: `${radius}px`, xl: `${radius * 1.4}px` },
} as const;
