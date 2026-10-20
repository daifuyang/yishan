#!/usr/bin/env node
// 七牛云 Kodo 产物中转：CD 流水线用它把部署包交给目标机。
//
// 为什么需要它：CD 的 runner 在 GitHub（境外），目标机在腾讯云，跨境单条 SSH
// 长连接实测只有约 16 KB/s，28MB 的包要传 30 分钟。把产物先放进七牛（境内
// 对象存储 + CDN），目标机再从境内拉，实测约 2 MB/s，半分钟就够。
//
// 凭据来自环境变量（CI 里是 GitHub secrets），**不进仓库、不进日志**：
//   QINIU_ACCESS_KEY  QINIU_SECRET_KEY  QINIU_BUCKET  QINIU_DOMAIN
//
// 用法：
//   node scripts/qiniu-artifact.mjs upload <本地文件> <对象 key>
//   node scripts/qiniu-artifact.mjs private-url <对象 key> [有效期秒]
//   node scripts/qiniu-artifact.mjs delete <对象 key>
//
// 无第三方依赖：七牛的上传凭证、下载签名、管理接口鉴权都能用 node 内置的
// crypto + fetch 实现。

import crypto from 'node:crypto'
import fs from 'node:fs'

const REQUIRED = ['QINIU_ACCESS_KEY', 'QINIU_SECRET_KEY', 'QINIU_BUCKET', 'QINIU_DOMAIN']

function config() {
  const missing = REQUIRED.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`missing environment variables: ${missing.join(', ')}`)
  }
  return {
    accessKey: process.env.QINIU_ACCESS_KEY,
    secretKey: process.env.QINIU_SECRET_KEY,
    bucket: process.env.QINIU_BUCKET,
    domain: process.env.QINIU_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    region: process.env.QINIU_REGION || 'z0',
  }
}

// 七牛的 urlsafe base64 只替换 + 和 /，保留 = 填充。
// 注意：这里处理的是**已经编好 base64 的字符串**（HMAC 的 digest 就是），
// 不能再走一次 Buffer→base64，否则等于把 base64 又编一遍，签名必然对不上。
const urlSafe = base64 => base64.replace(/\+/g, '-').replace(/\//g, '_')

const urlSafeEncode = text => urlSafe(Buffer.from(text, 'utf8').toString('base64'))

function hmacSha1Base64(secretKey, text) {
  return urlSafe(crypto.createHmac('sha1', secretKey).update(text).digest('base64'))
}

// 上传凭证（uptoken）：scope 绑到 bucket，具体对象 key 走表单的 key 字段。
// 这里刻意用 bucket 级 scope + 表单 key，而不是 scope: "bucket:key" ——
// 后者会被七牛判成 "key doesn't match with scope"。
function uploadToken({ accessKey, secretKey, bucket }, deadline) {
  const policy = { scope: bucket, deadline, insertOnly: 1 }
  const encodedPolicy = urlSafeEncode(JSON.stringify(policy))
  const sign = hmacSha1Base64(secretKey, encodedPolicy)
  return `${accessKey}:${sign}:${encodedPolicy}`
}

const UPLOAD_HOSTS = { z0: 'upload.qiniup.com', z1: 'upload-z1.qiniup.com', z2: 'upload-z2.qiniup.com' }

async function upload(file, key) {
  const cfg = config()
  const token = uploadToken(cfg, Math.floor(Date.now() / 1000) + 3600)
  const form = new FormData()
  form.append('token', token)
  form.append('key', key)
  form.append('file', new Blob([fs.readFileSync(file)]), key.split('/').pop())

  const host = UPLOAD_HOSTS[cfg.region] || UPLOAD_HOSTS.z0
  const started = Date.now()
  const response = await fetch(`https://${host}/${cfg.bucket}/uptoken`, { method: 'POST', body: form })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`qiniu upload failed (${response.status}): ${body}`)
  }
  const result = JSON.parse(body)
  const bytes = fs.statSync(file).size
  const seconds = (Date.now() - started) / 1000
  console.log(`uploaded ${key} (${bytes} bytes in ${seconds.toFixed(1)}s, ${Math.round(bytes / seconds)} B/s)`)
  return result.key
}

// 私有下载链接：签名串是**完整的 base URL**（域名 + 路径 + ?e=过期时间），
// token 是 "ak:sign" 明文拼接，**不要再 base64 一遍**。
// 这一点来自七牛 SDK 的 BucketManager.privateDownloadUrl：把 ak:sign 再编一次
// base64 会得到 "bad token"。
function privateUrl(key, ttlSeconds) {
  const cfg = config()
  // 签名串必须和服务器看到的请求路径逐字节一致，所以这里**不做 URL 编码**，
  // 而是把 key 限制在无需编码的字符集内。碰到别的字符就直接报错，
  // 好过编出一个签名对不上的链接。
  if (!/^[A-Za-z0-9._/-]+$/.test(key)) {
    throw new Error(`object key must only contain [A-Za-z0-9._/-]: ${key}`)
  }
  const deadline = Math.floor(Date.now() / 1000) + ttlSeconds
  const base = `https://${cfg.domain}/${key}?e=${deadline}`
  const sign = hmacSha1Base64(cfg.secretKey, base)
  return `${base}&token=${cfg.accessKey}:${sign}`
}

async function deleteObject(key) {
  const cfg = config()
  const encoded = urlSafeEncode(`${cfg.bucket}:${key}`)
  // 删除走 RS 服务的 /delete/<encodedEntry>（不是 /v6/del/，那是另一个接口）。
  // 鉴权用 QBox v1：签名串是 path + "\n"。注意这跟管理接口的 V2 签名不同，
  // 用 V2 会得到 "bad token"。
  const path = `/delete/${encoded}`
  const url = `https://rs.qbox.me${path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `QBox ${cfg.accessKey}:${hmacSha1Base64(cfg.secretKey, `${path}\n`)}` },
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`qiniu delete failed (${response.status}): ${body}`)
  }
  console.log(`deleted ${key}`)
}

const [command, ...args] = process.argv.slice(2)

try {
  if (command === 'upload') {
    const [file, key] = args
    if (!file || !key) throw new Error('usage: upload <file> <key>')
    await upload(file, key)
  } else if (command === 'private-url') {
    const [key, ttl] = args
    if (!key) throw new Error('usage: private-url <key> [ttl]')
    console.log(privateUrl(key, Number(ttl || 1800)))
  } else if (command === 'delete') {
    const [key] = args
    if (!key) throw new Error('usage: delete <key>')
    await deleteObject(key)
  } else {
    throw new Error('usage: upload | private-url | delete')
  }
} catch (error) {
  console.error(String(error?.message ?? error))
  process.exit(1)
}
