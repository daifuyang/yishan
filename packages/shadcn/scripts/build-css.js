#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'

const start = Date.now()
fs.rmSync('temp', { recursive: true, force: true })
fs.mkdirSync('temp', { recursive: true })

// ① Less → 中间 CSS
execSync('npx lessc assets/css/index.less temp/index.css', { stdio: 'inherit' })

// ② 复制assets/css/tailwind.css到temp
fs.copyFileSync('assets/css/tailwindcss.css', 'temp/tailwind.css')

// 创建入口css包含tailwind.css和index.css
fs.writeFileSync('temp/output.css', '@import "tailwind.css"; @import "index.css";')

// ③ PostCSS（tailwind + 合并 + 压缩）合并temp下所有的css
execSync('npx postcss temp/output.css -o dist/index.css', { stdio: 'inherit' })

// ④ 删除temp目录
fs.rmSync('temp', { recursive: true, force: true })

console.log(`⚡️ 打包样式完成 ${Date.now() - start} ms`)