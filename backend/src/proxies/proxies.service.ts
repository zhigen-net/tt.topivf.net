import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Proxy } from './proxy.entity'

@Injectable()
export class ProxiesService {
  constructor(@InjectRepository(Proxy) private repo: Repository<Proxy>) {}

  findAll() { return this.repo.find({ order: { createdAt: 'DESC' } }) }

  async findOne(id: string) {
    const proxy = await this.repo.findOneBy({ id })
    if (!proxy) throw new NotFoundException(`Proxy ${id} not found`)
    return proxy
  }

  create(dto: Partial<Proxy>) { return this.repo.save(this.repo.create(dto)) }

  async update(id: string, dto: Partial<Proxy>) {
    await this.findOne(id)
    await this.repo.update(id, dto)
    return this.findOne(id)
  }

  async remove(id: string) { await this.repo.delete(id) }
}
