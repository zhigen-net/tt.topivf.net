import 'dotenv/config'
import { Worker } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
}

// 统计数据采集队列（轻量级，不涉及浏览器）
// publish 队列由 NestJS api 服务中的 TasksProcessor (@nestjs/bullmq) 处理
const statsWorker = new Worker(
  'stats-collect',
  async (job) => {
    console.log(`[Worker] Collecting stats for accountId: ${job.data.accountId}`)
    // TODO: 从平台 API 拉取最新粉丝数写回 DB
  },
  { connection, concurrency: 10 },
)

statsWorker.on('failed', (job, err) => {
  console.error(`[Worker] Stats job ${job?.id} failed:`, err.message)
})

console.log('[SocialHub Worker] Started — listening for stats-collect queue')
