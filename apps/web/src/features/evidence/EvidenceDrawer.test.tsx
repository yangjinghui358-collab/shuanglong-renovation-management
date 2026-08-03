import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DashboardEvidence } from "@shuanglong/contracts";
import { EvidenceDrawer } from "./EvidenceDrawer";

const evidence: DashboardEvidence[] = [{
  id: "evidence-1",
  sourceType: "event",
  excerpt: "合成施工事件摘要",
  occurredAt: "2026-08-02T22:20:00+08:00",
  senderName: "项目经理",
}];

describe("EvidenceDrawer", () => {
  it("keeps evidence private until the owner explicitly expands it", async () => {
    const user = userEvent.setup();
    render(<EvidenceDrawer open={false} onClose={vi.fn()} title="施工依据" evidence={evidence} />);

    expect(screen.queryByText("合成施工事件摘要")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看依据" }));
    expect(screen.getByRole("dialog", { name: "施工依据" })).toBeVisible();
    expect(screen.getByText("合成施工事件摘要")).toBeVisible();
    expect(screen.getByText("项目经理")).toBeVisible();
    expect(screen.queryByText(/raw_json/i)).not.toBeInTheDocument();
  });

  it("closes the expanded source without removing the summary trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EvidenceDrawer open onClose={onClose} title="施工依据" evidence={evidence} />);
    await user.click(screen.getByRole("button", { name: "关闭依据" }));
    expect(screen.queryByRole("dialog", { name: "施工依据" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看依据" })).toBeVisible();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
