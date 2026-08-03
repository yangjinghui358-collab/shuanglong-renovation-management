import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {CustomerManagementPage} from "./CustomerManagementPage";

vi.mock("../auth/AuthProvider",()=>({useAuth:()=>({user:{role:"owner"}})}));
vi.mock("../dashboard/useOwnerDashboard",()=>({useOwnerDashboard:()=>({isPending:false,error:null,refetch:vi.fn(),data:{generatedAt:"2026-08-04T00:00:00Z",sourceFreshness:{lastMessageAt:null,status:"confirmed",statusLabel:"已确认"},digest:null,metrics:[],projects:[],materials:[],approvals:[],leads:[{id:"lead-1",customerName:"李女士",stage:"报价",probability:75,expectedAmount:180000,nextActionAt:"2099-08-05T02:00:00Z",ownerName:"王设计师",status:"confirmed",statusLabel:"已确认"}]}})}));

describe("CustomerManagementPage",()=>{beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[{id:"r1",candidate_id:"c1",kind:"customer_requirement",created_at:"2026-08-04T01:00:00Z",payload:{title:"确认装修需求",customerName:"李女士",summary:"三室两厅现代风格，重点关注收纳。",phone:"18612345678",source:"企业微信",houseType:"三室两厅",area:"120㎡",budget:"18-22万",stage:"报价",owner:"王设计师",tags:["现代风格","重视收纳"]}}]})})));
  it("shows the home-renovation funnel and customer 360 profile",async()=>{render(<MemoryRouter><CustomerManagementPage/></MemoryRouter>);expect(screen.getByRole("heading",{name:"客户销售"})).toBeInTheDocument();expect(screen.getByRole("region",{name:"销售转化漏斗"})).toBeInTheDocument();expect(screen.getAllByText("新线索").length).toBeGreaterThan(0);expect(screen.getAllByText("量房").length).toBeGreaterThan(0);expect(screen.getAllByText("报价").length).toBeGreaterThan(0);await waitFor(()=>expect(screen.getByRole("row",{name:/李女士/})).toBeInTheDocument());fireEvent.click(screen.getByRole("row",{name:/李女士/}));expect(screen.getByRole("heading",{name:"李女士"})).toBeInTheDocument();expect(screen.getByText("客户与房屋信息")).toBeInTheDocument();expect(screen.getAllByText("三室两厅现代风格，重点关注收纳。").length).toBeGreaterThan(0);expect(screen.getByText("18612345678")).toBeInTheDocument();expect(screen.getByText("跟进时间线")).toBeInTheDocument()});
});
