import { useSyncExternalStore } from "react";

let mobileQuery: MediaQueryList | undefined;

const getMobileQuery = () => (mobileQuery ??= window.matchMedia("(max-width: 767px)"));

function subscribe(onChange: () => void) {
  const query = getMobileQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => getMobileQuery().matches,
    () => false,
  );
}
