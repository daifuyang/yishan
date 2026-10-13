// FC 上托管 H5 产物的静态服务器：零依赖，只读 ./public。
// /api/* 由 FC 自定义域名路由直接转给 API 函数，不会到这里。
import { createReadStream, promises as fs } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public')
const PORT = Number(process.env.PORT || 9000)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.map', '.txt'])

async function resolveFile(urlPath) {
  let pathname
  try {
    pathname = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const target = normalize(join(ROOT, pathname))
  // 拒绝跳出 public 目录的路径
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null
  const stat = await fs.stat(target).catch(() => null)
  if (stat?.isFile()) return { file: target, stat }
  if (stat?.isDirectory()) {
    const index = join(target, 'index.html')
    const indexStat = await fs.stat(index).catch(() => null)
    if (indexStat?.isFile()) return { file: index, stat: indexStat }
  }
  return null
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  const url = new URL(req.url || '/', 'http://localhost')
  // H5 使用 hash 路由，未知路径一律回到入口页
  const found = (await resolveFile(url.pathname)) || (await resolveFile('/index.html'))
  if (!found) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found')
    return
  }
  const ext = extname(found.file).toLowerCase()
  // Taro H5 产物（js/app.js、chunk/1024.js…）文件名不带内容哈希，不能长期缓存：
  // 一律每次协商，内容未变时返回 304，发版后立即生效
  const etag = `W/"${found.stat.size.toString(16)}-${Math.floor(found.stat.mtimeMs).toString(16)}"`
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    ETag: etag,
    'Last-Modified': found.stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers).end()
    return
  }
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')
  if (gzip) {
    headers['Content-Encoding'] = 'gzip'
    headers.Vary = 'Accept-Encoding'
  } else {
    headers['Content-Length'] = found.stat.size
  }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(found.file)
  stream.on('error', () => res.destroy())
  ;(gzip ? stream.pipe(createGzip()) : stream).pipe(res)
})

server.listen(PORT, () => {
  console.log(`yishan-h5 static server listening on ${PORT}`)
})
