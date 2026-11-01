import "dotenv/config";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

// LangGraph 中的 State 可以理解为：
// 所有节点共享的一份工作流上下文数据。

// $ 理解Annotation就知道如何管理多个Node之间共享的数据，以及节点返回的数据是如何更新到state中的
// $ Annotation 用于定义 LangGraph 的 State（状态），包括 State 有哪些字段、字段的默认值，以及字段更新时采用什么规则。
// 主要是定义共享数据，{text: ""}，这个数据会在所有节点之间共享，节点可以读取和更新这个数据。
// Annotation.Root定义整个State，内部的{text:..} 这个是State字段
const StateAnnotation = Annotation.Root({
  // 表示state schema其中包含一个text字段
  text: Annotation({
    // 他是一个状态更新机制，_prev代表已有的，next代表新的，reducer的作用是将已有的和新的进行合并，返回一个新的值。
    reducer: (_prev, next) => `${_prev} => ${next}`,
    // 默认值为空字符串
    default: () => "",
  }),
});

// 创建两个步骤
const step1 = (state) => ({ text: `step1` });
const step2 = (state) => ({ text: `step2` });

// 添加两个节点，step1和 step2，并定义它们之间的边.
/**
    START：工作流开始。
    step1：执行第一个节点。
    step2：执行第二个节点。
    END：工作流结束。
 */
const graph = new StateGraph(StateAnnotation)
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", END)
  .compile();

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const result = await graph.invoke({ text: "hello" });

// result: { text: 'hello -> step1 -> step2' }
console.log("result:", result);
