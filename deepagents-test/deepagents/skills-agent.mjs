// 让 Agent 自动读取本地的 Skill 技能说明，根据 Skill 的规范调用文件系统能力，最终生成一张 Excalidraw 流程图文件
import "dotenv/config";
import { existsSync, mkdirSync } from "node:fs";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, HumanMessage } from "langchain";
import {
  LocalShellBackend,
  createFilesystemMiddleware,
  createSkillsMiddleware,
} from "deepagents";

// skill技能所在目录
const skills = "/.agents/skills/";
// 最终生成的流程图文件
const output = "src/deepagents/output/deepagents-skills-flow.excalidraw";

if (!existsSync(".agents/skills/excalidraw-diagram-generator/SKILL.md")) {
  throw new Error(
    "未找到 excalidraw-diagram-generator，请先: npx skills add github/awesome-copilot --skill excalidraw-diagram-generator -y",
  );
}

mkdirSync("src/deepagents/output", { recursive: true });

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
  temperature: 0,
  streaming: true,
});

// 提供底层文件系统能力 - agent操作本地文件系统的后端执行环境
const backend = await LocalShellBackend.create({
  // 文件操作的根目录
  rootDir: ".",
  // 虚拟文件系统模式，
  virtualMode: true,
  // 承受当前进程的环境变量
  inheritEnv: true,
});

const agent = createAgent({
  model,
  tools: [],
  systemPrompt:
    "按 skills 库完成任务，需要时 read_file 对应 SKILL.md。中文回答。",
  middleware: [
    // $ Skills Middleware 并不是直接把某个 Skill 当作工具调用，而是让 Agent 能够发现、读取和遵循 Skill 中定义的工作规范
    // 让agent获得skills的能力
    createSkillsMiddleware({ backend, sources: [skills] }),
    // 读写本地文件
    createFilesystemMiddleware({ backend }),
  ],
});

const prompt = [
  "画一张流程图，描述本项目的 skills-agent 工作流：",
  "用户 Prompt → createAgent → createSkillsMiddleware → createFilesystemMiddleware → 模型回复。",
  `保存为 ${output}。要求：`,
  "- 顶部大标题 + 副标题",
  "- 每个主节点 numbered（①②…）且框内 2～3 行中文说明",
  "- 右侧一列「说明：…」补充细节",
  "- 箭头上标注阶段名（如 invoke、wrapModelCall）",
  "- 底部图例（颜色含义 + 如何运行 demo）",
].join("\n");

console.log("用户:", prompt);

function chunkText(chunk) {
  if (!chunk?.content) return "";
  if (typeof chunk.content === "string") return chunk.content;
  if (Array.isArray(chunk.content)) {
    return chunk.content
      .map((p) => (typeof p === "string" ? p : (p?.text ?? "")))
      .join("");
  }
  return "";
}

const stream = await agent.streamEvents(
  { messages: [new HumanMessage(prompt)] },
  { recursionLimit: 100 },
);

let skillsMetadata;
console.log("\n--- 流式输出 ---\n");

try {
  for await (const event of stream) {
    if (event.event === "on_chat_model_stream") {
      const text = chunkText(event.data?.chunk);
      if (text) process.stdout.write(text);
    }
    if (event.event === "on_tool_start") {
      const name = event.name?.split("/").pop() ?? event.name;
      process.stdout.write(`\n\n→ ${name}\n\n`);
    }
    if (event.event === "on_chain_end" && event.data?.output?.skillsMetadata) {
      skillsMetadata = event.data.output.skillsMetadata;
    }
  }
} catch (e) {
  console.error("\n\n[错误]", e.cause?.message ?? e.message);
  throw e;
}

console.log("\n");
console.log(
  "skills:",
  skillsMetadata?.map((s) => s.name),
);
if (existsSync(output)) {
  console.log("图表:", output);
  console.log("打开: https://excalidraw.com → Open → 选择该文件");
} else {
  console.log("未生成:", output);
}

await backend.close();
