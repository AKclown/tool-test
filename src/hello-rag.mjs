import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

import dotenv from "dotenv";

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

// 当我直接问大模型`东东和光光是怎么成为朋友的`,大模型肯定是不知道的。知识库里存在一些文档
const documents = [
  new Document({
    pageContent: `光光是一个活泼开朗的小男孩，他有一双明亮的大眼睛，总是带着灿烂的笑容。光光最喜欢的就是和朋友们一起玩耍，他特别擅长踢足球，每次在球场上奔跑时，就像一道阳光一样充满活力`,
    metadata: {
      chapter: 1,
      character: "光光",
      type: "角色介绍",
      mood: "活泼",
    },
  }),
  new Document({
    pageContent: `东东是光光最好的朋友，他是一个安静而聪明的男孩。东东喜欢读书和画画，他的画总是充满虽然性格不同，但东东和光光从幼儿园就认识了，他们一起度过了无数个快乐的时光。`,
    metadata: {
      chapter: 2,
      character: "东东",
      type: "角色介绍",
      mood: "温馨",
    },
  }),
  new Document({
    pageContent: `有一天，学校要举办一场足球比赛，光光非常兴奋，他邀请东东一起参加。但是东东从来没有踢过足球，他担心自己会拖累光光。光光看出了东东的担忧，他拍着东东的肩膀说:"没关系，我们一起练习，我相信你一;起练习，我相信你一定能行的!`,
    metadata: {
      chapter: 3,
      character: "光光和东东",
      type: "友情情节",
      mood: "鼓励",
    },
  }),
  new Document({
    pageContent: `接下来的日子里，光光每天放学后都会教东东踢足球。光光耐心地教东东如何控球、传球和射门，而而东东虽然一开始总是踢不好，但他从不放弃。东东也用自己的方式回报光光，他画了一幅画送给光光，画上是两个小男孩`,
    metadata: {
      chapter: 4,
      character: "光光和东东",
      type: "友情情节",
      mood: "互助",
    },
  }),
  new Document({
    pageContent: `比赛那天终于到了，光光和东东一起站在球场上。虽然东东的技术还不够熟练，但他非常努力，而且而且他用自己的观察力帮助光光找到了对手的弱点。在关键时刻，东东传出了一个漂亮的球，光光接球后射门得分!他们赢得更重要的是，他们的友谊变得更加深厚了。`,
    metadata: {
      chapter: 5,
      character: "光光和东东",
      type: "高潮转折",
      mood: "激动",
    },
  }),
  new Document({
    pageContent: `从那以后，光光和东东成为了学校里最好的朋友。光光教东东运动，东东教光光画画，他们互相学习，共同成长。每当有人问起他们的友谊，他们总是笑着说:“真正的朋友就是互相帮助，一起变得更好的人!`,
    metadata: {
      chapter: 6,
      character: "光光和东东",
      type: "结局",
      mood: "欢乐",
    },
  }),
  new Document({
    pageContent: `多年后，光光成为了一名职业足球运动员，而东东成为了一名优秀的插画师。虽然他们走上了不同的道路，但他们的友谊从未改变。东东为光光设计了球衣上的图案，光光在每场比赛后都会给东东打电话分享喜悦。他们证明了，真正的友情可以`,
    metadata: {
      chapter: 6,
      character: "光光和东东",
      type: "尾声",
      mood: "温馨",
    },
  }),
];

// 将这些文档数据加入到知识库里，加入一些元数据
const vectorStore = await MemoryVectorStore.fromDocuments(
  documents,
  embeddings,
);
// 采用嵌入模型 将这些文档向量化之后存入到向量数据库。k是3就返回余弦相似度最大的3个document
const retriever = vectorStore.asRetriever({ k: 3 });

const questions = ["东东和光光是怎么成为朋友的"];

for (const question of questions) {
  console.log("=".repeat(80));
  console.log(`问题: ${question}`);
  console.log("=".repeat(80));

  // 使用retriever获取文档 （用retriever把文档向量化）
  const retrieverDocs = await retriever.invoke(question);

  // 使用similaritySearchWithScore获取相似度评分  (做相似度打分)
  const scoredResults = await vectorStore.similaritySearchWithScore(
    question,
    3,
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

  const prompt = `你是一个讲友情故事的老师。基于以下故事片段回答问题，用温暖生动的语言。如果故事中没有提到，就说"这个故事里还没有提到这个细节
  故事片段:${context}

问题:${question}

老师的回答:
  `;

  console.log(`\n [AI回答]`);

  const response = await model.invoke(prompt);
  console.log(response.content);
}

// const response = await model.invoke("介绍一下自己");
// console.log("response: ", response);
