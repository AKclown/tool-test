import { connect } from '../config.mjs';

const EXCHANGE = 'doc.task.direct';

/**
 * ========== direct 交换机 ==========
 *
 * 行为：消息的 routing key 必须与队列绑定时的 binding key「完全相等」才会投递。
 *       一对多也可以：多个队列绑同一个 key，会同时收到（类似按 key 分组的广播）。
 *
 * 对比 fanout：
 *   - fanout：所有绑定队列都收，不看 key
 *   - direct：只有 key 对得上的队列才收
 *
 * 本示例：用 info / warning / error 三条路由，模拟不同级别的文档任务通知。
 */
async function main() {
  const { connection, channel } = await connect();

  // durable 持久化交换机  表示交换机定义会持久化到磁盘。=> 即使 RabbitMQ 服务重启，交换机定义仍然存在 => 交换机持久化不等于消息持久化。
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });

  const tasks = [
    { routingKey: 'info', body: { level: 'info', text: '文档解析完成' } },
    { routingKey: 'warning', body: { level: 'warning', text: '文档页数过多，耗时较长' } },
    { routingKey: 'error', body: { level: 'error', text: 'OCR 识别失败' } },
  ];

  for (const task of tasks) {
    /**
     * 第二个参数就是 routing key。
     * Exchange 会拿它去和各队列的 binding key 做精确匹配，决定投递到哪些 Queue。
     */
    channel.publish(
      EXCHANGE,
      task.routingKey,
      Buffer.from(JSON.stringify(task.body)),
      { persistent: true, contentType: 'application/json' },
    );
    console.log(`[direct producer] 发送 routingKey=${task.routingKey}:`, task.body);
  }

  setTimeout(async () => {
    await channel.close();
    await connection.close();
  }, 500);
}

main().catch(console.error);
