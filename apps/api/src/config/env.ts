export interface ApiEnv {
  WECOM_DATABASE_URL: string;
  MANAGEMENT_DATABASE_URL: string;
  ADMIN_PHONE: string;
  ADMIN_INITIAL_PASSWORD: string;
  AGENT_INGEST_TOKEN: string;
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

  const required = (name: string) => { const value=source[name]?.trim(); if(!value) throw new Error(`${name} is required`); return value; };
  const adminPhone=required("ADMIN_PHONE"); if(!/^1[3-9]\d{9}$/.test(adminPhone)) throw new Error("ADMIN_PHONE must be a valid mobile number");
  const adminPassword=required("ADMIN_INITIAL_PASSWORD"); if(adminPassword.length<12) throw new Error("ADMIN_INITIAL_PASSWORD must contain at least 12 characters");
  const agentToken=required("AGENT_INGEST_TOKEN"); if(agentToken.length<24) throw new Error("AGENT_INGEST_TOKEN must contain at least 24 characters");
  return { WECOM_DATABASE_URL: databaseUrl.toString(), MANAGEMENT_DATABASE_URL:required("MANAGEMENT_DATABASE_URL"), ADMIN_PHONE:adminPhone, ADMIN_INITIAL_PASSWORD:adminPassword, AGENT_INGEST_TOKEN:agentToken };
}
