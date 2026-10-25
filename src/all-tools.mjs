import { tool } from "@langchain/core/tools";

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { z } from "zod";

// 读取文件工具
const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      console.log(
        `[工具调用] read_file(${filePath}) -成功读取 ${content.length} 字节`,
      );

      return `文件内容:\n${content}`;
    } catch (error) {
      console.error(`[工具调用] read_file(${filePath}): ${error.message}`);
      return `读取文件失败:\n${error.message}`;
    }
  },
  {
    name: "read_file",
    description: "读取指定路径的文件内容",
    schema: z.object({
      filePath: z.string().describe("文件路径"),
    }),
  },
);

// 写入文件工具
const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      console.log(
        `[工具调用] write_file(${filePath}) - 成功写入 ${content.length} 字节`,
      );
      return `文件写入成功: ${filePath}`;
    } catch (error) {
      console.error(
        `[工具调用] write_file(${filePath}): 写入文件失败 - ${error.message}`,
      );
      return `写入文件失败:\n${error.message}`;
    }
  },
  {
    name: "write_file",
    description: "指定路径写入文件内容，自动创建内容",
    schema: z.object({
      filePath: z.string().describe("文件路径"),
      content: z.string().describe("要写入的内容"),
    }),
  },
);

// 执行命令工具(带实时输出)
const execCommandTool = tool(
  async ({ command, workingDirectory }) => {
    const cwd = workingDirectory || process.cwd();

    console.log(`[工具调用] exec_command(${command}) - 在目录 ${cwd} 执行命令`);

    return new Promise((resolve, reject) => {
      // 解析参数
      const [cmd, ...args] = command.split(" ");

      const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });

      let errorMsg = "";

      child.on("error", (err) => {
        errorMsg = err.message;
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.log(`[工具调用] exec_command(${command}) - 命令执行成功`);
          // 这里的添加额外的cwd的信息，避免之后命令胡乱cd
          const cwdInfo = `/n/n重要提示：命令在目录"${workingDirectory}中执行成功，如果需要再这个项目目录继续执行命令，请使用workingDirectory："${workingDirectory}"参数，不使用 cd 命令`;
          resolve(`命令执行成功: ${command}${cwdInfo}`);
        } else {
          console.log(
            `[工具调用] exec_command(${command}) - 执行失败，退出码: ${code}`,
          );
          reject(
            new Error(
              `命令执行失败，退出码: ${code}${errorMsg ? `，错误信息: ${errorMsg}` : ""}`,
            ),
          );
        }
      });
    });
  },
  {
    name: "exec_command",
    description: "执行指定命令，并实时输出结果",
    schema: z.object({
      command: z.string().describe("要执行的命令"),
      workingDirectory: z
        .string()
        .optional()
        .describe("可选，指定命令执行的工作目录"),
    }),
  },
);

// 列出目录内容工具
const listDirectoryTool = tool(async ({ directoryPath }) => {
  try {
    const files = await fs.readdir(directoryPath);
    console.log(
      `[工具调用] list_directory(${directoryPath}) - 成功列出 ${files.length} 个文件/目录`,
    );
    return `目录内容:\n${files.map((f) => `- ${f}`).join("\n")}`;
  } catch (error) {
    console.error(
      `[工具调用] list_directory(${directoryPath}): 列出目录内容失败 - ${error.message}`,
    );
    return `列出目录内容失败:\n${error.message}`;
  }
});

export { readFileTool, writeFileTool, execCommandTool, listDirectoryTool };
