import {fireEvent,render,screen} from "@testing-library/react";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {AgentCenterPage} from "./AgentCenterPage";

describe("AgentCenterPage",()=>{beforeEach(()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[]})}));Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}})});
  it("provides copyable structured chat templates",async()=>{render(<AgentCenterPage/>);fireEvent.click(screen.getByRole("button",{name:/群聊模板/}));expect(screen.getByText("【客户建档】")).toBeInTheDocument();expect(screen.getByText("【施工进度】")).toBeInTheDocument();expect(screen.getByText("【阶段验收】")).toBeInTheDocument();const copyButtons=screen.getAllByRole("button",{name:"复制模板"});fireEvent.click(copyButtons[0]);expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("客户姓名："))});
});
