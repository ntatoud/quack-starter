// The theme: without it the components have no size, no focus ring, and no `sr-only`.
import "@quack/ui/globals.css";

import { setPlatform } from "@ui-sdk/core/testing";
import { beforeEach } from "vite-plus/test";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}

// Development warnings from ui-sdk fail the test.
globalThis.__UI_SDK_STRICT__ = true;

// Shortcuts read Control, not Command, whatever machine runs the tests; a test that sets another platform keeps it to itself.
beforeEach(() => setPlatform("other"));
