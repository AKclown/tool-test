// $ DeepAgents 的文件系统中间件（Filesystem Middleware）以及文件权限控制（Permissions）
// $ 实现了一个带文件操作能力的Agent，并通过权限规则限制Agent能读取，创建和修改哪些文件

// 给 Agent 一个虚拟工作区，让它能够通过 ls、read_file、write_file、edit_file 操作文件，同时由中间件负责检查文件操作是否有权限。
// $ 只要加上deepagents这个fileSystem中间件，agent就有一个文件系统，并且有了读写搜索文件的各种tool，还做了权限控制
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, HumanMessage } from "langchain";
import { createFilesystemMiddleware, FilesystemBackend } from "deepagents";

const workspaceDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "w",
);

/** 先匹配先生效；未命中任何规则则默认允许 */
// $ 这里是权限配置
const permissions = [
  { operations: ["read"], paths: ["/secret.txt"], mode: "deny" },
  { operations: ["write"], paths: ["/todo.md"], mode: "allow" },
  { operations: ["write"], paths: ["/**"], mode: "deny" },
];

// 删除工作空间文件，并且创建目录，创建secret机密文件
fs.rmSync(workspaceDir, { recursive: true, force: true });
fs.mkdirSync(workspaceDir);
fs.writeFileSync(
  path.join(workspaceDir, "secret.txt"),
  "机密：不得读取",
  "utf8",
);

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
  temperature: 0,
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt:
    "工作区根路径为 /。用 ls、read_file、write_file、edit_file 操作文件，路径以 / 开头。中文回答。",
  middleware: [
    createFilesystemMiddleware({
      // Backend负责实际的文件操作
      backend: new FilesystemBackend({
        // 指定文件系统的真实根目录
        rootDir: workspaceDir,
        // virtualMode 使用虚拟工作区路径进行文件操作。表示使用虚拟工作区路径进行文件操作。
        virtualMode: true,
      }),
      //   权限控制的关键价值在于，不是让模型自己判断能不能读写，而是由中间件在执行操作时进行约束。
      permissions,
    }),
  ],
});

console.log("工作区:", workspaceDir);
console.log("权限:", JSON.stringify(permissions, null, 2));

async function run(label, prompt) {
  console.log(`\n=== ${label} ===\n`, prompt, "\n");
  const { messages } = await agent.invoke(
    { messages: [new HumanMessage(prompt)] },
    // 限制 LangGraph 执行过程中最多允许的递归步数，防止 Agent 无限循环调用工具。
    { recursionLimit: 20 },
  );
  for (const m of messages) {
    for (const t of m.tool_calls ?? []) console.log("→", t.name);
  }
  console.log("回复:", messages.at(-1)?.content);
}

async function expectDenied(label, prompt) {
  console.log(`\n=== ${label}（预期拒绝）===\n`, prompt, "\n");
  try {
    await agent.invoke(
      { messages: [new HumanMessage(prompt)] },
      // 限制 LangGraph 执行过程中最多允许的递归步数，防止 Agent 无限循环调用工具。
      { recursionLimit: 5 },
    );
    console.log("未触发拒绝（异常）");
  } catch (e) {
    const msg = e.cause?.message ?? e.message;
    console.log("✗", msg);
  }
}

await run(
  "允许的操作",
  "write_file 创建 /todo.md（三条待办），edit_file 把第一条标为完成，ls /，一句话总结。",
);

await expectDenied("禁止读", "只调用 read_file，路径 /secret.txt。");
await expectDenied("禁止写", "只调用 write_file，路径 /hack.txt，内容 test。");
