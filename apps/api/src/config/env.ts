export interface ApiEnv {
  WECOM_DATABASE_URL: string;
}

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): ApiEnv {
  const rawUrl = source.WECOM_DATABASE_URL;
  if (!rawUrl) {
    throw new Error("WECOM_DATABASE_URL is required");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error("WECOM_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error("WECOM_DATABASE_URL must use postgres or postgresql");
  }

  databaseUrl.searchParams.set(
    "options",
    "-c default_transaction_read_only=on",
  );

  return { WECOM_DATABASE_URL: databaseUrl.toString() };
}
