#!/usr/bin/env node
/**
 * 打包后预压缩静态资源：为 dist 里的可压缩文件生成同名 `.br` / `.gz`。
 *
 * 为什么在打包时压，而不是让服务器实时压：
 * 1. 服务器实时压缩每次请求都要烧 CPU（演示机只有 4 核，还要跑 API 和其它站点）；
 * 2. 预压缩可以用 brotli（比 gzip 小 20% 左右），而 nginx 的动态 gzip 只会出 gzip；
 * 3. 官方做法就是「同目录放 .br/.gz，服务器直接发预压缩文件」——
 *    nginx 侧对应 `gzip_static on` / `brotli_static on`，
 *    Fastify 侧对应 `@fastify/static` 的 `preCompressed: true`。
 *
 * 产物由 `@fastify/static` 的 `preCompressed: true` 消费（见
 * packages/core/system-api/src/core/plugins/external/static.ts）：
 * 按 Accept-Encoding 依次尝试 `.br` → `.gz` → 原文件。
 *
 * 幂等：重复执行会覆盖旧产物；`dist` 每次构建都是干净的。
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

/** 只压这些类型：文本类，压缩收益高。图片/字体已经是压缩格式，跳过。 */
const COMPRESSIBLE = new Set(['.js', '.mjs', '.css', '.html', '.json', '.svg', '.txt', '.map']);

/** 小于这个体积不压：省下的空间抵不上多一次文件系统的开销，nginx 也会忽略。 */
const MIN_SIZE = 1024;

/** brotli quality：5 是「几乎不增加构建时间」和「体积」的平衡点；11 还要再慢一截。 */
const BROTLI_QUALITY = 5;
const GZIP_LEVEL = 9;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  let rawTotal = 0;
  let brTotal = 0;
  let gzTotal = 0;
  let fileCount = 0;
  let skipped = 0;

  for await (const file of walk(DIST)) {
    const ext = extname(file);
    if (!COMPRESSIBLE.has(ext)) {
      skipped += 1;
      continue;
    }
    // 已经是压缩产物就跳过，避免把 .gz 再压成 .gz.gz
    if (file.endsWith('.br') || file.endsWith('.gz')) {
      continue;
    }
    const info = await stat(file);
    if (info.size < MIN_SIZE) {
      skipped += 1;
      continue;
    }

    const content = await readFile(file);
    const br = brotliCompressSync(content, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: content.length,
      },
    });
    const gz = gzipSync(content, { level: GZIP_LEVEL });

    await writeFile(`${file}.br`, br);
    await writeFile(`${file}.gz`, gz);

    rawTotal += content.length;
    brTotal += br.length;
    gzTotal += gz.length;
    fileCount += 1;
  }

  if (fileCount === 0) {
    console.warn('[precompress] 没有可压缩的文件，确认 dist 是否已生成');
    return;
  }

  const pct = (n) => `${((1 - n / rawTotal) * 100).toFixed(1)}%`;
  console.log(
    `[precompress] ${fileCount} 个文件：原始 ${(rawTotal / 1024 / 1024).toFixed(2)}MB → ` +
      `br ${(brTotal / 1024 / 1024).toFixed(2)}MB (-${pct(brTotal)}) / ` +
      `gz ${(gzTotal / 1024 / 1024).toFixed(2)}MB (-${pct(gzTotal)})，跳过 ${skipped} 个`,
  );
  console.log(`[precompress] 输出目录：${relative(process.cwd(), DIST) || 'dist'}`);
}

main().catch((err) => {
  console.error('[precompress] 失败：', err);
  process.exit(1);
});
