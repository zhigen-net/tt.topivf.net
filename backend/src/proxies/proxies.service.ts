import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Proxy } from './proxy.entity'
import { CreateProxyDto, UpdateProxyDto } from './dto/proxy.dto'

@Injectable()
export class ProxiesService {
  constructor(@InjectRepository(Proxy) private repo: Repository<Proxy>) {}

  findAll(workspaceId: string) {
    return this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } })
  }

  async findOne(id: string, workspaceId: string) {
    const proxy = await this.repo.findOneBy({ id, workspaceId })
    if (!proxy) throw new NotFoundException(`Proxy ${id} not found`)
    return proxy
  }

  create(dto: CreateProxyDto, workspaceId: string) {
    return this.repo.save(this.repo.create({ ...dto, workspaceId }))
  }

  async update(id: string, dto: UpdateProxyDto, workspaceId: string) {
    await this.findOne(id, workspaceId)
    await this.repo.update(id, dto)
    return this.findOne(id, workspaceId)
  }

  async remove(id: string, workspaceId: string) {
    const proxy = await this.findOne(id, workspaceId)
    await this.repo.delete(proxy.id)
  }
}
