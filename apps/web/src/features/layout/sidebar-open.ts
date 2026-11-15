import { SIDEBAR_COOKIE_NAME } from "@quack/ui/components/sidebar";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export const readSidebarOpen = createIsomorphicFn()
  .server(() => getCookie(SIDEBAR_COOKIE_NAME) !== "false")
  .client(() => !document.cookie.split("; ").includes(`${SIDEBAR_COOKIE_NAME}=false`));
