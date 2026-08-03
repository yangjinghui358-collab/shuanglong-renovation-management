import { OwnerDashboardSchema, type OwnerDashboard } from "@shuanglong/contracts";

const INVALID_PAYLOAD_MESSAGE = "经营数据格式异常，请稍后重试";

class InvalidDashboardPayloadError extends Error {
  constructor() {
    super(INVALID_PAYLOAD_MESSAGE);
    this.name = "InvalidDashboardPayloadError";
  }
}

function dashboardEndpoint(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  const apiBase = (configuredBase || "/api").replace(/\/+$/, "");
  return `${apiBase}/dashboard/owner`;
}

export async function fetchOwnerDashboard(): Promise<OwnerDashboard> {
  try {
    const response = await fetch(dashboardEndpoint(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`owner dashboard request failed: ${response.status}`);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new InvalidDashboardPayloadError();
    }

    const parsed = OwnerDashboardSchema.safeParse(payload);
    if (!parsed.success) throw new InvalidDashboardPayloadError();
    return parsed.data;
  } catch (error) {
    if (error instanceof InvalidDashboardPayloadError) throw error;
    throw new Error("经营数据暂时无法加载，请稍后重试");
  }
}
