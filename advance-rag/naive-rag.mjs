import "dotenv/config";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { Document } from "@langchain/core/documents";

const COLLECTION_NAME = "ebook_collection";
const TOP_K = 5;

const MILVUS_CONFIG = {
  collectionName: COLLECTION_NAME,
  url: "localhost:19530",
  textField: "content",
  primaryField: "id",
  vectorField: "vector",
  indexCreateOptions: {
    metric_type: "COSINE",
    index_type: "HNSW",
    params: { M: 16, efConstruction: 200 },
    search_params: { ef: 64 },
  },
};

// LangGraph State
const GraphState = Annotation.Root({
  question: Annotation,
  k: Annotation,
  documents: Annotation,
  generation: Annotation,
});

// 模型
const model = new ChatOpenAI({
  temperature: 0,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  apiKey: process.env.OPENAI_API_KEY,
});

// Embedding
const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  dimensions: 1024,
});

let vectorStore;

/**
 * 初始化知识库数据
 * 实际项目中可以替换成从数据库、TXT、PDF 中读取的数据
 */
function getInitialDocuments() {
  return [
    new Document({
      pageContent:
        "阿朱是金庸武侠小说《天龙八部》中的重要人物，她是慕容复的婢女，聪明伶俐，擅长易容术。她与乔峰相识后逐渐产生感情。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 24,
        index: 0,
      },
    }),

    new Document({
      pageContent:
        "阿朱的真实身份是段正淳与阮星竹的女儿。她与阿紫是亲姐妹。阿朱从小流落在外，后来成为慕容家的婢女。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 24,
        index: 1,
      },
    }),

    new Document({
      pageContent:
        "乔峰与阿朱在相处过程中逐渐相爱。阿朱理解乔峰的处境，并始终相信乔峰的人品，两人的感情十分深厚。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 25,
        index: 2,
      },
    }),

    new Document({
      pageContent:
        "阿朱为了保护乔峰，易容成段正淳的模样，代替段正淳前往小镜湖赴约。乔峰误以为眼前的人就是段正淳，最终出手误伤了阿朱。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 26,
        index: 3,
      },
    }),

    new Document({
      pageContent:
        "阿朱在小镜湖事件中身受重伤，临终前请求乔峰照顾自己的妹妹阿紫。乔峰得知真相后悲痛万分，阿朱最终死在乔峰怀中。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 26,
        index: 4,
      },
    }),

    new Document({
      pageContent:
        "阿朱死后，乔峰十分悲痛。他始终无法忘记阿朱，并将阿朱的遗愿放在心上，承担起照顾阿紫的责任。",
      metadata: {
        book_id: "天龙八部",
        chapter_num: 27,
        index: 5,
      },
    }),
  ];
}

/**
 * 初始化 Milvus 向量数据库
 */
async function initializeVectorStore() {
  console.log("连接到 Milvus...");

  // 先创建一个 Milvus 实例，用于检查集合是否存在
  const instance = new Milvus(embeddings, MILVUS_CONFIG);

  const hasCollection = await instance.client.hasCollection({
    collection_name: COLLECTION_NAME,
  });

  if (hasCollection.value === false) {
    console.log("集合不存在，开始创建并插入初始化数据...");

    // fromDocuments 会自动创建集合、生成向量并插入数据
    vectorStore = await Milvus.fromDocuments(
      getInitialDocuments(),
      embeddings,
      MILVUS_CONFIG,
    );

    console.log("✓ 集合创建成功，初始化数据插入完成");
  } else {
    console.log("✓ 集合已存在");

    // 连接已有集合
    vectorStore = await Milvus.fromExistingCollection(
      embeddings,
      MILVUS_CONFIG,
    );

    // 查询一条记录，判断集合是否为空
    const queryResult = await vectorStore.client.query({
      collection_name: COLLECTION_NAME,
      expr: 'id != ""',
      output_fields: ["id"],
      limit: 1,
    });

    if (!queryResult.data || queryResult.data.length === 0) {
      console.log("集合中没有数据，开始插入初始化数据...");

      await vectorStore.addDocuments(getInitialDocuments());

      console.log("✓ 初始化数据插入完成");
    } else {
      console.log("✓ 集合已有数据，跳过初始化插入");
    }
  }

  // 配置向量搜索参数
  vectorStore.indexSearchParams = {
    metric_type: "COSINE",
    params: JSON.stringify({ ef: 64 }),
  };

  // 加载集合
  try {
    await vectorStore.client.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    console.log(`✓ 集合 ${COLLECTION_NAME} 已加载`);
  } catch (error) {
    if (!error.message?.includes("already loaded")) {
      throw error;
    }

    console.log(`✓ 集合 ${COLLECTION_NAME} 已处于加载状态`);
  }
}

