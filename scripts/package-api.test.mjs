import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { assertPortableLink } from './package-api.mjs'

/**
 * 产物可移植性：符号链接目标必须是相对路径。
 *
 * 背景：Windows 上 `pnpm deploy` 生成的是 junction（目标 `\\?\C:\...`）。它指向的
 * 路径确实在产物内部，所以原有的 `contains(artifactRoot, realpathSync(link))` 检查
 * 能通过 —— 产物在本机一切正常，拷到服务器就是一堆死链，表现为部署后才炸的
 * `Cannot find module 'dotenv/config'`。
 *
 * junction 不支持相对目标，所以没有事后修正的余地，只能在打包时拒绝。
 *
 * 这里直接断言目标字符串的形态，而不是去真的建链接：链接能不能建成、建成什么样，
 * 都取决于运行平台，那样测出来的是平台行为，不是我们的规则。
 */

describe('package-api 链接可移植性', () => {
  it('相对链接通过', () => {
    assert.equal(assertPortableLink('../.pnpm/fastify@5.6.2/node_modules/fastify', 'node_modules/fastify'), undefined)
  })

  it('POSIX 绝对链接被拒绝', () => {
    assert.throws(() => assertPortableLink('/opt/yishan/releases/x/node_modules/fastify', 'node_modules/fastify'), /not portable/)
  })

  it('Windows 盘符链接被拒绝', () => {
    assert.throws(() => assertPortableLink('C:\\Users\\dev\\out\\node_modules\\dotenv', 'node_modules/dotenv'), /not portable/)
  })

  it('Windows junction 前缀被拒绝', () => {
    assert.throws(() => assertPortableLink('\\\\?\\C:\\Users\\dev\\out\\dotenv', 'node_modules/dotenv'), /not portable/)
  })

  it('错误信息给出可执行的修复路径', () => {
    // 光说「不合法」没用，必须说清在哪台机器上打包、逃生舱是什么。
    assert.throws(() => assertPortableLink('/abs/target', 'x'), /Build on Linux/)
    assert.throws(() => assertPortableLink('/abs/target', 'x'), /--allow-nonportable-links/)
  })

  it('allowNonPortableLinks 时放行', () => {
    assert.equal(assertPortableLink('C:\\abs', 'x', true), undefined)
  })
})
