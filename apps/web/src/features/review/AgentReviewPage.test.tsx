import { fireEvent,render,screen } from "@testing-library/react";
import { http,HttpResponse } from "msw";
import { describe,expect,it } from "vitest";
import { server } from "../../test/server";
import { AgentReviewPage } from "./AgentReviewPage";

describe("AgentReviewPage",()=>{
  it("renders a human-readable business event without technical message ids",async()=>{
    server.use(http.get("/api/review/candidates",()=>HttpResponse.json({items:[{id:"c1",module:"projects",kind:"construction_progress",confidence:.92,status:"pending_review",version:1,createdAt:"2026-08-04T00:00:00Z",payload:{title:"水电施工进展",projectName:"正式工地一号",summary:"水电主要工作已完成，等待下一节点确认。",progress:80,sourceCount:2,sourceMessageIds:["technical-message-id-1","technical-message-id-2"],agentReasoning:"根据两条施工群消息综合判断。"}}]})));
    server.use(http.get("/api/review/candidates/c1/evidence",()=>HttpResponse.json({items:[{id:"technical-message-id-1",senderId:"external-1",senderName:"项目经理",sentAt:"2026-08-03T08:30:00Z",messageType:"text",content:"水电主要工作今天完成。"}],total:2})));
    render(<AgentReviewPage/>);
    expect(await screen.findByRole("heading",{name:"水电施工进展"})).toBeVisible();
    expect(screen.getByText("正式工地一号")).toBeVisible();
    expect(screen.getByText("完成进度")).toBeVisible();
    expect(screen.getByText("80%")).toBeVisible();
    expect(screen.getByText("2 条聊天证据")).toBeVisible();
    expect(screen.getByRole("button",{name:/确认并写入工地管理/})).toBeVisible();
    expect(screen.queryByText(/technical-message-id/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/2 条聊天证据/}));
    expect(await screen.findByText("水电主要工作今天完成。")).toBeVisible();
    expect(screen.getByText(/不消耗 Token/)).toBeVisible();
  });
  it("lets the owner label an unknown WeChat sender without AI",async()=>{
    server.use(http.get("/api/review/candidates",()=>HttpResponse.json({items:[{id:"c2",module:"projects",kind:"event",confidence:.8,status:"pending_review",version:1,createdAt:"2026-08-04T00:00:00Z",payload:{title:"现场消息",sourceCount:1,sourceMessageIds:["m1"]}}]})));
    server.use(http.get("/api/review/candidates/c2/evidence",()=>HttpResponse.json({items:[{id:"m1",senderId:"external-2",senderName:"",sentAt:"2026-08-03T08:30:00Z",messageType:"text",content:"防水材料已到场。"}],total:1})));
    server.use(http.put("/api/evidence/senders/external-2/alias",async({request})=>{const body=await request.json() as{displayName:string};expect(body.displayName).toBe("张师傅");return HttpResponse.json({senderId:"external-2",displayName:body.displayName})}));
    render(<AgentReviewPage/>);
    fireEvent.click(await screen.findByRole("button",{name:/1 条聊天证据/}));
    expect(await screen.findByText("未标注联系人")).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"设置微信名称"}));
    fireEvent.change(screen.getByPlaceholderText("例如：张师傅、项目经理"),{target:{value:"张师傅"}});
    fireEvent.click(screen.getByRole("button",{name:"保存"}));
    expect(await screen.findByText("张师傅")).toBeVisible();
    expect(screen.queryByText("external-2")).not.toBeInTheDocument();
  });
});
