import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
// 它的作用是解析tool_call_chunks中的内容，拼接成符合json格式规范的对象，就算chunk还没传输完的时候，也能拿到json对象
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义结构化输出的 schema
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().optional().describe("去世年份，如果还在世则不填"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
  achievements: z.array(z.string()).describe("主要成就"),
  biography: z.string().describe("简短传记"),
});

const modelWithTool = model.bindTools([
  {
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema,
  },
]);

const parser = new JsonOutputToolsParser();
const chain = modelWithTool.pipe(parser);

console.log("🌊 流式 Tool Calls 演示 - 直接打印原始 tool_calls_chunk\n");

try {
  // 开启流式输出
  const stream = await chain.stream("详细介绍牛顿的生平和成就");

  let lastContent = ""; // 记录已打印的完整内容
  let finalResult = null; // 存储最终的完整结果

  console.log("📡 实时输出流式内容:\n");

  for await (const chunk of stream) {
    if (chunk.length > 0) {
      const toolCall = chunk[0];

      // 获取当前工具调用的完整参数内容
      const currentContent = JSON.stringify(toolCall.args || {}, null, 2);

      if (currentContent.length > lastContent.length) {
        const newText = currentContent.slice(lastContent.length);
        // 从打印中可以看出，流式返回，就算tool_call_chunks还不完整，也会拼成正确格式的tool_calls
        process.stdout.write(newText);
        lastContent = currentContent;
      }

      console.log(toolCall.args);
    }
  }
  console.log("\n\n✅ 流式输出完成");
} catch (error) {
  console.error("\n❌ 错误:", error.message);
  console.error(error);
}
