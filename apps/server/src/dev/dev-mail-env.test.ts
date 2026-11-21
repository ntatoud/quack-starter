import { describe, expect, it } from "vite-plus/test";

import { devMailEnv } from "#/dev/dev-mail-env.ts";

describe("devMailEnv", () => {
  it("sends to the Mailpit of compose.yaml, from Quack", () => {
    expect(devMailEnv({})).toEqual({
      SMTP_URL: "smtp://127.0.0.1:10250",
      MAIL_FROM: "Quack <no-reply@quack.dev>",
    });
  });

  it("keeps the SMTP server and the sender already set", () => {
    const env = { SMTP_URL: "smtp://mail.example.com:587", MAIL_FROM: "Ops <ops@example.com>" };

    expect(devMailEnv(env)).toEqual(env);
  });
});
