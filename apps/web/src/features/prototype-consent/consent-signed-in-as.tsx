import { Button } from "@quack/ui/components/button";

import { currentUserEmail } from "#/features/prototype-consent/consent-stub.ts";

export function SignedInAs({ onSwitch, className }: { onSwitch: () => void; className?: string }) {
  return (
    <p className={["text-sm text-muted-foreground", className].filter(Boolean).join(" ")}>
      Signed in as <span className="font-medium text-foreground">{currentUserEmail}</span>.{" "}
      <Button variant="link" size="xs" className="h-auto p-0" onClick={onSwitch}>
        Not you? Switch account
      </Button>
    </p>
  );
}
