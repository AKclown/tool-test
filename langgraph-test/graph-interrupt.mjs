// Human-in-the-loop（人在回路中），让 AI Agent 在执行某些操作之前暂停，等待用户确认，然后再继续执行
// AI 准备删除一个文件，先询问用户是否允许。
// AI 准备执行终端命令，等待用户确认。
// AI 准备修改项目配置，等待用户授权。
// AI 准备转账、发送邮件等敏感操作，等待用户确认。

// interrupt 并不是让整个程序永久停止，而是让 LangGraph 保存当前工作流状态，暂停执行，等到用户恢复时继续。

import { createInterface } from "node:readline/promises";
import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  actionSummary: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  userInput: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

/** 展示一笔待确认的转账 */
const showTransfer = () => ({
  actionSummary: "向张三转账 ¥100（模拟，不会真扣款）",
});

/** 停在这里等人输入；resume 的值会写进 userInput */
const waitConfirm = (state) => {
  // 这里进行中断
  const text = interrupt({
    hint: "终端里输入「确认」或备注后回车，图才会继续",
    actionSummary: state.actionSummary,
  });
  return { userInput: String(text) };
};

const graph = new StateGraph(StateAnnotation)
  .addNode("showTransfer", showTransfer)
  .addNode("waitConfirm", waitConfirm)
  .addEdge(START, "showTransfer")
  .addEdge("showTransfer", "waitConfirm")
  .addEdge("waitConfirm", END)
  // 为什么需要MemorySaver，是因为在interrupt之后，LangGraph会把当前状态保存到checkpointer里，等用户输入后再恢复执行。
  .compile({ checkpointer: new MemorySaver() });

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const config = { configurable: { thread_id: "interrupt-demo" } };

const paused = await graph.invoke({}, config);
console.log("\n待你确认：", paused.__interrupt__?.[0]?.value);

// createInterface() 用来创建一个命令行交互接口
// input  指定从哪里读取用户输入
// output 指定向哪里输出内容
// 创建一个连接终端键盘输入和终端输出的交互接口
const rl = createInterface({ input: process.stdin, output: process.stdout });
// $ rl.question 在終端提示文字，等待用戶輸入，用戶按下Enter后，返回輸入的内容
const line = (await rl.question("> ")).trim();
await rl.close();

if (!line) {
  console.error("未输入，退出。");
  process.exit(1);
}

// Command中断的恢复机制。向之前暂停的 Graph 发送恢复指令，并将用户输入作为恢复值传递进去
const done = await graph.invoke(new Command({ resume: line }), config);
console.log("结果：", done);
