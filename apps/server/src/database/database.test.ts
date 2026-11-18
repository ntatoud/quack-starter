import { describe, expect, it } from "vite-plus/test";

import { withoutPassword } from "#/database/database.ts";

describe("withoutPassword", () => {
  it("masks the password of the URL", () => {
    expect(withoutPassword("postgres://quack:s3cret@db.example:5432/quack?sslmode=require")).toBe(
      "postgres://quack:***@db.example:5432/quack?sslmode=require",
    );
  });

  it("masks a password given as a parameter", () => {
    expect(withoutPassword("postgres://db.example/quack?user=quack&password=s3cret")).toBe(
      "postgres://db.example/quack?user=quack&password=***",
    );
  });

  it("leaves a URL with no password as it is", () => {
    expect(withoutPassword("postgres://quack@db.example/quack")).toBe(
      "postgres://quack@db.example/quack",
    );
  });

  it("never repeats what is not a URL, since it may hold the password", () => {
    expect(withoutPassword("quack:s3cret")).not.toContain("s3cret");
  });
});
