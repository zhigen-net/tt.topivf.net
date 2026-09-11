import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SystemSetting } from './system-setting.entity'
import { UpdateSettingsDto } from './dto/settings.dto'

const SINGLETON_ID = 1
export const DEFAULT_SITE_NAME = 'SocialHub'

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(SystemSetting) private repo: Repository<SystemSetting>) {}

  /** 没改过就没有这一行，返回一个没落库的默认值，读接口不该产生写 */
  async get() {
    const row = await this.repo.findOneBy({ id: SINGLETON_ID })
    return row ?? this.repo.create({ id: SINGLETON_ID, siteName: DEFAULT_SITE_NAME })
  }

  async update(dto: UpdateSettingsDto) {
    const row = await this.get()
    row.siteName = dto.siteName.trim()
    return this.repo.save(row)
  }
}
