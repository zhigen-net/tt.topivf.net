import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get('stats')
  async getStats() {
    const [accounts, contents, tasks, followers] = await Promise.all([
      this.ds.query<[{ total: string }]>('SELECT COUNT(*) as total FROM accounts'),
      this.ds.query<[{ total: string }]>('SELECT COUNT(*) as total FROM contents'),
      this.ds.query<[{ pending: string; running: string }]>(
        `SELECT
          SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running
        FROM publish_tasks`,
      ),
      this.ds.query<[{ total: string }]>('SELECT COALESCE(SUM(followers), 0) as total FROM accounts'),
    ])

    return {
      accounts: parseInt(accounts[0]?.total ?? '0'),
      contents: parseInt(contents[0]?.total ?? '0'),
      pendingTasks: parseInt(tasks[0]?.pending ?? '0'),
      runningTasks: parseInt(tasks[0]?.running ?? '0'),
      totalFollowers: parseInt(followers[0]?.total ?? '0'),
    }
  }
}
