// LangChain Agent 的 Middleware（中间件）机制

import "dotenv/config";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  createAgent,
  createMiddleware,
  HumanMessage,
  AIMessage,
} from "langchain";

// --- 自定义 Middleware ---
/** 日志 + 模型调用次数统计 */
const loggingMiddleware = createMiddleware({
  name: "LoggingMiddleware",
  // 定义中间件的状态，记录嗲用了多少次模型
  stateSchema: z.object({
    modelCallCount: z.number().default(0),
  }),
  beforeAgent: (state) => {
    // 记录 Agent 开始执行
    console.log("\n[Logging] agent 开始，消息数:", state.messages.length);
  },
  beforeModel: (state) => {
    console.log(
      `[Logging] 即将调用模型，当前消息数: ${state.messages.length}，已调用: ${state.modelCallCount} 次`,
    );
  },
  afterModel: (state) => {
    // 模型返回的messages
    const last = state.messages.at(-1);
    const preview =
      typeof last?.content === "string"
        ? last.content.slice(0, 80)
        : JSON.stringify(last?.content)?.slice(0, 80);
    console.log(`[Logging] 模型返回: ${preview}...`);
    // 更新模型调用的从次数
    return { modelCallCount: state.modelCallCount + 1 };
  },
  afterAgent: (state) => {
    console.log(
      `[Logging] agent 结束，累计模型调用: ${state.modelCallCount} 次\n`,
    );
  },
});

/** 在每次模型调用前追加 system 上下文 */
const addContextMiddleware = createMiddleware({
  name: "AddContextMiddleware",
  // $ 每次调用模型之前，动态追加额外的System Prompt
  wrapModelCall: async (request, handler) => {
    console.log("[AddContext] 注入额外 system 上下文");
    return handler({
      ...request,
      systemMessage: request.systemMessage.concat("\n\n 请用一句话简洁回答。"),
    });
  },
});

/** 拦截敏感词，直接结束 agent */
const blockedContentMiddleware = createMiddleware({
  name: "BlockedContentMiddleware",
  beforeModel: {
    canJumpTo: ["end"],
    hook: (state) => {
      const last = state.messages.at(-1);
      const text =
        typeof last?.content === "string"
          ? last.content
          : String(last?.content ?? "");
      if (text.includes("BLOCKED")) {
        console.log("[Blocked] 检测到 BLOCKED，短路结束");
        return {
          messages: [new AIMessage("该请求已被 middleware 拦截，无法处理。")],
          jumpTo: "end",
        };
      }
    },
  },
});

// --- Agent ---

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
  // 添加中间件的能力
  middleware: [
    loggingMiddleware,  // 记录生命周期日志和模型调用次数
    addContextMiddleware, // 动态追加 System Prompt
    blockedContentMiddleware, // 拦截敏感词
  ],
});

// 像洋葱模型架构
// 1. beforeAgent：记录 Agent 开始。
// 2. beforeModel：记录模型调用。
// 3. AddContextMiddleware：追加 System Prompt。
// 4. 调用 LLM。
// 5. afterModel：模型调用次数 +1。
// 6. afterAgent：记录 Agent 结束。

for (const text of [
  "用中文说：middleware 是什么？",
  "这句话包含 BLOCKED 关键词",
]) {
  console.log("\n用户:", text);
  const { messages, modelCallCount } = await agent.invoke({
    messages: [new HumanMessage(text)],
  });
  console.log("回复:", messages.at(-1)?.content);
  console.log("modelCallCount:", modelCallCount);
}
