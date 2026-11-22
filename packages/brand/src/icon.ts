import { brand } from "#/brand.ts";

// A favicon reads no CSS variable: these are `--primary` and `--primary-foreground` of `theme.css`, light then dark.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<style>
rect { fill: oklch(0.205 0 0); } text { fill: oklch(0.985 0 0); }
@media (prefers-color-scheme: dark) { rect { fill: oklch(0.922 0 0); } text { fill: oklch(0.205 0 0); } }
</style>
<rect width="32" height="32" rx="8" />
<text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600">${brand.initial}</text>
</svg>`;

export const iconHref = `data:image/svg+xml,${encodeURIComponent(svg)}`;
