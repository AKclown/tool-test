// 内存中的短期记忆
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

async function fileHistoryDemo() {
  // 指定存储文件的路径
  const filePath = path.join(process.cwd(), "chat_history.json");
  const sessionId = "user_session_001";

  const history = new FileSystemChatMessageHistory({
    filePath: filePath,
    sessionId: sessionId,
  });

  const systemMessage = new SystemMessage(
    "你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。",
  );

  // 第一轮对话
  console.log("[第一轮对话]");

  const userMessage1 = new HumanMessage("你今天吃的什么？");

  await history.addMessage(userMessage1);

  const message1 = [systemMessage, ...(await history.getMessages())];

  const response1 = await model.invoke(message1);

  await history.addMessage(response1);

  console.log(`用户: ${userMessage1.content}`);
  console.log(`助手: ${response1.content}\n`);

  // 第二轮对话（基于历史记录）
  console.log("[第二轮对话 - 基于历史记录]");

  const userMessage2 = new HumanMessage("好吃吗？");

  await history.addMessage(userMessage2);

  const message2 = [systemMessage, ...(await history.getMessages())];

  const response2 = await model.invoke(message2);

  await history.addMessage(response2);

  console.log(`用户: ${userMessage2.content}`);
  console.log(`助手: ${response2.content}`);
  console.log(`✓ 对话已更新到文件\n`);
}

fileHistoryDemo().catch(console.error);
