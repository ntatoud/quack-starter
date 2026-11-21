const orDefault = (value: string | undefined, fallback: string) =>
  value === undefined || value === "" ? fallback : value;

export const devMailEnv = (env: Readonly<Record<string, string | undefined>>) => ({
  SMTP_URL: orDefault(env["SMTP_URL"], "smtp://127.0.0.1:10250"),
  MAIL_FROM: orDefault(env["MAIL_FROM"], "Quack <no-reply@quack.dev>"),
});
