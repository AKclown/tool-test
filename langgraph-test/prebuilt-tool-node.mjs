// $ 在langGraph中使用tool，内置了ToolNode和toolsCondition
// $ langGraph + Tool calling agent的实现
// ToolNode 负责真正执行工具
// toolsCondition  负责判断 LLM 是否需要调用工具，并决定下一步的执行方向。
import "dotenv/config";

import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { getProductBySku } from "./inventory-mock.mjs";

const getProductStock = tool(async ({ sku }) => getProductBySku(sku), {
  name: "get_product_stock",
  description: "按 SKU 查商品名与库存，SKU 如 SKU-001。",
  schema: z.object({
    sku: z.string().describe("商品 SKU"),
  }),
});

const tools = [getProductStock];
const llm = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
}).bindTools(tools);

async function agent(state) {
  const response = await llm.invoke(state.messages);
  return { messages: response };
}

const toolNode = new ToolNode(tools);

// 調用agent，如果agent認為需要使用工具，就會跳轉到toolNode，調用工具，然後再回到agent繼續執行。
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  // 判斷是否具備工具调用，如果存在就调用toolNode，没有就结束了
  // 条件路由
  .addConditionalEdges("agent", toolsCondition, ["tools", END])
  .addEdge("tools", "agent")
  .compile();

const result = await graph.invoke({
  messages: [
    new HumanMessage("查一下 SKU-001 的库存还有多少，回答里带上商品名和数字。"),
  ],
});

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const last = result.messages.at(-1);
console.log(last?.content ?? result.messages);
