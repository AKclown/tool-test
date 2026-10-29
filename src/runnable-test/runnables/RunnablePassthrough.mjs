// $ RunnablePassthrough 数据经过它时，原样传递、不做任何修改
import {
  RunnablePassthrough,
  RunnableLambda,
  RunnableSequence,
  RunnableMap,
} from "@langchain/core/runnables";

// const chain = RunnableSequence.from([
//   RunnableLambda.from((input) => ({ concept: input })),
//   RunnableMap.from({
//     origin: new RunnablePassthrough(),
//     processed: RunnableLambda.from((obj) => ({
//       concept: input,
//       upper: obj.concept.toUpperCase(),
//       length: obj.concept.length,
//     })),
//   }),
// ]);

const chain = RunnableSequence.from([
  RunnableLambda.from((input) => ({ concept: input })),
  // $ 保留原始输入，同时新增数据
  RunnablePassthrough.assign({
    original: new RunnablePassthrough(),
    processed: (obj) => ({
      concept: input,
      upper: obj.concept.toUpperCase(),
      length: obj.concept.length,
    }),
  }),
]);

const input = "神说要有光";
const result = await chain.invoke(input);
console.log(result);
