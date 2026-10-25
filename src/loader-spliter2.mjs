import dotenv from "dotenv";

import "cheerio";

import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 嵌入模型，將用戶prompt转换为向量，然后在根据这个向量去向量数据库检索。然后讲检索到的内容与现有场景进行prompt进行组合在发给大模型
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const cheerioLoader = new CheerioWebBaseLoader(
  "https://juejin.cn/post/7632298339149971496",
  {
    selector: ".main-area p",
  },
);

const documents = await cheerioLoader.load();

console.assert(documents.length === 1);
console.log(`Total characters：${documents[0].pageContent.length}`);

const textSplitter = new RecursiveCharacterTextSplitter({
  // 每個分塊的字符數據
  chunkSize: 500,
  // 分塊之間的重叠字符數
  // 一般设置chunkSize的10%-20%之间
  chunkOverlap: 50,
  // 分隔符、優先使用段落分割
  separators: ["。", "！", "？"],
});

const splitDocuments = await textSplitter.splitDocuments(documents);

console.log(`文档完成分割，共${splitDocuments.length}个分块`);

console.log(`正在创建向量数据库`);
const vectorStore = await MemoryVectorStore.fromDocuments(
  splitDocuments,
  embeddings,
);

console.log(`创建向量数据库完成`);

const retriever = vectorStore.asRetriever({ k: 2 });

const questions = ["针对Agent中，实现远程文档加载以及分割整个流程是如何实现的"];

for (const question of questions) {
  console.log("=".repeat(80));
  console.log(`问题: ${question}`);
  console.log("=".repeat(80));

  // 使用retriever获取文档 （用retriever把文档向量化）
  const retrieverDocs = await retriever.invoke(question);

  // 使用similaritySearchWithScore获取相似度评分  (做相似度打分)
  const scoredResults = await vectorStore.similaritySearchWithScore(
    question,
    2,
  );

  console.log(`\n 检索到的文档及相似度评分`);
  retrieverDocs.forEach((doc, i) => {
    const scoreResult = scoredResults.find(
      ([scoreDoc]) => scoreDoc.pageContent === doc.pageContent,
    );

    const score = scoreResult ? scoreResult[1] : null;

    const similarity = score !== null ? (1 - score).toFixed(4) : "N/A";

    console.log(`\n[文档 ${i + 1}]相似度:${similarity}`);

    console.log(`内容:${doc.pageContent}`);

    console.log(
      `元数据: 章节=${doc.metadata.chapter}, 角色=${doc.metadata.character},类型=${doc.metadata},心情=${doc.metadata.mood}`,
    );
  });

  // 构建prompt
  // 用retriever把query传入，通过向量的余弦相似度，找到语义最相关的3个文档片段，传入prompt
  const context = retrieverDocs
    .map((doc, i) => `[片段${i + 1}]\n${doc.pageContent}`)
    .join("\n\n-------\n\n");

  const prompt = `你是一个文章辅助阅读助手，根据文章内容来解答:
  文章内容:${context}

问题:${question}

你的回答:
  `;

  console.log(`\n [AI回答]`);

  const response = await model.invoke(prompt);
  console.log(response.content);
}

