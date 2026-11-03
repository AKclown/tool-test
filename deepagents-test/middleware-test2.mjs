// $ LangChain Agent 中如何通过 Middleware（中间件）动态注册工具、拦截工具调用、包装工具执行结果，以及统计工具调用次数。
import "dotenv/config";
import { Command } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  createAgent,
  createMiddleware,
  HumanMessage,
  ToolMessage,
  tool,
} from "langchain";

const getCurrentTime = tool(() => new Date().toISOString(), {
  name: "get_current_time",
  description: "返回当前 UTC 时间的 ISO 8601 字符串",
  schema: z.object({}),
});

/** 通过 middleware 注册工具，并用 wrapToolCall 包装执行 */
// $ 工具可以由 Middleware 提供，而不一定全部直接放在 Agent 的 tools 数组中。
const extendedToolsMiddleware = createMiddleware({
  name: "ExtendedToolsMiddleware",
  stateSchema: z.object({
    toolInvocationCount: z.number().default(0),
  }),
  // 通过中间件注册工具
  tools: [getCurrentTime],
  // 拦截工具的调用 request当前工具调用请求(包含了当前工具的调用信息)、handler真正执行工具的处理函数
  wrapToolCall: async (request, handler) => {
    const toolName = request.tool?.name ?? request.toolCall.name;
    console.log(
      `[Tools] 即将执行: ${toolName}`,
      "args:",
      request.toolCall.args ?? {},
    );
    const result = await handler(request);
    // 判断工具执行结果
    if (!ToolMessage.isInstance(result)) return result;

    // 创建一个新的 ToolMessage
    const wrapped = new ToolMessage({
      content: `${result.content}\n[wrapToolCall] 已由 ExtendedToolsMiddleware 包装`,
      tool_call_id: result.tool_call_id,
      name: result.name,
    });
    console.log(
      `[Tools] 执行完成: ${toolName}`,
      typeof wrapped.content === "string"
        ? wrapped.content.slice(0, 120)
        : wrapped,
    );

    // Command 更新 Agent 状态和消息
    return new Command({
      update: {
        toolInvocationCount: request.state.toolInvocationCount + 1,
        messages: [wrapped],
      },
    });
  },
  // afterAgent 在 Agent 结束时执行，并不是每次工具调用后都执行。
  afterAgent: (state) => {
    console.log(
      `[Tools] agent 结束，middleware 统计工具调用: ${state.toolInvocationCount} 次`,
    );
  },
});

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: "你是一个助手。",
  middleware: [extendedToolsMiddleware],
});

for (const text of ["给我当前时间"]) {
  console.log("\n用户:", text);
  const { messages, toolInvocationCount } = await agent.invoke({
    messages: [new HumanMessage(text)],
  });
  console.log("回复:", messages.at(-1)?.content);
  console.log("toolInvocationCount:", toolInvocationCount);
}