/**
 * 检索知识库
 */
async function retrieveRelevantContent(question, k = TOP_K) {
  try {
    const docsWithScores = await vectorStore.similaritySearchWithScore(
      question,
      k,
    );

    return docsWithScores.map(([doc, score]) => ({
      score,
      content: doc.pageContent,
      id: doc.metadata?.id ?? "unknown",
      book_id: doc.metadata?.book_id ?? "未知",
      chapter_num: doc.metadata?.chapter_num ?? "未知",
      index: doc.metadata?.index ?? "未知",
    }));
  } catch (error) {
    console.error("检索内容时出错:", error.message);
    return [];
  }
}

/**
 * LangGraph 检索节点
 */
const retrieveNode = async (state) => {
  const documents = await retrieveRelevantContent(state.question, state.k);

  return {
    question: state.question,
    k: state.k,
    documents,
  };
};

/**
 * LangGraph 生成节点
 */
const generateNode = async (state) => {
  const context = state.documents
    .map(
      (item, i) =>
        `[片段 ${i + 1}]
章节: 第 ${item.chapter_num} 章
内容: ${item.content}`,
    )
    .join("\n\n━━━━━\n\n");

  const prompt = `你是一个专业的《天龙八部》小说助手。
请根据以下小说片段回答问题：

${context}

用户问题: ${state.question}

回答要求：
1. 结合检索到的小说内容回答
2. 可以综合多个片段
3. 如果没有相关信息，请如实告知
4. 回答准确，符合小说情节

AI 助手的回答:`;

  process.stdout.write("\n【AI 回答（流式）】\n");

  let generation = "";
  const stream = await model.stream(prompt);

  for await (const chunk of stream) {
    const text = typeof chunk.content === "string" ? chunk.content : "";

    if (!text) continue;

    generation += text;
    process.stdout.write(text);
  }

  process.stdout.write("\n");

  return {
    question: state.question,
    k: state.k,
    documents: state.documents,
    generation,
  };
};

/**
 * 构建 LangGraph
 */
const graph = new StateGraph(GraphState)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();

/**
 * 主程序
 */
async function main() {
  // 1. 初始化向量数据库
  await initializeVectorStore();

  // 2. 准备问题
  const question = "阿朱的结局是什么？";
  const k = 5;

  // 3. 输出流程图
  const drawable = await graph.getGraphAsync();
  console.log(drawable.drawMermaid({ withStyles: true }));

  console.log("\n" + "=".repeat(80));
  console.log(`问题: ${question}`);
  console.log("=".repeat(80));

  // 4. 执行 LangGraph
  const result = await graph.invoke({
    question,
    k,
    documents: [],
    generation: "",
  });

  // 5. 输出检索结果
  console.log("\n【检索相关内容】");

  if (result.documents.length === 0) {
    console.log("未找到相关内容");
    return;
  }

  result.documents.forEach((item, i) => {
    console.log(`\n[片段 ${i + 1}] 相似度: ${item.score.toFixed(4)}`);
    console.log(`书籍: ${item.book_id}`);
    console.log(`章节: 第 ${item.chapter_num} 章`);
    console.log(`片段索引: ${item.index}`);
    console.log(`内容: ${item.content}`);
  });

  if (!result.generation) {
    console.log("\n模型未返回内容。");
  }

  console.log("[AI回答]: ", result.generation);
}

main().catch((error) => {
  console.error("程序执行失败:", error);
  process.exitCode = 1;
});
