import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import {
  readFileTool,
  writeFileTool,
  execCommandTool,
  listDirectoryTool,
} from "./all-tools.mjs";

import dotenv from "dotenv";

import chalk from "chalk";

dotenv.config();

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  // 指定为0不让ai自我发挥，严格按照工具调用和规则执行
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const tools = [readFileTool, writeFileTool, execCommandTool, listDirectoryTool];

const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

    当前工作目录:${process.cwd()}

    工具:

    1.read_file:读取文件

    2.write file:写入文件

    3.execute_command:执行命令(支持 workingDirectory 参数)

    4.list_directory:列出目录

    重要规则 - execute_command:
    - workingDirectory 参数会自动切换到指定目录
    - 当使用 workingDirectory 时，绝对不要在 command 中使用cd
    - 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app"
    这是错误的!因为 workingDirectory 已经在 react-todo-app 目录了，再cd react-todo-app 会找不到目录
    - 正确示例:{ command:"pnpm install", workingDirectory:"react-todo-app" }
    这样就对了!workingDirectory 已经切换到react-todo-app，直接执行命令即可
    回复要简洁，只说做了什么`),
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
        console.log(`工具调用结果 ${result} (${toolCall.name})`);
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

const case1 = `创建一个功能丰富的 React TodoList 应用:

1. 创建项目: echo -e "n\nn" I pnpm create vite react-todo-app --template react-ts

2.修改 src/App.tsx，实现完整功能的TodoList:

添加、删除、编辑、标记完成

分类筛选(全部/进行中/已完成)

统计信息显示

localStorage 数据持久化

3.添加复杂样式:

渐变背景(蓝到紫)

卡片阴影、圆角

悬停效果

添加动画:

4.

添加/删除时的过渡动画

使用 CSS transitions

5.列出目录确认

注意:使用 pnpm，功能要完整，样式要美观，要有动画效果

之后在 react-todo-app 项目中:

1.使用 pnpm install安装依赖

2.

使用 pnpm run dev 启动服务器`;

try {
  await runAgentWithTools(case1, 30);
} catch (error) {
  console.error("运行代理时出错:", error);
}
