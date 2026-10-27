import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义结构化输出的 schema
const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
});

//这没有定义tools的实现方式，只是定义了参数需要什么格式
// $ 这种方式比out parser更好，因为模型训练的时候就保证了tools calls的参数一定符合格式要求的。如果不符合会重新生成的
const modelWithTools = model.bindTools([
  {
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema,
  },
]);

const response = await modelWithTools.invoke(`介绍一下爱因斯坦`);

console.log("response.tool_calls:", response.tool_calls);
// 获取结构化结果
const result = response.tool_calls[0].args;

console.log("结构化结果:", JSON.stringify(result, null, 2));
console.log(`\n姓名: ${result.name}`);
console.log(`出生年份: ${result.birth_year}`);
console.log(`国籍: ${result.nationality}`);
console.log(`研究领域: ${result.fields.join(", ")}`);
