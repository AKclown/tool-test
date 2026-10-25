import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import dotenv from "dotenv";

import chalk from "chalk";

dotenv.config();

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 注册MCP服务
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "node",
      args: [
        "C:\\Users\\Administrator\\Desktop\\tool-test\\src\\my-mcp-server.mjs",
      ],
    },
  },
});

const tools = await mcpClient.listTools();

const modelWithTools = model.bindTools(tools);

const res = await mcpClient.listResources();

let resourceContent = "";
console.log("res: ", res);

for (const [serverName, resources] of Object.entries(res)) {
  for (const resource of resources) {
    const content = await mcpClient.readResource(serverName, resource.uri);
    resourceContent += content[0].text;
    console.log("content: ", content);
  }
}

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(resourceContent),
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`正在等待 AI 思考...`));

    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // 检查是否有工具调用

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`AI最终回复为：${response.content}`);

      return response.content;
    }

    // 执行工具调用

    for (const toolCall of response.tool_calls) {
      const tool = tools.find((t) => t.name === toolCall.name);

      if (!tool) {
        console.log(`未找到工具: ${toolCall.name}`);
        continue;
      }
      try {
        const result = await tool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            content: result,
            tool_call_id: toolCall.id,
          }),
        );
      } catch (error) {
        console.log(`工具调用错误: ${error.message} (${toolCall.name})`);
        messages.push(
          new ToolMessage({
            content: `错误: ${error.message}`,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }

  return messages.at(-1).content;
}

const case1 = `Mcp SERVER指南是什么`;

try {
  await runAgentWithTools(case1, 30);

  await mcpClient.close();
} catch (error) {
  console.error("运行代理时出错:", error);
}
