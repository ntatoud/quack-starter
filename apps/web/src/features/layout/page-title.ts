export const appName = "Quack Starter";

export const pageTitle = (...segments: ReadonlyArray<string>) =>
  [...segments.map((segment) => segment.trim()).filter((segment) => segment !== ""), appName].join(
    " | ",
  );
