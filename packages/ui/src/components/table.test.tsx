import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { Table, TableBody, TableCell, TableRow } from "@quack/ui/components/table";

import { render } from "vitest-browser-react";

describe("TableCell", () => {
  it("wraps its text, and mutes it, on demand", async () => {
    await render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Plain</TableCell>
            <TableCell wrap tone="muted">
              Prose
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const plain = page.getByRole("cell", { name: "Plain" });
    await expect.element(plain).toBeVisible();
    const style = (name: string) => getComputedStyle(page.getByRole("cell", { name }).element());

    expect(style("Plain").whiteSpace).toBe("nowrap");
    expect(style("Prose").whiteSpace).toBe("normal");
    expect(style("Prose").color).not.toBe(style("Plain").color);
  });
});
