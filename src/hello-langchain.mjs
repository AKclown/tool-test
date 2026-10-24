import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  modelName: "qwen-coder-trubo",
  apiKey:
    "sk-ws-H.YMXIELL.Yhid.MEUCIDOn99ilrjqG2lP7LVztMupx9JP76MrvhsUMfte7W_5iAiEAwxZEdpbxdIK0FFEWJKU-DCmqSIRMNgYWqB1E31b-yoA",
  configuration: {
    baseURL: "https://ws-cxagqzc6qn684qi9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  }
});

const response = await model.invoke('介绍一下自己');
console.log('response: ', response);