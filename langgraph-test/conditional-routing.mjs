// LangGraph 条件路由（Conditional Routing）工作流。
import "dotenv/config";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

// 定义共享数据 { query: "", route: "chat", answer: "" }，这个数据会在所有节点之间共享，节点可以读取和更新这个数据。
const StateAnnotation = Annotation.Root({
  query: Annotation({
    // reducer 定义更新规则
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  route: Annotation({
    reducer: (_prev, next) => next,
    default: () => "chat",
  }),
  answer: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

const router = (state) => {
  const isMath = /[+\-*/]/.test(state.query);
  return { route: isMath ? "math" : "chat" };
};

const mathNode = (state) => {
  try {
    return { answer: String(eval(state.query)) };
  } catch {
    return { answer: "表达式无法计算" };
  }
};

const chatNode = (state) => ({ answer: `你说的是：${state.query}` });

const graph = new StateGraph(StateAnnotation)
  .addNode("router", router)
  .addNode("math", mathNode)
  .addNode("chat", chatNode)
  .addEdge(START, "router")
  // 第一个参数 从那个节点开始判断，第二字段： 路由判断参数  第三个参数： 路由映射表
  .addConditionalEdges("router", (state) => state.route, {
    math: "math",
    chat: "chat",
  })
  .addEdge("math", END)
  .addEdge("chat", END)
  .compile();

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

console.log("result:", await graph.invoke({ query: "你好" }));

console.log("result:", await graph.invoke({ query: "10 * 8" }));
