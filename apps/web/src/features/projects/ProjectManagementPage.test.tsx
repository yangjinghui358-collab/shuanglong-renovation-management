import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectManagementPage } from "./ProjectManagementPage";

vi.mock("../auth/AuthProvider",()=>({useAuth:()=>({user:{role:"owner"}})}));
vi.mock("../dashboard/useOwnerDashboard",()=>({useOwnerDashboard:()=>({isPending:false,error:null,refetch:vi.fn(),data:{generatedAt:"2026-08-04T00:00:00Z",sourceFreshness:{lastMessageAt:"2026-08-04T00:00:00Z",status:"confirmed",statusLabel:"已确认"},digest:null,metrics:[],materials:[],leads:[],approvals:[],projects:[{id:"group-1",name:"正式工地一号",stage:"水电",progress:40,riskLevel:"medium",delayDays:2,ownerName:"项目经理",issue:"等待材料",evidence:[],status:"confirmed",statusLabel:"已确认"}]}})}));

describe("ProjectManagementPage",()=>{
  beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[]})})));
  it("shows formal project overview and opens detail tabs",async()=>{
    render(<MemoryRouter><ProjectManagementPage/></MemoryRouter>);
    expect(screen.getByRole("heading",{name:"工地管理"})).toBeInTheDocument();
    expect(screen.getByText("正式工地一号")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("row",{name:/正式工地一号/}));
    expect(screen.getByRole("heading",{name:"正式工地一号"})).toBeInTheDocument();
    expect(screen.getByRole("region",{name:"整体施工流程"})).toBeInTheDocument();
    expect(screen.getByText("拆除改造")).toBeInTheDocument();
    expect(screen.getAllByText("水电施工").length).toBeGreaterThan(0);
    expect(screen.getAllByText("防水施工").length).toBeGreaterThan(0);
    expect(screen.getByText("交付售后")).toBeInTheDocument();
    expect(screen.getAllByText("当前施工").length).toBeGreaterThan(0);
    expect(screen.getByText("下一阶段：")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/验收记录/}));
    expect(screen.getByText("暂无验收记录")).toBeInTheDocument();
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/modules/projects/records"));
  });
});
