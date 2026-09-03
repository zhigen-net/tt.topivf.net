import { fetchRemoteFile, isBlockedAddress } from './remote-fetch'

describe('isBlockedAddress', () => {
  it.each([
    ['127.0.0.1', '回环'],
    ['0.0.0.0', '未指定'],
    ['10.1.2.3', '私有 A'],
    ['172.16.0.1', '私有 B 下界'],
    ['172.31.255.254', '私有 B 上界'],
    ['192.168.1.1', '私有 C'],
    ['169.254.169.254', '云元数据'],
    ['100.64.0.1', 'CGNAT'],
    ['198.18.0.1', 'benchmark'],
    ['224.0.0.1', '组播'],
    ['255.255.255.255', '广播'],
    ['::1', 'v6 回环'],
    ['::', 'v6 未指定'],
    ['fc00::1', 'v6 唯一本地'],
    ['fe80::1', 'v6 链路本地'],
    ['ff02::1', 'v6 组播'],
    ['::ffff:127.0.0.1', 'v4 映射回环'],
    ['::ffff:10.0.0.1', 'v4 映射私有'],
    ['::ffff:7f00:1', 'v4 映射回环的十六进制写法'],
    ['::ffff:a9fe:a9fe', 'v4 映射云元数据'],
    ['::7f00:1', 'v4 兼容回环'],
    ['64:ff9b::7f00:1', 'NAT64 回环'],
    ['不是地址', '非法输入'],
  ])('拦掉 %s（%s）', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each([
    ['1.1.1.1'],
    ['8.8.8.8'],
    ['93.184.216.34'],
    ['172.32.0.1'], // 私有 B 段的上界外
    ['192.167.1.1'],
    ['2606:4700:4700::1111'],
  ])('放行公网地址 %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })
})

describe('fetchRemoteFile', () => {
  it('拒绝非 http/https 协议', async () => {
    await expect(fetchRemoteFile('file:///etc/passwd', 1024)).rejects.toThrow(/只支持 http/)
    await expect(fetchRemoteFile('gopher://example.com/', 1024)).rejects.toThrow(/只支持 http/)
  })

  it('拒绝乱写的地址', async () => {
    await expect(fetchRemoteFile('这不是一个地址', 1024)).rejects.toThrow(/合法的 URL/)
  })

  // 直接写 IP 时 net.connect 会跳过 DNS，这几条走的是字面量那道闸
  it.each(['127.0.0.1', '10.0.0.1', '172.16.5.5', '192.168.1.1', '169.254.169.254', '[::1]', '[::ffff:127.0.0.1]'])(
    '拦掉 IP 字面量 %s',
    async (host) => {
      await expect(fetchRemoteFile(`http://${host}/a.png`, 1024)).rejects.toThrow(/内网地址/)
    },
  )

  // 这条走的是 dns lookup 钩子：域名本身合法，但解析结果落在内网
  it('拦掉解析到回环的域名', async () => {
    await expect(fetchRemoteFile('http://localhost/a.png', 1024)).rejects.toThrow(/内网地址/)
  })
})
