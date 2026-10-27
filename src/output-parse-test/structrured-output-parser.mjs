import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义输出结构
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "姓名",
  birth_year: "出生年份",
  nationality: "国籍",
  major_achievements: "主要成就，用逗号分隔的字符串",
  famous_theory: "著名理论",
});

const question = `请介绍一下爱因斯坦。${parser.getFormatInstructions()}`;

console.log("question:", question);

try {
  console.log("🤔 正在调用大模型（使用 StructuredOutputParser）...\n");
  const response = await model.invoke(question);

  const result = await parser.parse(response.content);

  console.log("\n✅ StructuredOutputParser 自动解析的结果:\n");
  console.log(result);
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就: ${result.major_achievements}`);
} catch (error) {
  console.error("❌ 错误:", error.message);
}
