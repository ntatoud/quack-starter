import { countryCodes } from "@quack/contracts/identity/profile";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countryOptions = countryCodes
  .map((code) => ({ value: code, label: regionNames.of(code) ?? code }))
  .toSorted((a, b) => a.label.localeCompare(b.label, "en"));
