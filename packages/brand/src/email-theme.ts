// Mail clients read no CSS variable and no `oklch`: these are the light values of `theme.css`, in hex and pixels.
// A change of the theme there is made here too.
// `--radius`, in pixels at 16 to the rem.
const radius = 4;

export const emailTheme = {
  colors: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    primary: "#171717",
    "primary-foreground": "#fafafa",
    muted: "#f5f5f5",
    "muted-foreground": "#737373",
    border: "#e5e5e5",
    // `--edge` and `--primary-edge`: mail clients draw no `box-shadow` everywhere, so the edge is a bottom border.
    edge: "#b7b7b7",
    "primary-edge": "#6a6a6a",
    // `--highlight` over `--primary`: a border, as no inset shadow shows everywhere.
    "primary-highlight": "#8b8b8b",
  },
  // The scale `@quack/ui/globals.css` draws from `--radius`.
  radii: { md: `${radius * 0.8}px`, lg: `${radius}px`, xl: `${radius * 1.4}px` },
  // `--depth`, and the thinner one of `@quack/ui`'s button.
  borderWidths: { depth: "3px", "button-depth": "2px", highlight: "1px" },
} as const;
