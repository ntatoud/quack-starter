import dayjs from "dayjs";
import i18n from "i18next";

import { i18nConfig } from "@/lib/i18n/config";
import { DEFAULT_LANGUAGE_KEY } from "@/lib/i18n/constants";

dayjs.locale(DEFAULT_LANGUAGE_KEY);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18n.init(i18nConfig);

export default i18n;
