// 将 Agent 的记忆持久化到文件系统，而不是仅仅依赖当前对话的 messages。

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, HumanMessage } from "langchain";
import {
  createFilesystemMiddleware,
  createMemoryMiddleware,
  FilesystemBackend,
} from "deepagents";

// 初始化记忆文件路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.join(__dirname, "workspace-memory");
const projectMemoryPath = "/AGENTS.md"; // 项目简介
const preferencesMemoryPath = "/memory/preferences.md"; // 个人偏好

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
  temperature: 0,
});

// 提供文件系统的读写能力
const backend = new FilesystemBackend({
  rootDir: workspaceDir,
  // 使用虚拟路径模式， 例如agent看到/AGENTS.md。实际上是宿主机workspace-memory/AGENTS.md这个文件
  // 这样agent不需要关注实际磁盘的绝对文件路径，只需要操作虚拟文件系统即可
  virtualMode: true,
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: [
    "你是项目助手。工作区根路径为 /，可用 ls、read_file、write_file、edit_file。",
    "根据 <agent_memory> 回答；用户要求记住时，必须立刻 edit_file，且按类型写入对应文件：",
    `- ${projectMemoryPath}：项目说明、技术栈、架构、仓库约定等`,
    `- ${preferencesMemoryPath}：用户个人偏好（语言、包管理器、回答风格等）`,
    "不要混写：项目事实不要写入 preferences，个人偏好不要写入 AGENTS.md。",
  ].join("\n"),
  middleware: [
    // 提供文件的读写能力
    createFilesystemMiddleware({ backend }),
    // 提供记忆加载和管理的能力
    createMemoryMiddleware({
      backend,
      sources: [projectMemoryPath, preferencesMemoryPath],
    }),
  ],
});

const prompts = [
  "根据记忆，这个项目是做什么的？只答一句。",
  `请记住：我常用的包管理器是 pnpm。`,
  `请记住：本仓库主入口脚本是 src/deepagents/memory-agent.mjs。`,
  "我常用什么包管理器？本 demo 主入口脚本路径是什么？各用一行回答。",
];

let messages = [];

for (const prompt of prompts) {
  console.log("\n用户:", prompt);
  ({ messages } = await agent.invoke(
    { messages: [...messages, new HumanMessage(prompt)] },
    { recursionLimit: 30 },
  ));
  console.log("回复:", messages.at(-1)?.content);
}

for (const p of [projectMemoryPath, preferencesMemoryPath]) {
  const file = path.join(workspaceDir, p.replace(/^\//, ""));
  console.log(`\n--- ${p} ---\n`, fs.readFileSync(file, "utf8"));
}
