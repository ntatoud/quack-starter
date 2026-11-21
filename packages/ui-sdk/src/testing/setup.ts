import "@quack/ui/globals.css";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
// Development warnings from ui-sdk fail the test.
globalThis.__UI_SDK_STRICT__ = true;
