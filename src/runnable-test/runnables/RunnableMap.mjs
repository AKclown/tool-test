// RunnableMap必行执行多个runnable
import "dotenv/config";
import { RunnableMap, RunnableLambda } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";

const addOne = RunnableLambda.from((input) => input.num + 1);
const multiplyTwo = RunnableLambda.from((input) => input.num * 2);
const square = RunnableLambda.from((input) => input.num * input.num);

const greetTemplate = PromptTemplate.fromTemplate("你好，{name}！");
const weatherTemplate = PromptTemplate.fromTemplate("今天天气{weather}。");

// 创建RunnableMap，并行执行多个Runnable

const runnable = RunnableMap.from({
  // 数学运算
  add: addOne,
  multiply: multiplyTwo,
  square: square,

  // prompt 格式化
  greeting: greetTemplate,
  weather: weatherTemplate,
});

const input = {
  name: "神光",
  weather: "多云",
  num: 5,
};


const result =await runnable.invoke(input)
console.log('result: ', result);
