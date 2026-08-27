import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, FindOptionsWhere, ILike } from 'typeorm'
import { Account, Platform, AccountStatus } from './account.entity'
import { CreateAccountDto } from './dto/create-account.dto'

@Injectable()
export class AccountsService {
  constructor(@InjectRepository(Account) private repo: Repository<Account>) {}

  async findAll(opts: { platform?: Platform; status?: AccountStatus; search?: string; page?: number; limit?: number }) {
    const { platform, status, search, page = 1, limit = 20 } = opts
    const where: FindOptionsWhere<Account> = {}
    if (platform) where.platform = platform
    if (status) where.status = status
    if (search) where.username = ILike(`%${search}%`)

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: { proxy: true },
    })

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const account = await this.repo.findOne({ where: { id }, relations: { proxy: true } })
    if (!account) throw new NotFoundException(`Account ${id} not found`)
    return account
  }

  async create(dto: CreateAccountDto) {
    const account = this.repo.create(dto)
    return this.repo.save(account)
  }

  async update(id: string, dto: Partial<CreateAccountDto>) {
    await this.findOne(id)
    await this.repo.update(id, dto as any)
    return this.findOne(id)
  }

  async remove(id: string) {
    const account = await this.findOne(id)
    await this.repo.remove(account)
  }

  async updateStatus(id: string, status: AccountStatus) {
    await this.repo.update(id, { status })
    return this.findOne(id)
  }

  async updateStats(id: string, stats: Partial<Pick<Account, 'followers' | 'following' | 'postsCount'>>) {
    await this.repo.update(id, { ...stats, lastActiveAt: new Date() })
  }
}
