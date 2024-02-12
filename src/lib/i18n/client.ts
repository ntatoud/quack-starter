import dayjs from "dayjs";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { i18nConfig } from "@/lib/i18n/config";
import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE_KEY,
} from "@/lib/i18n/constants";
import { isBrowser } from "@/lib/ssr";

dayjs.locale(DEFAULT_LANGUAGE_KEY);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18n.use(initReactI18next).init(i18nConfig);

i18n.on("languageChanged", (langKey) => {
  const language = AVAILABLE_LANGUAGES.find(({ key }) => key === langKey);
  dayjs.locale(langKey);
  if (isBrowser) {
    document.documentElement.lang = langKey;
    document.documentElement.dir = language?.dir ?? "ltr";
    document.documentElement.style.fontSize = `${
      (language?.fontScale ?? 1) * 100
    }%`;
  }
});

export default i18n;
