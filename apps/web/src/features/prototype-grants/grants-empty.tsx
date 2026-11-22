import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { BotIcon } from "lucide-react";

import { mcpUrl } from "#/features/prototype-grants/grants-data.ts";

export function GrantsEmpty() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BotIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No AI Client can act for you yet</EmptyTitle>
        <EmptyDescription>
          An AI Client is an app driven by an AI model, like Claude or ChatGPT. Once you approve
          one, it shows up here and you can cut it off at any time.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-md items-start text-left">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>
            In your AI Client, add Quack as a connector with this MCP URL:
            <code className="mt-1 block rounded-md bg-muted px-2 py-1 font-mono text-xs">
              {mcpUrl}
            </code>
          </li>
          <li>Quack asks what it may do for you. Read it, then approve.</li>
          <li>Come back here to see its access, or to revoke it.</li>
        </ol>
      </EmptyContent>
    </Empty>
  );
}
