import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectManagementPage } from "./ProjectManagementPage";

vi.mock("../auth/AuthProvider",()=>({useAuth:()=>({user:{role:"owner"}})}));
vi.mock("../dashboard/useOwnerDashboard",()=>({useOwnerDashboard:()=>({isPending:false,error:null,refetch:vi.fn(),data:{generatedAt:"2026-08-04T00:00:00Z",sourceFreshness:{lastMessageAt:"2026-08-04T00:00:00Z",status:"confirmed",statusLabel:"已确认"},digest:null,metrics:[],materials:[],leads:[],approvals:[],projects:[{id:"group-1",name:"正式工地一号",stage:"水电",progress:40,riskLevel:"medium",delayDays:2,ownerName:"项目经理",issue:"等待材料",evidence:[],status:"confirmed",statusLabel:"已确认"}]}})}));

describe("ProjectManagementPage",()=>{
  beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[{id:"todo-1",candidate_id:"candidate-1",kind:"todo",payload:{projectName:"正式工地一号",title:"水电验收",owner:"项目经理",dueDate:"今天",priority:"紧急",status:"待执行",sourceCount:3},created_at:"2026-08-04T00:00:00Z"}]})})));
  it("shows formal project overview and opens detail tabs",async()=>{
    render(<MemoryRouter><ProjectManagementPage/></MemoryRouter>);
    expect(screen.getByRole("heading",{name:"工地管理"})).toBeInTheDocument();
    expect(screen.getByText("正式工地一号")).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:/所有工地待办 1/})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:/所有工地待办/}));
    expect(screen.getByRole("heading",{name:"所有工地待办"})).toBeInTheDocument();
    expect(screen.getByText("水电验收 · 群聊 3 条证据")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"工地总览"}));
    fireEvent.click(screen.getByRole("row",{name:/正式工地一号/}));
    expect(screen.getByRole("heading",{name:"正式工地一号"})).toBeInTheDocument();
    expect(screen.getByRole("region",{name:"整体施工流程"})).toBeInTheDocument();
    expect(screen.getAllByText("水电").length).toBeGreaterThan(0);
    expect(screen.getAllByText("木工施工").length).toBeGreaterThan(0);
    expect(screen.getAllByText("油工施工").length).toBeGreaterThan(0);
    expect(screen.getAllByText("美缝防护").length).toBeGreaterThan(0);
    expect(screen.getAllByText("收尾").length).toBeGreaterThan(0);
    expect(screen.getByText(/总工期 83 天/)).toBeInTheDocument();
    expect(screen.getAllByText("当前施工").length).toBeGreaterThan(0);
    expect(screen.getByText("下一阶段：")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/验收记录/}));
    expect(screen.getByText("暂无验收记录")).toBeInTheDocument();
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/modules/projects/records"));
  });
});
