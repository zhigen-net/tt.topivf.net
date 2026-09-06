import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator'

/**
 * 按 UTF-8 字节数限长。
 *
 * bcrypt 只哈希前 72 字节，超出部分静默丢弃——前 72 字节相同的两个密码会被认成
 * 同一个。class-validator 的 MaxLength 数的是字符，一个汉字占 3 字节，
 * 所以 MaxLength(72) 放行 30 个汉字（90 字节），拦不住这种截断。
 */
export function MaxBytes(max: number, options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxBytes',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} 不能超过 ${max} 字节（一个汉字算 3 字节）`
        },
      },
    })
  }
}
