import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

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
  const history = new InMemoryChatMessageHistory();

  history.addMessage(
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
  );

  history.addMessage(new HumanMessage(query));

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`正在等待 AI 思考...`));

    const messages = await history.getMessages();

    // 改为流式输出
    const rawStream = await modelWithTools.stream(messages);

    // 准备一个空容器来拼接完整的AIMessage
    let fullAIMessage = null;

    // 准备一个tool_call_chunks的JSON增量解析器
    const toolParser = new JsonOutputToolsParser();

    // $ 记录每个工具调用已打印的长度(用 id 或 filePath 作为 key)
    const printedLengths = new Map();

    console.log(chalk.bgBlue(`\n🚀 Agent 开始思考并生成流...\n`));

    // $ 对AImessageChunk做concat，并且通过使用JsonOutputToolsParser解析tool_call_chunks

    // 这里的chunk遍历完成之后，AImessage自然就完整了.
    for await (const chunk of rawStream) {
      // 这里的chunk就是AIMessage将他们concat起来
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

      let parseTools = null;

      // $ 关键是这部分逻辑
      try {
        // 将拼接好的AIMessage解析成对应的工具Tools
        parseTools = await toolParser.parseResult([{ message: fullAIMessage }]);
      } catch (error) {
        // !!!解析失败说明 JSON 还不完整，忽略错误继续累积
      }

      // 实例:
      // [
      //   {
      //     type: "get_weather",
      //     args: {
      //       city: "西雅图",
      //     },
      //   },
      // ];

      if (parseTools && parseTools.length > 0) {
        for (const toolCall of parseTools) {
          // $ 写入工具调用的打印过程
          if (toolCall.type === "write_file" && toolCall.args.content) {
            const toolCallId =
              toolCall.id || toolCall.args.filePath || "default";
            // 该数据是经过JsonOutputToolsParser处理的，那么会自动的追加arg内容
            const currentContent = String(toolCall.args.content);
            const previousLength = printedLengths.get(toolCallId);
            if (previousLength === undefined) {
              printedLengths.set(toolCallId, 0);
              console.log(
                chalk.bgBlue(
                  `\n[工具调用] write_file("${toolCall.args.filePath}") - 开始写入（流式预览）\n`,
                ),
              );
            }

            // 
            if (currentContent.length > previousLength) {
            // 该数据是经过JsonOutputToolsParser处理的，那么会自动的追加arg内容，因此后面都是新加的内容
              const newContent = currentContent.slice(previousLength);
              // 流式输出新追加的内容
              process.stdout.write(newContent);
              printedLengths.set(toolCallId, currentContent.length);
            }
          }
        }
      } else {
        // $ 当前还没有解析出工具调用时，如果有文本内容就直接输出
        if (chunk.content) {
          process.stdout.write(
            typeof chunk.content === "string"
              ? chunk.content
              : JSON.stringify(chunk.content),
          );
        }
      }
    }

    // 此时 fullAIMessage 已经完美还原，直接存入 history
    await history.addMessage(fullAIMessage);
    console.log(chalk.green("\n✅ 消息已完整存入历史"));

    // 检查是否有工具调用
    if (!fullAIMessage.tool_calls || fullAIMessage.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${fullAIMessage.content}\n`);
      return fullAIMessage.content;
    }

    // 执行工具调用
    for (const toolCall of fullAIMessage.tool_calls) {
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

  const finalMessages = await history.getMessages();

  return finalMessages.at(-1).content;
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
