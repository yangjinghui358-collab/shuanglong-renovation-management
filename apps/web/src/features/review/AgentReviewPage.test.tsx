import { render,screen } from "@testing-library/react";
import { http,HttpResponse } from "msw";
import { describe,expect,it } from "vitest";
import { server } from "../../test/server";
import { AgentReviewPage } from "./AgentReviewPage";

describe("AgentReviewPage",()=>{
  it("renders a human-readable business event without technical message ids",async()=>{
    server.use(http.get("/api/review/candidates",()=>HttpResponse.json({items:[{id:"c1",module:"projects",kind:"construction_progress",confidence:.92,status:"pending_review",version:1,createdAt:"2026-08-04T00:00:00Z",payload:{title:"水电施工进展",projectName:"正式工地一号",summary:"水电主要工作已完成，等待下一节点确认。",progress:80,sourceCount:2,sourceMessageIds:["technical-message-id-1","technical-message-id-2"],agentReasoning:"根据两条施工群消息综合判断。"}}]})));
    render(<AgentReviewPage/>);
    expect(await screen.findByRole("heading",{name:"水电施工进展"})).toBeVisible();
    expect(screen.getByText("正式工地一号")).toBeVisible();
    expect(screen.getByText("完成进度")).toBeVisible();
    expect(screen.getByText("80%")).toBeVisible();
    expect(screen.getByText("2 条聊天证据")).toBeVisible();
    expect(screen.getByRole("button",{name:/确认并写入工地管理/})).toBeVisible();
    expect(screen.queryByText(/technical-message-id/)).not.toBeInTheDocument();
  });
});
