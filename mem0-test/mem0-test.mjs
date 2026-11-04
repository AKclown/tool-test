import "dotenv/config";
import { MemoryClient } from "mem0ai";

const USER_ID = "demo-user";

function log(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

async function main() {
  const client = new MemoryClient({
    apiKey: process.env.MEM0_API_KEY,
  });

  const conversation = [
    { role: "user", content: "我是素食主义者，而且对坚果过敏。" },
    { role: "assistant", content: "好的，我会记住你的饮食偏好。" },
    { role: "user", content: "我住在北京，平时喜欢跑步。" },
    { role: "assistant", content: "已记录：北京、爱好跑步。" },
  ];

//   const result = await client.updateProject({
//     multilingual: true,
//     customInstructions: `
//       你是一个中文长期记忆提取助手。

//       必须遵守以下规则：
//       1. 所有提取出的 memory 必须使用简体中文。
//       2. 不允许将中文用户信息翻译成英文。
//       3. 保留用户的偏好、习惯、事实和约束。
//       4. 每条记忆使用简洁、独立的中文陈述句。
//       5. 不要遗漏用户明确表达的重要信息。
//     `,
//   });

//   console.log("项目配置更新结果：", result);
  // $ 长期记忆通常按照用户隔离的，不同用户不能混用彼此的记忆
  // $ Mem0 不只是简单地把这四条消息保存下来，而是会尝试从对话中提取有价值的长期信息
//   const added = await client.add(conversation, {
//     userId: USER_ID,
//   });
//   log("添加记忆", added);

  // mem0有一个很重要的功能就是  语义检索
  const searchResult = await client.search("用户的饮食限制是什么？中文回答", {
    filters: { user_id: USER_ID },
    topK: 5,
  });
  log("搜索记忆", searchResult);

//   const allMemories = await client.getAll({
//     filters: { user_id: USER_ID },
//     pageSize: 10,
//   });
//   log("列出全部记忆", allMemories);

//   const firstMemory = allMemories.results?.[0] ?? searchResult.results?.[0];
//   if (firstMemory?.id) {
//     const memory = await client.get(firstMemory.id);
//     log("获取单条记忆", memory);

//     const updated = await client.update(firstMemory.id, {
//       text: `${memory.memory ?? firstMemory.memory}（已通过示例脚本更新）`,
//     });
//     log("更新记忆", updated);

//     // 查看某条数据的变更历史
//     const history = await client.history(firstMemory.id);
//     log("记忆变更历史", history);
//   }

//   if (process.argv.includes("--cleanup")) {
//     // 删除全部记忆
//     const deleted = await client.deleteAll({ userId: USER_ID });
//     log("清理测试数据", deleted);
//   } else {
//     console.log(
//       "\n提示: 运行 `node src/mem0-test.mjs --cleanup` 可删除本次测试用户的全部记忆",
//     );
//   }
}

main().catch((error) => {
  console.error("\n执行失败:", error.message ?? error);
  if (error.suggestion) {
    console.error("建议:", error.suggestion);
  }
  process.exit(1);
});
