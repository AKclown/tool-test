import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import mysql from "mysql2/promise";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义单个好友信息的 zod schema，匹配 friends 表结构
const friendSchema = z.object({
  name: z.string().describe("姓名"),
  gender: z.string().describe("性别（男/女）"),
  birth_date: z
    .string()
    .describe("出生日期，格式：YYYY-MM-DD，如果无法确定具体日期，根据年龄估算"),
  company: z.string().nullable().describe("公司名称，如果没有则返回 null"),
  title: z.string().nullable().describe("职位/头衔，如果没有则返回 null"),
  phone: z.string().nullable().describe("手机号，如果没有则返回 null"),
  wechat: z.string().nullable().describe("微信号，如果没有则返回 null"),
});

// 定义批量好友信息的 schema（数组）
const friendsArraySchema = z.array(friendSchema).describe("好友信息数组");

// 结构化模型定义
const structuredModel = model.withStructuredOutput(friendsArraySchema);

const connectionConfig = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "AKclown",
  multipleStatements: true,
};

// 实现智能录入功能，将prompt通过大模型，输出符合要求的数据格式，然后在插入到mysql数据里去
async function extractAndInsert(text) {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.query("USE hello;");

    // 使用AI 提取结构化数据
    console.log("🤔 正在从文本中提取信息...\n");
    const prompt = `请从以下文本中提取所有好友信息，文本中可能包含一个或多个人的信息。请将每个人的信息分别提取出来，返回一个数组。
注意：
1. 返回内容必须是合法的 JSON 数组，不要返回 Markdown 代码块。
2. 每个人对应一个对象，字段必须符合指定的 Schema。
3. 如果字段无法确定，允许为 null（但姓名、性别、出生日期需要符合 Schema 类型要求）。
4. 出生日期格式为 YYYY-MM-DD；如果只有年龄，可以估算日期。


${text}
要求：
1. 如果文本中包含多个人，请为每个人创建一个对象
2. 每个对象包含以下字段：
   - 姓名：提取文本中的人名
   - 性别：提取性别信息（男/女）
   - 出生日期：如果能找到具体日期最好，否则根据年龄描述估算（格式：YYYY-MM-DD）
   - 公司：提取公司名称
   - 职位：提取职位/头衔信息
   - 手机号：提取手机号码
   - 微信号：提取微信号
3. 如果某个字段在文本中找不到，请返回 null
4. 返回格式必须是一个数组，即使只有一个人也要放在数组中
    `;

    const results = await structuredModel.invoke(prompt);

    console.log(`✅ 提取到 ${results.length} 条结构化信息:`);
    console.log(JSON.stringify(results, null, 2));
    console.log("");

    if (results.length === 0) {
      console.log("⚠️  没有提取到任何信息");
      return { count: 0, insertIds: [] };
    }

    // 批量插入数据库
    const insertSql = `
      INSERT INTO friends (
        name,
        gender,
        birth_date,
        company,
        title,
        phone,
        wechat
      ) VALUES ?;
    `;

    const values = results.map((result) => [
      result.name,
      result.gender,
      result.birth_date || null,
      result.company,
      result.title,
      result.phone,
      result.wechat,
    ]);

    const [insertResult] = await connection.query(insertSql, [values]);
    console.log(`✅ 成功批量插入 ${insertResult.affectedRows} 条数据`);
    console.log(
      `   插入的ID范围：${insertResult.insertId} - ${insertResult.insertId + insertResult.affectedRows - 1}`,
    );

    return {
      count: insertResult.affectedRows,
      insertIds: Array.from(
        { length: insertResult.affectedRows },
        (_, i) => insertResult.insertId + i,
      ),
    };
  } catch (err) {
    console.error("❌ 执行出错：", err);
    throw err;
  } finally {
    await connection.end();
  }
}

async function main() {
  // 示例文本（包含多个人的信息）
  const sampleText = `我最近认识了几个新朋友。第一个是张总，女的，看起来30出头，在腾讯做技术总监，手机13800138000，微信是zhangzong2024。第二个是李工，男，大概28岁，在阿里云做架构师，电话15900159000，微信号lee_arch。还有一个是陈经理，女，35岁左右，在美团做产品经理，手机号是18800188000，微信chenpm2024。`;

  console.log("📝 输入文本:");
  console.log(sampleText);
  console.log("");
  try {
    const result = await extractAndInsert(sampleText);

    console.log(`\n🎉 处理完成！成功插入 ${result.count} 条记录`);
    console.log(`   插入的ID：${result.insertIds.join(", ")}`);
  } catch (error) {
    console.error("❌ 处理失败：", error.message);
    process.exit(1);
  }
}

main();
