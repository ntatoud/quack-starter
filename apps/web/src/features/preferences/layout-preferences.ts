import { Schema } from "effect";

import { definePreference } from "#/features/preferences/preference.ts";

export const rightSidebar = definePreference(Schema.Boolean, false);
