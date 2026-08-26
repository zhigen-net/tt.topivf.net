import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Content } from './content.entity'

@Injectable()
export class ContentsService {
  constructor(@InjectRepository(Content) private repo: Repository<Content>) {}

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit })
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException(`Content ${id} not found`)
    return item
  }

  async create(dto: Partial<Content>) { return this.repo.save(this.repo.create(dto)) }

  async update(id: string, dto: Partial<Content>) {
    await this.findOne(id)
    await this.repo.update(id, dto)
    return this.findOne(id)
  }

  async remove(id: string) { await this.repo.delete(id) }
}
