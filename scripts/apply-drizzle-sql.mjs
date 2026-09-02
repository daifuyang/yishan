#!/usr/bin/env node
// 去除 drizzle-kit 的 "--> statement-breakpoint" 标记, 然后用 mysql 客户端灌入。
// 用法：node apply-drizzle-sql.mjs <drizzle-sql-file> [db-name]
//
// 默认目标容器 `mysql-local`（本地通用 mysqld），密码取自 scripts/local-dev-stack.yml。
// 多项目复用时通过 [db-name] 区分 schema。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [,, file, db = "yishan"] = process.argv;
if (!file) {
  console.error("Usage: node apply-drizzle-sql.mjs <drizzle-sql-file> [db]");
  process.exit(2);
}
const absFile = resolve(file);
const sql = readFileSync(absFile, "utf8")
  .split(/\r?\n/)
  // 整行去掉(独立行) + 行尾/行内附加 marker 也要剥除
  .map((line) => line.replace(/-->\s*statement-breakpoint.*$/, "").trimEnd())
  .filter((line) => !/^-->\s*statement-breakpoint\s*$/.test(line))
  .join("\n");

try {
  execFileSync("docker", [
    "exec",
    "-i",
    "mysql-local",
    "mysql",
    "-uroot",
    "-pdev-root-only-do-not-use-in-prod",
    "--comments",
    db,
  ], { input: sql, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // mysql 在 stderr 写 "Using a password on the command line interface can be insecure."
  // 这不致命,exit code 仍会从子进程透传。如果到了这里,说明是真的失败。
  console.error(`Failed to apply ${file}`);
  process.exit(err.status ?? 1);
}
console.log(`OK ${file}`);